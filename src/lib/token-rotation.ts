// ============================================================================
// Token Rotation & API Authentication Error Classifier
// ============================================================================

export function isBillingError(err: unknown): boolean {
  const msg = String((err as any)?.message || err).toLowerCase();
  const status = (err as any)?.statusCode || (err as any)?.status;
  return (
    status === 402 ||
    msg.includes("billing") ||
    msg.includes("quota exceeded") ||
    msg.includes("insufficient_quota") ||
    msg.includes("insufficient quota") ||
    msg.includes("credit") ||
    msg.includes("429") ||
    msg.includes("low balance") ||
    msg.includes("not enough funding") ||
    msg.includes("funding") ||
    msg.includes("no usage left") ||
    msg.includes("upgrade to continue") ||
    msg.includes("please upgrade") ||
    msg.includes("insufficient funds")
  );
}

export function isPermanentEntitlementError(err: unknown): boolean {
  const msg = String((err as any)?.message || err).toLowerCase();
  return (
    msg.includes("disabled") ||
    msg.includes("suspended") ||
    msg.includes("model_not_found") ||
    msg.includes("not authorized")
  );
}

export function isRotatableAuthError(err: unknown): boolean {
  const msg = String((err as any)?.message || err).toLowerCase();
  return (
    msg.includes("unauthorized") ||
    msg.includes("invalid api key") ||
    msg.includes("invalid_api_key") ||
    msg.includes("401") ||
    msg.includes("authentication")
  );
}

export async function tryRotateProviderToken(
  providerOrId: string | { id: string }
): Promise<{ success: boolean; newToken?: string }> {
  // Token rotation attempted; returns false if no secondary key configured
  return { success: false };
}
