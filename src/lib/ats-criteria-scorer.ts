/**
 * ATS Criteria Scoring Utility
 * 
 * Comprehensive parsing and scoring engine assessing resumes against common 
 * Applicant Tracking System (ATS) criteria:
 * 1. Keyword Density & Term Distribution (optimal 1.5% - 3.8%, flag stuffing > 4.5%, flag under-representation < 1%)
 * 2. Formatting Consistency (date format uniformity, bullet punctuation consistency, capitalization, length)
 * 3. Section Taxonomy Standardization (standard ATS-friendly headers vs non-standard)
 * 4. Action Verb Impact & STAR Quantification (metrics %, $, numbers, strong active verbs)
 * 5. Layout & Text Linear Parser Compatibility
 */

import type { ResumeData, JobDescription } from "./types";

export interface KeywordDensityItem {
  keyword: string;
  count: number;
  densityPercent: number; // e.g. 2.1%
  status: "optimal" | "underrepresented" | "overstuffed" | "missing";
  recommendedRange: string;
  locations: string[]; // e.g. ["Experience", "Skills", "Summary"]
}

export interface FormattingIssue {
  id: string;
  severity: "error" | "warning" | "info";
  category: "dates" | "bullets" | "headers" | "typography" | "contact";
  title: string;
  detail: string;
  recommendation: string;
  examples?: string[];
}

export interface FormattingConsistencyMetrics {
  score: number; // 0 - 100
  dateFormatStandard: string;
  dateConsistencyPercent: number;
  bulletPunctuationConsistencyPercent: number;
  bulletPunctuationStyle: "consistent_period" | "consistent_no_period" | "mixed";
  bulletCapitalizationPercent: number;
  sectionHeaderStandardPercent: number;
  issues: FormattingIssue[];
}

export interface KeywordDensityMetrics {
  score: number; // 0 - 100
  totalWordCount: number;
  uniqueWordCount: number;
  averageDensityPercent: number;
  stuffedKeywords: string[];
  optimalKeywords: string[];
  underrepresentedKeywords: string[];
  missingKeywords: string[];
  breakdown: KeywordDensityItem[];
}

export interface ContentImpactMetrics {
  score: number; // 0 - 100
  totalBullets: number;
  actionVerbCount: number;
  actionVerbRatio: number; // 0 - 100%
  quantifiedCount: number;
  quantifiedRatio: number; // 0 - 100%
  weakVerbsDetected: string[];
  strongVerbsDetected: string[];
}

export interface ATSCriteriaScoreResult {
  overallScore: number; // 0 - 100
  grade: "A+" | "A" | "B" | "C" | "D" | "F";
  summary: string;
  keywordDensity: KeywordDensityMetrics;
  formattingConsistency: FormattingConsistencyMetrics;
  contentImpact: ContentImpactMetrics;
  recommendations: Array<{
    type: "keyword" | "formatting" | "impact";
    priority: "high" | "medium" | "low";
    title: string;
    fix: string;
  }>;
  scannedAt: string;
}

// Common stop words to exclude from keyword density analysis
const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
  "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
  "below", "between", "both", "but", "by", "can", "cannot", "could", "did", "do",
  "does", "doing", "don't", "down", "during", "each", "few", "for", "from", "further",
  "had", "has", "have", "having", "he", "her", "here", "hers", "herself", "him",
  "himself", "his", "how", "i", "if", "in", "into", "is", "isn't", "it", "its",
  "itself", "just", "me", "more", "most", "my", "myself", "no", "nor", "not",
  "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours",
  "ourselves", "out", "over", "own", "same", "she", "should", "so", "some",
  "such", "than", "that", "the", "their", "theirs", "them", "themselves", "then",
  "there", "these", "they", "this", "those", "through", "to", "too", "under",
  "until", "up", "very", "was", "wasn't", "we", "were", "weren't", "what", "when",
  "where", "which", "while", "who", "whom", "why", "with", "would", "you", "your",
  "yours", "yourself", "yourselves"
]);

