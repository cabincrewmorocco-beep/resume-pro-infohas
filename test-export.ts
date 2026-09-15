import { toRenderDocument } from "./src/lib/render-document";
import { exportResumePDFRenderDoc } from "./src/lib/export-pdf-render";
import { exportResumeDOCXRenderDoc } from "./src/lib/export-docx-render";
import type { ResumeData } from "./src/lib/types";

const testResume: ResumeData = {
  id: "test-1",
  name: "John Doe",
  headline: "Software Engineer",
  summary: "Experienced software engineer with a track record...",
  contact: {
    email: "john@example.com",
    phone: "+1234567890",
    location: "New York, NY"
  },
  experience: [
    {
      id: "exp-1",
      title: "Senior Developer",
      company: "Tech Corp",
      startDate: "2020-01",
      endDate: "2023-01",
      bullets: ["Built scalable systems", "Led a team of 5"]
    }
  ],
  education: [
    {
      id: "edu-1",
      degree: "B.S. in Computer Science",
      institution: "MIT",
      startDate: "2016-09",
      endDate: "2020-05"
    }
  ],
  skills: [
    { id: "sk-1", name: "TypeScript", category: "Languages" },
    { id: "sk-2", name: "React", category: "Frontend" }
  ],
  languages: [
    { id: "lang-1", name: "English", proficiency: "Native" }
  ],
  certifications: [],
  projects: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

async function run() {
  const rd = toRenderDocument(testResume);
  console.log("Testing PDF export with basic resume...");
  try {
    const pdfRes = await exportResumePDFRenderDoc(rd);
    console.log("PDF result:", pdfRes);
  } catch (err: any) {
    console.error("PDF FAILED:", err);
  }

  console.log("Testing DOCX export with basic resume...");
  try {
    const blob = await exportResumeDOCXRenderDoc(rd);
    console.log("DOCX result size:", blob.size);
  } catch (err: any) {
    console.error("DOCX FAILED:", err);
  }
}

run();
