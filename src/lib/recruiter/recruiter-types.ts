// ============================================================================
// Recruiter Intelligence Domain Types
// ============================================================================

import type { CompetencyKey } from "@/lib/interview/adaptive";
import type { FlightRecord, FlightDecision } from "@/lib/ai/flight-recorder";
import type { ResumeData } from "@/lib/types";

export type { CompetencyKey };

export interface RecruiterCompetency {
  key: CompetencyKey;
  label: string;
  name?: string;
  score: number; // 0-100
  confidence: number;
  trend?: "up" | "down" | "flat" | "unknown";
  evidence: string[];
  supportingAnswers?: string[];
  weakEvidence?: string[];
  strongEvidence?: string[];
  growthAreas?: string[];
  improvementSuggestions: string[];
  riskIndicator?: boolean;
  benchmark?: number;
  historicalProgress: number[];
}

export type BehaviorKey =
  | "leadership"
  | "communication"
  | "customerService"
  | "safety"
  | "professionalism"
  | "stressManagement"
  | "adaptability"
  | "decisionMaking"
  | "conflictResolution"
  | "ownership"
  | "criticalThinking"
  | "starUsage"
  | "resilience"
  | "emotionalIntelligence"
  | "listening"
  | "teamwork";

export interface BehaviorDimension {
  key: BehaviorKey;
  label: string;
  score: number;
  evidence: string[];
  derivedFrom: CompetencyKey[];
}

export interface BehavioralIntelligence {
  behaviors: Record<BehaviorKey, BehaviorDimension>;
  overall: number;
  leadershipStyle?: string;
  workStyle?: string;
  adaptabilityScore?: number;
  collaborationIndex?: number;
  observations?: string[];
}

export interface CompanyMatchIntel {
  company: string;
  cultureMatch: number;
  valuesMatch: number;
  safetyMatch: number;
  leadershipMatch: number;
  luxuryServiceMatch: number;
  customerExperienceMatch: number;
  brandRepresentation: number;
  professionalStandards: number;
  overallCompanyReadiness: number;
  evidence: string[];
  reasoning: string;
}

export interface ResumeSummary {
  present: boolean;
  overallScore?: number;
  recruiterScore?: number;
  jobMatchPercent?: number;
  industryReadiness?: number;
  topStrengths: string[];
  topWeaknesses: string[];
  missingSkills: string[];
}

export interface ATSSummary {
  present: boolean;
  atsScore?: number;
  jdMatchPercent?: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  weakSections: string[];
}

export interface DecisionSummary {
  present: boolean;
  status?: string;
  reason?: string;
  confidence?: number;
  evidence?: string | string[];
}

export interface ReflectionSummary {
  present: boolean;
  outcome?: string;
  score?: number;
  confidence?: number;
  summary?: string;
  retryRecommended?: boolean;
}

export interface QASummary {
  present: boolean;
  outcome?: string;
  score?: number;
  confidence?: number;
  failRecommended?: boolean;
}

export interface ValidationSummary {
  present: boolean;
  outcome?: string;
  score?: number;
  failRecommended?: boolean;
  criticalFailures?: number | string[];
}

export interface FlightMetadataSummary {
  present: boolean;
  executionId?: string;
  provider?: string;
  model?: string;
  durationMs?: number;
  latencyMs?: number;
  tokenUsage?: any;
  questionCount?: number;
  completionRate?: number;
}

export interface InterviewSummary {
  present: boolean;
  overallScore?: number;
  questionCount?: number;
  difficultyProgression?: number[];
  strengths: CompetencyKey[];
  weaknesses: CompetencyKey[];
  missingCompetencies: CompetencyKey[];
  recommendedNextSteps: string[];
}

export interface CandidateProfile {
  name?: string;
  role?: string;
  company?: string;
  targetCompany?: string;
  resumeId?: string;
  jdId?: string;
}

export type HiringRecommendation =
  | "strong_hire"
  | "hire"
  | "lean_hire"
  | "lean_no_hire"
  | "hold"
  | "reject"
  | {
      verdict: "strong_hire" | "hire" | "lean_hire" | "lean_no_hire" | "no_hire";
      confidence: number;
      executiveSummary: string;
      rationale: string[];
      keyRisks: string[];
    };

