// ============================================================================
// ResumeAI Pro — Real-time Resume Strength Scoring Engine
// Evaluates real-time keyword coverage against target Job Descriptions
// ============================================================================

import type { ResumeData, JobDescription } from "./types";
import { filterJunkKeywords } from "./keyword-quality";
import { COMMON_ATS_KEYWORDS } from "./keyword-banks";

export interface StrengthMetrics {
  score: number;
  level: "exceptional" | "strong" | "competitive" | "needs_work";
  levelLabel: string;
  levelColor: string;
  matchedKeywords: string[];
  missingKeywords: string[];
  totalKeywords: number;
  matchPercentage: number;
  breakdown: {
    keywordMatch: number;
    coreSkills: number;
    experienceDensity: number;
    quantifiableImpact: number;
  };
  suggestions: string[];
  comparedRoleTitle: string;
}

export interface PresetRole {
  id: string;
  title: string;
  industry: string;
  keywords: string[];
  coreSkills: string[];
}

export const PRESET_TARGET_ROLES: PresetRole[] = [
  {
    id: "software_eng",
    title: "Software Engineer",
    industry: "Technology",
    keywords: [
      "typescript", "javascript", "react", "node.js", "python", "api", "git",
      "ci/cd", "cloud", "docker", "agile", "testing", "microservices", "sql", "performance", "architecture"
    ],
    coreSkills: ["react", "typescript", "node.js", "git", "api", "sql"],
  },
  {
    id: "product_mgr",
    title: "Product Manager",
    industry: "Technology & Business",
    keywords: [
      "roadmap", "user stories", "kpis", "agile", "stakeholder management", "market research",
      "analytics", "cross-functional", "prioritization", "ux", "launch", "strategy", "mvp", "a/b testing"
    ],
    coreSkills: ["roadmap", "kpis", "agile", "cross-functional", "analytics", "strategy"],
  },
  {
    id: "data_ai",
    title: "Data & AI Specialist",
    industry: "Data Science",
    keywords: [
      "python", "sql", "machine learning", "pandas", "data visualization", "tableau",
      "etl", "deep learning", "statistics", "feature engineering", "llm", "pipeline", "predictive modeling"
    ],
    coreSkills: ["python", "sql", "machine learning", "data visualization", "etl"],
  },
  {
    id: "aviation_crew",
    title: "Cabin Crew / Aviation",
    industry: "Aviation & Hospitality",
    keywords: [
      "safety", "emergency evacuation", "first aid", "cpr", "customer service excellence",
      "in-flight service", "communication", "cultural awareness", "conflict resolution", "teamwork", "crm"
    ],
    coreSkills: ["safety", "emergency evacuation", "first aid", "customer service excellence", "in-flight service"],
  },
  {
    id: "biz_ops",
    title: "Business Operations & Growth",
    industry: "Operations",
    keywords: [
      "operations", "process optimization", "workflow", "reporting", "budgeting",
      "vendor management", "cross-functional leadership", "efficiency", "client relations", "p&l"
    ],
    coreSkills: ["operations", "process optimization", "workflow", "budgeting", "cross-functional leadership"],
  },
];

/**
 * Clean & normalize a keyword token.
 */
