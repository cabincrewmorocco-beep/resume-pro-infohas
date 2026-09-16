// ============================================================================
// OptimizerOutputValidator — directive §11 (keyword accountability) + §24/§25
// (no bad output propagation).
//
// Validates the Bullet-Only Optimizer's raw output BEFORE assembly and BEFORE
// any downstream agent (Resume Repair, QA, Reflection, Assembler) may consume
// it. A result that integrates zero JD keywords while the job description has
// actionable missing keywords is OPTIMIZATION INCOMPLETE — never a success.
//
// The validator is intentionally conservative: it never mutates the output,
// it only reports violations + a keyword coverage report the Supervisor uses
// to drive targeted recovery (retry with corrective feedback).
// ============================================================================

import type { ResumeData, JobDescription, OptimizerDirectiveConfig } from "../types";
import { JD_COMPANY_NAMES } from "../structure-guardian";
import { simulateLayoutHeight } from "../layout-simulator";
import { assembleResume } from "../resume-assembler";

export interface KeywordCoverageReport {
  /** Priority/missing keywords evaluated for integration. */
  total: number;
  /** Keywords already present in the source resume before optimization. */
  alreadyPresent: number;
  /** Keywords newly integrated by the optimizer output. */
  integrated: number;
  /** Keywords still missing after optimization. */
  stillMissing: string[];
  /** (alreadyPresent + integrated) / total, 0-100. */
  coveragePct: number;
}

export interface OutputValidationResult {
  valid: boolean;
  violations: string[];
  warnings?: string[];
  keywordCoverage: KeywordCoverageReport;
  mutationRate: number;
  pageBudget: {
    totalHeightPt: number;
    maxPt: number;
    charCount: number;
    maxChars: number;
    passed: boolean;
  };
  bannedPhrasesFound: string[];
  contextuallyHonest: boolean;
}

/** Default blacklisted buzzwords and passive filler phrases */
export const DEFAULT_BANNED_PHRASES: string[] = [
  "responsible for",
  "duties included",
  "duties include",
  "tasked with",
  "helped with",
  "assisted with",
  "worked on",
  "team player",
  "hard worker",
  "go-getter",
  "think outside the box",
  "synergy",
  "detail-oriented",
  "results-driven",
  "self-starter",
  "dynamic professional",
  "rockstar",
  "guru",
  "ninja",
  "seasoned professional",
];

/**
 * Computes word-level mutation rate (0-100%) between source text and output text.
 * Rejects pure echo (<10%) or hallucinatory fabrication (>70%).
 */
export function computeMutationRate(sourceText: string, outputText: string): number {
  const sWords = normalizeText(sourceText).split(/\s+/).filter(Boolean);
  const oWords = normalizeText(outputText).split(/\s+/).filter(Boolean);
  if (sWords.length === 0 && oWords.length === 0) return 0;
  if (sWords.length === 0) return 100;
  if (oWords.length === 0) return 100;

  const maxLen = Math.max(sWords.length, oWords.length);
  let distance = 0;

  if (sWords.length <= 400 && oWords.length <= 400) {
    let prevRow = Array.from({ length: oWords.length + 1 }, (_, j) => j);
    let currRow = new Array(oWords.length + 1);
    for (let i = 1; i <= sWords.length; i++) {
      currRow[0] = i;
      const sw = sWords[i - 1];
      for (let j = 1; j <= oWords.length; j++) {
        const cost = sw === oWords[j - 1] ? 0 : 1;
        currRow[j] = Math.min(
          prevRow[j] + 1,
          currRow[j - 1] + 1,
          prevRow[j - 1] + cost,
        );
      }
      prevRow = [...currRow];
    }
    distance = prevRow[oWords.length];
  } else {
    const sCounts = new Map<string, number>();
    for (const w of sWords) sCounts.set(w, (sCounts.get(w) || 0) + 1);
    let common = 0;
    for (const w of oWords) {
      const count = sCounts.get(w) || 0;
      if (count > 0) {
        common++;
        sCounts.set(w, count - 1);
      }
    }
    distance = maxLen - common;
  }

  return Math.min(100, Math.max(0, Math.round((distance / maxLen) * 100)));
}

/**
 * Compute total character count of a resume document.
 */
