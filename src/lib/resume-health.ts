/**
 * Resume Health Score Engine
 * Deterministically computes letter grades (A-F), dimensional breakdown
 * across formatting, length, keyword density, and readability, and provides
 * prioritized, actionable advice.
 */

import type { ResumeData } from "./types";

export type LetterGrade = "A+" | "A" | "A-" | "B+" | "B" | "B-" | "C+" | "C" | "D" | "F";

export interface HealthCategory {
  name: string;
  score: number; // 0 - 100
  weight: number; // e.g. 0.25
  status: "excellent" | "good" | "needs-work" | "critical";
  highlights: string[];
}

export interface ActionableAdvice {
  id: string;
  category: "formatting" | "length" | "keywords" | "readability";
  priority: "critical" | "high" | "medium" | "tip";
  title: string;
  impact: string;
  recommendation: string;
  suggestedAction?: string;
}

export interface ResumeHealthReport {
  overallScore: number; // 0 - 100
  letterGrade: LetterGrade;
  gradeColor: string;
  gradeBadgeClass: string;
  verdict: string;
  categories: {
    formatting: HealthCategory;
    length: HealthCategory;
    keywordDensity: HealthCategory;
    readability: HealthCategory;
  };
  metrics: {
    totalWords: number;
    experienceCount: number;
    bulletCount: number;
    metricBulletCount: number;
    metricBulletPct: number;
    skillsCount: number;
    hasSummary: boolean;
    hasContact: boolean;
    hasLinkedIn: boolean;
    avgWordsPerBullet: number;
  };
  actionableAdvice: ActionableAdvice[];
}

// Strong impact verbs that ATS and human screeners reward
const STRONG_ACTION_VERBS = new Set([
  "accelerated", "achieved", "analyzed", "architected", "automated", "built",
  "championed", "collaborated", "conceived", "consolidated", "constructed",
  "coordinated", "created", "decreased", "delivered", "deployed", "designed",
  "developed", "directed", "doubled", "drove", "engineered", "established",
  "executed", "expanded", "expedited", "formulated", "founded", "generated",
  "guided", "headed", "implemented", "improved", "increased", "initiated",
  "instituted", "integrated", "introduced", "launched", "led", "managed",
  "maximized", "mentored", "migrated", "minimized", "modernized", "negotiated",
  "optimized", "orchestrated", "overhauled", "oversaw", "pioneered", "reduced",
  "redesigned", "reengineered", "resolved", "restructured", "revamped", "saved",
  "scaled", "spearheaded", "standardized", "streamlined", "supervised",
  "surpassed", "transformed", "unified", "upgraded", "yielded"
]);

// Weak buzzwords / filler cliches that hurt readability
const WEAK_BUZZWORDS = [
  "responsible for", "helped with", "assisted in", "worked on", "handled",
  "team player", "hard worker", "go-getter", "detail oriented", "think outside the box",
  "synergy", "dynamic", "self-starter", "fast learner"
];

