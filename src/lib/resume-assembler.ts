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

export function findRemovedSourceSkills(source: any[] = [], candidate: any[] = []): string[] {
  const candKeys = new Set(candidate.map(canonicalSkillKey));
  return source
    .filter((s) => !candKeys.has(canonicalSkillKey(s)))
    .map((s) => (typeof s === "string" ? s : s?.name || ""));
}

export function assembleResume(
  source: ResumeData,
  output: OptimizerOutput,
  options?: Record<string, unknown>
): { resume: ResumeData; matchedById: number; matchedByFuzzy: number; unmatched: number } {
  const assembled = JSON.parse(JSON.stringify(source)) as ResumeData;
  if (output.summary) {
    assembled.summary = output.summary;
  }
  if (output.experience && assembled.experience) {
    assembled.experience = assembled.experience.map((exp, i) => {
      const match = output.experience?.find((e) => e.id === exp.id) || output.experience?.[i];
      if (match?.bullets && Array.isArray(match.bullets)) {
        return { ...exp, bullets: match.bullets };
      }
      return exp;
    });
  }
  return {
    resume: assembled,
    matchedById: output.experience?.length || 0,
    matchedByFuzzy: 0,
    unmatched: 0,
  };
}
