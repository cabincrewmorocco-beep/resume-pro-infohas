// ============================================================================
// Phase 3 — Layout & Rendering Types
// ============================================================================

export interface RenderNodePosition {
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

export interface RenderNodeStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string | number;
  lineHeight?: number;
  color?: string;
  backgroundColor?: string;
  textAlign?: "left" | "center" | "right" | "justify";
  margin?: { top?: number; right?: number; bottom?: number; left?: number };
  padding?: { top?: number; right?: number; bottom?: number; left?: number };
}

export interface RenderNode {
  id: string;
  type: string;
  content?: string | any[];
  position?: RenderNodePosition;
  style?: RenderNodeStyle;
  children?: RenderNode[];
  [key: string]: unknown;
}

export interface ResumeTheme {
  name: string;
  primaryColor: string;
  accentColor: string;
  textColor: string;
  backgroundColor: string;
  fontFamily: string;
  fontSizePt: number;
  lineSpacing: number;
  sectionSpacingPt: number;
  marginMm: number;
}

export interface PageLayout {
  pageNumber: number;
  widthMm: number;
  heightMm: number;
  nodes: RenderNode[];
  totalCharCount: number;
  fillPercentage: number;
}

export interface LayoutResult {
  pages: PageLayout[];
  totalPages: number;
  totalCharCount: number;
  isSinglePage: boolean;
  overflowAmount?: number;
  underflowAmount?: number;
}

export type CanonicalSectionType =
  | "header"
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "languages"
  | "certifications"
  | "projects"
  | "custom"
  | string;

export interface CanonicalSectionItem {
  id?: string;
  title?: string;
  subtitle?: string;
  date?: string;
  location?: string;
  bullets?: string[];
  content?: string;
  [key: string]: unknown;
}

export interface CanonicalSection {
  type: CanonicalSectionType;
  title: string;
  items: CanonicalSectionItem[];
  [key: string]: unknown;
}

export interface CanonicalResume {
  header: {
    name: string;
    title?: string;
    email?: string;
    phone?: string;
    location?: string;
    links?: Array<{ label: string; url: string }>;
  };
  sections: CanonicalSection[];
  metadata?: Record<string, unknown>;
}

export type ResumeTemplate = "ats-professional" | "modern" | "classic" | "minimal" | "executive" | "creative" | "technical" | string;

export interface CompressionResult {
  compressed: boolean;
  originalCharCount: number;
  newCharCount: number;
  reducedPercent: number;
  actionsApplied: string[];
}