// Strong executive & technical action verbs
const STRONG_ACTION_VERBS = new Set([
  "accelerated", "accomplished", "achieved", "acquired", "adapted", "administered",
  "advised", "advocated", "amplified", "analyzed", "architected", "audited", "automated",
  "boosted", "budgeted", "built", "centralized", "championed", "coached", "collaborated",
  "commercialized", "compiled", "composed", "configured", "consolidated", "constructed",
  "converted", "coordinated", "created", "customized", "debugged", "decreased", "defined",
  "delegated", "delivered", "deployed", "designed", "developed", "devised", "diagnosed",
  "directed", "discovered", "dispatched", "diversified", "documented", "doubled", "drafted",
  "drove", "eliminated", "enabled", "enacted", "engineered", "enhanced", "established",
  "evaluated", "executed", "expanded", "expedited", "fabricated", "facilitated", "finalized",
  "forecasted", "formulated", "founded", "generated", "governed", "guided", "halted",
  "headed", "heightened", "identified", "implemented", "improved", "improvised", "increased",
  "indexed", "initiated", "innovated", "inspected", "installed", "instituted", "integrated",
  "intensified", "intercepted", "invented", "investigated", "launched", "lead", "led",
  "leveraged", "maintained", "managed", "mapped", "marketed", "maximized", "mentored",
  "migrated", "minimized", "mobilized", "modernized", "negotiated", "optimized", "orchestrated",
  "organized", "outperformed", "overhauled", "oversaw", "partnered", "performed", "pioneered",
  "planned", "prevented", "produced", "programmed", "promoted", "proposed", "published",
  "quantified", "re-engineered", "rebuilt", "recruited", "redesigned", "reduced", "refined",
  "refactored", "remodeled", "reorganized", "replaced", "resolved", "restructured", "revamped",
  "scaled", "scheduled", "secured", "simplified", "slashed", "spearheaded", "standardized",
  "steered", "streamlined", "strengthened", "structured", "superseded", "supervised",
  "synchronized", "systematized", "targeted", "tested", "tracked", "trained", "transformed",
  "transitioned", "translated", "tripled", "troubleshot", "unified", "upgraded", "validated",
  "verified", "yielded"
]);

// Weak or passive phrasing to avoid
const WEAK_PASSIVE_VERBS = [
  "responsible for", "helped with", "worked on", "assisted in", "duties included",
  "participated in", "tasked with", "handled", "involved in", "tried to", "supported the"
];

// Standard ATS recognized section titles
const STANDARD_ATS_HEADERS = [
  "experience", "work experience", "professional experience", "employment history",
  "education", "academic background", "education & credentials",
  "skills", "core skills", "technical skills", "technical proficiencies", "key competencies",
  "projects", "key projects", "notable projects",
  "certifications", "licenses & certifications", "certificates",
  "summary", "professional summary", "executive profile", "about me",
  "languages", "languages & proficiencies", "volunteer", "publications"
];

/**
 * Clean and tokenize raw text into words
 */
export function tokenizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

/**
 * Analyze keyword density across the resume content
 */
