// ============================================================================
// File Sanitization & Upload Guardrails
// Enforces 5 MB file size limit, allowed extensions (.pdf, .docx, .txt),
// and 15,000 character limits for AI model token safety.
// ============================================================================

import { toast } from "sonner";

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt"] as const;
export const MAX_RESUME_TEXT_CHARS = 15000; // Safe token threshold

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  sanitizedName?: string;
}

/**
 * Validates file size (<= 5MB) and file extension (.pdf, .docx, .txt).
 * Shows a toast error if validation fails.
 */
export function validateUploadFile(
  file: File,
  options: { silentToast?: boolean } = {}
): FileValidationResult {
  if (!file) {
    const error = "No file selected.";
    if (!options.silentToast) toast.error(error);
    return { valid: false, error };
  }

  // 1. File size guard (5MB limit)
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    const error = `File size exceeds the 5 MB limit (${sizeMb} MB). Please select a smaller file.`;
    if (!options.silentToast) toast.error(error);
    return { valid: false, error };
  }

  // 2. Extension guard (.pdf, .docx, .txt)
  const name = file.name || "";
  const extMatch = name.toLowerCase().match(/\.[0-9a-z]+$/i);
  const ext = extMatch ? extMatch[0] : "";

  const isAllowed = ALLOWED_EXTENSIONS.some((allowed) => ext === allowed);
  if (!isAllowed) {
    const error = `Unsupported file format (${ext || "unknown"}). Allowed formats: ${ALLOWED_EXTENSIONS.join(", ")}.`;
    if (!options.silentToast) toast.error(error);
    return { valid: false, error };
  }

  // Sanitized file name (remove hazardous path traversal or unusual characters)
  const sanitizedName = name.replace(/[^\w\s.-]/gi, "_").trim();

  return {
    valid: true,
    sanitizedName,
  };
}

/**
 * Truncates raw extracted text to a safe threshold (default: 15,000 chars)
 * to prevent token exhaustion and rate limit spikes when querying AI models.
 */
export function sanitizeResumeText(
  rawText: string,
  maxChars = MAX_RESUME_TEXT_CHARS
): string {
  if (!rawText || typeof rawText !== "string") {
    return "";
  }

  // Clean null bytes and non-printable control characters (except newlines/tabs)
  let clean = rawText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  if (clean.length > maxChars) {
    console.warn(
      `[FileSanitizer] Truncating text from ${clean.length} to ${maxChars} characters to avoid rate limit spikes.`
    );
    clean = clean.slice(0, maxChars) + "\n\n[...truncated to 15,000 characters for AI processing...]";
  }

  return clean;
}