export function computeResumeCharCount(resume: ResumeData): number {
  let count = 0;
  if (resume.name) count += resume.name.length;
  if (resume.headline) count += resume.headline.length;
  if (resume.summary) count += resume.summary.length;
  if (resume.contact) {
    count += (resume.contact.email || "").length;
    count += (resume.contact.phone || "").length;
    count += (resume.contact.location || "").length;
  }
  for (const exp of resume.experience || []) {
    count += (exp.title || "").length + (exp.company || "").length + (exp.location || "").length;
    for (const b of exp.bullets || []) count += b.length;
  }
  for (const edu of resume.education || []) {
    count += (edu.degree || "").length + (edu.institution || "").length;
    for (const h of edu.highlights || []) count += h.length;
  }
  for (const s of resume.skills || []) {
    count += (s.name || "").length;
  }
  for (const l of resume.languages || []) {
    count += (l.name || "").length + (l.proficiency || "").length;
  }
  for (const c of resume.certifications || []) {
    count += (c.name || "").length + (c.issuer || "").length;
  }
  return count;
}

/** Tokens that are never meaningful integration targets (mirrors orchestrator filter). */
function isJunkKeyword(k: string): boolean {
  const t = k.trim().toLowerCase();
  if (t.length < 3) return true;
  return ["go", "basic", "job", "company", "the", "and", "with", "for", "using", "strong", "plus", "etc", "years", "year", "work", "team", "role", "candidate", "experience", "skills", "requirements", "responsibilities", "preferred", "qualifications", "opportunity", "benefits", "salary"].includes(t);
}

/**
 * Entity-alignment filter (DEADLOCK FIX, production trace 0256e12b):
 * The Structure Guardian vetoes any SKILL whose name matches a JD
 * company/location entity ("Qatar Airways", "Doha"...). Previously the
 * OptimizerOutputValidator still counted those same tokens as actionable
 * keywords the optimizer MUST integrate — with a skills-less resume the only
 * way to satisfy the keyword floor was to add them as skills, which the
 * Guardian then vetoed. The two gates ping-ponged and every attempt failed
 * ("Keyword integration floor not met: 0 of 10..." → "Skill 'Qatar Airways'
 * is a JD company name/location..."), exhausting all retries.
 *
 * Tokens matching a Guardian-protected entity are excluded from the
 * actionable set — they can (and should) still appear naturally in bullets
 * and summaries, but they can never be REQUIRED. The validator and the
 * Guardian now enforce a satisfiable contract.
 */
function isGuardianProtectedEntity(k: string): boolean {
  const t = k.trim().toLowerCase();
  if (!t) return true;
  for (const name of JD_COMPANY_NAMES) {
    if (t === name || t.includes(name) || name.includes(t)) {
      return true;
    }
  }
  return false;
}

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9+/ .:-]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Checks whether a normalized keyword matches the target normalized text.
 * Supports:
 * 1. Direct substring match
 * 2. Singular/plural inflection (e.g., "boarding gates" matches "boarding gate")
 * 3. Multi-token partial stem matching for compound job duties (e.g. "check-in counters" matches "passenger check-in" or "check-in")
 */
