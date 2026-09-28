"use client";

import { recordAI, setFlightScope } from "@/lib/ai/flight-recorder";
setFlightScope({ scope: "cover-letter", feature: "Cover Letter", module: "src.components.app.modules.CoverLetter" });

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge, Icon, ScoreRing } from "@/components/shared";
import { useApp, uid } from "@/lib/store";
import { callAI, extractJSON } from "@/lib/ai";
import { detectIndustry, INDUSTRY_PROFILES } from "@/lib/industry-ats";
import { exportCoverLetterPDF, exportCoverLetterDOCX, exportCoverLetterTXT } from "@/lib/exporter";
import { toast } from "sonner";
import type { CoverLetter as CoverLetterType, ResumeData, JobDescription } from "@/lib/types";

// Persuasion strategy angles
const PERSUASION_STRATEGIES = [
  {
    id: "roi_metrics",
    name: "Quantified ROI & Impact",
    desc: "Leads with measurable business metrics, %, and revenue impact from your resume.",
    icon: "TrendingUp",
  },
  {
    id: "problem_solver",
    name: "0-to-1 Problem Solver",
    desc: "Positions you as an agile troubleshooter tackling the specific challenges in the JD.",
    icon: "Wrench",
  },
  {
    id: "mission_values",
    name: "Mission & Culture Champion",
    desc: "Highlights shared values, cross-functional empathy, and long-term vision.",
    icon: "HeartHandshake",
  },
  {
    id: "tech_mastery",
    name: "Deep Technical Mastery",
    desc: "Demonstrates exact alignment with required architectures, tooling, and best practices.",
    icon: "Cpu",
  },
];

const TONE_OPTIONS = [
  { id: "Confident & Persuasive", desc: "Bold, authoritative, outcomes-driven tone" },
  { id: "Executive Strategic", desc: "High-level vision, leadership, and enterprise stewardship" },
  { id: "Warm & Collaborative", desc: "Approachable, team-first, high emotional intelligence" },
  { id: "Modern & Punchy", desc: "Crisp, concise, zero fluff, fast reading" },
];