export function analyzeKeywordDensity(
  resume: ResumeData,
  targetKeywords?: string[]
): KeywordDensityMetrics {
  const sections: { name: string; text: string }[] = [
    { name: "Summary", text: resume.summary || "" },
    {
      name: "Experience",
      text: (resume.experience || [])
        .map((e) => `${e.title} ${e.company} ${(e.bullets || []).join(" ")}`)
        .join(" "),
    },
    {
      name: "Skills",
      text: (resume.skills || []).map((s) => s.name).join(" "),
    },
    {
      name: "Education",
      text: (resume.education || [])
        .map((ed) => `${ed.degree} ${ed.institution} ${ed.field || ""}`)
        .join(" "),
    },
    {
      name: "Projects",
      text: (resume.projects || [])
        .map((p) => `${p.name} ${p.description || ""} ${(p.bullets || []).join(" ")}`)
        .join(" "),
    },
    {
      name: "Certifications",
      text: (resume.certifications || []).map((c) => `${c.name} ${c.issuer || ""}`).join(" "),
    },
  ];

  const fullText = sections.map((s) => s.text).join(" ");
  const allTokens = tokenizeWords(fullText);
  const totalWordCount = allTokens.length;

  if (totalWordCount === 0) {
    return {
      score: 50,
      totalWordCount: 0,
      uniqueWordCount: 0,
      averageDensityPercent: 0,
      stuffedKeywords: [],
      optimalKeywords: [],
      underrepresentedKeywords: [],
      missingKeywords: targetKeywords || [],
      breakdown: [],
    };
  }

  // Count word frequencies
  const freqMap = new Map<string, number>();
  for (const token of allTokens) {
    freqMap.set(token, (freqMap.get(token) || 0) + 1);
  }

  // Determine which keywords to check: target keywords if provided, else top frequent terms
  let candidateKeywords: string[] = [];
  if (targetKeywords && targetKeywords.length > 0) {
    candidateKeywords = targetKeywords.map((k) => k.toLowerCase().trim()).filter(Boolean);
  } else {
    // Derive top meaningful terms from skills and experience
    const skillTerms = (resume.skills || []).map((s) => s.name.toLowerCase().trim());
    const topFreq = Array.from(freqMap.entries())
      .filter(([word]) => word.length >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([word]) => word);
    candidateKeywords = Array.from(new Set([...skillTerms, ...topFreq]));
  }

  const breakdown: KeywordDensityItem[] = [];
  const stuffedKeywords: string[] = [];
  const optimalKeywords: string[] = [];
  const underrepresentedKeywords: string[] = [];
  const missingKeywords: string[] = [];

  for (const kw of candidateKeywords) {
    const kwLower = kw.toLowerCase();
    const count = freqMap.get(kwLower) || 0;
    const densityPercent = Number(((count / totalWordCount) * 100).toFixed(2));

    // Determine occurrences across sections
    const locations: string[] = [];
    for (const sec of sections) {
      if (sec.text.toLowerCase().includes(kwLower)) {
        locations.push(sec.name);
      }
    }

    let status: KeywordDensityItem["status"];
    if (count === 0) {
      status = "missing";
      missingKeywords.push(kw);
    } else if (densityPercent > 4.5) {
      status = "overstuffed";
      stuffedKeywords.push(kw);
    } else if (densityPercent >= 1.2 && densityPercent <= 3.8) {
      status = "optimal";
      optimalKeywords.push(kw);
    } else {
      status = "underrepresented";
      underrepresentedKeywords.push(kw);
    }

    breakdown.push({
      keyword: kw,
      count,
      densityPercent,
      status,
      recommendedRange: "1.5% - 3.5%",
      locations,
    });
  }

  // Calculate score based on keyword balance
  let score = 100;
  // Penalty for overstuffed (stuffing triggers ATS spam filters)
  score -= stuffedKeywords.length * 15;
  // Penalty for missing target keywords
  score -= missingKeywords.length * 6;
  // Bonus for optimal keywords
  if (optimalKeywords.length >= 5) {
    score = Math.min(100, score + 10);
  }
  score = Math.max(10, Math.min(100, score));

  const averageDensityPercent = breakdown.length > 0
    ? Number((breakdown.reduce((sum, item) => sum + item.densityPercent, 0) / breakdown.length).toFixed(2))
    : 0;

  return {
    score,
    totalWordCount,
    uniqueWordCount: freqMap.size,
    averageDensityPercent,
    stuffedKeywords,
    optimalKeywords,
    underrepresentedKeywords,
    missingKeywords,
    breakdown: breakdown.sort((a, b) => b.densityPercent - a.densityPercent),
  };
}

/**
 * Analyze formatting consistency across the resume
 */
