// ============================================================================
// ResumeAI Pro — Spell Checker Engine
// ============================================================================

import type { ResumeData } from "./types";

export interface SpellingIssue {
  word: string;
  context: string;
  path: string;
  suggestions: string[];
}

export interface SectionSpelling {
  label: string;
  issues: SpellingIssue[];
}

const COMMON_TYPOS: Record<string, string[]> = {
  teh: ["the"],
  recieve: ["receive"],
  seperate: ["separate"],
  managment: ["management"],
  develoepr: ["developer"],
  progaming: ["programming"],
  responisble: ["responsible"],
  implmented: ["implemented"],
  experiance: ["experience"],
  achievment: ["achievement"],
  colaboration: ["collaboration"],
  comunication: ["communication"],
  oppurtunity: ["opportunity"],
  leadreship: ["leadership"],
  maintenence: ["maintenance"],
};

export function scanResume(resume: ResumeData): SectionSpelling[] {
  const sections: SectionSpelling[] = [];

  const checkText = (text: string, pathPrefix: string, label: string): SpellingIssue[] => {
    if (!text) return [];
    const issues: SpellingIssue[] = [];
    const words = text.split(/\s+/);
    for (const rawWord of words) {
      const clean = rawWord.toLowerCase().replace(/[^a-z]/g, "");
      if (COMMON_TYPOS[clean]) {
        issues.push({
          word: rawWord,
          context: `...${text.slice(Math.max(0, text.indexOf(rawWord) - 20), text.indexOf(rawWord) + rawWord.length + 20)}...`,
          path: pathPrefix,
          suggestions: COMMON_TYPOS[clean],
        });
      }
    }
    return issues;
  };

  if (resume.summary) {
    const issues = checkText(resume.summary, "summary", "Professional Summary");
    if (issues.length) sections.push({ label: "Summary", issues });
  }

  if (resume.experience) {
    resume.experience.forEach((exp, idx) => {
      const expIssues: SpellingIssue[] = [];
      exp.bullets?.forEach((bullet, bIdx) => {
        expIssues.push(...checkText(bullet, `experience.${idx}.bullets.${bIdx}`, `Experience: ${exp.company}`));
      });
      if (expIssues.length) {
        sections.push({ label: `${exp.title} at ${exp.company}`, issues: expIssues });
      }
    });
  }

  return sections;
}

export function totalMisspelled(sections: SectionSpelling[]): number {
  return sections.reduce((acc, sec) => acc + (sec.issues?.length || 0), 0);
}
