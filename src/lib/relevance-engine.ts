// ============================================================================
// Relevance Engine — Candidate-Job Relevance Scorer
// ============================================================================

import type { ResumeData } from "./types";
import type { JobIntelligence } from "./job-intelligence";

export interface RelevanceScoreResult {
  passes: boolean;
  overall: number;
  details: {
    missingPriorityKeywords: string[];
    avoidKeywordsFound: string[];
  };
}

export function computeRelevanceScore(
  resume: ResumeData,
  ji?: JobIntelligence
): RelevanceScoreResult {
  if (!ji) {
    return {
      passes: true,
      overall: 95,
      details: {
        missingPriorityKeywords: [],
        avoidKeywordsFound: [],
      },
    };
  }

  const resumeText = JSON.stringify(resume).toLowerCase();
  const missingKeywords: string[] = [];

  const keySkills = (ji as any).topSkills || (ji as any).technicalSkills || [];
  for (const skill of keySkills) {
    const sName = (typeof skill === "string" ? skill : skill?.name || "").toLowerCase();
    if (sName && !resumeText.includes(sName)) {
      missingKeywords.push(sName);
    }
  }

  const overall = Math.max(70, 100 - missingKeywords.length * 5);
  const passes = overall >= 85;

  return {
    passes,
    overall,
    details: {
      missingPriorityKeywords: missingKeywords,
      avoidKeywordsFound: [],
    },
  };
}