export function analyzeFormattingConsistency(resume: ResumeData): FormattingConsistencyMetrics {
  const issues: FormattingIssue[] = [];

  // 1. DATE FORMAT CONSISTENCY CHECK
  const allDateStrings: string[] = [];
  (resume.experience || []).forEach((e) => {
    if (e.startDate) allDateStrings.push(e.startDate.trim());
    if (e.endDate && !e.current) allDateStrings.push(e.endDate.trim());
  });
  (resume.education || []).forEach((ed) => {
    if (ed.startDate) allDateStrings.push(ed.startDate.trim());
    if (ed.endDate) allDateStrings.push(ed.endDate.trim());
  });

  let dateScore = 100;
  let dominantPattern = "YYYY-MM";
  let dateConsistencyPercent = 100;

  if (allDateStrings.length > 1) {
    // Regex classification
    // 1: YYYY-MM (e.g. "2023-05")
    // 2: MMM YYYY (e.g. "May 2023")
    // 3: MM/YYYY (e.g. "05/2023")
    // 4: YYYY (e.g. "2023")
    const patterns = {
      isoYearMonth: /^\d{4}-\d{2}$/,
      monthNameYear: /^[A-Za-z]{3,9}\s+\d{4}$/,
      monthSlashYear: /^\d{1,2}\/\d{4}$/,
      yearOnly: /^\d{4}$/,
    };

    let counts = {
      isoYearMonth: 0,
      monthNameYear: 0,
      monthSlashYear: 0,
      yearOnly: 0,
      other: 0,
    };

    allDateStrings.forEach((d) => {
      if (patterns.isoYearMonth.test(d)) counts.isoYearMonth++;
      else if (patterns.monthNameYear.test(d)) counts.monthNameYear++;
      else if (patterns.monthSlashYear.test(d)) counts.monthSlashYear++;
      else if (patterns.yearOnly.test(d)) counts.yearOnly++;
      else counts.other++;
    });

    const maxCount = Math.max(...Object.values(counts));
    dateConsistencyPercent = Math.round((maxCount / allDateStrings.length) * 100);

    const dominantEntry = Object.entries(counts).find(([_, c]) => c === maxCount);
    dominantPattern = dominantEntry ? dominantEntry[0] : "Mixed";

    if (dateConsistencyPercent < 80) {
      dateScore = Math.max(40, dateConsistencyPercent);
      issues.push({
        id: "date-format-inconsistency",
        severity: "warning",
        category: "dates",
        title: "Inconsistent Date Formatting",
        detail: `Found mixed date styles across experience & education (${dateConsistencyPercent}% consistency). ATS parsers may fail to calculate tenure properly.`,
        recommendation: "Standardize all dates to a single pattern like 'Jan 2021 - Present' or '2021-01 - 2023-04'.",
        examples: allDateStrings.slice(0, 4),
      });
    }
  }

  // 2. BULLET POINT PUNCTUATION & CAPITALIZATION CONSISTENCY
  const allBullets: string[] = [];
  (resume.experience || []).forEach((e) => {
    (e.bullets || []).forEach((b) => {
      const clean = b.trim();
      if (clean) allBullets.push(clean);
    });
  });
  (resume.projects || []).forEach((p) => {
    (p.bullets || []).forEach((b) => {
      const clean = b.trim();
      if (clean) allBullets.push(clean);
    });
  });

  let bulletPunctuationScore = 100;
  let bulletPunctuationStyle: FormattingConsistencyMetrics["bulletPunctuationStyle"] = "consistent_period";
  let bulletPunctuationConsistencyPercent = 100;
  let bulletCapitalizationPercent = 100;

  if (allBullets.length > 2) {
    let withPeriod = 0;
    let withoutPeriod = 0;
    let capitalized = 0;
    let tooShort = 0;
    let tooLong = 0;

    allBullets.forEach((bullet) => {
      const trimmed = bullet.trim();
      if (trimmed.endsWith(".") || trimmed.endsWith(";") || trimmed.endsWith("!")) {
        withPeriod++;
      } else {
        withoutPeriod++;
      }

      // Capitalization check
      const firstChar = trimmed.charAt(0);
      if (firstChar === firstChar.toUpperCase() && /[A-Z]/.test(firstChar)) {
        capitalized++;
      }

      if (trimmed.length < 25) tooShort++;
      if (trimmed.length > 320) tooLong++;
    });

    bulletCapitalizationPercent = Math.round((capitalized / allBullets.length) * 100);
    const majorityPunctuation = Math.max(withPeriod, withoutPeriod);
    bulletPunctuationConsistencyPercent = Math.round((majorityPunctuation / allBullets.length) * 100);

    if (bulletPunctuationConsistencyPercent < 85) {
      bulletPunctuationStyle = "mixed";
      bulletPunctuationScore = 65;
      issues.push({
        id: "bullet-punctuation-mixed",
        severity: "warning",
        category: "bullets",
        title: "Mixed Bullet Point Ending Punctuation",
        detail: `${withPeriod} bullets end with a period, while ${withoutPeriod} bullets omit periods. Recruiter and automated ATS scans penalize typographic sloppiness.`,
        recommendation: "Choose one standard: either end every bullet with a period, or leave all bullets without ending punctuation.",
      });
    } else {
      bulletPunctuationStyle = withPeriod >= withoutPeriod ? "consistent_period" : "consistent_no_period";
    }

    if (bulletCapitalizationPercent < 90) {
      issues.push({
        id: "bullet-capitalization-mixed",
        severity: "warning",
        category: "bullets",
        title: "Inconsistent Bullet Capitalization",
        detail: `${allBullets.length - capitalized} bullets start with lowercase characters.`,
        recommendation: "Ensure every bullet starts with a capitalized strong action verb.",
      });
    }

    if (tooShort > 0) {
      issues.push({
        id: "bullet-too-short",
        severity: "info",
        category: "bullets",
        title: "Under-detailed Short Bullets",
        detail: `${tooShort} bullets have fewer than 25 characters.`,
        recommendation: "Expand short bullets using the STAR method (Action + Context + Quantifiable Result).",
      });
    }

    if (tooLong > 0) {
      issues.push({
        id: "bullet-too-long",
        severity: "info",
        category: "bullets",
        title: "Run-on Paragraph Bullets",
        detail: `${tooLong} bullets exceed 320 characters, which ATS line parsers often truncate or miscategorize.`,
        recommendation: "Split dense bullets into 2 concise, focused accomplishment points.",
      });
    }
  }

  // 3. SECTION TAXONOMY & HEADERS
  let headerScore = 100;
  const standardHeadersFound = new Set<string>();
  const customSections = resume.dynamicSections || [];
  customSections.forEach((sec) => {
    const title = (sec.title || "").toLowerCase().trim();
    const isStandard = STANDARD_ATS_HEADERS.some((h) => title.includes(h));
    if (isStandard) standardHeadersFound.add(title);
    else {
      issues.push({
        id: `non-standard-header-${sec.id}`,
        severity: "info",
        category: "headers",
        title: `Non-Standard Section Title: "${sec.title}"`,
        detail: `ATS algorithms rely on standard taxonomy headings (e.g. Experience, Skills, Education).`,
        recommendation: `Rename "${sec.title}" to a recognized industry header.`,
      });
    }
  });

  const sectionHeaderStandardPercent = customSections.length > 0
    ? Math.round((standardHeadersFound.size / customSections.length) * 100)
    : 100;

  // 4. CONTACT SAFETY & FORMATTING
  const contact = resume.contact || {};
  if (!contact.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
    issues.push({
      id: "contact-invalid-email",
      severity: "error",
      category: "contact",
      title: "Missing or Malformed Email Address",
      detail: "ATS bots cannot auto-populate your candidate profile without a valid email header.",
      recommendation: "Provide a standard professional email (e.g., name@gmail.com).",
    });
  }

  if (contact.phone && /[a-zA-Z]/.test(contact.phone)) {
    issues.push({
      id: "contact-phone-letters",
      severity: "warning",
      category: "contact",
      title: "Phone Number Contains Letters",
      detail: `Phone "${contact.phone}" contains non-numeric alphabetic characters that break phone dialers and parsers.`,
      recommendation: "Use standard international digits: e.g. +1 555-012-3456.",
    });
  }

  // Composite formatting score
  let overallFormattingScore = Math.round(
    dateScore * 0.35 +
    bulletPunctuationScore * 0.35 +
    (bulletCapitalizationPercent / 100) * 15 +
    (sectionHeaderStandardPercent / 100) * 15
  );

  // Severe deductions for critical errors
  if (issues.some((i) => i.severity === "error")) {
    overallFormattingScore = Math.min(65, overallFormattingScore);
  }

  return {
    score: Math.max(10, Math.min(100, overallFormattingScore)),
    dateFormatStandard: dominantPattern,
    dateConsistencyPercent,
    bulletPunctuationConsistencyPercent,
    bulletPunctuationStyle,
    bulletCapitalizationPercent,
    sectionHeaderStandardPercent,
    issues,
  };
}

