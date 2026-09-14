// ============================================================================
// Render Document Builder — Converts ResumeData to Canonical RenderDocument
// ============================================================================

import type {
  ResumeData,
  ResumeLayoutModel,
  RenderDocument,
  RenderDocumentSection,
  RenderContentItem,
  RenderDocumentContact,
} from "./types";
import { getDefaultResumeLayout } from "./resume-layout";

function formatPeriod(start?: string, end?: string, current?: boolean): string {
  const s = (start || "").trim();
  const e = current ? "Present" : (end || "").trim();
  if (s && e) return `${s} – ${e}`;
  return s || e || "";
}

export function toRenderDocument(resume: ResumeData, layout?: ResumeLayoutModel): RenderDocument {
  const sections: RenderDocumentSection[] = [];

  // 1. Professional Summary
  if (resume.summary && resume.summary.trim()) {
    sections.push({
      type: "summary",
      title: "PROFESSIONAL SUMMARY",
      items: [
        {
          kind: "text",
          text: resume.summary.trim(),
        },
      ],
    });
  }

  // 2. Core Competencies & Skills
  if (resume.skills && resume.skills.length > 0) {
    const skillMap = new Map<string, string[]>();
    for (const s of resume.skills) {
      if (!s) continue;
      const cat = (s.category || "").trim() || "Core Competencies";
      const name = (s.name || "").trim();
      if (!name) continue;
      if (!skillMap.has(cat)) skillMap.set(cat, []);
      skillMap.get(cat)!.push(name);
    }
    const groups = Array.from(skillMap.entries()).map(([label, items]) => ({ label, items }));
    if (groups.length > 0) {
      sections.push({
        type: "skills",
        title: "CORE COMPETENCIES & SKILLS",
        items: [
          {
            kind: "nested-bullets",
            groups,
          },
        ],
      });
    }
  }

  // 3. Work Experience
  if (resume.experience && resume.experience.length > 0) {
    const expItems: RenderContentItem[] = [];
    for (const exp of resume.experience) {
      if (!exp) continue;
      const dateStr = formatPeriod(exp.startDate, exp.endDate, exp.current);
      const titleCompany = [
        exp.title?.trim(),
        exp.company ? `| ${exp.company.trim()}` : "",
        exp.location ? `(${exp.location.trim()})` : "",
      ].filter(Boolean).join(" ");

      expItems.push({
        kind: "table-row",
        cells: [
          { text: titleCompany || "Role", bold: true, align: "left" },
          { text: dateStr, bold: true, align: "right" },
        ],
      });

      const bullets = (exp.bullets || exp.highlights || []).filter(
        (b) => typeof b === "string" && b.trim()
      );
      if (bullets.length > 0) {
        expItems.push({
          kind: "bullets",
          bullets: bullets.map((b) => b.trim()),
        });
      }
    }
    if (expItems.length > 0) {
      sections.push({
        type: "experience",
        title: "WORK EXPERIENCE",
        items: expItems,
      });
    }
  }

  // 4. Education
  if (resume.education && resume.education.length > 0) {
    const eduItems: RenderContentItem[] = [];
    for (const edu of resume.education) {
      if (!edu) continue;
      const dateStr = formatPeriod(edu.startDate, edu.endDate);
      const leftParts = [
        edu.degree?.trim(),
        edu.institution ? `- ${edu.institution.trim()}` : "",
        edu.location ? `| ${edu.location.trim()}` : "",
      ].filter(Boolean).join(" ");

      eduItems.push({
        kind: "table-row",
        cells: [
          { text: leftParts || "Education", bold: true, align: "left" },
          { text: dateStr, bold: true, align: "right" },
        ],
      });

      if (edu.gpa) {
        eduItems.push({
          kind: "text",
          text: `GPA: ${edu.gpa}`,
        });
      }

      const highlights = (edu.highlights || []).filter(
        (h) => typeof h === "string" && h.trim()
      );
      if (highlights.length > 0) {
        eduItems.push({
          kind: "bullets",
          bullets: highlights.map((h) => h.trim()),
        });
      }
    }
    if (eduItems.length > 0) {
      sections.push({
        type: "education",
        title: "EDUCATION",
        items: eduItems,
      });
    }
  }

  // 5. Languages
  if (resume.languages && resume.languages.length > 0) {
    const langBullets = resume.languages
      .filter((l) => l && (l.name || l.language))
      .map((l) => {
        const name = (l.name || l.language || "").trim();
        const prof = (l.proficiency || l.fluency || "").trim();
        return prof ? `${name}: ${prof}` : name;
      });
    if (langBullets.length > 0) {
      sections.push({
        type: "languages",
        title: "LANGUAGES",
        items: [
          {
            kind: "bullets",
            bullets: langBullets,
          },
        ],
      });
    }
  }

  // 6. Certifications
  if (resume.certifications && resume.certifications.length > 0) {
    const certItems: RenderContentItem[] = [];
    for (const cert of resume.certifications) {
      if (!cert) continue;
      const nameIssuer = [cert.name?.trim(), cert.issuer ? `- ${cert.issuer.trim()}` : ""].filter(Boolean).join(" ");
      certItems.push({
        kind: "table-row",
        cells: [
          { text: nameIssuer || "Certification", bold: true, align: "left" },
          { text: cert.date || "", bold: true, align: "right" },
        ],
      });
    }
    if (certItems.length > 0) {
      sections.push({
        type: "certifications",
        title: "CERTIFICATIONS",
        items: certItems,
      });
    }
  }

  // 7. Projects
  if (resume.projects && resume.projects.length > 0) {
    const projItems: RenderContentItem[] = [];
    for (const proj of resume.projects) {
      if (!proj) continue;
      const nameRole = [proj.name?.trim(), proj.role ? `(${proj.role.trim()})` : ""].filter(Boolean).join(" ");
      const techStr = proj.technologies?.join(", ") || "";
      projItems.push({
        kind: "table-row",
        cells: [
          { text: nameRole || "Project", bold: true, align: "left" },
          { text: techStr, bold: false, align: "right" },
        ],
      });
      if (proj.description && proj.description.trim()) {
        projItems.push({
          kind: "text",
          text: proj.description.trim(),
        });
      }
      const bullets = (proj.bullets || []).filter(
        (b) => typeof b === "string" && b.trim()
      );
      if (bullets.length > 0) {
        projItems.push({
          kind: "bullets",
          bullets: bullets.map((b) => b.trim()),
        });
      }
    }
    if (projItems.length > 0) {
      sections.push({
        type: "projects",
        title: "PROJECTS",
        items: projItems,
      });
    }
  }

  // 8. Dynamic Sections
  if (resume.dynamicSections && resume.dynamicSections.length > 0) {
    for (const ds of resume.dynamicSections) {
      if (!ds) continue;
      const items: RenderContentItem[] = [];
      if (ds.content && ds.content.trim()) {
        items.push({ kind: "text", text: ds.content.trim() });
      }
      const bullets = (ds.bullets || []).filter(
        (b) => typeof b === "string" && b.trim()
      );
      if (bullets.length > 0) {
        items.push({ kind: "bullets", bullets: bullets.map((b) => b.trim()) });
      }
      if (items.length > 0) {
        sections.push({
          type: ds.type || "custom",
          title: (ds.title || "ADDITIONAL INFORMATION").toUpperCase(),
          items,
        });
      }
    }
  }

  // 9. Additional Info
  if (resume.additionalInfo && resume.additionalInfo.trim()) {
    sections.push({
      type: "custom",
      title: "ADDITIONAL INFORMATION",
      items: [{ kind: "text", text: resume.additionalInfo.trim() }],
    });
  }

  const contact: RenderDocumentContact = {
    name: (resume.name || resume.contact?.name || "Candidate").trim(),
    headline: (resume.headline || resume.targetRole || "").trim(),
    email: resume.contact?.email || "",
    phone: resume.contact?.phone || "",
    location: resume.contact?.location || (resume.contact as any)?.address || "",
    photoUrl: resume.photoUrl,
    dateOfBirth: resume.dateOfBirth || (resume.contact as any)?.dateOfBirth,
    linkedin: resume.contact?.linkedin,
    github: resume.contact?.github,
    website: resume.contact?.website,
    personalDetails: resume.contact?.personalDetails,
  };

  const baseLayout = getDefaultResumeLayout();
  const mergedLayout: ResumeLayoutModel = {
    ...baseLayout,
    ...(layout || resume.layout || {}),
    nameColor: layout?.nameColor || resume.layout?.nameColor || baseLayout.nameColor || "#003366",
    sectionTitleColor: layout?.sectionTitleColor || resume.layout?.sectionTitleColor || baseLayout.sectionTitleColor || "#003366",
    bodyTextColor: layout?.bodyTextColor || resume.layout?.bodyTextColor || baseLayout.bodyTextColor || "#000000",
    contactColor: layout?.contactColor || resume.layout?.contactColor || baseLayout.contactColor || "#333333",
  };

  return {
    id: resume.id,
    title: resume.title || "Resume",
    template: (resume.template as string) || (resume.templateId as string) || "ats-professional",
    contact,
    layout: mergedLayout,
    sections,
  };
}
