// ============================================================================
// Resume Layout Defaults
// ============================================================================

import type { ResumeLayoutModel } from "./types";

export function getDefaultResumeLayout(): ResumeLayoutModel {
  return {
    template: "ats-professional",
    font: "Times New Roman",
    fontFamily: "Times New Roman",
    fontSize: 10,
    bodyFontSizePt: 10,
    headingFontSizePt: 14,
    sectionTitleSizePt: 11,
    nameSizePt: 16,
    nameColor: "#003366",
    sectionTitleColor: "#003366",
    bodyTextColor: "#000000",
    contactColor: "#333333",
    margins: { top: 10, bottom: 10, left: 14, right: 14 },
    marginLeftMm: 14,
    marginRightMm: 14,
    marginTopMm: 10,
    marginBottomMm: 10,
    lineSpacing: 1.2,
    lineHeightMm: 10 * 0.352778 * 1.2,
    sectionSpacing: 10,
    sectionGapMm: 3.5,
    headerGapMm: 3,
    primaryColor: "#003366",
    accentColor: "#003366",
    alignment: "left",
    sectionAlignment: {},
    compact: false,
  };
}
