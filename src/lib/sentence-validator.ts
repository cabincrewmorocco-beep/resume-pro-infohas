// ============================================================================
// Sentence Validator — Truncated & Hanging Sentence Guard
// ============================================================================

import type { ResumeData } from "./types";

export interface SentenceValidationResult {
  valid: boolean;
  issues: string[];
  cleaned: ResumeData;
}

const HANGING_ENDINGS = /\b(and|or|with|to|in|of|for|by|at|as|the|a|an)\s*$/i;

export function validateResumeSentenceCompleteness(resume: ResumeData): SentenceValidationResult {
  const issues: string[] = [];
  const cleaned: ResumeData = JSON.parse(JSON.stringify(resume));

  if (cleaned.summary && HANGING_ENDINGS.test(cleaned.summary.trim())) {
    issues.push("Summary ended with a hanging preposition or conjunction.");
    cleaned.summary = cleaned.summary.trim().replace(HANGING_ENDINGS, "").trim();
    if (!cleaned.summary.endsWith(".")) cleaned.summary += ".";
  }

  if (cleaned.experience) {
    cleaned.experience.forEach((exp, eIdx) => {
      if (exp.bullets) {
        exp.bullets = exp.bullets.map((b, bIdx) => {
          if (HANGING_ENDINGS.test(b.trim())) {
            issues.push(`Bullet ${bIdx} in experience ${eIdx} ended abruptly.`);
            let fixed = b.trim().replace(HANGING_ENDINGS, "").trim();
            if (!fixed.endsWith(".")) fixed += ".";
            return fixed;
          }
          return b;
        });
      }
    });
  }

  return {
    valid: issues.length === 0,
    issues,
    cleaned,
  };
}
