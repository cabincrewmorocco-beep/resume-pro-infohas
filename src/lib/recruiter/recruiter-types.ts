// ============================================================================
// Recruiter Intelligence Domain Types
// ============================================================================

export type CompetencyKey =
  | "leadership"
  | "technical_depth"
  | "communication"
  | "problem_solving"
  | "cultural_add"
  | "business_impact"
  | string;

export interface RecruiterCompetency {
  key: CompetencyKey;
  name: string;
  score: number; // 0-100
  evidence: string[];
  growthAreas: string[];
}

export interface CompetencyAnalytics {
  overallScore: number;
  competencies: RecruiterCompetency[];
  strongestAreas: string[];
  riskFactors: string[];
}

export interface BehavioralIntelligence {
  leadershipStyle?: string;
  workStyle?: string;
  adaptabilityScore: number;
  collaborationIndex: number;
  observations: string[];
}

export interface BenchmarkResult {
  industry: string;
  role: string;
  percentile: number;
  marketRateComparison?: string;
  topSkillsComparison: { skill: string; candidateHas: boolean; marketDemand: number }[];
}

export interface ExplainabilityNode {
  id: string;
  kind: "recommendation" | "competency" | "answer" | "resume" | "ats" | "company" | "decision" | "flight" | "evidence" | string;
  label: string;
  factor?: string;
  weight?: number;
  score?: number;
  details?: string;
  summary?: string;
  expandable?: boolean;
  children: ExplainabilityNode[];
}

export interface HiringRecommendation {
  verdict: "strong_hire" | "hire" | "lean_hire" | "lean_no_hire" | "no_hire";
  confidence: number;
  executiveSummary: string;
  rationale: string[];
  keyRisks: string[];
}

export interface CandidateIntelligence {
  candidateName: string;
  targetRole: string;
  matchScore: number;
  seniorityEstimate: string;
  competencies: CompetencyAnalytics;
  behavioral: BehavioralIntelligence;
  recommendation: HiringRecommendation;
  benchmark?: BenchmarkResult;
}

export interface DecisionAnalytics {
  hiringProbability: number;
  interviewPassProbability: number;
  retentionPredictionMonths: number;
  keyDrivers: string[];
}

export interface ExecutiveReport {
  generatedAt: string;
  candidateName?: string;
  targetRole?: string;
  score?: number;
  summary?: string;
  executiveSummary: string;
  candidateSummary: string;
  interviewOverview: string;
  resumeSummary: string;
  atsSummary: string;
  competencies: Array<{ label: string; score: number; confidence: number; risk?: boolean; improvement?: string }>;
  behaviorAnalysis: Array<{ label: string; score: number }>;
  leadership: string;
  communication: string;
  safety: string;
  strengths: string[];
  weaknesses: string[];
  riskAssessment: string;
  hiringRecommendation: string;
  followUpQuestions: string[];
  trainingPlan: string[];
  developmentAreas: string[];
  actionPlan?: string[];
}

export interface InterviewIntelligenceInput {
  resumeId: string;
  jobDescriptionId?: string;
  transcripts?: string[];
  notes?: string;
}