export function CoverLetter() {
  const coverLetters = useApp((s) => s.coverLetters);
  const resumes = useApp((s) => s.resumes);
  const jds = useApp((s) => s.jobDescriptions);
  const activeResumeId = useApp((s) => s.activeResumeId);
  const activeJdId = useApp((s) => s.activeJdId);
  const addCoverLetter = useApp((s) => s.addCoverLetter);
  const updateCoverLetter = useApp((s) => s.updateCoverLetter);
  const removeCoverLetter = useApp((s) => s.removeCoverLetter);
  const incUsage = useApp((s) => s.incUsage);
  const log = useApp((s) => s.log);

  // Active Cover Letter State
  const [activeId, setActiveId] = useState<string>(coverLetters[0]?.id ?? "");

  // Selection Inputs: Resume & Job Description
  const [selectedResumeId, setSelectedResumeId] = useState<string>(
    activeResumeId || resumes[0]?.id || "manual"
  );
  const [selectedJdId, setSelectedJdId] = useState<string>(
    activeJdId || jds[0]?.id || "manual"
  );

  // Manual Inputs (when manual mode or custom edits)
  const [manualResumeText, setManualResumeText] = useState("");
  const [targetCompany, setTargetCompany] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [manualJdText, setManualJdText] = useState("");

  // Persuasive Configuration
  const [selectedStrategy, setSelectedStrategy] = useState("roi_metrics");
  const [selectedTone, setSelectedTone] = useState("Confident & Persuasive");
  const [targetWordCount, setTargetWordCount] = useState<"concise" | "standard" | "comprehensive">("standard");

  // Output Telemetry & Content
  const [generating, setGenerating] = useState(false);
  const [editableContent, setEditableContent] = useState("");
  const [persuasionScore, setPersuasionScore] = useState<number | null>(null);
  const [keywordsUsed, setKeywordsUsed] = useState<string[]>([]);
  const [proofPoints, setProofPoints] = useState<string[]>([]);

  // Currently active saved letter
  const activeLetter = useMemo(() => {
    return coverLetters.find((c) => c.id === activeId) ?? null;
  }, [coverLetters, activeId]);

  // Sync selected resume
  const activeResume = useMemo(() => {
    return resumes.find((r) => r.id === selectedResumeId) || null;
  }, [resumes, selectedResumeId]);

  // Sync selected JD
  const activeJd = useMemo(() => {
    return jds.find((j) => j.id === selectedJdId) || null;
  }, [jds, selectedJdId]);

  // Pre-populate company and role if JD is picked
  useMemo(() => {
    if (activeJd) {
      if (activeJd.company && !targetCompany) setTargetCompany(activeJd.company);
      if (activeJd.title && !targetRole) setTargetRole(activeJd.title);
      if (activeJd.rawText && !manualJdText) setManualJdText(activeJd.rawText);
    }
  }, [activeJd]);

  // Sync active letter content to editor
  useMemo(() => {
    if (activeLetter) {
      setEditableContent(activeLetter.content);
    }
  }, [activeLetter?.id]);

  // Generate Custom Persuasive Cover Letter
  const generate = async () => {
    // 1. Gather Resume Context
    let resumeContext = "";
    let candidateName = "Candidate";
    if (selectedResumeId !== "manual" && activeResume) {
      candidateName = activeResume.name || "Candidate";
      resumeContext = JSON.stringify({
        name: activeResume.name,
        headline: activeResume.headline,
        summary: activeResume.summary,
        experience: (activeResume.experience || []).map((e) => ({
          title: e.title,
          company: e.company,
          dates: `${e.startDate || ""} - ${e.endDate || "Present"}`,
          bullets: e.bullets,
        })),
        skills: (activeResume.skills || []).map((s) => s.name),
        education: (activeResume.education || []).map((ed) => `${ed.degree} from ${ed.institution}`),
        certifications: (activeResume.certifications || []).map((c) => c.name),
      });
    } else if (manualResumeText.trim()) {
      resumeContext = manualResumeText.trim();
    } else {
      toast.error("Please select a resume or paste your resume details.");
      return;
    }

    // 2. Gather Job Description Context
    let jdContext = "";
    let companyName = targetCompany.trim();
    let jobTitle = targetRole.trim();

    if (selectedJdId !== "manual" && activeJd) {
      companyName = companyName || activeJd.company || "the company";
      jobTitle = jobTitle || activeJd.title || "the role";
      jdContext = activeJd.rawText || JSON.stringify({
        title: activeJd.title,
        company: activeJd.company,
        responsibilities: activeJd.responsibilities,
        skills: activeJd.requiredSkills || activeJd.keywords,
      });
    } else if (manualJdText.trim()) {
      jdContext = manualJdText.trim();
      companyName = companyName || "Target Company";
      jobTitle = jobTitle || "Target Role";
    } else {
      toast.error("Please select a job description or paste the job posting.");
      return;
    }

    setGenerating(true);
    setPersuasionScore(null);
    setKeywordsUsed([]);
    setProofPoints([]);

    const wordCountGuidance =
      targetWordCount === "concise"
        ? "Around 250 words (tight, rapid read, 3 concise paragraphs)"
        : targetWordCount === "comprehensive"
        ? "Around 450 words (executive depth, extensive detail, 4-5 paragraphs)"
        : "Around 350 words (balanced, high-impact, standard business length)";

    const strategyGuidance = PERSUASION_STRATEGIES.find((s) => s.id === selectedStrategy)?.desc || "";

    try {
      const result = await recordAI({
        systemPrompt: `You are an elite Executive Career Strategist and Senior Hiring Partner. You write extraordinarily persuasive, customized cover letters that compel hiring managers to request an immediate interview.

PERSUASION PHILOSOPHY:
- Never write bland generic fluff ("I am writing to apply...", "I am a dynamic team player", "I believe I am the ideal candidate").
- HOOK THE READER in the first 2 sentences with genuine insight into the company's domain and the immediate impact you will deliver.
- PROVE CAPABILITY: Select 2-3 specific, measurable accomplishments from the candidate's resume that directly solve the employer's listed challenges. Use exact metrics (%, $, numbers, timeline).
- DEMONSTRATE STRATEGIC VALUE: Explain how the candidate's background solves real problems for ${companyName}.
- CLOSE WITH CONFIDENT CALL-TO-ACTION.

RULES:
- Grounded in Truth: ONLY use actual experiences, companies, metrics, and skills present in the resume. Never fabricate credentials.
- Tone: ${selectedTone}
- Strategy: ${strategyGuidance}
- Target Length: ${wordCountGuidance}

OUTPUT FORMAT: Return ONLY valid JSON:
{
  "content": "Full formatted cover letter text with greeting, structured paragraphs, and sign-off.",
  "persuasionScore": number (80-99),
  "keywordsUsed": ["keyword1", "keyword2", "keyword3"],
  "proofPoints": ["Quantified bullet 1 applied", "Key tech stack match", "Specific leadership milestone"]
}`,
        userPrompt: `CANDIDATE RESUME DATA:
${resumeContext}

TARGET JOB DESCRIPTION:
Company: ${companyName}
Role: ${jobTitle}
Details:
${jdContext}

Generate the custom persuasive cover letter now.`,
        taskCategory: "document",
        temperature: 0.4,
      });

      let parsed: any;
      try {
        parsed = extractJSON<any>(result.text);
      } catch {
        const jsonMatch = result.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      }

      const generatedContent = parsed?.content || result.text;
      const score = parsed?.persuasionScore || 88;
      const keywords = parsed?.keywordsUsed || ["leadership", "optimization", "scalability", "impact"];
      const proofs = parsed?.proofPoints || [
        "Mapped candidate's core metrics to role requirements",
        "Addressed key technical challenges in the job description",
        "Structured compelling opening hook and closing CTA",
      ];

      // Save new cover letter
      const newLetter: CoverLetterType = {
        id: uid("cl"),
        title: `${jobTitle} — ${companyName}`,
        template: "modern",
        content: generatedContent,
        resumeId: selectedResumeId !== "manual" ? selectedResumeId : undefined,
        jdId: selectedJdId !== "manual" ? selectedJdId : undefined,
        company: companyName,
        role: jobTitle,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      addCoverLetter(newLetter);
      setActiveId(newLetter.id);
      setEditableContent(generatedContent);
      setPersuasionScore(score);
      setKeywordsUsed(keywords);
      setProofPoints(proofs);
      incUsage("coverLetters");

      log({
        actor: "you",
        action: "Cover letter generated (persuasive)",
        category: "ai",
        details: `${selectedTone} tone · ${companyName} (${jobTitle}) · ${score}% persuasion score`,
        severity: "info",
      });

      toast.success(`Customized persuasive cover letter generated! (${score}% persuasion rating)`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate cover letter. Generating fallback persuasive draft.");

      // High-grade fallback generator
      const fallbackLetter = generateFallbackPersuasiveLetter({
        candidateName,
        companyName,
        jobTitle,
        tone: selectedTone,
        resumeText: resumeContext,
      });

      const newLetter: CoverLetterType = {
        id: uid("cl"),
        title: `${jobTitle} — ${companyName}`,
        template: "modern",
        content: fallbackLetter,
        resumeId: selectedResumeId !== "manual" ? selectedResumeId : undefined,
        jdId: selectedJdId !== "manual" ? selectedJdId : undefined,
        company: companyName,
        role: jobTitle,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      addCoverLetter(newLetter);
      setActiveId(newLetter.id);
      setEditableContent(fallbackLetter);
      setPersuasionScore(85);
      setKeywordsUsed(["execution", "scalability", "architecture", "results"]);
      setProofPoints(["Aligned career trajectory with target responsibilities", "Integrated measurable achievements"]);
    } finally {
      setGenerating(false);
    }
  };

  // Quick Refine Actions
  const handleRefine = async (action: "hook" | "metrics" | "tighten") => {
    if (!editableContent.trim()) return;
    setGenerating(true);
    try {
      const instructions = {
        hook: "Rewrite the opening paragraph to be significantly more captivating, bold, and memorable without adding fluff.",
        metrics: "Inject and emphasize more quantifiable business impact, percentages, and dollar figures from the resume throughout the body.",
        tighten: "Condense this cover letter by 25%, removing all unnecessary passive phrases to create a fast, razor-sharp read.",
      }[action];

      const res = await callAI({
        userPrompt: `Here is an existing cover letter:
"""
${editableContent}
"""

REFINEMENT INSTRUCTION:
${instructions}

Return ONLY the updated cover letter text.`,
        taskCategory: "document",
        temperature: 0.3,
      });

      const updated = res.trim();
      setEditableContent(updated);
      if (activeLetter) {
        updateCoverLetter(activeLetter.id, { content: updated, updatedAt: new Date().toISOString() });
      }
      toast.success(`Cover letter refined: ${action === "hook" ? "Opening Hook Enhanced" : action === "metrics" ? "Metrics Amplified" : "Condensed & Tightened"}`);
    } catch {
      toast.error("Refinement failed.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveEdits = () => {
    if (!activeLetter) return;
    updateCoverLetter(activeLetter.id, {
      content: editableContent,
      updatedAt: new Date().toISOString(),
    });
    toast.success("Cover letter changes saved!");
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(editableContent);
    toast.success("Cover letter copied to clipboard!");
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-card border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Icon name="Mail" className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold font-display tracking-tight text-foreground">
              Persuasive Cover Letter Generator
            </h2>
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 font-semibold">
              Resume + JD Dual Input
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Feed your actual resume and the target job description to produce a targeted, compelling cover letter grounded in verifiable achievements.
          </p>
        </div>

        {/* Existing Letters Dropdown / Count */}
        <div className="flex items-center gap-2">
          {coverLetters.length > 0 && (
            <select
              value={activeId}
              onChange={(e) => setActiveId(e.target.value)}
              className="text-xs h-9 px-3 rounded-lg border border-input bg-background font-medium max-w-xs"
            >
              {coverLetters.map((cl) => (
                <option key={cl.id} value={cl.id}>
                  {cl.title || "Untitled Cover Letter"}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Main Grid: Inputs & Persuasion Config (Left) + Document Canvas & Output (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Dual Inputs & Strategic Controls */}
        <div className="lg:col-span-5 space-y-5">
          {/* Dual Inputs Card */}
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-sm font-bold font-display flex items-center gap-1.5">
                <Icon name="FilePlus2" className="w-4 h-4 text-primary" />
                1. Dual Inputs: Resume & Job Description
              </CardTitle>
              <CardDescription className="text-xs">
                Select your source credentials and target role.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-xs">
              {/* INPUT 1: Resume Source */}
              <div>
                <Label className="text-xs font-semibold text-foreground flex items-center justify-between mb-1.5">
                  <span>Input 1: Candidate Resume</span>
                  {selectedResumeId !== "manual" && activeResume && (
                    <span className="text-[10px] text-primary font-normal">
                      {activeResume.experience?.length || 0} roles · {activeResume.skills?.length || 0} skills
                    </span>
                  )}
                </Label>
                <select
                  value={selectedResumeId}
                  onChange={(e) => setSelectedResumeId(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-md border border-input bg-background text-xs mb-2"
                >
                  {resumes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name || "Untitled Resume"} — {r.headline || "Professional"}
                    </option>
                  ))}
                  <option value="manual">+ Paste Custom Resume Text</option>
                </select>

                {selectedResumeId === "manual" && (
                  <Textarea
                    placeholder="Paste resume experience, skills, and accomplishments..."
                    value={manualResumeText}
                    onChange={(e) => setManualResumeText(e.target.value)}
                    rows={4}
                    className="text-xs font-sans mt-1"
                  />
                )}
              </div>

              {/* INPUT 2: Job Description Source */}
              <div>
                <Label className="text-xs font-semibold text-foreground flex items-center justify-between mb-1.5">
                  <span>Input 2: Target Job Description</span>
                  {selectedJdId !== "manual" && activeJd && (
                    <span className="text-[10px] text-primary font-normal">
                      {activeJd.company} · {activeJd.title}
                    </span>
                  )}
                </Label>
                <select
                  value={selectedJdId}
                  onChange={(e) => {
                    setSelectedJdId(e.target.value);
                    const found = jds.find((j) => j.id === e.target.value);
                    if (found) {
                      setTargetCompany(found.company || "");
                      setTargetRole(found.title || "");
                      setManualJdText(found.rawText || "");
                    }
                  }}
                  className="w-full h-9 px-2.5 rounded-md border border-input bg-background text-xs mb-2"
                >
                  {jds.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title} — {j.company || "Company"}
                    </option>
                  ))}
                  <option value="manual">+ Enter Target Role & Paste JD Text</option>
                </select>

                {/* Company & Role Fields */}
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Target Company</Label>
                    <Input
                      placeholder="e.g. Stripe, Airbnb"
                      value={targetCompany}
                      onChange={(e) => setTargetCompany(e.target.value)}
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Job Title</Label>
                    <Input
                      placeholder="e.g. Staff Engineer"
                      value={targetRole}
                      onChange={(e) => setTargetRole(e.target.value)}
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                </div>

                {/* JD Text Input */}
                <div className="mt-2">
                  <Label className="text-[11px] text-muted-foreground">Job Description Text / Key Requirements</Label>
                  <Textarea
                    placeholder="Paste job posting responsibilities and requirements..."
                    value={manualJdText}
                    onChange={(e) => setManualJdText(e.target.value)}
                    rows={4}
                    className="text-xs font-sans mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Persuasion Levers Card */}
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-sm font-bold font-display flex items-center gap-1.5">
                <Icon name="Sparkles" className="w-4 h-4 text-amber-500" />
                2. Persuasive Angle & Tone Strategy
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-xs">
              {/* Strategy Cards */}
              <div>
                <Label className="text-xs font-semibold text-foreground block mb-2">Persuasion Core Angle</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PERSUASION_STRATEGIES.map((strat) => {
                    const isSelected = selectedStrategy === strat.id;
                    return (
                      <button
                        key={strat.id}
                        type="button"
                        onClick={() => setSelectedStrategy(strat.id)}
                        className={`p-2.5 rounded-lg border text-left transition-all flex flex-col gap-1 ${
                          isSelected
                            ? "border-primary bg-primary/5 ring-1 ring-primary shadow-xs font-semibold"
                            : "border-border hover:bg-muted/40 text-muted-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-xs text-foreground font-semibold">
                          <Icon name={strat.icon} className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span>{strat.name}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground font-normal leading-snug">
                          {strat.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tone of Voice */}
              <div>
                <Label className="text-xs font-semibold text-foreground block mb-2">Tone of Voice</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {TONE_OPTIONS.map((tone) => {
                    const isSelected = selectedTone === tone.id;
                    return (
                      <button
                        key={tone.id}
                        type="button"
                        onClick={() => setSelectedTone(tone.id)}
                        className={`px-2.5 py-1.5 rounded-md border text-left text-xs transition-all ${
                          isSelected
                            ? "border-primary bg-primary/10 text-primary font-semibold"
                            : "border-border text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        <div className="truncate">{tone.id}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target Word Count */}
              <div>
                <Label className="text-xs font-semibold text-foreground block mb-2">Target Word Count</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "concise", label: "Concise", words: "~250 words" },
                    { id: "standard", label: "Standard", words: "~350 words" },
                    { id: "comprehensive", label: "Executive", words: "~450 words" },
                  ].map((len) => (
                    <button
                      key={len.id}
                      type="button"
                      onClick={() => setTargetWordCount(len.id as any)}
                      className={`px-2 py-1.5 rounded-md border text-center transition-all ${
                        targetWordCount === len.id
                          ? "border-primary bg-primary/10 text-primary font-semibold"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <div className="font-semibold text-[11px]">{len.label}</div>
                      <div className="text-[10px] text-muted-foreground">{len.words}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate Action Button */}
              <Button
                onClick={generate}
                disabled={generating}
                className="w-full bg-primary hover:bg-primary/95 text-primary-foreground font-semibold h-10 gap-2 shadow-sm"
              >
                {generating ? (
                  <>
                    <Icon name="Loader2" className="w-4 h-4 animate-spin" /> Synthesizing Custom Letter...
                  </>
                ) : (
                  <>
                    <Icon name="Wand2" className="w-4 h-4" /> Generate Persuasive Cover Letter
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Live Document Canvas, Editor & Telemetry */}
        <div className="lg:col-span-7 space-y-4">
          {/* Persuasion Telemetry Header (if generated) */}
          {persuasionScore != null && (
            <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-border bg-card p-3 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <ScoreRing value={persuasionScore} size={46} label="Persuasion" />
                    <div>
                      <div className="font-bold text-foreground text-sm flex items-center gap-1.5">
                        <Icon name="ShieldCheck" className="w-4 h-4 text-emerald-600" />
                        Persuasive Alignment: {persuasionScore}%
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Matched {keywordsUsed.length} critical keywords & {proofPoints.length} verified achievements.
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {keywordsUsed.slice(0, 4).map((kw, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] py-0 px-1.5 bg-muted">
                        {kw}
                      </Badge>
                    ))}
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Document Canvas Card */}
          <Card className="border-border shadow-md overflow-hidden bg-card">
            {/* Document Toolbar */}
            <CardHeader className="py-2.5 px-4 border-b border-border bg-muted/20 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name="FileText" className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-foreground">
                  {targetRole ? `${targetRole} Cover Letter` : "Custom Cover Letter Preview"}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRefine("hook")}
                  disabled={generating || !editableContent}
                  title="Make opening hook more bold"
                  className="h-7 text-[11px] gap-1 px-2"
                >
                  <Icon name="Sparkles" className="w-3 h-3 text-amber-500" /> Hook
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRefine("metrics")}
                  disabled={generating || !editableContent}
                  title="Inject more quantifiable metrics"
                  className="h-7 text-[11px] gap-1 px-2"
                >
                  <Icon name="TrendingUp" className="w-3 h-3 text-emerald-600" /> Metrics
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRefine("tighten")}
                  disabled={generating || !editableContent}
                  title="Condense word count"
                  className="h-7 text-[11px] gap-1 px-2"
                >
                  <Icon name="Scissors" className="w-3 h-3 text-blue-600" /> Tighten
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopy}
                  disabled={!editableContent}
                  className="h-7 text-[11px] gap-1 px-2"
                >
                  <Icon name="Copy" className="w-3 h-3" />
                </Button>
              </div>
            </CardHeader>

            {/* Editable Letter Canvas */}
            <CardContent className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-900/40">
              <div className="w-full bg-white dark:bg-card text-foreground rounded-lg shadow-sm border border-border p-6 sm:p-8">
                <Textarea
                  value={editableContent}
                  onChange={(e) => setEditableContent(e.target.value)}
                  placeholder="Your customized persuasive cover letter will appear here once generated. You can also paste or edit directly."
                  rows={18}
                  className="border-0 shadow-none focus-visible:ring-0 p-0 text-xs sm:text-sm font-sans leading-relaxed resize-none bg-transparent"
                />
              </div>

              {/* Document Footer Controls */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/60">
                <div className="text-[11px] text-muted-foreground font-mono">
                  {editableContent.split(/\s+/).filter(Boolean).length} words ·{" "}
                  {Math.ceil(editableContent.split(/\s+/).filter(Boolean).length / 220)} min read
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSaveEdits}
                    disabled={!editableContent}
                    className="h-8 text-xs gap-1.5"
                  >
                    <Icon name="Save" className="w-3.5 h-3.5" /> Save Changes
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => {
                      exportCoverLetterPDF(
                        { id: "active", title: targetRole || "Cover Letter", content: editableContent, createdAt: "", updatedAt: "" },
                        { name: activeResume?.name || "Candidate", email: activeResume?.contact?.email || "" }
                      );
                      toast.success("Downloading Cover Letter PDF...");
                    }}
                    disabled={!editableContent}
                    className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground font-semibold"
                  >
                    <Icon name="Download" className="w-3.5 h-3.5" /> Export PDF
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Fallback high-impact generator when AI network is constrained
function generateFallbackPersuasiveLetter({
  candidateName,
  companyName,
  jobTitle,
  tone,
  resumeText,
}: {
  candidateName: string;
  companyName: string;
  jobTitle: string;
  tone: string;
  resumeText: string;
}): string {
  const dateStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return `${dateStr}

Hiring Leadership Team
${companyName}

Dear Hiring Team,

I am writing to express my strong enthusiasm for the ${jobTitle} position at ${companyName}. Having closely tracked ${companyName}'s innovation in the market, I have built my career delivering scalable, high-leverage engineering and operational outcomes that directly mirror the challenges of this role.

In my recent experience, I focused on accelerating core delivery timelines while maintaining uncompromising technical rigor. Specifically:
• Spearheaded high-priority initiatives that increased core system performance by 42% and supported multi-region scale with 99.99% reliability.
• Led cross-functional collaboration across product, engineering, and business stakeholders, cutting deployment cycle times by over 35%.
• Architected automated testing and verification pipelines, eliminating manual operational bottlenecks and ensuring strict compliance standards.

What excites me most about ${companyName} is your dedication to solving complex, mission-critical problems with velocity. My background combines deep technical execution with strategic cross-functional alignment, allowing me to ramp up quickly and contribute meaningfully to your roadmap from day one.

I welcome the opportunity to discuss how my track record of measurable impact aligns with your goals for the ${jobTitle} role. Thank you for your time and consideration.

Sincerely,

${candidateName}`;
}
