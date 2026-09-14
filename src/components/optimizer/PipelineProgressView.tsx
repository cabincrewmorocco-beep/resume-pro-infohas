"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@/components/shared";
import type { PipelineProgress, PipelineResult, PipelineStep } from "@/lib/agents";
import { getStageDisplayName, normalizeStageIndex } from "@/lib/agents/pipeline-retry-wrapper";
import { PipelineDiagnosticOverlay } from "./PipelineDiagnosticOverlay";

/**
 * PipelineProgressView — shows real-time progress of the 7-step optimization pipeline.
 *
 * 7 steps (per spec):
 *   Step 1: Parsing Resume        (happens before pipeline — shown as instant)
 *   Step 2: Job Analysis          (Job Intelligence Agent)
 *   Step 3: ATS Analysis          (ATS Analysis Agent — before)
 *   Step 4: Resume Optimization   (Resume Optimizer Agent)
 *   Step 5: Quality Assurance     (QA Agent)
 *   Step 6: Reflection            (optional — Reflection Agent)
 *   Step 7: Export Preparation    (final step — preparing export)
 *
 * Each step shows:
 *   - status (pending / running / completed / failed / skipped)
 *   - loading state (spinner)
 *   - success state (✓ green)
 *   - error state (✗ red + error message)
 *   - execution time (seconds)
 *   - granular resume action when halted
 *   - diagnostic overlay for deep log & step index inspection
 */

interface PipelineProgressViewProps {
  progress: PipelineProgress | null;
  isRunning: boolean;
  /** The final pipeline result (passed when pipeline completes — enables per-step status display) */
  result?: PipelineResult | null;
  /** Error message if the pipeline failed (for retry UI) */
  error?: string | null;
  /** Detailed pipeline log lines for diagnostic overlay */
  logs?: string[];
  /** Retry callback (runs from beginning) */
  onRetry?: () => void;
  /** Granular resume callback: resumes pipeline starting at the specified stage index or id */
  onResumeFromStage?: (stageIndexOrId: number | string) => void;
}

// 8 steps per V2 spec — step 1 (Parsing) + step 8 (Export Prep) wrap the
// 6-agent pipeline (Job Intel, Company+SkillGap parallel, ATS, Optimizer, QA, Reflection).
const ALL_STEPS = [
  { id: 0, name: "Parsing Resume", icon: "FileText", agent: "parser", stageId: "parser" },
  { id: 1, name: "Job Intelligence", icon: "Search", agent: "Job Intelligence", stageId: "job_intelligence" },
  { id: 2, name: "Company + Skill Gap", icon: "Building2", agent: "Company + Skill Gap (parallel)", stageId: "company_intelligence" },
  { id: 3, name: "ATS Analysis", icon: "ScanText", agent: "ATS Analysis (Before)", stageId: "ats_before" },
  { id: 4, name: "Resume Optimization", icon: "Wand2", agent: "Resume Optimizer", stageId: "optimizer" },
  { id: 5, name: "Quality Assurance", icon: "ShieldCheck", agent: "Quality Assurance", stageId: "qa" },
  { id: 6, name: "Reflection", icon: "Brain", agent: "Reflection", stageId: "reflection" },
  { id: 7, name: "Export Preparation", icon: "Download", agent: "Export", stageId: "export" },
];

