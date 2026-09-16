// ============================================================================
// Enterprise-Grade Gemini & AI API Client
// Implements Exponential Backoff with Jitter, HTTP 429/500/503 Recovery,
// Timeout Guards, Safe Markdown Code Fence Stripping & Resilient JSON Extraction
// ============================================================================

import { toast } from "sonner";

export interface RequestOptions {
  timeoutMs?: number;
  maxRetries?: number;
  initialDelayMs?: number;
  silentToast?: boolean;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  text?: string;
  error?: string;
  isQuotaExceeded?: boolean;
  attempts?: number;
}

/**
 * Strips markdown code fences (```json ... ``` or ``` ...) and returns clean string
 */
export function stripMarkdownFences(raw: string): string {
  if (!raw || typeof raw !== "string") return "";
  let clean = raw.trim();

  // Strip leading code fence
  clean = clean.replace(/^```(?:json|javascript|ts|typescript)?\s*\n?/i, "");
  // Strip trailing code fence
  clean = clean.replace(/\n?```\s*$/i, "");

  return clean.trim();
}

/**
 * Resilient JSON Extractor
 * Attempts direct parse first; if malformed, tries to locate and parse JSON substring.
 * Returns fallback if all attempts fail, preventing uncaught fatal crashes.
 */
export function safeExtractJson<T = any>(rawText: string, fallbackValue: T): T {
  if (!rawText || typeof rawText !== "string") {
    return fallbackValue;
  }

  const cleaned = stripMarkdownFences(rawText);

  // 1. Direct parse attempt
  try {
    return JSON.parse(cleaned) as T;
  } catch {}

  // 2. Substring extraction attempt (find outermost { ... } or [ ... ])
  try {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const candidate = cleaned.slice(firstBrace, lastBrace + 1);
      return JSON.parse(candidate) as T;
    }

    const firstBracket = cleaned.indexOf("[");
    const lastBracket = cleaned.lastIndexOf("]");
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      const candidate = cleaned.slice(firstBracket, lastBracket + 1);
      return JSON.parse(candidate) as T;
    }
  } catch {}

  // 3. Fallback safely
  console.warn("[ApiClient] Safe JSON extraction failed, using default fallback value.");
  return fallbackValue;
}

/**
 * Exponential backoff sleep with randomized jitter
 */
function sleepWithJitter(delayMs: number): Promise<void> {
  const jitter = Math.random() * 300;
  return new Promise((resolve) => setTimeout(resolve, delayMs + jitter));
}

/**
 * Resilient Fetch wrapper with Exponential Backoff for AI / Gemini requests
 */
export async function callAiApi(
  url: string,
  bodyPayload: any,
  options: RequestOptions = {}
): Promise<ApiResponse> {
  const {
    timeoutMs = 35000,
    maxRetries = 3,
    initialDelayMs = 1000,
    silentToast = false,
  } = options;

  let currentDelay = initialDelayMs;
  let attempts = 0;
  let lastErrorMessage = "Unknown network error";

  while (attempts < maxRetries) {
    attempts++;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle Rate Limiting (429) or Service Overload (500, 502, 503, 504)
      if (response.status === 429 || response.status >= 500) {
        const errorText = await response.text().catch(() => "");
        const isQuota = response.status === 429 || errorText.toLowerCase().includes("quota");
        lastErrorMessage = isQuota
          ? "AI model rate limit reached. Retrying automatically..."
          : `Service overloaded (HTTP ${response.status}). Retrying...`;

        if (attempts < maxRetries) {
          console.warn(`[ApiClient] Attempt ${attempts} failed (${response.status}). Backing off ${currentDelay}ms...`);
          await sleepWithJitter(currentDelay);
          currentDelay *= 2;
          continue;
        } else {
          const finalMsg = isQuota
            ? "AI service is currently busy or rate-limited. Offline fallback engaged."
            : "AI service is temporarily unavailable. Please try again shortly.";
          if (!silentToast) toast.error(finalMsg);
          return { ok: false, error: finalMsg, isQuotaExceeded: isQuota, attempts };
        }
      }

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        lastErrorMessage = json?.error || `Request failed with status ${response.status}`;
        if (attempts < maxRetries) {
          await sleepWithJitter(currentDelay);
          currentDelay *= 2;
          continue;
        }
        if (!silentToast) toast.error(lastErrorMessage);
        return { ok: false, error: lastErrorMessage, attempts };
      }

      // Successful response
      return {
        ok: true,
        data: json,
        text: json?.text || json?.content || json?.response || "",
        attempts,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);

      const isAbort = err.name === "AbortError" || err.message?.includes("aborted");
      lastErrorMessage = isAbort
        ? "AI inference timed out. Retrying with backup..."
        : (err?.message || "Network connection error");

      if (attempts < maxRetries) {
        console.warn(`[ApiClient] Attempt ${attempts} error: ${lastErrorMessage}. Retrying in ${currentDelay}ms...`);
        await sleepWithJitter(currentDelay);
        currentDelay *= 2;
      } else {
        const friendlyMsg = isAbort
          ? "AI request timed out after multiple attempts. Fallback parser engaged."
          : "Could not reach AI inference gateway. Local processing ready.";
        if (!silentToast) toast.error(friendlyMsg);
        return { ok: false, error: friendlyMsg, attempts };
      }
    }
  }

  return { ok: false, error: lastErrorMessage, attempts };
}

/**
 * Dedicated Gemini API Client with automatic exponential backoff,
 * jitter, and timeout recovery.
 */
export async function callGeminiWithBackoff(
  prompt: string,
  options: { systemPrompt?: string; model?: string; maxTokens?: number; temperature?: number } & RequestOptions = {}
): Promise<ApiResponse> {
  const { systemPrompt, model = "gemini-3.8-flash", maxTokens, temperature, ...requestOpts } = options;
  const messages: ChatMessage[] = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  const payload = {
    model,
    provider: "gemini",
    messages,
    max_tokens: maxTokens,
    temperature,
  };

  return callAiApi("/api/providers/chat", payload, requestOpts);
}
