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

function fmtDate(d?: string): string {
  if (!d) return "";
  const trimmed = d.trim();
  if (/present/i.test(trimmed)) return "Present";
  const m = trimmed.match(/^(\d{4})-(\d{2})$/);
  if (m) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const idx = parseInt(m[2], 10) - 1;
    return `${months[idx] ?? m[2]} ${m[1]}`;
  }
  return trimmed;
}

function formatPeriod(start?: string, end?: string, current?: boolean): string {
  const s = fmtDate(start);
  const e = current ? "Present" : fmtDate(end);
  if (s && e) return `${s} – ${e}`;
  return s || e || "";
}

function buildSummarySection(resume: ResumeData): RenderDocumentSection | null {
  if (!resume.summary || !resume.summary.trim()) return null;
  return {
    type: "summary",
    title: "PROFESSIONAL SUMMARY",
    items: [
      {
        kind: "text",
        text: resume.summary.trim(),
      },
    ],
  };
}

function buildExperienceSection(resume: ResumeData): RenderDocumentSection | null {
  if (!resume.experience || resume.experience.length === 0) return null;
  const expItems: RenderContentItem[] = [];
  for (const exp of resume.experience) {
    if (!exp) continue;
    const dateStr = formatPeriod(exp.startDate, exp.endDate, exp.current);
    const titleCompany = [
      exp.title?.trim(),
      exp.company?.trim() ? `| ${exp.company.trim()}` : "",
      exp.location?.trim() ? `| ${exp.location.trim()}` : "",
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
  if (expItems.length === 0) return null;
  return {
    type: "experience",
    title: "PROFESSIONAL EXPERIENCE",
    items: expItems,
  };
}

function buildEducationSection(resume: ResumeData): RenderDocumentSection | null {
  if (!resume.education || resume.education.length === 0) return null;
  const eduItems: RenderContentItem[] = [];
  for (const edu of resume.education) {
    if (!edu) continue;
    const dateStr = formatPeriod(edu.startDate, edu.endDate);
    const degreeField = [
      edu.degree?.trim(),
      edu.field?.trim() ? `in ${edu.field.trim()}` : "",
    ].filter(Boolean).join(" ");

    const leftParts = [
      degreeField || "Education",
      edu.institution?.trim() ? `| ${edu.institution.trim()}` : "",
      edu.location?.trim() ? `| ${edu.location.trim()}` : "",
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

    const allBullets: string[] = [];
    for (const h of edu.highlights || []) {
      if (typeof h !== "string") continue;
      const cleaned = h.replace(/^Modules:\s*/i, "").trim();
      if (cleaned.includes(",")) {
        cleaned.split(",").map((s) => s.trim()).filter(Boolean).forEach((m) => allBullets.push(m));
      } else if (cleaned) {
        allBullets.push(cleaned);
      }
    }
    if (allBullets.length > 0) {
      eduItems.push({
        kind: "bullets",
        bullets: allBullets,
      });
    }
  }
  if (eduItems.length === 0) return null;
  return {
    type: "education",
    title: "EDUCATION & PROFESSIONAL DEVELOPMENT",
    items: eduItems,
  };
}

function buildSkillsSection(resume: ResumeData): RenderDocumentSection | null {
  if (!resume.skills || resume.skills.length === 0) return null;
  const skillMap = new Map<string, string[]>();
  const seenPerCat = new Map<string, Set<string>>();

  for (const s of resume.skills) {
    if (!s) continue;
    const cat = (s.category || "").trim() || "Core Competencies";
    let name = (s.name || "").trim();
    if (!name) continue;

    if (name.toLowerCase().startsWith(cat.toLowerCase() + ":")) {
      name = name.slice(cat.length + 1).trim();
    }

    const rawTokens = (name.includes("•") || name.includes(",") || name.includes(";"))
      ? name.split(/[,;•]/).map((t) => t.trim()).filter(Boolean)
      : [name];

    if (!skillMap.has(cat)) {
      skillMap.set(cat, []);
      seenPerCat.set(cat, new Set<string>());
    }
    const catItems = skillMap.get(cat)!;
    const catSeen = seenPerCat.get(cat)!;

    for (let token of rawTokens) {
      if (token.toLowerCase().startsWith(cat.toLowerCase() + ":")) {
        token = token.slice(cat.length + 1).trim();
      }
      if (!token) continue;
      const canon = token.toLowerCase().replace(/[\u2010-\u2015\u2212-]+/g, " ").replace(/\s+/g, " ").trim();
      if (!canon || catSeen.has(canon)) continue;
      catSeen.add(canon);
      catItems.push(token);
    }
  }
  const groups = Array.from(skillMap.entries()).map(([label, items]) => ({ label, items }));
  if (groups.length === 0) return null;
  return {
    type: "skills",
    title: "CORE COMPETENCIES & SKILLS",
    items: [
      {
        kind: "nested-bullets",
        groups,
      },
    ],
  };
}

function buildLanguagesSection(resume: ResumeData): RenderDocumentSection | null {
  if (!resume.languages || resume.languages.length === 0) return null;
  const langBullets = resume.languages
    .filter((l) => l && (l.name || l.language))
    .map((l) => {
      const name = (l.name || l.language || "").trim();
      const prof = (l.proficiency || l.fluency || "").trim();
      return prof ? `**${name}** (${prof})` : `**${name}**`;
    });
  if (langBullets.length === 0) return null;
  return {
    type: "languages",
    title: "LANGUAGES",
    items: [
      {
        kind: "bullets",
        bullets: langBullets,
      },
    ],
  };
}

function buildCertificationsSection(resume: ResumeData): RenderDocumentSection | null {
  if (!resume.certifications || resume.certifications.length === 0) return null;
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
  if (certItems.length === 0) return null;
  return {
    type: "certifications",
    title: "CERTIFICATIONS",
    items: certItems,
  };
}

function buildProjectsSection(resume: ResumeData): RenderDocumentSection | null {
  if (!resume.projects || resume.projects.length === 0) return null;
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
  if (projItems.length === 0) return null;
  return {
    type: "projects",
    title: "PROJECTS",
    items: projItems,
  };
}

function buildDynamicSections(resume: ResumeData): RenderDocumentSection[] {
  if (!resume.dynamicSections || resume.dynamicSections.length === 0) return [];
  const res: RenderDocumentSection[] = [];
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
      res.push({
        type: ds.type || "custom",
        title: (ds.title || "ADDITIONAL INFORMATION").toUpperCase(),
        items,
      });
    }
  }
  return res;
}

function buildAdditionalInfoSection(resume: ResumeData): RenderDocumentSection | null {
  if (!resume.additionalInfo || !resume.additionalInfo.trim()) return null;
  return {
    type: "custom",
    title: "ADDITIONAL INFORMATION",
    items: [{ kind: "text", text: resume.additionalInfo.trim() }],
  };
}

export function toRenderDocument(resume: ResumeData, layout?: ResumeLayoutModel): RenderDocument {
  const sections: RenderDocumentSection[] = [];

  // Canonical section order matching EditableA4Preview:
  // 1. Professional Summary
  // 2. Professional Experience
  // 3. Education & Professional Development
  // 4. Core Competencies & Skills
  // 5. Languages
  // 6. Certifications
  // 7. Projects
  // 8. Dynamic Sections
  // 9. Additional Info
  const defaultOrder = [
    "summary",
    "experience",
    "education",
    "skills",
    "languages",
    "certifications",
    "projects",
    "dynamicSections",
    "additionalInfo",
  ];

  const order = (Array.isArray(resume.sectionOrder) && resume.sectionOrder.length > 0)
    ? resume.sectionOrder
    : defaultOrder;

  const sectionMap: Record<string, () => RenderDocumentSection | RenderDocumentSection[] | null> = {
    summary: () => buildSummarySection(resume),
    experience: () => buildExperienceSection(resume),
    education: () => buildEducationSection(resume),
    skills: () => buildSkillsSection(resume),
    languages: () => buildLanguagesSection(resume),
    certifications: () => buildCertificationsSection(resume),
    projects: () => buildProjectsSection(resume),
    dynamicsections: () => buildDynamicSections(resume),
    dynamic_sections: () => buildDynamicSections(resume),
    additionalinfo: () => buildAdditionalInfoSection(resume),
    additional_info: () => buildAdditionalInfoSection(resume),
  };

  const renderedKeys = new Set<string>();
  const addKey = (k: string) => {
    const norm = k.toLowerCase().replace(/[\s_-]+/g, "");
    if (renderedKeys.has(norm)) return;
    renderedKeys.add(norm);
    const builder = sectionMap[norm];
    if (builder) {
      const res = builder();
      if (res) {
        if (Array.isArray(res)) {
          sections.push(...res);
        } else {
          sections.push(res);
        }
      }
    }
  };

  for (const k of order) {
    addKey(k);
  }
  for (const k of defaultOrder) {
    addKey(k);
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
