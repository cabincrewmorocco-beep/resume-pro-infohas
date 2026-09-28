/**
 * Helper to export and download generated resumes in PDF or DOCX formats
 * with loading indicators, fallback mechanisms, and toast notifications.
 */

import { exportResumePDF, exportResumeDOCX, exportResumeDOC } from "@/lib/exporter";
import type { ResumeData } from "@/lib/types";
import { toast } from "sonner";

export async function downloadResumeAsPDF(resume: ResumeData): Promise<boolean> {
  const toastId = toast.loading(`Generating PDF for "${resume.title || resume.name || "Resume"}"...`);
  try {
    const result = await exportResumePDF(resume, {}, undefined, null, true);
    toast.dismiss(toastId);
    if (result.ok) {
      toast.success(`PDF downloaded successfully! (${result.pages || 1} page${(result.pages || 1) > 1 ? "s" : ""})`);
      return true;
    } else {
      toast.error(result.error || "Could not generate PDF.");
      return false;
    }
  } catch (err: any) {
    toast.dismiss(toastId);
    console.error("[Dashboard Export] PDF Export failed:", err);
    toast.error(err?.message || "Failed to download PDF.");
    return false;
  }
}

export async function downloadResumeAsDOCX(resume: ResumeData): Promise<boolean> {
  const toastId = toast.loading(`Generating DOCX for "${resume.title || resume.name || "Resume"}"...`);
  try {
    try {
      await exportResumeDOCX(resume, undefined, null, true);
      toast.dismiss(toastId);
      toast.success(`DOCX downloaded successfully!`);
      return true;
    } catch (docxErr: any) {
      console.warn("[Dashboard Export] DOCX renderDoc failed, falling back to legacy DOC generator:", docxErr?.message);
      // Clean fallback using HTML-based DOC export
      exportResumeDOC(resume, "professional", null, true);
      toast.dismiss(toastId);
      toast.success(`Word Document (.doc) downloaded successfully!`);
      return true;
    }
  } catch (err: any) {
    toast.dismiss(toastId);
    console.error("[Dashboard Export] DOCX Export failed:", err);
    toast.error(err?.message || "Failed to download Word document.");
    return false;
  }
}
