// ============================================================================
// Pipeline Checkpoint & Resume (S4 — Task 18 & Granular Stage Resume)
//
// When any stage encounters an error or requires retries, the pipeline preserves
// the current state with every completed intelligence and optimization artifact
// intact (directive §15/§29/§48).
//
// A checkpoint captures those preserved artifacts so the retry can RESUME:
//   - buildCheckpointFromResult: extracts ALL completed stage artifacts
//     (Job Intel, Company Intel, Skill Gap, ATS Before, Optimized Resume, QA,
//      Reflection, Post-optimization items)
//   - isCheckpointUsable: binds the checkpoint to the same JD (title/company
//     fingerprint) and a freshness window (default 24h)
//   - Session persistence: ensures state survives component re-mounts or refreshes
// ============================================================================

/** Maximum age of a checkpoint before its intelligence data is stale. */
export const CHECKPOINT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

export interface PipelineCheckpoint {
  /** Preserved Job Intelligence artifact (identity preserved on restore). */
  jobIntelligence?: unknown;
  /** Preserved Company Intelligence artifact. */
  companyIntelligence?: unknown;
  /** Preserved Skill Gap analysis artifact. */
  skillGap?: unknown;
  /** Preserved ATS analysis (before) artifact. */
  beforeATS?: unknown;
  /** Preserved optimized resume artifact. */
  optimizedResume?: unknown;
  /** Preserved QA result artifact. */
  qa?: unknown;
  /** Preserved Reflection result artifact. */
  reflection?: unknown;
  /** Preserved After ATS result artifact. */
  afterATS?: unknown;
  /** Preserved Cover Letter artifact. */
  coverLetter?: unknown;
  /** Preserved Interview package artifact. */
  interviewPackage?: unknown;
  /** Preserved Career recommendations artifact. */
  careerRecommendations?: unknown;

  /** Identifier of the stage that failed or halted execution */
  lastFailedStage?: string;
  /** Index (0-5) of the stage that failed */
  lastFailedStageIndex?: number;
  /** Map of stage IDs to their error messages */
  stageErrors?: Record<string, string>;
  /** List of stage IDs that successfully completed */
  completedStages?: string[];

  /** ISO timestamp of when the checkpoint was captured. */
  savedAt: string;
  /** JD fingerprint the artifacts were computed against. */
  jdFingerprint: string;
}

/** Minimal shape the builder needs from a PipelineResult or stage context. */
export interface CheckpointableResult {
  jobIntelligence?: unknown;
  companyIntelligence?: unknown;
  skillGap?: unknown;
  beforeATS?: unknown;
  optimizedResume?: unknown;
  qa?: unknown;
  reflection?: unknown;
  afterATS?: unknown;
  coverLetter?: unknown;
  interviewPackage?: unknown;
  careerRecommendations?: unknown;
  lastFailedStage?: string;
  lastFailedStageIndex?: number;
  steps?: Array<{ name: string; status: string; error?: string }>;
  error?: string;
}

/** Minimal JD shape needed for fingerprinting (both title spellings tolerated). */
export interface CheckpointJD {
  title?: string;
  jobTitle?: string;
  company?: string;
  description?: string;
  rawText?: string;
}

/**
 * Stable fingerprint of the JD the intelligence artifacts were computed
 * against. Title + company + a description probe (length + head) — cheap,
 * deterministic, and robust to trivial whitespace noise.
 */
export function jdFingerprint(jd: CheckpointJD): string {
  const title = (jd?.title ?? jd?.jobTitle ?? "").trim().toLowerCase();
  const company = (jd?.company ?? "").trim().toLowerCase();
  const desc = (jd?.rawText ?? jd?.description ?? "").replace(/\s+/g, " ").trim();
  const probe = `${desc.length}:${desc.slice(0, 120)}`;
  return `${title}|${company}|${probe}`;
}

/**
 * Build a checkpoint from a pipeline result or state snapshot.
 * Returns null when there is nothing worth resuming.
 */
