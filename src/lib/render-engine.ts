// ============================================================================
// Render Engine — Canonical Resume Generator
// ============================================================================

import type { ResumeData } from "./types";
import type { CanonicalResume } from "./types-phase3";

export function buildCanonicalResume(resume: ResumeData): CanonicalResume {
  return {
    header: {
      name: resume.name || resume.contact?.name || "Candidate",
      title: resume.targetRole,
      email: resume.contact?.email,
      phone: resume.contact?.phone,
      location: resume.contact?.location,
      links: [
        resume.contact?.linkedin ? { label: "LinkedIn", url: resume.contact.linkedin } : null,
        resume.contact?.website ? { label: "Website", url: resume.contact.website } : null,
        resume.contact?.github ? { label: "GitHub", url: resume.contact.github } : null,
      ].filter(Boolean) as Array<{ label: string; url: string }>,
    },
    sections: [
      resume.summary
        ? {
            type: "summary",
            title: "Professional Summary",
            items: [{ content: resume.summary }],
          }
        : null,
      resume.experience?.length
        ? {
            type: "experience",
            title: "Work Experience",
            items: resume.experience.map((e) => ({
              id: e.id,
              title: e.title,
              subtitle: e.company,
              date: `${e.startDate || ""} - ${e.endDate || (e.current ? "Present" : "")}`,
              location: e.location,
              bullets: e.bullets,
            })),
          }
        : null,
      resume.education?.length
        ? {
            type: "education",
            title: "Education",
            items: resume.education.map((ed) => ({
              id: ed.id,
              title: ed.degree,
              subtitle: ed.institution,
              date: `${ed.startDate || ""} - ${ed.endDate || ""}`,
              location: ed.location,
              bullets: ed.highlights,
            })),
          }
        : null,
      resume.skills?.length
        ? {
            type: "skills",
            title: "Skills",
            items: resume.skills.map((s) => ({
              id: s.id,
              title: s.name,
              subtitle: s.category,
            })),
          }
        : null,
    ].filter(Boolean) as any[],
  };
}
