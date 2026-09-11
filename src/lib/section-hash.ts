// ============================================================================
// Section Hash — Document Parity Verification
// ============================================================================

import type { RenderDocument } from "./types";

export interface SectionHash {
  type: string;
  title: string;
  charCount: number;
  hash: string;
}

export function computeSectionHashes(doc: RenderDocument): SectionHash[] {
  if (!doc?.sections) return [];

  return doc.sections.map((sec) => {
    const rawContent = JSON.stringify(sec);
    let hashVal = 0;
    for (let i = 0; i < rawContent.length; i++) {
      hashVal = (hashVal << 5) - hashVal + rawContent.charCodeAt(i);
      hashVal |= 0;
    }
    const secType = sec.type === "experience" ? "professionalExperience" : sec.type;
    return {
      type: secType,
      title: sec.title || sec.type,
      charCount: rawContent.length,
      hash: hashVal.toString(36),
    };
  });
}
