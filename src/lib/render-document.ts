// ============================================================================
// Render Document Builder
// ============================================================================

import type { ResumeData, ResumeLayoutModel, RenderDocument } from "./types";

export function toRenderDocument(resume: ResumeData, layout?: ResumeLayoutModel): RenderDocument {
  const sections: any[] = [];

  if (resume.contact || resume.name) {
    sections.push({
      type: "header",
      name: resume.name || resume.contact?.name || "Candidate",
      title: resume.targetRole,
      contact: resume.contact,
    });
  }

  if (resume.summary) {
    sections.push({
      type: "summary",
      title: "Professional Summary",
      content: resume.summary,
    });
  }

  if (resume.experience && resume.experience.length > 0) {
    sections.push({
      type: "experience",
      title: "Work Experience",
      items: resume.experience,
    });
  }

  if (resume.education && resume.education.length > 0) {
    sections.push({
      type: "education",
      title: "Education",
      items: resume.education,
    });
  }

  if (resume.skills && resume.skills.length > 0) {
    sections.push({
      type: "skills",
      title: "Skills",
      items: resume.skills,
    });
  }

  if (resume.languages && resume.languages.length > 0) {
    sections.push({
      type: "languages",
      title: "Languages",
      items: resume.languages,
    });
  }

  if (resume.certifications && resume.certifications.length > 0) {
    sections.push({
      type: "certifications",
      title: "Certifications",
      items: resume.certifications,
    });
  }

  if (resume.projects && resume.projects.length > 0) {
    sections.push({
      type: "projects",
      title: "Projects",
      items: resume.projects,
    });
  }

  return {
    id: resume.id,
    title: resume.title || "Resume",
    layout,
    sections,
  };
}