export function computeResumeHealthScore(resume: ResumeData): ResumeHealthReport {
  // Aggregate text components
  const name = resume.name?.trim() || "";
  const headline = resume.headline?.trim() || "";
  const summary = resume.summary?.trim() || "";
  const contact = resume.contact || {};
  const experiences = resume.experience || [];
  const educations = resume.education || [];
  const skills = resume.skills || [];
  const projects = resume.projects || [];

  // Extract all bullets
  const allBullets: string[] = [];
  experiences.forEach((e) => {
    (e.bullets || []).forEach((b) => {
      const trimmed = b.trim();
      if (trimmed) allBullets.push(trimmed);
    });
  });

  // Calculate word counts
  const summaryWords = summary ? summary.split(/\s+/).filter(Boolean).length : 0;
  const bulletWords = allBullets.reduce((acc, b) => acc + b.split(/\s+/).filter(Boolean).length, 0);
  const totalWords =
    name.split(/\s+/).length +
    headline.split(/\s+/).length +
    summaryWords +
    bulletWords +
    skills.length * 2 +
    educations.length * 15;

  const avgWordsPerBullet = allBullets.length > 0 ? Math.round(bulletWords / allBullets.length) : 0;

  // Metric presence: count bullets containing %, $, numbers, or metrics (k, m, x)
  const metricRegex = /([0-9]+%|\$[0-9]+|[0-9]+x|[0-9]+k|[0-9]+m|\b[0-9]+(\.[0-9]+)?\b)/i;
  let metricBulletCount = 0;
  let actionVerbBulletCount = 0;
  let weakPhraseCount = 0;

  allBullets.forEach((bullet) => {
    if (metricRegex.test(bullet)) {
      metricBulletCount++;
    }
    const firstWord = bullet.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "") || "";
    if (STRONG_ACTION_VERBS.has(firstWord)) {
      actionVerbBulletCount++;
    }
    const lower = bullet.toLowerCase();
    WEAK_BUZZWORDS.forEach((phrase) => {
      if (lower.includes(phrase)) weakPhraseCount++;
    });
  });

  const metricBulletPct = allBullets.length > 0 ? Math.round((metricBulletCount / allBullets.length) * 100) : 0;
  const actionVerbPct = allBullets.length > 0 ? Math.round((actionVerbBulletCount / allBullets.length) * 100) : 0;

  // --------------------------------------------------------------------------
  // 1. Formatting & Structure Score (0 - 100)
  // --------------------------------------------------------------------------
  let formattingScore = 100;
  const formattingHighlights: string[] = [];
  const formattingAdvice: ActionableAdvice[] = [];

  const hasEmail = Boolean(contact.email && contact.email.includes("@"));
  const hasPhone = Boolean(contact.phone && contact.phone.length > 6);
  const hasLocation = Boolean(contact.location && contact.location.length > 2);
  const hasLinkedIn = Boolean(contact.linkedin && contact.linkedin.includes("linkedin"));

  if (!hasEmail) {
    formattingScore -= 20;
    formattingAdvice.push({
      id: "fmt-email",
      category: "formatting",
      priority: "critical",
      title: "Missing Email Address",
      impact: "Recruiters cannot invite you to interview without direct email contact.",
      recommendation: "Add your primary professional email address to the contact section.",
    });
  } else {
    formattingHighlights.push("Contact email present & verified");
  }

  if (!hasPhone) {
    formattingScore -= 10;
    formattingAdvice.push({
      id: "fmt-phone",
      category: "formatting",
      priority: "high",
      title: "Missing Phone Number",
      impact: "ATS recruiters frequently use SMS or phone screens for initial triage.",
      recommendation: "Add a phone number with country/area code in contact details.",
    });
  }

  if (!hasLocation) {
    formattingScore -= 10;
    formattingAdvice.push({
      id: "fmt-location",
      category: "formatting",
      priority: "high",
      title: "Missing Location / Region",
      impact: "ATS geographic filters reject applicants without city or remote status.",
      recommendation: "Specify city and state/country (e.g. San Francisco, CA or Remote).",
    });
  } else {
    formattingHighlights.push("Geographic location clearly identified");
  }

  if (!hasLinkedIn) {
    formattingScore -= 10;
    formattingAdvice.push({
      id: "fmt-linkedin",
      category: "formatting",
      priority: "medium",
      title: "Add LinkedIn Profile Link",
      impact: "Over 87% of hiring managers cross-reference candidate LinkedIn profiles.",
      recommendation: "Add your LinkedIn URL (e.g. linkedin.com/in/yourname) in contact details.",
    });
  } else {
    formattingHighlights.push("LinkedIn profile URL connected");
  }

  if (experiences.length === 0) {
    formattingScore -= 30;
    formattingAdvice.push({
      id: "fmt-exp",
      category: "formatting",
      priority: "critical",
      title: "No Experience Entries Found",
      impact: "Experience is the primary evaluation section for 95% of job openings.",
      recommendation: "Add at least one professional work experience or relevant project.",
    });
  } else {
    formattingHighlights.push(`${experiences.length} work experience entries structured cleanly`);
  }

  if (skills.length < 5) {
    formattingScore -= 15;
    formattingAdvice.push({
      id: "fmt-skills",
      category: "formatting",
      priority: "high",
      title: "Skills Section Too Sparse",
      impact: "ATS parsers look for at least 8-12 core skills to qualify candidates.",
      recommendation: "Populate your skills section with relevant tools, methodologies, and technical competencies.",
    });
  } else {
    formattingHighlights.push(`${skills.length} technical competencies listed`);
  }

  formattingScore = Math.max(formattingScore, 10);

  // --------------------------------------------------------------------------
  // 2. Length & Page Budget Score (0 - 100)
  // --------------------------------------------------------------------------
  let lengthScore = 100;
  const lengthHighlights: string[] = [];
  const lengthAdvice: ActionableAdvice[] = [];

  // Optimal word count: 400 - 750 words for 1-page; 800 - 1100 for 2-pages
  if (totalWords < 250) {
    lengthScore -= 35;
    lengthAdvice.push({
      id: "len-sparse",
      category: "length",
      priority: "critical",
      title: "Resume is Too Brief (<250 Words)",
      impact: "Appears incomplete to automated parsers and hiring managers.",
      recommendation: "Expand your bullet points with context, actions taken, and quantified business impact.",
    });
  } else if (totalWords > 1200) {
    lengthScore -= 20;
    lengthAdvice.push({
      id: "len-overflow",
      category: "length",
      priority: "high",
      title: "Potential Page Overflow (>1,200 Words)",
      impact: "May spill onto an accidental 3rd page or cause recruiters to lose focus.",
      recommendation: "Trim older roles or collapse repetitive bullets to maintain a tight 1-2 page presentation.",
    });
  } else {
    lengthHighlights.push(`Optimal word count (${totalWords} words) fits clean page budget`);
  }

  // Summary length check
  if (!summary) {
    lengthScore -= 15;
    lengthAdvice.push({
      id: "len-summary-missing",
      category: "length",
      priority: "medium",
      title: "Missing Professional Summary",
      impact: "Screeners spend only 6 seconds scanning; an executive summary hooks them instantly.",
      recommendation: "Add a concise 3-4 sentence summary highlighting your top value proposition.",
    });
  } else if (summaryWords > 95) {
    lengthScore -= 10;
    lengthAdvice.push({
      id: "len-summary-long",
      category: "length",
      priority: "medium",
      title: "Summary Paragraph is Too Long",
      impact: "Walls of text get skipped by recruiters scanning quickly.",
      recommendation: "Keep your summary between 40-75 words for optimal scannability.",
    });
  } else {
    lengthHighlights.push(`Tight professional summary (${summaryWords} words)`);
  }

  // Bullets length check
  if (avgWordsPerBullet > 0 && avgWordsPerBullet < 8) {
    lengthScore -= 15;
    lengthAdvice.push({
      id: "len-bullets-short",
      category: "length",
      priority: "medium",
      title: "Bullet Points are Too Short (<8 Words Avg)",
      impact: "Short fragments fail to demonstrate the scope and impact of your contributions.",
      recommendation: "Use the Action + Context + Result formula to expand each bullet.",
    });
  } else if (avgWordsPerBullet > 32) {
    lengthScore -= 15;
    lengthAdvice.push({
      id: "len-bullets-runon",
      category: "length",
      priority: "medium",
      title: "Bullet Points are Run-on Paragraphs",
      impact: "Blocks of text exceeding 3 lines fatigue human readers.",
      recommendation: "Split multi-sentence bullets into crisp 15-22 word impact statements.",
    });
  } else if (allBullets.length > 0) {
    lengthHighlights.push(`Balanced bullet pacing (~${avgWordsPerBullet} words/bullet)`);
  }

  lengthScore = Math.max(lengthScore, 15);

  // --------------------------------------------------------------------------
  // 3. Keyword Density & Quantifiable Impact Score (0 - 100)
  // --------------------------------------------------------------------------
  let keywordScore = 100;
  const keywordHighlights: string[] = [];
  const keywordAdvice: ActionableAdvice[] = [];

  // Metric density: want at least 35% of bullets to have numbers
  if (allBullets.length > 0) {
    if (metricBulletPct < 20) {
      keywordScore -= 30;
      keywordAdvice.push({
        id: "kw-metrics-low",
        category: "keywords",
        priority: "critical",
        title: "Low Quantifiable Metric Density",
        impact: "Only " + metricBulletPct + "% of bullets have numbers. High-impact resumes contain 40%+ metrics.",
        recommendation: "Add hard metrics: percentages, dollar values, users impacted, or latency improvements.",
        suggestedAction: "Example: 'Reduced page latency by 35%' or 'Managed $1.2M budget'.",
      });
    } else if (metricBulletPct < 40) {
      keywordScore -= 10;
      keywordAdvice.push({
        id: "kw-metrics-med",
        category: "keywords",
        priority: "high",
        title: "Boost Quantifiable Metrics",
        impact: `${metricBulletPct}% of bullets contain metrics. Elevate to 40%+ for top-tier candidate ranking.`,
        recommendation: "Incorporate performance deltas, percentages, or revenue impacts into 2 more bullets.",
      });
    } else {
      keywordHighlights.push(`Strong metric density: ${metricBulletPct}% of bullets quantified`);
    }

    // Action verbs starting bullets
    if (actionVerbPct < 50) {
      keywordScore -= 20;
      keywordAdvice.push({
        id: "kw-verbs-low",
        category: "keywords",
        priority: "high",
        title: "Begin Bullets with Strong Power Verbs",
        impact: "Only " + actionVerbPct + "% of bullets begin with decisive action verbs.",
        recommendation: "Start bullets with verbs like 'Spearheaded', 'Architected', 'Accelerated', or 'Orchestrated'.",
      });
    } else {
      keywordHighlights.push(`Excellent active voice: ${actionVerbPct}% of bullets start with power verbs`);
    }
  }

  // Cliches / buzzwords
  if (weakPhraseCount > 0) {
    keywordScore -= Math.min(weakPhraseCount * 5, 20);
    keywordAdvice.push({
      id: "kw-buzzwords",
      category: "keywords",
      priority: "medium",
      title: `Eliminate Weak Filler Phrases (${weakPhraseCount} Found)`,
      impact: "Phrases like 'responsible for' or 'helped with' sound passive and diminish authority.",
      recommendation: "Replace passive phrases with active leadership verbs that emphasize ownership.",
    });
  } else {
    keywordHighlights.push("Zero generic corporate buzzwords detected");
  }

  keywordScore = Math.max(keywordScore, 10);

  // --------------------------------------------------------------------------
  // 4. Readability & Scannability Score (0 - 100)
  // --------------------------------------------------------------------------
  let readabilityScore = 100;
  const readabilityHighlights: string[] = [];
  const readabilityAdvice: ActionableAdvice[] = [];

  // Punctuation and bullet consistency
  let unpunctuatedCount = 0;
  allBullets.forEach((b) => {
    if (!/[.!?]$/.test(b.trim())) unpunctuatedCount++;
  });

  if (allBullets.length > 0 && unpunctuatedCount > allBullets.length * 0.4) {
    readabilityScore -= 15;
    readabilityAdvice.push({
      id: "read-punctuation",
      category: "readability",
      priority: "medium",
      title: "Inconsistent Bullet Punctuation",
      impact: "Mixed ending periods create visual clutter and look unpolished.",
      recommendation: "Ensure all bullet statements consistently end with a period (or omit periods uniformly).",
    });
  } else {
    readabilityHighlights.push("Consistent bullet punctuation and layout");
  }

  // Headline check
  if (!headline) {
    readabilityScore -= 15;
    readabilityAdvice.push({
      id: "read-headline",
      category: "readability",
      priority: "high",
      title: "Add a Target Role Title / Headline",
      impact: "Without a clear headline, screeners take twice as long to categorize your seniority level.",
      recommendation: "Add a headline like 'Senior Fullstack Engineer | React, TypeScript & Distributed Systems'.",
    });
  } else {
    readabilityHighlights.push(`Prominent role headline: "${headline.slice(0, 45)}..."`);
  }

  // Education verification
  if (educations.length === 0) {
    readabilityScore -= 10;
    readabilityAdvice.push({
      id: "read-education",
      category: "readability",
      priority: "medium",
      title: "Add Education or Degree Details",
      impact: "Required by automated education gatekeeper filters.",
      recommendation: "List your degree, major, and graduation year (or active certifications).",
    });
  } else {
    readabilityHighlights.push("Education credentials clearly formatted");
  }

  readabilityScore = Math.max(readabilityScore, 15);

  // --------------------------------------------------------------------------
  // Overall Weighted Score & Letter Grade Computation
  // --------------------------------------------------------------------------
  const overallScore = Math.round(
    formattingScore * 0.25 +
    lengthScore * 0.25 +
    keywordScore * 0.25 +
    readabilityScore * 0.25
  );

  let letterGrade: LetterGrade = "B";
  let gradeColor = "text-emerald-500";
  let gradeBadgeClass = "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
  let verdict = "Competitive ATS & Recruiter Ready";

  if (overallScore >= 96) {
    letterGrade = "A+";
    gradeColor = "text-emerald-600 dark:text-emerald-400";
    gradeBadgeClass = "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
    verdict = "Top 5% Executive Readability";
  } else if (overallScore >= 92) {
    letterGrade = "A";
    gradeColor = "text-emerald-500";
    gradeBadgeClass = "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    verdict = "Executive ATS Grade";
  } else if (overallScore >= 88) {
    letterGrade = "A-";
    gradeColor = "text-emerald-500";
    gradeBadgeClass = "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    verdict = "Highly Polished";
  } else if (overallScore >= 84) {
    letterGrade = "B+";
    gradeColor = "text-blue-500";
    gradeBadgeClass = "bg-blue-500/10 text-blue-600 border-blue-500/20";
    verdict = "Strong Recruiter Flow";
  } else if (overallScore >= 80) {
    letterGrade = "B";
    gradeColor = "text-blue-500";
    gradeBadgeClass = "bg-blue-500/10 text-blue-600 border-blue-500/20";
    verdict = "Solid Baseline";
  } else if (overallScore >= 76) {
    letterGrade = "B-";
    gradeColor = "text-amber-500";
    gradeBadgeClass = "bg-amber-500/10 text-amber-600 border-amber-500/20";
    verdict = "Minor Polish Recommended";
  } else if (overallScore >= 72) {
    letterGrade = "C+";
    gradeColor = "text-amber-500";
    gradeBadgeClass = "bg-amber-500/10 text-amber-600 border-amber-500/20";
    verdict = "Moderate Readability Gaps";
  } else if (overallScore >= 66) {
    letterGrade = "C";
    gradeColor = "text-amber-600";
    gradeBadgeClass = "bg-amber-500/15 text-amber-700 border-amber-500/30";
    verdict = "Below Average Impact";
  } else if (overallScore >= 58) {
    letterGrade = "D";
    gradeColor = "text-red-500";
    gradeBadgeClass = "bg-red-500/10 text-red-600 border-red-500/20";
    verdict = "High ATS Screening Risk";
  } else {
    letterGrade = "F";
    gradeColor = "text-red-600";
    gradeBadgeClass = "bg-red-500/20 text-red-700 border-red-500/40";
    verdict = "Critical Structural Deficiencies";
  }

  // Combine and sort all actionable advice by priority
  const priorityWeight: Record<ActionableAdvice["priority"], number> = {
    critical: 4,
    high: 3,
    medium: 2,
    tip: 1,
  };

  const allAdvice = [
    ...formattingAdvice,
    ...lengthAdvice,
    ...keywordAdvice,
    ...readabilityAdvice,
  ].sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]);

  const getStatus = (score: number): HealthCategory["status"] =>
    score >= 88 ? "excellent" : score >= 75 ? "good" : score >= 60 ? "needs-work" : "critical";

  return {
    overallScore,
    letterGrade,
    gradeColor,
    gradeBadgeClass,
    verdict,
    categories: {
      formatting: {
        name: "Formatting & Structure",
        score: formattingScore,
        weight: 0.25,
        status: getStatus(formattingScore),
        highlights: formattingHighlights,
      },
      length: {
        name: "Length & Page Budget",
        score: lengthScore,
        weight: 0.25,
        status: getStatus(lengthScore),
        highlights: lengthHighlights,
      },
      keywordDensity: {
        name: "Keyword & Metric Density",
        score: keywordScore,
        weight: 0.25,
        status: getStatus(keywordScore),
        highlights: keywordHighlights,
      },
      readability: {
        name: "Readability & Scannability",
        score: readabilityScore,
        weight: 0.25,
        status: getStatus(readabilityScore),
        highlights: readabilityHighlights,
      },
    },
    metrics: {
      totalWords,
      experienceCount: experiences.length,
      bulletCount: allBullets.length,
      metricBulletCount,
      metricBulletPct,
      skillsCount: skills.length,
      hasSummary: Boolean(summary),
      hasContact: hasEmail && hasPhone,
      hasLinkedIn,
      avgWordsPerBullet,
    },
    actionableAdvice: allAdvice,
  };
}
