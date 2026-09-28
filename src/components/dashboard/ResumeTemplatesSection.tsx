"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Icon } from "@/components/shared";
import { useApp } from "@/lib/store";
import { TEMPLATES } from "@/lib/brand";
import { toast } from "sonner";
import type { ResumeTemplate, ResumeData } from "@/lib/types";

interface TemplateMeta {
  id: string;
  name: string;
  description: string;
  category: "ats" | "modern" | "executive" | "tech_creative";
  layoutType: "Single-Column" | "Two-Column (Sidebar)" | "Split Header" | "Grid Layout";
  fontFamily: string;
  atsScore: number;
  tags: string[];
  bestFor: string;
  accentColors: string[];
}

const EXTENDED_TEMPLATES: TemplateMeta[] = [
  {
    id: "ats-professional",
    name: "ATS Professional",
    description: "Standard single-column, clear section headers, 100% parse rate on Workday, Lever & Greenhouse.",
    category: "ats",
    layoutType: "Single-Column",
    fontFamily: "Inter / Calibri",
    atsScore: 100,
    tags: ["Top ATS Score", "Single-Column", "Universal"],
    bestFor: "Corporate, Fortune 500, Engineering, Finance",
    accentColors: ["#1154A3", "#0F172A", "#15803D", "#4338CA"],
  },
  {
    id: "modern",
    name: "Modern Sidebar",
    description: "Elegant two-column format with dedicated accent sidebar for contact, skills, and languages.",
    category: "modern",
    layoutType: "Two-Column (Sidebar)",
    fontFamily: "Inter / Sans-serif",
    atsScore: 94,
    tags: ["Two-Column", "Visual Accent", "Skills Heavy"],
    bestFor: "Product Managers, Marketers, Analysts, Tech",
    accentColors: ["#2563EB", "#0D9488", "#7C3AED", "#EA580C"],
  },
  {
    id: "executive",
    name: "Executive Leader",
    description: "Refined serif typography, stately header rule, prominent executive summary and board highlights.",
    category: "executive",
    layoutType: "Split Header",
    fontFamily: "Merriweather / Georgia",
    atsScore: 97,
    tags: ["Leadership", "Serif Elegant", "Board Ready"],
    bestFor: "VP, Director, C-Suite, Senior Partners, Legal",
    accentColors: ["#1E293B", "#78350F", "#831843", "#14532D"],
  },
  {
    id: "minimal",
    name: "Swiss Minimalist",
    description: "Maximum whitespace, ultra-sharp typography hierarchy, zero clutter, high aesthetic discipline.",
    category: "ats",
    layoutType: "Single-Column",
    fontFamily: "Helvetica / Inter",
    atsScore: 99,
    tags: ["Minimalist", "Ultra-Clean", "High Whitespace"],
    bestFor: "Architects, Designers, Writers, Researchers",
    accentColors: ["#18181B", "#3F3F46", "#0284C7", "#059669"],
  },
  {
    id: "compact",
    name: "Compact Density",
    description: "Tight 9.5pt structure with condensed margins — fits maximum accomplishments onto a single page.",
    category: "ats",
    layoutType: "Single-Column",
    fontFamily: "Roboto / Arial",
    atsScore: 98,
    tags: ["1-Page Guarantee", "Dense Content", "High ROI"],
    bestFor: "Extensive Experience, Mid-Career, Tech Roles",
    accentColors: ["#0F172A", "#0369A1", "#B45309", "#4D7C0F"],
  },
  {
    id: "corporate",
    name: "Corporate Classic",
    description: "Time-tested corporate structure with solid section lines, credentials block, and clean metrics.",
    category: "executive",
    layoutType: "Single-Column",
    fontFamily: "Garamond / Times",
    atsScore: 98,
    tags: ["Traditional", "Banking Ready", "Formal"],
    bestFor: "Investment Banking, Accounting, Operations, HR",
    accentColors: ["#1E3A8A", "#134E4A", "#312E81", "#701A75"],
  },
  {
    id: "tech",
    name: "Tech & Systems",
    description: "Developer-tailored format with monospace accents, categorized skills matrix, and GitHub projects.",
    category: "tech_creative",
    layoutType: "Grid Layout",
    fontFamily: "JetBrains Mono / Inter",
    atsScore: 96,
    tags: ["Monospace", "Tech Stack Grid", "GitHub Links"],
    bestFor: "Software Engineers, DevOps, Data Scientists, SREs",
    accentColors: ["#0284C7", "#059669", "#6366F1", "#D97706"],
  },
  {
    id: "creative",
    name: "Creative Studio",
    description: "Vibrant accent blocks, stylized skill pills, and contemporary typography for creative portfolios.",
    category: "tech_creative",
    layoutType: "Split Header",
    fontFamily: "Poppins / Inter",
    atsScore: 92,
    tags: ["Creative", "Portfolio", "Color Accent"],
    bestFor: "UI/UX Designers, Brand Strategists, Art Directors",
    accentColors: ["#EC4899", "#8B5CF6", "#F59E0B", "#10B981"],
  },
  {
    id: "consulting",
    name: "Strategy Consulting",
    description: "McKinsey/Bain case-style bullet points, quantified impact metrics, and client deliverables focus.",
    category: "executive",
    layoutType: "Single-Column",
    fontFamily: "Times New Roman / Inter",
    atsScore: 98,
    tags: ["Case Method", "Impact-First", "Quantified"],
    bestFor: "Management Consultants, Strategy Leads, Chiefs of Staff",
    accentColors: ["#0F172A", "#1E40AF", "#991B1B", "#166534"],
  },
  {
    id: "europass",
    name: "Europass International",
    description: "Standardized European format with structured language proficiency levels (CEFR) and contact grid.",
    category: "modern",
    layoutType: "Two-Column (Sidebar)",
    fontFamily: "Arial / Calibri",
    atsScore: 95,
    tags: ["European Standard", "CEFR Languages", "Global CV"],
    bestFor: "European Union, Multinationals, Academic Mobility",
    accentColors: ["#003399", "#047857", "#B91C1C", "#4338CA"],
  },
  {
    id: "startup",
    name: "Startup & Scaleup",
    description: "Modern punchy sans-serif, rapid growth milestones, and 0-to-1 builder achievements highlighted.",
    category: "modern",
    layoutType: "Split Header",
    fontFamily: "Plus Jakarta Sans",
    atsScore: 95,
    tags: ["0-to-1", "Fast Paced", "Metrics-Driven"],
    bestFor: "Early Stage Startups, Growth Engineers, Founders",
    accentColors: ["#6366F1", "#F97316", "#06B6D4", "#10B981"],
  },
  {
    id: "classic",
    name: "Classic Centered",
    description: "Balanced centered header, serif elegance, and timeless presentation favored by prestigious institutions.",
    category: "executive",
    layoutType: "Single-Column",
    fontFamily: "EB Garamond",
    atsScore: 97,
    tags: ["Timeless", "Centered Header", "Formal"],
    bestFor: "Government, Legal, Academia, Public Policy",
    accentColors: ["#1E293B", "#1E3A8A", "#78350F", "#4C1D95"],
  },
];

