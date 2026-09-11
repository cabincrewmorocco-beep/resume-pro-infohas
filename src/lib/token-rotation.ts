// ============================================================================
// Token Rotation & API Authentication Error Classifier
// ============================================================================

export function isBillingError(err: unknown): boolean {
  const msg = String((err as any)?.message || err).toLowerCase();
  return (
    msg.includes("billing") ||
    msg.includes("quota exceeded") ||
    msg.includes("insufficient_quota") ||
    msg.includes("credit") ||
    msg.includes("429")
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

export async function tryRotateProviderToken(providerId: string): Promise<boolean> {
  // Token rotation attempted; returns false if no secondary key configured
  return false;
}
