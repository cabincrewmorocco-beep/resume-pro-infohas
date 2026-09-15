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

export interface CloudSyncState {
  status: "idle" | "syncing" | "saved" | "error";
  lastSavedAt: number | null;
  resumeId: string | null;
  message?: string;
  error?: string | null;
}

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
  language?: string;
  name?: string;
  proficiency?: string;
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
  normalizedTitle?: string;
  type?: string;
  items?: any[];
  content?: string;
  bullets?: string[];
  [key: string]: unknown;
}

export interface ResumeLayoutModel {
  template?: string;
  font?: string;
  fontFamily?: string;
  fontSize?: number;
  bodyFontSizePt?: number;
  headingFontSizePt?: number;
  sectionTitleSizePt?: number;
  nameSizePt?: number;
  nameColor?: string;
  sectionTitleColor?: string;
  bodyTextColor?: string;
  contactColor?: string;
  margins?: { top?: number; bottom?: number; left?: number; right?: number };
  marginLeftMm?: number;
  marginRightMm?: number;
  marginTopMm?: number;
  marginBottomMm?: number;
  lineSpacing?: number;
  lineHeightMm?: number;
  sectionSpacing?: number;
  sectionGapMm?: number;
  headerGapMm?: number;
  columnGapMm?: number;
  columns?: number;
  primaryColor?: string;
  accentColor?: string;
  alignment?: TextAlignment;
  bodyAlignment?: TextAlignment;
  sectionAlignment?: Record<string, TextAlignment>;
  compact?: boolean;
  photoWidthMm?: number;
  photoHeightMm?: number;
  photoSizeMm?: number;
  photoBorderRadius?: number;
  bulletIndentMm?: number;
  contactSpacing?: string;
  [key: string]: unknown;
}

export function resolveSectionAlignment(layout: any, sectionType: string): TextAlignment {
  return (layout?.sectionAlignment?.[sectionType] || layout?.alignment || "left") as TextAlignment;
}

