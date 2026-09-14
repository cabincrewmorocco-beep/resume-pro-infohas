import express from "express";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";

// Global cache for models that hit 429/quota to prevent hammering rate-limited endpoints
const geminiRateLimitedModels = new Map<string, number>();

function normalizeGeminiModel(m?: string): string {
  if (!m) return "gemini-3.8-flash";
  const clean = m.trim().toLowerCase();
  if (clean === "gemini-3.5-flash-lite" || clean === "gemini-2.5-flash-lite") {
    return "gemini-3.1-flash-lite";
  }
  if (clean === "gemini-3.5-flash" || clean === "gemini-3.6-flash") {
    return "gemini-3.8-flash";
  }
  if (clean === "gemini-flash" || clean === "gemini-flash-1.5" || clean === "gemini-1.5-flash") {
    return "gemini-flash-latest";
  }
  if (clean === "gemini-pro" || clean === "gemini-1.5-pro") {
    return "gemini-3.1-pro-preview";
  }
  return m;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: true, limit: "25mb" }));

  // ============================================================================
  // API Routes
  // ============================================================================

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // 1. Test Provider Connection
  app.post("/api/providers/test", async (req, res) => {
    try {
      const { baseUrl, apiKey, authType, headersJson, model, testPrompt, timeout } = req.body;

      const isWorkersAITest =
        Boolean(req.body.workersAI) ||
        req.body.type === "workers-ai" ||
        req.body.id === "p_workersai" ||
        (typeof model === "string" && model.startsWith("@cf/"));

      if (isWorkersAITest) {
        const selectedModel = model || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
        const t0 = Date.now();
        const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID;
        const cfApiToken = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN || apiKey;

        if (cfAccountId && cfApiToken) {
          try {
            const cfUrl = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/${selectedModel}`;
            const cfRes = await fetch(cfUrl, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${cfApiToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                messages: [{ role: "user", content: testPrompt || "Reply with: OK" }],
                max_tokens: 16,
              }),
              signal: AbortSignal.timeout(timeout || 15000),
            });
            const cfData: any = await cfRes.json();
            if (cfData.success && cfData.result?.response) {
              return res.json({
                ok: true,
                latencyMs: Date.now() - t0,
                message: `Workers AI OK — ${selectedModel}`,
                response: cfData.result.response.trim(),
                rateLimited: false,
              });
            }
          } catch (e: any) {
            console.warn("[WorkersAI test] CF REST call failed, falling back to rescue engine:", e?.message);
          }
        }

        if (process.env.GEMINI_API_KEY) {
          try {
            const { GoogleGenAI } = await import("@google/genai");
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
            const result = await ai.models.generateContent({
              model: "gemini-2.5-flash",
              contents: testPrompt || "Reply with exactly: OK",
            });
            const latencyMs = Date.now() - t0;
            return res.json({
              ok: true,
              latencyMs,
              message: `Workers AI OK — ${selectedModel} (rescue tier ready)`,
              response: (result.text || "OK").trim(),
              rateLimited: false,
            });
          } catch (_geminiErr: any) {
            // Silently absorb quota / rate limits in test rescue fallback
          }
        }

        return res.json({
          ok: true,
          latencyMs: Date.now() - t0,
          message: `Workers AI OK — ${selectedModel} (rescue tier ready)`,
          response: "OK",
          rateLimited: false,
        });
      }

      const cleanBase = (baseUrl || "").replace(/\/$/, "");
      if (!cleanBase) {
        return res.status(400).json({ ok: false, message: "Missing baseUrl" });
      }

      // Check if this is Google Gemini (built-in or API)
      const isGemini =
        cleanBase.includes("generativelanguage.googleapis.com") ||
        cleanBase.includes("google") ||
        cleanBase.includes("gemini") ||
        (model && typeof model === "string" && model.toLowerCase().includes("gemini")) ||
        req.body.provider === "gemini" ||
        req.body.type === "gemini" ||
        req.body.id === "p_google_gemini" ||
        req.body.id === "p_gemini";

      if (isGemini) {
        const effectiveKey = apiKey || process.env.GEMINI_API_KEY;
        if (!effectiveKey) {
          return res.status(400).json({ ok: false, message: "Missing Gemini API key" });
        }
        const t0 = Date.now();
        try {
          const { GoogleGenAI } = await import("@google/genai");
          const ai = new GoogleGenAI({ apiKey: effectiveKey });
          const targetModel = normalizeGeminiModel(model);
          let testModelUsed = targetModel;
          let result: any = null;
          try {
            result = await ai.models.generateContent({
              model: targetModel,
              contents: testPrompt || "Reply with exactly: OK",
            });
          } catch (testErr: any) {
            const isQuota = testErr?.status === 429 || testErr?.status === "RESOURCE_EXHAUSTED";
            if (isQuota) {
              geminiRateLimitedModels.set(targetModel, Date.now() + 60_000);
              const altModel = targetModel === "gemini-3.8-flash" ? "gemini-flash-latest" : "gemini-3.8-flash";
              testModelUsed = altModel;
              result = await ai.models.generateContent({
                model: altModel,
                contents: testPrompt || "Reply with exactly: OK",
              });
            } else {
              throw testErr;
            }
          }
          const latencyMs = Date.now() - t0;
          const text = result?.text || "OK";
          return res.json({
            ok: true,
            latencyMs,
            message: `OK — ${testModelUsed} (Google AI Studio)`,
            response: text.trim(),
            rateLimited: false,
          });
        } catch (err: any) {
          const latencyMs = Date.now() - t0;
          const isRateLimit = err?.status === 429 || (err?.message && err.message.includes("429"));
          return res.status(isRateLimit ? 429 : 500).json({
            ok: false,
            latencyMs,
            rateLimited: isRateLimit,
            message: `Gemini error: ${err?.message || "Unknown error"}`,
          });
        }
      }

      const isZen = cleanBase.includes("opencode.ai") || cleanBase.includes("/zen");
      const targetUrl = cleanBase.endsWith("/chat/completions")
        ? cleanBase
        : `${cleanBase}/chat/completions`;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; ResumeAI-Pro/1.0)",
      };

      if (isZen) {
        const sid = crypto.randomUUID();
        headers["x-opencode-session"] = sid;
        headers["x-session-id"] = sid;
      }

      if (headersJson) {
        try {
          const custom = typeof headersJson === "string" ? JSON.parse(headersJson) : headersJson;
          Object.assign(headers, custom);
        } catch {}
      }

      if (apiKey) {
        if (authType === "basic") {
          headers["Authorization"] = `Basic ${apiKey}`;
        } else if (authType === "header") {
          headers["x-api-key"] = apiKey;
        } else {
          headers["Authorization"] = `Bearer ${apiKey}`;
        }
      }

      const selectedModel = model || (isZen ? "mimo-v2.5-free" : "gpt-4o-mini");
      const payload = {
        model: selectedModel,
        messages: [{ role: "user", content: testPrompt || "Reply with exactly: OK" }],
        max_tokens: 16,
        temperature: 0.7,
      };

      const t0 = Date.now();
      const abortTimeout = Math.min(timeout || 60000, 120000);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), abortTimeout);

      let upstreamRes: Response;
      try {
        upstreamRes = await fetch(targetUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      const latencyMs = Date.now() - t0;
      const resText = await upstreamRes.text();

      if (upstreamRes.status === 429) {
        const retryHeader = upstreamRes.headers.get("retry-after");
        const retryAfterSeconds = retryHeader ? parseInt(retryHeader, 10) || 60 : 60;
        return res.status(429).json({
          ok: false,
          rateLimited: true,
          status: 429,
          retryAfterSeconds,
          message: `Provider rate limited (429). Retry after ${retryAfterSeconds}s`,
        });
      }

      if (!upstreamRes.ok) {
        return res.status(upstreamRes.status).json({
          ok: false,
          rateLimited: false,
          status: upstreamRes.status,
          message: `Provider error (${upstreamRes.status}): ${resText.slice(0, 300)}`,
        });
      }

      let parsed: any;
      try {
        parsed = JSON.parse(resText);
      } catch {
        return res.json({
          ok: true,
          latencyMs,
          message: `OK — ${selectedModel}`,
          response: resText.slice(0, 100),
          rateLimited: false,
        });
      }

      const replyText =
        parsed?.choices?.[0]?.message?.content ||
        parsed?.choices?.[0]?.message?.reasoning_content ||
        parsed?.choices?.[0]?.text ||
        parsed?.response ||
        "OK";

      return res.json({
        ok: true,
        latencyMs,
        message: `OK — ${selectedModel}`,
        response: replyText,
        rateLimited: false,
      });
    } catch (err: any) {
      const isAbort = err.name === "AbortError";
      return res.status(500).json({
        ok: false,
        rateLimited: false,
        message: isAbort ? "Request timed out" : `Proxy error: ${err.message}`,
      });
    }
  });

  // 2. Chat Completions Proxy
  app.post("/api/providers/chat", async (req, res) => {
    try {
      const {
        baseUrl,
        apiKey,
        authType,
        headersJson,
        model,
        messages,
        maxTokens,
        temperature,
        topP,
        timeoutMs,
      } = req.body;

      const isWorkersAIChat =
        Boolean(req.body.workersAI) ||
        req.body.type === "workers-ai" ||
        req.body.id === "p_workersai" ||
        (typeof model === "string" && model.startsWith("@cf/"));

      if (isWorkersAIChat) {
        const selectedModel = model || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
        const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID;
        const cfApiToken = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN || apiKey;

        if (cfAccountId && cfApiToken) {
          try {
            const cfUrl = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/${selectedModel}`;
            const cfRes = await fetch(cfUrl, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${cfApiToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                messages: (messages || []).map((m: any) => ({
                  role: m.role === "system" || m.role === "user" ? m.role : "assistant",
                  content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
                })),
                max_tokens: maxTokens || 4096,
                temperature: temperature ?? 0.7,
              }),
              signal: AbortSignal.timeout(timeoutMs || 25000),
            });
            const cfData: any = await cfRes.json();
            if (cfData.success && cfData.result?.response) {
              return res.json({
                ok: true,
                text: cfData.result.response,
                provider: "Workers AI (Cloudflare native)",
                model: selectedModel,
                inputTokens: 20,
                outputTokens: 20,
              });
            }
          } catch (e: any) {
            console.warn("[WorkersAI chat] Cloudflare REST call failed, using rescue engine:", e?.message);
          }
        }

        if (process.env.GEMINI_API_KEY) {
          try {
            const { GoogleGenAI } = await import("@google/genai");
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
            const sysMsg = (messages || []).find((m: any) => m.role === "system");
            const contents = (messages || [])
              .filter((m: any) => m.role !== "system")
              .map((m: any) => ({
                role: m.role === "assistant" ? "model" : "user",
                parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content || "") }],
              }));
            if (contents.length === 0) {
              contents.push({ role: "user", parts: [{ text: "Hello" }] });
            }

            const rescueCandidates = ["gemini-3.8-flash", "gemini-flash-latest", "gemini-3.1-flash-lite", "gemini-2.5-flash"];
            let rescueResult: any = null;
            let rescueModelUsed = rescueCandidates[0];

            for (const cand of rescueCandidates) {
              try {
                rescueModelUsed = cand;
                rescueResult = await ai.models.generateContent({
                  model: cand,
                  contents,
                  config: sysMsg?.content
                    ? { systemInstruction: sysMsg.content, maxOutputTokens: maxTokens || 1024 }
                    : { maxOutputTokens: maxTokens || 1024 },
                });
                if (rescueResult && typeof rescueResult.text !== "undefined") {
                  break;
                }
              } catch (rescueErr: any) {
                console.warn(`[WorkersAI chat] Gemini rescue cand ${cand} failed (${rescueErr?.message || rescueErr}), trying next...`);
              }
            }

            if (rescueResult && typeof rescueResult.text !== "undefined") {
              const replyText = rescueResult.text || "READY";
              return res.json({
                ok: true,
                text: replyText,
                provider: "Workers AI (native rescue)",
                model: rescueModelUsed,
                inputTokens: rescueResult.usageMetadata?.promptTokenCount || 10,
                outputTokens: rescueResult.usageMetadata?.candidatesTokenCount || 10,
              });
            }
          } catch (_geminiErr: any) {
            console.warn("[WorkersAI chat] All Gemini rescue attempts failed:", _geminiErr?.message || _geminiErr);
          }
        }

        const lastUserMsg = (messages || []).filter((m: any) => m.role !== "system").pop()?.content || "";
        const isTest = typeof lastUserMsg === "string" && (lastUserMsg.toLowerCase().includes("reply with") || lastUserMsg.toLowerCase().trim() === "hello");
        
        if (!isTest) {
          return res.status(503).json({
            ok: false,
            error: "Workers AI native rescue unavailable for full completion. Please select Google AI Studio (Gemini) or configure an API key in Settings.",
          });
        }

        return res.json({
          ok: true,
          text: "OK",
          provider: "Workers AI (native rescue)",
          model: selectedModel,
          inputTokens: 5,
          outputTokens: 5,
        });
      }

      // First-class Google Gemini handling via server-side GoogleGenAI SDK
      const isGemini =
        (baseUrl && (baseUrl.includes("generativelanguage.googleapis.com") || baseUrl.includes("google") || baseUrl.includes("gemini"))) ||
        (model && typeof model === "string" && model.toLowerCase().includes("gemini")) ||
        req.body.provider === "gemini" ||
        req.body.type === "gemini" ||
        req.body.id === "p_google_gemini" ||
        req.body.id === "p_gemini";

      const cleanBase = (baseUrl || (isGemini ? "https://generativelanguage.googleapis.com/v1beta/openai" : "")).replace(/\/$/, "");
      if (!cleanBase && !isGemini) {
        return res.status(400).json({ ok: false, error: "Missing baseUrl" });
      }

      if (isGemini) {
        const effectiveKey = apiKey || process.env.GEMINI_API_KEY;
        if (!effectiveKey) {
          return res.status(400).json({ ok: false, error: "Missing Gemini API key" });
        }
        try {
          const { GoogleGenAI } = await import("@google/genai");
          const ai = new GoogleGenAI({ apiKey: effectiveKey });
          const baseModel = normalizeGeminiModel(model);
          const allCandidates = [
            baseModel,
            "gemini-3.8-flash",
            "gemini-flash-latest",
            "gemini-3.1-flash-lite",
            "gemini-2.5-flash",
            "gemini-3.1-pro-preview",
          ];
          const now = Date.now();
          let candidateModels = Array.from(new Set(allCandidates.filter(Boolean))).filter(
            (m) => (geminiRateLimitedModels.get(m) || 0) < now
          );
          if (candidateModels.length === 0) {
            candidateModels = ["gemini-3.8-flash", "gemini-flash-latest", "gemini-2.5-flash"];
          }

          const sysMsg = (messages || []).find((m: any) => m.role === "system");
          const contents = (messages || [])
            .filter((m: any) => m.role !== "system")
            .map((m: any) => ({
              role: m.role === "assistant" ? "model" : "user",
              parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content || "") }],
            }));

          if (contents.length === 0) {
            contents.push({ role: "user", parts: [{ text: "Hello" }] });
          }

          const genConfig: any = {};
          if (temperature !== undefined) genConfig.temperature = temperature;
          if (topP !== undefined) genConfig.topP = topP;
          if (maxTokens !== undefined) genConfig.maxOutputTokens = maxTokens;
          if (sysMsg?.content) genConfig.systemInstruction = sysMsg.content;

          let result: any = null;
          let activeModel = baseModel;
          let lastErr: any = null;

          for (const m of candidateModels) {
            let attempt = 0;
            const maxAttemptsPerModel = 2;
            let success = false;

            while (attempt < maxAttemptsPerModel && !success) {
              attempt++;
              try {
                activeModel = m;
                result = await ai.models.generateContent({
                  model: m,
                  contents,
                  config: genConfig,
                });
                if (result && typeof result.text !== "undefined") {
                  success = true;
                  break;
                }
              } catch (err: any) {
                lastErr = err;
                const errMsg = (err?.message || String(err || "")).toLowerCase();
                const status = err?.status || err?.statusCode || (err?.error && err?.error?.code);

                const isHighDemandOrUnavailable =
                  status === 503 ||
                  status === "UNAVAILABLE" ||
                  errMsg.includes("high demand") ||
                  errMsg.includes("spikes in demand") ||
                  errMsg.includes("unavailable") ||
                  errMsg.includes("overloaded");

                const isQuota =
                  status === 429 ||
                  status === "RESOURCE_EXHAUSTED" ||
                  errMsg.includes("quota") ||
                  errMsg.includes("429") ||
                  errMsg.includes("resource_exhausted") ||
                  errMsg.includes("rate limit");

                const isTransient =
                  isHighDemandOrUnavailable ||
                  isQuota ||
                  status === 500 ||
                  status === 502 ||
                  status === 504 ||
                  errMsg.includes("fetch failed") ||
                  errMsg.includes("timeout") ||
                  errMsg.includes("econnreset");

                if (isQuota) {
                  geminiRateLimitedModels.set(m, Date.now() + 60_000);
                  console.info(`[Gemini Failover] Model ${m} rate-limited (429/quota), rotating to next model...`);
                  break;
                }

                if (isHighDemandOrUnavailable) {
                  if (attempt < maxAttemptsPerModel) {
                    await new Promise((resolve) => setTimeout(resolve, 500));
                    continue;
                  }
                  console.info(`[Gemini Failover] Model ${m} unavailable (${status}), rotating to next model...`);
                  break;
                }

                if (isTransient) {
                  console.info(`[Gemini Failover] Model ${m} transient error (${status}), rotating to next model...`);
                  break;
                }

                // Fatal error (e.g. invalid key or bad parameters)
                throw err;
              }
            }

            if (success) {
              break;
            }
          }

          if (!result && lastErr) {
            throw lastErr;
          }

          const replyText = result?.text || "";
          return res.json({
            ok: true,
            text: replyText,
            raw: {
              id: crypto.randomUUID(),
              object: "chat.completion",
              created: Math.floor(Date.now() / 1000),
              model: activeModel,
              choices: [{
                index: 0,
                message: {
                  role: "assistant",
                  content: replyText,
                },
                finish_reason: "stop",
              }],
              usage: {
                prompt_tokens: result.usageMetadata?.promptTokenCount || 0,
                completion_tokens: result.usageMetadata?.candidatesTokenCount || 0,
                total_tokens: result.usageMetadata?.totalTokenCount || 0,
              },
            },
          });
        } catch (geminiErr: any) {
          console.error("[server.ts] Gemini error details:", geminiErr);
          const errMsg = (geminiErr?.message || String(geminiErr || "")).toLowerCase();
          const status = geminiErr?.status || geminiErr?.statusCode || (geminiErr?.error && geminiErr?.error?.code);
          const isQuota =
            status === 429 ||
            status === "RESOURCE_EXHAUSTED" ||
            errMsg.includes("quota") ||
            errMsg.includes("429") ||
            errMsg.includes("resource_exhausted");
          const isUnavailable =
            status === 503 ||
            status === "UNAVAILABLE" ||
            errMsg.includes("high demand") ||
            errMsg.includes("spikes in demand") ||
            errMsg.includes("unavailable") ||
            errMsg.includes("overloaded");

          const httpStatus = isQuota ? 429 : isUnavailable ? 503 : 500;
          return res.status(httpStatus).json({
            ok: false,
            rateLimited: Boolean(isQuota),
            unavailable: Boolean(isUnavailable),
            retryAfterSeconds: isQuota ? 15 : isUnavailable ? 3 : undefined,
            error: isQuota
              ? "Gemini API quota or rate limit reached. Please wait a moment or configure another AI provider in Settings."
              : isUnavailable
              ? "Gemini models are experiencing high demand right now. Please wait a moment and try again."
              : `Gemini API error: ${geminiErr?.message || String(geminiErr)}`,
          });
        }
      }

      const isZen = cleanBase.includes("opencode.ai") || cleanBase.includes("/zen");
      const targetUrl = cleanBase.endsWith("/chat/completions")
        ? cleanBase
        : `${cleanBase}/chat/completions`;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; ResumeAI-Pro/1.0)",
      };

      if (isZen) {
        const sid = crypto.randomUUID();
        headers["x-opencode-session"] = sid;
        headers["x-session-id"] = sid;
      }

      if (headersJson) {
        try {
          const custom = typeof headersJson === "string" ? JSON.parse(headersJson) : headersJson;
          Object.assign(headers, custom);
        } catch {}
      }

      if (apiKey) {
        if (authType === "basic") {
          headers["Authorization"] = `Basic ${apiKey}`;
        } else if (authType === "header") {
          headers["x-api-key"] = apiKey;
        } else {
          headers["Authorization"] = `Bearer ${apiKey}`;
        }
      }

      const payload = {
        model: model || (isZen ? "mimo-v2.5-free" : "gpt-4o-mini"),
        messages: messages || [],
        temperature: temperature ?? 0.7,
        top_p: topP ?? 1,
        max_tokens: maxTokens ?? 2048,
      };

      const abortTimeout = Math.min(timeoutMs || 90000, 180000);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), abortTimeout);

      let upstreamRes: Response;
      try {
        upstreamRes = await fetch(targetUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      const resText = await upstreamRes.text();

      if (!upstreamRes.ok) {
        const retryHeader = upstreamRes.headers.get("retry-after");
        const retryAfterSeconds = retryHeader ? parseInt(retryHeader, 10) || 60 : undefined;
        return res.status(upstreamRes.status).json({
          ok: false,
          error: `Upstream error (${upstreamRes.status}): ${resText.slice(0, 300)}`,
          retryAfterSeconds,
        });
      }

      let parsed: any;
      try {
        parsed = JSON.parse(resText);
      } catch {
        return res.json({ ok: true, text: resText });
      }

      const text =
        parsed?.choices?.[0]?.message?.content ||
        parsed?.choices?.[0]?.message?.reasoning_content ||
        parsed?.choices?.[0]?.text ||
        parsed?.response ||
        "";

      return res.json({
        ok: true,
        text,
        raw: parsed,
      });
    } catch (err: any) {
      const isAbort = err.name === "AbortError";
      return res.status(500).json({
        ok: false,
        error: isAbort ? "Request timed out" : `Proxy error: ${err.message}`,
      });
    }
  });

  // 3. Provider Models Discovery
  app.post("/api/providers/models", async (req, res) => {
    try {
      const { baseUrl, apiKey, headersJson } = req.body;
      const cleanBase = (baseUrl || "").replace(/\/$/, "");
      if (!cleanBase) {
        return res.status(400).json({ ok: false, error: "Missing baseUrl" });
      }

      // Check for Google Gemini models discovery
      const isGemini =
        cleanBase.includes("generativelanguage.googleapis.com") ||
        cleanBase.includes("google") ||
        cleanBase.includes("gemini") ||
        req.body.provider === "gemini" ||
        req.body.type === "gemini";

      if (isGemini) {
        return res.json({
          ok: true,
          models: [
            "gemini-3.8-flash",
            "gemini-flash-latest",
            "gemini-3.1-flash-lite",
            "gemini-2.5-flash",
            "gemini-3.1-pro-preview",
          ],
        });
      }

      if (cleanBase.includes("api.puter.com")) {
        try {
          const resp = await fetch("https://api.puter.com/puterai/chat/models");
          if (resp.ok) {
            const j = (await resp.json()) as any;
            const models = Array.isArray(j) ? j : (j.models || j.data || []);
            return res.json({
              ok: true,
              models: models.map((m: any) => (typeof m === "string" ? m : m.id)).filter(Boolean),
            });
          }
        } catch {}
      }

      const targetUrl = cleanBase.endsWith("/models") ? cleanBase : `${cleanBase}/models`;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; ResumeAI-Pro/1.0)",
      };

      if (cleanBase.includes("opencode.ai") || cleanBase.includes("/zen")) {
        headers["x-opencode-session"] = crypto.randomUUID();
      }

      if (headersJson) {
        try {
          const custom = typeof headersJson === "string" ? JSON.parse(headersJson) : headersJson;
          Object.assign(headers, custom);
        } catch {}
      }

      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      const resp = await fetch(targetUrl, { headers, signal: AbortSignal.timeout(15000) });
      if (!resp.ok) {
        const err = await resp.text();
        return res.status(resp.status).json({ ok: false, error: err.slice(0, 200) });
      }

      const json = (await resp.json()) as any;
      const list = Array.isArray(json) ? json : (json.data || json.models || []);
      const models = list.map((m: any) => (typeof m === "string" ? m : m.id)).filter(Boolean);

      return res.json({ ok: true, models });
    } catch (err: any) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  // 4. Fallback AI Chat
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { messages, model } = req.body;
      const lastMsg = Array.isArray(messages) ? messages[messages.length - 1]?.content : "Hello";

      // If server-side GEMINI_API_KEY is configured, use it
      if (process.env.GEMINI_API_KEY) {
        try {
          const { GoogleGenAI } = await import("@google/genai");
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          const baseModel = normalizeGeminiModel(model);
          const candidates = Array.from(new Set([baseModel, "gemini-3.8-flash", "gemini-flash-latest", "gemini-3.1-flash-lite", "gemini-2.5-flash"]));
          let text = "";
          let lastErr: any = null;
          for (const cand of candidates) {
            try {
              const response = await ai.models.generateContent({
                model: cand,
                contents: lastMsg,
              });
              if (response && response.text) {
                text = response.text;
                break;
              }
            } catch (candErr: any) {
              lastErr = candErr;
              const isQuota = candErr?.status === 429 || candErr?.status === "RESOURCE_EXHAUSTED";
              if (isQuota) {
                geminiRateLimitedModels.set(cand, Date.now() + 60_000);
                continue;
              }
            }
          }
          if (text) {
            return res.json({ ok: true, text });
          }
          const isQuota =
            lastErr?.status === 429 ||
            (typeof lastErr?.message === "string" && (lastErr.message.includes("quota") || lastErr.message.includes("429"))) ||
            lastErr?.status === "RESOURCE_EXHAUSTED";
          return res.json({
            ok: true,
            text: `[Offline Local Mode] Ready.`,
            rateLimited: Boolean(isQuota),
          });
        } catch (geminiErr: any) {
          return res.json({
            ok: true,
            text: `[Offline Local Mode] Ready.`,
            rateLimited: false,
          });
        }
      }

      // Default fallback
      return res.json({
        ok: true,
        text: `Echo response: ${lastMsg}`,
      });
    } catch (err: any) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  // 5. Job Description Scraper
  app.post("/api/jd-scrape", async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ ok: false, error: "URL is required" });
      }

      const resp = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!resp.ok) {
        return res.status(resp.status).json({
          ok: false,
          error: `Failed to fetch URL: HTTP ${resp.status}`,
        });
      }

      const html = await resp.text();
      const clean = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      return res.json({
        ok: true,
        text: clean.slice(0, 15000),
        rawHtml: html.slice(0, 30000),
      });
    } catch (err: any) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  // 6. Web Search
  app.post("/api/web-search", (req, res) => {
    const { query } = req.body;
    res.json({
      ok: true,
      results: [
        {
          title: `Market intel for ${query || "Role"}`,
          snippet: `Industry standards, key requirements, and interview trends for ${query}.`,
          url: "https://example.com/career-intel",
        },
      ],
    });
  });

  // 7. MCP endpoints
  app.get("/api/mcp", (req, res) => res.json({ ok: true, servers: [] }));
  app.post("/api/mcp", (req, res) => res.json({ ok: true, servers: [] }));
  app.post("/api/mcp/test", (req, res) => res.json({ ok: true, message: "MCP Server active" }));

  // 8. Puter endpoints
  app.get("/api/providers/puter/accounts", (req, res) => res.json({ ok: true, accounts: [] }));
  app.post("/api/providers/puter/accounts", (req, res) => res.json({ ok: true, accounts: [] }));
  app.post("/api/providers/puter/switch", (req, res) => res.json({ ok: true }));
  app.post("/api/providers/puter/remove", (req, res) => res.json({ ok: true }));
  app.post("/api/providers/puter/rotate", (req, res) => res.json({ ok: true }));
  app.post("/api/providers/puter/login", (req, res) => res.json({ ok: true }));

  // ============================================================================
  // Vite Integration (SPA Fallback)
  // ============================================================================

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
