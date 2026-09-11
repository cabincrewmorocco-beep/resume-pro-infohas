// ============================================================================
// Semantic Cache — Caches Optimization Results
// ============================================================================

import type { ResumeData, JobDescription } from "./types";

const cache = new Map<string, any>();

function makeKey(resume: ResumeData, jd?: JobDescription | null, config?: any): string {
  const rId = resume.id || resume.title || "";
  const jId = jd?.id || jd?.title || "";
  const cStr = config ? JSON.stringify(config) : "";
  return `${rId}_${jId}_${cStr}`;
}

export function getCachedOptimization<T = any>(
  resume: ResumeData,
  jd?: JobDescription | null,
  config?: any
): T | null {
  const key = makeKey(resume, jd, config);
  return cache.get(key) || null;
}

export function setCachedOptimization<T = any>(
  resume: ResumeData,
  jd: JobDescription | null | undefined,
  config: any,
  result: T
): void {
  const key = makeKey(resume, jd, config);
  cache.set(key, result);
}
