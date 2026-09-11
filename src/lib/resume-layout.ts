// ============================================================================
// Resume Layout Defaults
// ============================================================================

import type { ResumeLayoutModel } from "./types";

export function getDefaultResumeLayout(): ResumeLayoutModel {
  return {
    template: "modern",
    font: "Inter",
    fontSize: 10,
    bodyFontSizePt: 10,
    headingFontSizePt: 14,
    margins: { top: 12, bottom: 12, left: 12, right: 12 },
    lineSpacing: 1.3,
    sectionSpacing: 10,
    primaryColor: "#0f172a",
    accentColor: "#2563eb",
    alignment: "left",
    sectionAlignment: {},
    compact: false,
  };
}
