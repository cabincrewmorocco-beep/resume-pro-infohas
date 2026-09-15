// ============================================================================
// Directive Profiles — Pre-built Optimization Directive Configurations
//
// Each profile is a partial OptimizerDirectiveConfig that can be applied to
// quickly configure the optimizer for specific use cases.
//
// Users can save/load profiles from the UI. New profiles can be added
// without code changes by storing them in D1 as JSON.
// ============================================================================

"use client";

import type { OptimizerDirectiveConfig, AgentDirectives } from "./types";

/**
 * A named directive profile with metadata.
 */
export interface DirectiveProfile {
  id: string;
  name: string;
  description: string;
  /** Tags for filtering/searching in the UI */
  tags: string[];
  /** Partial config overrides — any field not specified keeps its current value */
  overrides: Partial<OptimizerDirectiveConfig>;
}

// ============================================================================
// BUILT-IN PROFILES
// ============================================================================

/**
 * ATS Conservative — Safe, minimal changes, preserves original structure.
 */
const ATS_CONSERVATIVE: DirectiveProfile = {
  id: "ats-conservative",
  name: "ATS Conservative",
  description: "Safe optimization that preserves original resume structure. Minimal keyword injection, conservative ATS changes.",
  tags: ["ats", "safe", "conservative"],
  overrides: {
    selectedProfileId: "ats-conservative",
    agentDirectives: {
      supervisor: { strictMode: true, enableRetries: true, enableProviderSwitch: false, enforceImmutableEntities: true, enableDebugLogs: false, enableDiffViewer: false },
      summary: { atsAggressiveness: 25, preserveFacts: true, maxCharacters: 800, minCharacters: 300 },
      skills: { maxKeywords: 15, allowTransferableSkills: false, allowCompanyKeywords: false, allowLocationKeywords: false },
      experience: { rewriteBulletsOnly: true, rewriteTitle: false, rewriteCompany: false, rewriteDates: false, rewriteLocation: false, maxExpansionPercent: 20 },
      education: { formatOnly: true, stripSectionHeaders: true },
      languages: { formatOnly: true },
      guardian: { enforceEntityIntegrity: true, enforcePageUtilization: true, enforceContentLength: true, enforceNoDuplicates: true, enforceSummaryQuality: true, minimumScore: 80 },
      additionalInfo: { preserveSection: true, improveWording: true, stripSectionHeaders: true },
    },
  },
};

/**
 * ATS Aggressive — Maximum ATS optimization.
 */
const ATS_AGGRESSIVE: DirectiveProfile = {
  id: "ats-aggressive",
  name: "ATS Aggressive",
  description: "Maximum ATS optimization. Aggressive keyword injection, restructured bullets for maximum ATS match.",
  tags: ["ats", "aggressive", "keywords"],
  overrides: {
    selectedProfileId: "ats-aggressive",
    agentDirectives: {
      supervisor: { strictMode: false, enableRetries: true, enableProviderSwitch: true, enforceImmutableEntities: true, enableDebugLogs: false, enableDiffViewer: true },
      summary: { atsAggressiveness: 85, preserveFacts: true, maxCharacters: 1200, minCharacters: 500 },
      skills: { maxKeywords: 30, allowTransferableSkills: true, allowCompanyKeywords: false, allowLocationKeywords: false },
      experience: { rewriteBulletsOnly: true, rewriteTitle: false, rewriteCompany: false, rewriteDates: false, rewriteLocation: false, maxExpansionPercent: 40 },
      education: { formatOnly: true, stripSectionHeaders: true },
      languages: { formatOnly: true },
      guardian: { enforceEntityIntegrity: true, enforcePageUtilization: true, enforceContentLength: true, enforceNoDuplicates: true, enforceSummaryQuality: true, minimumScore: 80 },
      additionalInfo: { preserveSection: true, improveWording: true, stripSectionHeaders: true },
    },
  },
};

/**
 * Executive / High-End — Leadership-focused optimization.
 */
