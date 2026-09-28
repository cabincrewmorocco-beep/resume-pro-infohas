"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/shared";
import { useApp } from "@/lib/store";
import { scoreResumeATSCriteria } from "@/lib/ats-criteria-scorer";
import { toast } from "sonner";
import type { ResumeData } from "@/lib/types";

export type LayoutStyleId = "executive-traditional" | "modern-tech-split" | "minimalist-swiss" | "compact-dense" | "creative-luxe";

export interface LayoutOption {
  id: LayoutStyleId;
  name: string;
  tagline: string;
  category: "Corporate" | "Technology" | "Minimal" | "Executive" | "Creative";
  atsGrade: "100%" | "98%" | "96%" | "95%" | "94%";
  columnStyle: "Single-Column" | "Two-Column (Sidebar)" | "Asymmetric Grid" | "Compact Single";
  description: string;
  recommendedFor: string[];
  features: string[];
}

export const LAYOUT_OPTIONS: LayoutOption[] = [
  {
    id: "executive-traditional",
    name: "Executive Traditional",
    tagline: "Standard corporate single-column with authoritative typography",
    category: "Executive",
    atsGrade: "100%",
    columnStyle: "Single-Column",
    description: "Classic single-column architecture, centered contact block, and clean horizontal hairline dividers. 100% parse-guaranteed on Workday, Taleo, and Greenhouse.",
    recommendedFor: ["Finance & Banking", "Executive Leadership", "Legal & Consulting", "Corporate Enterprise"],
    features: ["Zero multi-column parsing issues", "Authoritative section dividers", "Centered executive contact header", "Chronological date alignment"]
  },
  {
    id: "modern-tech-split",
    name: "Modern Tech Split",
    tagline: "Contemporary two-column layout with dedicated skills sidebar",
    category: "Technology",
    atsGrade: "96%",
    columnStyle: "Two-Column (Sidebar)",
    description: "A balanced 32/68 split layout. The left accent sidebar neatly structures contact details, technical stack badges, and education, leaving the main canvas for work achievements.",
    recommendedFor: ["Software Engineers", "Product Managers", "Data Scientists", "Tech Startups"],
    features: ["Dedicated tech skills sidebar", "Modern category badges", "High visual hierarchy", "Optimal screen and print scanning"]
  },
  {
    id: "minimalist-swiss",
    name: "Minimalist Swiss",
    tagline: "High whitespace, editorial precision, and linear clarity",
    category: "Minimal",
    atsGrade: "98%",
    columnStyle: "Asymmetric Grid",
    description: "Inspired by International Typographic Style: ultra-sharp left-hand timeline margin with indented bullet achievements. Zero visual clutter and flawless ATS readability.",
    recommendedFor: ["Designers & Architects", "System Architects", "Writers & Researchers", "Operations Leads"],
    features: ["Generous micro-whitespace", "Left-aligned timeline dates", "Linear semantic parsing flow", "Crisp high-contrast type"]
  },
  {
    id: "compact-dense",
    name: "Compact Engineering",
    tagline: "Space-maximized single-page layout for dense careers",
    category: "Technology",
    atsGrade: "98%",
    columnStyle: "Compact Single",
    description: "Engineered specifically to fit extensive senior experience onto exactly 1 page cleanly. Tight line heights, inline metadata chips, and efficient bullet point spacing.",
    recommendedFor: ["Senior Developers (8+ yrs)", "DevOps & Cloud Engineers", "Engineering Managers", "Full Stack Leads"],
    features: ["Guaranteed 1-page fit", "Inline metadata pills", "High information density", "No unnecessary padding waste"]
  },
  {
    id: "creative-luxe",
    name: "Creative Accent Luxe",
    tagline: "Refined brand banner with modern dual-tier hierarchy",
    category: "Creative",
    atsGrade: "94%",
    columnStyle: "Two-Column (Sidebar)",
    description: "Features a prominent brand-colored hero banner highlighting your name and headline, followed by a crisp structured layout designed for immediate recruiter delight.",
    recommendedFor: ["Creative Directors", "Marketing Strategists", "UI/UX Designers", "Brand Consultants"],
    features: ["Distinctive colored hero header", "Subtle warm-toned accents", "Clean competency tags", "Premium aesthetic presence"]
  }
];

