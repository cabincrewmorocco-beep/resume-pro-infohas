import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@/components/shared";
import type { PipelineProgress, PipelineResult, PipelineStep } from "@/lib/agents";
import { getStageDisplayName, normalizeStageIndex } from "@/lib/agents/pipeline-retry-wrapper";
import { toast } from "sonner";

export interface PipelineDiagnosticOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  progress?: PipelineProgress | null;
  result?: PipelineResult | null;
  error?: string | null;
  logs?: string[];
  onResumeFromStage?: (stageIndexOrId: number | string) => void;
  onRetry?: () => void;
}

interface DiagnosticStageDef {
  index: number;
  id: string;
  name: string;
  category: "Intelligence" | "Analysis" | "Optimizer" | "QA" | "Reflection";
  icon: string;
  description: string;
}

export const DIAGNOSTIC_STAGES: DiagnosticStageDef[] = [
  {
    index: 0,
    id: "job_intelligence",
    name: "Job Intelligence",
    category: "Intelligence",
    icon: "Search",
    description: "Extracts role requirements, essential hard skills, seniority level, and domain context from the job description.",
  },
  {
    index: 1,
    id: "company_intelligence",
    name: "Company & Skill Gap",
    category: "Intelligence",
    icon: "Building2",
    description: "Parallel intelligence extraction for target company culture/values and delta analysis of missing keywords/skills.",
  },
  {
    index: 2,
    id: "ats_before",
    name: "ATS Analysis (Before)",
    category: "Analysis",
    icon: "ScanText",
    description: "Evaluates the baseline resume against ATS scoring algorithms, density benchmarks, and keyword match rate.",
  },
  {
    index: 3,
    id: "optimizer",
    name: "Resume Optimizer",
    category: "Optimizer",
    icon: "Wand2",
    description: "Generates tailored bullet points using the Google X-Y-Z formula, active verbs, and target role keywords without fabricating experience.",
  },
  {
    index: 4,
    id: "qa",
    name: "Quality Assurance (QA)",
    category: "QA",
    icon: "ShieldCheck",
    description: "Multi-point inspection validating fact preservation, timeline integrity, anti-hallucination compliance, and formatting grammar.",
  },
  {
    index: 5,
    id: "reflection",
    name: "Reflection & Auto-Correction",
    category: "Reflection",
    icon: "Brain",
    description: "Self-correction pass measuring final keyword density and applying targeted enhancements if quality score is below threshold.",
  },
];