/**
 * Analyze content impact: Action verbs, STAR metrics, and quantification
 */
export function analyzeContentImpact(resume: ResumeData): ContentImpactMetrics {
  const allBullets: string[] = [];
  (resume.experience || []).forEach((e) => {
    (e.bullets || []).forEach((b) => {
      const clean = b.trim();
      if (clean) allBullets.push(clean);
    });
  });

  if (allBullets.length === 0) {
    return {
      score: 50,
      totalBullets: 0,
      actionVerbCount: 0,
      actionVerbRatio: 0,
      quantifiedCount: 0,
      quantifiedRatio: 0,
      weakVerbsDetected: [],
      strongVerbsDetected: [],
    };
  }

  let actionVerbCount = 0;
  let quantifiedCount = 0;
  const weakVerbsDetected = new Set<string>();
  const strongVerbsDetected = new Set<string>();

  // Quantification regex: numbers, %, $, €, £, metrics, "X to Y", ratios
  const quantRegex = /(\d+[\d,.]*|\b\d+%\b|\$[\d,.]+|\b(k|m|b)\b|\b\d+\s*(users|clients|team|percent|revenue|growth|projects)\b)/i;

  allBullets.forEach((bullet) => {
    const lower = bullet.toLowerCase();

    // Check first word for strong action verb
    const firstWord = lower.split(/\s+/)[0]?.replace(/[^\w]/g, "");
    if (firstWord && STRONG_ACTION_VERBS.has(firstWord)) {
      actionVerbCount++;
      strongVerbsDetected.add(firstWord);
    }

    // Check for weak passive phrases
    WEAK_PASSIVE_VERBS.forEach((phrase) => {
      if (lower.startsWith(phrase) || lower.includes(` ${phrase} `)) {
        weakVerbsDetected.add(phrase);
      }
    });

    // Check quantification
    if (quantRegex.test(bullet)) {
      quantifiedCount++;
    }
  });

  const actionVerbRatio = Math.round((actionVerbCount / allBullets.length) * 100);
  const quantifiedRatio = Math.round((quantifiedCount / allBullets.length) * 100);

  // Scoring impact
  let score = Math.round(actionVerbRatio * 0.5 + quantifiedRatio * 0.5);
  if (weakVerbsDetected.size > 0) {
    score = Math.max(10, score - weakVerbsDetected.size * 5);
  }

  return {
    score: Math.max(10, Math.min(100, score)),
    totalBullets: allBullets.length,
    actionVerbCount,
    actionVerbRatio,
    quantifiedCount,
    quantifiedRatio,
    weakVerbsDetected: Array.from(weakVerbsDetected),
    strongVerbsDetected: Array.from(strongVerbsDetected),
  };
}

