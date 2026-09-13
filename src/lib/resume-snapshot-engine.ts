// ============================================================================
// Resume Snapshot Engine
// ============================================================================

import type { ResumeData } from "./types";

export interface ResumeSnapshot {
  id: string;
  snapshotId?: string;
  label?: string;
  timestamp: string;
  resume: ResumeData;
  hash: string;
}

export function createSnapshot(resume: ResumeData, label?: string): ResumeSnapshot {
  const json = JSON.stringify(resume);
  let hash = 0;
  for (let i = 0; i < json.length; i++) {
    hash = (hash << 5) - hash + json.charCodeAt(i);
    hash |= 0;
  }
  const id = `snap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  return {
    id,
    snapshotId: id,
    label,
    timestamp: new Date().toISOString(),
    resume: JSON.parse(json),
    hash: hash.toString(36),
  };
}

export function compareSnapshots(
  snapA: ResumeSnapshot,
  snapB: ResumeSnapshot
): { identical: boolean; differences: string[]; summary: string; hallucinations: string[] } {
  const diffs: string[] = [];
  if (snapA.hash !== snapB.hash) {
    diffs.push("Content hash changed");
  }
  return {
    identical: diffs.length === 0,
    differences: diffs,
    summary: diffs.length === 0 ? "No changes" : diffs.join("; "),
    hallucinations: [],
  };
}
