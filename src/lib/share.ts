// ============================================================================
// ResumeAI Pro — Public Share Snapshots Engine
// ============================================================================

import type { ResumeData } from "./types";

export interface ShareRecord {
  id: string;
  resumeId: string;
  resume: ResumeData;
  hideContact?: boolean;
  views?: number;
  createdAt?: string;
  updatedAt?: string;
}

export function buildShareSnapshot(
  resume: ResumeData,
  options?: { hideContact?: boolean }
): ResumeData {
  const cloned = JSON.parse(JSON.stringify(resume)) as ResumeData;
  if (options?.hideContact && cloned.contact) {
    cloned.contact.email = undefined;
    cloned.contact.phone = undefined;
  }
  return cloned;
}

export function shareUrlFor(shareId: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/share/${shareId}`;
}

export function parseShareRow(row: any): ShareRecord {
  return {
    id: row.id,
    resumeId: row.resumeId || row.resume_id,
    resume: typeof row.resume === "string" ? JSON.parse(row.resume) : row.resume,
    hideContact: Boolean(row.hideContact || row.hide_contact),
    views: row.views || 0,
    createdAt: row.createdAt || row.created_at,
    updatedAt: row.updatedAt || row.updated_at,
  };
}