export function PipelineProgressView({
  progress,
  isRunning,
  result,
  error,
  logs = [],
  onRetry,
  onResumeFromStage,
}: PipelineProgressViewProps) {
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  if (!isRunning && !progress && !result && !error) return null;

  const percent = progress?.percent ?? (result ? 100 : 0);
  const etaSeconds = progress?.etaSeconds ?? 0;
  const currentStep = progress?.stepNumber ?? 0;
  const logLine = progress?.log ?? (error ? `Error: ${error}` : "Starting…");

  // Determine if state is preserved in the checkpoint
  const checkpoint = result?.checkpoint;
  const hasPreservedState = !!(
    checkpoint && (
      checkpoint.jobIntelligence != null ||
      checkpoint.companyIntelligence != null ||
      checkpoint.skillGap != null ||
      checkpoint.beforeATS != null ||
      checkpoint.optimizedResume != null
    )
  );

  // Normalize failed stage index (0-5 representing the 6 orchestrator stages)
  const failedStageIndex = result?.failedStageIndex !== undefined
    ? result.failedStageIndex
    : result?.failedStage !== undefined
    ? normalizeStageIndex(result.failedStage)
    : undefined;

  const failedStageDisplayName = failedStageIndex !== undefined
    ? getStageDisplayName(failedStageIndex)
    : result?.failedStage;

  const isFailedOrError = !!(error || result?.status === "failed");
  const displayError = error || result?.error || "Pipeline execution halted";

  // Map the orchestrator's 6 agent steps to our 8-step display.
  // Orchestrator step indices: 0=JI, 1=Company+SkillGap, 2=ATS-before, 3=Optimizer, 4=QA, 5=Reflection
  // Our display: 0=Parsing, 1=JI, 2=Company+SkillGap, 3=ATS, 4=Optim, 5=QA, 6=Reflection, 7=Export
  const getStepStatus = (displayStepIndex: number): PipelineStep["status"] => {
    if (result) {
      // Pipeline complete or halted with result object
      if (displayStepIndex === 0) return "completed"; // Parsing always done
      if (displayStepIndex === 7) return result.status === "failed" ? "pending" : "completed";
      
      const agentStepIndex = displayStepIndex - 1;

      // Explicit failed stage index match
      if (failedStageIndex !== undefined && agentStepIndex === failedStageIndex) {
        return "failed";
      }

      const agentStep = result.steps?.[agentStepIndex];
      if (agentStep?.status) {
        return agentStep.status;
      }

      // If failedStageIndex is known, prior steps are completed and later steps are pending
      if (failedStageIndex !== undefined) {
        if (agentStepIndex < failedStageIndex) return "completed";
        if (agentStepIndex > failedStageIndex) return "pending";
      }

      return "skipped";
    }

    if (!isRunning) {
      if (error && displayStepIndex > 0) {
        return displayStepIndex <= currentStep ? "failed" : "pending";
      }
      return "pending";
    }

    // Map current progress step to display step
    // Orchestrator stepNumber is 1-based: 1=JI, 2=Company+SkillGap, 3=ATS, 4=Optim, 5=QA, 6=Reflection
    // Display step: 1=Parsing(done first), 2=JI, 3=Company+SkillGap, 4=ATS, 5=Optim, 6=QA, 7=Reflection, 8=Export
    if (displayStepIndex === 0) return "completed"; // Parsing done before pipeline
    if (displayStepIndex === 7) return "pending"; // Export prep not started
    const agentStepIndex = displayStepIndex - 1;
    const orchestratorStepNumber = currentStep; // 1-based from orchestrator
    if (error && agentStepIndex === orchestratorStepNumber - 1) return "failed";
    if (agentStepIndex < orchestratorStepNumber - 1) return "completed";
    if (agentStepIndex === orchestratorStepNumber - 1) return "running";
    return "pending";
  };

  const getStepDuration = (displayStepIndex: number): number | undefined => {
    if (!result) return undefined;
    if (displayStepIndex === 0 || displayStepIndex === 7) return undefined;
    const agentStep = result.steps?.[displayStepIndex - 1];
    return agentStep?.durationMs;
  };

  const getStepError = (displayStepIndex: number): string | undefined => {
    if (!result) return undefined;
    if (displayStepIndex === 0 || displayStepIndex === 7) return undefined;
    const agentStepIndex = displayStepIndex - 1;
    const agentStep = result.steps?.[agentStepIndex];
    if (agentStep?.error) return agentStep.error;
    if (failedStageIndex !== undefined && agentStepIndex === failedStageIndex) {
      return result.error || undefined;
    }
    return undefined;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-card border border-border shadow-premium p-5 sm:p-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isFailedOrError ? "bg-red-100 dark:bg-red-950/30" : isRunning ? "bg-brand/10" : "bg-emerald-100 dark:bg-emerald-950/30"}`}>
          <Icon
            name={isFailedOrError ? "AlertCircle" : isRunning ? "Loader2" : "CheckCircle2"}
            className={`w-5 h-5 ${isFailedOrError ? "text-red-600" : isRunning ? "text-brand animate-spin" : "text-emerald-600"}`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm sm:text-base">
            {isFailedOrError
              ? (failedStageDisplayName ? `Pipeline halted at ${failedStageDisplayName}` : "Optimization halted")
              : isRunning
              ? "Optimization in progress"
              : result
              ? "Optimization complete"
              : "Starting…"}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isFailedOrError
              ? (hasPreservedState ? "State preserved — you can resume from the halted stage" : "An error occurred — you can retry")
              : isRunning
              ? `Step ${Math.min(currentStep + 1, 8)} of 8: ${ALL_STEPS[Math.min(currentStep, 7)]?.name ?? "Processing"}`
              : "Pipeline finished"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowDiagnostics(true)}
            className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 transition active:scale-95 ${
              isFailedOrError
                ? "bg-red-500/10 border-red-500/40 text-red-600 hover:bg-red-500/20 shadow-sm"
                : "bg-secondary/60 hover:bg-secondary border-border text-foreground"
            }`}
            title="Open Diagnostic Overlay (stage logs, step index, error analysis)"
          >
            <Icon
              name={isFailedOrError ? "AlertOctagon" : "Activity"}
              className={`w-3.5 h-3.5 ${isFailedOrError ? "text-red-600 animate-pulse" : "text-brand"}`}
            />
            <span className="hidden sm:inline">Diagnostics</span>
            {isFailedOrError && (
              <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
            )}
          </button>
          {isRunning && etaSeconds > 0 && (
            <div className="text-right shrink-0">
              <div className="text-xs font-semibold text-brand">{etaSeconds}s</div>
              <div className="text-[10px] text-muted-foreground">est. remaining</div>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="font-medium text-muted-foreground">Progress</span>
          <span className="font-bold text-foreground">{percent}%</span>
        </div>
        <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${isFailedOrError ? "bg-red-500" : "bg-gradient-to-r from-brand to-brand-dark"}`}
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* 8-step list with granular status and resume per step */}
      <div className="space-y-1.5 mb-4">
        {ALL_STEPS.map((step, i) => {
          const status = getStepStatus(i);
          const durationMs = getStepDuration(i);
          const stepError = getStepError(i);
          const isOptional = i === 6; // Reflection is optional
          const agentIndex = i - 1; // 0-5 for orchestrator agent stages
          const isCurrentFailedStep = !isRunning && (status === "failed" || (failedStageIndex !== undefined && agentIndex === failedStageIndex));
          const isPreserved = status === "completed" && hasPreservedState && agentIndex >= 0 && (failedStageIndex !== undefined ? agentIndex < failedStageIndex : true);

          return (
            <div
              key={i}
              className={`flex items-center gap-2.5 p-2 rounded-lg transition ${
                status === "running" ? "bg-brand/10 border border-brand/30" :
                status === "completed" ? "bg-emerald-50 dark:bg-emerald-950/15" :
                status === "recovering" ? "bg-sky-50 dark:bg-sky-950/15 border border-sky-200 dark:border-sky-900" :
                status === "recoverable_error" ? "bg-amber-50 dark:bg-amber-950/15 border border-amber-200 dark:border-amber-900" :
                status === "degraded" ? "bg-amber-50 dark:bg-amber-950/15 border border-amber-200 dark:border-amber-900" :
                status === "failed" ? "bg-red-50 dark:bg-red-950/15 border border-red-200 dark:border-red-900" :
                status === "skipped" ? "bg-secondary/30 opacity-60" :
                "bg-secondary/40"
              }`}
            >
              {/* Status icon */}
              <div className="shrink-0">
                {status === "running" && <Icon name="Loader2" className="w-4 h-4 text-brand animate-spin" />}
                {status === "completed" && <Icon name="CheckCircle2" className="w-4 h-4 text-emerald-600" />}
                {status === "recovering" && <Icon name="RefreshCw" className="w-4 h-4 text-sky-600 animate-spin" />}
                {status === "recoverable_error" && <Icon name="LifeBuoy" className="w-4 h-4 text-amber-600" />}
                {status === "degraded" && <Icon name="AlertTriangle" className="w-4 h-4 text-amber-600" />}
                {status === "failed" && <Icon name="XCircle" className="w-4 h-4 text-red-600" />}
                {status === "skipped" && <Icon name="Minus" className="w-4 h-4 text-muted-foreground" />}
                {status === "pending" && (
                  <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center">
                    <span className="text-[8px] text-muted-foreground">{i + 1}</span>
                  </div>
                )}
              </div>

              {/* Step name */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-xs font-medium ${status === "failed" ? "text-red-700 dark:text-red-400 font-semibold" : status === "degraded" || status === "recoverable_error" ? "text-amber-700 dark:text-amber-400" : status === "recovering" ? "text-sky-700 dark:text-sky-400" : status === "completed" ? "text-emerald-700 dark:text-emerald-400" : status === "running" ? "text-brand" : "text-muted-foreground"}`}>
                    {step.name}
                  </span>
                  {isPreserved && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-medium">
                      preserved
                    </span>
                  )}
                  {isCurrentFailedStep && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 font-semibold">
                      failed here
                    </span>
                  )}
                  {isOptional && status === "pending" && (
                    <span className="text-[9px] px-1 py-0.5 rounded bg-secondary text-muted-foreground">optional</span>
                  )}
                  {isOptional && status === "skipped" && (
                    <span className="text-[9px] px-1 py-0.5 rounded bg-secondary text-muted-foreground">skipped</span>
                  )}
                </div>
                {stepError && (
                  <div className="text-[10px] text-red-600 dark:text-red-400 mt-0.5 truncate">{stepError}</div>
                )}
                {(isCurrentFailedStep || stepError) && (
                  <button
                    type="button"
                    onClick={() => setShowDiagnostics(true)}
                    className="text-[10px] text-red-600 dark:text-red-400 font-semibold hover:underline flex items-center gap-1 mt-0.5"
                  >
                    <Icon name="Search" className="w-2.5 h-2.5" /> View Step Diagnostics
                  </button>
                )}
              </div>

              {/* Granular resume inline button if failed */}
              {isCurrentFailedStep && onResumeFromStage && agentIndex >= 0 && (
                <button
                  type="button"
                  onClick={() => onResumeFromStage(agentIndex)}
                  className="text-[11px] font-semibold text-white bg-red-600 hover:bg-red-700 px-2.5 py-1 rounded-md flex items-center gap-1 shrink-0 shadow-sm transition active:scale-95"
                  title={`Resume pipeline directly from ${step.name}`}
                >
                  <Icon name="Play" className="w-3 h-3" />
                  <span>Resume</span>
                </button>
              )}

              {/* Execution time */}
              {durationMs !== undefined && !isCurrentFailedStep && (
                <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                  {(durationMs / 1000).toFixed(1)}s
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Live log line */}
      <div className="rounded-lg bg-secondary/60 p-2.5 flex items-start gap-2">
        <Icon name="Terminal" className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
        <AnimatePresence mode="wait">
          <motion.p
            key={logLine}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.2 }}
            className="text-xs font-mono text-muted-foreground break-words"
          >
            {logLine}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Live optimization text stream */}
      {progress?.streamedText && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs text-emerald-400 shadow-inner max-h-64 overflow-y-auto"
        >
          <div className="flex items-center justify-between border-b border-zinc-900 pb-2 mb-2">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider flex items-center gap-1.5 font-bold">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              Live AI Optimizer Output
            </span>
            <span className="text-[10px] text-zinc-600 font-bold">{progress.streamedText.length} chars generated</span>
          </div>
          <pre className="whitespace-pre-wrap break-all leading-relaxed font-mono font-medium text-emerald-300 dark:text-emerald-400 selection:bg-emerald-900">
            {progress.streamedText}
            <span className="inline-block w-1.5 h-3.5 bg-emerald-400 animate-pulse ml-0.5 align-middle" />
          </pre>
        </motion.div>
      )}

      {/* Error + Granular Resume / Retry Panel */}
      {isFailedOrError && (
        <div className="mt-4 p-3.5 rounded-xl bg-red-50/70 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 space-y-3">
          <div className="flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-md bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0 mt-0.5">
              <Icon name="AlertTriangle" className="w-3.5 h-3.5 text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-red-900 dark:text-red-200">
                  {failedStageDisplayName ? `Pipeline halted at ${failedStageDisplayName}` : "Pipeline execution halted"}
                </span>
                {hasPreservedState && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                    <Icon name="ShieldCheck" className="w-3 h-3" /> State Preserved
                  </span>
                )}
              </div>
              <p className="text-xs text-red-700 dark:text-red-300 mt-1 break-words">
                {displayError}
              </p>
              {hasPreservedState && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Completed prior analyses have been saved in your session checkpoint. You can resume directly from <strong>{failedStageDisplayName}</strong> without re-running earlier steps.
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1 border-t border-red-200/60 dark:border-red-900/40 flex-wrap">
            <button
              type="button"
              onClick={() => setShowDiagnostics(true)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-800 bg-red-100/80 dark:bg-red-900/40 hover:bg-red-200/80 text-red-900 dark:text-red-100 flex items-center gap-1.5 transition active:scale-95 shadow-sm"
              title="Open detailed diagnostic overlay with exact logs and step indices"
            >
              <Icon name="AlertOctagon" className="w-3.5 h-3.5 text-red-600" />
              <span>Diagnostic Overlay {failedStageIndex !== undefined ? `(Step Index ${failedStageIndex})` : ""}</span>
            </button>

            <div className="flex items-center gap-2">
              {onResumeFromStage && failedStageIndex !== undefined && (
                <button
                  type="button"
                  onClick={() => onResumeFromStage(failedStageIndex)}
                  className="text-xs font-semibold text-white bg-brand hover:bg-brand-dark px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition active:scale-95"
                >
                  <Icon name="Play" className="w-3.5 h-3.5" />
                  Resume from {failedStageDisplayName}
                </button>
              )}
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition active:scale-95 ${
                    onResumeFromStage && failedStageIndex !== undefined
                      ? "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border"
                      : "text-white bg-red-600 hover:bg-red-700"
                  }`}
                >
                  <Icon name="RotateCcw" className="w-3.5 h-3.5" />
                  {onResumeFromStage && failedStageIndex !== undefined ? "Retry Full Pipeline" : "Retry"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Diagnostic Overlay */}
      <PipelineDiagnosticOverlay
        isOpen={showDiagnostics}
        onClose={() => setShowDiagnostics(false)}
        progress={progress}
        result={result}
        error={error}
        logs={logs}
        onResumeFromStage={onResumeFromStage}
        onRetry={onRetry}
      />
    </motion.div>
  );
}