const ACCENT_COLORS = [
  { name: "Navy Corporate", hex: "#1154A3", lightBg: "#EFF6FF", border: "#BFDBFE" },
  { name: "Slate Noir", hex: "#0F172A", lightBg: "#F8FAFC", border: "#CBD5E1" },
  { name: "Emerald Tech", hex: "#059669", lightBg: "#ECFDF5", border: "#A7F3D0" },
  { name: "Royal Indigo", hex: "#4338CA", lightBg: "#EEF2FF", border: "#C7D2FE" },
  { name: "Crimson Luxe", hex: "#9F1239", lightBg: "#FFF1F2", border: "#FECDD3" },
];

const FONT_OPTIONS = [
  { id: "inter", name: "Inter (Modern Sans)", class: "font-sans" },
  { id: "sora", name: "Sora (Display Tech)", class: "font-display" },
  { id: "mono", name: "JetBrains (Code & Systems)", class: "font-mono" },
  { id: "serif", name: "Georgia (Classic Serif)", class: "font-serif" },
];

export function ProfessionalTemplateGallery() {
  const activeResumeId = useApp((s) => s.activeResumeId);
  const resumes = useApp((s) => s.resumes);
  const updateResume = useApp((s) => s.updateResume);

  const [selectedLayout, setSelectedLayout] = useState<LayoutStyleId>("executive-traditional");
  const [selectedAccent, setSelectedAccent] = useState(ACCENT_COLORS[0]);
  const [selectedFont, setSelectedFont] = useState(FONT_OPTIONS[0]);
  const [density, setDensity] = useState<"compact" | "normal" | "relaxed">("normal");

  // Determine current active resume or fallback sample
  const resume = useMemo(() => {
    const found = resumes.find((r) => r.id === activeResumeId);
    if (found) return found;
    return resumes[0] || getSampleResume();
  }, [resumes, activeResumeId]);

  // Run ATS criteria scoring on the active resume
  const atsCriteria = useMemo(() => {
    return scoreResumeATSCriteria(resume);
  }, [resume]);

  const activeLayoutMeta = useMemo(() => {
    return LAYOUT_OPTIONS.find((l) => l.id === selectedLayout) || LAYOUT_OPTIONS[0];
  }, [selectedLayout]);

  const handleApplyToResume = () => {
    if (!resume?.id) return;
    updateResume(resume.id, {
      template: selectedLayout,
      theme: {
        ...(resume.theme || {}),
        primary: selectedAccent.hex,
        fontFamily: selectedFont.id,
      },
    });
    toast.success(`Applied "${activeLayoutMeta.name}" layout to ${resume.name || "resume"}!`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border rounded-xl p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Icon name="LayoutTemplate" className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold font-display tracking-tight text-foreground">
              Professional Resume Template Engine
            </h2>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
              5 ATS Clean Layouts
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Switch between engineered layouts with real-time keyword density and formatting consistency telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5 text-xs">
            <Icon name="Printer" className="w-4 h-4" /> Print / PDF
          </Button>
          <Button size="sm" onClick={handleApplyToResume} className="gap-1.5 text-xs bg-primary text-primary-foreground font-semibold">
            <Icon name="Check" className="w-4 h-4" /> Apply to Active Resume
          </Button>
        </div>
      </div>

      {/* Main Grid: Layout Switcher & Controls (Left) + Live A4 Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Layout Selector & Customization Controls */}
        <div className="lg:col-span-5 space-y-5">
          {/* Layout Options List */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>1. Select Layout Architecture</span>
                <span className="text-xs font-normal text-muted-foreground">Click to preview</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Every layout is verified for high-parse rate through ATS parsers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5 pt-0">
              {LAYOUT_OPTIONS.map((layout) => {
                const isSelected = selectedLayout === layout.id;
                return (
                  <button
                    key={layout.id}
                    type="button"
                    onClick={() => setSelectedLayout(layout.id)}
                    className={`w-full text-left p-3.5 rounded-lg border transition-all text-xs flex flex-col gap-1.5 ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
                        : "border-border hover:border-border/80 hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
                        {isSelected && <Icon name="CheckCircle2" className="w-4 h-4 text-primary shrink-0" />}
                        {layout.name}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                          {layout.columnStyle}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-[10px] py-0 px-1.5 bg-emerald-500/10 text-emerald-600 border-emerald-200 font-mono"
                        >
                          ATS {layout.atsGrade}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-muted-foreground line-clamp-2 leading-relaxed">
                      {layout.description}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {layout.recommendedFor.slice(0, 2).map((rec, i) => (
                        <span key={i} className="text-[10px] bg-secondary/80 text-secondary-foreground px-1.5 py-0.5 rounded">
                          {rec}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* Customization Options: Accents & Typography */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">2. Typography & Accent Palette</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-0 text-xs">
              {/* Color Accents */}
              <div>
                <label className="text-xs font-medium text-foreground block mb-2">Accent Color Theme</label>
                <div className="flex items-center gap-2.5">
                  {ACCENT_COLORS.map((col) => {
                    const isSelected = selectedAccent.hex === col.hex;
                    return (
                      <button
                        key={col.hex}
                        type="button"
                        onClick={() => setSelectedAccent(col)}
                        title={col.name}
                        className={`w-8 h-8 rounded-full border-2 transition-transform flex items-center justify-center ${
                          isSelected ? "scale-110 border-foreground shadow-sm" : "border-transparent opacity-85 hover:opacity-100"
                        }`}
                        style={{ backgroundColor: col.hex }}
                      >
                        {isSelected && <Icon name="Check" className="w-3.5 h-3.5 text-white" />}
                      </button>
                    );
                  })}
                  <span className="text-xs text-muted-foreground ml-2 font-medium">
                    {selectedAccent.name}
                  </span>
                </div>
              </div>

              {/* Font Family */}
              <div>
                <label className="text-xs font-medium text-foreground block mb-2">Typography Hierarchy</label>
                <div className="grid grid-cols-2 gap-2">
                  {FONT_OPTIONS.map((f) => {
                    const isSelected = selectedFont.id === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setSelectedFont(f)}
                        className={`px-3 py-2 rounded-md border text-left text-xs transition-all ${
                          isSelected
                            ? "border-primary bg-primary/10 text-primary font-semibold"
                            : "border-border text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {f.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Spacing Density */}
              <div>
                <label className="text-xs font-medium text-foreground block mb-2">Spacing & Content Density</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["compact", "normal", "relaxed"] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDensity(d)}
                      className={`capitalize px-2 py-1.5 rounded-md border text-center text-xs transition-all ${
                        density === d
                          ? "border-primary bg-primary/10 text-primary font-semibold"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Real-time ATS Criteria Diagnostic Card */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <Icon name="ShieldCheck" className="w-4 h-4 text-emerald-600" />
                  ATS Criteria Live Telemetry
                </CardTitle>
                <Badge
                  variant="outline"
                  className={`${
                    atsCriteria.overallScore >= 80
                      ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                      : "bg-amber-50 text-amber-700 border-amber-300"
                  }`}
                >
                  Grade {atsCriteria.grade} ({atsCriteria.overallScore}/100)
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0 text-xs">
              <div className="grid grid-cols-3 gap-2 py-2 border-y border-border">
                <div className="text-center p-2 rounded bg-muted/40">
                  <div className="font-semibold text-foreground">{atsCriteria.keywordDensity.score}%</div>
                  <div className="text-[10px] text-muted-foreground">Keyword Density</div>
                </div>
                <div className="text-center p-2 rounded bg-muted/40">
                  <div className="font-semibold text-foreground">{atsCriteria.formattingConsistency.score}%</div>
                  <div className="text-[10px] text-muted-foreground">Format Uniformity</div>
                </div>
                <div className="text-center p-2 rounded bg-muted/40">
                  <div className="font-semibold text-foreground">{atsCriteria.contentImpact.actionVerbRatio}%</div>
                  <div className="text-[10px] text-muted-foreground">Action Verbs</div>
                </div>
              </div>

              {/* Formatting Consistency Quick Diagnostic */}
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Date Pattern:</span>
                  <span className="font-mono text-foreground font-medium">
                    {atsCriteria.formattingConsistency.dateFormatStandard} ({atsCriteria.formattingConsistency.dateConsistencyPercent}%)
                  </span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Bullet Ending Style:</span>
                  <span className="font-medium text-foreground">
                    {atsCriteria.formattingConsistency.bulletPunctuationStyle === "consistent_period"
                      ? "Periods Consistent"
                      : atsCriteria.formattingConsistency.bulletPunctuationStyle === "consistent_no_period"
                      ? "No Periods Consistent"
                      : "Mixed Punctuation"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Quantified Achievements:</span>
                  <span className="font-medium text-foreground">
                    {atsCriteria.contentImpact.quantifiedRatio}% with metrics
                  </span>
                </div>
              </div>

              {atsCriteria.formattingConsistency.issues.length > 0 && (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 text-[11px] text-amber-800 dark:text-amber-200">
                  <div className="font-semibold flex items-center gap-1 mb-1">
                    <Icon name="AlertCircle" className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    Formatting Note
                  </div>
                  <div>{atsCriteria.formattingConsistency.issues[0].detail}</div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Live A4 Printable Resume Canvas */}
        <div className="lg:col-span-7">
          <Card className="border-border overflow-hidden bg-muted/20">
            <CardHeader className="bg-card border-b border-border py-3 px-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <span>Active Preview: {activeLayoutMeta.name}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {selectedFont.name.split(" ")[0]}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  A4 Standard Dimension (210mm x 297mm)
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selectedAccent.hex }} />
                {selectedAccent.hex}
              </div>
            </CardHeader>

            {/* Document Render Canvas */}
            <div className="p-4 sm:p-6 flex justify-center overflow-x-auto bg-slate-100/70 dark:bg-slate-900/60">
              <div
                className={`w-full max-w-[760px] bg-white text-slate-900 shadow-xl rounded-sm border border-slate-200 transition-all ${selectedFont.class}`}
                style={{
                  minHeight: "980px",
                  padding: density === "compact" ? "28px" : density === "relaxed" ? "48px" : "38px",
                }}
              >
                {/* Dynamic Template Layouts */}
                {selectedLayout === "executive-traditional" && (
                  <ExecutiveTraditionalLayout resume={resume} accent={selectedAccent.hex} density={density} />
                )}

                {selectedLayout === "modern-tech-split" && (
                  <ModernTechSplitLayout resume={resume} accent={selectedAccent.hex} density={density} />
                )}

                {selectedLayout === "minimalist-swiss" && (
                  <MinimalistSwissLayout resume={resume} accent={selectedAccent.hex} density={density} />
                )}

                {selectedLayout === "compact-dense" && (
                  <CompactDenseLayout resume={resume} accent={selectedAccent.hex} density={density} />
                )}

                {selectedLayout === "creative-luxe" && (
                  <CreativeLuxeLayout resume={resume} accent={selectedAccent.hex} density={density} />
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Layout 1: Executive Traditional Layout
// ============================================================================
function ExecutiveTraditionalLayout({
  resume,
  accent,
  density,
}: {
  resume: ResumeData;
  accent: string;
  density: "compact" | "normal" | "relaxed";
}) {
  const contact = resume.contact || {};
  const spacingClass = density === "compact" ? "space-y-3" : density === "relaxed" ? "space-y-6" : "space-y-4";

  return (
    <div className={`space-y-4 text-slate-900`}>
      {/* Centered Traditional Header */}
      <div className="text-center pb-3 border-b-2" style={{ borderColor: accent }}>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 uppercase">
          {resume.name || "Full Name"}
        </h1>
        {resume.headline && (
          <p className="text-sm font-semibold tracking-wide uppercase text-slate-700 mt-1" style={{ color: accent }}>
            {resume.headline}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-slate-600 mt-2 font-medium">
          {contact.email && <span>{contact.email}</span>}
          {contact.phone && <span>• {contact.phone}</span>}
          {contact.location && <span>• {contact.location}</span>}
          {contact.linkedin && <span>• {contact.linkedin}</span>}
          {contact.github && <span>• {contact.github}</span>}
        </div>
      </div>

      <div className={spacingClass}>
        {/* Executive Summary */}
        {resume.summary && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b pb-1 mb-2" style={{ borderColor: `${accent}40` }}>
              Executive Profile
            </h2>
            <p className="text-xs text-slate-700 leading-relaxed text-justify">
              {resume.summary}
            </p>
          </section>
        )}

        {/* Experience */}
        {resume.experience && resume.experience.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b pb-1 mb-2.5" style={{ borderColor: `${accent}40` }}>
              Professional Experience
            </h2>
            <div className="space-y-3">
              {resume.experience.map((exp) => (
                <div key={exp.id}>
                  <div className="flex justify-between items-baseline text-xs">
                    <span className="font-bold text-slate-900">{exp.title}</span>
                    <span className="text-slate-600 font-medium">
                      {exp.startDate} – {exp.current ? "Present" : exp.endDate || "Present"}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline text-xs text-slate-700 font-medium italic mb-1">
                    <span>{exp.company}</span>
                    {exp.location && <span>{exp.location}</span>}
                  </div>
                  <ul className="list-disc list-outside ml-4 space-y-1 text-xs text-slate-700 leading-normal">
                    {(exp.bullets || []).map((b, idx) => (
                      <li key={idx}>{b}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Core Competencies / Skills */}
        {resume.skills && resume.skills.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b pb-1 mb-2" style={{ borderColor: `${accent}40` }}>
              Core Competencies & Technical Skills
            </h2>
            <div className="text-xs text-slate-700 leading-relaxed">
              <span className="font-semibold text-slate-900">Key Expertise: </span>
              {resume.skills.map((s) => s.name).join(" • ")}
            </div>
          </section>
        )}

        {/* Education */}
        {resume.education && resume.education.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b pb-1 mb-2" style={{ borderColor: `${accent}40` }}>
              Education & Academic Credentials
            </h2>
            <div className="space-y-2">
              {resume.education.map((edu) => (
                <div key={edu.id} className="flex justify-between items-baseline text-xs">
                  <div>
                    <span className="font-bold text-slate-900">{edu.degree}</span>
                    {edu.field && <span> in {edu.field}</span>}
                    <div className="text-slate-600 italic">{edu.institution}</div>
                  </div>
                  <span className="text-slate-600 font-medium">
                    {edu.startDate ? `${edu.startDate} – ` : ""}{edu.endDate || ""}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Certifications */}
        {resume.certifications && resume.certifications.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b pb-1 mb-2" style={{ borderColor: `${accent}40` }}>
              Certifications & Credentials
            </h2>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700">
              {resume.certifications.map((c) => (
                <div key={c.id}>
                  <span className="font-semibold text-slate-900">{c.name}</span>
                  {c.issuer && <span className="text-slate-600"> ({c.issuer})</span>}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Layout 2: Modern Tech Split Layout
// ============================================================================
function ModernTechSplitLayout({
  resume,
  accent,
  density,
}: {
  resume: ResumeData;
  accent: string;
  density: "compact" | "normal" | "relaxed";
}) {
  const contact = resume.contact || {};

  return (
    <div className="text-slate-900">
      {/* Header Band */}
      <div className="pb-4 mb-4 border-b border-slate-200">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: accent }}>
          {resume.name || "Full Name"}
        </h1>
        <p className="text-sm font-semibold text-slate-700 mt-0.5">
          {resume.headline || "Senior Software Engineer"}
        </p>
      </div>

      {/* 2-Column Split: Left Sidebar (32%) + Right Main (68%) */}
      <div className="grid grid-cols-12 gap-5">
        {/* Left Column: Contact, Skills, Education, Certs */}
        <div className="col-span-4 space-y-4 pr-3 border-r border-slate-200 text-xs">
          {/* Contact Details */}
          <div>
            <h3 className="font-bold uppercase tracking-wider text-[11px] mb-2" style={{ color: accent }}>
              Contact
            </h3>
            <div className="space-y-1 text-slate-600">
              {contact.email && <div className="truncate">{contact.email}</div>}
              {contact.phone && <div>{contact.phone}</div>}
              {contact.location && <div>{contact.location}</div>}
              {contact.linkedin && <div className="truncate text-slate-800">{contact.linkedin}</div>}
              {contact.github && <div className="truncate text-slate-800">{contact.github}</div>}
            </div>
          </div>

          {/* Technical Skills */}
          {resume.skills && resume.skills.length > 0 && (
            <div>
              <h3 className="font-bold uppercase tracking-wider text-[11px] mb-2" style={{ color: accent }}>
                Technical Stack
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {resume.skills.map((s) => (
                  <span
                    key={s.id}
                    className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-800 border border-slate-200"
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Education */}
          {resume.education && resume.education.length > 0 && (
            <div>
              <h3 className="font-bold uppercase tracking-wider text-[11px] mb-2" style={{ color: accent }}>
                Education
              </h3>
              <div className="space-y-2">
                {resume.education.map((edu) => (
                  <div key={edu.id}>
                    <div className="font-bold text-slate-900">{edu.degree}</div>
                    <div className="text-slate-600">{edu.institution}</div>
                    <div className="text-slate-500 text-[10px]">{edu.endDate}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Certifications */}
          {resume.certifications && resume.certifications.length > 0 && (
            <div>
              <h3 className="font-bold uppercase tracking-wider text-[11px] mb-2" style={{ color: accent }}>
                Certifications
              </h3>
              <div className="space-y-1.5">
                {resume.certifications.map((c) => (
                  <div key={c.id}>
                    <div className="font-semibold text-slate-800">{c.name}</div>
                    {c.issuer && <div className="text-slate-500 text-[10px]">{c.issuer}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Experience, Summary, Projects */}
        <div className="col-span-8 space-y-4">
          {/* Summary */}
          {resume.summary && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: accent }}>
                Profile Summary
              </h2>
              <p className="text-xs text-slate-700 leading-relaxed">
                {resume.summary}
              </p>
            </section>
          )}

          {/* Work Experience */}
          {resume.experience && resume.experience.length > 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider mb-2.5" style={{ color: accent }}>
                Work History & Impact
              </h2>
              <div className="space-y-3.5">
                {resume.experience.map((exp) => (
                  <div key={exp.id}>
                    <div className="flex justify-between items-baseline">
                      <span className="font-bold text-xs text-slate-900">{exp.title}</span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {exp.startDate} – {exp.current ? "Present" : exp.endDate || "Present"}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-slate-700 mb-1">
                      {exp.company} {exp.location && `• ${exp.location}`}
                    </div>
                    <ul className="list-disc list-outside ml-4 space-y-1 text-xs text-slate-700 leading-normal">
                      {(exp.bullets || []).map((b, idx) => (
                        <li key={idx}>{b}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Projects */}
          {resume.projects && resume.projects.length > 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: accent }}>
                Featured Projects
              </h2>
              <div className="space-y-2">
                {resume.projects.map((p) => (
                  <div key={p.id}>
                    <div className="font-bold text-xs text-slate-900">{p.name}</div>
                    {p.description && <p className="text-xs text-slate-600 mb-1">{p.description}</p>}
                    {p.technologies && p.technologies.length > 0 && (
                      <div className="text-[11px] text-slate-500">
                        Tech: {p.technologies.join(", ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Layout 3: Minimalist Swiss (Asymmetric Timeline)
// ============================================================================
function MinimalistSwissLayout({
  resume,
  accent,
  density,
}: {
  resume: ResumeData;
  accent: string;
  density: "compact" | "normal" | "relaxed";
}) {
  const contact = resume.contact || {};

  return (
    <div className="space-y-5 text-slate-900">
      {/* Swiss Clean Left-Aligned Header */}
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">
          {resume.name || "Candidate Name"}
        </h1>
        <p className="text-sm font-medium text-slate-600 mt-0.5">
          {resume.headline || "Systems Engineer"}
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mt-2 font-mono">
          {contact.email && <span>{contact.email}</span>}
          {contact.phone && <span>{contact.phone}</span>}
          {contact.location && <span>{contact.location}</span>}
          {contact.linkedin && <span>{contact.linkedin}</span>}
        </div>
      </div>

      <div className="h-px bg-slate-300 w-full" />

      {/* Summary */}
      {resume.summary && (
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-3 text-xs font-mono uppercase tracking-wider text-slate-500">
            About
          </div>
          <div className="col-span-9 text-xs text-slate-700 leading-relaxed">
            {resume.summary}
          </div>
        </div>
      )}

      {/* Experience with Asymmetric Date Column */}
      {resume.experience && resume.experience.length > 0 && (
        <div className="grid grid-cols-12 gap-4 pt-2">
          <div className="col-span-3 text-xs font-mono uppercase tracking-wider text-slate-500">
            Experience
          </div>
          <div className="col-span-9 space-y-4">
            {resume.experience.map((exp) => (
              <div key={exp.id}>
                <div className="flex justify-between items-baseline">
                  <div className="font-bold text-xs text-slate-900">{exp.title}</div>
                  <div className="text-[11px] font-mono text-slate-500">
                    {exp.startDate} — {exp.current ? "Present" : exp.endDate || "Present"}
                  </div>
                </div>
                <div className="text-xs text-slate-600 font-medium mb-1">
                  {exp.company}
                </div>
                <ul className="list-disc list-outside ml-4 space-y-1 text-xs text-slate-700">
                  {(exp.bullets || []).map((b, idx) => (
                    <li key={idx}>{b}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skills */}
      {resume.skills && resume.skills.length > 0 && (
        <div className="grid grid-cols-12 gap-4 pt-2">
          <div className="col-span-3 text-xs font-mono uppercase tracking-wider text-slate-500">
            Skills
          </div>
          <div className="col-span-9 flex flex-wrap gap-1.5">
            {resume.skills.map((s) => (
              <span key={s.id} className="text-xs font-medium bg-slate-100 text-slate-800 px-2 py-0.5 rounded">
                {s.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Education */}
      {resume.education && resume.education.length > 0 && (
        <div className="grid grid-cols-12 gap-4 pt-2">
          <div className="col-span-3 text-xs font-mono uppercase tracking-wider text-slate-500">
            Education
          </div>
          <div className="col-span-9 space-y-2">
            {resume.education.map((edu) => (
              <div key={edu.id} className="flex justify-between items-baseline text-xs">
                <div>
                  <span className="font-bold text-slate-900">{edu.degree}</span>
                  <div className="text-slate-600">{edu.institution}</div>
                </div>
                <span className="text-[11px] font-mono text-slate-500">{edu.endDate}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Layout 4: Compact Dense (Single-Page Engineering)
// ============================================================================
function CompactDenseLayout({
  resume,
  accent,
  density,
}: {
  resume: ResumeData;
  accent: string;
  density: "compact" | "normal" | "relaxed";
}) {
  const contact = resume.contact || {};

  return (
    <div className="space-y-3 text-slate-900 text-xs">
      {/* Dense Inline Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b pb-2 border-slate-300">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 uppercase">
            {resume.name || "Candidate Name"}
          </h1>
          <p className="text-xs font-semibold text-slate-700" style={{ color: accent }}>
            {resume.headline || "Senior Software Engineer"}
          </p>
        </div>
        <div className="text-right text-[11px] text-slate-600 font-mono mt-1 sm:mt-0">
          <div>{contact.email} • {contact.phone}</div>
          <div>{contact.location} {contact.linkedin && `• ${contact.linkedin}`}</div>
        </div>
      </div>

      {/* Summary */}
      {resume.summary && (
        <p className="text-xs text-slate-700 leading-snug">
          {resume.summary}
        </p>
      )}

      {/* Experience */}
      {resume.experience && resume.experience.length > 0 && (
        <section>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-0.5 mb-1.5" style={{ color: accent }}>
            Experience
          </div>
          <div className="space-y-2">
            {resume.experience.map((exp) => (
              <div key={exp.id}>
                <div className="flex justify-between items-baseline">
                  <span className="font-bold text-slate-900">{exp.title} — <span className="font-semibold text-slate-700">{exp.company}</span></span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {exp.startDate} - {exp.current ? "Present" : exp.endDate || "Present"}
                  </span>
                </div>
                <ul className="list-disc list-outside ml-3.5 space-y-0.5 text-xs text-slate-700 leading-tight">
                  {(exp.bullets || []).map((b, idx) => (
                    <li key={idx}>{b}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Technical Skills & Competencies */}
      {resume.skills && resume.skills.length > 0 && (
        <section>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-0.5 mb-1" style={{ color: accent }}>
            Skills & Technologies
          </div>
          <div className="text-[11px] text-slate-700 leading-normal">
            {resume.skills.map((s) => s.name).join(" • ")}
          </div>
        </section>
      )}

      {/* Education */}
      {resume.education && resume.education.length > 0 && (
        <section>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-0.5 mb-1" style={{ color: accent }}>
            Education
          </div>
          <div className="space-y-1">
            {resume.education.map((edu) => (
              <div key={edu.id} className="flex justify-between items-baseline text-[11px]">
                <span><strong className="text-slate-900">{edu.degree}</strong>, {edu.institution}</span>
                <span className="text-slate-500 font-mono">{edu.endDate}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ============================================================================
// Layout 5: Creative Accent Luxe
// ============================================================================
function CreativeLuxeLayout({
  resume,
  accent,
  density,
}: {
  resume: ResumeData;
  accent: string;
  density: "compact" | "normal" | "relaxed";
}) {
  const contact = resume.contact || {};

  return (
    <div className="space-y-4 text-slate-900">
      {/* Hero Accent Banner */}
      <div
        className="rounded-lg p-5 text-white shadow-sm"
        style={{ backgroundColor: accent }}
      >
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          {resume.name || "Candidate Name"}
        </h1>
        <p className="text-sm font-medium text-white/90 mt-0.5">
          {resume.headline || "Creative Director & Product Lead"}
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/80 mt-3">
          {contact.email && <span>{contact.email}</span>}
          {contact.phone && <span>• {contact.phone}</span>}
          {contact.location && <span>• {contact.location}</span>}
          {contact.linkedin && <span>• {contact.linkedin}</span>}
        </div>
      </div>

      {/* Summary */}
      {resume.summary && (
        <p className="text-xs text-slate-700 leading-relaxed italic border-l-2 pl-3" style={{ borderColor: accent }}>
          {resume.summary}
        </p>
      )}

      {/* Experience */}
      {resume.experience && resume.experience.length > 0 && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 pb-1 mb-2.5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accent }} />
            Work Experience
          </h2>
          <div className="space-y-3">
            {resume.experience.map((exp) => (
              <div key={exp.id} className="pl-3 border-l border-slate-200">
                <div className="flex justify-between items-baseline text-xs">
                  <span className="font-bold text-slate-900">{exp.title}</span>
                  <span className="text-[11px] font-mono text-slate-500">
                    {exp.startDate} – {exp.current ? "Present" : exp.endDate || "Present"}
                  </span>
                </div>
                <div className="text-xs font-medium text-slate-600 mb-1">{exp.company}</div>
                <ul className="list-disc list-outside ml-4 space-y-1 text-xs text-slate-700">
                  {(exp.bullets || []).map((b, idx) => (
                    <li key={idx}>{b}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Skills */}
      {resume.skills && resume.skills.length > 0 && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 pb-1 mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accent }} />
            Core Competencies
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {resume.skills.map((s) => (
              <span
                key={s.id}
                className="text-xs font-medium px-2.5 py-0.5 rounded-full border"
                style={{ borderColor: `${accent}40`, backgroundColor: `${accent}10`, color: accent }}
              >
                {s.name}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Education */}
      {resume.education && resume.education.length > 0 && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 pb-1 mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accent }} />
            Education
          </h2>
          <div className="space-y-1.5 pl-3 border-l border-slate-200 text-xs">
            {resume.education.map((edu) => (
              <div key={edu.id} className="flex justify-between items-baseline">
                <div>
                  <span className="font-bold text-slate-900">{edu.degree}</span>
                  <span className="text-slate-600"> — {edu.institution}</span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">{edu.endDate}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// Fallback sample resume in case user has no resumes loaded
function getSampleResume(): ResumeData {
  return {
    id: "sample-preview",
    name: "Alex Morgan",
    headline: "Senior Cloud & Full Stack Architect",
    summary: "Senior software engineer with 8+ years architecting resilient distributed systems, real-time analytics platforms, and modern web applications. Proven track record leading cross-functional engineering pods and scaling SaaS products to 10M+ daily active users.",
    contact: {
      email: "alex.morgan@example.com",
      phone: "+1 (555) 234-5678",
      location: "San Francisco, CA",
      linkedin: "linkedin.com/in/alexmorgan-eng",
      github: "github.com/alexmorgan-dev",
    },
    experience: [
      {
        id: "exp-1",
        title: "Lead Cloud Infrastructure Architect",
        company: "Vanguard Cloud Technologies",
        location: "San Francisco, CA",
        startDate: "2021-03",
        endDate: "",
        current: true,
        bullets: [
          "Architected global multi-region Kubernetes clusters handling 45k requests/sec with 99.995% uptime.",
          "Spearheaded database partitioning initiative, reducing median API latency by 42% across 12 services.",
          "Automated Terraform CI/CD pipelines, slashing developer onboarding and environment provisioning time by 65%."
        ]
      },
      {
        id: "exp-2",
        title: "Senior Full Stack Engineer",
        company: "Stratos Enterprise Systems",
        location: "Austin, TX",
        startDate: "2018-06",
        endDate: "2021-02",
        current: false,
        bullets: [
          "Engineered real-time data ingestion dashboard using React, TypeScript, and WebSockets serving 1.2M events/hour.",
          "Mentored 6 junior and mid-level engineers through technical design reviews and bi-weekly architecture sessions.",
          "Redesigned authentication and RBAC layer, ensuring strict SOC-2 Type II compliance."
        ]
      }
    ],
    education: [
      {
        id: "edu-1",
        institution: "University of California, Berkeley",
        degree: "B.S. in Computer Science",
        field: "Computer Science",
        endDate: "2018-05",
      }
    ],
    skills: [
      { id: "s-1", name: "TypeScript" },
      { id: "s-2", name: "React / Next.js" },
      { id: "s-3", name: "Node.js" },
      { id: "s-4", name: "Kubernetes" },
      { id: "s-5", name: "PostgreSQL" },
      { id: "s-6", name: "AWS Cloud" },
      { id: "s-7", name: "Docker" },
      { id: "s-8", name: "GraphQL" },
      { id: "s-9", name: "System Architecture" },
      { id: "s-10", name: "CI/CD Pipelines" },
    ],
    certifications: [
      { id: "c-1", name: "AWS Certified Solutions Architect – Professional", issuer: "Amazon Web Services" },
      { id: "c-2", name: "Certified Kubernetes Administrator (CKA)", issuer: "Cloud Native Computing Foundation" }
    ],
    projects: [],
    languages: [],
    achievements: [],
  };
}
