/**
 * Client-Side Resume Template to A4 PDF Converter using html2canvas & jsPDF
 */

import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import type { Html2PdfOptions } from "./types";

export interface ConversionResult {
  ok: boolean;
  pageCount: number;
  filename: string;
  error?: string;
}

/**
 * Converts a live DOM element of the selected resume template into a pixel-perfect,
 * formatted A4 PDF document client-side.
 */
export async function exportTemplateToA4Pdf(
  element: HTMLElement | null,
  options: Html2PdfOptions = {}
): Promise<ConversionResult> {
  if (!element) {
    throw new Error("Target resume template element not found in DOM.");
  }

  const {
    filename = "Resume_Document.pdf",
    scale = 2, // 2x scale for crisp high-DPI text and graphics
    quality = 0.98,
  } = options;

  try {
    // A4 dimensions in millimeters (standard ISO 216)
    const A4_WIDTH_MM = 210;
    const A4_HEIGHT_MM = 297;

    // Save existing transform style to prevent scale distortion if preview is zoomed
    const originalTransform = element.style.transform;
    const originalTransformOrigin = element.style.transformOrigin;

    // Temporarily reset transform for 1:1 pixel fidelity capture
    element.style.transform = "none";
    element.style.transformOrigin = "top left";

    // Wait a frame for browser layout to stabilize
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 60)));

    // Render DOM node to high-res canvas
    const canvas = await html2canvas(element, {
      scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: element.scrollWidth || 794,
    });

    // Restore original transform
    element.style.transform = originalTransform;
    element.style.transformOrigin = originalTransformOrigin;

    // Convert canvas to image
    const imgData = canvas.toDataURL("image/jpeg", quality);

    // Initialize jsPDF instance in A4 format (millimeters)
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    // Calculate dimensions
    const imgWidthMm = A4_WIDTH_MM;
    const imgHeightMm = (canvas.height * A4_WIDTH_MM) / canvas.width;

    let heightLeft = imgHeightMm;
    let position = 0;
    let pageCount = 1;

    // Add first page
    pdf.addImage(imgData, "JPEG", 0, position, imgWidthMm, imgHeightMm, undefined, "FAST");
    heightLeft -= A4_HEIGHT_MM;

    // If the template content extends beyond 1 A4 page, slice across subsequent pages
    while (heightLeft > 2) {
      position = heightLeft - imgHeightMm;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, position, imgWidthMm, imgHeightMm, undefined, "FAST");
      heightLeft -= A4_HEIGHT_MM;
      pageCount++;
    }

    // Trigger client-side download
    const cleanFilename = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
    pdf.save(cleanFilename);

    return {
      ok: true,
      pageCount,
      filename: cleanFilename,
    };
  } catch (err: any) {
    console.error("[html2canvas + jsPDF Error]:", err);
    throw new Error(err.message || "Failed to convert resume template to A4 PDF.");
  }
}