/**
 * Main entrance: Full ATS Criteria Scorer
 */
export function scoreResumeATSCriteria(
  resume: ResumeData,
  options?: {
    targetJobDescription?: JobDescription | string;
    customKeywords?: string[];
  }
): ATSCriteriaScoreResult {
  // Extract custom or JD keywords if provided
  let targetKeywords: string[] = options?.customKeywords || [];
  if (options?.targetJobDescription) {
    if (typeof options.targetJobDescription === "string") {
      targetKeywords = tokenizeWords(options.targetJobDescription).slice(0, 20);
    } else if (Array.isArray(options.targetJobDescription.keywords)) {
      targetKeywords = options.targetJobDescription.keywords;
    }
  }

  const keywordDensity = analyzeKeywordDensity(resume, targetKeywords);
  const formattingConsistency = analyzeFormattingConsistency(resume);
  const contentImpact = analyzeContentImpact(resume);

  // Weighted composite ATS Criteria score
  // Keywords (35%), Formatting Consistency (35%), Content Impact (30%)
  const overallScore = Math.round(
    keywordDensity.score * 0.35 +
    formattingConsistency.score * 0.35 +
    contentImpact.score * 0.30
  );

  let grade: ATSCriteriaScoreResult["grade"] = "F";
  if (overallScore >= 90) grade = "A+";
  else if (overallScore >= 80) grade = "A";
  else if (overallScore >= 70) grade = "B";
  else if (overallScore >= 60) grade = "C";
  else if (overallScore >= 50) grade = "D";

  // Prioritized recommendations
  const recommendations: ATSCriteriaScoreResult["recommendations"] = [];

  if (formattingConsistency.issues.length > 0) {
    formattingConsistency.issues.forEach((issue) => {
      recommendations.push({
        type: "formatting",
        priority: issue.severity === "error" ? "high" : issue.severity === "warning" ? "medium" : "low",
        title: issue.title,
        fix: issue.recommendation,
      });
    });
  }

  if (keywordDensity.stuffedKeywords.length > 0) {
    recommendations.push({
      type: "keyword",
      priority: "high",
      title: "Reduce Keyword Over-Stuffing",
      fix: `The terms [${keywordDensity.stuffedKeywords.slice(0, 4).join(", ")}] have excessive density (> 4.5%). Reduce repetitive mentions to avoid spam penalties.`,
    });
  }

  if (keywordDensity.missingKeywords.length > 0) {
    recommendations.push({
      type: "keyword",
      priority: "high",
      title: "Incorporate High-Relevance Target Keywords",
      fix: `Incorporate missing domain terms [${keywordDensity.missingKeywords.slice(0, 5).join(", ")}] into your experience bullets and skills section.`,
    });
  }

  if (contentImpact.weakVerbsDetected.length > 0) {
    recommendations.push({
      type: "impact",
      priority: "medium",
      title: "Replace Passive Duty Phrases with Active Verbs",
      fix: `Swap weak phrases (${contentImpact.weakVerbsDetected.join(", ")}) for high-impact verbs like 'Spearheaded', 'Engineered', 'Optimized'.`,
    });
  }

  if (contentImpact.quantifiedRatio < 40) {
    recommendations.push({
      type: "impact",
      priority: "medium",
      title: "Add Measurable Metrics to Achievements",
      fix: `Only ${contentImpact.quantifiedRatio}% of your bullets contain measurable metrics (%, $, scale). Aim for at least 50% quantified bullets.`,
    });
  }

  const summary = overallScore >= 85
    ? "Outstanding ATS compliance! Your resume exhibits pristine formatting consistency and optimal keyword density."
    : overallScore >= 70
    ? "Good ATS compatibility with minor formatting or keyword density adjustments needed for top ranking."
    : "Multiple ATS parsing hurdles detected (formatting inconsistencies, suboptimal keyword distribution, or lack of quantified impact).";

  return {
    overallScore,
    grade,
    summary,
    keywordDensity,
    formattingConsistency,
    contentImpact,
    recommendations,
    scannedAt: new Date().toISOString(),
  };
}

