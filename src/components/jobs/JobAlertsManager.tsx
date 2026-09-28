"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Icon } from "@/components/shared";
import { useApp, uid } from "@/lib/store";
import {
  scanJobAlerts,
  getStoredAlertConfigs,
  saveStoredAlertConfigs,
  getStoredMatchedJobs,
  saveStoredMatchedJobs,
  type ScrapedJobPosting,
  type JobAlertConfig,
} from "@/lib/job-alerts-client";
import type { JobDescription, JobApplication } from "@/lib/types";
import { toast } from "sonner";

export function JobAlertsManager() {
  const resumes = useApp((s) => s.resumes);
  const activeResumeId = useApp((s) => s.activeResumeId);
  const addJD = useApp((s) => s.addJD);
  const setActiveJD = useApp((s) => s.setActiveJD);
  const addApplication = useApp((s) => s.addApplication);
  const setView = useApp((s) => s.setView);

  // Active resume for keywords & profile extraction
  const currentResume = useMemo(() => {
    return resumes.find((r) => r.id === activeResumeId) || resumes[0] || null;
  }, [resumes, activeResumeId]);

  // Derive initial values from active resume
  const initialRole = useMemo(() => {
    if (!currentResume) return "Senior Software Engineer";
    if (currentResume.headline && currentResume.headline.length < 50) return currentResume.headline;
    if (currentResume.experience?.[0]?.title) return currentResume.experience[0].title;
    return currentResume.title || "Senior Software Engineer";
  }, [currentResume]);

  const initialLocation = useMemo(() => {
    if (!currentResume) return "Remote";
    return currentResume.contact?.location || "Remote / Hybrid";
  }, [currentResume]);

  const initialKeywords = useMemo(() => {
    if (!currentResume?.skills) return ["TypeScript", "React", "System Architecture"];
    return currentResume.skills
      .map((s) => (typeof s === "string" ? s : s.name))
      .filter(Boolean)
      .slice(0, 6);
  }, [currentResume]);

  // Form states
  const [role, setRole] = useState(initialRole);
  const [location, setLocation] = useState(initialLocation);
  const [keywordInput, setKeywordInput] = useState(initialKeywords.join(", "));
  const [careerGoals, setCareerGoals] = useState(
    "Seeking high-impact senior engineering roles at fast-scaling companies with modern tech stacks, strong engineering culture, and competitive equity."
  );
  const [frequency, setFrequency] = useState<"instant" | "daily" | "weekly">("instant");

  // State for alerts and scraped jobs
  const [alerts, setAlerts] = useState<JobAlertConfig[]>([]);
  const [scrapedJobs, setScrapedJobs] = useState<ScrapedJobPosting[]>([]);
  const [scanning, setScanning] = useState(false);
  const [filterTab, setFilterTab] = useState<"all" | "high-match" | "remote">("all");
  const [groundedSources, setGroundedSources] = useState<Array<{ title: string; url: string }>>([]);

  // Load stored alerts & jobs on mount
  useEffect(() => {
    const savedAlerts = getStoredAlertConfigs();
    const savedJobs = getStoredMatchedJobs();

    if (savedAlerts.length > 0) {
      setAlerts(savedAlerts);
    } else {
      // Seed default alert based on current resume
      const defaultAlert: JobAlertConfig = {
        id: uid("alert"),
        role: initialRole,
        location: initialLocation,
        keywords: initialKeywords,
        careerGoals: "Accelerate career in top-tier organizations with competitive pay and growth path.",
        active: true,
        frequency: "instant",
        createdAt: new Date().toISOString(),
        unreadCount: 3,
      };
      setAlerts([defaultAlert]);
      saveStoredAlertConfigs([defaultAlert]);
    }

    if (savedJobs.length > 0) {
      setScrapedJobs(savedJobs);
    } else {
      // Trigger initial scan if no jobs yet
      handleScanJobs();
    }
  }, []);

  // Scan Google Search for live matching postings
  const handleScanJobs = async () => {
    setScanning(true);
    const keywordsList = keywordInput
      .split(/[,;\n]+/)
      .map((k) => k.trim())
      .filter(Boolean);

    try {
      const res = await scanJobAlerts({
        role: role.trim() || initialRole,
        location: location.trim() || "Remote",
        keywords: keywordsList.length > 0 ? keywordsList : initialKeywords,
        careerGoals: careerGoals.trim(),
      });

      if (res.ok && res.data?.jobs) {
        const markedJobs = res.data.jobs.map((j) => ({ ...j, isNew: true }));
        setScrapedJobs(markedJobs);
        saveStoredMatchedJobs(markedJobs);
        setGroundedSources(res.sources || []);

        // Update alert lastScannedAt
        setAlerts((prev) =>
          prev.map((a) => ({
            ...a,
            lastScannedAt: new Date().toISOString(),
            unreadCount: markedJobs.length,
          }))
        );

        toast.success(`Scraped ${markedJobs.length} live job postings matching your profile!`);
      } else {
        toast.error(res.error || "Could not complete job scan.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to scan for live job postings.");
    } finally {
      setScanning(false);
    }
  };

  // Create new persistent alert configuration
  const handleCreateAlert = () => {
    if (!role.trim()) {
      toast.error("Please provide a target role title.");
      return;
    }

    const keywordsList = keywordInput
      .split(/[,;\n]+/)
      .map((k) => k.trim())
      .filter(Boolean);

    const newAlert: JobAlertConfig = {
      id: uid("alert"),
      role: role.trim(),
      location: location.trim() || "Remote",
      keywords: keywordsList,
      careerGoals: careerGoals.trim(),
      active: true,
      frequency,
      createdAt: new Date().toISOString(),
      unreadCount: 0,
    };

    const next = [newAlert, ...alerts];
    setAlerts(next);
    saveStoredAlertConfigs(next);
    toast.success(`Job alert created for "${newAlert.role}"!`);
    handleScanJobs();
  };

  // Toggle alert active status
  const handleToggleAlert = (id: string) => {
    const next = alerts.map((a) => (a.id === id ? { ...a, active: !a.active } : a));
    setAlerts(next);
    saveStoredAlertConfigs(next);
  };

  // Remove alert
  const handleRemoveAlert = (id: string) => {
    const next = alerts.filter((a) => a.id !== id);
    setAlerts(next);
    saveStoredAlertConfigs(next);
    toast.success("Job alert removed.");
  };

  // 1-Click Action: Save scraped posting as structured Job Description (JD)
  const handleSaveAsJD = (job: ScrapedJobPosting) => {
    const newJd: JobDescription = {
      id: uid("jd"),
      title: job.title,
      company: job.company,
      rawText: `${job.title} at ${job.company} (${job.location})\n\n${job.summary}\n\nKey Requirements:\n${job.requirements.join("\n")}`,
      keywords: job.matchedKeywords.concat(job.missingKeywords || []),
      requiredSkills: job.matchedKeywords.slice(0, 5),
      technologies: job.matchedKeywords.slice(2, 6),
      preferredSkills: job.missingKeywords || [],
      createdAt: new Date().toISOString(),
      sourceUrl: job.url,
    };

    addJD(newJd);
    setActiveJD(newJd.id);
    toast.success(`Saved "${job.title}" to Job Descriptions! Ready for ATS Match.`);
  };

  // 1-Click Action: Add scraped posting to Application Tracker
  const handleTrackApplication = (job: ScrapedJobPosting) => {
    const newApp: JobApplication = {
      id: uid("app"),
      company: job.company,
      role: job.title,
      location: job.location,
      salary: job.salaryRange,
      status: "applied",
      appliedDate: new Date().toISOString().split("T")[0],
      source: job.source || "Google Search Scraper",
      jobUrl: job.url,
      notes: `Scraped via Job Alerts: ${job.whyItMatchesGoal}`,
      contacts: [],
      interviews: [],
      history: [
        {
          id: uid("hist"),
          date: new Date().toISOString(),
          status: "applied",
          note: "Found via Job Alerts Google Search scraper",
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addApplication(newApp);
    toast.success(`Added "${job.title} at ${job.company}" to Application Tracker!`);
  };

  // Filtered jobs
  const filteredJobs = useMemo(() => {
    return scrapedJobs.filter((j) => {
      if (filterTab === "high-match") return j.matchScore >= 90;
      if (filterTab === "remote") return j.remoteType?.toLowerCase().includes("remote");
      return true;
    });
  }, [scrapedJobs, filterTab]);

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white p-5 sm:p-7 relative overflow-hidden shadow-premium">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute -bottom-8 right-1/4 w-40 h-40 rounded-full bg-indigo-500/20 blur-2xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-blue-500/20 border-blue-400/30 text-blue-200">
                <Icon name="Bell" className="w-3.5 h-3.5 mr-1 text-blue-300" />
                Google Search Grounded Job Alerts
              </Badge>
              <Badge variant="outline" className="text-white/80 border-white/20">
                Real-Time Scraping Engine
              </Badge>
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold font-display tracking-tight">
              Job Alerts & Live Scraper
            </h2>
            <p className="text-sm text-slate-300 text-pretty">
              Get notified of newly opened positions matching your resume keywords, preferred locations, and career goals scraped directly via Google Search.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={handleScanJobs}
              disabled={scanning}
              className="bg-brand hover:bg-brand-dark text-white text-xs h-9 gap-2 shadow-sm"
            >
              {scanning ? (
                <>
                  <Icon name="Loader2" className="w-3.5 h-3.5 animate-spin" />
                  Scraping Google Search...
                </>
              ) : (
                <>
                  <Icon name="Search" className="w-3.5 h-3.5" />
                  Scan New Postings Now
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Alert Configuration Card */}
      <Card className="border border-border/80 shadow-premium">
        <CardHeader className="p-4 sm:p-6 pb-3 border-b border-border/60 bg-muted/20">
          <CardTitle className="text-base font-bold font-display flex items-center gap-2">
            <Icon name="Sliders" className="w-4 h-4 text-brand" />
            Job Alert Targeting & Profile Keywords
          </CardTitle>
          <CardDescription className="text-xs">
            Configures the scraping criteria used by the Google Search scraper to match live openings.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1">
                <Icon name="Briefcase" className="w-3.5 h-3.5 text-brand" /> Target Role
              </label>
              <Input
                placeholder="e.g. Senior Platform Engineer"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1">
                <Icon name="MapPin" className="w-3.5 h-3.5 text-emerald-500" /> Target Location
              </label>
              <Input
                placeholder="e.g. San Francisco, CA or Remote"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1">
                <Icon name="Clock" className="w-3.5 h-3.5 text-blue-500" /> Alert Frequency
              </label>
              <Select value={frequency} onValueChange={(v: any) => setFrequency(v)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="instant">Instant Real-Time Scrapes</SelectItem>
                  <SelectItem value="daily">Daily Digest</SelectItem>
                  <SelectItem value="weekly">Weekly Summary</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1">
                <Icon name="Tag" className="w-3.5 h-3.5 text-purple-500" /> Matching Profile Keywords
              </label>
              <Input
                placeholder="TypeScript, React, Next.js, System Design"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                className="text-xs h-9"
              />
              <span className="text-[10px] text-muted-foreground block">
                Comma-separated competencies automatically matched against scraped vacancies.
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1">
                <Icon name="Compass" className="w-3.5 h-3.5 text-gold" /> Career Goals & Preferences
              </label>
              <Input
                placeholder="e.g. High-growth product company with competitive compensation and autonomous culture"
                value={careerGoals}
                onChange={(e) => setCareerGoals(e.target.value)}
                className="text-xs h-9"
              />
              <span className="text-[10px] text-muted-foreground block">
                Used to evaluate whether scraped vacancies align with your aspirations.
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-muted-foreground">
              {alerts.length} active alert{alerts.length === 1 ? "" : "s"} monitoring Google Search
            </span>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCreateAlert}
                className="text-xs h-8 gap-1.5 border-brand/40 text-brand"
              >
                <Icon name="Plus" className="w-3.5 h-3.5" /> Save Alert Target
              </Button>

              <Button
                size="sm"
                onClick={handleScanJobs}
                disabled={scanning}
                className="bg-brand text-white text-xs h-8 gap-1.5"
              >
                <Icon name="RefreshCw" className={`w-3.5 h-3.5 ${scanning ? "animate-spin" : ""}`} />
                Scan Now
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scraped Job Openings Feed */}
      <div className="space-y-4">
        {/* Results Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Button
              variant={filterTab === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterTab("all")}
              className={`text-xs h-7 rounded-lg ${filterTab === "all" ? "bg-brand text-white" : ""}`}
            >
              All Matches ({scrapedJobs.length})
            </Button>
            <Button
              variant={filterTab === "high-match" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterTab("high-match")}
              className={`text-xs h-7 rounded-lg gap-1 ${
                filterTab === "high-match" ? "bg-brand text-white" : ""
              }`}
            >
              <Icon name="CheckCircle" className="w-3 h-3 text-emerald-500" />
              High Match 90%+
            </Button>
            <Button
              variant={filterTab === "remote" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterTab("remote")}
              className={`text-xs h-7 rounded-lg gap-1 ${
                filterTab === "remote" ? "bg-brand text-white" : ""
              }`}
            >
              <Icon name="Globe" className="w-3 h-3 text-blue-500" />
              Remote Only
            </Button>
          </div>

          <div className="text-xs text-muted-foreground">
            Scraped via Google Search Grounding · Live Vacancies
          </div>
        </div>

        {/* Job Cards */}
        <div className="space-y-3">
          {filteredJobs.map((job) => (
            <motion.div
              key={job.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 sm:p-5 rounded-2xl border border-border bg-card hover:border-brand/40 hover:shadow-premium transition-all space-y-3.5"
            >
              {/* Header row */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold font-display text-foreground">
                      {job.title}
                    </h3>
                    <Badge variant="secondary" className="font-semibold text-xs">
                      {job.company}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      {job.source}
                    </Badge>
                    {job.isNew && (
                      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
                        New Alert Match
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <Icon name="MapPin" className="w-3 h-3 text-brand" /> {job.location}
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Icon name="Briefcase" className="w-3 h-3 text-emerald-500" /> {job.remoteType}
                    </span>
                    <span>·</span>
                    <span className="font-mono text-foreground font-semibold">
                      {job.salaryRange}
                    </span>
                    <span>·</span>
                    <span>{job.postedTime}</span>
                  </div>
                </div>

                {/* Match Score Indicator */}
                <div className="flex items-center gap-3 shrink-0 self-start">
                  <div className="text-right">
                    <div className="text-xl font-bold font-display text-emerald-600 dark:text-emerald-400">
                      {job.matchScore}%
                    </div>
                    <span className="text-[10px] text-muted-foreground">Profile Match</span>
                  </div>
                </div>
              </div>

              {/* Summary Description */}
              <p className="text-xs text-muted-foreground leading-relaxed">
                {job.summary}
              </p>

              {/* Goal Alignment Banner */}
              {job.whyItMatchesGoal && (
                <div className="p-2.5 rounded-xl bg-blue-500/5 border border-blue-500/20 text-xs flex items-start gap-2 text-blue-950 dark:text-blue-200">
                  <Icon name="Sparkles" className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Career Goal Alignment: </span>
                    {job.whyItMatchesGoal}
                  </div>
                </div>
              )}

              {/* Matched Keywords Badges */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-1">
                  Matched Skills:
                </span>
                {job.matchedKeywords.map((kw, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium border border-emerald-500/20"
                  >
                    <Icon name="Check" className="w-2.5 h-2.5" /> {kw}
                  </span>
                ))}
                {job.missingKeywords && job.missingKeywords.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-muted/60 text-muted-foreground border border-border">
                    Missing: {job.missingKeywords.join(", ")}
                  </span>
                )}
              </div>

              {/* Action buttons: Apply, Save as JD, Track Application */}
              <div className="pt-2 border-t border-border/50 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSaveAsJD(job)}
                    className="text-xs h-8 gap-1.5 border-brand/30 text-brand hover:bg-brand/5"
                    title="Save this posting to compare in ATS Checker & Optimizer"
                  >
                    <Icon name="Target" className="w-3.5 h-3.5" /> Save to My JDs
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleTrackApplication(job)}
                    className="text-xs h-8 gap-1.5 text-foreground hover:bg-muted"
                    title="Track this job in the Application Tracker"
                  >
                    <Icon name="KanbanSquare" className="w-3.5 h-3.5 text-emerald-500" /> Track Job
                  </Button>
                </div>

                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand hover:bg-brand-dark text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  Apply on {job.source || "Careers Site"} <Icon name="ExternalLink" className="w-3 h-3" />
                </a>
              </div>
            </motion.div>
          ))}

          {filteredJobs.length === 0 && !scanning && (
            <div className="p-8 text-center rounded-2xl border border-dashed border-border bg-muted/10 space-y-2">
              <Icon name="Bell" className="w-10 h-10 text-muted-foreground/40 mx-auto" />
              <h4 className="font-semibold text-foreground text-sm">No Jobs Found Matching Criteria</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Try expanding your search keywords or adjust the target location.
              </p>
              <Button size="sm" onClick={handleScanJobs} className="bg-brand text-white text-xs mt-2">
                Retry Google Search Scan
              </Button>
            </div>
          )}
        </div>

        {/* Live Grounding Citations */}
        {groundedSources.length > 0 && (
          <div className="p-4 rounded-xl bg-muted/20 border border-border/60 space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Icon name="Globe" className="w-3 h-3 text-brand" />
              Google Search Grounding Scraper Sources ({groundedSources.length})
            </span>
            <div className="flex flex-wrap gap-2">
              {groundedSources.map((s, idx) => (
                <a
                  key={idx}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md bg-card border border-border text-foreground hover:text-brand transition-colors"
                >
                  <Icon name="ExternalLink" className="w-2.5 h-2.5 text-muted-foreground" />
                  <span className="truncate max-w-[220px]">{s.title}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
