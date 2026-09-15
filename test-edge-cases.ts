import { sanitizeResumeData, adjustLayoutForPageFill, getLayoutForTemplate } from "./src/lib/exporter";
import { toRenderDocument } from "./src/lib/render-document";
import { exportResumeDOCXRenderDoc } from "./src/lib/export-docx-render";
import type { ResumeData } from "./src/lib/types";

// Test various resumes that users might have
const testCases: Array<{ name: string; resume: any }> = [
  {
    name: "Completely minimal / empty resume",
    resume: {
      id: "r1",
      name: "",
      experience: [],
      education: [],
      skills: [],
      languages: [],
    }
  },
  {
    name: "Resume with undefined fields",
    resume: {
      id: "r2",
      name: undefined,
      title: undefined,
      headline: undefined,
      summary: undefined,
      contact: undefined,
      experience: undefined,
      education: undefined,
      skills: undefined,
      languages: undefined,
      certifications: undefined,
      projects: undefined,
      dynamicSections: undefined,
      additionalInfo: undefined,
    }
  },
  {
    name: "Resume with partial contact",
    resume: {
      id: "r3",
      name: "Jane Doe",
      contact: {
        email: undefined,
        phone: undefined,
        location: undefined,
      },
      experience: [
        {
          id: "e1",
          title: undefined,
          company: undefined,
          bullets: [undefined, null, "Normal bullet"],
        }
      ],
      education: [
        {
          id: "ed1",
          degree: undefined,
          institution: undefined,
          highlights: [undefined],
        }
      ],
      skills: [
        { id: "s1", name: undefined, category: undefined },
        { id: "s2", name: "Skill 1", category: undefined },
      ],
      languages: [
        { id: "l1", name: undefined, proficiency: undefined },
      ],
      certifications: [
        { id: "c1", name: undefined, issuer: undefined },
      ],
      projects: [
        { id: "p1", name: undefined, description: undefined, bullets: [undefined] },
      ],
      dynamicSections: [
        { id: "d1", title: undefined, content: undefined, bullets: [undefined] },
      ]
    }
  },
  {
    name: "Resume with modern sidebar template",
    resume: {
      id: "r4",
      name: "Sidebar User",
      template: "modern",
      contact: {
        email: "side@example.com",
        phone: "123",
      },
      skills: [{ id: "s1", name: "React", category: "Frontend" }],
      experience: [
        {
          id: "e1",
          title: "Dev",
          company: "Acme",
          bullets: ["Did things"],
        }
      ],
      education: [],
      languages: [],
    }
  },
  {
    name: "Resume with creative sidebar template and undefined fields",
    resume: {
      id: "r5",
      name: undefined,
      template: "creative",
      contact: undefined,
      skills: [{ id: "s1", name: "Design" }],
      experience: [],
      education: [],
      languages: [],
    }
  }
];

async function run() {
  for (const tc of testCases) {
    console.log(`\n--- Testing ${tc.name} ---`);
    try {
      const sanitized = sanitizeResumeData(tc.resume);
      const template = (sanitized.template ?? "ats-professional") as string;
      let layout = getLayoutForTemplate(template, sanitized.accentColor);
      layout = adjustLayoutForPageFill(sanitized, layout);
      const rd = toRenderDocument(sanitized, layout);
      console.log(`toRenderDocument ok. Sections: ${rd.sections.length}`);
      
      const blob = await exportResumeDOCXRenderDoc(rd);
      console.log(`DOCX success, size: ${blob.size}`);
    } catch (err: any) {
      console.error(`DOCX FAILED for ${tc.name}:`, err);
    }
  }
}

run();