export interface CandidateIntelligence {
  candidate: CandidateProfile;
  interview: InterviewSummary;
  competencySummary: Record<CompetencyKey, RecruiterCompetency>;
  behavior: BehavioralIntelligence;
  resume: ResumeSummary;
  ats: ATSSummary;
  companyMatch: CompanyMatchIntel | null;
  scenario?: string;
  persona?: any;
  position?: string;
  decision: DecisionSummary;
  reflection: ReflectionSummary;
  qa: QASummary;
  validation: ValidationSummary;
  flight: FlightMetadataSummary;
  overall: number;
  employerPassLikelihood: number;
  followUpQuestions: string[];
  generatedAt: string;

  // Compatibility aliases
  candidateName?: string;
  targetRole?: string;
  matchScore?: number;
  seniorityEstimate?: string;
  competencies?: CompetencyAnalytics;
  behavioral?: BehavioralIntelligence;
  recommendation?: any;
  benchmark?: BenchmarkResult;
}

export interface RecruiterDashboard {
  candidate: CandidateProfile;
  candidateOverview: string;
  hiringRecommendation: HiringRecommendation;
  hiringConfidence: number;
  interviewScore: number;
  resumeScore: number;
  atsMatch: number;
  companyMatch: number;
  overallRisk: number;
  potential: number;
  recruiterConfidence: number;
  completionRate: number;
  durationMs: number;
  targetCompany?: string;
  scenario?: string;
  persona?: any;
  position?: string;
}

export interface CompetencyAnalytics {
  competencies: Record<CompetencyKey, RecruiterCompetency>;
  order: CompetencyKey[];
  scoreDistribution: number[];
  radar: Array<{ label: string; score: number; benchmark?: number }>;
  heatmap: Array<{ key: CompetencyKey; label: string; score: number; risk?: boolean }>;
  strongest: CompetencyKey[];
  weakest: CompetencyKey[];
  missing: CompetencyKey[];
  overallScore?: number;
  strongestAreas?: string[];
  riskFactors?: string[];
}

export interface DecisionAnalytics {
  present: boolean;
  status?: string;
  confidence?: number;
  reason?: string;
  evidence?: string | string[];
  trace: any[];
  rules: any[];
  supportingReflection?: any;
  supportingQA?: any;
  supportingValidation?: any;
  supportingCompetencies: CompetencyKey[];
  supportingATS?: string;
  supportingResume?: string;
  supportingCompanyIntelligence?: string;
  hiringProbability?: number;
  interviewPassProbability?: number;
  retentionPredictionMonths?: number;
  keyDrivers?: string[];
}

export type BenchmarkGroupBy = "company" | "scenario" | "role" | "department" | "experience";

export interface BenchmarkEntry {
  candidateId: string;
  label: string;
  interviewScore: number;
  resumeScore: number;
  atsMatch: number;
  companyMatch: number;
  leadership: number;
  communication: number;
  safety: number;
  professionalism: number;
  customerService: number;
  adaptability: number;
  group: string;
}

export interface BenchmarkResult {
  industry?: string;
  role?: string;
  percentile?: number;
  marketRateComparison?: string;
  topSkillsComparison?: { skill: string; candidateHas: boolean; marketDemand: number }[];
  entries?: BenchmarkEntry[];
  ranking?: BenchmarkEntry[];
  percentiles?: Record<string, number>;
  cohortAverage?: {
    interviewScore: number;
    resumeScore: number;
    atsMatch: number;
    companyMatch: number;
  };
  groupBy?: BenchmarkGroupBy;
  trend?: any[];
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

export interface ExecutiveReport {
  generatedAt: string;
  candidate?: CandidateProfile;
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
  hiringRecommendation: HiringRecommendation;
  followUpQuestions: string[];
  trainingPlan: string[];
  developmentAreas: string[];
  actionPlan?: string[];
}

export interface InterviewIntelligenceInput {
  resumeId?: string;
  jobDescriptionId?: string;
  jd?: any;
  transcripts?: string[];
  notes?: string;
  records?: FlightRecord[];
  memory?: any;
  package?: any;
  resume?: ResumeData;
  reviewReport?: any;
  atsReport?: any;
  companyProfile?: any;
  scenario?: string;
  persona?: any;
  position?: string;
}