function cleanTerm(term: string): string {
  return term
    .toLowerCase()
    .trim()
    .replace(/[^\w\s+#.-]/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Check if a term exists in a target text block with boundary sensitivity for short tokens.
 */
function termMatchesText(term: string, text: string): boolean {
  const t = cleanTerm(term);
  if (!t || t.length < 2) return false;
  const target = text.toLowerCase();
  
  // For short tokens (e.g. "go", "r", "c#", "git"), enforce word boundaries
  if (t.length <= 4 && !t.includes(" ")) {
    const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(^|[^a-z0-9+#])${escaped}([^a-z0-9+#]|$)`, "i");
    return regex.test(target);
  }

  return target.includes(t);
}

/**
 * Flatten all text in a resume into searchable buckets.
 */
function flattenResumeText(resume: ResumeData): {
  fullText: string;
  summaryText: string;
  experienceText: string;
  skillsText: string;
  projectsText: string;
  bulletTexts: string[];
} {
  const summary = [resume.name, resume.headline, resume.summary].filter(Boolean).join(" ");
  
  const bullets: string[] = [];
  const expParts: string[] = [];
  for (const exp of resume.experience || []) {
    if (exp.title) expParts.push(exp.title);
    if (exp.company) expParts.push(exp.company);
    for (const b of exp.bullets || []) {
      bullets.push(b);
      expParts.push(b);
    }
  }

  const skillParts: string[] = (resume.skills || []).map((s) => s.name);
  for (const lang of resume.languages || []) {
    const lName = typeof lang === "string" ? lang : (lang as any)?.name || (lang as any)?.language;
    if (lName) skillParts.push(lName);
  }

  const projParts: string[] = [];
  for (const p of resume.projects || []) {
    if (p.name) projParts.push(p.name);
    if (p.description) projParts.push(p.description);
    for (const b of p.bullets || []) {
      bullets.push(b);
      projParts.push(b);
    }
  }

  const experienceText = expParts.join(" ");
  const skillsText = skillParts.join(" ");
  const projectsText = projParts.join(" ");
  const fullText = [summary, experienceText, skillsText, projectsText].join(" ");

  return {
    fullText,
    summaryText: summary,
    experienceText,
    skillsText,
    projectsText,
    bulletTexts: bullets,
  };
}

/**
 * Extract target keywords from a JobDescription or list of JobDescriptions.
 */
export function extractTargetKeywords(
  jd?: JobDescription | null,
  allJds?: JobDescription[],
  fallbackPresetId: string = "software_eng"
): { keywords: string[]; coreSkills: string[]; roleTitle: string } {
  const keywordSet = new Set<string>();
  const coreSkillSet = new Set<string>();
  let roleTitle = "";

  if (jd) {
    roleTitle = jd.title || jd.company || "Target Job Description";
    
    // Add explicitly tagged keywords
    for (const k of jd.keywords || []) {
      const c = cleanTerm(k);
      if (c && c.length >= 2) keywordSet.add(c);
    }

    // Add structured required skills
    const reqSkills = (jd as any).requiredSkills;
    if (Array.isArray(reqSkills)) {
      for (const s of reqSkills) {
        const c = cleanTerm(s);
        if (c && c.length >= 2) {
          keywordSet.add(c);
          coreSkillSet.add(c);
        }
      }
    }

    // Add technologies
    const techs = (jd as any).technologies;
    if (Array.isArray(techs)) {
      for (const t of techs) {
        const c = cleanTerm(t);
        if (c && c.length >= 2) {
          keywordSet.add(c);
          coreSkillSet.add(c);
        }
      }
    }

    // Add requirements
    if (Array.isArray(jd.requirements)) {
      for (const req of jd.requirements) {
        const words = cleanTerm(req).split(" ").filter((w) => w.length > 4);
        for (const w of words.slice(0, 4)) keywordSet.add(w);
      }
    }

    // If still few keywords, inspect rawText / content
    if (keywordSet.size < 6 && (jd.rawText || jd.content)) {
      const text = `${jd.rawText || ""} ${jd.content || ""}`;
      const commonTerms = [...COMMON_ATS_KEYWORDS, "communication", "leadership", "analytics", "cross-functional"];
      for (const term of commonTerms) {
        if (termMatchesText(term, text)) keywordSet.add(term);
      }
    }
  } else if (allJds && allJds.length > 0) {
    roleTitle = `${allJds.length} Saved Job Descriptions`;
    for (const item of allJds) {
      for (const k of item.keywords || []) {
        const c = cleanTerm(k);
        if (c && c.length >= 2) keywordSet.add(c);
      }
      const itemSkills = (item as any).requiredSkills;
      if (Array.isArray(itemSkills)) {
        for (const s of itemSkills) {
          const c = cleanTerm(s);
          if (c && c.length >= 2) {
            keywordSet.add(c);
            coreSkillSet.add(c);
          }
        }
      }
    }
  }

  // Fallback to preset role keywords if no JD keywords found
  if (keywordSet.size === 0) {
    const preset = PRESET_TARGET_ROLES.find((p) => p.id === fallbackPresetId) || PRESET_TARGET_ROLES[0];
    roleTitle = preset.title;
    preset.keywords.forEach((k) => keywordSet.add(k));
    preset.coreSkills.forEach((k) => coreSkillSet.add(k));
  }

  const rawKeywords = Array.from(keywordSet);
  const filtered = filterJunkKeywords(rawKeywords);
  const keywords = filtered.length >= 3 ? filtered : rawKeywords;

  return {
    keywords,
    coreSkills: Array.from(coreSkillSet),
    roleTitle,
  };
}

/**
 * Calculate Real-time Resume Strength Score based on Keyword Matches against Job Descriptions.
 */
export function calculateResumeStrength(
  resume: ResumeData | null | undefined,
  targetJd?: JobDescription | null,
  allJds?: JobDescription[],
  fallbackPresetId: string = "software_eng"
): StrengthMetrics {
  if (!resume) {
    return {
      score: 0,
      level: "needs_work",
      levelLabel: "No Resume Selected",
      levelColor: "#94A3B8",
      matchedKeywords: [],
      missingKeywords: [],
      totalKeywords: 0,
      matchPercentage: 0,
      breakdown: {
        keywordMatch: 0,
        coreSkills: 0,
        experienceDensity: 0,
        quantifiableImpact: 0,
      },
      suggestions: ["Select or create a resume to see your real-time score."],
      comparedRoleTitle: "No Target Role",
    };
  }

  const { keywords, coreSkills, roleTitle } = extractTargetKeywords(targetJd, allJds, fallbackPresetId);
  const { fullText, experienceText, skillsText, bulletTexts } = flattenResumeText(resume);

  const matchedKeywords: string[] = [];
  const missingKeywords: string[] = [];

  for (const kw of keywords) {
    if (termMatchesText(kw, fullText)) {
      matchedKeywords.push(kw);
    } else {
      missingKeywords.push(kw);
    }
  }

  const totalKeywords = keywords.length;
  const matchPercentage = totalKeywords > 0 ? Math.round((matchedKeywords.length / totalKeywords) * 100) : 0;

  // Breakdown 1: Keyword Match Coverage (0 - 100)
  const keywordScore = matchPercentage;

  // Breakdown 2: Core Skills Coverage (0 - 100)
  let coreSkillsScore = 0;
  if (coreSkills.length > 0) {
    const matchedCore = coreSkills.filter((c) => termMatchesText(c, skillsText) || termMatchesText(c, fullText));
    coreSkillsScore = Math.round((matchedCore.length / coreSkills.length) * 100);
  } else {
    // If no explicit core skills, evaluate skills count and match inside skills text
    const skillsMatched = matchedKeywords.filter((k) => termMatchesText(k, skillsText)).length;
    const baseCoverage = (resume.skills || []).length >= 5 ? 70 : (resume.skills || []).length * 14;
    coreSkillsScore = Math.min(100, Math.round(baseCoverage + skillsMatched * 4));
  }

  // Breakdown 3: Experience Density (Keywords in actual experience bullets)
  let expHits = 0;
  for (const kw of matchedKeywords) {
    if (termMatchesText(kw, experienceText)) expHits++;
  }
  const expDensityScore = totalKeywords > 0 ? Math.min(100, Math.round((expHits / (totalKeywords * 0.75)) * 100)) : 50;

  // Breakdown 4: Quantifiable Impact (Metrics, numbers, % in bullets)
  let metricBulletCount = 0;
  const metricRegex = /(\d+[%kKmMbB]?|\$\d+|\d+\+|\d+x)/;
  for (const bullet of bulletTexts) {
    if (metricRegex.test(bullet)) {
      metricBulletCount++;
    }
  }
  const metricRatio = bulletTexts.length > 0 ? metricBulletCount / bulletTexts.length : 0;
  const quantifiableImpact = Math.min(100, Math.round(metricRatio * 150)); // ~66% metric bullets yields 100

  // Composite Weighted Score:
  // 45% Keyword Match + 25% Core Skills + 15% Experience Density + 15% Quantifiable Impact
  const rawScore = Math.round(
    keywordScore * 0.45 +
    coreSkillsScore * 0.25 +
    expDensityScore * 0.15 +
    quantifiableImpact * 0.15
  );

  const score = Math.max(5, Math.min(99, rawScore));

  let level: StrengthMetrics["level"] = "needs_work";
  let levelLabel = "Needs Optimization";
  let levelColor = "#EF4444"; // red-500

  if (score >= 80) {
    level = "exceptional";
    levelLabel = "ATS Ready & Strong";
    levelColor = "#10B981"; // emerald-500
  } else if (score >= 65) {
    level = "strong";
    levelLabel = "Competitive Match";
    levelColor = "#1154A3"; // brand-blue
  } else if (score >= 48) {
    level = "competitive";
    levelLabel = "Moderate Match";
    levelColor = "#F59E0B"; // amber-500
  } else {
    level = "needs_work";
    levelLabel = "Low Keyword Match";
    levelColor = "#EF4444"; // red-500
  }

  const suggestions: string[] = [];
  if (missingKeywords.length > 0) {
    suggestions.push(`Integrate missing keywords: ${missingKeywords.slice(0, 3).join(", ")}.`);
  }
  if (quantifiableImpact < 60) {
    suggestions.push("Add more quantifiable numbers, percentages, and metrics to your experience bullets.");
  }
  if (coreSkillsScore < 70) {
    suggestions.push("Ensure required tech stack skills are explicitly listed in your Skills section.");
  }
  if (suggestions.length === 0) {
    suggestions.push("Excellent keyword distribution and measurable impact across all sections!");
  }

  return {
    score,
    level,
    levelLabel,
    levelColor,
    matchedKeywords,
    missingKeywords,
    totalKeywords,
    matchPercentage,
    breakdown: {
      keywordMatch: keywordScore,
      coreSkills: coreSkillsScore,
      experienceDensity: expDensityScore,
      quantifiableImpact,
    },
    suggestions,
    comparedRoleTitle: roleTitle,
  };
}
