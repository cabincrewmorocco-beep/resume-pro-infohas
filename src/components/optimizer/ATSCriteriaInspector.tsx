"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/shared";
import { useApp } from "@/lib/store";
import {
  scoreResumeATSCriteria,
  type ATSCriteriaScoreResult,
  type KeywordDensityItem,
  type FormattingIssue
} from "@/lib/ats-criteria-scorer";
import { toast } from "sonner";
import type { ResumeData, JobDescription } from "@/lib/types";

interface ATSCriteriaInspectorProps {
  resume?: ResumeData;
  jobDescription?: JobDescription;
  onApplyFix?: () => void;
}

export function ATSCriteriaInspector({
  resume: propResume,
  jobDescription: propJd,
  onApplyFix,
}: ATSCriteriaInspectorProps) {
  const activeResumeId = useApp((s) => s.activeResumeId);
  const resumes = useApp((s) => s.resumes);
  const updateResume = useApp((s) => s.updateResume);

  const [activeTab, setActiveTab] = useState<"overview" | "keywords" | "formatting" | "impact">("overview");
  const [searchTerm, setSearchTerm] = useState("");

  const resume = useMemo(() => {
    if (propResume) return propResume;
    return resumes.find((r) => r.id === activeResumeId) || resumes[0];
  }, [propResume, resumes, activeResumeId]);

  // Compute criteria report
  const report: ATSCriteriaScoreResult = useMemo(() => {
    if (!resume) {
      return {
        overallScore: 0,
        grade: "F",
        summary: "No resume loaded to score.",
        keywordDensity: {
          score: 0,
          totalWordCount: 0,
          uniqueWordCount: 0,
          averageDensityPercent: 0,
          stuffedKeywords: [],
          optimalKeywords: [],
          underrepresentedKeywords: [],
          missingKeywords: [],
          breakdown: [],
        },
        formattingConsistency: {
          score: 0,
          dateFormatStandard: "None",
          dateConsistencyPercent: 0,
          bulletPunctuationConsistencyPercent: 0,
          bulletPunctuationStyle: "mixed",
          bulletCapitalizationPercent: 0,
          sectionHeaderStandardPercent: 0,
          issues: [],
        },
        contentImpact: {
          score: 0,
          totalBullets: 0,
          actionVerbCount: 0,
          actionVerbRatio: 0,
          quantifiedCount: 0,
          quantifiedRatio: 0,
          weakVerbsDetected: [],
          strongVerbsDetected: [],
        },
        recommendations: [],
        scannedAt: new Date().toISOString(),
      };
    }
    return scoreResumeATSCriteria(resume, { targetJobDescription: propJd });
  }, [resume, propJd]);

  // Auto-Fix: Bullet Punctuation Consistency
  const autoFixBulletPunctuation = () => {
    if (!resume) return;
    const shouldAddPeriod = report.formattingConsistency.bulletPunctuationStyle !== "consistent_no_period";
    
    const updatedExperience = (resume.experience || []).map((exp) => ({
      ...exp,
      bullets: (exp.bullets || []).map((b) => {
        let clean = b.trim();
        if (clean.endsWith(".") || clean.endsWith(";")) {
          clean = clean.slice(0, -1).trim();
        }
        return shouldAddPeriod ? `${clean}.` : clean;
      }),
    }));

    updateResume(resume.id, { experience: updatedExperience });
    toast.success(`Standardized bullet punctuation across all experience entries!`);
    onApplyFix?.();
  };

  // Filtered keywords breakdown
  const filteredKeywords = useMemo(() => {
    if (!searchTerm) return report.keywordDensity.breakdown;
    return report.keywordDensity.breakdown.filter((k) =>
      k.keyword.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [report.keywordDensity.breakdown, searchTerm]);

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-3 border-b border-border/70">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-primary/10 text-primary">
                <Icon name="Target" className="w-4 h-4" />
              </span>
              <CardTitle className="text-base font-bold font-display">
                ATS Criteria Scorer & Diagnostics
              </CardTitle>
            </div>
            <CardDescription className="text-xs mt-0.5">
              Deep evaluation of keyword density, date & bullet formatting consistency, and impact quantification.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Badge
              variant="outline"
              className={`text-xs px-2.5 py-1 font-bold ${
                report.overallScore >= 85
                  ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : report.overallScore >= 70
                  ? "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300"
                  : "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300"
              }`}
            >
              Grade {report.grade} • {report.overallScore}/100 ATS Match
            </Badge>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 pt-3 overflow-x-auto">
          {[
            { id: "overview", label: "Composite Score", icon: "BarChart3" },
            { id: "keywords", label: `Keyword Density (${report.keywordDensity.score}%)`, icon: "Key" },
            { id: "formatting", label: `Formatting Consistency (${report.formattingConsistency.score}%)`, icon: "CheckSquare" },
            { id: "impact", label: `Impact & Verbs (${report.contentImpact.score}%)`, icon: "Zap" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon name={tab.icon} className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="pt-4 text-xs">
        {/* Tab 1: Overview */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/40 border border-border/60 flex items-start gap-3">
              <Icon name="Info" className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">ATS Compliance Verdict: </span>
                {report.summary}
              </div>
            </div>

            {/* Tri-Axis Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Keywords Card */}
              <div className="p-3 rounded-lg border border-border bg-card space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Icon name="Key" className="w-3.5 h-3.5 text-blue-600" /> Keyword Density
                  </span>
                  <span className="font-bold text-blue-600">{report.keywordDensity.score}%</span>
                </div>
                <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                  <div className="bg-blue-600 h-full rounded-full" style={{ width: `${report.keywordDensity.score}%` }} />
                </div>
                <div className="text-[11px] text-muted-foreground flex justify-between">
                  <span>{report.keywordDensity.optimalKeywords.length} optimal keywords</span>
                  <span>{report.keywordDensity.totalWordCount} words</span>
                </div>
              </div>

              {/* Formatting Consistency Card */}
              <div className="p-3 rounded-lg border border-border bg-card space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Icon name="FileCheck2" className="w-3.5 h-3.5 text-emerald-600" /> Format Consistency
                  </span>
                  <span className="font-bold text-emerald-600">{report.formattingConsistency.score}%</span>
                </div>
                <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${report.formattingConsistency.score}%` }} />
                </div>
                <div className="text-[11px] text-muted-foreground flex justify-between">
                  <span>Dates: {report.formattingConsistency.dateConsistencyPercent}% uniform</span>
                  <span>{report.formattingConsistency.issues.length} flags</span>
                </div>
              </div>

              {/* Impact Card */}
              <div className="p-3 rounded-lg border border-border bg-card space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Icon name="Zap" className="w-3.5 h-3.5 text-amber-600" /> Action & Metrics
                  </span>
                  <span className="font-bold text-amber-600">{report.contentImpact.score}%</span>
                </div>
                <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                  <div className="bg-amber-600 h-full rounded-full" style={{ width: `${report.contentImpact.score}%` }} />
                </div>
                <div className="text-[11px] text-muted-foreground flex justify-between">
                  <span>{report.contentImpact.actionVerbRatio}% action verbs</span>
                  <span>{report.contentImpact.quantifiedRatio}% quantified</span>
                </div>
              </div>
            </div>

            {/* Recommendations List */}
            {report.recommendations.length > 0 && (
              <div className="space-y-2 pt-2">
                <h4 className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                  <Icon name="ListChecks" className="w-3.5 h-3.5 text-primary" /> Prioritized ATS Fixes
                </h4>
                <div className="space-y-2">
                  {report.recommendations.slice(0, 4).map((rec, i) => (
                    <div
                      key={i}
                      className={`p-2.5 rounded-lg border text-xs flex items-start justify-between gap-3 ${
                        rec.priority === "high"
                          ? "bg-red-50/60 border-red-200 text-red-900 dark:bg-red-950/30 dark:border-red-800 dark:text-red-200"
                          : "bg-muted/50 border-border text-foreground"
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="font-semibold flex items-center gap-1.5">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              rec.priority === "high" ? "bg-red-600" : "bg-amber-500"
                            }`}
                          />
                          {rec.title}
                        </div>
                        <p className="text-[11px] text-muted-foreground">{rec.fix}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0 uppercase tracking-wider font-mono">
                        {rec.priority}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Keyword Density Breakdown */}
        {activeTab === "keywords" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">
                Optimal ATS keyword density is <strong className="text-foreground">1.5% - 3.5%</strong>. Keyword density below 1% leads to low visibility; exceeding 4.5% triggers automated spam filters.
              </div>
              <input
                type="text"
                placeholder="Filter keywords..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-2.5 py-1 rounded-md border border-input bg-background text-xs w-full sm:w-44 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Keyword Density Table */}
            <div className="border border-border rounded-lg overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/60 text-muted-foreground font-semibold sticky top-0 border-b border-border">
                  <tr>
                    <th className="py-2 px-3">Keyword / Term</th>
                    <th className="py-2 px-3">Mentions</th>
                    <th className="py-2 px-3">Density %</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Sections</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredKeywords.map((item, idx) => (
                    <tr key={idx} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2 px-3 font-medium text-foreground">{item.keyword}</td>
                      <td className="py-2 px-3 text-muted-foreground font-mono">{item.count}</td>
                      <td className="py-2 px-3 font-mono font-medium">
                        <span
                          className={`${
                            item.status === "optimal"
                              ? "text-emerald-600 font-semibold"
                              : item.status === "overstuffed"
                              ? "text-red-600 font-bold"
                              : "text-muted-foreground"
                          }`}
                        >
                          {item.densityPercent}%
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <Badge
                          variant="outline"
                          className={`text-[10px] py-0 px-1.5 ${
                            item.status === "optimal"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                              : item.status === "overstuffed"
                              ? "bg-red-50 text-red-700 border-red-300"
                              : item.status === "missing"
                              ? "bg-amber-50 text-amber-700 border-amber-300"
                              : "bg-slate-100 text-slate-700 border-slate-300"
                          }`}
                        >
                          {item.status}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-[11px] text-muted-foreground">
                        {item.locations.length > 0 ? item.locations.join(", ") : "None"}
                      </td>
                    </tr>
                  ))}
                  {filteredKeywords.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-muted-foreground">
                        No keywords found matching "{searchTerm}"
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Formatting Consistency */}
        {activeTab === "formatting" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Date Consistency Box */}
              <div className="p-3 rounded-lg border border-border bg-card space-y-1.5">
                <div className="font-semibold text-foreground flex items-center justify-between">
                  <span>Date Pattern Uniformity</span>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {report.formattingConsistency.dateConsistencyPercent}%
                  </Badge>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Dominant style: <strong className="text-foreground">{report.formattingConsistency.dateFormatStandard}</strong>
                </div>
                <p className="text-[11px] text-muted-foreground leading-normal">
                  Standardized dates ensure Applicant Tracking Systems accurately compute your total years of experience.
                </p>
              </div>

              {/* Bullet Punctuation Consistency Box */}
              <div className="p-3 rounded-lg border border-border bg-card space-y-1.5">
                <div className="font-semibold text-foreground flex items-center justify-between">
                  <span>Bullet Ending Punctuation</span>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {report.formattingConsistency.bulletPunctuationConsistencyPercent}%
                  </Badge>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Current style: <strong className="text-foreground">{report.formattingConsistency.bulletPunctuationStyle}</strong>
                </div>
                {report.formattingConsistency.bulletPunctuationStyle === "mixed" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={autoFixBulletPunctuation}
                    className="w-full mt-1 text-[11px] h-7 gap-1 text-primary border-primary/30 hover:bg-primary/5"
                  >
                    <Icon name="Wand2" className="w-3 h-3" /> Auto-Standardize All Bullets
                  </Button>
                )}
              </div>
            </div>

            {/* Formatting Issues List */}
            <div className="space-y-2">
              <h4 className="font-semibold text-foreground text-xs">Formatting Flags & Audit</h4>
              {report.formattingConsistency.issues.length === 0 ? (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <Icon name="CheckCircle2" className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Pristine formatting consistency! No date, bullet, or header issues detected.</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {report.formattingConsistency.issues.map((issue) => (
                    <div
                      key={issue.id}
                      className="p-3 rounded-lg border border-border bg-card text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          <Icon
                            name={issue.severity === "error" ? "AlertCircle" : "AlertTriangle"}
                            className={`w-3.5 h-3.5 ${
                              issue.severity === "error" ? "text-red-600" : "text-amber-500"
                            }`}
                          />
                          {issue.title}
                        </div>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {issue.category}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{issue.detail}</p>
                      <div className="text-[11px] text-primary font-medium">
                        Recommendation: {issue.recommendation}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Impact & Action Verbs */}
        {activeTab === "impact" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border border-border bg-card text-center space-y-1">
                <div className="text-xl font-bold font-display text-primary">
                  {report.contentImpact.actionVerbRatio}%
                </div>
                <div className="text-[11px] font-medium text-foreground">Action Verb Ratio</div>
                <div className="text-[10px] text-muted-foreground">
                  {report.contentImpact.actionVerbCount} of {report.contentImpact.totalBullets} bullets start with power verbs
                </div>
              </div>

              <div className="p-3 rounded-lg border border-border bg-card text-center space-y-1">
                <div className="text-xl font-bold font-display text-emerald-600">
                  {report.contentImpact.quantifiedRatio}%
                </div>
                <div className="text-[11px] font-medium text-foreground">Quantified Metrics Ratio</div>
                <div className="text-[10px] text-muted-foreground">
                  {report.contentImpact.quantifiedCount} of {report.contentImpact.totalBullets} bullets have %, $, or numbers
                </div>
              </div>
            </div>

            {/* Verbs Detected */}
            {report.contentImpact.strongVerbsDetected.length > 0 && (
              <div>
                <span className="font-semibold text-foreground text-xs block mb-1.5">
                  Strong Power Verbs Detected:
                </span>
                <div className="flex flex-wrap gap-1">
                  {report.contentImpact.strongVerbsDetected.map((v, i) => (
                    <span key={i} className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded capitalize">
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Weak Verbs Warning */}
            {report.contentImpact.weakVerbsDetected.length > 0 && (
              <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200 text-amber-900 text-xs space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <Icon name="AlertTriangle" className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  Weak Duty Verbs Detected
                </div>
                <p className="text-[11px] text-amber-800">
                  Found passive phrasing: <strong className="underline">{report.contentImpact.weakVerbsDetected.join(", ")}</strong>. Replace these with assertive verbs to improve your ATS impact score.
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