export function buildCheckpointFromResult(
  result: CheckpointableResult | null | undefined,
  jd: CheckpointJD,
  extraMetadata?: {
    lastFailedStage?: string;
    lastFailedStageIndex?: number;
    stageErrors?: Record<string, string>;
  }
): PipelineCheckpoint | null {
  if (!result) return null;

  const hasAnyArtifact =
    result.jobIntelligence != null ||
    result.companyIntelligence != null ||
    result.skillGap != null ||
    result.beforeATS != null ||
    result.optimizedResume != null ||
    result.qa != null;

  if (!hasAnyArtifact) return null;

  const completedStages: string[] = [];
  const stageErrors: Record<string, string> = { ...(extraMetadata?.stageErrors || {}) };

  if (result.steps && Array.isArray(result.steps)) {
    for (const s of result.steps) {
      if (s.status === "completed") {
        completedStages.push(s.name);
      } else if (s.status === "failed" || s.status === "recoverable_error") {
        if (s.error) stageErrors[s.name] = s.error;
      }
    }
  }

  const checkpoint: PipelineCheckpoint = {
    savedAt: new Date().toISOString(),
    jdFingerprint: jdFingerprint(jd),
    completedStages,
    stageErrors,
    lastFailedStage: extraMetadata?.lastFailedStage ?? result.lastFailedStage,
    lastFailedStageIndex: extraMetadata?.lastFailedStageIndex ?? result.lastFailedStageIndex,
  };

  // Identity-preserving assignment
  if (result.jobIntelligence != null) checkpoint.jobIntelligence = result.jobIntelligence;
  if (result.companyIntelligence != null) checkpoint.companyIntelligence = result.companyIntelligence;
  if (result.skillGap != null) checkpoint.skillGap = result.skillGap;
  if (result.beforeATS != null) checkpoint.beforeATS = result.beforeATS;
  if (result.optimizedResume != null) checkpoint.optimizedResume = result.optimizedResume;
  if (result.qa != null) checkpoint.qa = result.qa;
  if (result.reflection != null) checkpoint.reflection = result.reflection;
  if (result.afterATS != null) checkpoint.afterATS = result.afterATS;
  if (result.coverLetter != null) checkpoint.coverLetter = result.coverLetter;
  if (result.interviewPackage != null) checkpoint.interviewPackage = result.interviewPackage;
  if (result.careerRecommendations != null) checkpoint.careerRecommendations = result.careerRecommendations;

  saveCheckpointToSession(checkpoint);
  return checkpoint;
}

/**
 * Whether a checkpoint can be used for a retry against `jd`.
 * Null-safe; freshness evaluated against `nowMs` (defaults to Date.now()).
 */
export function isCheckpointUsable(
  checkpoint: PipelineCheckpoint | null | undefined,
  jd: CheckpointJD,
  nowMs: number = Date.now(),
): boolean {
  if (!checkpoint) return false;
  if (!checkpoint.jdFingerprint) return false;
  if (checkpoint.jdFingerprint !== jdFingerprint(jd)) return false;
  const saved = Date.parse(checkpoint.savedAt);
  if (Number.isNaN(saved)) return false;
  if (nowMs - saved > CHECKPOINT_MAX_AGE_MS) return false;
  if (nowMs < saved) return false; // clock skew — treat as stale
  return true;
}

const SESSION_KEY = "resumeai_pipeline_checkpoint";

/**
 * Persist checkpoint into sessionStorage for refresh resilience.
 */
export function saveCheckpointToSession(checkpoint: PipelineCheckpoint): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(checkpoint));
  } catch (e) {
    console.warn("[PipelineCheckpoint] Failed to write session checkpoint:", e);
  }
}

/**
 * Load checkpoint from sessionStorage if fresh and matching the JD.
 */
export function loadCheckpointFromSession(jd: CheckpointJD): PipelineCheckpoint | null {
  if (typeof window === "undefined" || !window.sessionStorage) return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const cp = JSON.parse(raw) as PipelineCheckpoint;
    if (isCheckpointUsable(cp, jd)) {
      return cp;
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Clear the stored session checkpoint.
 */
export function clearCheckpointFromSession(): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {}
}
