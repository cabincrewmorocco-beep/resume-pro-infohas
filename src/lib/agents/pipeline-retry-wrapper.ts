// ============================================================================
// Pipeline Retry Wrapper & Stage Orchestrator
//
// Provides a global 'try-catch-retry' orchestration wrapper for all agentic
// pipeline stages:
//   - Executes stages with configurable retry policy & exponential backoff
//   - Respects provider rate-limit (429 / Retry-After) guidelines
//   - Logs specific structured errors with timestamps, attempt counts, and stacks
//   - Preserves state across failures in durable checkpoints
//   - Supports granular 'resume from stage' mechanism: skips already completed
//     stages from preserved state and resumes execution from the target stage
// ============================================================================

import type { PipelineCheckpoint, CheckpointJD } from "./pipeline-checkpoint";
import { retryAfterMsFromError } from "../ai/rate-governor";

export type PipelineStageId =
  | "job_intelligence"
  | "company_skill_gap"
  | "ats_before"
  | "optimizer"
  | "qa"
  | "reflection"
  | "cover_letter"
  | "interview_prep"
  | "career_coach";

export interface StageErrorLog {
  stageId: string;
  stageName: string;
  stepIndex: number;
  message: string;
  errorName: string;
  stack?: string;
  attemptCount: number;
  maxAttempts: number;
  timestamp: string;
  durationMs: number;
  retryHistory: Array<{ attempt: number; error: string; timestamp: string }>;
  isFatal: boolean;
}

export interface StageExecutionResult<T> {
  stageId: string;
  stageName: string;
  status: "completed" | "restored" | "failed" | "skipped";
  data?: T;
  error?: StageErrorLog;
  durationMs: number;
  attempts: number;
  logMessage?: string;
}

export interface StageRetryOptions<T> {
  stageId: PipelineStageId | string;
  stageName: string;
  stepIndex: number;
  maxAttempts?: number;
  initialBackoffMs?: number;
  backoffFactor?: number;
  timeoutMs?: number;
  critical?: boolean;
  resumeFromStage?: string | number;
  checkpoint?: PipelineCheckpoint | null;
  canRestore?: (cp: PipelineCheckpoint) => boolean;
  restoreFromCheckpoint?: (cp: PipelineCheckpoint) => T | null | undefined;
  onAttemptStart?: (attempt: number, maxAttempts: number) => void;
  onAttemptFail?: (err: any, attempt: number, maxAttempts: number, nextDelayMs: number) => void;
  onProgress?: (message: string) => void;
  execute: (attempt: number) => Promise<T>;
}

/**
 * Maps known stage identifiers or aliases to the 0-based orchestrator step index:
 *   0: Job Intelligence
 *   1: Company + Skill Gap
 *   2: ATS Analysis (Before)
 *   3: Resume Optimizer
 *   4: Quality Assurance
 *   5: Reflection
 */
export function normalizeStageIndex(stage: string | number | undefined | null): number {
  if (stage === undefined || stage === null) return 0;
  if (typeof stage === "number") {
    return Math.max(0, Math.min(5, Math.floor(stage)));
  }

  const s = String(stage).toLowerCase().trim().replace(/[-_]/g, " ");
  const cleaned = s.replace(/[^a-z0-9]/g, "");

  // Exact / primary matches
  if (cleaned === "companyintelligence" || cleaned === "companyskillgap" || cleaned === "skillgap" || cleaned === "1") return 1;
  if (cleaned === "jobintelligence" || cleaned === "jobintel" || cleaned === "0") return 0;
  if (cleaned === "atsbefore" || cleaned === "atsanalysis" || cleaned === "ats" || cleaned === "2") return 2;
  if (cleaned === "optimizer" || cleaned === "resumeoptimizer" || cleaned === "3") return 3;
  if (cleaned === "qa" || cleaned === "qualityassurance" || cleaned === "4") return 4;
  if (cleaned === "reflection" || cleaned === "5") return 5;

  // Keyword / fuzzy matches (company & skill gap before generic intel)
  if (s.includes("company") || s.includes("skill") || s.includes("gap")) return 1;
  if (s.includes("job") || s.includes("intel")) return 0;
  if (s.includes("ats") || s.includes("score") || s.includes("baseline")) return 2;
  if (s.includes("opt") || s.includes("rewrite") || s.includes("resume")) return 3;
  if (s.includes("qa") || s.includes("quality") || s.includes("assurance")) return 4;
  if (s.includes("reflect")) return 5;

  const num = parseInt(stage, 10);
  if (!Number.isNaN(num)) {
    return Math.max(0, Math.min(5, num));
  }
  return 0;
}

/**
 * Returns human-readable display name for a stage ID.
 */
export function getStageDisplayName(stageIdOrIndex: string | number): string {
  const idx = normalizeStageIndex(stageIdOrIndex);
  switch (idx) {
    case 0: return "Job Intelligence";
    case 1: return "Company + Skill Gap";
    case 2: return "ATS Analysis (Before)";
    case 3: return "Resume Optimizer";
    case 4: return "Quality Assurance";
    case 5: return "Reflection";
    default: return String(stageIdOrIndex);
  }
}

