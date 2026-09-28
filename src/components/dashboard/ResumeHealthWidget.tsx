"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Icon, ScoreRing } from "@/components/shared";
import { useApp } from "@/lib/store";
import { computeResumeHealthScore, type ResumeHealthReport, type ActionableAdvice } from "@/lib/resume-health";
import type { ResumeData } from "@/lib/types";

export function ResumeHealthWidget() {
  const resumes = useApp((s) => s.resumes);
  const activeResumeId = useApp((s) => s.activeResumeId);
  const setActiveResume = useApp((s) => s.setActiveResume);
  const setView = useApp((s) => s.setView);

  const [selectedResumeId, setSelectedResumeId] = useState<string>(
    activeResumeId || resumes[0]?.id || ""
  );

  const [showAllAdvice, setShowAllAdvice] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");

  const currentResume = useMemo(() => {
    return resumes.find((r) => r.id === selectedResumeId) || resumes[0] || null;
  }, [resumes, selectedResumeId]);

  const report = useMemo<ResumeHealthReport | null>(() => {
    if (!currentResume) return null;
    return computeResumeHealthScore(currentResume);
  }, [currentResume]);

  if (!currentResume || !report) {
    return null;
  }

  const filteredAdvice = report.actionableAdvice.filter((item) => {
    if (selectedCategoryFilter === "all") return true;
    return item.category === selectedCategoryFilter;
  });

  const displayedAdvice = showAllAdvice ? filteredAdvice : filteredAdvice.slice(0, 3);

  return (
    <Card className="w-full max-w-full overflow-hidden border border-border/80 shadow-premium">
      {/* Header with Letter Grade Title & Resume Switcher */}
      <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-4 border-b border-border/60 bg-muted/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Icon name="Activity" className="w-4 h-4" />
              </span>
              <CardTitle className="text-base sm:text-lg font-bold font-display">
                Resume Health Score & Readability
              </CardTitle>
            </div>
            <CardDescription className="text-xs sm:text-sm">
              Letter-grade assessment (A–F) evaluating formatting, length budget, keyword density, and scannability.
            </CardDescription>
          </div>

          {/* Resume Picker & Quick Action */}
          <div className="flex items-center gap-2">
            {resumes.length > 1 && (
              <Select
                value={selectedResumeId}
                onValueChange={(val) => {
                  setSelectedResumeId(val);
                  setActiveResume(val);
                }}
              >
                <SelectTrigger className="h-8 text-xs bg-card w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {resumes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.title || r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button
              size="sm"
              onClick={() => {
                setActiveResume(currentResume.id);
                setView("builder");
              }}
              className="bg-brand hover:bg-brand-dark text-white text-xs h-8 gap-1.5"
            >
              <Icon name="PenTool" className="w-3.5 h-3.5" /> Fix in Builder
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-6">
        {/* Top Section: Letter Grade Ring + Dimensional Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
          {/* Prominent Letter Grade Card */}
          <div className="md:col-span-4 flex flex-col items-center justify-center p-5 rounded-2xl bg-muted/20 border border-border text-center space-y-3">
            <div className="relative flex items-center justify-center">
              <ScoreRing value={report.overallScore} size={130} strokeWidth={9} />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className={`text-4xl font-black font-display tracking-tight ${report.gradeColor}`}>
                  {report.letterGrade}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                  Health Grade
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <div className={`px-3 py-1 rounded-full text-xs font-bold border inline-block ${report.gradeBadgeClass}`}>
                {report.verdict}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Overall score: <strong className="text-foreground">{report.overallScore}/100</strong>
              </div>
            </div>
          </div>

          {/* 4 Category Meters: Formatting, Length, Keyword Density, Readability */}
          <div className="md:col-span-8 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Readability & Structural Dimensions</span>
              <span>Category Score</span>
            </div>

            {/* 1. Formatting */}
            <div className="p-3 rounded-xl bg-card border border-border/70 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Icon name="Layout" className="w-3.5 h-3.5 text-blue-500" />
                  Formatting & Section Integrity
                </span>
                <span className="font-mono text-muted-foreground font-medium">
                  {report.categories.formatting.score}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${report.categories.formatting.score}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className={`h-full rounded-full ${
                    report.categories.formatting.score >= 85
                      ? "bg-emerald-500"
                      : report.categories.formatting.score >= 70
                      ? "bg-blue-500"
                      : "bg-amber-500"
                  }`}
                />
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                {report.categories.formatting.highlights[0] || "Contact, headline, and experience sections"}
              </div>
            </div>

            {/* 2. Length */}
            <div className="p-3 rounded-xl bg-card border border-border/70 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Icon name="FileText" className="w-3.5 h-3.5 text-purple-500" />
                  Length & Page Budget
                </span>
                <span className="font-mono text-muted-foreground font-medium">
                  {report.categories.length.score}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${report.categories.length.score}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className={`h-full rounded-full ${
                    report.categories.length.score >= 85
                      ? "bg-emerald-500"
                      : report.categories.length.score >= 70
                      ? "bg-purple-500"
                      : "bg-amber-500"
                  }`}
                />
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                {report.metrics.totalWords} words · {report.metrics.bulletCount} bullets (~{report.metrics.avgWordsPerBullet} words/bullet)
              </div>
            </div>

            {/* 3. Keyword Density & Quantifiable Impact */}
            <div className="p-3 rounded-xl bg-card border border-border/70 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Icon name="Zap" className="w-3.5 h-3.5 text-amber-500" />
                  Keyword Density & Metric Hardening
                </span>
                <span className="font-mono text-muted-foreground font-medium">
                  {report.categories.keywordDensity.score}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${report.categories.keywordDensity.score}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className={`h-full rounded-full ${
                    report.categories.keywordDensity.score >= 85
                      ? "bg-emerald-500"
                      : report.categories.keywordDensity.score >= 70
                      ? "bg-amber-500"
                      : "bg-red-500"
                  }`}
                />
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                {report.metrics.metricBulletPct}% bullets contain metrics ($, %, numbers)
              </div>
            </div>

            {/* 4. Readability & Scannability */}
            <div className="p-3 rounded-xl bg-card border border-border/70 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Icon name="Glasses" className="w-3.5 h-3.5 text-emerald-500" />
                  Readability & Flow
                </span>
                <span className="font-mono text-muted-foreground font-medium">
                  {report.categories.readability.score}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${report.categories.readability.score}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className={`h-full rounded-full ${
                    report.categories.readability.score >= 85
                      ? "bg-emerald-500"
                      : report.categories.readability.score >= 70
                      ? "bg-blue-500"
                      : "bg-amber-500"
                  }`}
                />
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                Scannable structure optimized for 6-second recruiter triage
              </div>
            </div>
          </div>
        </div>

        {/* Actionable Advice Section */}
        <div className="space-y-3 pt-3 border-t border-border/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Icon name="Lightbulb" className="w-3.5 h-3.5 text-gold" />
                Actionable Readability & Formatting Improvements ({report.actionableAdvice.length})
              </h4>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
              <Button
                variant={selectedCategoryFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategoryFilter("all")}
                className={`text-[11px] h-7 px-2.5 rounded-lg ${
                  selectedCategoryFilter === "all" ? "bg-brand text-white" : ""
                }`}
              >
                All Advice
              </Button>
              <Button
                variant={selectedCategoryFilter === "formatting" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategoryFilter("formatting")}
                className={`text-[11px] h-7 px-2.5 rounded-lg ${
                  selectedCategoryFilter === "formatting" ? "bg-brand text-white" : ""
                }`}
              >
                Formatting
              </Button>
              <Button
                variant={selectedCategoryFilter === "keywords" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategoryFilter("keywords")}
                className={`text-[11px] h-7 px-2.5 rounded-lg ${
                  selectedCategoryFilter === "keywords" ? "bg-brand text-white" : ""
                }`}
              >
                Keywords
              </Button>
              <Button
                variant={selectedCategoryFilter === "length" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategoryFilter("length")}
                className={`text-[11px] h-7 px-2.5 rounded-lg ${
                  selectedCategoryFilter === "length" ? "bg-brand text-white" : ""
                }`}
              >
                Length
              </Button>
            </div>
          </div>

          {/* Advice List */}
          <div className="space-y-2.5">
            {displayedAdvice.map((item) => {
              const badgeColor =
                item.priority === "critical"
                  ? "bg-red-500/10 text-red-600 border-red-500/20"
                  : item.priority === "high"
                  ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                  : "bg-blue-500/10 text-blue-600 border-blue-500/20";

              return (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl border border-border/70 bg-card hover:border-brand/40 transition-all space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${badgeColor}`}>
                        {item.priority}
                      </span>
                      <span className="font-semibold text-xs text-foreground">
                        {item.title}
                      </span>
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setActiveResume(currentResume.id);
                        setView("builder");
                      }}
                      className="text-xs h-6 px-2 text-brand hover:text-brand-dark"
                    >
                      Fix <Icon name="ArrowRight" className="w-3 h-3 ml-1" />
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed pl-1">
                    <strong className="text-foreground">Recommendation: </strong>
                    {item.recommendation}
                  </p>

                  <div className="text-[11px] text-muted-foreground/80 pl-1 italic">
                    Impact: {item.impact}
                  </div>
                </div>
              );
            })}

            {displayedAdvice.length === 0 && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                <Icon name="CheckCircle" className="w-4 h-4" />
                Zero issues detected in this category! Your resume achieves executive readability standards.
              </div>
            )}
          </div>

          {filteredAdvice.length > 3 && (
            <div className="pt-1 text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllAdvice(!showAllAdvice)}
                className="text-xs text-brand hover:underline h-7"
              >
                {showAllAdvice ? "Show Less" : `View All ${filteredAdvice.length} Recommendations`}
                <Icon name={showAllAdvice ? "ChevronUp" : "ChevronDown"} className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
