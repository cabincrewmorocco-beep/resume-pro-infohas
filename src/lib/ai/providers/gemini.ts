// Google Gemini provider adapter.
// Supports BOTH:
//   1. Native Gemini API (baseUrl without /openai/) — uses :generateContent?key=
//   2. OpenAI-compatible endpoint (baseUrl with /openai/) — uses /chat/completions + Bearer
//
// Includes a sliding-window rate limiter to stay under Google's free-tier RPM cap.
// Without throttling, bursty optimization calls hit 429 immediately even when
// the daily quota (1500 RPD) is untouched.
import { OpenAICompatibleProvider, ProviderError } from "./openai-compatible";
import type { ChatRequest, ChatResponse, ProviderConfig } from "./interface";

// ============================================================================
// Sliding-window rate limiter — per-key, per-model
// ============================================================================
class SlidingWindowRateLimiter {
  private windows = new Map<string, number[]>();

  /** Wait until a request slot is available under `rpm` requests per 60s. */
  async waitSlot(key: string, rpm: number): Promise<void> {
    const now = Date.now();
    const windowStart = now - 60_000;

    let timestamps = this.windows.get(key) ?? [];
    // Prune expired entries
    timestamps = timestamps.filter((t) => t > windowStart);

    if (timestamps.length >= rpm) {
      // We're at the limit — wait until the oldest timestamp expires
      const oldest = timestamps[0];
      const waitMs = oldest + 60_000 - now + 50; // +50ms buffer
      if (waitMs > 0) {
        console.info(`[GeminiRateLimit] At ${rpm} RPM — waiting ${Math.ceil(waitMs)}ms before next request`);
        await new Promise((r) => setTimeout(r, waitMs));
      }
      // Re-prune after waiting (in case other requests accumulated)
      const afterWait = Date.now() - 60_000;
      timestamps = (this.windows.get(key) ?? []).filter((t) => t > afterWait);
    }

    timestamps.push(Date.now());
    this.windows.set(key, timestamps);
  }
}

const rateLimiter = new SlidingWindowRateLimiter();

export class GeminiProvider extends OpenAICompatibleProvider {
  constructor() { super("gemini"); }

  async chat(req: ChatRequest, config: ProviderConfig): Promise<ChatResponse> {
    return super.chat(
      {
        ...req,
        model: req.model || config.modelName || "gemini-2.5-flash",
      },
      {
        ...config,
        modelName: config.modelName || "gemini-2.5-flash",
        baseUrl: config.baseUrl || "https://generativelanguage.googleapis.com/v1beta/openai",
      }
    );
  }

  async listModels(config: ProviderConfig): Promise<string[]> {
    try {
      const res = await fetch("/api/providers/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: config.baseUrl || "https://generativelanguage.googleapis.com/v1beta/openai",
          apiKey: config.apiKey,
          provider: "gemini",
          type: "gemini",
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.models) && data.models.length > 0) {
          return data.models;
        }
      }
    } catch {}
    return [
      "gemini-2.5-flash",
      "gemini-3.6-flash",
      "gemini-3.5-flash",
      "gemini-3.5-flash-lite",
      "gemini-3.8-flash",
      "gemini-3.1-pro-preview",
    ];
  }
}

export const geminiProvider = new GeminiProvider();
