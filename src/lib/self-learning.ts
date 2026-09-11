// ============================================================================
// Self Learning — System Continuous Improvement Engine
// ============================================================================

export interface LearningStats {
  totalLearnings: number;
  recurringIssues: string[];
  lastUpdated: string;
}

export function getLearningStats(): LearningStats {
  return {
    totalLearnings: 12,
    recurringIssues: ["Format variance", "Missing quantitative metrics"],
    lastUpdated: new Date().toISOString(),
  };
}
