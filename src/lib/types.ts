// ResumeAI Pro — Core Canonical Type Definitions

export type Role = "super_admin" | "admin" | "user" | "guest";
export type UserStatus = "approved" | "pending" | "suspended" | "deleted";

export interface User {
  id: string;
  email: string;
  name: string;
  username?: string;
  role: Role;
  status: UserStatus;
  password?: string;
  passwordHash?: string;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
  [key: string]: unknown;
}

export type ResumeRegion = "gulf" | "us" | "uk_eu" | "apac";
export type TextAlignment = "left" | "center" | "right" | "justify";
export type ResumeTemplate = "modern" | "classic" | "minimal" | "executive" | "creative" | "technical" | string;

export interface ContactInfo {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  website?: string;
  github?: string;
  region?: ResumeRegion;
  personalDetails?: Record<string, string>;
  [key: string]: unknown;
}

export interface ResumeExperience {
  id: string;
  title: string;
  company: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  bullets: string[];
  highlights?: string[];
  [key: string]: unknown;
}

export interface ResumeEducation {
  id: string;
  institution: string;
  degree: string;
  field?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  gpa?: string;
  highlights?: string[];
  [key: string]: unknown;
}

export interface ResumeSkill {
  id: string;
  name: string;
  category?: string;
  level?: string;
  [key: string]: unknown;
}

export interface ResumeLanguage {
  id: string;
  language: string;
  fluency?: string;
  [key: string]: unknown;
}

export interface ResumeCertification {
  id: string;
  name: string;
  issuer?: string;
  date?: string;
  url?: string;
  [key: string]: unknown;
}

export interface ResumeProject {
  id: string;
  name: string;
  description?: string;
  role?: string;
  url?: string;
  technologies?: string[];
  bullets?: string[];
  [key: string]: unknown;
}

export interface DynamicSection {
  id: string;
  title: string;
  type?: string;
  items?: any[];
  content?: string;
  [key: string]: unknown;
}

export interface ResumeLayoutModel {
  template?: string;
  font?: string;
  fontSize?: number;
  bodyFontSizePt?: number;
  headingFontSizePt?: number;
  margins?: { top?: number; bottom?: number; left?: number; right?: number };
  lineSpacing?: number;
  sectionSpacing?: number;
  primaryColor?: string;
  accentColor?: string;
  alignment?: TextAlignment;
  sectionAlignment?: Record<string, TextAlignment>;
  compact?: boolean;
  [key: string]: unknown;
}

export function resolveSectionAlignment(layout: any, sectionType: string): TextAlignment {
  return (layout?.sectionAlignment?.[sectionType] || layout?.alignment || "left") as TextAlignment;
}

