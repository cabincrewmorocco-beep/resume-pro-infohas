// ============================================================================
// LayoutEngine — page layout, overflow detection, positioning
// ============================================================================
// Responsibilities:
//   - Calculate page dimensions from theme
//   - Position RenderNodes within pages
//   - Detect overflow and trigger compaction
//   - Widow/orphan control for section titles

import type { RenderNode, RenderNodePosition, ResumeTheme, PageLayout, LayoutResult, RenderNodeStyle } from "./types-phase3";

/** A4 dimensions in mm */
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

/** Letter dimensions in mm */
const LETTER_WIDTH_MM = 215.9;
const LETTER_HEIGHT_MM = 279.4;

/** Estimated line height contribution for one character */
const CHARS_PER_LINE = 75; // average for 10pt on A4

/**
 * Get page dimensions for a given page size.
 */
export function getPageDimensionsMm(pageSize: "A4" | "Letter"): { widthMm: number; heightMm: number } {
  return pageSize === "A4"
    ? { widthMm: A4_WIDTH_MM, heightMm: A4_HEIGHT_MM }
    : { widthMm: LETTER_WIDTH_MM, heightMm: LETTER_HEIGHT_MM };
}

/**
 * Create an initial PageLayout from theme values.
 */
export function createPageLayout(
  pageNumber: number,
  theme: ResumeTheme,
): PageLayout {
  const pageSize: "A4" | "Letter" = theme.pageSize === "A4" ? "A4" : "Letter";
  const { widthMm, heightMm } = getPageDimensionsMm(pageSize);
  const marginTopMm = theme.marginTopMm ?? 6.35;
  const marginBottomMm = theme.marginBottomMm ?? 6.35;
  const marginLeftMm = theme.marginLeftMm ?? 8.89;
  const marginRightMm = theme.marginRightMm ?? 8.89;
  const usableWidthMm = widthMm - marginLeftMm - marginRightMm;
  const usableHeightMm = heightMm - marginTopMm - marginBottomMm;
  return {
    pageNumber,
    widthMm,
    heightMm,
    marginTopMm,
    marginBottomMm,
    marginLeftMm,
    marginRightMm,
    usableWidthMm,
    usableHeightMm,
    currentY: 0,
    remainingHeightMm: usableHeightMm,
    overflow: false,
  };
}

/**
 * Estimate the rendered height of a RenderNode in mm.
 * Used by the layout engine to position nodes before actual rendering.
 */
export function estimateNodeHeightMm(
  node: RenderNode,
  usableWidthMm: number,
  theme: ResumeTheme,
): number {
  const lineHeightMm = theme.lineHeightMm || 4.2;
  const baseFontSize = theme.bodyFontSizePt || 10;
  const avgCharWidthMm = usableWidthMm / CHARS_PER_LINE;

  // Base size for different node types
  switch (node.type) {
    case "section-title":
      return lineHeightMm * 1.4;
    case "text-line":
    case "contact-line":
      return lineHeightMm;
    case "bullet-item": {
      const charsPerLine = Math.floor(usableWidthMm / avgCharWidthMm) - 4; // indent
      const lines = Math.ceil(node.content.length / Math.max(charsPerLine, 1));
      return lines * lineHeightMm;
    }
    case "table-row":
      return lineHeightMm;
    case "table-cell":
      return lineHeightMm;
    case "divider":
      return 1.5;
    default:
      return lineHeightMm;
  }
}

/**
 * Calculate total estimated height for a list of nodes.
 */
export function estimateTotalHeightMm(
  nodes: RenderNode[],
  usableWidthMm: number,
  theme: ResumeTheme,
): number {
  let total = 0;
  for (const node of nodes) {
    total += estimateNodeHeightMm(node, usableWidthMm, theme);
    // Add margins
    if (node.style?.marginTopMm) total += node.style.marginTopMm;
    if (node.style?.marginBottomMm) total += node.style.marginBottomMm;
  }
  return total;
}