export function ResumeTemplatesSection() {
  const setView = useApp((s) => s.setView);
  const resumes = useApp((s) => s.resumes);
  const activeResumeId = useApp((s) => s.activeResumeId);
  const setActiveResume = useApp((s) => s.setActiveResume);
  const updateResume = useApp((s) => s.updateResume);
  const addResume = useApp((s) => s.addResume);

  const [activeCategory, setActiveCategory] = useState<"all" | "ats" | "modern" | "executive" | "tech_creative">("all");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("ats-professional");
  const [selectedColor, setSelectedColor] = useState<string>("#1154A3");
  const [previewTemplate, setPreviewTemplate] = useState<TemplateMeta | null>(null);

  const filteredTemplates = EXTENDED_TEMPLATES.filter((t) => {
    if (activeCategory === "all") return true;
    return t.category === activeCategory;
  });

  const activeTemplate = EXTENDED_TEMPLATES.find((t) => t.id === selectedTemplateId) || EXTENDED_TEMPLATES[0];

  // Action: Apply layout to an existing resume or create a fresh one
  const handleGenerateWithTemplate = (template: TemplateMeta, colorOverride?: string) => {
    const chosenColor = colorOverride || selectedColor;

    if (resumes.length > 0 && activeResumeId) {
      // Update active resume
      updateResume(activeResumeId, {
        template: template.id as ResumeTemplate,
        accentColor: chosenColor,
        updatedAt: new Date().toISOString(),
      });
      toast.success(`Switched to "${template.name}" layout! Opening Resume Builder...`);
      setView("builder");
    } else {
      // Create new resume with this template
      const newResumeId = "res_" + Math.random().toString(36).slice(2, 9);
      const newResume: ResumeData = {
        id: newResumeId,
        title: `${template.name} Resume`,
        name: "Alex Morgan",
        headline: "Senior Professional",
        summary: "Results-driven professional with expertise in delivering high-impact initiatives, optimizing operational workflows, and aligning cross-functional teams with strategic objectives.",
        template: template.id as ResumeTemplate,
        accentColor: chosenColor,
        experience: [
          {
            id: "exp_1",
            title: "Senior Lead Specialist",
            company: "Global Enterprise Corp",
            location: "New York, NY",
            period: "2022 - Present",
            current: true,
            bullets: [
              "Led cross-functional team of 12 specialists to deliver core platform modernization 3 weeks ahead of schedule.",
              "Increased operational efficiency by 34% by implementing automated verification pipelines and standardized telemetry.",
              "Managed $1.4M operational budget and reduced vendor processing costs by 22% annually.",
            ],
          },
          {
            id: "exp_2",
            title: "Operations & Systems Specialist",
            company: "Apex Solutions",
            location: "San Francisco, CA",
            period: "2019 - 2022",
            bullets: [
              "Streamlined client onboarding workflow, decreasing cycle time from 14 days to 4 days.",
              "Collaborated with executive leadership to establish quarterly KPI benchmarks and data governance standards.",
            ],
          },
        ],
        education: [
          {
            id: "edu_1",
            degree: "B.S. in Business Information Systems",
            school: "State University",
            year: "2019",
          },
        ],
        skills: ["Strategic Planning", "Project Management", "Process Optimization", "Cross-Functional Leadership", "Data Analysis", "Agile Execution"],
        source: "template",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      addResume(newResume);
      setActiveResume(newResumeId);
      toast.success(`Created new resume with "${template.name}"! Opening Builder...`);
      setView("builder");
    }
  };

  return (
    <Card className="w-full max-w-full overflow-hidden border border-border/80 shadow-premium">
      <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-4 border-b border-border/60 bg-muted/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-brand/10 text-brand">
                <Icon name="LayoutTemplate" className="w-4 h-4" />
              </span>
              <CardTitle className="text-base sm:text-lg font-bold font-display">
                Resume Templates & Layout Styles
              </CardTitle>
            </div>
            <CardDescription className="text-xs sm:text-sm mt-1">
              Select from battle-tested visual styles and structural layouts designed to pass ATS filters and impress human hiring managers.
            </CardDescription>
          </div>

          {/* Quick Category Filters & Layout Studio Link */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setView("templates")}
              className="text-xs h-8 rounded-lg shrink-0 gap-1.5 border-brand/40 text-brand hover:bg-brand/10"
            >
              <Icon name="Maximize2" className="w-3.5 h-3.5" />
              Open Layout Studio
            </Button>
            {[
              { id: "all", label: "All Styles" },
              { id: "ats", label: "ATS Clean" },
              { id: "modern", label: "Two-Column" },
              { id: "executive", label: "Executive & Classic" },
              { id: "tech_creative", label: "Tech & Creative" },
            ].map((cat) => (
              <Button
                key={cat.id}
                variant={activeCategory === cat.id ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveCategory(cat.id as any)}
                className={`text-xs h-8 rounded-lg shrink-0 ${
                  activeCategory === cat.id
                    ? "bg-brand text-white hover:bg-brand-dark"
                    : "hover:bg-muted"
                }`}
              >
                {cat.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-6">
        {/* Template Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTemplates.map((template) => {
            const isSelected = selectedTemplateId === template.id;

            return (
              <motion.div
                key={template.id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                className={`group relative rounded-2xl border transition-all cursor-pointer flex flex-col justify-between overflow-hidden bg-card ${
                  isSelected
                    ? "border-brand ring-2 ring-brand/20 shadow-md bg-brand/[0.02]"
                    : "border-border hover:border-brand/40 hover:shadow-sm"
                }`}
                onClick={() => {
                  setSelectedTemplateId(template.id);
                  setSelectedColor(template.accentColors[0]);
                }}
              >
                {/* Visual Thumbnail Representation */}
                <div className="p-4 pb-2 bg-muted/30 border-b border-border/50 relative">
                  <div className="w-full aspect-[4/3] rounded-lg bg-card border border-border p-2.5 flex flex-col justify-between shadow-xs overflow-hidden select-none">
                    {/* Wireframe header */}
                    {template.layoutType === "Two-Column (Sidebar)" ? (
                      <div className="flex gap-2 h-full">
                        {/* Left sidebar wireframe */}
                        <div
                          className="w-1/3 h-full rounded p-1 flex flex-col gap-1 text-[6px]"
                          style={{ backgroundColor: `${template.accentColors[0]}15` }}
                        >
                          <div
                            className="w-5 h-5 rounded-full mx-auto"
                            style={{ backgroundColor: template.accentColors[0] }}
                          />
                          <div className="w-full h-1 bg-current opacity-25 rounded mt-1" />
                          <div className="w-3/4 h-1 bg-current opacity-20 rounded" />
                          <div className="w-full h-1 bg-current opacity-15 rounded mt-auto" />
                        </div>
                        {/* Right content wireframe */}
                        <div className="w-2/3 flex flex-col gap-1.5 py-0.5">
                          <div
                            className="w-3/4 h-2 rounded"
                            style={{ backgroundColor: template.accentColors[0] }}
                          />
                          <div className="w-full h-1 bg-muted-foreground/30 rounded" />
                          <div className="space-y-1 mt-1">
                            <div className="w-full h-1 bg-muted-foreground/20 rounded" />
                            <div className="w-5/6 h-1 bg-muted-foreground/20 rounded" />
                            <div className="w-4/5 h-1 bg-muted-foreground/15 rounded" />
                          </div>
                        </div>
                      </div>
                    ) : template.layoutType === "Split Header" ? (
                      <div className="flex flex-col h-full gap-1.5">
                        <div className="flex justify-between items-start border-b border-border pb-1">
                          <div className="space-y-0.5">
                            <div
                              className="w-16 h-2 rounded"
                              style={{ backgroundColor: template.accentColors[0] }}
                            />
                            <div className="w-20 h-1 bg-muted-foreground/30 rounded" />
                          </div>
                          <div className="w-10 h-1 bg-muted-foreground/20 rounded" />
                        </div>
                        <div className="space-y-1">
                          <div className="w-full h-1 bg-muted-foreground/20 rounded" />
                          <div className="w-11/12 h-1 bg-muted-foreground/20 rounded" />
                          <div className="w-4/5 h-1 bg-muted-foreground/15 rounded" />
                        </div>
                      </div>
                    ) : (
                      // Single Column wireframe
                      <div className="flex flex-col h-full gap-1.5">
                        <div className="text-center space-y-0.5 border-b border-border pb-1">
                          <div
                            className="w-20 h-2 rounded mx-auto"
                            style={{ backgroundColor: template.accentColors[0] }}
                          />
                          <div className="w-24 h-1 bg-muted-foreground/30 rounded mx-auto" />
                        </div>
                        <div className="space-y-1">
                          <div className="w-12 h-1.5 rounded font-bold" style={{ backgroundColor: `${template.accentColors[0]}80` }} />
                          <div className="w-full h-1 bg-muted-foreground/20 rounded" />
                          <div className="w-11/12 h-1 bg-muted-foreground/20 rounded" />
                          <div className="w-4/5 h-1 bg-muted-foreground/15 rounded" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ATS Badge overlay */}
                  <div className="absolute top-6 right-6">
                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-emerald-500 text-white shadow-xs">
                      {template.atsScore}% ATS
                    </span>
                  </div>
                </div>

                {/* Body Details */}
                <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="font-semibold text-sm text-foreground group-hover:text-brand transition-colors">
                        {template.name}
                      </h4>
                      {isSelected && (
                        <Icon name="CheckCircle2" className="w-4 h-4 text-brand shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {template.description}
                    </p>
                  </div>

                  {/* Traits & Badges */}
                  <div className="space-y-2 pt-2 border-t border-border/40">
                    <div className="flex flex-wrap gap-1">
                      {template.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="text-[11px] text-muted-foreground">
                      <span className="font-medium text-foreground">Best for:</span> {template.bestFor}
                    </div>

                    {/* Color Swatches */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1.5">
                        {template.accentColors.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTemplateId(template.id);
                              setSelectedColor(color);
                            }}
                            className={`w-4 h-4 rounded-full transition-transform ${
                              isSelected && selectedColor === color
                                ? "ring-2 ring-offset-2 ring-brand scale-110"
                                : "hover:scale-110"
                            }`}
                            style={{ backgroundColor: color }}
                            title={`Select ${color}`}
                          />
                        ))}
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewTemplate(template);
                        }}
                        className="text-[11px] h-6 px-1.5 text-muted-foreground hover:text-foreground gap-1"
                      >
                        <Icon name="Eye" className="w-3 h-3" /> Preview
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="p-3 pt-0">
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGenerateWithTemplate(template);
                    }}
                    className={`w-full text-xs h-8 gap-1.5 ${
                      isSelected
                        ? "bg-brand text-white hover:bg-brand-dark"
                        : "bg-muted hover:bg-muted/80 text-foreground"
                    }`}
                  >
                    <Icon name="Wand2" className="w-3.5 h-3.5" />
                    {resumes.length > 0 ? "Apply to Resume" : "Generate Resume"}
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Selected Template Control Bar */}
        {activeTemplate && (
          <div className="rounded-xl border border-brand/20 bg-brand/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="text-xs font-semibold uppercase tracking-wider text-brand flex items-center gap-1.5">
                <Icon name="CheckCircle2" className="w-3.5 h-3.5" />
                Active Layout Selection: {activeTemplate.name}
              </div>
              <div className="text-xs text-muted-foreground">
                Structure: <strong className="text-foreground">{activeTemplate.layoutType}</strong> · Font: <strong className="text-foreground">{activeTemplate.fontFamily}</strong> · ATS Score: <strong className="text-emerald-600 dark:text-emerald-400">{activeTemplate.atsScore}%</strong>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewTemplate(activeTemplate)}
                className="gap-1.5 text-xs h-9"
              >
                <Icon name="Eye" className="w-3.5 h-3.5" /> Full Layout Spec
              </Button>
              <Button
                size="sm"
                onClick={() => handleGenerateWithTemplate(activeTemplate)}
                className="bg-brand text-white hover:bg-brand-dark gap-1.5 text-xs h-9 shadow-sm"
              >
                <Icon name="FilePlus2" className="w-3.5 h-3.5" />
                {resumes.length > 0 ? "Open Builder with this Layout" : "Create Resume from this Style"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Template Detail Preview Modal */}
      <Dialog open={Boolean(previewTemplate)} onOpenChange={(open) => !open && setPreviewTemplate(null)}>
        <DialogContent className="max-w-xl">
          {previewTemplate && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between pr-4">
                  <DialogTitle className="text-lg font-bold font-display flex items-center gap-2">
                    <Icon name="FileText" className="w-5 h-5 text-brand" />
                    {previewTemplate.name} Template Layout
                  </DialogTitle>
                  <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-emerald-500 text-white">
                    {previewTemplate.atsScore}% ATS Rated
                  </span>
                </div>
                <DialogDescription>
                  Detailed layout architecture and formatting parameters.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-2">
                  <div className="font-semibold text-foreground text-sm">
                    {previewTemplate.description}
                  </div>
                  <div className="text-muted-foreground">
                    Recommended for: <strong className="text-foreground">{previewTemplate.bestFor}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg border border-border bg-card space-y-1">
                    <div className="text-muted-foreground uppercase text-[10px] font-semibold">Layout Type</div>
                    <div className="font-medium text-foreground">{previewTemplate.layoutType}</div>
                  </div>
                  <div className="p-3 rounded-lg border border-border bg-card space-y-1">
                    <div className="text-muted-foreground uppercase text-[10px] font-semibold">Typography Family</div>
                    <div className="font-medium text-foreground">{previewTemplate.fontFamily}</div>
                  </div>
                  <div className="p-3 rounded-lg border border-border bg-card space-y-1">
                    <div className="text-muted-foreground uppercase text-[10px] font-semibold">Page Target</div>
                    <div className="font-medium text-foreground">Standard A4 / Single Page Auto-Fit</div>
                  </div>
                  <div className="p-3 rounded-lg border border-border bg-card space-y-1">
                    <div className="text-muted-foreground uppercase text-[10px] font-semibold">ATS Compatibility</div>
                    <div className="font-medium text-emerald-600 dark:text-emerald-400">Greenhouse, Lever, Workday Safe</div>
                  </div>
                </div>

                {/* Color Scheme Picker */}
                <div className="space-y-1.5 pt-1">
                  <div className="font-semibold text-foreground">Preset Accent Palettes:</div>
                  <div className="flex items-center gap-2">
                    {previewTemplate.accentColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSelectedColor(color)}
                        className={`w-6 h-6 rounded-full transition-all flex items-center justify-center ${
                          selectedColor === color ? "ring-2 ring-offset-2 ring-brand scale-110" : ""
                        }`}
                        style={{ backgroundColor: color }}
                      >
                        {selectedColor === color && (
                          <Icon name="Check" className="w-3 h-3 text-white" />
                        )}
                      </button>
                    ))}
                    <span className="text-muted-foreground text-[11px] ml-2 font-mono">{selectedColor}</span>
                  </div>
                </div>
              </div>

              <DialogFooter className="flex items-center justify-between gap-2 pt-2">
                <Button variant="outline" onClick={() => setPreviewTemplate(null)}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    handleGenerateWithTemplate(previewTemplate, selectedColor);
                    setPreviewTemplate(null);
                  }}
                  className="bg-brand text-white hover:bg-brand-dark gap-1.5"
                >
                  <Icon name="Wand2" className="w-4 h-4" />
                  Apply & Open Resume Builder
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