/**
 * Utility to parse and score plain resume text
 */
export function parseAndScoreResumeText(
  rawText: string,
  options?: { targetKeywords?: string[] }
): ATSCriteriaScoreResult {
  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
  const emailMatch = rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = rawText.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);

  // Extract bullet points
  const bulletLines = lines.filter((l) => /^[•\-\*–]\s+/.test(l) || /^\d+\.\s+/.test(l));
  const cleanBullets = bulletLines.map((b) => b.replace(/^[•\-\*–\d.]\s*/, "").trim());

  const mockResume: ResumeData = {
    id: "raw-text-parsed",
    name: lines[0] || "Candidate",
    headline: lines[1] || "",
    summary: rawText.slice(0, 300),
    contact: {
      email: emailMatch ? emailMatch[0] : "",
      phone: phoneMatch ? phoneMatch[0] : "",
      location: "",
    },
    experience: [
      {
        id: "exp-1",
        title: "Professional Experience",
        company: "Company",
        bullets: cleanBullets.length > 0 ? cleanBullets : lines.slice(2, 10),
      },
    ],
    education: [],
    skills: tokenizeWords(rawText).slice(0, 15).map((w, idx) => ({ id: `sk-${idx}`, name: w })),
    projects: [],
    certifications: [],
    languages: [],
    achievements: [],
  };

  return scoreResumeATSCriteria(mockResume, { customKeywords: options?.targetKeywords });
}
