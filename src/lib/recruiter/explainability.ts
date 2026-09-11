// ============================================================================
// Recruiter Intelligence — Explainability Tree Engine
// ============================================================================

import type { CandidateIntelligence, ExplainabilityNode } from "./recruiter-types";

export function buildExplainability(ci: CandidateIntelligence): ExplainabilityNode {
  return {
    id: "root",
    kind: "recommendation",
    label: `Overall Recommendation: ${ci.recommendation?.verdict || "Assessment Complete"}`,
    score: ci.matchScore || 85,
    summary: ci.recommendation?.executiveSummary || "AI analysis based on resume and competencies.",
    expandable: true,
    children: [
      {
        id: "comp_root",
        kind: "competency",
        label: "Core Competencies",
        score: ci.competencies?.overallScore || 80,
        expandable: true,
        children: (ci.competencies?.competencies || []).map((c, i) => ({
          id: `comp_${i}`,
          kind: "evidence",
          label: c.name,
          score: c.score,
          summary: c.evidence?.join("; ") || "",
          expandable: false,
          children: [],
        })),
      },
      {
        id: "behavioral_root",
        kind: "decision",
        label: "Behavioral & Culture Fit",
        score: ci.behavioral?.adaptabilityScore || 85,
        summary: ci.behavioral?.observations?.join("; ") || "",
        expandable: false,
        children: [],
      },
    ],
  };
}