const EXECUTIVE_HIGH_END: DirectiveProfile = {
  id: "executive",
  name: "Executive / High-End",
  description: "Leadership-focused optimization with narrative summaries and executive impact metrics.",
  tags: ["executive", "narrative", "leadership"],
  overrides: {
    selectedProfileId: "executive",
    agentDirectives: {
      supervisor: { strictMode: true, enableRetries: true, enableProviderSwitch: true, enforceImmutableEntities: true, enableDebugLogs: false, enableDiffViewer: true },
      summary: { atsAggressiveness: 65, preserveFacts: true, maxCharacters: 1200, minCharacters: 600 },
      skills: { maxKeywords: 25, allowTransferableSkills: true, allowCompanyKeywords: false, allowLocationKeywords: false },
      experience: { rewriteBulletsOnly: true, rewriteTitle: false, rewriteCompany: false, rewriteDates: false, rewriteLocation: false, maxExpansionPercent: 35 },
      education: { formatOnly: true, stripSectionHeaders: true },
      languages: { formatOnly: true },
      guardian: { enforceEntityIntegrity: true, enforcePageUtilization: true, enforceContentLength: true, enforceNoDuplicates: true, enforceSummaryQuality: true, minimumScore: 80 },
      additionalInfo: { preserveSection: true, improveWording: true, stripSectionHeaders: true },
    },
  },
};

/**
 * Tech / Engineering — Technical optimization prioritizing hard skills.
 */
const TECH_ENGINEERING: DirectiveProfile = {
  id: "tech",
  name: "Tech / Engineering",
  description: "Technical optimization prioritizing hard skills, tech stack categorization, and project architecture.",
  tags: ["tech", "technical", "skills-first"],
  overrides: {
    selectedProfileId: "tech",
    agentDirectives: {
      supervisor: { strictMode: true, enableRetries: true, enableProviderSwitch: false, enforceImmutableEntities: true, enableDebugLogs: false, enableDiffViewer: false },
      summary: { atsAggressiveness: 70, preserveFacts: true, maxCharacters: 900, minCharacters: 400 },
      skills: { maxKeywords: 25, allowTransferableSkills: true, allowCompanyKeywords: false, allowLocationKeywords: false },
      experience: { rewriteBulletsOnly: true, rewriteTitle: false, rewriteCompany: false, rewriteDates: false, rewriteLocation: false, maxExpansionPercent: 30 },
      education: { formatOnly: true, stripSectionHeaders: true },
      languages: { formatOnly: true },
      guardian: { enforceEntityIntegrity: true, enforcePageUtilization: true, enforceContentLength: true, enforceNoDuplicates: true, enforceSummaryQuality: true, minimumScore: 80 },
      additionalInfo: { preserveSection: true, improveWording: true, stripSectionHeaders: true },
    },
  },
};

/**
 * Aviation / Hospitality — InfoHAS signature format.
 */
const AVIATION_HOSPITALITY: DirectiveProfile = {
  id: "aviation-hospitality",
  name: "Aviation / Hospitality",
  description: "InfoHAS signature format for aviation, cabin crew, and hospitality professionals.",
  tags: ["aviation", "hospitality", "service"],
  overrides: {
    selectedProfileId: "aviation-hospitality",
    agentDirectives: {
      supervisor: { strictMode: true, enableRetries: true, enableProviderSwitch: false, enforceImmutableEntities: true, enableDebugLogs: false, enableDiffViewer: false },
      summary: { atsAggressiveness: 60, preserveFacts: true, maxCharacters: 1000, minCharacters: 450 },
      skills: { maxKeywords: 25, allowTransferableSkills: true, allowCompanyKeywords: false, allowLocationKeywords: false },
      experience: { rewriteBulletsOnly: true, rewriteTitle: false, rewriteCompany: false, rewriteDates: false, rewriteLocation: false, maxExpansionPercent: 30 },
      education: { formatOnly: true, stripSectionHeaders: true },
      languages: { formatOnly: true },
      guardian: { enforceEntityIntegrity: true, enforcePageUtilization: true, enforceContentLength: true, enforceNoDuplicates: true, enforceSummaryQuality: true, minimumScore: 80 },
      additionalInfo: { preserveSection: true, improveWording: true, stripSectionHeaders: true },
    },
  },
};