function keywordMatchesText(normKeyword: string, targetText: string): boolean {
  if (!normKeyword || !targetText) return false;
  if (targetText.includes(normKeyword)) return true;

  // Plural/singular normalization of full phrase
  if (normKeyword.endsWith("s") && normKeyword.length > 3) {
    const singular = normKeyword.slice(0, -1).trim();
    if (singular && targetText.includes(singular)) return true;
  }
  if (normKeyword.endsWith("es") && normKeyword.length > 4) {
    const singular = normKeyword.slice(0, -2).trim();
    if (singular && targetText.includes(singular)) return true;
  }

  // Multi-word phrase matching
  const tokens = normKeyword.split(/\s+/).filter((t) => t.length >= 3 && !isJunkKeyword(t));
  if (tokens.length >= 2) {
    const matchedTokens = tokens.filter((t) => {
      if (targetText.includes(t)) return true;
      if (t.endsWith("s") && targetText.includes(t.slice(0, -1))) return true;
      if (t.endsWith("es") && targetText.includes(t.slice(0, -2))) return true;
      return false;
    });

    // If at least half of meaningful tokens (and at least 2 tokens) match, or 1 token if total was 2 and it's distinctive
    if (matchedTokens.length >= 2 && matchedTokens.length >= Math.ceil(tokens.length * 0.6)) {
      return true;
    }
    // For 2-token keywords (e.g. "check-in counters"), if either primary distinctive token matches (e.g. "check-in")
    if (tokens.length === 2 && matchedTokens.length >= 1) {
      // If the matched token is not generic
      const matched = matchedTokens[0];
      if (matched.length >= 4 && !["service", "services", "system", "systems", "operations"].includes(matched)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Evaluate keyword coverage: of the JD's actionable keywords, how many were
 * already present in the source, and how many did the optimizer integrate?
 */
export function computeKeywordCoverage(
  sourceResume: ResumeData,
  optimizerOutput: unknown,
  jd: JobDescription,
): KeywordCoverageReport {
  // DEADLOCK FIX: exclude both junk tokens AND Guardian-protected JD entities
  // ("Qatar Airways", "Doha"...) — the Guardian vetoes those as skills, so the
  // validator must never require them. Both filters apply before the 20-cap so
  // protected entities don't consume coverage slots.
  const jdKeywords = (jd.keywords ?? [])
    .filter((k) => typeof k === "string" && !isJunkKeyword(k) && !isGuardianProtectedEntity(k))
    .slice(0, 20);
  const sourceText = normalizeText(JSON.stringify(sourceResume));
  const outputText = normalizeText(JSON.stringify(optimizerOutput ?? {}));

  // Actionable = JD keyword that the SOURCE does not already contain.
  const actionable = jdKeywords.filter((k) => !keywordMatchesText(normalizeText(k), sourceText));
  let integrated = 0;
  const stillMissing: string[] = [];
  for (const k of actionable) {
    if (keywordMatchesText(normalizeText(k), outputText)) integrated++;
    else stillMissing.push(k);
  }

  const alreadyPresent = jdKeywords.length - actionable.length;
  const total = jdKeywords.length;
  const coveragePct = total === 0 ? 100 : Math.round(((alreadyPresent + integrated) / total) * 100);

  return { total, alreadyPresent, integrated, stillMissing, coveragePct };
}

/**
 * Validate the optimizer output against the minimum optimization contract
 * and strict Directive settings (directive §24/§25, mutation rate, page budget,
 * banned phrasing, and keyword scraper filter).
 *
 * Called inside the locked pipeline attempt loop; a failed validation aborts
 * the attempt and feeds corrective feedback into the retry loop.
 */
export function validateOptimizerOutput(
  sourceResume: ResumeData,
  optimizerOutput: unknown,
  jd: JobDescription,
  directiveConfig?: OptimizerDirectiveConfig | null,
): OutputValidationResult {
  const violations: string[] = [];
  const warnings: string[] = [];
  const output = (optimizerOutput ?? {}) as {
    summary?: string;
    headline?: string;
    skills?: unknown[];
    experiences?: Array<{ id?: string; bullets?: string[] }>;
  };

  // 1. Non-empty output (directive §24: "non-empty").
  const hasExperiences = Array.isArray(output.experiences) && output.experiences.length > 0;
  const hasSummary = typeof output.summary === "string" && output.summary.trim().length > 0;
  const hasSkills = Array.isArray(output.skills) && output.skills.length > 0;
  if (!hasExperiences && !hasSummary && !hasSkills) {
    violations.push("Optimizer output is empty (no summary, skills, or experience rewrites).");
  }

  // 2. Experience coverage — if the source has experience, the optimizer must
  //    return rewrites for the same number of entries (assembler matches by ID).
  const srcExpCount = sourceResume.experience?.length ?? 0;
  if (srcExpCount > 0 && (!Array.isArray(output.experiences) || output.experiences.length < srcExpCount)) {
    violations.push(
      `Optimizer returned ${output.experiences?.length ?? 0} experience rewrites for ${srcExpCount} source entries — incomplete coverage.`
    );
  }

  // 3. Mutation Check: Reject output if changes are <10% (pure echo) or >70% (hallucinatory rewrite)
  const srcSummary = typeof sourceResume.summary === "string" ? sourceResume.summary : "";
  const srcBullets = (sourceResume.experience ?? []).flatMap((e) => e.bullets ?? []).join(" ");
  const srcSkills = (sourceResume.skills ?? []).map((s) => s.name).join(" ");
  const outSummary = typeof output.summary === "string" ? output.summary : "";
  const outBullets = (output.experiences ?? []).flatMap((e) => e.bullets ?? []).join(" ");
  const outSkills = (output.skills ?? []).map((s) => (typeof s === "string" ? s : (s as any)?.name || "")).join(" ");

  const srcNorm = normalizeText(`${srcSummary} ${srcBullets} ${srcSkills}`);
  const outNorm = normalizeText(`${outSummary} ${outBullets} ${outSkills}`);
  const mutationRate = computeMutationRate(srcNorm, outNorm);

  if (srcNorm.length > 0 && outNorm.length > 0) {
    if (srcNorm === outNorm || mutationRate < 10) {
      violations.push(
        `Mutation check failed: mutation rate is ${mutationRate}% (<10% threshold). Output is an unchanged echo of the source resume with negligible optimization.`
      );
    } else if (mutationRate > 70) {
      violations.push(
        `Mutation check failed: mutation rate is ${mutationRate}% (>70% threshold). Hallucinatory rewrite detected; candidate's immutable history has been altered beyond realistic grounding.`
      );
    }
  }

  // 4. Page Budget Check (A4 - 842pt hard budget)
  let pageHeightSim = 842;
  let testCharCount = 0;
  const maxChars = directiveConfig?.enforceOnePage === false ? 7000 : (directiveConfig?.maxTotalChars ?? 3800);
  let passedPageBudget = true;

  try {
    const assembled = assembleResume(sourceResume, output as any).resume;
    const sim = simulateLayoutHeight(assembled, {
      bodyFontSizePt: directiveConfig?.bodyFontSizePt ?? 10,
      marginTopMm: directiveConfig?.marginTopMm ?? 12,
      marginBottomMm: directiveConfig?.marginBottomMm ?? 12,
      marginLeftMm: directiveConfig?.marginLeftMm ?? 15,
      marginRightMm: directiveConfig?.marginRightMm ?? 15,
      lineHeight: directiveConfig?.lineHeight ?? 1.15,
    });
    pageHeightSim = sim.totalHeightPt;
    testCharCount = computeResumeCharCount(assembled);

    if (directiveConfig?.enforceOnePage !== false) {
      // 842pt is standard A4 height; allow 2% tolerance (860pt)
      if (pageHeightSim > 860 || testCharCount > (maxChars + 100)) {
        passedPageBudget = false;
        violations.push(
          `Page budget check failed: document height (${Math.round(pageHeightSim)}pt / 842pt budget) or character count (${testCharCount} / ${maxChars} chars) exceeds the A4 single-page budget. Content must be condensed to fit cleanly onto one page without overflowing.`
        );
      }
    }
  } catch (assembleErr) {
    testCharCount = outSummary.length + outBullets.length;
  }

  // 5. Banned Phrasing & Placeholder Check
  const bannedPhrasesFound: string[] = [];
  const activeBanned = [
    ...DEFAULT_BANNED_PHRASES,
    ...(directiveConfig?.customKeywords?.forbiddenKeywords || []),
  ];

  const fullOutputText = `${outSummary} ${output.headline || ""} ${outBullets}`.toLowerCase();

  for (const phrase of activeBanned) {
    const normPhrase = phrase.toLowerCase().trim();
    if (!normPhrase) continue;
    // Word boundary check for phrase
    const escaped = normPhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    if (regex.test(fullOutputText)) {
      bannedPhrasesFound.push(phrase);
    }
  }

  // Bracket placeholder check: [X], [Z]%, [number], [metric]
  const placeholderRegex = /\[(?:x|y|z|a|b|c|d|e|number|metric|insert|value|result|amount|percentage)\]/i;
  if (placeholderRegex.test(fullOutputText)) {
    bannedPhrasesFound.push("bracket placeholder (e.g. [X], [metric])");
  }

  if (bannedPhrasesFound.length > 0) {
    violations.push(
      `Banned phrasing check failed: detected forbidden phrase(s) or placeholder(s) [${[...new Set(bannedPhrasesFound)].join(", ")}]. The Optimization Directive strictly prohibits filler phrases, cliches, and bracket placeholders.`
    );
  }

  // 6. Keyword Scraper Filter (prevent stuffing target-specific operational duties into unrelated past roles)
  let contextuallyHonest = true;
  const stuffedItems: string[] = [];
  const targetDomainTerms = (jd.keywords ?? [])
    .filter((k) => typeof k === "string" && k.length > 4 && !isJunkKeyword(k) && !isGuardianProtectedEntity(k))
    .slice(0, 15);

  if (Array.isArray(output.experiences) && Array.isArray(sourceResume.experience)) {
    for (const exp of output.experiences) {
      const sourceExp = sourceResume.experience.find(
        (se) => (exp.id && se.id === exp.id) || (se.company && exp.bullets?.some((b) => b.includes(se.company)))
      );
      if (!sourceExp) continue;

      const sourceExpText = normalizeText(`${sourceExp.title} ${sourceExp.company} ${(sourceExp.bullets || []).join(" ")}`);
      const optExpText = normalizeText((exp.bullets || []).join(" "));

      // Check if source experience was completely void of target domain concepts
      for (const term of targetDomainTerms) {
        const normTerm = normalizeText(term);
        if (normTerm.length < 5) continue;
        const inOpt = keywordMatchesText(normTerm, optExpText);
        const inSrc = keywordMatchesText(normTerm, sourceExpText);

        // If highly technical target operational duty was injected into an unrelated past job where candidate had zero background
        if (inOpt && !inSrc) {
          const isHighSpecificityDuty = ["attestation", "boarding gate", "turnaround", "emergency evacuation", "aircraft", "galley", "avsec", "dgr"].some((d) => normTerm.includes(d));
          if (isHighSpecificityDuty && !sourceExpText.includes("airline") && !sourceExpText.includes("airport") && !sourceExpText.includes("flight")) {
            stuffedItems.push(`"${term}" in ${sourceExp.title} at ${sourceExp.company}`);
            contextuallyHonest = false;
          }
        }
      }
    }
  }

  if (stuffedItems.length > 0) {
    violations.push(
      `Keyword scraper filter violation: detected dishonest keyword stuffing into unrelated past roles [${stuffedItems.slice(0, 3).join(", ")}]. Target operational duties must only be integrated in the Summary (career-objective framing) or Skills section, not fabricated into past unrelated jobs.`
    );
  }

  // 7. Keyword accountability (directive §11)
  const coverage = computeKeywordCoverage(sourceResume, output, jd);
  const actionable = coverage.total - coverage.alreadyPresent;
  if (actionable >= 3 && coverage.integrated === 0) {
    violations.push(
      `Keyword integration floor not met: 0 of ${actionable} actionable JD keywords integrated (${coverage.stillMissing.slice(0, 5).join(", ")}…). Optimization is INCOMPLETE, not successful. ` +
      `Fix: integrate at least one of these keywords in the SUMMARY (career-objective framing around the target role) or the SKILLS list (honest transferable skills). Do not fabricate experience duties to place a keyword — but do not omit the keywords everywhere either.`
    );
  }

  // Debug logging for directive compliance
  const blueprintName = (directiveConfig as any)?.activeBlueprint || (directiveConfig as any)?.name || "Aviation ATS Blueprint";
  const customOverrideActive = !!(directiveConfig?.customDirectiveOverride?.trim());
  const pageBudgetStr = `${testCharCount}/${maxChars} chars (${Math.round(pageHeightSim)}/842pt)`;
  const complianceStatus = violations.length === 0 ? "PASS" : "FAIL";

  console.info(
    `[Directive Check] Blueprint: ${blueprintName} | Custom Override: ${customOverrideActive ? "active" : "inactive"} | Page Budget: ${pageBudgetStr} | Mutation Rate: ${mutationRate}% | Status: ${complianceStatus}`
  );

  return {
    valid: violations.length === 0,
    violations,
    warnings,
    keywordCoverage: coverage,
    mutationRate,
    pageBudget: {
      totalHeightPt: pageHeightSim,
      maxPt: 842,
      charCount: testCharCount,
      maxChars,
      passed: passedPageBudget,
    },
    bannedPhrasesFound,
    contextuallyHonest,
  };
}
