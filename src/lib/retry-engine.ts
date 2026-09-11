// ============================================================================
// Retry Engine
// ============================================================================

export interface RetryEngineOptions {
  maxAttempts?: number;
  backoffMs?: number;
  onRetry?: (attempt: number, error: unknown) => void;
}

export function createRetryEngine(options: RetryEngineOptions = {}) {
  const maxAttempts = options.maxAttempts ?? 3;
  const backoffMs = options.backoffMs ?? 500;

  return {
    async execute<T>(fn: (attempt: number) => Promise<T>): Promise<T> {
      let lastError: unknown;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          return await fn(attempt);
        } catch (err) {
          lastError = err;
          if (options.onRetry) {
            options.onRetry(attempt, err);
          }
          if (attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, backoffMs * attempt));
          }
        }
      }
      throw lastError;
    },
  };
}
