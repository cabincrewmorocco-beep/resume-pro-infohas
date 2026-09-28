// ============================================================================
// Phase 3 — Layout & Rendering Types
// ============================================================================

export interface RenderNodePosition {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  page?: number;
  order?: number;
  xMm?: number;
  yMm?: number;
  widthMm?: number;
  heightMm?: number;
  [key: string]: any;
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
  marginTopMm?: number;
  marginBottomMm?: number;
  marginLeftMm?: number;
  marginRightMm?: number;
  [key: string]: any;
}

export interface RenderNode {
  id: string;
  type: string;
  content?: string | any[];
  position?: RenderNodePosition;
  style?: RenderNodeStyle;
  children?: RenderNode[];
  [key: string]: any;
}

export interface ResumeTheme {
  name?: string;
  primaryColor?: string;
  accentColor?: string;
  textColor?: string;
  backgroundColor?: string;
  fontFamily?: string;
  fontSizePt?: number;
  lineSpacing?: number;
  sectionSpacingPt?: number;
  marginMm?: number;
  pageSize?: string;
  lineHeightMm?: number;
  sectionGapMm?: number;
  paragraphSpacingMm?: number;
  marginTopMm?: number;
  marginBottomMm?: number;
  marginLeftMm?: number;
  marginRightMm?: number;
  bodyFontSizePt?: number;
  fontSizeMm?: number;
  [key: string]: any;
}

export interface PageLayout {
  pageNumber: number;
  widthMm: number;
  heightMm: number;
  nodes?: RenderNode[];
  totalCharCount?: number;
  fillPercentage?: number;
  marginTopMm?: number;
  marginBottomMm?: number;
  marginLeftMm?: number;
  marginRightMm?: number;
  usableWidthMm?: number;
  usableHeightMm?: number;
  currentY?: number;
  remainingHeightMm?: number;
  overflow?: boolean;
  [key: string]: any;
}

export interface LayoutResult {
  pages: PageLayout[];
  totalPages: number;
  totalCharCount?: number;
  isSinglePage?: boolean;
  overflowAmount?: number;
  underflowAmount?: number;
  nodes?: RenderNode[];
  hasOverflow?: boolean;
  [key: string]: any;
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
  [key: string]: any;
}

export interface CanonicalSection {
  type: CanonicalSectionType;
  title: string;
  items: CanonicalSectionItem[];
  [key: string]: any;
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
  name?: string;
  headline?: string;
  photoUrl?: string;
  contact?: {
    phone?: string;
    email?: string;
    location?: string;
  };
  sections: CanonicalSection[];
  metadata?: Record<string, unknown>;
  [key: string]: any;
}

export type ResumeTemplate = "ats-professional" | "modern" | "classic" | "minimal" | "executive" | "creative" | "technical" | string;

export interface CompressionResult {
  compressed?: boolean;
  originalCharCount?: number;
  newCharCount?: number;
  reducedPercent?: number;
  actionsApplied?: string[];
  originalChars?: number;
  compressedChars?: number;
  compressionRatio?: number;
  stepsApplied?: string[];
  fitsOnOnePage?: boolean;
  [key: string]: any;
}
