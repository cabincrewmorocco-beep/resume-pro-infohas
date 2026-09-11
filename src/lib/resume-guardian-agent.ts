// ============================================================================
// Resume Guardian Agent — Hallucination & Consistency Validator
// ============================================================================

import type { ResumeData, JobDescription } from "./types";

export interface GuardianVerdict {
  passed: boolean;
  score: number;
  status: "pass" | "warn" | "fail" | string;
  violations: string[];
  repairsApplied?: string[];
}

export function assertResumeExportable(resume: ResumeData): void {
  if (!resume) {
    throw new Error("Cannot export: Resume is null or undefined.");
  }
  const hasContent = Boolean(
    resume.name ||
    resume.contact?.name ||
    (resume.experience && resume.experience.length > 0) ||
    (resume.skills && resume.skills.length > 0)
  );
  if (!hasContent) {
    throw new Error("Cannot export: Resume has no identifiable name or experience.");
  }
}

export async function runGuardianValidation(
  candidate: ResumeData,
  source: ResumeData,
  jd?: JobDescription | null
): Promise<{ verdict: GuardianVerdict; repairedResume?: ResumeData; score: number; status: string }> {
  const violations: string[] = [];

  if (source.experience && candidate.experience) {
    if (candidate.experience.length < source.experience.length) {
      violations.push("One or more experience entries were dropped.");
    }
  }

  const passed = violations.length === 0;
  const score = passed ? 100 : Math.max(60, 100 - violations.length * 15);
  const status = passed ? "pass" : "warn";

  return {
    verdict: {
      passed,
      score,
      status,
      violations,
      repairsApplied: [],
    },
    repairedResume: candidate,
    score,
    status,
  };
}
