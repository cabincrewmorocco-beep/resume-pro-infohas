/**
 * Client service for the Gemini-Powered Context-Aware Interview Simulator
 */

import type { ResumeData, JobDescription } from "@/lib/types";

export interface SimulatorQuestion {
  id: string;
  question: string;
  category: "technical" | "behavioral" | "situational" | "leadership" | "company-fit" | string;
  subType: "star" | "technical" | "behavioral" | "resume-specific" | "jd-specific" | "situational" | string;
  difficulty: "easy" | "medium" | "hard" | string;
  contextRationale: string;
  expectedPoints: string[];
  sampleAnswer: string;
  keywords: string[];
  pitfallsToAvoid?: string;
  suggestedDurationSeconds?: number;
}

export interface SimulatorResponse {
  ok: boolean;
  provider?: string;
  overallMatchPercent?: number;
  keyStrengths?: string[];
  keyGapsToAddress?: string[];
  preparationAdvice?: string;
  questions: SimulatorQuestion[];
  error?: string;
}

export interface EvaluationResult {
  ok: boolean;
  provider?: string;
  score: number;
  clarityScore: number;
  relevanceScore: number;
  starScore: number;
  feedbackSummary: string;
  strengths: string[];
  improvements: string[];
  betterAnswer: string;
  keywordsHit: string[];
  keywordsMissed: string[];
  error?: string;
}

export async function generateContextAwareInterviewQuestions(params: {
  resumeText?: string;
  resumeData?: ResumeData | null;
  jdText?: string;
  jdTitle?: string;
  company?: string;
  difficulty?: "easy" | "medium" | "hard" | "adaptive";
  questionCount?: number;
  interviewType?: "all" | "technical" | "behavioral" | "situational" | "leadership";
}): Promise<SimulatorResponse> {
  const res = await fetch("/api/gemini/interview-simulator", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Interview simulator failed with status ${res.status}`);
  }

  return await res.json();
}

export async function evaluateCandidateAnswer(params: {
  question: string;
  category?: string;
  candidateAnswer: string;
  expectedPoints?: string[];
  jdTitle?: string;
}): Promise<EvaluationResult> {
  const res = await fetch("/api/gemini/interview-evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Answer evaluation failed with status ${res.status}`);
  }

  return await res.json();
}
