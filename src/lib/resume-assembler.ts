// ============================================================================
// Resume Assembler — Merges AI Optimizations into Canonical Resumes
// ============================================================================

import type { ResumeData } from "./types";

export interface OptimizerOutput {
  summary?: string;
  experience?: Array<{ id?: string; bullets?: string[]; [key: string]: unknown }>;
  skills?: any[];
  missingKeywordsAdded?: string[];
  rationales?: Record<string, unknown>;
  [key: string]: unknown;
}

export function canonicalSkillKey(skill: string | { name?: string }): string {
  if (typeof skill === "string") {
    return skill.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
  }
  return (skill?.name || "").toLowerCase().trim().replace(/[^a-z0-9]/g, "");
}

export function normalizeSkillName(skill: string): string {
  return skill.trim();
}

export function findRemovedSourceSkills(
  source: any[] = [],
  candidate: any[] = [],
  relocatedLanguages: any[] = []
): string[] {
  const candKeys = new Set([
    ...candidate.map(canonicalSkillKey),
    ...relocatedLanguages.map(canonicalSkillKey),
  ]);
  return source
    .filter((s) => !candKeys.has(canonicalSkillKey(s)))
    .map((s) => (typeof s === "string" ? s : s?.name || ""));
}

export interface AssembleResult {
  resume: ResumeData;
  matchedById: number;
  matchedByFingerprint: number;
  matchedByTitleCompany: number;
  matchedByIndex: number;
  matchedByFuzzy: number;
  unmatched: number;
  warnings: string[];
  errors: string[];
}

export function assembleResume(
  source: ResumeData,
  output: OptimizerOutput,
  options?: Record<string, unknown>
): AssembleResult {
  const assembled = JSON.parse(JSON.stringify(source || {})) as ResumeData;
  assembled.experience = Array.isArray(assembled.experience) ? assembled.experience : [];
  assembled.education = Array.isArray(assembled.education) ? assembled.education : [];
  assembled.skills = Array.isArray(assembled.skills) ? assembled.skills : [];
  assembled.languages = Array.isArray(assembled.languages) ? assembled.languages : [];
  assembled.certifications = Array.isArray(assembled.certifications) ? assembled.certifications : [];

  const warnings: string[] = [];
  const errors: string[] = [];
  let matchedById = 0;
  let matchedByIndex = 0;

  if (output.summary) {
    assembled.summary = output.summary;
  }
  if ((output as any).headline) {
    (assembled as any).headline = (output as any).headline;
  }

  // Handle both singular output.experience and plural output.experiences
  const expPatches = (output.experiences || output.experience) as Array<{ id?: string; bullets?: string[]; [key: string]: unknown }> | undefined;
  if (Array.isArray(expPatches) && assembled.experience.length > 0) {
    assembled.experience = assembled.experience.map((exp, i) => {
      let match = exp.id ? expPatches.find((e) => e.id === exp.id) : undefined;
      if (match) {
        matchedById++;
      } else if (expPatches[i]) {
        match = expPatches[i];
        matchedByIndex++;
      }

      if (match?.bullets && Array.isArray(match.bullets) && match.bullets.length > 0) {
        return { ...exp, bullets: match.bullets.map(String).filter((b) => b.trim().length > 0) };
      }
      return exp;
    });
  }

  // Handle skills if provided
  if (Array.isArray(output.skills) && output.skills.length > 0) {
    const updatedSkills: any[] = [];
    for (const s of output.skills) {
      if (typeof s === "string" && s.trim()) {
        updatedSkills.push({ id: `s-${Math.random().toString(36).slice(2, 9)}`, name: s.trim(), category: "General" });
      } else if (s && typeof s === "object" && s.name) {
        updatedSkills.push({
          id: s.id || `s-${Math.random().toString(36).slice(2, 9)}`,
          name: String(s.name).trim(),
          category: s.category || "General",
        });
      }
    }
    if (updatedSkills.length > 0) {
      // Merge unique by name
      const seen = new Set(assembled.skills.map((s) => s.name.toLowerCase()));
      for (const ns of updatedSkills) {
        if (!seen.has(ns.name.toLowerCase())) {
          seen.add(ns.name.toLowerCase());
          assembled.skills.push(ns);
        }
      }
    }
  }

  // Handle education highlights if provided
  const eduPatches = (output.education || (output as any).educations) as Array<{ id?: string; highlights?: string[]; [key: string]: unknown }> | undefined;
  if (Array.isArray(eduPatches) && assembled.education.length > 0) {
    assembled.education = assembled.education.map((edu, i) => {
      const match = edu.id ? eduPatches.find((e) => e.id === edu.id) || eduPatches[i] : eduPatches[i];
      if (match?.highlights && Array.isArray(match.highlights) && match.highlights.length > 0) {
        return { ...edu, highlights: match.highlights.map(String).filter((h) => h.trim().length > 0) };
      }
      return edu;
    });
  }

  const unmatched = Math.max(0, assembled.experience.length - (matchedById + matchedByIndex));

  return {
    resume: assembled,
    matchedById,
    matchedByFingerprint: 0,
    matchedByTitleCompany: 0,
    matchedByIndex,
    matchedByFuzzy: 0,
    unmatched,
    warnings,
    errors,
  };
}
