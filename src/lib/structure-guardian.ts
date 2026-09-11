// ============================================================================
// Structure Guardian Agent
// ============================================================================

import type { ResumeData } from "./types";

export const JD_COMPANY_NAMES: Set<string> = new Set([
  "google",
  "meta",
  "apple",
  "amazon",
  "microsoft",
  "netflix",
  "uber",
  "airbnb",
]);

export interface StructureGuardianResult {
  passed: boolean;
  warnings: string[];
  criticalIssues: string[];
}

export function runStructureGuardian(
  resume: ResumeData,
  sourceResume?: ResumeData,
  jdText?: string
): StructureGuardianResult {
  const warnings: string[] = [];
  const criticalIssues: string[] = [];

  if (!resume.experience || resume.experience.length === 0) {
    criticalIssues.push("Resume has no experience section.");
  }

  return {
    passed: criticalIssues.length === 0,
    warnings,
    criticalIssues,
  };
}

export function sanitizeSkillsAgainstJd(skills: any[] = [], jdText: string = ""): any[] {
  if (!skills) return [];
  return skills.filter((s) => {
    const name = typeof s === "string" ? s : s?.name || "";
    return !JD_COMPANY_NAMES.has(name.toLowerCase().trim());
  });
}
