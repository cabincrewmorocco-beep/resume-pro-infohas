// ============================================================================
// Resume Blueprint Agent
// ============================================================================

import type { ResumeData } from "./types";

export interface ResumeBlueprint {
  sections: string[];
  experienceCount: number;
  educationCount: number;
  skillsCount: number;
}

export function extractBlueprint(resume: ResumeData): ResumeBlueprint {
  return {
    sections: [
      resume.summary ? "summary" : "",
      resume.experience?.length ? "experience" : "",
      resume.education?.length ? "education" : "",
      resume.skills?.length ? "skills" : "",
    ].filter(Boolean),
    experienceCount: resume.experience?.length || 0,
    educationCount: resume.education?.length || 0,
    skillsCount: resume.skills?.length || 0,
  };
}
