"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon, Badge, ScoreRing } from "@/components/shared";
import { useApp } from "@/lib/store";
import { TEMPLATES } from "@/lib/brand";
import { dueFollowUps } from "@/lib/applications-logic";
import { ResumeStrengthGauge } from "./ResumeStrengthGauge";
import { ResumeTemplatesSection } from "@/components/dashboard/ResumeTemplatesSection";
import { ATSScoreboard } from "@/components/dashboard/ATSScoreboard";
import { SkillGapVisualGraph } from "@/components/dashboard/SkillGapVisualGraph";
import { ResumeHealthWidget } from "@/components/dashboard/ResumeHealthWidget";
import { LinkedInImportModal } from "@/components/resume/LinkedInImportModal";
import { downloadResumeAsPDF, downloadResumeAsDOCX } from "@/lib/dashboard-exporter";
import type { ResumeData } from "@/lib/types";

export function Dashboard() {
  const user = useApp((s) => s.user);
  const resumes = useApp((s) => s.resumes);
  const jds = useApp((s) => s.jobDescriptions);
  const coverLetters = useApp((s) => s.coverLetters);
  const interviews = useApp((s) => s.interviews);
  const atsReports = useApp((s) => s.atsReports);
  const applications = useApp((s) => s.applications);
  const setView = useApp((s) => s.setView);
  const setActiveResume = useApp((s) => s.setActiveResume);
  const providers = useApp((s) => s.providers);

  const latestReport = atsReports[0];
  const activeProviders = providers.filter((p) => p.isActive).length;
  const followUps = dueFollowUps(applications);

  const [downloading, setDownloading] = useState<{ id: string; format: "pdf" | "docx" } | null>(null);
  const [linkedinModalOpen, setLinkedinModalOpen] = useState(false);

  const handleDownloadResume = async (e: React.MouseEvent, resume: ResumeData, format: "pdf" | "docx") => {
    e.stopPropagation();
    setDownloading({ id: resume.id, format });
    if (format === "pdf") {
      await downloadResumeAsPDF(resume);
    } else {
      await downloadResumeAsDOCX(resume);
    }
    setDownloading(null);
  };

  const stats = [
    { label: "Resumes", value: resumes.length, icon: "FileText", color: "#1154A3", action: () => setView("resumes") },
    { label: "ATS checks", value: atsReports.length, icon: "ScanText", color: "#10B981", action: () => setView("ats-checker") },
    { label: "Applications", value: applications.length, icon: "KanbanSquare", color: "#0EA5E9", action: () => setView("app-tracker") },
    { label: "Cover letters", value: coverLetters.length, icon: "Mail", color: "#F59E0B", action: () => setView("cover-letter") },
    { label: "Interview preps", value: interviews.length, icon: "MessagesSquare", color: "#8B5CF6", action: () => setView("interview") },
  ];

  const quickActions = [
    { title: "Interview Simulator", desc: "Context-aware mock interview with Gemini.", icon: "Sparkles", color: "#8B5CF6", action: () => setView("interview-simulator") },
    { title: "Check ATS score", desc: "Upload your resume and get an instant ATS analysis.", icon: "ScanText", color: "#10B981", action: () => setView("ats-checker") },
    { title: "Build a new resume", desc: "Start from a template — fits one A4 page, guaranteed.", icon: "FilePlus2", color: "#1154A3", action: () => setView("builder") },
    { title: "Optimize for a job", desc: "Match your resume to a job description with AI.", icon: "Wand2", color: "#F59E0B", action: () => setView("optimizer") },
    { title: "Generate cover letter", desc: "Modern, traditional, executive, or email.", icon: "Mail", color: "#8B5CF6", action: () => setView("cover-letter") },
    { title: "Prep for interviews", desc: "Get STAR-method answers for your target role.", icon: "MessagesSquare", color: "#EC4899", action: () => setView("interview") },
    { title: "Live Job Alerts", desc: "Get notified of matching openings via Google Search.", icon: "Bell", color: "#10B981", action: () => setView("job-alerts") },
    { title: "Track applications", desc: "Organize your pipeline from wishlist to offer — with follow-up reminders.", icon: "KanbanSquare", color: "#0EA5E9", action: () => setView("app-tracker") },
    { title: "Scrape a job posting", desc: "Extract keywords from any URL.", icon: "Search", color: "#0EA5E9", action: () => setView("jd-scraper") },
  ];

  return (
    <div
      id="dashboard-root"
      className="space-y-4 sm:space-y-6 w-full max-w-full min-w-0 [container-type:inline-size] overflow-hidden"
      style={{ containerType: "inline-size" }}
    >
      {/* Welcome */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl gradient-brand text-white p-4 sm:p-6 md:p-8 relative overflow-hidden w-full max-w-full"
      >
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute bottom-0 right-0 w-60 h-60 rounded-full bg-gold/20 blur-3xl" />
        <div className="relative">
          <Badge variant="gold"><Icon name="Sparkles" className="w-3 h-3" /> {user?.role === "super_admin" ? "Super Admin" : user?.role === "admin" ? "Admin" : "Pro"} account</Badge>
          <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-bold mt-3">
            Welcome back, {user?.name?.split(" ")[0] || "Candidate"}.
          </h1>
          <p className="text-white/85 mt-1 max-w-xl text-pretty text-xs sm:text-sm">
            Your AI-powered career toolkit is ready. Pick a quick action below or jump into any module from the sidebar.
          </p>
          <div className="mt-4 sm:mt-5 flex flex-wrap gap-2">
            <Button onClick={() => setView("builder")} className="bg-white text-brand hover:bg-white/90 gap-2 w-full xs:w-auto sm:w-auto justify-center">
              <Icon name="FilePlus2" className="w-4 h-4 shrink-0" /> New resume
            </Button>
            <Button onClick={() => setView("ats-checker")} variant="outline" className="bg-transparent border-white/40 text-white hover:bg-white/10 hover:text-white gap-2 w-full xs:w-auto sm:w-auto justify-center">
              <Icon name="ScanText" className="w-4 h-4 shrink-0" /> Check ATS
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Follow-ups due — application tracker reminders */}
      {followUps.length > 0 && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setView("app-tracker")}
          className="w-full text-left rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3 hover:shadow-sm transition-shadow min-w-0 overflow-hidden"
        >
          <Icon name="BellRing" className="w-5 h-5 text-amber-600 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block text-xs sm:text-sm font-medium text-amber-900 dark:text-amber-200 truncate">
              {followUps.length} application follow-up{followUps.length > 1 ? "s" : ""} due
            </span>
            <span className="block text-[11px] sm:text-xs text-amber-800 dark:text-amber-300 truncate">
              Next up: {followUps[0].role || "Untitled role"} @ {followUps[0].company || "—"}
              {followUps.length > 1 ? ` · +${followUps.length - 1} more` : ""}
            </span>
          </span>
          <Icon name="ChevronRight" className="w-4 h-4 text-amber-600 ml-auto shrink-0" />
        </motion.button>
      )}

      {/* Fluid Stats Grid */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] sm:grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2.5 sm:gap-4 w-full">
        {stats.map((s, i) => (
          <motion.button
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={s.action}
            className="text-left w-full min-w-0"
          >
            <Card className="hover:shadow-premium hover:-translate-y-0.5 transition-all w-full h-full overflow-hidden">
              <CardContent className="p-3.5 sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${s.color}14`, color: s.color }}>
                    <Icon name={s.icon} className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <span className="text-xl sm:text-2xl font-bold font-display truncate">{s.value}</span>
                </div>
                <div className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-muted-foreground truncate">{s.label}</div>
              </CardContent>
            </Card>
          </motion.button>
        ))}
      </div>

      {/* Real-time Resume Strength Gauge */}
      <ResumeStrengthGauge onNavigate={(view) => setView(view as any)} />

      {/* Resume Health Score & Letter Grade Widget */}
      <ResumeHealthWidget />

      {/* ATS Scoreboard & Keyword Matcher */}
      <ATSScoreboard />

      {/* Top 10 Required Skills & Knowledge Gap Visual Graph */}
      <SkillGapVisualGraph />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 w-full max-w-full">
        {/* Quick actions */}
        <Card className="lg:col-span-2 w-full max-w-full overflow-hidden">
          <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg"><Icon name="Zap" className="w-4 h-4 text-gold shrink-0" /> Quick actions</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Jump into the most-used tools.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 w-full">
              {quickActions.map((a) => (
                <button
                  key={a.title}
                  onClick={a.action}
                  className="group text-left rounded-xl border border-border bg-card p-3 sm:p-4 hover:shadow-premium hover:-translate-y-0.5 transition-all w-full min-w-0 overflow-hidden"
                >
                  <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${a.color}14`, color: a.color }}>
                      <Icon name={a.icon} className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-xs sm:text-sm flex items-center gap-1 truncate">
                        <span className="truncate">{a.title}</span>
                        <Icon name="ArrowRight" className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition shrink-0" />
                      </div>
                      <div className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.desc}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Latest ATS + AI status */}
        <div className="space-y-4 sm:space-y-6 w-full max-w-full min-w-0">
          <Card className="w-full overflow-hidden">
            <CardHeader className="p-4 sm:p-6 pb-2">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg"><Icon name="Activity" className="w-4 h-4 text-brand shrink-0" /> Latest ATS report</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center p-4 sm:p-6 pt-2">
              {latestReport ? (
                <>
                  <ScoreRing value={latestReport.scores.ats} size={120} label="ATS Score" />
                  <div className="mt-3 text-xs text-muted-foreground text-center truncate w-full">
                    {latestReport.jdMatchPercent != null ? `${latestReport.jdMatchPercent}% JD match` : "No JD comparison"}
                  </div>
                  <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => setView("ats-checker")}>
                    View report
                  </Button>
                </>
              ) : (
                <div className="text-center py-4 w-full">
                  <Icon name="ScanText" className="w-10 h-10 text-muted-foreground/40 mx-auto" />
                  <p className="text-xs sm:text-sm text-muted-foreground mt-2">No reports yet</p>
                  <Button size="sm" className="mt-3 bg-brand hover:bg-brand-dark text-white w-full sm:w-auto" onClick={() => setView("ats-checker")}>
                    Run first check
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="w-full overflow-hidden">
            <CardHeader className="p-4 sm:p-6 pb-2">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg"><Icon name="Cpu" className="w-4 h-4 text-gold shrink-0" /> AI providers</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-2">
              <div className="text-xl sm:text-2xl font-bold font-display">{activeProviders} <span className="text-xs sm:text-sm font-normal text-muted-foreground">active</span></div>
              <div className="mt-3 space-y-1.5">
                {providers.slice(0, 3).map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-xs">
                    <span className="truncate pr-2">{p.name}</span>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${p.status === "healthy" ? "bg-emerald-500" : p.status === "degraded" ? "bg-amber-500" : "bg-red-500"}`} />
                  </div>
                ))}
              </div>
              <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => setView("ai-providers")}>
                Manage providers
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Resume Templates & Layout Styles Section */}
      <ResumeTemplatesSection />

      {/* Recent resumes with fluid responsive grid */}
      <Card className="w-full max-w-full overflow-hidden">
        <CardHeader className="p-4 sm:p-6 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg truncate"><Icon name="FileText" className="w-4 h-4 text-brand shrink-0" /> Your resumes</CardTitle>
              <CardDescription className="text-xs sm:text-sm">{resumes.length} total · {jds.length} job descriptions saved</CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLinkedinModalOpen(true)}
                className="gap-1.5 border-[#0A66C2]/40 text-[#0A66C2] hover:bg-[#0A66C2]/10 h-9 text-xs"
                title="Import profile data from LinkedIn to auto-fill resume builder sections"
              >
                <Icon name="Linkedin" className="w-3.5 h-3.5 text-[#0A66C2]" />
                <span className="hidden sm:inline">Import from</span> LinkedIn
              </Button>
              <Button size="sm" onClick={() => setView("builder")} className="bg-brand hover:bg-brand-dark text-white gap-2 h-9 text-xs">
                <Icon name="Plus" className="w-4 h-4" /> New
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3 sm:gap-4 w-full">
            {resumes.map((r) => {
              const template = TEMPLATES.find((t) => t.id === r.template);
              const isDownloadingPdf = downloading?.id === r.id && downloading?.format === "pdf";
              const isDownloadingDocx = downloading?.id === r.id && downloading?.format === "docx";

              return (
                <div
                  key={r.id}
                  className="group rounded-xl border border-border bg-card p-3.5 sm:p-4 hover:shadow-premium transition-all w-full min-w-0 overflow-hidden flex flex-col justify-between"
                >
                  <div
                    onClick={() => {
                      setActiveResume(r.id);
                      setView("builder");
                    }}
                    className="cursor-pointer space-y-1.5"
                  >
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <div
                        className="text-sm font-semibold truncate flex-1 hover:text-brand transition-colors"
                        title={r.title || r.name}
                      >
                        {r.title || r.name}
                      </div>
                      <Badge
                        variant={r.source === "ai-optimized" ? "brand" : r.source === "upload" ? "gold" : "outline"}
                        className="text-[10px] capitalize shrink-0"
                      >
                        {r.source === "ai-optimized" ? "Optimized" : r.source === "upload" ? "Uploaded" : (template?.name ?? r.template)}
                      </Badge>
                    </div>

                    {r.title && r.name && r.title !== r.name && (
                      <div className="text-xs text-muted-foreground truncate">{r.name}</div>
                    )}
                    {r.headline && <div className="text-xs text-muted-foreground truncate">{r.headline}</div>}

                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-1">
                      <span className="flex items-center gap-1">
                        <Icon name="Briefcase" className="w-3 h-3 shrink-0" /> {(r.experience || []).length} exp
                      </span>
                      <span className="flex items-center gap-1">
                        <Icon name="Wrench" className="w-3 h-3 shrink-0" /> {(r.skills || []).length} skills
                      </span>
                    </div>
                  </div>

                  {/* Action Bar: Edit in Builder + Direct PDF / DOCX Exports */}
                  <div className="mt-3.5 pt-2.5 border-t border-border/50 flex items-center justify-between gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveResume(r.id);
                        setView("builder");
                      }}
                      className="text-xs text-brand font-medium hover:underline flex items-center gap-1 shrink-0"
                    >
                      Edit <Icon name="ArrowRight" className="w-3 h-3 group-hover:translate-x-0.5 transition shrink-0" />
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={downloading !== null}
                        onClick={(e) => handleDownloadResume(e, r, "pdf")}
                        className="h-7 px-2 text-[11px] gap-1 hover:border-red-500/40 hover:bg-red-500/5 text-foreground"
                        title="Download as PDF"
                      >
                        {isDownloadingPdf ? (
                          <Icon name="Loader2" className="w-3 h-3 animate-spin text-red-500" />
                        ) : (
                          <Icon name="FileDown" className="w-3 h-3 text-red-500" />
                        )}
                        PDF
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        disabled={downloading !== null}
                        onClick={(e) => handleDownloadResume(e, r, "docx")}
                        className="h-7 px-2 text-[11px] gap-1 hover:border-blue-500/40 hover:bg-blue-500/5 text-foreground"
                        title="Download as Word DOCX"
                      >
                        {isDownloadingDocx ? (
                          <Icon name="Loader2" className="w-3 h-3 animate-spin text-blue-500" />
                        ) : (
                          <Icon name="FileText" className="w-3 h-3 text-blue-500" />
                        )}
                        DOCX
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
            {resumes.length === 0 && (
              <div className="col-span-full text-center py-8">
                <p className="text-sm text-muted-foreground">No resumes yet. Start with a template.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* LinkedIn Profile Auto-Fill Modal */}
      <LinkedInImportModal
        open={linkedinModalOpen}
        onOpenChange={setLinkedinModalOpen}
      />
    </div>
  );
}