/**
 * Position a list of RenderNodes across pages.
 * Assigns page number and y-offset to each node.
 */
export function layoutNodes(
  nodes: RenderNode[],
  theme: ResumeTheme,
): LayoutResult {
  const pages: PageLayout[] = [];
  let currentPage = createPageLayout(0, theme);
  pages.push(currentPage);

  const positionedNodes: RenderNode[] = [];

  for (const node of nodes) {
    const estimatedHeight = estimateNodeHeightMm(node, currentPage.usableWidthMm ?? 180, theme);
    const marginTop = node.style?.marginTopMm || 0;
    const marginBottom = node.style?.marginBottomMm || 0;
    const totalHeight = estimatedHeight + marginTop + marginBottom;

    // Check if node fits on current page
    if ((currentPage.remainingHeightMm ?? 0) < totalHeight && (currentPage.currentY ?? 0) > 0) {
      // Start a new page
      currentPage = createPageLayout(pages.length, theme);
      pages.push(currentPage);
    }

    // Position the node
    const position: RenderNodePosition = {
      page: currentPage.pageNumber,
      order: (currentPage.currentY ?? 0) > 0
        ? positionedNodes.filter((n) => n.position?.page === currentPage.pageNumber).length
        : 0,
      xMm: theme.marginLeftMm ?? 8.89,
      yMm: (theme.marginTopMm ?? 6.35) + (currentPage.currentY ?? 0) + marginTop,
      widthMm: currentPage.usableWidthMm ?? 180,
      heightMm: estimatedHeight,
    };

    currentPage.currentY = (currentPage.currentY ?? 0) + totalHeight;
    currentPage.remainingHeightMm = (currentPage.remainingHeightMm ?? 0) - totalHeight;

    const positionedNode: RenderNode = {
      ...node,
      position,
    };
    positionedNodes.push(positionedNode);
  }

  // Check overflow
  const currentY = currentPage.currentY ?? 0;
  const marginTopMm = currentPage.marginTopMm ?? 6.35;
  const marginBottomMm = currentPage.marginBottomMm ?? 6.35;
  const hasOverflow = currentY > (currentPage.heightMm - marginTopMm - marginBottomMm);

  return {
    pages: pages.map((p) => ({
      ...p,
      overflow: (p.remainingHeightMm ?? 0) < 0,
    })),
    nodes: positionedNodes,
    totalPages: pages.length,
    hasOverflow,
  };
}

/**
 * Detect if content overflows a single page.
 */
export function detectOverflow(estimatedTotalMm: number, theme: ResumeTheme): boolean {
  const pageSize: "A4" | "Letter" = theme.pageSize === "A4" ? "A4" : "Letter";
  const { heightMm } = getPageDimensionsMm(pageSize);
  const marginTop = theme.marginTopMm ?? 6.35;
  const marginBottom = theme.marginBottomMm ?? 6.35;
  const usableHeight = heightMm - marginTop - marginBottom;
  return estimatedTotalMm > usableHeight;
}

/**
 * Suggest compression steps when content overflows.
 * Never removes content — only adjusts spacing and font sizes.
 */
export function suggestCompression(
  overflowMm: number,
  theme: ResumeTheme,
): string[] {
  const steps: string[] = [];

  // Step 1: reduce line spacing
  if ((theme.lineHeightMm ?? 4.2) > 3.2) {
    steps.push("reduce-line-spacing");
  }

  // Step 2: reduce section gap
  if ((theme.sectionGapMm ?? 3.0) > 1.5) {
    steps.push("reduce-section-gap");
  }

  // Step 3: reduce margins
  if ((theme.marginTopMm ?? 6.35) > 4) {
    steps.push("reduce-margins");
  }

  // Step 4: reduce body font size
  if ((theme.bodyFontSizePt ?? 10) > 9) {
    steps.push("reduce-font-size");
  }

  return steps;
}
