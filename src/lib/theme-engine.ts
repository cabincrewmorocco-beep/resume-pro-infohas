// ============================================================================
// Theme Engine — Resume Theming System
// ============================================================================

import type { ResumeTheme } from "./types-phase3";

const DEFAULT_THEME: ResumeTheme = {
  name: "Classic Slate",
  primaryColor: "#0f172a",
  accentColor: "#2563eb",
  textColor: "#334155",
  backgroundColor: "#ffffff",
  fontFamily: "Inter, sans-serif",
  fontSizePt: 10,
  lineSpacing: 1.35,
  sectionSpacingPt: 12,
  marginMm: 15,
};

export function buildTheme(
  templateId?: string,
  overrides?: Partial<ResumeTheme>
): ResumeTheme {
  return {
    ...DEFAULT_THEME,
    ...overrides,
    name: templateId || DEFAULT_THEME.name,
  };
}
