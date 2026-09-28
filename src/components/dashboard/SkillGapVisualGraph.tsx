"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Icon } from "@/components/shared";
import { useApp } from "@/lib/store";
import { detectIndustry, INDUSTRY_PROFILES } from "@/lib/industry-ats";
import type { ResumeData, JobDescription } from "@/lib/types";
import { toast } from "sonner";

export interface SkillBenchmark {
  name: string;
  category: "Technical" | "Architecture" | "Domain" | "Process" | "Soft Skill";
  targetImportance: number; // 85 - 100%
  userScore: number; // 0 - 100%
  matchStatus: "full" | "partial" | "gap";
  foundIn: string[]; // sections
  gapDescription: string;
  suggestedBullet: string;
}

// Default benchmark top 10 skill sets by industry
const INDUSTRY_TOP_SKILLS: Record<string, Array<{ name: string; category: SkillBenchmark["category"]; importance: number; gapDescription: string; suggestedBullet: string }>> = {
  tech: [
    { name: "System Architecture", category: "Architecture", importance: 95, gapDescription: "Essential for scalable system design, trade-off evaluations, and modular codebases.", suggestedBullet: "Architected resilient distributed microservices handling 2M+ daily requests with 99.95% uptime." },
    { name: "TypeScript / Modern JavaScript", category: "Technical", importance: 100, gapDescription: "Primary language requirement across modern fullstack and frontend engineering stacks.", suggestedBullet: "Developed strictly typed, modular TypeScript frontends utilizing modern React and state stores." },
    { name: "Cloud Infrastructure (AWS/GCP)", category: "Technical", importance: 90, gapDescription: "Demonstrates production deployment, container orchestration, and serverless knowledge.", suggestedBullet: "Engineered automated CI/CD pipelines deploying containerized services on AWS ECS and Lambda." },
    { name: "Database Design & Optimization (SQL)", category: "Technical", importance: 90, gapDescription: "Crucial for high-throughput transactional queries, indexing strategies, and schema migrations.", suggestedBullet: "Optimized complex PostgreSQL queries and indexing schemas, reducing P95 database latency by 45%." },
    { name: "RESTful & GraphQL API Design", category: "Technical", importance: 85, gapDescription: "Required for resilient client-server contracts, rate-limiting, and microservice communication.", suggestedBullet: "Designed and documented high-performance RESTful APIs consumed by multiple cross-platform clients." },
    { name: "Automated Testing & CI/CD", category: "Process", importance: 85, gapDescription: "Guarantees release reliability, regression prevention, and trunk-based deployment velocity.", suggestedBullet: "Maintained 85%+ test coverage across unit and integration suites using Jest and GitHub Actions." },
    { name: "Performance & Latency Optimization", category: "Technical", importance: 85, gapDescription: "Distinguishes junior practitioners from senior engineers capable of diagnosing bottlenecks.", suggestedBullet: "Conducted profiling and memory optimization, cutting client bundle size by 35% and accelerating TTI." },
    { name: "Agile & Cross-Functional Delivery", category: "Process", importance: 80, gapDescription: "Key indicator of collaborative velocity, backlog grooming, and sprint delivery.", suggestedBullet: "Partnered with product managers and designers in bi-weekly Agile sprints to deliver product roadmap milestones." },
    { name: "Security & Data Compliance (OWASP)", category: "Domain", importance: 80, gapDescription: "Demonstrates defensive engineering, secure authentication, and vulnerability mitigation.", suggestedBullet: "Implemented OAuth2/JWT authentication flows and RBAC security policies complying with SOC2 standards." },
    { name: "Technical Mentorship & Code Review", category: "Soft Skill", importance: 80, gapDescription: "Measures engineering leadership, code hygiene standards, and multiplying team output.", suggestedBullet: "Mentored 4 mid-level engineers, established team PR review standards, and led architectural RFC sessions." },
  ],
  aviation: [
    { name: "Safety & Emergency Procedures (SEP)", category: "Domain", importance: 100, gapDescription: "Mandatory qualification for regulatory compliance and passenger safety assurance.", suggestedBullet: "Certified in airline Safety & Emergency Procedures (SEP), conducting pre-flight emergency equipment inspections." },
    { name: "Crew Resource Management (CRM)", category: "Process", importance: 95, gapDescription: "Essential for cockpit-to-cabin communication and synchronized situational awareness.", suggestedBullet: "Demonstrated seamless Crew Resource Management (CRM) coordination during routine and irregular flight operations." },
    { name: "Multicultural Communication", category: "Soft Skill", importance: 95, gapDescription: "Critical for global routes and multinational passenger customer satisfaction.", suggestedBullet: "Delivered culturally sensitive, high-empathy service for international passengers across 40+ destinations." },
    { name: "First Aid & CPR/AED Response", category: "Domain", importance: 90, gapDescription: "Immediate response capability during in-flight medical emergencies.", suggestedBullet: "Certified First Aid & CPR responder trained to deliver swift in-flight care and stabilize passengers." },
    { name: "First & Business Class Service", category: "Domain", importance: 90, gapDescription: "High-yield premium hospitality, dining presentation, and bespoke customer care.", suggestedBullet: "Provided five-star dining and hospitality in First and Business cabins, adhering to strict service standards." },
    { name: "Conflict De-escalation & Passenger Care", category: "Soft Skill", importance: 85, gapDescription: "Maintains cabin order during delays, diversions, or disruptive customer events.", suggestedBullet: "De-escalated volatile passenger situations calmly while adhering strictly to airline security directives." },
    { name: "Aviation Regulatory Compliance (ICAO/FAA)", category: "Domain", importance: 85, gapDescription: "Enforces civil aviation rules, security checks, and hazardous material protocols.", suggestedBullet: "Ensured 100% compliance with international civil aviation security directives and safety checklists." },
    { name: "Time Management & Turnaround Efficiency", category: "Process", importance: 80, gapDescription: "Protects flight schedules, on-time departures, and aircraft turnaround targets.", suggestedBullet: "Coordinated boarding and cabin preparation to achieve on-time departure metrics." },
    { name: "Multilingual Proficiency", category: "Soft Skill", importance: 80, gapDescription: "Differentiates applicants for international carriers and codeshare partnerships.", suggestedBullet: "Fluent in English and French, facilitating clear safety announcements and passenger support." },
    { name: "In-flight Sales & Upselling", category: "Domain", importance: 75, gapDescription: "Generates ancillary airline revenue and optimizes duty-free retail performance.", suggestedBullet: "Exceeded monthly in-flight duty-free sales targets through personalized passenger recommendations." },
  ],
  finance: [
    { name: "Financial Modeling & Valuation (DCF)", category: "Technical", importance: 100, gapDescription: "Fundamental skill for investment analysis, equity valuation, and transaction structuring.", suggestedBullet: "Constructed comprehensive 3-statement financial models and DCF valuations supporting strategic acquisitions." },
    { name: "Risk Management & Regulatory Compliance", category: "Domain", importance: 95, gapDescription: "Required to mitigate market exposure and ensure compliance with SEC/FINRA regulations.", suggestedBullet: "Monitored portfolio VaR exposure and ensured strict adherence to internal risk limits and compliance mandates." },
    { name: "Advanced Excel & Financial Modeling", category: "Technical", importance: 95, gapDescription: "Daily standard for financial reporting, scenario analyses, and data consolidation.", suggestedBullet: "Automated quarterly reporting dashboards utilizing advanced formulas, macros, and dynamic financial charts." },
    { name: "Variance & Performance Analytics", category: "Technical", importance: 90, gapDescription: "Evaluates financial health against forecast benchmarks to optimize operating margins.", suggestedBullet: "Analyzed monthly P&L budget-to-actual variances, identifying $240K in annual operational cost efficiencies." },
    { name: "Capital Allocation & Budgeting", category: "Process", importance: 90, gapDescription: "Aligns financial resources with corporate strategy and strategic ROI goals.", suggestedBullet: "Managed annual OPEX/CAPEX budgeting cycle across 5 business units totaling $18M in expenditure." },
    { name: "Executive Stakeholder Presentation", category: "Soft Skill", importance: 85, gapDescription: "Translates complex financial data into actionable executive insights.", suggestedBullet: "Delivered monthly financial performance packages to CFO and board members with strategic recommendations." },
    { name: "ERP & Accounting Systems (SAP/NetSuite)", category: "Technical", importance: 85, gapDescription: "Standard tooling for ledger integrity, reconciliations, and closing cadences.", suggestedBullet: "Spearheaded general ledger reconciliation and month-end close acceleration in SAP ERP." },
    { name: "Audit Preparation & Internal Controls", category: "Process", importance: 85, gapDescription: "Ensures accounting accuracy and smooth execution of external financial audits.", suggestedBullet: "Maintained robust SOX internal controls, resulting in zero deficiencies during annual external audit." },
    { name: "Market Research & Competitor Benchmarking", category: "Domain", importance: 80, gapDescription: "Contextualizes company financial performance within macroeconomic trends.", suggestedBullet: "Conducted peer group benchmarking and capital structure analyses to advise on debt refinancing." },
    { name: "Cash Flow Forecasting & Liquidity", category: "Technical", importance: 80, gapDescription: "Guarantees working capital adequacy and optimizes treasury yields.", suggestedBullet: "Implemented rolling 13-week cash flow forecasting to safeguard operating liquidity during rapid expansion." },
  ]
};