export interface ResumeData {
  id: string;
  title?: string;
  name?: string;
  headline?: string;
  targetRole?: string;
  targetRegion?: ResumeRegion;
  photoUrl?: string;
  dateOfBirth?: string;
  contact?: ContactInfo;
  summary?: string;
  experience: ResumeExperience[];
  education: ResumeEducation[];
  skills: ResumeSkill[];
  languages: ResumeLanguage[];
  certifications?: ResumeCertification[];
  projects?: ResumeProject[];
  achievements?: any[];
  additionalInfo?: string;
  accentColor?: string;
  dynamicSections?: DynamicSection[];
  layout?: ResumeLayoutModel;
  template?: ResumeTemplate;
  templateId?: string;
  atsScore?: number;
  source?: string;
  parentResumeId?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface JobDescription {
  id: string;
  title: string;
  company?: string;
  location?: string;
  url?: string;
  rawText?: string;
  content?: string;
  keywords?: string[];
  requirements?: string[];
  requiredSkills?: string[];
  preferredSkills?: string[];
  responsibilities?: string[];
  technologies?: string[];
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

export interface ATSScoreBreakdown {
  ats?: number;
  formatting?: number;
  keywords?: number;
  content?: number;
  grammar?: number;
  completeness?: number;
  [key: string]: unknown;
}

export interface ATSRecommendation {
  id?: string;
  type?: string;
  category?: string;
  title?: string;
  message?: string;
  severity?: "low" | "medium" | "high" | "critical" | string;
  action?: string;
  [key: string]: unknown;
}

export interface ATSReport {
  id: string;
  resumeId: string;
  jdId?: string;
  overallScore?: number;
  score?: number;
  scores?: ATSScoreBreakdown;
  recommendations?: ATSRecommendation[] | string[];
  missingKeywords?: string[];
  matchedKeywords?: string[];
  weakSections?: string[];
  jdMatchPercent?: number;
  detectedCliches?: string[];
  matchRate?: number;
  hardSkillsScore?: number;
  softSkillsScore?: number;
  formatScore?: number;
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
  contentText?: string;
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
  title?: string;
  name?: string;
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
  alternateApiKeys?: string[];
  headersJson?: string;
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
  timestamp?: string;
  createdAt?: string;
  model?: string;
  tokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  success?: boolean;
  status?: string;
  error?: string;
  promptPreview?: string;
  cost?: number;
  [key: string]: unknown;
}

export interface AIProviderSettings {
  defaultProviderId?: string | null;
  fallbackEnabled?: boolean;
  fallbackProviderIds?: string[];
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
  chain?: FallbackChainEntry[] | any[];
  entries?: any[];
  autoHeal?: boolean;
  [key: string]: unknown;
}

export interface PromptTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  prompt?: string;
  content?: string;
  systemPrompt?: string;
  version?: any;
  isActive?: boolean;
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

export interface AgentSupervisorDirectives {
  strictMode?: boolean;
  enableRetries?: boolean;
  enableProviderSwitch?: boolean;
  enforceImmutableEntities?: boolean;
  enableDebugLogs?: boolean;
  enableDiffViewer?: boolean;
  temperature?: number;
  [key: string]: unknown;
}

export interface AgentSummaryDirectives {
  atsAggressiveness?: number;
  preserveFacts?: boolean;
  maxCharacters?: number;
  minCharacters?: number;
  [key: string]: unknown;
}

export interface AgentSkillsDirectives {
  maxKeywords?: number;
  allowTransferableSkills?: boolean;
  allowCompanyKeywords?: boolean;
  allowLocationKeywords?: boolean;
  [key: string]: unknown;
}

export interface AgentExperienceDirectives {
  rewriteBulletsOnly?: boolean;
  rewriteTitle?: boolean;
  rewriteCompany?: boolean;
  rewriteDates?: boolean;
  rewriteLocation?: boolean;
  maxExpansionPercent?: number;
  [key: string]: unknown;
}

export interface AgentEducationDirectives {
  formatOnly?: boolean;
  stripSectionHeaders?: boolean;
  [key: string]: unknown;
}

export interface AgentLanguagesDirectives {
  formatOnly?: boolean;
  [key: string]: unknown;
}

export interface AgentGuardianDirectives {
  enforceEntityIntegrity?: boolean;
  enforcePageUtilization?: boolean;
  enforceContentLength?: boolean;
  enforceNoDuplicates?: boolean;
  enforceSummaryQuality?: boolean;
  minimumScore?: number;
  [key: string]: unknown;
}

export interface AgentAdditionalInfoDirectives {
  preserveSection?: boolean;
  improveWording?: boolean;
  stripSectionHeaders?: boolean;
  [key: string]: unknown;
}

export interface AgentHeadlineDirectives {
  rewriteHeadline?: boolean;
  maxHeadlineChars?: number;
  headlineTone?: "exact-title-match" | "seniority-adjusted" | "jd-aligned" | "preserve";
  [key: string]: unknown;
}

export interface AgentCertificationsDirectives {
  formatOnly?: boolean;
  stripExpiredCerts?: boolean;
  maxCertAgeYears?: number;
  maxCertEntries?: number;
  [key: string]: unknown;
}

export interface AgentDirectives {
  supervisor?: AgentSupervisorDirectives;
  summary?: AgentSummaryDirectives;
  skills?: AgentSkillsDirectives;
  experience?: AgentExperienceDirectives;
  education?: AgentEducationDirectives;
  languages?: AgentLanguagesDirectives;
  guardian?: AgentGuardianDirectives;
  additionalInfo?: AgentAdditionalInfoDirectives;
  headline?: AgentHeadlineDirectives;
  certifications?: AgentCertificationsDirectives;
  [key: string]: unknown;
}

export interface ToneWritingConfig {
  tone?: string;
  actionVerbStrength?: string;
  bulletVerbTense?: string;
  avoidPassiveVoice?: boolean;
  enforcePowerVerbs?: boolean;
  avoidFillerPhrases?: boolean;
  requireQuantification?: boolean;
  experienceFormula?: "auto" | "star" | "xyz";
  brevity?: string;
  [key: string]: unknown;
}

export interface CustomKeywordsConfig {
  include?: string[];
  exclude?: string[];
  requiredKeywords?: string[];
  forbiddenKeywords?: string[];
  keywordPlacement?: string;
  [key: string]: unknown;
}

export interface OptimizerDirectiveConfig {
  selectedStructuralBlueprintId?: string;
  pageSize?: string;
  marginTopMm?: number;
  marginBottomMm?: number;
  marginLeftMm?: number;
  marginRightMm?: number;
  fontFamily?: string;
  bodyFontSizePt?: number;
  headingFontSizePt?: number;
  sectionTitleSizePt?: number;
  nameSizePt?: number;
  nameColor?: string;
  sectionTitleColor?: string;
  bodyTextColor?: string;
  lineHeight?: number;
  lineSpacing?: number;
  sectionSpacing?: number;
  sectionGapMm?: number;
  bulletIndentMm?: number;
  photoEnabled?: boolean;
  photoWidthMm?: number;
  photoHeightMm?: number;
  showPlaceholderIfNoPhoto?: boolean;
  summaryMinWords?: number;
  summaryMaxWords?: number;
  skillsMaxGroups?: number;
  experienceMaxEntries?: number;
  experienceBulletsPerEntry?: number;
  educationMaxEntries?: number;
  languagesMaxEntries?: number;
  enforceOnePage?: boolean;
  minFontSizePt?: number;
  targetCharCount?: number;
  sectionLimits?: Record<string, { min: number; max: number }>;
  customDirectiveOverride?: string;
  agentDirectives?: AgentDirectives;
  bodyAlignment?: string;
  sectionAlignment?: Record<string, any>;
  targetAtsSystem?: string;
  toneConfig?: ToneWritingConfig;
  customKeywords?: CustomKeywordsConfig;
  sectionOrder?: string[];
  dateFormat?: "auto" | "month-year" | "short-date" | "year-only";
  contactSpacing?: "stacked" | "single-line";
  customSectionInstructions?: Record<string, string>;
  [key: string]: unknown;
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

export interface AIBuildResult {
  success: boolean;
  errors: string[];
  warnings?: string[];
  duration?: number;
  output?: string;
  timestamp?: string;
  [key: string]: unknown;
}

export interface AITestResult {
  success: boolean;
  total?: number;
  passed?: number;
  failed?: number;
  skipped?: number;
  duration?: number;
  output?: string;
  failures?: any[];
  timestamp?: string;
  [key: string]: unknown;
}

export interface AIFile {
  path: string;
  type: "file" | "directory" | string;
  language?: string;
  size?: number;
  content?: string;
  [key: string]: unknown;
}

export interface AITask {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "running" | "completed" | "failed" | "ready" | string;
  progress?: number;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface AIWorkspacePatch {
  id: string;
  title?: string;
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
  isStaging?: boolean;
  commitHash?: string;
  lastCommit?: string;
  commitCount?: number;
  createdAt?: string;
  [key: string]: unknown;
}

export interface AIGitCommit {
  hash: string;
  message: string;
  author: string;
  timestamp: string;
  filesChanged?: number | string[];
  [key: string]: unknown;
}

export interface AIRollback {
  id?: string;
  timestamp?: string;
  reason?: string;
  snapshotId?: string;
  patchId?: string;
  patchTitle?: string;
  rolledBackBy?: string;
  previousState?: string;
  [key: string]: unknown;
}

export interface AIDevAgentSettings {
  providerId?: string;
  modelName?: string;
  fallbackProviderId?: string;
  fallbackModel?: string;
  timeout?: number;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  focusDirectories?: string[];
  excludeFilesPattern?: string;
  autoApplyFixes?: boolean;
  testOnCommit?: boolean;
  level?: string;
  [key: string]: unknown;
}

export interface AIDevIssue {
  id: string;
  type: string;
  severity: "low" | "medium" | "high" | "critical" | "warning" | "info" | "error" | string;
  file?: string;
  line?: number | string;
  title: string;
  description: string;
  recommendedFix?: string;
  suggestedFix?: string;
  status: "open" | "closed" | "fixed" | "ignored" | string;
  [key: string]: unknown;
}

export interface AIDevPatch {
  id: string;
  title: string;
  description: string;
  diff: string;
  modifiedFiles?: string[];
  newFiles?: string[];
  deletedFiles?: string[];
  impactAnalysis?: string;
  riskAnalysis?: "low" | "medium" | "high" | string;
  generatedTests?: string;
  status: "draft" | "staging" | "tested" | "approved" | "applied" | "rejected" | string;
  provider?: string;
  model?: string;
  createdAt: string;
  [key: string]: unknown;
}

export interface AIDevFeatureFile {
  path: string;
  content: string;
  type: string;
  [key: string]: unknown;
}

export interface AIDevFeature {
  id: string;
  title: string;
  description: string;
  request: string;
  files: AIDevFeatureFile[];
  status: "draft" | "staging" | "tested" | "approved" | "applied" | "rejected" | string;
  provider?: string;
  model?: string;
  createdAt: string;
  [key: string]: unknown;
}

export interface HealthCheck {
  area: "frontend" | "backend" | "api" | "database" | "security" | "performance" | "accessibility" | string;
  score: number;
  status: "healthy" | "degraded" | "down" | string;
  details: string;
  lastChecked: string;
  [key: string]: unknown;
}

export interface AppHealthDashboard {
  overall: number;
  checks: HealthCheck[];
  lastFullScan: string;
  [key: string]: unknown;
}

export interface AIDevAgentHistory {
  id: string;
  timestamp?: string;
  summary?: string;
  type?: string;
  [key: string]: unknown;
}

export interface AIDevReport {
  id: string;
  type?: string;
  title?: string;
  summary?: string;
  score?: number;
  timestamp?: string;
  createdAt?: string;
  findings?: string[];
  issues?: AIDevIssue[];
  provider?: string;
  model?: string;
  createdBy?: string;
  [key: string]: unknown;
}

export interface AIHealingIssue {
  id: string;
  component?: string;
  file?: string;
  line?: number;
  area?: string;
  title?: string;
  severity: "low" | "medium" | "high" | "critical" | "warning" | "info" | "error";
  description: string;
  suggestedFix?: string;
  code?: string;
  status: "detected" | "healing" | "resolved" | "failed" | "open" | "closed" | "fixed" | "needs_review";
  resolvedAt?: string;
  [key: string]: unknown;
}

export interface AIHealingReport {
  id: string;
  timestamp: string;
  issuesCount: number;
  issuesFound?: number;
  resolvedCount: number;
  [key: string]: unknown;
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
export interface RenderDocumentContact {
  name?: string;
  headline?: string;
  email?: string;
  phone?: string;
  location?: string;
  photoUrl?: string;
  dateOfBirth?: string;
  linkedin?: string;
  github?: string;
  website?: string;
  [key: string]: unknown;
}

export interface RenderDocumentSection {
  type: string;
  title: string;
  content?: string;
  items?: any[];
  [key: string]: unknown;
}

export interface RenderDocument {
  id?: string;
  title?: string;
  template?: string;
  contact: RenderDocumentContact;
  layout: ResumeLayoutModel;
  sections: RenderDocumentSection[];
  [key: string]: unknown;
}

export interface RenderContentItem {
  id?: string;
  kind?: "text" | "bullets" | "nested-bullets" | "table-row" | string;
  text?: string;
  fontSizePt?: number;
  bold?: boolean;
  italic?: boolean;
  level?: number;
  bullets?: string[];
  groups?: Array<{ label: string; items: string[] }>;
  cells?: Array<{ text?: string; align?: string; bold?: boolean; [key: string]: unknown }>;
  [key: string]: unknown;
}

export interface RenderNestedBulletList {
  items?: string[];
  groups: Array<{ label: string; items: string[] }>;
  [key: string]: unknown;
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

export interface SectionFingerprint {
  sectionType: string;
  entityCount: number;
  contentCount: number;
  bulletCount: number;
  hash: string;
  [key: string]: unknown;
}

export interface PreservationSnapshot {
  id?: string;
  timestamp?: string;
  createdAt?: string;
  source?: string;
  sectionCount?: number;
  sections: SectionFingerprint[];
  entityIds: {
    experience: string[];
    education: string[];
    skills: string[];
    languages: string[];
    projects: string[];
    certifications: string[];
    dynamicSections: string[];
    [key: string]: unknown;
  };
  immutable: {
    name: string;
    email?: string;
    phone?: string;
    employerNames: string[];
    institutionNames: string[];
    degreeNames: string[];
    languageNames: string[];
    experienceDates: Array<{ id: string; startDate?: string; endDate?: string }>;
    educationDates: Array<{ id: string; startDate?: string; endDate?: string }>;
    certificationNames: string[];
    projectNames: string[];
    [key: string]: unknown;
  };
  optimizable?: {
    summaryLength?: number;
    headlineLength?: number;
    bulletCount?: number;
    highlightCount?: number;
    skillCategoryCount?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}
