"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Icon } from "@/components/shared";
import { useApp } from "@/lib/store";
import { fetchMarketSalaryInsights, type SalaryInsightsData, type SalarySource } from "@/lib/salary-client";
import { toast } from "sonner";

export function MarketSalaryInsights() {
  const resumes = useApp((s) => s.resumes);
  const activeResumeId = useApp((s) => s.activeResumeId);
  const setActiveResume = useApp((s) => s.setActiveResume);
  const setView = useApp((s) => s.setView);

  // Resume selection state
  const [selectedResumeId, setSelectedResumeId] = useState<string>(
    activeResumeId || resumes[0]?.id || ""
  );

  // Resolved active resume
  const activeResume = useMemo(() => {
    return resumes.find((r) => r.id === selectedResumeId) || resumes[0] || null;
  }, [resumes, selectedResumeId]);

  // Derive initial values from resume
  const initialRole = useMemo(() => {
    if (!activeResume) return "Senior Software Engineer";
    if (activeResume.headline && activeResume.headline.length < 50) return activeResume.headline;
    if (activeResume.experience?.[0]?.title) return activeResume.experience[0].title;
    if (activeResume.title && !activeResume.title.toLowerCase().includes("resume")) return activeResume.title;
    return "Senior Software Engineer";
  }, [activeResume]);

  const initialLocation = useMemo(() => {
    if (!activeResume) return "San Francisco, CA";
    // Check contact location or experience location
    if (activeResume.contact?.location) return activeResume.contact.location;
    if (activeResume.experience?.[0]?.location) return activeResume.experience[0].location;
    return "United States / Remote";
  }, [activeResume]);

  const [role, setRole] = useState(initialRole);
  const [location, setLocation] = useState(initialLocation);
  const [experienceLevel, setExperienceLevel] = useState<string>("Senior");

  // Keep state in sync when selected resume changes
  useEffect(() => {
    if (activeResume) {
      setRole(initialRole);
      setLocation(initialLocation);
    }
  }, [activeResume, initialRole, initialLocation]);

  // Loading & Results
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<SalaryInsightsData | null>(null);
  const [sources, setSources] = useState<SalarySource[]>([]);
  const [searchQueries, setSearchQueries] = useState<string[]>([]);
  const [grounded, setGrounded] = useState<boolean>(true);

  // Auto-fetch on initial mount if not yet loaded
  useEffect(() => {
    if (!insights && role) {
      handleFetchInsights();
    }
  }, []);

  const handleFetchInsights = async () => {
    if (!role.trim()) {
      toast.error("Please enter a target job title.");
      return;
    }

    setLoading(true);
    try {
      const skillsList = (activeResume?.skills || [])
        .map((s) => (typeof s === "string" ? s : s.name || ""))
        .filter(Boolean)
        .slice(0, 10);

      const res = await fetchMarketSalaryInsights({
        role: role.trim(),
        location: location.trim() || "United States",
        experienceLevel,
        skills: skillsList,
      });

      if (res.ok && res.data) {
        setInsights(res.data);
        setSources(res.sources || []);
        setSearchQueries(res.searchQueries || []);
        setGrounded(Boolean(res.grounded));
        toast.success(`Retrieved market salary benchmarks for ${res.data.role}!`);
      } else {
        toast.error(res.error || "Could not retrieve salary benchmarks.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch market salary data.");
    } finally {
      setLoading(false);
    }
  };

  const currencySym = insights?.currencySymbol || "$";

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-900 text-white p-5 sm:p-7 relative overflow-hidden shadow-premium">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -bottom-8 right-1/3 w-40 h-40 rounded-full bg-teal-500/20 blur-2xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-emerald-500/20 border-emerald-400/30 text-emerald-200">
                <Icon name="Globe" className="w-3.5 h-3.5 mr-1 text-emerald-300" />
                Google Search Grounded
              </Badge>
              <Badge variant="outline" className="text-white/80 border-white/20">
                Live 2025/2026 Compensation Intelligence
              </Badge>
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold font-display tracking-tight">
              Market Salary Insights
            </h2>
            <p className="text-sm text-slate-300 text-pretty">
              Real-time compensation benchmarks and percentile ranges pulled via Google Search Grounding,
              synchronized with your resume target title and location.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              onClick={() => setView("app-tracker")}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs h-9 gap-1.5"
            >
              <Icon name="KanbanSquare" className="w-3.5 h-3.5" /> Application Tracker
            </Button>
          </div>
        </div>
      </div>

      {/* Query Parameters & Resume Sync Box */}
      <Card className="border border-border/80 shadow-premium">
        <CardHeader className="p-4 sm:p-6 pb-3 border-b border-border/60 bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold font-display flex items-center gap-2">
                <Icon name="Target" className="w-4 h-4 text-emerald-500" />
                Compensation Target Parameters
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Auto-populated from your uploaded resume. You can customize target role, location, or tier anytime.
              </CardDescription>
            </div>

            {/* Source Resume Picker */}
            {resumes.length > 0 && (
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground font-medium">Source Resume:</span>
                <Select
                  value={selectedResumeId}
                  onValueChange={(val) => {
                    setSelectedResumeId(val);
                    setActiveResume(val);
                  }}
                >
                  <SelectTrigger className="h-8 text-xs bg-card w-48">
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
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Icon name="Briefcase" className="w-3.5 h-3.5 text-emerald-500" />
                Target Job Title
              </label>
              <Input
                placeholder="e.g. Senior Fullstack Engineer"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Icon name="MapPin" className="w-3.5 h-3.5 text-blue-500" />
                Target Location
              </label>
              <Input
                placeholder="e.g. San Francisco, CA / London / Remote"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Icon name="Award" className="w-3.5 h-3.5 text-purple-500" />
                Seniority Tier
              </label>
              <Select value={experienceLevel} onValueChange={setExperienceLevel}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Entry Level">Entry Level (0-2 yrs)</SelectItem>
                  <SelectItem value="Mid-Level">Mid-Level (3-5 yrs)</SelectItem>
                  <SelectItem value="Senior">Senior (6-8 yrs)</SelectItem>
                  <SelectItem value="Lead / Staff">Lead / Staff (9+ yrs)</SelectItem>
                  <SelectItem value="Director / Executive">Director / Executive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Icon name="Search" className="w-3 h-3 text-emerald-500" />
              Queries live Google Search index for recent salary reports
            </div>

            <Button
              onClick={handleFetchInsights}
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 text-xs h-9 px-5 shadow-sm"
            >
              {loading ? (
                <>
                  <Icon name="Loader2" className="w-3.5 h-3.5 animate-spin" />
                  Grounding via Google Search...
                </>
              ) : (
                <>
                  <Icon name="Sparkles" className="w-3.5 h-3.5" />
                  Update Market Salary Data
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Salary Results Visual Dashboard */}
      {insights && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Main Benchmark Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Median Base Card */}
            <Card className="p-4 sm:p-5 border border-emerald-500/30 bg-emerald-500/5 space-y-2">
              <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center justify-between">
                <span>Median Base Salary</span>
                <Badge variant="outline" className="text-[10px] border-emerald-500/30">
                  {insights.payPeriod}
                </Badge>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold font-display text-emerald-700 dark:text-emerald-300">
                {currencySym}{insights.baseSalary.median.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">
                Middle 50th percentile market anchor for {insights.role} in {insights.location}.
              </div>
            </Card>

            {/* Total Compensation Card */}
            <Card className="p-4 sm:p-5 border border-border space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span>Total Compensation (OTE)</span>
                <Badge variant="secondary" className="text-[10px]">
                  Base + Bonus + Equity
                </Badge>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold font-display text-foreground">
                {currencySym}{insights.totalCompensation.median.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <span>Bonus: ~{insights.totalCompensation.typicalBonusPct}%</span>
                <span>·</span>
                <span className="truncate">{insights.totalCompensation.typicalEquity}</span>
              </div>
            </Card>

            {/* Market Demand & Status Card */}
            <Card className="p-4 sm:p-5 border border-border space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span>Hiring Demand</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl sm:text-2xl font-bold font-display text-foreground">
                  {insights.marketDemand} Demand
                </span>
              </div>
              <div className="text-xs text-muted-foreground line-clamp-2">
                {insights.marketSummary || "Competitive talent market with high velocity for verified skills."}
              </div>
            </Card>
          </div>

          {/* Interactive Base Salary Percentile Range Visual Meter */}
          <Card className="border border-border/80 p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-0.5">
                <h3 className="font-bold text-base font-display text-foreground flex items-center gap-2">
                  <Icon name="BarChart3" className="w-4 h-4 text-emerald-500" />
                  Base Salary Distribution Percentiles
                </h3>
                <p className="text-xs text-muted-foreground">
                  Compare entry vs top-tier compensation brackets for {insights.role} in {insights.location}.
                </p>
              </div>
              <div className="text-xs font-mono text-muted-foreground">
                25th% → 90th% Range
              </div>
            </div>

            {/* Visual Percentile Gradient Bar */}
            <div className="space-y-2 pt-2">
              <div className="relative h-6 w-full rounded-xl bg-gradient-to-r from-blue-500/20 via-emerald-500/30 to-purple-500/30 border border-border overflow-hidden">
                {/* 25th to 75th percentile highlight block */}
                <div className="absolute inset-y-0 left-[25%] right-[25%] bg-emerald-500/20 border-x border-emerald-500/40" />
                {/* Median Line Indicator */}
                <div className="absolute inset-y-0 left-[50%] w-0.5 bg-emerald-600 dark:bg-emerald-400 shadow-sm" />
              </div>

              {/* Percentile Labels Grid */}
              <div className="grid grid-cols-4 gap-2 text-center text-xs pt-1">
                <div className="p-2 rounded-lg bg-card border border-border">
                  <span className="text-[10px] text-muted-foreground uppercase block font-semibold">25th Percentile</span>
                  <span className="font-bold text-foreground text-sm">
                    {currencySym}{insights.baseSalary.p25.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-muted-foreground block">Starting band</span>
                </div>

                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase block font-semibold">50th (Median)</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-300 text-sm">
                    {currencySym}{insights.baseSalary.median.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-muted-foreground block">Market average</span>
                </div>

                <div className="p-2 rounded-lg bg-card border border-border">
                  <span className="text-[10px] text-muted-foreground uppercase block font-semibold">75th Percentile</span>
                  <span className="font-bold text-foreground text-sm">
                    {currencySym}{insights.baseSalary.p75.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-muted-foreground block">Top performers</span>
                </div>

                <div className="p-2 rounded-lg bg-card border border-border">
                  <span className="text-[10px] text-muted-foreground uppercase block font-semibold">90th Percentile</span>
                  <span className="font-bold text-purple-600 dark:text-purple-400 text-sm">
                    {currencySym}{insights.baseSalary.p90.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-muted-foreground block">Tier-1 / FAANG tier</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Experience Level Progression & Top Paying Skills */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Experience Seniority Tiers */}
            <Card className="p-4 sm:p-5 border border-border space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Icon name="TrendingUp" className="w-3.5 h-3.5 text-blue-500" />
                Seniority Compensation Ladder
              </h4>
              <div className="space-y-2">
                {insights.experienceTiers.map((tier, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-border/70 bg-card text-xs"
                  >
                    <span className="font-medium text-foreground">{tier.level}</span>
                    <span className="font-bold font-mono text-brand">{tier.range}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* High-Value Skills & Premiums */}
            <Card className="p-4 sm:p-5 border border-border space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Icon name="Zap" className="w-3.5 h-3.5 text-amber-500" />
                Skills Commanding Market Premiums
              </h4>
              <div className="space-y-2">
                {insights.topPayingSkills.map((sk, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-border/70 bg-card text-xs"
                  >
                    <span className="font-medium text-foreground">{sk.skill}</span>
                    <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                      +{sk.premiumPct}% above base
                    </span>
                  </div>
                ))}
              </div>

              {insights.costOfLivingNote && (
                <div className="rounded-lg bg-muted/40 p-2.5 text-[11px] text-muted-foreground border border-border/40 mt-2">
                  <span className="font-semibold text-foreground">Location Factor: </span>
                  {insights.costOfLivingNote}
                </div>
              )}
            </Card>
          </div>

          {/* Actionable Negotiation Strategy */}
          <Card className="p-4 sm:p-5 border border-border space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Icon name="ShieldCheck" className="w-3.5 h-3.5 text-emerald-500" />
              Strategic Negotiation Blueprint for this Role
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {insights.negotiationStrategy.map((tip, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-card border border-border text-xs text-foreground/90 space-y-1"
                >
                  <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 font-bold flex items-center justify-center text-[10px] mb-1">
                    {idx + 1}
                  </span>
                  <p className="leading-relaxed">{tip}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Search Grounding Citations & Sources */}
          {sources.length > 0 && (
            <div className="p-4 rounded-xl bg-muted/20 border border-border/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Icon name="ExternalLink" className="w-3 h-3 text-emerald-500" />
                  Live Grounding Citations ({sources.length} sources)
                </span>
                {searchQueries.length > 0 && (
                  <span className="text-[10px] text-muted-foreground font-mono truncate max-w-xs">
                    Query: "{searchQueries[0]}"
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {sources.map((src, idx) => (
                  <a
                    key={idx}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md bg-card border border-border text-foreground/80 hover:text-brand hover:border-brand/40 transition-colors"
                  >
                    <Icon name="Globe" className="w-3 h-3 text-emerald-500" />
                    <span className="truncate max-w-[200px]">{src.title}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
