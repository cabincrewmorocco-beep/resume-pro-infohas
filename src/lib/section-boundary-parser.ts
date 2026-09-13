// ============================================================================
// Section Boundary Parser
// ============================================================================

export interface SectionBoundary {
  type: "header" | "summary" | "experience" | "education" | "skills" | "projects" | "certifications" | "languages" | "unknown";
  header: string;
  startIndex: number;
  endIndex: number;
  lines: string[];
  contentLines: string[];
}

const SECTION_PATTERNS: Record<string, RegExp> = {
  summary: /^(professional\s+summary|summary|profile|about\s+me|career\s+objective)/i,
  experience: /^(work\s+experience|professional\s+experience|experience|employment\s+history)/i,
  education: /^(education|academic\s+background|degrees)/i,
  skills: /^(skills|technical\s+skills|core\s+competencies|key\s+skills)/i,
  projects: /^(projects|personal\s+projects|key\s+projects)/i,
  certifications: /^(certifications|licenses|credentials)/i,
  languages: /^(languages|spoken\s+languages)/i,
};

export function detectSectionBoundaries(lines: string[]): SectionBoundary[] {
  const boundaries: SectionBoundary[] = [];
  const detectedIndices: Array<{ index: number; type: SectionBoundary["type"]; header: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.length > 50) continue;

    for (const [secType, regex] of Object.entries(SECTION_PATTERNS)) {
      if (regex.test(trimmed)) {
        detectedIndices.push({
          index: i,
          type: secType as SectionBoundary["type"],
          header: trimmed,
        });
        break;
      }
    }
  }

  for (let j = 0; j < detectedIndices.length; j++) {
    const cur = detectedIndices[j];
    const nextIndex = j + 1 < detectedIndices.length ? detectedIndices[j + 1].index : lines.length;
    const secLines = lines.slice(cur.index + 1, nextIndex);
    boundaries.push({
      type: cur.type,
      header: cur.header,
      startIndex: cur.index,
      endIndex: nextIndex,
      lines: secLines,
      contentLines: secLines,
    });
  }

  return boundaries;
}
