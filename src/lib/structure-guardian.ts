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

// Legitimate software/tech tools that should never be classified as company employer hallucinations
const TECH_SOFTWARE_SKILLS_REGEX =
  /\b(word|excel|powerpoint|outlook|office|365|azure|teams|access|project|visio|sharepoint|onedrive|suite|docs|sheets|slides|drive|cloud|workspace|aws|s3|ec2|dynamodb|lambda|photoshop|illustrator|indesign|acrobat|premiere|after effects|figma|canva|salesforce|jira|confluence|slack|zoom)\b/i;

export function isJdCompanyOrLocation(name: string, jdText: string = ""): boolean {
  if (!name) return false;
  const lower = name.toLowerCase().trim();
  if (!lower) return false;

  // Never flag legitimate software skills (e.g. "Microsoft Word", "Microsoft Outlook", "Google Docs")
  if (TECH_SOFTWARE_SKILLS_REGEX.test(lower)) {
    return false;
  }

  for (const company of JD_COMPANY_NAMES) {
    if (lower === company) {
      return true;
    }
    // If the candidate skill literally is the company name with suffix like "Inc", "Corp", "Group"
    if (lower.startsWith(company) && (lower === `${company} group` || lower === `${company} corp` || lower === `${company} inc` || lower === `${company} co`)) {
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
  // Build lookup of source resume skills — source skills are authentic and must NEVER be removed
  const sourceSkillsSet = new Set<string>();
  if (sourceResume && typeof sourceResume === "object") {
    const rawSource = Array.isArray(sourceResume.skills) ? sourceResume.skills : [];
    for (const s of rawSource) {
      const sName = typeof s === "string" ? s : s?.name || "";
      if (sName) {
        sourceSkillsSet.add(sName.toLowerCase().trim());
      }
    }
  }

  const isSourceSkill = (skillName: string): boolean => {
    if (!skillName) return false;
    const lower = skillName.toLowerCase().trim();
    return sourceSkillsSet.has(lower);
  };

  if (target && typeof target === "object" && !Array.isArray(target) && "skills" in target) {
    const resume = { ...target };
    const skills = resume.skills || [];
    const removedSkills: string[] = [];
    const keptSkills = skills.filter((s: any) => {
      const name = typeof s === "string" ? s : s?.name || "";
      if (!isSourceSkill(name) && isJdCompanyOrLocation(name, jdText)) {
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
    if (!isSourceSkill(name) && isJdCompanyOrLocation(name, jdText)) {
      removedSkills.push(name);
      return false;
    }
    return true;
  });
  return Object.assign(kept, { resume: { skills: kept }, removedSkills });
}
