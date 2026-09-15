import { sanitizeResumeData, adjustLayoutForPageFill, getLayoutForTemplate } from "./src/lib/exporter";
import { toRenderDocument } from "./src/lib/render-document";
import { exportResumePDFRenderDoc } from "./src/lib/export-pdf-render";
import { exportResumeDOCXRenderDoc } from "./src/lib/export-docx-render";

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
    name: "Resume with partial contact & empty items",
    resume: {
      id: "r3",
      name: "Jane Doe",
      contact: {
        email: undefined,
        phone: undefined,
        location: undefined,
        photoUrl: "data:image/png;base64,invalid",
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
  },
  {
    name: "Aviation template",
    resume: {
      id: "r6",
      name: "Pilot User",
      template: "aviation",
      contact: { email: "pilot@example.com" },
      experience: [],
      education: [],
      skills: [],
      languages: [],
    }
  }
];

async function run() {
  for (const tc of testCases) {
    console.log(`\n=== Testing ${tc.name} ===`);
    try {
      const sanitized = sanitizeResumeData(tc.resume);
      const template = (sanitized.template ?? "ats-professional") as string;
      let layout = getLayoutForTemplate(template, sanitized.accentColor);
      layout = adjustLayoutForPageFill(sanitized, layout);
      const rd = toRenderDocument(sanitized, layout);

      console.log(`- toRenderDocument OK (sections: ${rd.sections.length})`);

      try {
        const pdfRes = await exportResumePDFRenderDoc(rd);
        console.log(`- PDF export result: ok=${pdfRes.ok}, pages=${pdfRes.pages}, error=${pdfRes.error}`);
      } catch (pdfErr: any) {
        console.error(`- PDF EXPORT CRASH:`, pdfErr);
      }

      try {
        const docxBlob = await exportResumeDOCXRenderDoc(rd);
        console.log(`- DOCX export result: size=${docxBlob.size}`);
      } catch (docxErr: any) {
        console.error(`- DOCX EXPORT CRASH:`, docxErr);
      }
    } catch (err: any) {
      console.error(`SETUP FAILED for ${tc.name}:`, err);
    }
  }
}

run();