export function PipelineDiagnosticOverlay({
  isOpen,
  onClose,
  progress,
  result,
  error,
  logs = [],
  onResumeFromStage,
  onRetry,
}: PipelineDiagnosticOverlayProps) {
  const [activeTab, setActiveTab] = useState<"stages" | "rawLogs" | "artifacts">("stages");
  const [selectedStageIndex, setSelectedStageIndex] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Determine failed stage information
  const failedStageIndex =
    result?.failedStageIndex !== undefined
      ? result.failedStageIndex
      : result?.failedStage !== undefined
      ? normalizeStageIndex(result.failedStage)
      : error && progress?.stepNumber !== undefined && progress.stepNumber > 0
      ? Math.max(0, progress.stepNumber - 1)
      : undefined;

  const failedStageDisplayName =
    failedStageIndex !== undefined
      ? getStageDisplayName(failedStageIndex)
      : result?.failedStage || (error ? "Unknown Stage" : null);

  const exactErrorMessage =
    result?.error || error || (failedStageIndex !== undefined ? result?.steps?.[failedStageIndex]?.error : null);

  const isFailed = !!(error || result?.status === "failed" || failedStageIndex !== undefined);

  // Filter logs relevant to a stage
  const getLogsForStage = (stageDef: DiagnosticStageDef): string[] => {
    const stageKeywords = [
      stageDef.name.toLowerCase(),
      stageDef.id.replace(/_/g, " "),
      stageDef.category.toLowerCase(),
    ];
    if (stageDef.index === 0) stageKeywords.push("job intelligence", "parsing jd", "target role");
    if (stageDef.index === 1) stageKeywords.push("company", "skill gap", "competitor");
    if (stageDef.index === 2) stageKeywords.push("ats", "score", "before");
    if (stageDef.index === 3) stageKeywords.push("optimizer", "rewrit", "tailor", "bullet");
    if (stageDef.index === 4) stageKeywords.push("qa", "quality assurance", "fact checking", "validation");
    if (stageDef.index === 5) stageKeywords.push("reflection", "score comparison", "re-rank");

    return logs.filter((log) => {
      const lower = log.toLowerCase();
      return stageKeywords.some((kw) => lower.includes(kw));
    });
  };

  const copyDiagnosticReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      pipelineStatus: result?.status || (error ? "failed" : "in_progress"),
      isFailed,
      stalledStage: failedStageDisplayName,
      stalledStepIndex: failedStageIndex,
      exactErrorMessage,
      etaSeconds: progress?.etaSeconds,
      percent: progress?.percent,
      steps: DIAGNOSTIC_STAGES.map((s) => {
        const stepData = result?.steps?.[s.index];
        const isCurrentFailed = isFailed && failedStageIndex === s.index;
        return {
          stepIndex: s.index,
          id: s.id,
          name: s.name,
          category: s.category,
          status: isCurrentFailed ? "failed" : stepData?.status || "pending",
          durationMs: stepData?.durationMs,
          exactError: isCurrentFailed ? (stepData?.error || exactErrorMessage) : stepData?.error,
          log: stepData?.log,
        };
      }),
      recentLogs: logs.slice(-25),
    };

    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setCopied(true);
    toast.success("Diagnostic report copied to clipboard");
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="w-full max-w-4xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border bg-card flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isFailed
                  ? "bg-red-100 dark:bg-red-950/50 text-red-600 border border-red-200 dark:border-red-900"
                  : "bg-brand/10 text-brand border border-brand/20"
              }`}
            >
              <Icon name={isFailed ? "AlertOctagon" : "Activity"} className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-foreground truncate">
                  Pipeline Diagnostic Overlay
                </h2>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                    isFailed
                      ? "bg-red-500/10 text-red-600 border-red-500/30"
                      : "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                  }`}
                >
                  {isFailed ? "Pipeline Stalled" : "Active Diagnostics"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Detailed execution logs, step indices, and error analysis across all 4 core stages
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={copyDiagnosticReport}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-secondary-foreground flex items-center gap-1.5 transition active:scale-95"
              title="Copy JSON diagnostic report"
            >
              <Icon name={copied ? "Check" : "Copy"} className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{copied ? "Copied" : "Copy Report"}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition"
              aria-label="Close diagnostics"
            >
              <Icon name="X" className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stalled / Error Alert Banner (if pipeline failed) */}
        {isFailed && (
          <div className="bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900/60 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-900/50 flex items-center justify-center shrink-0 mt-0.5">
                <Icon name="AlertTriangle" className="w-4 h-4 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-sm font-bold text-red-900 dark:text-red-200">
                    Pipeline Stalled at: {failedStageDisplayName}
                  </span>
                  {failedStageIndex !== undefined && (
                    <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-red-600 text-white shadow-sm">
                      Step Index: {failedStageIndex}
                    </span>
                  )}
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300">
                    Stage {failedStageIndex !== undefined ? failedStageIndex + 1 : "?"} of {DIAGNOSTIC_STAGES.length}
                  </span>
                </div>

                {/* Exact Error Message */}
                <div className="mt-2.5 p-3 rounded-lg bg-zinc-950 border border-red-500/40 shadow-inner">
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono mb-1">
                    <span className="flex items-center gap-1 font-semibold text-red-400">
                      <Icon name="XCircle" className="w-3 h-3" /> EXACT ERROR MESSAGE
                    </span>
                    <span>Step Index {failedStageIndex ?? "Unknown"}</span>
                  </div>
                  <pre className="text-xs font-mono text-red-300 whitespace-pre-wrap break-all leading-relaxed max-h-32 overflow-y-auto">
                    {exactErrorMessage || "Pipeline execution halted unexpectedly without detailed error stack."}
                  </pre>
                </div>

                {/* Granular Resume Action directly in the banner */}
                <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-xs text-red-800 dark:text-red-300">
                    State before Step Index {failedStageIndex ?? 0} is safely cached in checkpoint.
                  </p>
                  <div className="flex items-center gap-2">
                    {onResumeFromStage && failedStageIndex !== undefined && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onResumeFromStage(failedStageIndex);
                        }}
                        className="text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white flex items-center gap-1.5 shadow transition active:scale-95"
                      >
                        <Icon name="Play" className="w-3.5 h-3.5" />
                        Resume at Step Index {failedStageIndex} ({failedStageDisplayName})
                      </button>
                    )}
                    {onRetry && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onRetry();
                        }}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border flex items-center gap-1.5 transition active:scale-95"
                      >
                        <Icon name="RotateCcw" className="w-3.5 h-3.5" />
                        Restart Full Pipeline
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-4 sm:px-6 pt-3 border-b border-border bg-card/50">
          <button
            type="button"
            onClick={() => setActiveTab("stages")}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "stages"
                ? "border-brand text-brand"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon name="Layers" className="w-3.5 h-3.5" />
            Stage Diagnostics ({DIAGNOSTIC_STAGES.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("rawLogs")}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "rawLogs"
                ? "border-brand text-brand"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon name="Terminal" className="w-3.5 h-3.5" />
            Full Event Stream ({logs.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("artifacts")}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "artifacts"
                ? "border-brand text-brand"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon name="Database" className="w-3.5 h-3.5" />
            Preserved State Checkpoint
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
          {/* TAB 1: Stage by Stage Breakdown */}
          {activeTab === "stages" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Stages: Intelligence (0-1), Analysis (2), Optimizer (3), QA (4), Reflection (5)</span>
                <span>Click any stage for detailed logs & inspection</span>
              </div>

              {DIAGNOSTIC_STAGES.map((stage) => {
                const stepData = result?.steps?.[stage.index];
                const isCurrentFailed = isFailed && failedStageIndex === stage.index;
                const isPreserved =
                  stepData?.status === "completed" &&
                  failedStageIndex !== undefined &&
                  stage.index < failedStageIndex;
                const isExpanded = selectedStageIndex === stage.index;
                const stageLogs = getLogsForStage(stage);
                const stageError = isCurrentFailed ? (stepData?.error || exactErrorMessage) : stepData?.error;

                return (
                  <div
                    key={stage.id}
                    className={`rounded-xl border transition-all ${
                      isCurrentFailed
                        ? "border-red-500/60 bg-red-50/40 dark:bg-red-950/20 shadow-sm"
                        : stepData?.status === "completed"
                        ? "border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/20 dark:bg-emerald-950/10"
                        : "border-border bg-card"
                    }`}
                  >
                    {/* Stage Card Header */}
                    <div
                      onClick={() => setSelectedStageIndex(isExpanded ? null : stage.index)}
                      className="p-3.5 sm:p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-secondary/40 select-none"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isCurrentFailed
                              ? "bg-red-600 text-white"
                              : stepData?.status === "completed"
                              ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400"
                              : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          <Icon name={isCurrentFailed ? "AlertCircle" : stage.icon} className="w-4 h-4" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-secondary text-foreground">
                              Step {stage.index}
                            </span>
                            <span className="text-sm font-semibold text-foreground">
                              {stage.name}
                            </span>
                            <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {stage.category}
                            </span>
                            {isPreserved && (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                                Preserved in Checkpoint
                              </span>
                            )}
                            {isCurrentFailed && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-600 text-white animate-pulse">
                                FAILED HERE
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {stage.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {stepData?.durationMs !== undefined && (
                          <span className="text-xs font-mono text-muted-foreground">
                            {(stepData.durationMs / 1000).toFixed(2)}s
                          </span>
                        )}
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
                            isCurrentFailed
                              ? "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 font-bold"
                              : stepData?.status === "completed"
                              ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                              : stepData?.status === "running"
                              ? "bg-brand/10 text-brand"
                              : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {isCurrentFailed ? "Failed" : stepData?.status || "Pending"}
                        </span>
                        <Icon
                          name={isExpanded ? "ChevronUp" : "ChevronDown"}
                          className="w-4 h-4 text-muted-foreground"
                        />
                      </div>
                    </div>

                    {/* Expandable Stage Details */}
                    {isExpanded && (
                      <div className="px-3.5 sm:px-4 pb-4 pt-1 border-t border-border/60 space-y-3">
                        {/* If this stage has an error */}
                        {stageError && (
                          <div className="p-3 rounded-lg bg-red-950/80 border border-red-500/50 shadow-inner">
                            <div className="flex items-center justify-between text-[11px] font-mono font-semibold text-red-400 mb-1">
                              <span className="flex items-center gap-1.5">
                                <Icon name="AlertTriangle" className="w-3.5 h-3.5" />
                                Exact Error (Step Index: {stage.index})
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(stageError);
                                  toast.success("Error message copied");
                                }}
                                className="text-[10px] text-red-300 hover:underline flex items-center gap-1"
                              >
                                <Icon name="Copy" className="w-3 h-3" /> Copy
                              </button>
                            </div>
                            <pre className="text-xs font-mono text-red-200 whitespace-pre-wrap break-all leading-relaxed">
                              {stageError}
                            </pre>
                            {onResumeFromStage && (
                              <div className="mt-2 pt-2 border-t border-red-900/60 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => {
                                    onClose();
                                    onResumeFromStage(stage.index);
                                  }}
                                  className="text-xs font-semibold px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white flex items-center gap-1 transition"
                                >
                                  <Icon name="Play" className="w-3 h-3" /> Resume directly from Step {stage.index}
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Stage Execution Metadata */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div className="p-2 rounded bg-secondary/50">
                            <div className="text-[10px] text-muted-foreground uppercase font-bold">Step Index</div>
                            <div className="font-mono font-semibold mt-0.5">{stage.index}</div>
                          </div>
                          <div className="p-2 rounded bg-secondary/50">
                            <div className="text-[10px] text-muted-foreground uppercase font-bold">Duration</div>
                            <div className="font-mono font-semibold mt-0.5">
                              {stepData?.durationMs ? `${(stepData.durationMs / 1000).toFixed(2)}s` : "—"}
                            </div>
                          </div>
                          <div className="p-2 rounded bg-secondary/50">
                            <div className="text-[10px] text-muted-foreground uppercase font-bold">Started At</div>
                            <div className="font-mono text-[11px] truncate mt-0.5">
                              {stepData?.startedAt ? new Date(stepData.startedAt).toLocaleTimeString() : "—"}
                            </div>
                          </div>
                          <div className="p-2 rounded bg-secondary/50">
                            <div className="text-[10px] text-muted-foreground uppercase font-bold">Completed At</div>
                            <div className="font-mono text-[11px] truncate mt-0.5">
                              {stepData?.completedAt ? new Date(stepData.completedAt).toLocaleTimeString() : "—"}
                            </div>
                          </div>
                        </div>

                        {/* Stage Specific Logs */}
                        <div>
                          <div className="text-[11px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                            <Icon name="List" className="w-3 h-3" /> Stage Log Events ({stageLogs.length})
                          </div>
                          {stageLogs.length > 0 ? (
                            <div className="rounded-lg bg-zinc-950 p-2.5 text-xs font-mono text-zinc-300 space-y-1 max-h-36 overflow-y-auto">
                              {stageLogs.map((l, idx) => (
                                <div key={idx} className="flex items-start gap-1.5">
                                  <span className="text-brand shrink-0">›</span>
                                  <span className="break-words">{l}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground italic py-1">
                              No specific stage logs recorded yet.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 2: Raw Event Stream */}
          {activeTab === "rawLogs" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>All pipeline orchestrator events ({logs.length} entries):</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(logs.join("\n"));
                    toast.success("All logs copied to clipboard");
                  }}
                  className="text-xs text-brand hover:underline flex items-center gap-1"
                >
                  <Icon name="Copy" className="w-3 h-3" /> Copy All Logs
                </button>
              </div>
              <div className="rounded-xl bg-zinc-950 p-3.5 font-mono text-xs text-zinc-200 shadow-inner max-h-[50vh] overflow-y-auto space-y-1">
                {logs.length === 0 ? (
                  <p className="text-zinc-500 italic">No events logged yet.</p>
                ) : (
                  logs.map((log, i) => {
                    const isErr = log.includes("✗") || log.toLowerCase().includes("fail") || log.toLowerCase().includes("error");
                    const isSuccess = log.includes("✓") || log.includes("Complete");
                    return (
                      <div
                        key={i}
                        className={`flex items-start gap-2 py-0.5 ${
                          isErr ? "text-red-400 font-semibold" : isSuccess ? "text-emerald-400" : "text-zinc-300"
                        }`}
                      >
                        <span className="text-zinc-600 select-none text-[10px] w-6 shrink-0">{i + 1}</span>
                        <span className="break-words flex-1">{log}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Preserved State Checkpoint */}
          {activeTab === "artifacts" && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-secondary/50 border border-border">
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon name="CheckCircle2" className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-foreground">
                    State Resilience & Intermediate Snapshots
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  When a pipeline error occurs, intermediate AI intelligence artifacts (Job Intelligence, Company Intel, Skill Gap, Baseline ATS Scores) are preserved in session storage so you do not need to re-query models or lose prior work.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl border border-border bg-card">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-foreground">Job Intelligence</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${result?.jobIntelligence ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-secondary text-muted-foreground"}`}>
                      {result?.jobIntelligence ? "Preserved ✓" : "Not Captured"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Extracted keywords, hard skills, seniority level, and role requirements.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-border bg-card">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-foreground">Company Intelligence</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${result?.companyIntelligence ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-secondary text-muted-foreground"}`}>
                      {result?.companyIntelligence ? "Preserved ✓" : "Not Captured"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Target company values, mission keywords, and culture alignment flags.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-border bg-card">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-foreground">Skill Gap Intelligence</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${result?.skillGap ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-secondary text-muted-foreground"}`}>
                      {result?.skillGap ? "Preserved ✓" : "Not Captured"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Delta mapping of candidate skills against job description hard requirements.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-border bg-card">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-foreground">Baseline ATS Score</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${result?.beforeATS ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-secondary text-muted-foreground"}`}>
                      {result?.beforeATS ? `Preserved (${result.beforeATS.scores.ats}/100) ✓` : "Not Captured"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Initial score and keyword coverage analysis of original un-optimized resume.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-card flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {isFailed ? (
              <span className="text-red-600 dark:text-red-400 font-semibold flex items-center gap-1.5">
                <Icon name="AlertCircle" className="w-4 h-4" />
                Step Index {failedStageIndex ?? "Unknown"} failed ({failedStageDisplayName})
              </span>
            ) : (
              <span>All systems operational</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground transition active:scale-95"
            >
              Close Overlay
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
