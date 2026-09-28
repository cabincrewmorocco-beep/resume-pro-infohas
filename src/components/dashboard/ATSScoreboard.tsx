"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Icon, ScoreRing } from "@/components/shared";
import { useApp } from "@/lib/store";
import { computeATSDashboard, type ATSDashboard, type TermMatch } from "@/lib/ats-match";
import { downloadResumeAsPDF, downloadResumeAsDOCX } from "@/lib/dashboard-exporter";
import type { ResumeData, JobDescription } from "@/lib/types";
import { toast } from "sonner";

export function ATSScoreboard() {
  const setView = useApp((s) => s.setView);
  const resumes = useApp((s) => s.resumes);
  const jds = useApp((s) => s.jobDescriptions);
  const activeResumeId = useApp((s) => s.activeResumeId);
  const activeJdId = useApp((s) => s.activeJdId);
  const setActiveResume = useApp((s) => s.setActiveResume);
  const setActiveJD = useApp((s) => s.setActiveJD);
  const updateResume = useApp((s) => s.updateResume);
  const addJD = useApp((s) => s.addJD);

  // Resume selection
  const [selectedResumeId, setSelectedResumeId] = useState<string>(
    activeResumeId || resumes[0]?.id || ""
  );

  // JD selection or custom paste
  const [selectedJdId, setSelectedJdId] = useState<string>(
    activeJdId || jds[0]?.id || "custom"
  );
  const [customJdTitle, setCustomJdTitle] = useState("Target Position");
  const [customJdCompany, setCustomJdCompany] = useState("");
  const [customJdText, setCustomJdText] = useState(
    "Looking for a Senior Specialist experienced with Project Management, Agile Delivery, Cloud Systems, Stakeholder Communication, Python, and SQL."
  );
  const [showCustomJdInput, setShowCustomJdInput] = useState(false);

  // Filter for keyword display
  const [activeTab, setActiveTab] = useState<"missing" | "must-haves" | "matched" | "coverage">("missing");

  // Export loading state
  const [exportingType, setExportingType] = useState<"pdf" | "docx" | null>(null);

  // Active Resume resolution
  const currentResume = useMemo(() => {
    return resumes.find((r) => r.id === selectedResumeId) || resumes[0] || null;
  }, [resumes, selectedResumeId]);

  // Active JD resolution
  const currentJd = useMemo<JobDescription | null>(() => {
    if (selectedJdId === "custom") {
      // Parse custom JD into structure
      const rawText = customJdText;
      const extractedWords = rawText
        .split(/[,;\n•\-\/\(\)]+/)
        .map((w) => w.trim())
        .filter((w) => w.length > 2 && w.length < 35);

      const uniqueWords = Array.from(new Set(extractedWords)).slice(0, 30);

      return {
        id: "custom_jd",
        title: customJdTitle,
        company: customJdCompany,
        rawText,
        keywords: uniqueWords,
        requiredSkills: uniqueWords.slice(0, 8),
        technologies: uniqueWords.slice(8, 16),
        preferredSkills: uniqueWords.slice(16, 24),
        createdAt: new Date().toISOString(),
      };
    }

    return jds.find((j) => j.id === selectedJdId) || jds[0] || null;
  }, [jds, selectedJdId, customJdText, customJdTitle, customJdCompany]);

  // Compute live ATS match
  const atsDashboard = useMemo<ATSDashboard | null>(() => {
    if (!currentResume || !currentJd) return null;
    try {
      return computeATSDashboard(currentResume, currentJd);
    } catch (e) {
      console.error("[ATSScoreboard] Compute error:", e);
      return null;
    }
  }, [currentResume, currentJd]);

  // Quick Action: Add missing keyword directly to Resume's skills
  const handleAddKeywordToResume = (term: string) => {
    if (!currentResume) return;

    const existingSkills = currentResume.skills || [];
    const skillExists = existingSkills.some((s) =>
      typeof s === "string" ? s.toLowerCase() === term.toLowerCase() : s?.name?.toLowerCase() === term.toLowerCase()
    );

    if (skillExists) {
      toast.info(`"${term}" is already recorded in your skills.`);
      return;
    }

    const updatedSkills = [...existingSkills, term];
    updateResume(currentResume.id, {
      skills: updatedSkills,
      updatedAt: new Date().toISOString(),
    });

    toast.success(`Added "${term}" to resume skills! Match score updated.`);
  };

  // Quick Action: Copy missing keywords
  const handleCopyMissingKeywords = () => {
    if (!atsDashboard?.missing) return;
    const text = atsDashboard.missing.map((m) => m.term).join(", ");
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${atsDashboard.missing.length} missing keywords to clipboard!`);
  };

  // Save custom JD to store
  const handleSaveCustomJd = () => {
    if (!currentJd) return;
    const newId = "jd_" + Math.random().toString(36).slice(2, 9);
    const toSave: JobDescription = {
      ...currentJd,
      id: newId,
    };
    addJD(toSave);
    setActiveJD(newId);
    setSelectedJdId(newId);
    setShowCustomJdInput(false);
    toast.success(`Saved "${toSave.title}" to your Job Descriptions!`);
  };

  // Export handlers
  const handleDownloadPDF = async () => {
    if (!currentResume) {
      toast.error("Please select a resume to export.");
      return;
    }
    setExportingType("pdf");
    await downloadResumeAsPDF(currentResume);
    setExportingType(null);
  };

  const handleDownloadDOCX = async () => {
    if (!currentResume) {
      toast.error("Please select a resume to export.");
      return;
    }
    setExportingType("docx");
    await downloadResumeAsDOCX(currentResume);
    setExportingType(null);
  };

  if (!currentResume) {
    return (
      <Card className="border border-border/80 p-6 text-center">
        <Icon name="ScanText" className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
        <h3 className="font-bold text-foreground">ATS Scoreboard</h3>
        <p className="text-xs text-muted-foreground mt-1 mb-4">
          Upload or create a resume to see a real-time percentage match against any target job.
        </p>
        <Button size="sm" onClick={() => setView("builder")} className="bg-brand text-white">
          Create Resume
        </Button>
      </Card>
    );
  }

  const score = atsDashboard?.overall ?? 75;
  const rating =
    score >= 85
      ? { label: "Ready for ATS", color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20" }
      : score >= 70
      ? { label: "Competitive Match", color: "text-blue-500", bg: "bg-blue-500/10 border-blue-500/20" }
      : score >= 50
      ? { label: "Moderate Gap", color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/20" }
      : { label: "High Filter Risk", color: "text-red-500", bg: "bg-red-500/10 border-red-500/20" };

  return (
    <Card className="w-full max-w-full overflow-hidden border border-border/80 shadow-premium">
      {/* Header with Title, Source Selectors & Direct Export Actions */}
      <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-4 border-b border-border/60 bg-muted/20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Icon name="Gauge" className="w-4 h-4" />
              </span>
              <CardTitle className="text-base sm:text-lg font-bold font-display">
                ATS Scoreboard & Keyword Matcher
              </CardTitle>
            </div>
            <CardDescription className="text-xs sm:text-sm">
              Live percentage match comparing your resume against the target job description with missing keyword detection.
            </CardDescription>
          </div>

          {/* Direct Resume Export Buttons (PDF / DOCX) */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPDF}
              disabled={exportingType !== null}
              className="gap-1.5 text-xs h-9 border-brand/30 hover:border-brand hover:bg-brand/5 text-foreground shadow-2xs"
              title="Download Resume as PDF"
            >
              {exportingType === "pdf" ? (
                <Icon name="Loader2" className="w-3.5 h-3.5 animate-spin text-brand" />
              ) : (
                <Icon name="FileDown" className="w-3.5 h-3.5 text-red-500" />
              )}
              Download PDF
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadDOCX}
              disabled={exportingType !== null}
              className="gap-1.5 text-xs h-9 border-brand/30 hover:border-brand hover:bg-brand/5 text-foreground shadow-2xs"
              title="Download Resume as Word Document (DOCX)"
            >
              {exportingType === "docx" ? (
                <Icon name="Loader2" className="w-3.5 h-3.5 animate-spin text-brand" />
              ) : (
                <Icon name="FileText" className="w-3.5 h-3.5 text-blue-500" />
              )}
              Download DOCX
            </Button>

            <Button
              size="sm"
              onClick={() => {
                setActiveResume(currentResume.id);
                setView("optimizer");
              }}
              className="bg-brand hover:bg-brand-dark text-white gap-1.5 text-xs h-9 shadow-2xs"
            >
              <Icon name="Wand2" className="w-3.5 h-3.5" />
              Auto-Optimize
            </Button>
          </div>
        </div>

        {/* Source Resume & Target JD Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 mt-1 border-t border-border/40">
          {/* Source Resume Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground shrink-0 flex items-center gap-1">
              <Icon name="FileText" className="w-3.5 h-3.5 text-brand" /> Resume:
            </span>
            <Select
              value={selectedResumeId}
              onValueChange={(val) => {
                setSelectedResumeId(val);
                setActiveResume(val);
              }}
            >
              <SelectTrigger className="w-full h-8 text-xs bg-card">
                <SelectValue placeholder="Select resume" />
              </SelectTrigger>
              <SelectContent>
                {resumes.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.title || r.name} ({r.experience?.length || 0} exp)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Target JD Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground shrink-0 flex items-center gap-1">
              <Icon name="Target" className="w-3.5 h-3.5 text-emerald-500" /> Target Job:
            </span>
            <div className="flex-1 flex gap-1.5">
              <Select
                value={selectedJdId}
                onValueChange={(val) => {
                  setSelectedJdId(val);
                  if (val !== "custom") setActiveJD(val);
                }}
              >
                <SelectTrigger className="w-full h-8 text-xs bg-card">
                  <SelectValue placeholder="Select target job" />
                </SelectTrigger>
                <SelectContent>
                  {jds.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.title} {j.company ? `@ ${j.company}` : ""}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Paste Custom Job Description...</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCustomJdInput(!showCustomJdInput)}
                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
                title="Edit Target Job Text"
              >
                <Icon name={showCustomJdInput ? "ChevronUp" : "Edit3"} className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Collapsible Custom JD Editor */}
        <AnimatePresence>
          {showCustomJdInput && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="pt-3 space-y-2.5 overflow-hidden"
            >
              <div className="p-3.5 rounded-xl bg-card border border-border/80 space-y-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Paste Target Job Description</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleSaveCustomJd}
                    className="text-[11px] h-6 px-2 text-brand hover:text-brand-dark"
                  >
                    <Icon name="Save" className="w-3 h-3 mr-1" /> Save as JD
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Job Title (e.g. Lead Product Engineer)"
                    value={customJdTitle}
                    onChange={(e) => setCustomJdTitle(e.target.value)}
                    className="text-xs h-7"
                  />
                  <Input
                    placeholder="Company (optional)"
                    value={customJdCompany}
                    onChange={(e) => setCustomJdCompany(e.target.value)}
                    className="text-xs h-7"
                  />
                </div>
                <Textarea
                  placeholder="Paste the full job description text or requirements here..."
                  value={customJdText}
                  onChange={(e) => {
                    setCustomJdText(e.target.value);
                    if (selectedJdId !== "custom") setSelectedJdId("custom");
                  }}
                  rows={3}
                  className="text-xs font-mono"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-6">
        {/* Score Ring & Group Breakdown Cards */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Main Percentage Match Ring */}
          <div className="md:col-span-4 flex flex-col items-center justify-center p-4 rounded-2xl bg-muted/20 border border-border text-center">
            <ScoreRing value={score} size={132} strokeWidth={10} label="Match Score" />
            <div className={`mt-3 px-3 py-1 rounded-full text-xs font-bold border ${rating.bg} ${rating.color}`}>
              {rating.label}
            </div>
            <div className="text-[11px] text-muted-foreground mt-2">
              Based on {atsDashboard?.totalTerms || 0} extracted JD qualifications
            </div>
          </div>

          {/* Category Progress Meters */}
          <div className="md:col-span-8 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Competency Breakdown</span>
              <span>Matched / Total</span>
            </div>

            {(atsDashboard?.groups || []).map((grp) => {
              const barColor =
                grp.priority === "required"
                  ? "bg-red-500"
                  : grp.priority === "technology"
                  ? "bg-blue-500"
                  : grp.priority === "preferred"
                  ? "bg-purple-500"
                  : "bg-emerald-500";

              return (
                <div key={grp.priority} className="space-y-1.5 p-2.5 rounded-xl bg-card border border-border/60">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${barColor}`} />
                      {grp.label}
                    </span>
                    <span className="font-mono text-muted-foreground font-medium">
                      {grp.matched}/{grp.total} ({grp.percent}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${grp.percent}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                      className={`h-full rounded-full ${barColor}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Missing Keywords & Coverage Section */}
        <div className="space-y-3 pt-2 border-t border-border/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <Button
                variant={activeTab === "missing" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("missing")}
                className={`text-xs h-8 rounded-lg gap-1.5 ${
                  activeTab === "missing" ? "bg-brand text-white" : ""
                }`}
              >
                <Icon name="AlertTriangle" className="w-3.5 h-3.5 text-amber-500" />
                Missing Keywords
                <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0 h-4">
                  {atsDashboard?.missing.length || 0}
                </Badge>
              </Button>

              <Button
                variant={activeTab === "must-haves" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("must-haves")}
                className={`text-xs h-8 rounded-lg gap-1.5 ${
                  activeTab === "must-haves" ? "bg-brand text-white" : ""
                }`}
              >
                <Icon name="ShieldAlert" className="w-3.5 h-3.5 text-red-500" />
                Critical Must-Haves
                <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0 h-4">
                  {atsDashboard?.mustHaveMissing.length || 0}
                </Badge>
              </Button>

              <Button
                variant={activeTab === "matched" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("matched")}
                className={`text-xs h-8 rounded-lg gap-1.5 ${
                  activeTab === "matched" ? "bg-brand text-white" : ""
                }`}
              >
                <Icon name="CheckCircle2" className="w-3.5 h-3.5 text-emerald-500" />
                Matched Keywords
                <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0 h-4">
                  {atsDashboard?.matched.length || 0}
                </Badge>
              </Button>

              <Button
                variant={activeTab === "coverage" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("coverage")}
                className={`text-xs h-8 rounded-lg gap-1.5 ${
                  activeTab === "coverage" ? "bg-brand text-white" : ""
                }`}
              >
                <Icon name="Layers" className="w-3.5 h-3.5" />
                Section Placement
              </Button>
            </div>

            {atsDashboard && atsDashboard.missing.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyMissingKeywords}
                className="text-xs h-7 text-muted-foreground hover:text-foreground shrink-0 gap-1"
              >
                <Icon name="Copy" className="w-3 h-3" /> Copy Missing
              </Button>
            )}
          </div>

          {/* Tab 1: All Missing Keywords */}
          {activeTab === "missing" && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">
                Click any missing term to immediately add it to your resume skills list:
              </div>
              <div className="flex flex-wrap gap-2">
                {(atsDashboard?.missing || []).map((termMatch) => (
                  <button
                    key={termMatch.term}
                    type="button"
                    onClick={() => handleAddKeywordToResume(termMatch.term)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border border-amber-500/30 bg-amber-500/5 text-amber-900 dark:text-amber-200 hover:bg-amber-500/15 hover:border-amber-500/50 transition-all cursor-pointer group"
                    title={`Click to add "${termMatch.term}" to resume`}
                  >
                    <span>{termMatch.term}</span>
                    <Icon
                      name="Plus"
                      className="w-3 h-3 text-amber-600 dark:text-amber-400 group-hover:scale-125 transition-transform"
                    />
                  </button>
                ))}
                {(!atsDashboard || atsDashboard.missing.length === 0) && (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                    <Icon name="CheckCircle" className="w-4 h-4" />
                    Zero missing keywords detected! Your resume covers all extracted job requirements.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Critical Must-Haves Missing */}
          {activeTab === "must-haves" && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">
                High-priority gatekeeper skills. ATS filters reject applications missing these terms:
              </div>
              <div className="flex flex-wrap gap-2">
                {(atsDashboard?.mustHaveMissing || []).map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => handleAddKeywordToResume(term)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border border-red-500/30 bg-red-500/5 text-red-900 dark:text-red-200 hover:bg-red-500/15 hover:border-red-500/50 transition-all cursor-pointer group"
                    title={`Click to add "${term}" to resume`}
                  >
                    <Icon name="AlertCircle" className="w-3 h-3 text-red-500 shrink-0" />
                    <span>{term}</span>
                    <Icon
                      name="Plus"
                      className="w-3 h-3 text-red-600 dark:text-red-400 group-hover:scale-125 transition-transform"
                    />
                  </button>
                ))}
                {(!atsDashboard || atsDashboard.mustHaveMissing.length === 0) && (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                    <Icon name="CheckCircle" className="w-4 h-4" />
                    All critical must-have skills are present in your resume!
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: Matched Keywords */}
          {activeTab === "matched" && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">
                Verified terms successfully parsed from your resume sections:
              </div>
              <div className="flex flex-wrap gap-2">
                {(atsDashboard?.matched || []).map((termMatch) => (
                  <span
                    key={termMatch.term}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border border-emerald-500/30 bg-emerald-500/5 text-emerald-900 dark:text-emerald-200"
                  >
                    <Icon name="Check" className="w-3 h-3 text-emerald-500" />
                    <span>{termMatch.term}</span>
                    {termMatch.sections?.length > 0 && (
                      <span className="text-[9px] opacity-75 font-mono">
                        ({termMatch.sections.join(", ")})
                      </span>
                    )}
                  </span>
                ))}
                {(!atsDashboard || atsDashboard.matched.length === 0) && (
                  <div className="text-xs text-muted-foreground p-3">
                    No matching keywords identified yet. Check that your resume has populated experience and skills.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 4: Section Coverage */}
          {activeTab === "coverage" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {(atsDashboard?.sectionCoverage || []).map((sec) => (
                <div key={sec.section} className="p-3 rounded-xl bg-card border border-border space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">{sec.label}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">{sec.percent}%</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {sec.hits} keywords detected
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-brand rounded-full"
                      style={{ width: `${sec.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