/**
 * Global 'try-catch-retry' execution wrapper.
 *
 * Checks if stage can be restored from preserved state (when resuming from a later stage).
 * If not, executes the stage with exponential backoff retries, logging each attempt and
 * preserving intermediate telemetry on failure.
 */
export async function executeStageWithRetry<T>(
  options: StageRetryOptions<T>
): Promise<StageExecutionResult<T>> {
  const {
    stageId,
    stageName,
    stepIndex,
    maxAttempts = 3,
    initialBackoffMs = 1000,
    backoffFactor = 1.8,
    critical = true,
    resumeFromStage,
    checkpoint,
    canRestore,
    restoreFromCheckpoint,
    onAttemptStart,
    onAttemptFail,
    onProgress,
    execute,
  } = options;

  // --------------------------------------------------------------------------
  // 1. Checkpoint / Granular Resume Check
  // --------------------------------------------------------------------------
  const targetResumeIndex = resumeFromStage !== undefined ? normalizeStageIndex(resumeFromStage) : 0;
  const isPriorToResumeTarget = targetResumeIndex > 0 && stepIndex < targetResumeIndex;

  if (checkpoint && (isPriorToResumeTarget || canRestore?.(checkpoint))) {
    if (restoreFromCheckpoint) {
      try {
        const restored = restoreFromCheckpoint(checkpoint);
        if (restored !== undefined && restored !== null) {
          const logMsg = `${stageName} restored from preserved state (Step skipped).`;
          console.info(`[StageOrchestrator] ${logMsg}`);
          onProgress?.(logMsg);
          return {
            stageId,
            stageName,
            status: "restored",
            data: restored,
            durationMs: 0,
            attempts: 0,
            logMessage: logMsg,
          };
        }
      } catch (restoreErr: any) {
        console.warn(`[StageOrchestrator] Checkpoint restore failed for ${stageName}, falling back to execution:`, restoreErr?.message);
      }
    }
  }

  // --------------------------------------------------------------------------
  // 2. Try-Catch-Retry Execution Loop
  // --------------------------------------------------------------------------
  const startTime = Date.now();
  const retryHistory: Array<{ attempt: number; error: string; timestamp: string }> = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    onAttemptStart?.(attempt, maxAttempts);
    if (attempt > 1) {
      onProgress?.(`${stageName}: Attempt ${attempt} of ${maxAttempts}…`);
    }

    try {
      const result = await execute(attempt);
      const durationMs = Date.now() - startTime;
      return {
        stageId,
        stageName,
        status: "completed",
        data: result,
        durationMs,
        attempts: attempt,
      };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      retryHistory.push({
        attempt,
        error: errMsg,
        timestamp: new Date().toISOString(),
      });

      console.warn(
        `[StageOrchestrator] Stage "${stageName}" (step ${stepIndex}) attempt ${attempt}/${maxAttempts} failed: ${errMsg}`
      );

      // If attempts remain, apply backoff delay
      if (attempt < maxAttempts) {
        // Check for Retry-After headers if present
        const rateLimitDelay = retryAfterMsFromError(err);
        const exponentialDelay = initialBackoffMs * Math.pow(backoffFactor, attempt - 1);
        const delayMs = Math.min(rateLimitDelay ?? exponentialDelay, 15000);

        onAttemptFail?.(err, attempt, maxAttempts, delayMs);
        onProgress?.(
          `⚠ ${stageName} error: ${errMsg.slice(0, 80)}. Retrying in ${(delayMs / 1000).toFixed(1)}s (attempt ${attempt + 1}/${maxAttempts})…`
        );

        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        // Final attempt exhausted
        const durationMs = Date.now() - startTime;
        const errorLog: StageErrorLog = {
          stageId,
          stageName,
          stepIndex,
          message: errMsg,
          errorName: err?.name || "StageExecutionError",
          stack: err?.stack,
          attemptCount: maxAttempts,
          maxAttempts,
          timestamp: new Date().toISOString(),
          durationMs,
          retryHistory,
          isFatal: critical,
        };

        console.error(
          `[StageOrchestrator] Stage "${stageName}" failed after ${maxAttempts} attempts. State preserved for resume.`,
          errorLog
        );

        return {
          stageId,
          stageName,
          status: "failed",
          error: errorLog,
          durationMs,
          attempts: maxAttempts,
          logMessage: `Failed after ${maxAttempts} attempts: ${errMsg}`,
        };
      }
    }
  }

  // Fallback if loop finishes unexpectedly
  const durationMs = Date.now() - startTime;
  return {
    stageId,
    stageName,
    status: "failed",
    durationMs,
    attempts: maxAttempts,
    error: {
      stageId,
      stageName,
      stepIndex,
      message: "Stage execution terminated unexpectedly without result",
      errorName: "UnknownError",
      attemptCount: maxAttempts,
      maxAttempts,
      timestamp: new Date().toISOString(),
      durationMs,
      retryHistory,
      isFatal: critical,
    },
  };
}
