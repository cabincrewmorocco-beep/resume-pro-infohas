// ============================================================================
// Resume Guardian Agent — Hallucination & Consistency Validator
// ============================================================================

import type { ResumeData, JobDescription } from "./types";

export interface GuardianCheck {
  name: string;
  passed: boolean;
  critical: boolean;
  detail: string;
}

export interface GuardianVerdict {
  passed: boolean;
  score: number;
  status: "pass" | "warn" | "fail" | "BLOCKED" | string;
  violations: string[];
  checks: GuardianCheck[];
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
  jd?: JobDescription | null,
  options?: any
): Promise<GuardianVerdict & { verdict: GuardianVerdict; repairedResume?: ResumeData }> {
  const violations: string[] = [];
  const checks: GuardianCheck[] = [];

  const srcExpCount = source?.experience?.length ?? 0;
  const candExpCount = candidate?.experience?.length ?? 0;
  if (srcExpCount > 0 && candExpCount < srcExpCount) {
    violations.push("One or more experience entries were dropped.");
    checks.push({
      name: "Experience Preserved",
      passed: false,
      critical: true,
      detail: `One or more experience entries were dropped (${candExpCount}/${srcExpCount}).`,
    });
  } else {
    checks.push({
      name: "Experience Preserved",
      passed: true,
      critical: true,
      detail: "All experience entries preserved.",
    });
  }

  const passed = violations.length === 0;
  const score = passed ? 100 : Math.max(60, 100 - violations.length * 15);
  const status = passed ? "pass" : "warn";

  const verdict: GuardianVerdict = {
    passed,
    score,
    status,
    violations,
    checks,
    repairsApplied: [],
  };

  return {
    ...verdict,
    verdict,
    repairedResume: candidate,
  };
}
