// ============================================================================
// ResumeAI Pro — Real-time Circular Resume Strength Gauge Component
// ============================================================================

import React, { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/shared";
import { useApp } from "@/lib/store";
import {
  calculateResumeStrength,
  PRESET_TARGET_ROLES,
  type StrengthMetrics,
} from "@/lib/resume-strength";

interface ResumeStrengthGaugeProps {
  className?: string;
  onNavigate?: (view: string) => void;
}

export function ResumeStrengthGauge({ className = "", onNavigate }: ResumeStrengthGaugeProps) {
  const resumes = useApp((s) => s.resumes);
  const activeResumeId = useApp((s) => s.activeResumeId);
  const setActiveResume = useApp((s) => s.setActiveResume);
  const jobDescriptions = useApp((s) => s.jobDescriptions);
  const activeJdId = useApp((s) => s.activeJdId);
  const setActiveJD = useApp((s) => s.setActiveJD);
  const setView = useApp((s) => s.setView);

  // Selected Resume ID (defaults to activeResumeId or first resume)
  const [selectedResumeId, setSelectedResumeId] = useState<string>(
    activeResumeId || (resumes.length > 0 ? resumes[0].id : "")
  );

  // Selected Target JD ID (can be specific JD id, "all", or "preset:<id>")
  const [selectedTarget, setSelectedTarget] = useState<string>(
    activeJdId || (jobDescriptions.length > 0 ? jobDescriptions[0].id : "preset:software_eng")
  );

  // Keyword inspection tab: "missing" | "matched"
  const [keywordTab, setKeywordTab] = useState<"missing" | "matched">("missing");
  const [copiedKeyword, setCopiedKeyword] = useState<string | null>(null);

  // Keep selectedResumeId in sync if resumes change
  useEffect(() => {
    if (activeResumeId) {
      setSelectedResumeId(activeResumeId);
    } else if (resumes.length > 0 && !selectedResumeId) {
      setSelectedResumeId(resumes[0].id);
    }
  }, [activeResumeId, resumes]);

  // Resolve current active resume
  const currentResume = useMemo(() => {
    return resumes.find((r) => r.id === selectedResumeId) || (resumes.length > 0 ? resumes[0] : null);
  }, [resumes, selectedResumeId]);

  // Resolve current target JD or preset
  const { currentJd, allJds, presetId } = useMemo(() => {
    if (selectedTarget.startsWith("preset:")) {
      const pId = selectedTarget.replace("preset:", "");
      return { currentJd: null, allJds: undefined, presetId: pId };
    }
    if (selectedTarget === "all") {
      return { currentJd: null, allJds: jobDescriptions, presetId: "software_eng" };
    }
    const found = jobDescriptions.find((j) => j.id === selectedTarget);
    return { currentJd: found || null, allJds: undefined, presetId: "software_eng" };
  }, [selectedTarget, jobDescriptions]);

  // Compute real-time metrics
  const metrics: StrengthMetrics = useMemo(() => {
    return calculateResumeStrength(currentResume, currentJd, allJds, presetId);
  }, [currentResume, currentJd, allJds, presetId]);

  // Handle keyword copy
  const handleCopy = (kw: string) => {
    navigator.clipboard?.writeText(kw);
    setCopiedKeyword(kw);
    setTimeout(() => setCopiedKeyword(null), 1800);
  };

  // SVG Gauge calculations
  const size = 164;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Offset calculation
  const strokeDashoffset = circumference - (metrics.score / 100) * circumference;

  const navigateTo = (view: any) => {
    if (onNavigate) {
      onNavigate(view);
    } else {
      if (currentResume) setActiveResume(currentResume.id);
      if (currentJd) setActiveJD(currentJd.id);
      setView(view);
    }
  };

  return (
    <Card id="resume-strength-card" className={`overflow-hidden border-border/80 shadow-sm w-full max-w-full ${className}`}>
      <CardHeader className="p-4 sm:p-6 pb-3 border-b border-border/40 bg-muted/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand/10 text-brand flex items-center justify-center shrink-0">
                <Icon name="Activity" className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2 truncate">
                  <span>Resume Strength Score</span>
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                </CardTitle>
                <CardDescription className="text-xs truncate">
                  Real-time keyword & ATS match analysis
                </CardDescription>
              </div>
            </div>
          </div>

          {/* Quick Target Selectors */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Resume Selector */}
            {resumes.length > 1 && (
              <div className="flex items-center gap-1.5 bg-background border border-input rounded-lg px-2.5 py-1 text-xs shadow-2xs max-w-full">
                <Icon name="FileText" className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <select
                  id="resume-strength-resume-select"
                  value={selectedResumeId}
                  onChange={(e) => {
                    setSelectedResumeId(e.target.value);
                    setActiveResume(e.target.value);
                  }}
                  className="bg-transparent text-xs font-medium focus:outline-none cursor-pointer max-w-[120px] sm:max-w-[140px] truncate"
                  title="Select resume to evaluate"
                >
                  {resumes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name || "Untitled Resume"}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Target Job Selector */}
            <div className="flex items-center gap-1.5 bg-background border border-input rounded-lg px-2.5 py-1 text-xs shadow-2xs max-w-full">
              <Icon name="Target" className="w-3.5 h-3.5 text-brand shrink-0" />
              <select
                id="resume-strength-target-select"
                value={selectedTarget}
                onChange={(e) => setSelectedTarget(e.target.value)}
                className="bg-transparent text-xs font-medium focus:outline-none cursor-pointer max-w-[140px] sm:max-w-[170px] truncate"
                title="Select target job description or role"
              >
                {jobDescriptions.length > 0 && (
                  <optgroup label="Saved Job Descriptions">
                    {jobDescriptions.map((jd) => (
                      <option key={jd.id} value={jd.id}>
                        {jd.title || jd.company || "Saved Job"}
                      </option>
                    ))}
                    <option value="all">Composite (All Saved JDs)</option>
                  </optgroup>
                )}
                <optgroup label="Target Role Presets">
                  {PRESET_TARGET_ROLES.map((preset) => (
                    <option key={preset.id} value={`preset:${preset.id}`}>
                      {preset.title}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 pt-4 sm:pt-6">
        {resumes.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-brand/10 text-brand flex items-center justify-center mx-auto mb-3">
              <Icon name="FilePlus2" className="w-6 h-6" />
            </div>
            <h4 className="font-semibold text-base">No Resumes Found</h4>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              Create or upload your first resume to see your real-time Resume Strength Score and keyword matches.
            </p>
            <Button
              id="resume-strength-create-btn"
              onClick={() => navigateTo("builder")}
              className="mt-4 bg-brand hover:bg-brand-dark text-white gap-2"
            >
              <Icon name="Plus" className="w-4 h-4" /> Create Resume
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center w-full max-w-full">
            {/* Left Col: Circular Progress Gauge */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center p-2 w-full">
              <div className="relative inline-flex items-center justify-center">
                {/* SVG Gauge */}
                <svg
                  width={size}
                  height={size}
                  className="transform -rotate-90 drop-shadow-sm"
                  aria-label={`Resume Strength Score: ${metrics.score}%`}
                >
                  {/* Subtle Background Track */}
                  <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    className="text-muted/30 dark:text-muted/20"
                    strokeWidth={strokeWidth}
                  />
                  {/* Active Animated Ring */}
                  <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={metrics.levelColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    style={{
                      transition: "stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.4s ease",
                    }}
                  />
                </svg>

                {/* Central Score Display */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <motion.div
                    key={metrics.score}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-baseline"
                  >
                    <span
                      className="text-4xl sm:text-5xl font-extrabold font-display tracking-tight"
                      style={{ color: metrics.levelColor }}
                    >
                      {metrics.score}
                    </span>
                    <span className="text-xs text-muted-foreground font-semibold ml-0.5">%</span>
                  </motion.div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">
                    Match Score
                  </span>
                </div>
              </div>

              {/* Status Badge */}
              <div className="mt-4 flex flex-col items-center gap-1 text-center max-w-full">
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                  style={{
                    backgroundColor: `${metrics.levelColor}18`,
                    color: metrics.levelColor,
                    border: `1px solid ${metrics.levelColor}40`,
                  }}
                >
                  <Icon
                    name={metrics.score >= 80 ? "CheckCircle2" : metrics.score >= 65 ? "Check" : "AlertCircle"}
                    className="w-3.5 h-3.5 shrink-0"
                  />
                  {metrics.levelLabel}
                </span>
                <span className="text-[11px] text-muted-foreground truncate max-w-[260px]">
                  vs. <strong className="text-foreground">{metrics.comparedRoleTitle}</strong>
                </span>
              </div>
            </div>

            {/* Right Col: Detailed Breakdown & Real-Time Keyword Matches */}
            <div className="lg:col-span-7 space-y-4 w-full min-w-0">
              {/* Category Breakdown Progress Bars — fluid 1-col on mobile, 2-col on tablet/desktop */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 w-full">
                <div className="p-2.5 rounded-lg border border-border/60 bg-card/60">
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-muted-foreground font-medium">Keyword Coverage</span>
                    <span className="font-bold">{metrics.breakdown.keywordMatch}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${metrics.breakdown.keywordMatch}%`,
                        backgroundColor: metrics.levelColor,
                      }}
                    />
                  </div>
                </div>

                <div className="p-2.5 rounded-lg border border-border/60 bg-card/60">
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-muted-foreground font-medium">Core Skills</span>
                    <span className="font-bold">{metrics.breakdown.coreSkills}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand rounded-full transition-all duration-500"
                      style={{ width: `${metrics.breakdown.coreSkills}%` }}
                    />
                  </div>
                </div>

                <div className="p-2.5 rounded-lg border border-border/60 bg-card/60">
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-muted-foreground font-medium">Experience Density</span>
                    <span className="font-bold">{metrics.breakdown.experienceDensity}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-500 rounded-full transition-all duration-500"
                      style={{ width: `${metrics.breakdown.experienceDensity}%` }}
                    />
                  </div>
                </div>

                <div className="p-2.5 rounded-lg border border-border/60 bg-card/60">
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-muted-foreground font-medium">Quantified Impact</span>
                    <span className="font-bold">{metrics.breakdown.quantifiableImpact}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all duration-500"
                      style={{ width: `${metrics.breakdown.quantifiableImpact}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Keyword Cloud Header / Tabs */}
              <div className="pt-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2 border-b border-border/50">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      id="strength-tab-missing"
                      onClick={() => setKeywordTab("missing")}
                      className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all ${
                        keywordTab === "missing"
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Missing Keywords ({metrics.missingKeywords.length})
                    </button>
                    <button
                      id="strength-tab-matched"
                      onClick={() => setKeywordTab("matched")}
                      className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all ${
                        keywordTab === "matched"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Matched Keywords ({metrics.matchedKeywords.length})
                    </button>
                  </div>

                  <span className="text-[11px] text-muted-foreground">
                    {metrics.matchedKeywords.length} of {metrics.totalKeywords} terms hit
                  </span>
                </div>

                {/* Keyword Pills */}
                <div className="min-h-[64px] max-h-[110px] overflow-y-auto py-2.5 flex flex-wrap gap-1.5">
                  <AnimatePresence mode="wait">
                    {keywordTab === "missing" ? (
                      metrics.missingKeywords.length > 0 ? (
                        metrics.missingKeywords.map((kw) => (
                          <button
                            key={kw}
                            onClick={() => handleCopy(kw)}
                            title="Click to copy keyword"
                            className="group inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-900/50 hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors"
                          >
                            <span className="font-mono text-[10px] opacity-60">+</span>
                            <span>{kw}</span>
                            {copiedKeyword === kw && (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold ml-1">
                                Copied!
                              </span>
                            )}
                          </button>
                        ))
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 py-2">
                          <Icon name="CheckCircle2" className="w-4 h-4 shrink-0" />
                          <span>All targeted job keywords were found in your resume! Fantastic match.</span>
                        </div>
                      )
                    ) : metrics.matchedKeywords.length > 0 ? (
                      metrics.matchedKeywords.map((kw) => (
                        <span
                          key={kw}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50"
                        >
                          <Icon name="Check" className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span>{kw}</span>
                        </span>
                      ))
                    ) : (
                      <div className="text-xs text-muted-foreground py-2">
                        No keywords matched yet. Incorporate target skills into your resume bullets and skills list.
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="pt-2 border-t border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground flex items-center gap-1 min-w-0">
                  <Icon name="Sparkles" className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="truncate max-w-[280px]">
                    {metrics.suggestions[0] || "Keywords matched against target job description."}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    id="strength-optimize-btn"
                    size="sm"
                    variant="outline"
                    onClick={() => navigateTo("optimizer")}
                    className="h-7 text-xs gap-1 hover:bg-brand/10 hover:text-brand"
                  >
                    <Icon name="Wand2" className="w-3 h-3" /> Optimize
                  </Button>
                  <Button
                    id="strength-ats-check-btn"
                    size="sm"
                    onClick={() => navigateTo("ats-checker")}
                    className="h-7 text-xs bg-brand hover:bg-brand-dark text-white gap-1"
                  >
                    <Icon name="ScanText" className="w-3 h-3" /> Full ATS Scan
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