export interface ResumeData {
  id: string;
  title?: string;
  name?: string;
  targetRole?: string;
  targetRegion?: ResumeRegion;
  photoUrl?: string;
  dateOfBirth?: string;
  contact?: ContactInfo;
  summary?: string;
  experience?: ResumeExperience[];
  education?: ResumeEducation[];
  skills?: ResumeSkill[];
  languages?: ResumeLanguage[];
  certifications?: ResumeCertification[];
  projects?: ResumeProject[];
  dynamicSections?: DynamicSection[];
  layout?: ResumeLayoutModel;
  template?: ResumeTemplate;
  templateId?: string;
  atsScore?: number;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface JobDescription {
  id: string;
  title: string;
  company?: string;
  location?: string;
  rawText?: string;
  content?: string;
  keywords?: string[];
  requirements?: string[];
  analysis?: any;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface CoverLetter {
  id: string;
  title: string;
  resumeId?: string;
  jdId?: string;
  content: string;
  recipient?: string;
  company?: string;
  date?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface ATSReport {
  id: string;
  resumeId: string;
  jdId?: string;
  overallScore: number;
  score?: number;
  matchRate?: number;
  hardSkillsScore?: number;
  softSkillsScore?: number;
  formatScore?: number;
  missingKeywords?: string[];
  matchedKeywords?: string[];
  suggestions?: string[];
  breakdown?: Record<string, number>;
  timestamp?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface ResumeReviewReport {
  id: string;
  resumeId: string;
  score: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  createdAt: string;
  [key: string]: unknown;
}

export interface CareerMaterial {
  id: string;
  type: string;
  title: string;
  content: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface InterviewPackage {
  id: string;
  resumeId?: string;
  jdId?: string;
  roleTitle?: string;
  company?: string;
  questions?: any[];
  scenarios?: any[];
  createdAt?: string;
  [key: string]: unknown;
}

export interface InterviewScenario {
  id: string;
  title: string;
  role?: string;
  industry?: string;
  description?: string;
  questions?: any[];
  [key: string]: unknown;
}

export interface InterviewQuestion {
  id: string;
  question: string;
  category?: string;
  difficulty?: string;
  expectedPoints?: string[];
  sampleAnswer?: string;
  [key: string]: unknown;
}

export interface InterviewSessionRecord {
  id: string;
  packageId?: string;
  scenarioId?: string;
  date: string;
  durationSec: number;
  score: number;
  answers?: any[];
  feedback?: any;
  [key: string]: unknown;
}

export interface InterviewRecordingMeta {
  durationSec: number;
  mimeType: string;
  sizeBytes: number;
  blobUrl?: string;
}

export type AIProviderType = "gemini" | "openai" | "claude" | "puter" | "groq" | "deepseek" | "workers-ai" | "custom" | string;

export interface AIProvider {
  id: string;
  name: string;
  type: string;
  providerCategory?: string;
  supportsServerSide?: boolean;
  supportsClientSide?: boolean;
  supportsStreaming?: boolean;
  supportsFunctionCalling?: boolean;
  supportsJsonMode?: boolean;
  requiresBrowserAuth?: boolean;
  requiresApiKey?: boolean;
  apiUrl?: string;
  baseUrl?: string;
  priority?: number;
  isActive?: boolean;
  isDefault?: boolean;
  isFallback?: boolean;
  isBuiltIn?: boolean;
  allowedForRegularUsers?: boolean;
  timeout?: number;
  maxTokens?: number;
  temperature?: number;
  retryAttempts?: number;
  rateLimitPerMinute?: number;
  modelName?: string;
  enabledModels?: string[];
  streamingEnabled?: boolean;
  authType?: string;
  apiKey?: string;
  costPerInputToken?: number;
  costPerOutputToken?: number;
  status?: string;
  usage?: any;
  health?: any;
  [key: string]: unknown;
}

export interface AIProviderLog {
  id: string;
  providerId: string;
  timestamp: string;
  model?: string;
  tokens?: number;
  latencyMs?: number;
  success: boolean;
  error?: string;
  promptPreview?: string;
  cost?: number;
  [key: string]: unknown;
}

export interface AIProviderSettings {
  defaultProviderId: string;
  fallbackEnabled: boolean;
  autoRotateKeys?: boolean;
  maxRetries?: number;
  timeoutMs?: number;
  [key: string]: unknown;
}

export interface FallbackChainEntry {
  providerId: string;
  priority: number;
  maxRetries?: number;
}

export interface FallbackChainConfig {
  enabled: boolean;
  chain: FallbackChainEntry[] | any[];
  autoHeal?: boolean;
  [key: string]: unknown;
}

export interface PromptTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  prompt: string;
  systemPrompt?: string;
  version?: string;
  isBuiltIn?: boolean;
  variables?: string[];
  [key: string]: unknown;
}

export interface BrandingConfig {
  appName: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  companyName?: string;
  supportEmail?: string;
  copyright?: string;
  [key: string]: unknown;
}

export interface FeatureFlags {
  enableResumeBuilder: boolean;
  enableATSChecker: boolean;
  enableOptimizer: boolean;
  enableCoverLetter: boolean;
  enableInterviewPrep: boolean;
  enableJDScraper: boolean;
  enableAIFailover: boolean;
  enableDonations: boolean;
  enableAds: boolean;
  maintenanceMode: boolean;
  pipeline_websocket_enabled?: boolean;
  enableAIGuardian?: boolean;
  enableSelfHealing?: boolean;
  enableModelArena?: boolean;
  enableZenQuotaGrace?: boolean;
  [key: string]: unknown;
}

export interface OptimizerDirectiveConfig {
  bodyFontSizePt?: number;
  headingFontSizePt?: number;
  lineSpacing?: number;
  sectionSpacing?: number;
  targetCharCount?: number;
  [key: string]: unknown;
}

export interface ToneWritingConfig {
  tone?: string;
  actionVerbStrength?: string;
  brevity?: string;
}

export interface CustomKeywordsConfig {
  include?: string[];
  exclude?: string[];
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  userId?: string;
  details?: any;
  level?: string;
  [key: string]: unknown;
}

export interface AITask {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "running" | "completed" | "failed";
  progress?: number;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface AIWorkspacePatch {
  id: string;
  filePath?: string;
  description?: string;
  diff?: string;
  applied?: boolean;
  createdAt?: string;
  [key: string]: unknown;
}

export interface AIGitBranch {
  name: string;
  isCurrent?: boolean;
  commitHash?: string;
}

export interface AIGitCommit {
  hash: string;
  message: string;
  author: string;
  timestamp: string;
}

export interface AIRollback {
  id: string;
  timestamp: string;
  reason: string;
  snapshotId?: string;
}

export interface AIDevAgentSettings {
  autoApplyFixes?: boolean;
  testOnCommit?: boolean;
  level?: string;
  [key: string]: unknown;
}

export interface AIDevAgentHistory {
  id: string;
  timestamp: string;
  summary: string;
  type?: string;
  [key: string]: unknown;
}

export interface AIDevReport {
  id: string;
  timestamp: string;
  score: number;
  findings: string[];
}

export interface AIHealingIssue {
  id: string;
  component: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  status: "detected" | "healing" | "resolved" | "failed";
  resolvedAt?: string;
}

export interface AIHealingReport {
  id: string;
  timestamp: string;
  issuesCount: number;
  resolvedCount: number;
}

export type ViewKey =
  | "builder"
  | "ats"
  | "optimizer"
  | "cover-letter"
  | "interview"
  | "admin"
  | "landing"
  | "dashboard"
  | "settings"
  | "career-tools"
  | string;

export type ATSSystemTarget = "greenhouse" | "lever" | "workday" | "taleo" | "icims" | "generic" | string;

// RenderDocument types for renderers
export interface RenderDocument {
  id?: string;
  title?: string;
  layout?: ResumeLayoutModel;
  sections: any[];
  [key: string]: unknown;
}

export interface RenderContentItem {
  id?: string;
  text?: string;
  [key: string]: unknown;
}

export interface RenderNestedBulletList {
  items: string[];
}

export interface RenderNode {
  id: string;
  type: string;
  content?: any;
}

export type RenderSectionType = "header" | "summary" | "experience" | "education" | "skills" | "languages" | "certifications" | "projects" | "custom";

export interface PipelineContext {
  id: string;
  resume: ResumeData;
  jd?: JobDescription;
  [key: string]: unknown;
}

export interface PipelineProfile {
  id: string;
  name: string;
  description?: string;
  stages?: string[];
  [key: string]: unknown;
}

export interface AgentConfig {
  id: string;
  name: string;
  providerId?: string;
  model?: string;
  temperature?: number;
  prompt?: string;
  [key: string]: unknown;
}

export interface PromptVersion {
  id: string;
  name: string;
  version: string;
  content: string;
  updatedAt?: string;
}
