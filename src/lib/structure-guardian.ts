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
  "qatar airways",
  "qatar airways group",
  "emirates",
  "etihad",
  "etihad airways",
  "lufthansa",
  "british airways",
  "singapore airlines",
  "flydubai",
  "air arabia",
  "saudia",
]);

export function isJdCompanyOrLocation(name: string, jdText: string = ""): boolean {
  if (!name) return false;
  const lower = name.toLowerCase().trim();
  if (!lower) return false;
  
  for (const company of JD_COMPANY_NAMES) {
    if (lower === company || lower.includes(company) || company.includes(lower)) {
      return true;
    }
  }

  // If JD text explicitly names an employer or city, check if skill directly matches
  if (jdText) {
    const jdLower = jdText.toLowerCase();
    if (lower.length >= 4 && (lower.includes("qatar") || lower.includes("doha") || lower.includes("airways group"))) {
      if (jdLower.includes(lower)) return true;
    }
  }

  return false;
}

export interface StructureGuardianResult {
  passed: boolean;
  score?: number;
  status?: string;
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

  const passed = criticalIssues.length === 0;
  return {
    passed,
    score: passed ? 100 : Math.max(0, 100 - criticalIssues.length * 20),
    status: passed ? "PASS" : "FAIL",
    warnings,
    criticalIssues,
  };
}

export function sanitizeSkillsAgainstJd(
  target: any = [],
  sourceResume?: any,
  jdText: string = ""
): any {
  if (target && typeof target === "object" && !Array.isArray(target) && "skills" in target) {
    const resume = { ...target };
    const skills = resume.skills || [];
    const removedSkills: string[] = [];
    const keptSkills = skills.filter((s: any) => {
      const name = typeof s === "string" ? s : s?.name || "";
      if (isJdCompanyOrLocation(name, jdText)) {
        removedSkills.push(name);
        return false;
      }
      return true;
    });
    resume.skills = keptSkills;
    return { resume, removedSkills };
  }

  const skillsArray = Array.isArray(target) ? target : [];
  const removedSkills: string[] = [];
  const kept = skillsArray.filter((s: any) => {
    const name = typeof s === "string" ? s : s?.name || "";
    if (isJdCompanyOrLocation(name, jdText)) {
      removedSkills.push(name);
      return false;
    }
    return true;
  });
  return Object.assign(kept, { resume: { skills: kept }, removedSkills });
}