// ============================================================================
// PROFILE REGISTRY
// ============================================================================

/**
 * All built-in profiles, keyed by ID.
 */
export const BUILT_IN_PROFILES: Record<string, DirectiveProfile> = {
  "ats-conservative": ATS_CONSERVATIVE,
  "ats-aggressive": ATS_AGGRESSIVE,
  "executive": EXECUTIVE_HIGH_END,
  "tech": TECH_ENGINEERING,
  "aviation-hospitality": AVIATION_HOSPITALITY,
};

/**
 * Get all available profiles — built-ins merged with user-saved custom
 * profiles (Task 15). A custom profile whose id EQUALS a built-in id shadows
 * it ("edit the built-in in place"); a custom profile with a new id is an
 * additional profile.
 */
export function getAllProfiles(): DirectiveProfile[] {
  const merged: Record<string, DirectiveProfile> = { ...BUILT_IN_PROFILES, ...customProfiles };
  return Object.values(merged);
}

/** Get a profile by ID — custom (incl. built-in overrides) first. */
export function getProfile(id: string): DirectiveProfile | undefined {
  if (id === "cabin-crew") return customProfiles["aviation-hospitality"] ?? BUILT_IN_PROFILES["aviation-hospitality"];
  return customProfiles[id] ?? BUILT_IN_PROFILES[id];
}

/** True when id refers to a SHIPPED built-in (even if currently shadowed). */
export function isBuiltInProfile(id: string): boolean {
  return id === "cabin-crew" || Object.prototype.hasOwnProperty.call(BUILT_IN_PROFILES, id);
}

// ============================================================================
// CUSTOM PROFILE REGISTRY (Task 15 — Directive Profile Editor)
//
// User-saved profiles are persisted to D1 (branding admin-settings blob) and
// hydrated here by the store (admin-slice / syncAllFromCloud).
// ============================================================================

let customProfiles: Record<string, DirectiveProfile> = {};

/** Replace the in-memory custom registry (called on store hydration + save). */
export function registerCustomProfiles(list: DirectiveProfile[] | undefined | null): void {
  customProfiles = {};
  if (!Array.isArray(list)) return;
  for (const p of list) {
    if (p && p.id && p.name) {
      customProfiles[p.id] = p;
    }
  }
}

/**
 * Apply a profile's overrides to an existing directive config.
 * Returns a new config object with the profile's overrides merged in.
 */
export function applyProfileToConfig(
  baseConfig: OptimizerDirectiveConfig,
  profile: DirectiveProfile,
): OptimizerDirectiveConfig {
  const result = { ...baseConfig };

  // Deep-merge agentDirectives if both exist
  if (profile.overrides.agentDirectives && baseConfig.agentDirectives) {
    result.agentDirectives = deepMergeAgentDirectives(baseConfig.agentDirectives, profile.overrides.agentDirectives);
  } else if (profile.overrides.agentDirectives) {
    result.agentDirectives = profile.overrides.agentDirectives;
  }

  // Spread other scalar overrides
  for (const [key, value] of Object.entries(profile.overrides)) {
    if (key !== "agentDirectives" && value !== undefined) {
      (result as any)[key] = value;
    }
  }

  return result;
}

/**
 * Deep-merge agent directives (profile overrides take precedence).
 */
function deepMergeAgentDirectives(base: AgentDirectives, override: Partial<AgentDirectives>): AgentDirectives {
  return {
    ...base,
    ...override,
    supervisor: { ...base.supervisor, ...(override.supervisor || {}) },
    summary: { ...base.summary, ...(override.summary || {}) },
    skills: { ...base.skills, ...(override.skills || {}) },
    experience: { ...base.experience, ...(override.experience || {}) },
    education: { ...base.education, ...(override.education || {}) },
    languages: { ...base.languages, ...(override.languages || {}) },
    guardian: { ...base.guardian, ...(override.guardian || {}) },
    additionalInfo: { ...base.additionalInfo, ...(override.additionalInfo || {}) },
  };
}