export function SkillGapVisualGraph() {
  const resumes = useApp((s) => s.resumes);
  const activeResumeId = useApp((s) => s.activeResumeId);
  const jds = useApp((s) => s.jobDescriptions);
  const activeJdId = useApp((s) => s.activeJdId);
  const updateResume = useApp((s) => s.updateResume);
  const setView = useApp((s) => s.setView);

  const [selectedResumeId, setSelectedResumeId] = useState<string>(
    activeResumeId || resumes[0]?.id || ""
  );

  const [selectedJdId, setSelectedJdId] = useState<string>(
    activeJdId || jds[0]?.id || "auto"
  );

  const [selectedIndustry, setSelectedIndustry] = useState<string>("tech");
  const [viewFilter, setViewFilter] = useState<"all" | "gaps" | "covered">("all");

  // Selected resume resolution
  const currentResume = useMemo(() => {
    return resumes.find((r) => r.id === selectedResumeId) || resumes[0] || null;
  }, [resumes, selectedResumeId]);

  // Selected JD resolution
  const currentJd = useMemo(() => {
    if (selectedJdId === "auto") return jds[0] || null;
    return jds.find((j) => j.id === selectedJdId) || null;
  }, [jds, selectedJdId]);

  // Auto-detect industry from resume and JD
  useMemo(() => {
    if (currentJd) {
      const detected = detectIndustry(currentJd.rawText || currentJd.title, currentResume?.headline || "");
      if (detected.industryId.includes("aviation") || detected.industryId.includes("airline")) {
        setSelectedIndustry("aviation");
      } else if (detected.industryId.includes("finance") || detected.industryId.includes("banking")) {
        setSelectedIndustry("finance");
      } else {
        setSelectedIndustry("tech");
      }
    } else if (currentResume) {
      const text = `${currentResume.headline || ""} ${currentResume.title || ""}`.toLowerCase();
      if (text.includes("cabin") || text.includes("flight") || text.includes("crew") || text.includes("aviation")) {
        setSelectedIndustry("aviation");
      } else if (text.includes("finance") || text.includes("accountant") || text.includes("analyst")) {
        setSelectedIndustry("finance");
      } else {
        setSelectedIndustry("tech");
      }
    }
  }, [currentResume, currentJd]);

  // Compute Top 10 Skill Benchmarks & User Current Levels
  const skillBenchmarks = useMemo<SkillBenchmark[]>(() => {
    if (!currentResume) return [];

    // Get baseline template for the selected industry
    const baseList = INDUSTRY_TOP_SKILLS[selectedIndustry] || INDUSTRY_TOP_SKILLS.tech;

    // Aggregate all text in user's resume
    const userSkills = (currentResume.skills || []).map((s) =>
      typeof s === "string" ? s.toLowerCase() : (s?.name || "").toLowerCase()
    );

    const summaryText = (currentResume.summary || "").toLowerCase();
    const expText = (currentResume.experience || [])
      .map((e) => `${e.title} ${e.company} ${e.description || ""} ${(e.bullets || []).join(" ")}`)
      .join(" ")
      .toLowerCase();

    const projText = (currentResume.projects || [])
      .map((p) => `${p.title} ${p.description || ""} ${(p.bullets || []).join(" ")}`)
      .join(" ")
      .toLowerCase();

    return baseList.map((skillDef) => {
      const lowerName = skillDef.name.toLowerCase();
      const terms = lowerName
        .split(/[\/\&,\(\)]+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 2);

      const foundIn: string[] = [];
      let mentionCount = 0;

      // Check user skills array
      const hasInSkills = userSkills.some((s) =>
        s.includes(lowerName) || terms.some((t) => s.includes(t))
      );
      if (hasInSkills) {
        foundIn.push("Skills List");
        mentionCount += 2;
      }

      // Check experience
      const hasInExp = terms.some((t) => expText.includes(t));
      if (hasInExp) {
        foundIn.push("Work Experience");
        mentionCount += 3;
      }

      // Check summary
      const hasInSum = terms.some((t) => summaryText.includes(t));
      if (hasInSum) {
        foundIn.push("Summary");
        mentionCount += 1;
      }

      // Check projects
      const hasInProj = terms.some((t) => projText.includes(t));
      if (hasInProj) {
        foundIn.push("Projects");
        mentionCount += 1;
      }

      // Compute user level (0 - 100%)
      let userScore = 0;
      if (mentionCount >= 5) userScore = 95;
      else if (mentionCount >= 3) userScore = 80;
      else if (mentionCount >= 2) userScore = 55;
      else if (mentionCount === 1) userScore = 30;
      else userScore = 0;

      const matchStatus: SkillBenchmark["matchStatus"] =
        userScore >= 75 ? "full" : userScore > 0 ? "partial" : "gap";

      return {
        name: skillDef.name,
        category: skillDef.category,
        targetImportance: skillDef.importance,
        userScore,
        matchStatus,
        foundIn,
        gapDescription: skillDef.gapDescription,
        suggestedBullet: skillDef.suggestedBullet,
      };
    });
  }, [currentResume, selectedIndustry]);

  // Filtered benchmarks
  const filteredBenchmarks = useMemo(() => {
    return skillBenchmarks.filter((b) => {
      if (viewFilter === "gaps") return b.matchStatus !== "full";
      if (viewFilter === "covered") return b.matchStatus === "full";
      return true;
    });
  }, [skillBenchmarks, viewFilter]);

  // Aggregate Metrics
  const totalSkills = skillBenchmarks.length;
  const coveredCount = skillBenchmarks.filter((b) => b.matchStatus === "full").length;
  const partialCount = skillBenchmarks.filter((b) => b.matchStatus === "partial").length;
  const gapCount = skillBenchmarks.filter((b) => b.matchStatus === "gap").length;

  const averageSkillMatch = Math.round(
    skillBenchmarks.reduce((acc, b) => acc + (b.userScore / b.targetImportance) * 100, 0) / (totalSkills || 1)
  );

  // Quick Action: Add missing skill directly to resume
  const handleAddSkillToResume = (skillName: string) => {
    if (!currentResume) return;

    const existingSkills = currentResume.skills || [];
    const alreadyPresent = existingSkills.some((s) =>
      typeof s === "string"
        ? s.toLowerCase() === skillName.toLowerCase()
        : s?.name?.toLowerCase() === skillName.toLowerCase()
    );

    if (alreadyPresent) {
      toast.info(`"${skillName}" is already listed in your resume skills.`);
      return;
    }

    const updated = [...existingSkills, skillName];
    updateResume(currentResume.id, {
      skills: updated,
      updatedAt: new Date().toISOString(),
    });

    toast.success(`Added "${skillName}" to resume! Skill graph updated.`);
  };

  if (!currentResume) {
    return null;
  }

  return (
    <Card className="w-full max-w-full overflow-hidden border border-border/80 shadow-premium">
      {/* Header with Title and Industry Controls */}
      <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-4 border-b border-border/60 bg-muted/20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Icon name="BarChart2" className="w-4 h-4" />
              </span>
              <CardTitle className="text-base sm:text-lg font-bold font-display">
                Top 10 Required Skills & Knowledge Gap Plot
              </CardTitle>
            </div>
            <CardDescription className="text-xs sm:text-sm">
              Visual comparison plotting your current resume skillset against the top 10 required skills for your target industry.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setView("builder")}
              className="text-xs h-8 gap-1.5 border-brand/30 text-brand"
            >
              <Icon name="PenTool" className="w-3.5 h-3.5" /> Edit in Builder
            </Button>
            <Button
              size="sm"
              onClick={() => setView("optimizer")}
              className="bg-brand hover:bg-brand-dark text-white text-xs h-8 gap-1.5"
            >
              <Icon name="Sparkles" className="w-3.5 h-3.5" /> Auto-Fill Gaps
            </Button>
          </div>
        </div>

        {/* Source Resume & Industry Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 mt-1 border-t border-border/40">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground shrink-0 flex items-center gap-1">
              <Icon name="FileText" className="w-3.5 h-3.5 text-brand" /> Resume:
            </span>
            <Select
              value={selectedResumeId}
              onValueChange={(val) => {
                setSelectedResumeId(val);
              }}
            >
              <SelectTrigger className="w-full h-8 text-xs bg-card">
                <SelectValue placeholder="Select resume" />
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

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground shrink-0 flex items-center gap-1">
              <Icon name="Briefcase" className="w-3.5 h-3.5 text-emerald-500" /> Target Industry:
            </span>
            <Select value={selectedIndustry} onValueChange={setSelectedIndustry}>
              <SelectTrigger className="w-full h-8 text-xs bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tech">Software Engineering & Technology</SelectItem>
                <SelectItem value="aviation">Aviation & Airline Cabin Operations</SelectItem>
                <SelectItem value="finance">Finance, Banking & Corporate Accounting</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-6">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-card border border-border space-y-1">
            <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
              Skill Overlap Match
            </div>
            <div className="text-2xl font-bold font-display text-foreground">
              {averageSkillMatch}%
            </div>
            <div className="text-[10px] text-muted-foreground">Overall alignment</div>
          </div>

          <div className="p-3.5 rounded-xl bg-card border border-border space-y-1">
            <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
              Fully Covered Skills
            </div>
            <div className="text-2xl font-bold font-display text-emerald-600 dark:text-emerald-400">
              {coveredCount} <span className="text-xs font-normal text-muted-foreground">/ 10</span>
            </div>
            <div className="text-[10px] text-muted-foreground">Proven in experience & skills</div>
          </div>

          <div className="p-3.5 rounded-xl bg-card border border-border space-y-1">
            <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
              Partial Coverage
            </div>
            <div className="text-2xl font-bold font-display text-blue-500">
              {partialCount} <span className="text-xs font-normal text-muted-foreground">/ 10</span>
            </div>
            <div className="text-[10px] text-muted-foreground">Needs quantified evidence</div>
          </div>

          <div className="p-3.5 rounded-xl bg-card border border-border space-y-1">
            <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
              Critical Knowledge Gaps
            </div>
            <div className="text-2xl font-bold font-display text-red-500">
              {gapCount} <span className="text-xs font-normal text-muted-foreground">/ 10</span>
            </div>
            <div className="text-[10px] text-muted-foreground">Missing from resume</div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3">
          <div className="flex items-center gap-1">
            <Button
              variant={viewFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewFilter("all")}
              className={`text-xs h-7 rounded-lg ${viewFilter === "all" ? "bg-brand text-white" : ""}`}
            >
              All 10 Skills ({totalSkills})
            </Button>
            <Button
              variant={viewFilter === "gaps" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewFilter("gaps")}
              className={`text-xs h-7 rounded-lg gap-1 ${viewFilter === "gaps" ? "bg-brand text-white" : ""}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              Identified Gaps ({gapCount + partialCount})
            </Button>
            <Button
              variant={viewFilter === "covered" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewFilter("covered")}
              className={`text-xs h-7 rounded-lg gap-1 ${viewFilter === "covered" ? "bg-brand text-white" : ""}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Matched ({coveredCount})
            </Button>
          </div>

          <div className="text-xs text-muted-foreground hidden sm:block">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-brand mr-1 align-middle" /> Your Resume
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-muted-foreground/30 ml-3 mr-1 align-middle" /> Target Benchmark (100%)
          </div>
        </div>

        {/* The Visual Graph: Dual-Bar Comparative Plot */}
        <div className="space-y-4">
          {filteredBenchmarks.map((item, index) => {
            const isFull = item.matchStatus === "full";
            const isPartial = item.matchStatus === "partial";
            const isGap = item.matchStatus === "gap";

            const barColor = isFull
              ? "bg-emerald-500"
              : isPartial
              ? "bg-blue-500"
              : "bg-red-500";

            return (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.03 }}
                className="p-3.5 sm:p-4 rounded-xl border border-border/70 bg-card hover:border-brand/40 transition-all space-y-2.5 shadow-2xs"
              >
                {/* Skill Name, Category & Badges */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-muted-foreground/70 font-mono w-4">
                      #{index + 1}
                    </span>
                    <span className="font-semibold text-sm text-foreground">
                      {item.name}
                    </span>
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      {item.category}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {isFull ? (
                      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] gap-1">
                        <Icon name="CheckCircle" className="w-3 h-3" /> Fully Covered
                      </Badge>
                    ) : isPartial ? (
                      <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-[10px] gap-1">
                        <Icon name="AlertCircle" className="w-3 h-3" /> Partial Coverage
                      </Badge>
                    ) : (
                      <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 text-[10px] gap-1">
                        <Icon name="ShieldAlert" className="w-3 h-3" /> Knowledge Gap
                      </Badge>
                    )}

                    <span className="font-mono text-xs font-bold text-foreground">
                      {item.userScore}% / {item.targetImportance}%
                    </span>
                  </div>
                </div>

                {/* Comparative Dual Progress Meter Bar */}
                <div className="space-y-1">
                  <div className="relative w-full h-3 rounded-full bg-muted/80 overflow-hidden">
                    {/* Target Benchmark line (dotted or dashed at target importance) */}
                    <div
                      className="absolute inset-y-0 w-0.5 bg-foreground/40 z-10"
                      style={{ left: `${item.targetImportance}%` }}
                      title={`Target Requirement: ${item.targetImportance}%`}
                    />
                    {/* User's current coverage bar */}
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${item.userScore}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                      className={`h-full rounded-full ${barColor}`}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>
                      {item.foundIn.length > 0
                        ? `Detected in: ${item.foundIn.join(", ")}`
                        : "Not found anywhere in resume sections"}
                    </span>
                    <span>Target Requirement: {item.targetImportance}%</span>
                  </div>
                </div>

                {/* Specific Knowledge Gap & Resolution Recommendation */}
                {!isFull && (
                  <div className="mt-2 pt-2 border-t border-border/50 text-xs space-y-2 bg-muted/20 p-2.5 rounded-lg">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <p className="text-muted-foreground text-[11px]">
                          <strong className="text-foreground">Why this gap matters: </strong>
                          {item.gapDescription}
                        </p>
                        <p className="text-[11px] text-brand">
                          <strong className="text-foreground">Recommended bullet: </strong>
                          "{item.suggestedBullet}"
                        </p>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAddSkillToResume(item.name)}
                        className="text-[11px] h-7 px-2.5 text-brand border-brand/30 hover:bg-brand/10 shrink-0 gap-1"
                        title="Add this skill to your resume"
                      >
                        <Icon name="Plus" className="w-3 h-3" />
                        Add Skill
                      </Button>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
