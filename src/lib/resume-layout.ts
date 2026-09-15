// ============================================================================
// Resume Layout Defaults
// ============================================================================

import type { ResumeLayoutModel } from "./types";

export function getDefaultResumeLayout(): ResumeLayoutModel {
  return {
    template: "ats-professional",
    font: "Times New Roman",
    fontFamily: "Times New Roman",
    fontSize: 11,
    bodyFontSizePt: 11,
    headingFontSizePt: 14,
    sectionTitleSizePt: 12,
    nameSizePt: 14,
    nameColor: "#8B0000",
    sectionTitleColor: "#8B0000",
    bodyTextColor: "#000000",
    contactColor: "#000000",
    margins: { top: 4.5, bottom: 4.5, left: 6.89, right: 6.89 },
    marginLeftMm: 6.89,
    marginRightMm: 6.89,
    marginTopMm: 4.5,
    marginBottomMm: 4.5,
    lineSpacing: 1.05,
    lineHeightMm: 11 * 0.352778 * 1.05,
    sectionSpacing: 10,
    sectionGapMm: 4.5,
    headerGapMm: 3,
    primaryColor: "#8B0000",
    accentColor: "#8B0000",
    alignment: "justify",
    sectionAlignment: {},
    compact: false,
  };
}
