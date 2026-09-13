// ============================================================================
// Resume Template Blueprint Agent
// ============================================================================

import type { ResumeData } from "./types";

export interface ResumeTemplateBlueprint {
  templateId?: string;
  layoutType?: string;
  sectionOrder: string[];
  layout?: any;
}

export function extractTemplateBlueprint(resume: ResumeData): ResumeTemplateBlueprint {
  return {
    templateId: resume.templateId || (typeof resume.template === "string" ? resume.template : "classic"),
    sectionOrder: ["contact", "summary", "experience", "education", "skills"],
    layout: resume.layout,
  };
}

export function validateTemplatePreserved(
  blueprint: ResumeTemplateBlueprint,
  resume: ResumeData
): { valid: boolean; issues: string[] } {
  const currentTemplate = resume.templateId || (typeof resume.template === "string" ? resume.template : "classic");
  const valid = !blueprint.templateId || blueprint.templateId === currentTemplate;
  return {
    valid,
    issues: valid ? [] : ["Template ID altered during optimization"],
  };
}
