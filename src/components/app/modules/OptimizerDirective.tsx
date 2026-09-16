"use client";

import { useState, useRef, useMemo, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge, Icon } from "@/components/shared";
import { useApp } from "@/lib/store";
import { SEED_OPTIMIZER_DIRECTIVE } from "@/lib/mock-data";
import { toast } from "sonner";
import type { OptimizerDirectiveConfig, AgentDirectives, ATSSystemTarget, ToneWritingConfig, CustomKeywordsConfig, TextAlignment, RenderSectionType } from "@/lib/types";
import { BUILT_IN_PROFILES, applyProfileToConfig, isBuiltInProfile, slugifyProfileId } from "@/lib/directive-profiles";
import type { DirectiveProfile } from "@/lib/directive-profiles";
import { STRUCTURAL_BLUEPRINTS, isBuiltInBlueprint } from "@/lib/structural-blueprints";
import type { StructuralBlueprint, ResumeSectionStructure } from "@/lib/structural-blueprints";
import { DirectiveManager } from "./DirectiveManager";

// Canonical resume sections available for per-section text-alignment overrides.
const ALIGNMENT_SECTIONS: Array<{ key: RenderSectionType; label: string }> = [
  { key: "professionalProfile", label: "Summary" },
  { key: "professionalExperience", label: "Experience" },
  { key: "education", label: "Education" },
  { key: "skills", label: "Skills" },
  { key: "languages", label: "Languages" },
  { key: "projects", label: "Projects" },
  { key: "certifications", label: "Certifications" },
  { key: "dynamicSections", label: "Dynamic sections" },
  { key: "additionalInformation", label: "Additional info" },
];

// Canonical section ids a StructuralBlueprint section row can target.
const BLUEPRINT_SECTION_IDS: Array<{ id: ResumeSectionStructure["id"]; label: string }> = [
  { id: "contact", label: "Contact Information" },
  { id: "headline", label: "Professional Headline" },
  { id: "summary", label: "Summary" },
  { id: "experience", label: "Experience" },
  { id: "education", label: "Education" },
  { id: "skills", label: "Skills" },
  { id: "languages", label: "Languages" },
  { id: "additional", label: "Additional Information" },
];

function cloneBlueprint(bp: StructuralBlueprint): StructuralBlueprint {
  return JSON.parse(JSON.stringify(bp)) as StructuralBlueprint;
}

// ============================================================================
// Profile Parameter Editor — generic config field rendering helpers
// ============================================================================

const humanizeParam = (key: string) =>
  key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).replace(/\bAts\b/g, "ATS");

/** Immutably set a nested value inside a config object at the given key path. */
function patchAt(obj: any, path: string[], value: any): any {
  if (path.length === 0) return value;
  const [head, ...rest] = path;
  return { ...obj, [head]: patchAt(obj?.[head], rest, value) };
}

/**
 * Render editable rows for every scalar (boolean/number/string) inside a
 * config fragment; nested plain objects become titled sub-boxes. Arrays and
 * unknown shapes are left to the main form below.
 */
function renderParamFields(
  value: Record<string, unknown> | undefined | null,
  path: string[],
  onChange: (path: string[], v: unknown) => void,
): ReactNode[] {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, v]) => {
    const p = [...path, key];
    const id = p.join(".");
    if (v === null || typeof v !== "object") {
      if (key === "pageSize") {
        return [(
          <div key={id} className="flex items-center justify-between gap-2 py-1">
            <span className="text-xs text-foreground">Page size</span>
            <select
              value={String(v ?? "A4")}
              onChange={(e) => onChange(p, e.target.value)}
              className="h-7 w-24 rounded-md border border-input bg-background text-xs px-1.5"
            >
              <option value="A4">A4</option>
              <option value="Letter">Letter</option>
            </select>
          </div>
        )];
      }
      if (key === "customDirectiveOverride") {
        return [(
          <div key={id} className="py-1">
            <span className="text-xs text-foreground block mb-1">{humanizeParam(key)} (replaces the generated directive text entirely)</span>
            <Textarea value={String(v ?? "")} onChange={(e) => onChange(p, e.target.value)} rows={3} className="text-xs font-mono" />
          </div>
        )];
      }
      if (typeof v === "boolean") {
        return [(
          <div key={id} className="flex items-center justify-between gap-2 py-1">
            <span className="text-xs text-foreground">{humanizeParam(key)}</span>
            <Switch checked={v as boolean} onCheckedChange={(c) => onChange(p, c)} />
          </div>
        )];
      }
      if (typeof v === "number") {
        return [(
          <div key={id} className="flex items-center justify-between gap-2 py-1">
            <span className="text-xs text-foreground">{humanizeParam(key)}</span>
            <Input
              type="number"
              value={String(v)}
              onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) onChange(p, n); }}
              className="h-7 w-24 text-xs"
            />
          </div>
        )];
      }
      return [(
        <div key={id} className="flex items-center justify-between gap-2 py-1">
          <span className="text-xs text-foreground">{humanizeParam(key)}</span>
          <Input value={String(v ?? "")} onChange={(e) => onChange(p, e.target.value)} className="h-7 w-32 text-xs" />
        </div>
      )];
    }
    if (Array.isArray(v)) return []; // arrays (section order, etc.) stay in the main form
    const kids = renderParamFields(v as Record<string, unknown>, p, onChange);
    if (kids.length === 0) return [];
    return [(
      <div key={id} className="rounded-md border p-2.5">
        <span className="text-[10px] uppercase font-bold tracking-wide text-muted-foreground">{humanizeParam(key)}</span>
        {kids}
      </div>
    )];
  });
}

/** Curated top-level scalar groups for the Profile Parameter Editor dialog. */
const PROFILE_EDITOR_GROUPS: Array<{ title: string; keys: string[] }> = [
  { title: "Page & layout", keys: ["enforceOnePage", "minFontSizePt", "marginTopMm", "marginBottomMm", "marginLeftMm", "marginRightMm", "lineHeight", "sectionGapMm", "bulletIndentMm"] },
  { title: "Fonts & colors", keys: ["fontFamily", "bodyFontSizePt", "sectionTitleSizePt", "nameSizePt", "nameColor", "sectionTitleColor", "bodyTextColor"] },
  { title: "Photo", keys: ["photoEnabled", "showPlaceholderIfNoPhoto", "photoWidthMm", "photoHeightMm"] },
  { title: "Content limits", keys: ["summaryMinWords", "summaryMaxWords", "skillsMaxGroups", "experienceMaxEntries", "experienceBulletsPerEntry", "educationMaxEntries", "languagesMaxEntries"] },
  { title: "Compliance engine", keys: ["complianceThreshold", "strictAgentLock", "enforceComplianceOnAllAgents", "forceDirectiveOnRetry"] },
];

export function OptimizerDirective() {
  const config = useApp((s) => s.optimizerDirective);
  const update = useApp((s) => s.updateOptimizerDirective);
  const reset = useApp((s) => s.resetOptimizerDirective);
  const customProfiles = useApp((s) => s.customDirectiveProfiles);
  const saveCustomProfiles = useApp((s) => s.saveCustomDirectiveProfiles);
  const deleteCustomDirectiveProfile = useApp((s) => s.deleteCustomDirectiveProfile);
  const customBlueprints = useApp((s) => s.customStructuralBlueprints);
  const saveCustomBlueprints = useApp((s) => s.saveCustomStructuralBlueprints);

  // Local draft so the user can edit multiple fields then save all at once
  const [draft, setDraft] = useState<OptimizerDirectiveConfig>(config);
  const [dirty, setDirty] = useState(false);

  // === Directive Profile editor state ===
  const [profileFormOpen, setProfileFormOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ overwriteId: "__new__", name: "", description: "", tags: "" });

  // === Custom Directive Profile Creator / Editor State ===
  const [createDirectiveOpen, setCreateDirectiveOpen] = useState(false);
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [directiveForm, setDirectiveForm] = useState<{
    id: string;
    name: string;
    targetIndustry: string;
    baseTemplateId: string;
    customInstructions: string;
    a4Preset: "strict-1page" | "standard" | "executive-2page" | "custom";
    maxBullets: number;
    summaryLengthWords: number;
    fontSizePt: number;
    sectionTitleSizePt: number;
  }>({
    id: "",
    name: "",
    targetIndustry: "Airport Retail",
    baseTemplateId: "aviation-hospitality",
    customInstructions: "Enforce strict single-page A4 format, highlight passenger diplomacy, luxury retail revenue metrics, bilingual communication, and 5-star service standards.",
    a4Preset: "strict-1page",
    maxBullets: 4,
    summaryLengthWords: 70,
    fontSizePt: 9.5,
    sectionTitleSizePt: 11,
  });

  // Delete profile confirmation state
  const [profileToDelete, setProfileToDelete] = useState<{ id: string; name: string } | null>(null);

  // === Structural Blueprint editor state ===
  const [bpEditor, setBpEditor] = useState<StructuralBlueprint | null>(null);
  const [bpOverridesBuiltIn, setBpOverridesBuiltIn] = useState(false);

  // Profile currently being EDITED — its settings live in the draft below;
  // "Update profile" snapshots the draft back into it (in place).
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);

  // Profile Parameter Editor dialog — shows/edits a profile's full parameter set
  const [profileEditor, setProfileEditor] = useState<{
    id: string;
    isBuiltIn: boolean;
    name: string;
    description: string;
    tags: string;
    config: OptimizerDirectiveConfig;
  } | null>(null);

  // Merged registries — a custom entry whose id equals a built-in id SHADOWS it.
  const mergedProfiles = useMemo(() => {
    const map: Record<string, DirectiveProfile> = { ...BUILT_IN_PROFILES };
    for (const p of customProfiles) map[p.id] = p;
    return Object.values(map);
  }, [customProfiles]);

  const mergedBlueprints = useMemo(() => {
    const list: StructuralBlueprint[] = Array.isArray(STRUCTURAL_BLUEPRINTS)
      ? [...STRUCTURAL_BLUEPRINTS]
      : Object.values(STRUCTURAL_BLUEPRINTS);
    const map = new Map<string, StructuralBlueprint>();
    for (const bp of list) {
      map.set(bp.id, {
        ...bp,
        formattingHints: {
          datesFormat: bp.formattingHints?.datesFormat || "Month Year (e.g. June 2024)",
          bulletStyle: bp.formattingHints?.bulletStyle || "Quantified action verb bullets",
          entityOrder: bp.formattingHints?.entityOrder || "Reverse Chronological",
        },
      });
    }
    for (const bp of customBlueprints) {
      map.set(bp.id, {
        ...bp,
        formattingHints: {
          datesFormat: bp.formattingHints?.datesFormat || "Month Year (e.g. June 2024)",
          bulletStyle: bp.formattingHints?.bulletStyle || "Quantified action verb bullets",
          entityOrder: bp.formattingHints?.entityOrder || "Reverse Chronological",
        },
      });
    }
    return Array.from(map.values());
  }, [customBlueprints]);

  const editingProfile = editingProfileId
    ? (mergedProfiles.find((p) => p.id === editingProfileId) ?? null)
    : null;

  const patch = (p: Partial<OptimizerDirectiveConfig>) => {
    setDraft((d) => ({ ...d, ...p }));
    setDirty(true);
  };

  const save = () => {
    update(draft);
    setDirty(false);
    toast.success("Optimizer directive saved. New AI optimizations will use these parameters.");
  };

  const resetToDefaults = () => {
    if (!confirm("Reset ALL optimizer directive parameters to factory defaults? This cannot be undone.")) return;
    setDraft(SEED_OPTIMIZER_DIRECTIVE);
    reset();
    setDirty(false);
    toast.success("Optimizer directive reset to factory defaults.");
  };

  const discard = () => {
    setDraft(config);
    setDirty(false);
    toast.info("Changes discarded.");
  };

  // ======================================================================
  // Directive Profile editor actions
  // ======================================================================

  const openNewDirectiveModal = () => {
    setIsEditingExisting(false);
    setDirectiveForm({
      id: "",
      name: "",
      targetIndustry: "Airport Retail",
      baseTemplateId: "aviation-hospitality",
      customInstructions: "Enforce strict single-page A4 format, highlight passenger diplomacy, luxury retail revenue metrics, bilingual communication, and 5-star airline customer service standards.",
      a4Preset: "strict-1page",
      maxBullets: 4,
      summaryLengthWords: 70,
      fontSizePt: 9.5,
      sectionTitleSizePt: 11,
    });
    setCreateDirectiveOpen(true);
  };

  const openEditCustomDirectiveModal = (profile: DirectiveProfile) => {
    setIsEditingExisting(true);
    const overrides = profile.overrides || {};
    const bullets = overrides.experienceBulletsPerEntry ?? 4;
    const summaryWords = overrides.summaryMaxWords ?? 75;
    const fontPt = overrides.bodyFontSizePt ?? 9.5;
    const titlePt = overrides.sectionTitleSizePt ?? 11;

    let preset: "strict-1page" | "standard" | "executive-2page" | "custom" = "custom";
    if (bullets <= 4 && summaryWords <= 80 && fontPt <= 9.5) {
      preset = "strict-1page";
    } else if (bullets === 5 && summaryWords <= 130) {
      preset = "standard";
    } else if (bullets >= 6) {
      preset = "executive-2page";
    }

    setDirectiveForm({
      id: profile.id,
      name: profile.name,
      targetIndustry: profile.tags?.find((t) => t !== "custom" && !t.includes("page")) || profile.tags?.[0] || "",
      baseTemplateId: "custom",
      customInstructions: String(overrides.customDirectiveOverride || ""),
      a4Preset: preset,
      maxBullets: bullets,
      summaryLengthWords: summaryWords,
      fontSizePt: fontPt,
      sectionTitleSizePt: titlePt,
    });
    setCreateDirectiveOpen(true);
  };

  const applyA4Preset = (preset: "strict-1page" | "standard" | "executive-2page") => {
    if (preset === "strict-1page") {
      setDirectiveForm((prev) => ({
        ...prev,
        a4Preset: "strict-1page",
        maxBullets: 4,
        summaryLengthWords: 70,
        fontSizePt: 9.5,
        sectionTitleSizePt: 11,
      }));
    } else if (preset === "standard") {
      setDirectiveForm((prev) => ({
        ...prev,
        a4Preset: "standard",
        maxBullets: 5,
        summaryLengthWords: 110,
        fontSizePt: 10,
        sectionTitleSizePt: 12,
      }));
    } else if (preset === "executive-2page") {
      setDirectiveForm((prev) => ({
        ...prev,
        a4Preset: "executive-2page",
        maxBullets: 7,
        summaryLengthWords: 180,
        fontSizePt: 10.5,
        sectionTitleSizePt: 13,
      }));
    }
  };

  const handleBaseTemplateChange = (templateId: string) => {
    let suggestedTag = directiveForm.targetIndustry;
    let suggestedPrompt = directiveForm.customInstructions;

    if (templateId === "aviation-hospitality") {
      suggestedTag = "Aviation / Cabin Crew";
      suggestedPrompt = "Enforce strict single-page airline format, highlight passenger diplomacy, bilingual competencies, conflict resolution, and 5-star in-flight hospitality standards.";
    } else if (templateId === "ats-conservative") {
      suggestedTag = "Corporate & Finance";
      suggestedPrompt = "Preserve chronological work history, prioritize standard ATS headings, eliminate ambiguous formatting, and enforce exact keyword match.";
    } else if (templateId === "ats-aggressive") {
      suggestedTag = "High-Volume ATS";
      suggestedPrompt = "Maximize keyword density, rewrite bullet points for 95%+ ATS parsing score, and front-load critical industry competencies.";
    } else if (templateId === "executive") {
      suggestedTag = "Executive Leadership";
      suggestedPrompt = "Emphasize multi-million dollar P&L accountability, board governance, executive communication, and organizational transformation.";
    } else if (templateId === "tech") {
      suggestedTag = "Software Engineering";
      suggestedPrompt = "Highlight technical architecture, cloud scalability, hard engineering competencies, and quantifiable system performance metrics.";
    } else if (templateId === "blank") {
      suggestedPrompt = "";
    }

    setDirectiveForm((prev) => ({
      ...prev,
      baseTemplateId: templateId,
      targetIndustry: suggestedTag,
      customInstructions: suggestedPrompt,
    }));
  };

  const handleSaveAndActivate = (activate: boolean = true) => {
    const name = directiveForm.name.trim();
    if (!name) {
      toast.error("Directive name is required.");
      return;
    }

    const id = directiveForm.id || slugifyProfileId(name);
    const baseTemplate = directiveForm.baseTemplateId !== "blank" && directiveForm.baseTemplateId !== "custom"
      ? (mergedProfiles.find((p) => p.id === directiveForm.baseTemplateId) || BUILT_IN_PROFILES["aviation-hospitality"])
      : null;

    const baseOverrides: Partial<OptimizerDirectiveConfig> = baseTemplate
      ? JSON.parse(JSON.stringify(baseTemplate.overrides || {}))
      : {};

    const tags = [
      directiveForm.targetIndustry.trim(),
      "custom",
      directiveForm.a4Preset === "strict-1page" ? "1-page" : directiveForm.a4Preset === "executive-2page" ? "2-page" : "standard"
    ].filter(Boolean);

    const overrides: Partial<OptimizerDirectiveConfig> = {
      ...baseOverrides,
      selectedProfileId: id,
      customDirectiveOverride: directiveForm.customInstructions.trim() || undefined,
      experienceBulletsPerEntry: directiveForm.maxBullets,
      summaryMaxWords: directiveForm.summaryLengthWords,
      summaryMinWords: Math.max(25, Math.floor(directiveForm.summaryLengthWords * 0.4)),
      bodyFontSizePt: directiveForm.fontSizePt,
      sectionTitleSizePt: directiveForm.sectionTitleSizePt,
      pageSize: "A4",
      agentDirectives: {
        ...(baseOverrides.agentDirectives || SEED_OPTIMIZER_DIRECTIVE.agentDirectives),
        summary: {
          ...(baseOverrides.agentDirectives?.summary || SEED_OPTIMIZER_DIRECTIVE.agentDirectives.summary),
          maxCharacters: directiveForm.summaryLengthWords * 7,
        },
        experience: {
          ...(baseOverrides.agentDirectives?.experience || SEED_OPTIMIZER_DIRECTIVE.agentDirectives.experience),
          rewriteBulletsOnly: true,
        },
        guardian: {
          ...(baseOverrides.agentDirectives?.guardian || SEED_OPTIMIZER_DIRECTIVE.agentDirectives.guardian),
          enforcePageUtilization: true,
          enforceContentLength: true,
        },
      },
    };

    const newProfile: DirectiveProfile = {
      id,
      name,
      description: directiveForm.targetIndustry.trim()
        ? `Target: ${directiveForm.targetIndustry.trim()}. Custom directive profile with ${directiveForm.a4Preset} A4 constraints.`
        : "Custom user-created directive profile for targeted resume optimization.",
      tags,
      overrides,
    };

    const nextList = [...customProfiles.filter((p) => p.id !== id), newProfile];
    saveCustomProfiles(nextList);

    if (activate) {
      const activatedDraft = applyProfileToConfig(draft, newProfile);
      activatedDraft.selectedProfileId = id;
      if (directiveForm.customInstructions.trim()) {
        activatedDraft.customDirectiveOverride = directiveForm.customInstructions.trim();
      }
      activatedDraft.experienceBulletsPerEntry = directiveForm.maxBullets;
      activatedDraft.summaryMaxWords = directiveForm.summaryLengthWords;
      activatedDraft.bodyFontSizePt = directiveForm.fontSizePt;
      activatedDraft.sectionTitleSizePt = directiveForm.sectionTitleSizePt;
      setDraft(activatedDraft);
      update(activatedDraft);
      setDirty(false);
      setEditingProfileId(id);
      toast.success(`Directive Profile "${name}" saved and set as active!`);
    } else {
      toast.success(`Directive Profile "${name}" saved.`);
    }

    setCreateDirectiveOpen(false);
  };

  const confirmDeleteProfile = (profile: DirectiveProfile) => {
    if (isBuiltInProfile(profile.id)) {
      toast.error("Built-in system profiles are protected and cannot be deleted.");
      return;
    }
    setProfileToDelete({ id: profile.id, name: profile.name });
  };

  const handleExecuteDelete = () => {
    if (!profileToDelete) return;
    const { id, name } = profileToDelete;

    const isActive = (draft.selectedProfileId || "aviation-hospitality") === id || (config.selectedProfileId || "aviation-hospitality") === id;

    deleteCustomDirectiveProfile(id);

    if (isActive) {
      const fallback = BUILT_IN_PROFILES["aviation-hospitality"];
      const fallbackConfig = fallback ? applyProfileToConfig(draft, fallback) : { ...draft };
      fallbackConfig.selectedProfileId = "aviation-hospitality";
      setDraft(fallbackConfig);
      update(fallbackConfig);
      setDirty(false);
      setEditingProfileId(null);
      toast.success(`Directive "${name}" deleted. Active profile automatically reverted to default Aviation / Hospitality.`);
    } else {
      if (editingProfileId === id) setEditingProfileId(null);
      toast.success(`Directive "${name}" deleted.`);
    }

    setProfileToDelete(null);
  };

  const openSaveProfileDialog = () => {
    setProfileForm({ overwriteId: "__new__", name: "", description: "", tags: "" });
    setProfileFormOpen(true);
  };

  const saveAsProfile = () => {
    const name = profileForm.name.trim();
    if (!name) {
      toast.error("Profile name is required.");
      return;
    }
    const overwriteId = profileForm.overwriteId;
    const id = overwriteId !== "__new__" ? overwriteId : slugifyProfileId(name);
    const profile: DirectiveProfile = {
      id,
      name: overwriteId !== "__new__" ? (mergedProfiles.find((p) => p.id === id)?.name || name) : name,
      description: profileForm.description.trim() || "User-saved snapshot of the current Optimizer Directive settings.",
      tags: profileForm.tags.split(",").map((t) => t.trim()).filter(Boolean),
      // Snapshot the ENTIRE current draft so applying this profile restores
      // every optimization parameter (agentDirectives are deep-merged by
      // applyProfileToConfig; scalars are replaced).
      overrides: JSON.parse(JSON.stringify(draft)) as Partial<OptimizerDirectiveConfig>,
    };
    const next = [...customProfiles.filter((p) => p.id !== id), profile];
    saveCustomProfiles(next);
    setProfileFormOpen(false);
    toast.success(`Profile "${profile.name}" saved${isBuiltInProfile(id) ? " (overrides the built-in)" : ""}. Apply it from the grid.`);
  };

  const deleteProfile = (id: string) => {
    const wasBuiltIn = isBuiltInProfile(id);
    if (!confirm(wasBuiltIn
      ? "Restore this built-in profile to its factory definition? Your customization will be removed."
      : "Delete this custom profile? This cannot be undone.")) return;
    saveCustomProfiles(customProfiles.filter((p) => p.id !== id));
    if (editingProfileId === id) setEditingProfileId(null);
    toast.success(wasBuiltIn ? "Built-in profile restored to factory definition." : "Custom profile deleted.");
  };

  /** EDIT — open the parameter editor dialog for a profile. */
  const openProfileEditor = (profile: DirectiveProfile) => {
    setProfileEditor({
      id: profile.id,
      isBuiltIn: isBuiltInProfile(profile.id),
      name: profile.name,
      description: profile.description,
      tags: (profile.tags ?? []).join(", "),
      // Effective configuration: built-in partials merged onto the factory
      // seed; custom full snapshots round-trip exactly.
      config: applyProfileToConfig(SEED_OPTIMIZER_DIRECTIVE, profile),
    });
  };

  const patchProfileEditorParam = (path: string[], v: unknown) => {
    setProfileEditor((pe) => (pe ? { ...pe, config: patchAt(pe.config, path, v) as OptimizerDirectiveConfig } : pe));
  };

  /** UPDATE — persist the edited parameters + metadata back into the profile. */
  const saveProfileEditor = () => {
    if (!profileEditor) return;
    const name = profileEditor.name.trim();
    if (!name) {
      toast.error("Profile name is required.");
      return;
    }
    if (!confirm(profileEditor.isBuiltIn
      ? `Customize built-in profile "${profileEditor.name}" with these parameters? Its factory definition stays recoverable via the restore icon on the card.`
      : `Update custom profile "${profileEditor.name}" with these parameters? Its previous configuration will be replaced.`)) return;
    const profile: DirectiveProfile = {
      id: profileEditor.id,
      name,
      description: profileEditor.description.trim() || "User-saved snapshot of the current Optimizer Directive settings.",
      tags: profileEditor.tags.split(",").map((t) => t.trim()).filter(Boolean),
      overrides: JSON.parse(JSON.stringify(profileEditor.config)) as Partial<OptimizerDirectiveConfig>,
    };
    const next = [...customProfiles.filter((p) => p.id !== profileEditor.id), profile];
    saveCustomProfiles(next);
    setProfileEditor(null);
    setEditingProfileId(null);
    toast.success(`Profile "${name}" updated${profileEditor.isBuiltIn ? " (overrides the built-in — factory definition recoverable)" : ""}. Apply it from the grid.`);
  };

  /** APPLY — load the edited parameters into the main draft for fine-tuning. */
  const applyProfileEditorToDraft = () => {
    if (!profileEditor) return;
    setDraft(JSON.parse(JSON.stringify(profileEditor.config)) as OptimizerDirectiveConfig);
    setDirty(true);
    setEditingProfileId(profileEditor.id);
    setProfileEditor(null);
    toast.info(`Profile "${profileEditor.name}" loaded into the form below — fine-tune, then "Update profile" to save back into it or "Save directive" to keep as your directive.`);
  };

  /** SAVE — snapshot the current draft back into an existing profile, in place. */
  const saveIntoProfile = (id: string, exitEdit = false) => {
    const existing = mergedProfiles.find((p) => p.id === id);
    if (!existing) return;
    const builtIn = isBuiltInProfile(id);
    if (!confirm(builtIn
      ? `Customize built-in profile "${existing.name}" with your current settings? Its factory definition stays recoverable via the restore icon on the card.`
      : `Update custom profile "${existing.name}" with your current settings? Its previous configuration will be replaced.`)) return;
    const profile: DirectiveProfile = {
      id,
      name: existing.name,
      description: existing.description,
      tags: existing.tags ? [...existing.tags] : [],
      // Snapshot the ENTIRE current draft (same semantics as Save-as).
      overrides: JSON.parse(JSON.stringify(draft)) as Partial<OptimizerDirectiveConfig>,
    };
    const next = [...customProfiles.filter((p) => p.id !== id), profile];
    saveCustomProfiles(next);
    if (exitEdit) setEditingProfileId(null);
    toast.success(`Profile "${existing.name}" updated with your current settings${builtIn ? " (overrides the built-in — factory definition recoverable)" : ""}.`);
  };

  const updateEditingProfile = () => {
    if (editingProfileId) saveIntoProfile(editingProfileId, true);
  };

  const cancelEditProfile = () => {
    setEditingProfileId(null);
    toast.info("Profile editing cancelled — the profile was left unchanged. Use \"Save directive\" if you want to keep the loaded settings as your current directive.");
  };

  // ======================================================================
  // Structural Blueprint editor actions
  // ======================================================================

  const openNewBlueprint = () => {
    setBpOverridesBuiltIn(false);
    setBpEditor({
      id: `custom_bp_${Date.now()}`,
      name: "",
      description: "",
      sections: [
        { id: "contact", name: "Contact Information", required: true, hints: [] },
        { id: "summary", name: "Professional Summary", required: true, hints: [] },
        { id: "experience", name: "Work Experience", required: true, hints: [], maxEntries: 3, maxBulletsPerEntry: 4 },
        { id: "education", name: "Education", required: true, hints: [], maxEntries: 2 },
        { id: "skills", name: "Skills", required: true, hints: [], maxEntries: 10 },
      ],
      formattingHints: { datesFormat: "", bulletStyle: "", entityOrder: "" },
    });
  };

  const openEditBlueprint = (bp: StructuralBlueprint) => {
    const builtIn = isBuiltInBlueprint(bp.id);
    const customized = customBlueprints.some((c) => c.id === bp.id);
    setBpOverridesBuiltIn(builtIn);
    const cloned = cloneBlueprint(bp);
    if (!cloned.formattingHints) {
      cloned.formattingHints = { datesFormat: "", bulletStyle: "", entityOrder: "" };
    }
    setBpEditor(cloned);
    if (builtIn && !customized) {
      toast.info(`Customizing built-in "${bp.name}" — saving overrides the factory definition (restorable).`);
    }
  };

  const duplicateBlueprint = (bp: StructuralBlueprint) => {
    setBpOverridesBuiltIn(false);
    const cloned = cloneBlueprint(bp);
    if (!cloned.formattingHints) {
      cloned.formattingHints = { datesFormat: "", bulletStyle: "", entityOrder: "" };
    }
    setBpEditor({
      ...cloned,
      id: `custom_bp_${Date.now()}`,
      name: `${bp.name} (Copy)`,
    });
    toast.info("Duplicated — adjust and save to add it to the library.");
  };

  const saveBlueprintEditor = () => {
    if (!bpEditor) return;
    const name = bpEditor.name.trim();
    if (!name) {
      toast.error("Blueprint name is required.");
      return;
    }
    if (bpEditor.sections.length === 0) {
      toast.error("Add at least one section.");
      return;
    }
    const ids = bpEditor.sections.map((s) => s.id);
    if (new Set(ids).size !== ids.length) {
      toast.error("Duplicate section entries — each section can appear only once.");
      return;
    }
    const cleaned: StructuralBlueprint = {
      ...bpEditor,
      id: bpEditor.id.trim(),
      name,
      description: bpEditor.description.trim(),
      sections: bpEditor.sections.map((s) => ({
        ...s,
        name: s.name?.trim() || (s as any).label?.trim() || BLUEPRINT_SECTION_IDS.find((b) => b.id === s.id)?.label || s.id,
        hints: (s.hints || []).map((h) => h.trim()).filter(Boolean),
      })),
      formattingHints: {
        datesFormat: (bpEditor.formattingHints?.datesFormat || "").trim(),
        bulletStyle: (bpEditor.formattingHints?.bulletStyle || "").trim(),
        entityOrder: (bpEditor.formattingHints?.entityOrder || "").trim(),
      },
    };
    const next = [...customBlueprints.filter((c) => c.id !== cleaned.id), cleaned];
    saveCustomBlueprints(next);
    // Select the blueprint so the user sees it take effect immediately.
    patch({ selectedStructuralBlueprintId: cleaned.id });
    setBpEditor(null);
    toast.success(`Blueprint "${cleaned.name}" saved and selected${bpOverridesBuiltIn ? " (overrides the built-in)" : ""}. Save the directive to apply.`);
  };

  const deleteBlueprint = (id: string) => {
    const wasBuiltIn = isBuiltInBlueprint(id);
    if (!confirm(wasBuiltIn
      ? "Restore this built-in blueprint to its factory definition? Your customization will be removed."
      : "Delete this custom blueprint? This cannot be undone.")) return;
    saveCustomBlueprints(customBlueprints.filter((c) => c.id !== id));
    if ((draft.selectedStructuralBlueprintId || "infohas_aviation") === id) {
      const fallback = wasBuiltIn ? id : "infohas_aviation";
      patch({ selectedStructuralBlueprintId: fallback });
    }
    toast.success(wasBuiltIn ? "Built-in blueprint restored to factory definition." : "Custom blueprint deleted.");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Icon name="SlidersHorizontal" className="w-6 h-6 text-brand" /> Optimizer Directive
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure the layout parameters for the InfoHAS Pro resume optimizer. These values override the hardcoded defaults and are injected into the AI prompt and rendering components.
          </p>
        </div>
        <div className="flex gap-2">
          {dirty && (
            <Button variant="outline" onClick={discard} className="gap-2">
              <Icon name="RotateCcw" className="w-4 h-4" /> Discard
            </Button>
          )}
          <Button variant="outline" onClick={resetToDefaults} className="gap-2 text-destructive hover:text-destructive">
            <Icon name="Trash2" className="w-4 h-4" /> Reset to defaults
          </Button>
          <Button onClick={save} disabled={!dirty} className="bg-brand hover:bg-brand-dark text-white gap-2">
            <Icon name="Save" className="w-4 h-4" /> Save directive
          </Button>
        </div>
      </div>

      {dirty && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 flex items-center gap-2">
          <Icon name="AlertTriangle" className="w-4 h-4 text-amber-600" />
          <span className="text-sm text-amber-800 dark:text-amber-200">You have unsaved changes. Click "Save directive" to apply them.</span>
        </div>
      )}

      {/* DIRECTIVE PROFILE SELECTOR + EDITOR */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <Icon name="Layers" className="w-4 h-4 text-brand" /> Directive Profile
            </CardTitle>
            <CardDescription>
              Select a pre-built directive profile or manage custom directive profiles tailored for specific roles, airlines, and companies.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={openNewDirectiveModal}
              className="bg-brand hover:bg-brand-dark text-white gap-1.5 shadow-sm"
              size="sm"
            >
              <Icon name="Plus" className="w-4 h-4" /> Create New Directive Profile
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={openSaveProfileDialog}
              className="gap-1.5 hidden md:flex"
            >
              <Icon name="Save" className="w-3.5 h-3.5" /> Snapshot Current
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {editingProfile && (
            <div className="rounded-lg bg-brand/10 dark:bg-brand/20 border border-brand/30 p-3 flex items-center justify-between flex-wrap gap-2">
              <span className="text-sm flex items-center gap-2 text-foreground">
                <Icon name="Pencil" className="w-4 h-4 text-brand shrink-0" />
                <span>Editing profile <b>{editingProfile.name}</b> — fine-tune any settings below, then update the profile or fork it as a new one.</span>
              </span>
              <span className="flex gap-2">
                <Button size="sm" onClick={updateEditingProfile} className="bg-brand hover:bg-brand-dark text-white gap-1.5">
                  <Icon name="Save" className="w-3.5 h-3.5" /> Update profile
                </Button>
                <Button size="sm" variant="outline" onClick={cancelEditProfile}>Cancel</Button>
              </span>
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {mergedProfiles.map((profile) => {
              const customized = customProfiles.some((c) => c.id === profile.id);
              const builtIn = isBuiltInProfile(profile.id);
              const beingEdited = editingProfileId === profile.id;
              const isActive = (draft.selectedProfileId || "aviation-hospitality") === profile.id;
              return (
                <div key={profile.id} className={`relative flex flex-col items-start p-3 rounded-lg border text-left transition-all ${beingEdited ? "border-brand bg-brand/5 dark:bg-brand/10 ring-1 ring-brand" : isActive ? "border-emerald-600/60 bg-emerald-500/5 ring-1 ring-emerald-500/30 shadow-sm" : "border-input bg-background hover:bg-secondary/40 hover:border-brand/40"}`}>
                  <button
                    onClick={() => {
                      const merged = applyProfileToConfig(draft, profile);
                      if (merged) {
                        merged.selectedProfileId = profile.id;
                        setDraft(merged);
                        setDirty(true);
                        setEditingProfileId(profile.id);
                        toast.info(`Profile "${profile.name}" applied — fine-tune below, then "Update profile" to save back into it, "Save directive" to keep as your directive, or Cancel.`);
                      }
                    }}
                    className="w-full text-left"
                  >
                    <div className="flex items-start justify-between gap-2 pr-1">
                      <span className="text-sm font-semibold text-foreground">{profile.name}</span>
                      {isActive && (
                        <Badge className="text-[9px] px-1.5 py-0 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 font-medium">
                          Active
                        </Badge>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-0.5 block font-mono">
                      {profile.tags?.length ? profile.tags.join(", ") : "custom"}
                    </span>
                    <span className="text-xs text-muted-foreground mt-1 line-clamp-2 block">{profile.description}</span>
                  </button>
                  <div className="absolute top-2 right-2 flex items-center gap-1">
                    {customized && (
                      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${!builtIn ? "bg-brand/5 border-brand/30 text-brand font-medium" : ""}`}>
                        {builtIn ? "Modified" : "Custom"}
                      </Badge>
                    )}
                  </div>
                  <div className="w-full flex items-center gap-1 mt-2 pt-2 border-t border-border/60">
                    <span className="text-[10px] uppercase font-bold tracking-wide text-muted-foreground mr-auto">{beingEdited ? "Editing" : builtIn ? "Built-in" : "Custom"}</span>
                    <button
                      onClick={() => builtIn ? openProfileEditor(profile) : openEditCustomDirectiveModal(profile)}
                      title={builtIn ? "Edit profile — open the parameter editor" : "Edit custom directive profile"}
                      className="h-6 w-6 grid place-items-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={`Edit ${profile.name}`}
                    >
                      <Icon name="Pencil" className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => saveIntoProfile(profile.id)}
                      title="Save your CURRENT settings into this profile"
                      className="h-6 w-6 grid place-items-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={`Save current into ${profile.name}`}
                    >
                      <Icon name="Save" className="w-3.5 h-3.5" />
                    </button>
                    {customized && builtIn && (
                      <button
                        onClick={() => deleteProfile(profile.id)}
                        title="Restore factory definition (removes your customization)"
                        className="h-6 w-6 grid place-items-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={`Restore ${profile.name}`}
                      >
                        <Icon name="RotateCcw" className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {!builtIn && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmDeleteProfile(profile);
                        }}
                        title="Delete this custom directive profile"
                        className="h-6 w-6 grid place-items-center rounded hover:bg-destructive/15 text-destructive/80 hover:text-destructive transition-colors ml-0.5"
                        aria-label={`Delete custom directive ${profile.name}`}
                      >
                        <Icon name="Trash2" className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Click a card to apply it. Built-in system profiles are protected and cannot be deleted. Custom directive profiles can be created, updated via the pencil icon, and deleted using the trash icon. If an active custom directive is deleted, the optimizer automatically reverts to the default Aviation / Hospitality profile.
          </p>
        </CardContent>
      </Card>

      {/* DEDICATED CUSTOM DIRECTIVE MANAGER */}
      <DirectiveManager
        selectedProfileId={draft.selectedProfileId}
        onProfileSelect={(profile) => {
          const merged = applyProfileToConfig(draft, profile);
          if (merged) {
            merged.selectedProfileId = profile.id;
            setDraft(merged);
            setDirty(true);
            setEditingProfileId(profile.id);
          }
        }}
      />

      {/* STRUCTURAL BLUEPRINT SKELETON REFERENCE LIBRARY */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Icon name="GitBranch" className="w-4 h-4 text-brand" /> Structural Blueprint Reference Library
          </CardTitle>
          <CardDescription>
            Select a target layout blueprint. Optimization agents and the Supervisor will automatically format, reorder sections, and enforce strict limits matching this exact structural blueprint.
            Edit any blueprint, duplicate a built-in as a starting point, or create a new one from scratch.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" onClick={openNewBlueprint} className="gap-2">
              <Icon name="Plus" className="w-4 h-4" /> New blueprint
            </Button>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            {mergedBlueprints.map((bp) => {
              const isSelected = (draft.selectedStructuralBlueprintId || "infohas_aviation") === bp.id;
              const builtIn = isBuiltInBlueprint(bp.id);
              const customized = customBlueprints.some((c) => c.id === bp.id);
              return (
                <div
                  key={bp.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    patch({ selectedStructuralBlueprintId: bp.id });
                    toast.info(`Target blueprint switched to "${bp.name}" — save changes to apply.`);
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); patch({ selectedStructuralBlueprintId: bp.id }); } }}
                  className={`relative flex flex-col items-start p-3.5 rounded-lg border text-left transition-all cursor-pointer ${
                    isSelected
                      ? "border-brand bg-brand/5 dark:bg-brand/10 ring-1 ring-brand"
                      : "border-input bg-background hover:bg-secondary/40 hover:border-brand/40"
                  }`}
                >
                  <div className="flex items-center justify-between w-full gap-2">
                    <span className="text-sm font-semibold pr-1">{bp.name}</span>
                    {isSelected && (
                      <span className="flex h-2 w-2 relative shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-brand"></span>
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground mt-1 line-clamp-2">{bp.description}</span>
                  <div className="flex items-center gap-1.5 mt-2.5">
                    {customized && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                        {builtIn ? "Modified" : "Custom"}
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground">{bp.sections.length} sections</span>
                    <span className="flex-1" />
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditBlueprint(bp); }}
                      title={builtIn ? "Customize built-in" : "Edit blueprint"}
                      className="h-6 w-6 grid place-items-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                    >
                      <Icon name="Pencil" className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); duplicateBlueprint(bp); }}
                      title="Duplicate as new custom blueprint"
                      className="h-6 w-6 grid place-items-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                    >
                      <Icon name="Copy" className="w-3.5 h-3.5" />
                    </button>
                    {customized && (
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteBlueprint(bp.id); }}
                        title={builtIn ? "Restore factory definition" : "Delete custom blueprint"}
                        className="h-6 w-6 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      >
                        <Icon name="RotateCcw" className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Blueprint Details */}
          {(() => {
            const activeId = draft.selectedStructuralBlueprintId || "infohas_aviation";
            const activeBp = mergedBlueprints.find((b) => b.id === activeId) || mergedBlueprints[0];
            if (!activeBp) return null;
            return (
              <div className="rounded-lg bg-muted/40 border p-4 space-y-3 text-xs leading-normal">
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="font-semibold text-foreground">Active Blueprint: {activeBp.name}</span>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Guidelines</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-muted-foreground font-medium block mb-1">Target Section Order:</span>
                    <ol className="list-decimal list-inside space-y-0.5 text-[11px] text-foreground/80">
                      {(activeBp.sections || []).map((sec) => (
                        <li key={sec.id}>
                          <span className="font-medium text-foreground">{sec.name || (sec as any).label || sec.id}</span>
                          {sec.maxEntries && ` (Max ${sec.maxEntries} entries)`}
                          {sec.maxBulletsPerEntry && ` (Max ${sec.maxBulletsPerEntry} bullets)`}
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <span className="text-muted-foreground font-medium block">Date Representation Format:</span>
                      <p className="text-[11px] text-foreground/80 font-mono mt-0.5">{activeBp.formattingHints?.datesFormat || "Month Year (e.g. June 2024)"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground font-medium block">Bullet Writing Style:</span>
                      <p className="text-[11px] text-foreground/80 mt-0.5">{activeBp.formattingHints?.bulletStyle || "Quantified action verb bullets"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground font-medium block">Sorting & Hierarchy Rules:</span>
                      <p className="text-[11px] text-foreground/80 mt-0.5">{activeBp.formattingHints?.entityOrder || "Reverse Chronological"}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* SAVE-CURRENT-SETTINGS-AS-PROFILE DIALOG */}
      <Dialog open={profileFormOpen} onOpenChange={setProfileFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Icon name="Save" className="w-4 h-4 text-brand" /> Save current settings as profile</DialogTitle>
            <DialogDescription>
              Snapshots EVERYTHING currently in this editor (agents, limits, layout, blueprint selection) into a reusable
              one-click profile. Choose "New profile" or overwrite an existing one (overwriting a built-in keeps its factory
              definition restorable).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="profile-overwrite">Target</Label>
              <select
                id="profile-overwrite"
                value={profileForm.overwriteId}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "__new__") {
                    setProfileForm((f) => ({ ...f, overwriteId: v }));
                  } else {
                    const existing = mergedProfiles.find((p) => p.id === v);
                    setProfileForm((f) => ({
                      ...f,
                      overwriteId: v,
                      name: existing?.name ?? "",
                      description: existing?.description ?? "",
                      tags: existing?.tags?.join(", ") ?? "",
                    }));
                  }
                }}
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm mt-1"
              >
                <option value="__new__">New profile…</option>
                {mergedProfiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}{isBuiltInProfile(p.id) ? " (built-in)" : ""}</option>
                ))}
              </select>
            </div>
            {profileForm.overwriteId === "__new__" && (
              <div>
                <Label htmlFor="profile-name">Profile name *</Label>
                <Input
                  id="profile-name"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Qatar Airways Cabin Crew — Premium"
                  className="mt-1"
                />
              </div>
            )}
            <div>
              <Label htmlFor="profile-desc">Description</Label>
              <Textarea
                id="profile-desc"
                value={profileForm.description}
                onChange={(e) => setProfileForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="What is this profile tuned for?"
                rows={2}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="profile-tags">Tags (comma-separated)</Label>
              <Input
                id="profile-tags"
                value={profileForm.tags}
                onChange={(e) => setProfileForm((f) => ({ ...f, tags: e.target.value }))}
                placeholder="aviation, premium, ats"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProfileFormOpen(false)}>Cancel</Button>
            <Button onClick={saveAsProfile} className="bg-brand hover:bg-brand-dark text-white gap-2">
              <Icon name="Check" className="w-4 h-4" /> Save profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CREATE / EDIT CUSTOM DIRECTIVE PROFILE DIALOG */}
      <Dialog open={createDirectiveOpen} onOpenChange={setCreateDirectiveOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Icon name={isEditingExisting ? "Pencil" : "Sparkles"} className="w-5 h-5 text-brand" />
              {isEditingExisting ? "Edit Directive Profile" : "Create New Directive Profile"}
            </DialogTitle>
            <DialogDescription>
              Define tailored AI optimization instructions, role positioning, and strict A4 page constraints for target industries and airlines.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Directive Name */}
            <div>
              <Label htmlFor="dir-create-name" className="text-sm font-semibold flex items-center justify-between">
                <span>Directive Profile Name <span className="text-destructive">*</span></span>
                <span className="text-xs text-muted-foreground font-normal">e.g., Qatar Duty Free - Strict One Page</span>
              </Label>
              <Input
                id="dir-create-name"
                value={directiveForm.name}
                onChange={(e) => setDirectiveForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Qatar Duty Free - Strict One Page"
                className="mt-1"
              />
            </div>

            {/* Target Industry / Role Tag */}
            <div>
              <Label htmlFor="dir-create-tag" className="text-sm font-semibold">
                Target Industry / Role Tag
              </Label>
              <Input
                id="dir-create-tag"
                value={directiveForm.targetIndustry}
                onChange={(e) => setDirectiveForm((f) => ({ ...f, targetIndustry: e.target.value }))}
                placeholder="e.g. Airport Retail, Cabin Crew, Corporate"
                className="mt-1"
              />
              <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                <span className="text-[11px] text-muted-foreground font-medium mr-1">Quick presets:</span>
                {[
                  "Airport Retail",
                  "Cabin Crew",
                  "VIP Aviation",
                  "Hospitality Management",
                  "Corporate Operations",
                  "Ground Handling",
                  "Engineering / IT",
                ].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setDirectiveForm((f) => ({ ...f, targetIndustry: tag }))}
                    className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                      directiveForm.targetIndustry === tag
                        ? "bg-brand text-white border-brand font-medium"
                        : "bg-secondary/60 hover:bg-secondary border-border text-foreground"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Base Template Selector */}
            <div>
              <Label htmlFor="dir-create-base" className="text-sm font-semibold">
                Base Template Selector
              </Label>
              <select
                id="dir-create-base"
                value={directiveForm.baseTemplateId}
                onChange={(e) => handleBaseTemplateChange(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm mt-1"
              >
                <option value="aviation-hospitality">Aviation / Hospitality (InfoHAS Signature Profile)</option>
                <option value="ats-conservative">ATS Conservative (Safe & Structure-Preserving)</option>
                <option value="ats-aggressive">ATS Aggressive (Maximum Keyword Density)</option>
                <option value="executive">Executive / High-End (Leadership & Narrative)</option>
                <option value="tech">Tech / Engineering (Hard Skills & Architecture)</option>
                <option value="blank">Start Blank (Clean Baseline Slate)</option>
              </select>
              <p className="text-[11px] text-muted-foreground mt-1">
                Clones baseline weights and ATS thresholds from the selected template while applying your custom directives below.
              </p>
            </div>

            {/* Custom Instructions Field */}
            <div>
              <Label htmlFor="dir-create-prompt" className="text-sm font-semibold flex items-center justify-between">
                <span>Custom Instructions (System Prompt / Directive Override)</span>
                <span className="text-[11px] text-brand font-mono">Injected into Optimizer</span>
              </Label>
              <Textarea
                id="dir-create-prompt"
                value={directiveForm.customInstructions}
                onChange={(e) => setDirectiveForm((f) => ({ ...f, customInstructions: e.target.value }))}
                placeholder="Enter custom AI prompt instructions (e.g. 'Enforce strict 1-page A4 format, highlight duty-free sales targets, passenger diplomacy, Qatar Airways 5-star hospitality standards, and high-impact action verbs.')..."
                rows={4}
                className="mt-1 font-sans text-xs leading-relaxed"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Specific system prompt injected directly into the multi-agent optimization pipeline to control bullet formulation, tone, and priority keywords.
              </p>
            </div>

            {/* A4 Constraint Presets */}
            <div className="border border-border/80 rounded-lg p-3 bg-secondary/20 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <Icon name="FileText" className="w-4 h-4 text-brand" /> A4 Constraint Presets
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Quickly toggle bullet limits, summary word count, and typographic scaling to guarantee clean page fit.
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono capitalize">
                  {directiveForm.a4Preset.replace("-", " ")}
                </Badge>
              </div>

              {/* Toggle Buttons for Presets */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => applyA4Preset("strict-1page")}
                  className={`p-2.5 rounded-md border text-left transition-all ${
                    directiveForm.a4Preset === "strict-1page"
                      ? "border-brand bg-brand/10 dark:bg-brand/20 ring-1 ring-brand text-brand"
                      : "border-input bg-background hover:bg-secondary/40 text-foreground"
                  }`}
                >
                  <div className="text-xs font-semibold">Strict 1-Page</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Max 4 bullets • 70w summary • 9.5pt font</div>
                </button>

                <button
                  type="button"
                  onClick={() => applyA4Preset("standard")}
                  className={`p-2.5 rounded-md border text-left transition-all ${
                    directiveForm.a4Preset === "standard"
                      ? "border-brand bg-brand/10 dark:bg-brand/20 ring-1 ring-brand text-brand"
                      : "border-input bg-background hover:bg-secondary/40 text-foreground"
                  }`}
                >
                  <div className="text-xs font-semibold">Standard Pro</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Max 5 bullets • 110w summary • 10.0pt font</div>
                </button>

                <button
                  type="button"
                  onClick={() => applyA4Preset("executive-2page")}
                  className={`p-2.5 rounded-md border text-left transition-all ${
                    directiveForm.a4Preset === "executive-2page"
                      ? "border-brand bg-brand/10 dark:bg-brand/20 ring-1 ring-brand text-brand"
                      : "border-input bg-background hover:bg-secondary/40 text-foreground"
                  }`}
                >
                  <div className="text-xs font-semibold">Executive 2-Page</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Max 7 bullets • 180w summary • 10.5pt font</div>
                </button>
              </div>

              {/* Fine-Tuning Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border/50">
                <div>
                  <Label htmlFor="dir-bullets" className="text-[11px] text-muted-foreground">Max Bullets / Role</Label>
                  <Input
                    id="dir-bullets"
                    type="number"
                    min={2}
                    max={10}
                    value={directiveForm.maxBullets}
                    onChange={(e) => setDirectiveForm((f) => ({ ...f, maxBullets: Number(e.target.value) || 4, a4Preset: "custom" }))}
                    className="h-8 text-xs mt-0.5"
                  />
                </div>
                <div>
                  <Label htmlFor="dir-summary-words" className="text-[11px] text-muted-foreground">Summary Max Words</Label>
                  <Input
                    id="dir-summary-words"
                    type="number"
                    min={30}
                    max={300}
                    step={5}
                    value={directiveForm.summaryLengthWords}
                    onChange={(e) => setDirectiveForm((f) => ({ ...f, summaryLengthWords: Number(e.target.value) || 75, a4Preset: "custom" }))}
                    className="h-8 text-xs mt-0.5"
                  />
                </div>
                <div>
                  <Label htmlFor="dir-font-pt" className="text-[11px] text-muted-foreground">Body Font (pt)</Label>
                  <Input
                    id="dir-font-pt"
                    type="number"
                    min={8}
                    max={13}
                    step={0.5}
                    value={directiveForm.fontSizePt}
                    onChange={(e) => setDirectiveForm((f) => ({ ...f, fontSizePt: Number(e.target.value) || 9.5, a4Preset: "custom" }))}
                    className="h-8 text-xs mt-0.5"
                  />
                </div>
                <div>
                  <Label htmlFor="dir-title-pt" className="text-[11px] text-muted-foreground">Section Title (pt)</Label>
                  <Input
                    id="dir-title-pt"
                    type="number"
                    min={10}
                    max={16}
                    step={0.5}
                    value={directiveForm.sectionTitleSizePt}
                    onChange={(e) => setDirectiveForm((f) => ({ ...f, sectionTitleSizePt: Number(e.target.value) || 11, a4Preset: "custom" }))}
                    className="h-8 text-xs mt-0.5"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setCreateDirectiveOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleSaveAndActivate(false)}
              className="gap-1.5"
            >
              <Icon name="Save" className="w-4 h-4" /> Save Profile Only
            </Button>
            <Button
              onClick={() => handleSaveAndActivate(true)}
              className="bg-brand hover:bg-brand-dark text-white gap-1.5 shadow-sm font-medium"
            >
              <Icon name="CheckCircle" className="w-4 h-4" /> Save & Activate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CONFIRM DELETE CUSTOM DIRECTIVE PROFILE DIALOG */}
      <Dialog open={!!profileToDelete} onOpenChange={(open) => { if (!open) setProfileToDelete(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Icon name="Trash2" className="w-5 h-5 text-destructive" /> Delete Directive Profile
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the custom directive profile <strong>&ldquo;{profileToDelete?.name}&rdquo;</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="text-xs text-muted-foreground bg-destructive/10 border border-destructive/20 rounded-md p-3 space-y-2">
            <p className="font-semibold text-destructive flex items-center gap-1.5">
              <Icon name="AlertTriangle" className="w-4 h-4 text-destructive shrink-0" />
              <span>This action cannot be undone.</span>
            </p>
            <p>
              The directive profile will be permanently removed from your active profile list, browser local storage, and Firestore database.
            </p>
            {(draft.selectedProfileId === profileToDelete?.id || config.selectedProfileId === profileToDelete?.id) && (
              <div className="pt-2 border-t border-destructive/20 text-amber-700 dark:text-amber-300 font-medium">
                <strong>Automatic Fallback:</strong> This profile is currently active. Deleting it will automatically reset your active optimizer directive to the default <em>Aviation / Hospitality</em> profile.
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setProfileToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleExecuteDelete}
              className="gap-1.5 shadow-sm"
            >
              <Icon name="Trash2" className="w-4 h-4" /> Delete Directive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PROFILE PARAMETER EDITOR DIALOG — opened via the pencil on a profile card */}
      <Dialog open={!!profileEditor} onOpenChange={(open) => { if (!open) setProfileEditor(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon name="Pencil" className="w-4 h-4 text-brand" />
              Edit profile: {profileEditor?.name}
              {profileEditor?.isBuiltIn && <Badge variant="outline" className="text-[9px] px-1.5 py-0">Built-in</Badge>}
            </DialogTitle>
            <DialogDescription>
              Every parameter this profile applies, in one view. Update profile saves them back into the profile
              (customizing a built-in keeps its factory definition recoverable); Apply to directive loads them into the
              form below without saving the profile. Tone, keyword and alignment fine-tuning live in the main form.
            </DialogDescription>
          </DialogHeader>
          {profileEditor && (
            <div className="space-y-4">
              {/* Metadata */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="pe-name">Profile name *</Label>
                  <Input
                    id="pe-name"
                    value={profileEditor.name}
                    onChange={(e) => setProfileEditor({ ...profileEditor, name: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="pe-tags">Tags (comma-separated)</Label>
                  <Input
                    id="pe-tags"
                    value={profileEditor.tags}
                    onChange={(e) => setProfileEditor({ ...profileEditor, tags: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="pe-desc">Description</Label>
                  <Input
                    id="pe-desc"
                    value={profileEditor.description}
                    onChange={(e) => setProfileEditor({ ...profileEditor, description: e.target.value })}
                    placeholder="What is this profile tuned for?"
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Target blueprint */}
              <div className="rounded-lg border p-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Target blueprint</span>
                <select
                  value={profileEditor.config.selectedStructuralBlueprintId || "infohas_aviation"}
                  onChange={(e) => patchProfileEditorParam(["selectedStructuralBlueprintId"], e.target.value)}
                  className="w-full h-8 px-2 rounded-md border border-input bg-background text-sm mt-2"
                >
                  {mergedBlueprints.map((bp) => (
                    <option key={bp.id} value={bp.id}>{bp.name}{bp.id.startsWith("custom_bp_") ? " (custom)" : ""}</option>
                  ))}
                </select>
              </div>

              {/* Curated scalar groups */}
              <div className="grid sm:grid-cols-2 gap-3">
                {PROFILE_EDITOR_GROUPS.map((group) => {
                  const fragment = Object.fromEntries(
                    group.keys.map((k) => [k, (profileEditor.config as unknown as Record<string, unknown>)[k]]).filter(([, v]) => v !== undefined),
                  );
                  const rows = renderParamFields(fragment, [], patchProfileEditorParam);
                  if (rows.length === 0) return null;
                  return (
                    <div key={group.title} className="rounded-lg border p-3">
                      <span className="text-xs font-semibold text-muted-foreground uppercase">{group.title}</span>
                      <div className="mt-1">{rows}</div>
                    </div>
                  );
                })}
              </div>

              {/* Section character limits (nested min/max per section) */}
              {profileEditor.config.sectionLimits && (
                <div className="rounded-lg border p-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">Section character limits (min / max)</span>
                  <div className="grid sm:grid-cols-2 gap-2 mt-2 items-start">
                    {renderParamFields(profileEditor.config.sectionLimits as unknown as Record<string, unknown>, ["sectionLimits"], patchProfileEditorParam)}
                  </div>
                </div>
              )}

              {/* Per-agent directives */}
              {profileEditor.config.agentDirectives && (
                <div className="rounded-lg border p-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">Agent directives (injected into every agent's prompt)</span>
                  <div className="grid sm:grid-cols-2 gap-2 mt-2 items-start">
                    {renderParamFields(profileEditor.config.agentDirectives as unknown as Record<string, unknown>, ["agentDirectives"], patchProfileEditorParam)}
                  </div>
                </div>
              )}

              {/* Advanced: custom directive override */}
              {typeof profileEditor.config.customDirectiveOverride === "string" && (
                <div className="rounded-lg border p-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">Advanced</span>
                  <div className="mt-1">
                    {renderParamFields({ customDirectiveOverride: profileEditor.config.customDirectiveOverride }, [], patchProfileEditorParam)}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setProfileEditor(null)}>Cancel</Button>
            <Button variant="outline" onClick={applyProfileEditorToDraft} className="gap-2">
              <Icon name="ArrowDown" className="w-4 h-4" /> Apply to directive
            </Button>
            <Button onClick={saveProfileEditor} className="bg-brand hover:bg-brand-dark text-white gap-2">
              <Icon name="Save" className="w-4 h-4" /> Update profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* STRUCTURAL BLUEPRINT EDITOR DIALOG */}
      <Dialog open={!!bpEditor} onOpenChange={(open) => { if (!open) setBpEditor(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon name="GitBranch" className="w-4 h-4 text-brand" />
              {bpOverridesBuiltIn ? "Customize built-in blueprint" : "Blueprint editor"}
            </DialogTitle>
            <DialogDescription>
              {bpOverridesBuiltIn
                ? "Saving overrides the factory definition of this built-in blueprint (restorable via the restore button on its card)."
                : "Define the section skeleton, ordering limits, and formatting hints the optimization agents must follow."}
            </DialogDescription>
          </DialogHeader>
          {bpEditor && (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="bp-name">Blueprint name *</Label>
                  <Input
                    id="bp-name"
                    value={bpEditor.name}
                    onChange={(e) => setBpEditor({ ...bpEditor, name: e.target.value })}
                    placeholder="e.g. Emirates Cabin Crew Premium"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="bp-desc">Description</Label>
                  <Input
                    id="bp-desc"
                    value={bpEditor.description}
                    onChange={(e) => setBpEditor({ ...bpEditor, description: e.target.value })}
                    placeholder="Who is this layout for?"
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="rounded-lg border p-3 space-y-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Formatting Hints</span>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="bp-dates">Dates format</Label>
                    <Input
                      id="bp-dates"
                      value={bpEditor.formattingHints?.datesFormat || ""}
                      onChange={(e) => setBpEditor({
                        ...bpEditor,
                        formattingHints: {
                          datesFormat: e.target.value,
                          bulletStyle: bpEditor.formattingHints?.bulletStyle || "",
                          entityOrder: bpEditor.formattingHints?.entityOrder || "",
                        },
                      })}
                      placeholder="YYYY-MM"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bp-bullets">Bullet style</Label>
                    <Input
                      id="bp-bullets"
                      value={bpEditor.formattingHints?.bulletStyle || ""}
                      onChange={(e) => setBpEditor({
                        ...bpEditor,
                        formattingHints: {
                          datesFormat: bpEditor.formattingHints?.datesFormat || "",
                          bulletStyle: e.target.value,
                          entityOrder: bpEditor.formattingHints?.entityOrder || "",
                        },
                      })}
                      placeholder="Quantified action verb bullets"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bp-order">Entity order</Label>
                    <Input
                      id="bp-order"
                      value={bpEditor.formattingHints?.entityOrder || ""}
                      onChange={(e) => setBpEditor({
                        ...bpEditor,
                        formattingHints: {
                          datesFormat: bpEditor.formattingHints?.datesFormat || "",
                          bulletStyle: bpEditor.formattingHints?.bulletStyle || "",
                          entityOrder: e.target.value,
                        },
                      })}
                      placeholder="Degrees -> Experience"
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">Sections ({bpEditor.sections.length})</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 h-7 text-xs"
                    onClick={() => {
                      const used = new Set(bpEditor.sections.map((s) => s.id));
                      const free = BLUEPRINT_SECTION_IDS.find((b) => !used.has(b.id));
                      if (!free) {
                        toast.info("All canonical sections are already present.");
                        return;
                      }
                      setBpEditor({
                        ...bpEditor,
                        sections: [...bpEditor.sections, { id: free.id, name: free.label, required: true, hints: [] }],
                      });
                    }}
                  >
                    <Icon name="Plus" className="w-3.5 h-3.5" /> Add section
                  </Button>
                </div>
                {bpEditor.sections.map((sec, idx) => (
                  <div key={`${sec.id}-${idx}`} className="rounded-lg border p-3 space-y-2">
                    <div className="grid sm:grid-cols-[1fr_1fr_auto_auto_auto] gap-2 items-end">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Section</Label>
                        <select
                          value={sec.id}
                          onChange={(e) => {
                            const id = e.target.value as ResumeSectionStructure["id"];
                            const sections = [...bpEditor.sections];
                            sections[idx] = { ...sec, id };
                            setBpEditor({ ...bpEditor, sections });
                          }}
                          className="w-full h-9 px-2 rounded-md border border-input bg-background text-sm mt-1"
                        >
                          {BLUEPRINT_SECTION_IDS.map((b) => (
                            <option key={b.id} value={b.id}>{b.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Display name</Label>
                        <Input
                          value={sec.name}
                          onChange={(e) => {
                            const sections = [...bpEditor.sections];
                            sections[idx] = { ...sec, name: e.target.value };
                            setBpEditor({ ...bpEditor, sections });
                          }}
                          className="mt-1"
                        />
                      </div>
                      <div className="w-20">
                        <Label className="text-[10px] text-muted-foreground">Max entries</Label>
                        <Input
                          type="number" min={0}
                          value={sec.maxEntries ?? ""}
                          onChange={(e) => {
                            const v = e.target.value === "" ? undefined : Math.max(0, parseInt(e.target.value, 10) || 0);
                            const sections = [...bpEditor.sections];
                            sections[idx] = { ...sec, maxEntries: v };
                            setBpEditor({ ...bpEditor, sections });
                          }}
                          className="mt-1"
                        />
                      </div>
                      <div className="w-20">
                        <Label className="text-[10px] text-muted-foreground">Max bullets</Label>
                        <Input
                          type="number" min={0}
                          value={sec.maxBulletsPerEntry ?? ""}
                          onChange={(e) => {
                            const v = e.target.value === "" ? undefined : Math.max(0, parseInt(e.target.value, 10) || 0);
                            const sections = [...bpEditor.sections];
                            sections[idx] = { ...sec, maxBulletsPerEntry: v };
                            setBpEditor({ ...bpEditor, sections });
                          }}
                          className="mt-1"
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 w-9 p-0 text-destructive hover:text-destructive"
                        onClick={() => setBpEditor({ ...bpEditor, sections: bpEditor.sections.filter((_, i) => i !== idx) })}
                        title="Remove section"
                      >
                        <Icon name="Trash2" className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={sec.required}
                        onCheckedChange={(v) => {
                          const sections = [...bpEditor.sections];
                          sections[idx] = { ...sec, required: v };
                          setBpEditor({ ...bpEditor, sections });
                        }}
                      />
                      <Label className="text-xs text-muted-foreground">Required section</Label>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Hints (one per line)</Label>
                      <Textarea
                        value={(sec.hints || []).join("\n")}
                        onChange={(e) => {
                          const sections = [...bpEditor.sections];
                          sections[idx] = { ...sec, hints: e.target.value.split("\n") };
                          setBpEditor({ ...bpEditor, sections });
                        }}
                        rows={2}
                        className="mt-1 text-xs"
                        placeholder={"Max 80 words\nFocus on guest relations"}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBpEditor(null)}>Cancel</Button>
            <Button onClick={saveBlueprintEditor} className="bg-brand hover:bg-brand-dark text-white gap-2">
              <Icon name="Check" className="w-4 h-4" /> Save blueprint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PAGE FORMAT */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Icon name="FileText" className="w-4 h-4 text-brand" /> Page Format</CardTitle>
          <CardDescription>Page size and margins (in millimeters). These control the physical layout of the exported PDF.</CardDescription>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="pageSize">Page Size</Label>
            <select
              id="pageSize"
              value={draft.pageSize}
              onChange={(e) => patch({ pageSize: e.target.value as "A4" | "Letter" })}
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm mt-1"
            >
              <option value="A4">A4 (210 × 297 mm)</option>
              <option value="Letter">Letter (216 × 279 mm)</option>
            </select>
          </div>
          <NumberField label="Top Margin (mm)" value={draft.marginTopMm} onChange={(v) => patch({ marginTopMm: v })} step={0.1} min={0} max={50} />
          <NumberField label="Bottom Margin (mm)" value={draft.marginBottomMm} onChange={(v) => patch({ marginBottomMm: v })} step={0.1} min={0} max={50} />
          <NumberField label="Left Margin (mm)" value={draft.marginLeftMm} onChange={(v) => patch({ marginLeftMm: v })} step={0.1} min={0} max={50} />
          <NumberField label="Right Margin (mm)" value={draft.marginRightMm} onChange={(v) => patch({ marginRightMm: v })} step={0.1} min={0} max={50} />
        </CardContent>
      </Card>

      {/* FONTS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Icon name="Type" className="w-4 h-4 text-brand" /> Fonts</CardTitle>
          <CardDescription>Font family and sizes (in points). The AI uses these to control text hierarchy.</CardDescription>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="fontFamily">Font Family</Label>
            <Input id="fontFamily" value={draft.fontFamily} onChange={(e) => patch({ fontFamily: e.target.value })} className="mt-1" placeholder="Times New Roman" />
          </div>
          <NumberField label="Body Font Size (pt)" value={draft.bodyFontSizePt} onChange={(v) => patch({ bodyFontSizePt: v })} step={0.5} min={8} max={14} />
          <NumberField label="Section Title Size (pt)" value={draft.sectionTitleSizePt} onChange={(v) => patch({ sectionTitleSizePt: v })} step={0.5} min={10} max={16} />
          <NumberField label="Name Size (pt)" value={draft.nameSizePt} onChange={(v) => patch({ nameSizePt: v })} step={0.5} min={12} max={20} />
        </CardContent>
      </Card>

      {/* COLORS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Icon name="Palette" className="w-4 h-4 text-brand" /> Colors</CardTitle>
          <CardDescription>Hex color codes for the candidate name, section headers, and body text.</CardDescription>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-3 gap-4">
          <ColorField label="Name Color" value={draft.nameColor} onChange={(v) => patch({ nameColor: v })} />
          <ColorField label="Section Title Color" value={draft.sectionTitleColor} onChange={(v) => patch({ sectionTitleColor: v })} />
          <ColorField label="Body Text Color" value={draft.bodyTextColor} onChange={(v) => patch({ bodyTextColor: v })} />
        </CardContent>
      </Card>

      {/* SPACING */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Icon name="MoveVertical" className="w-4 h-4 text-brand" /> Spacing</CardTitle>
          <CardDescription>Line height, section gaps, and bullet indentation. Tighter spacing = more content per page.</CardDescription>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-3 gap-4">
          <NumberField label="Line Height (CSS)" value={draft.lineHeight} onChange={(v) => patch({ lineHeight: v })} step={0.05} min={1} max={2} />
          <NumberField label="Section Gap (mm)" value={draft.sectionGapMm} onChange={(v) => patch({ sectionGapMm: v })} step={0.5} min={0} max={20} />
          <NumberField label="Bullet Indent (mm)" value={draft.bulletIndentMm} onChange={(v) => patch({ bulletIndentMm: v })} step={0.5} min={0} max={15} />
        </CardContent>
      </Card>

      {/* TEXT ALIGNMENT */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Icon name="AlignJustify" className="w-4 h-4 text-brand" /> Text Alignment</CardTitle>
          <CardDescription>Body text alignment for the whole resume, with optional per-section overrides. Applied by Preview, PDF, DOCX and DOC exports.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="bodyAlignment">Whole resume body</Label>
            <select
              id="bodyAlignment"
              value={draft.bodyAlignment ?? "justify"}
              onChange={(e) => patch({ bodyAlignment: e.target.value as TextAlignment })}
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm mt-1"
            >
              <option value="left">Left</option>
              <option value="justify">Justify (straight right edge)</option>
              <option value="center">Center</option>
            </select>
          </div>
          <div>
            <Label>Per-section overrides</Label>
            <p className="text-xs text-muted-foreground mb-2">Inherit = follow the whole-resume setting above.</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ALIGNMENT_SECTIONS.map(({ key, label }) => (
                <div key={key}>
                  <Label>{label}</Label>
                  <select
                    value={draft.sectionAlignment?.[key] ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      const next: Partial<Record<RenderSectionType, TextAlignment>> = { ...(draft.sectionAlignment ?? {}) };
                      if (v) next[key] = v as TextAlignment;
                      else delete next[key];
                      patch({ sectionAlignment: next });
                    }}
                    className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm mt-1"
                  >
                    <option value="">Inherit</option>
                    <option value="left">Left</option>
                    <option value="justify">Justify</option>
                    <option value="center">Center</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PHOTO */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Icon name="Image" className="w-4 h-4 text-brand" /> Photo</CardTitle>
          <CardDescription>Configure the passport-style photo in the header. If disabled, the photo section is removed entirely.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Photo Enabled</Label>
              <p className="text-xs text-muted-foreground">Show the photo frame in the header</p>
            </div>
            <Switch checked={draft.photoEnabled} onCheckedChange={(v) => patch({ photoEnabled: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Show Placeholder if No Photo</Label>
              <p className="text-xs text-muted-foreground">If false, the photo section is removed entirely when no photo is uploaded</p>
            </div>
            <Switch checked={draft.showPlaceholderIfNoPhoto} onCheckedChange={(v) => patch({ showPlaceholderIfNoPhoto: v })} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <NumberField label="Photo Width (mm)" value={draft.photoWidthMm} onChange={(v) => patch({ photoWidthMm: v })} step={1} min={10} max={80} />
            <NumberField label="Photo Height (mm)" value={draft.photoHeightMm} onChange={(v) => patch({ photoHeightMm: v })} step={1} min={15} max={100} />
          </div>
        </CardContent>
      </Card>

      {/* CONTENT LIMITS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Icon name="ListChecks" className="w-4 h-4 text-brand" /> Content Limits</CardTitle>
          <CardDescription>Control how much content the AI generates per section. Lower values = tighter one-page fit.</CardDescription>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <NumberField label="Summary Min Words" value={draft.summaryMinWords} onChange={(v) => patch({ summaryMinWords: v })} step={5} min={20} max={150} />
          <NumberField label="Summary Max Words" value={draft.summaryMaxWords} onChange={(v) => patch({ summaryMaxWords: v })} step={5} min={40} max={200} />
          <NumberField label="Max Skill Groups" value={draft.skillsMaxGroups} onChange={(v) => patch({ skillsMaxGroups: v })} step={1} min={2} max={8} />
          <NumberField label="Max Experience Entries" value={draft.experienceMaxEntries} onChange={(v) => patch({ experienceMaxEntries: v })} step={1} min={1} max={8} />
          <NumberField label="Bullets per Experience" value={draft.experienceBulletsPerEntry} onChange={(v) => patch({ experienceBulletsPerEntry: v })} step={1} min={2} max={8} />
          <NumberField label="Max Education Entries" value={draft.educationMaxEntries} onChange={(v) => patch({ educationMaxEntries: v })} step={1} min={1} max={5} />
          <NumberField label="Max Language Entries" value={draft.languagesMaxEntries} onChange={(v) => patch({ languagesMaxEntries: v })} step={1} min={1} max={8} />
        </CardContent>
      </Card>

      {/* ONE-PAGE ENFORCEMENT */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Icon name="FileCheck" className="w-4 h-4 text-brand" /> One-Page Enforcement</CardTitle>
          <CardDescription>Enforce that the resume fits on exactly one page. The AI will compress content rather than splitting.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enforce One Page</Label>
              <p className="text-xs text-muted-foreground">assert(pdf.pages === 1) — never generate a second page</p>
            </div>
            <Switch checked={draft.enforceOnePage} onCheckedChange={(v) => patch({ enforceOnePage: v })} />
          </div>
          <NumberField label="Minimum Font Size (pt)" value={draft.minFontSizePt} onChange={(v) => patch({ minFontSizePt: v })} step={0.5} min={8} max={12} />
          <p className="text-xs text-muted-foreground">The AI will never reduce the font size below this value when compressing content.</p>
        </CardContent>
      </Card>

      {/* CUSTOM DIRECTIVE OVERRIDE (ADVANCED) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Icon name="Code" className="w-4 h-4 text-brand" /> Custom Directive Override
            <Badge variant="outline" className="text-[10px] ml-2">Advanced</Badge>
          </CardTitle>
          <CardDescription>
            If non-empty, this COMPLETELY REPLACES the auto-generated directive text sent to the AI. Use this for advanced fine-tuning that the structured fields above can't express. Leave empty to use the auto-generated directive from the fields above.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={draft.customDirectiveOverride}
            onChange={(e) => patch({ customDirectiveOverride: e.target.value })}
            rows={10}
            placeholder="Leave empty to use the auto-generated directive from the fields above. Or paste a custom directive here to override everything..."
            className="font-mono text-xs"
          />
          <div className="flex items-center gap-2">
            <Badge variant={draft.customDirectiveOverride.trim() ? "brand" : "outline"} className="text-[10px]">
              {draft.customDirectiveOverride.trim() ? "OVERRIDE ACTIVE" : "Auto-generated (from fields above)"}
            </Badge>
            {draft.customDirectiveOverride.trim() && (
              <Button size="sm" variant="ghost" onClick={() => patch({ customDirectiveOverride: "" })} className="text-destructive">
                Clear override (use fields)
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* PER-AGENT DIRECTIVES */}
      <AgentDirectivesSection draft={draft} patch={patch} />

      {/* TONE & WRITING STYLE */}
      <ToneWritingSection draft={draft} patch={patch} />

      {/* PAGE LAYOUT & SECTIONS ORDER */}
      <LayoutStructureSection draft={draft} patch={patch} />

      {/* CUSTOM SECTION-LEVEL INSTRUCTIONS */}
      <CustomSectionInstructionsSection draft={draft} patch={patch} />

      {/* CUSTOM KEYWORD CONTROLS */}
      <CustomKeywordsSection draft={draft} patch={patch} />

      {/* TARGET ATS SYSTEM */}
      <TargetATSSection draft={draft} patch={patch} />

      {/* DIRECTIVE EXPORT / IMPORT */}
      <DirectiveExportImportSection draft={draft} setDraft={setDraft} setDirty={setDirty} />

      {/* Live Page Density Balance visualizer */}
      <PageDensityVisualizer draft={draft} />

      {/* Live preview of generated directive */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Icon name="Eye" className="w-4 h-4 text-brand" /> Generated Directive Preview</CardTitle>
          <CardDescription>This is the directive text that will be sent to the AI (read-only — edit the fields above to change it).</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-secondary/60 dark:bg-secondary/30 rounded-lg p-4 overflow-auto max-h-96 whitespace-pre-wrap font-mono">
{draft.customDirectiveOverride.trim() || generateDirectivePreview(draft)}
          </pre>
        </CardContent>
      </Card>

      {/* Save bar at bottom */}
      {dirty && (
        <div className="sticky bottom-4 z-10">
          <Card className="bg-brand text-white border-brand shadow-premium">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <span className="text-sm font-medium flex items-center gap-2">
                <Icon name="AlertTriangle" className="w-4 h-4" /> You have unsaved changes
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={discard} className="text-white hover:bg-white/10">Discard</Button>
                <Button size="sm" onClick={save} className="bg-white text-brand hover:bg-white/90 gap-2">
                  <Icon name="Save" className="w-4 h-4" /> Save directive
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// === Helper components ===

function NumberField({ label, value, onChange, step, min, max }: { label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) onChange(v);
        }}
        step={step}
        min={min}
        max={max}
        className="mt-1"
      />
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-2 mt-1 items-center">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-9 h-9 rounded-md border border-input cursor-pointer"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="flex-1 font-mono text-xs" placeholder="#000000" />
      </div>
    </div>
  );
}

// === Agent Directives Section ===

function AgentDirectivesSection({ draft, patch }: { draft: OptimizerDirectiveConfig; patch: (p: Partial<OptimizerDirectiveConfig>) => void }) {
  const updateAgent = <K extends keyof AgentDirectives>(key: K, value: Partial<AgentDirectives[K]>) => {
    patch({
      agentDirectives: {
        ...draft.agentDirectives,
        [key]: { ...draft.agentDirectives[key], ...value },
      },
    });
  };

  return (
    <>
      {/* Section header */}
      <div className="flex items-center gap-2 pt-4">
        <Icon name="Bot" className="w-5 h-5 text-brand" />
        <h2 className="font-display text-xl font-bold">Per-Agent Directives</h2>
        <Badge variant="outline" className="text-[10px] ml-2">New</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Configure what each agent in the multi-agent pipeline is allowed to do. These directives are injected into each agent's prompt and enforced by the Resume Structure Guardian.
      </p>

      {/* Supervisor Directive */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Icon name="Shield" className="w-4 h-4 text-brand" /> Supervisor Agent
          </CardTitle>
          <CardDescription>Controls orchestration, retries, provider switching, and strict mode enforcement.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <SwitchRow
            label="Strict Mode"
            description="Hard-fail on any critical issue (no graceful degradation). Returns REQUIRES_MANUAL_REVIEW."
            checked={draft.agentDirectives.supervisor.strictMode}
            onChange={(v) => updateAgent("supervisor", { strictMode: v })}
          />
          <SwitchRow
            label="Enable Retries"
            description="Retry failed optimization attempts (up to 4 attempts)."
            checked={draft.agentDirectives.supervisor.enableRetries}
            onChange={(v) => updateAgent("supervisor", { enableRetries: v })}
          />
          <SwitchRow
            label="Enable Provider Switch"
            description="Switch to next AI provider when current one fails or times out."
            checked={draft.agentDirectives.supervisor.enableProviderSwitch}
            onChange={(v) => updateAgent("supervisor", { enableProviderSwitch: v })}
          />
          <SwitchRow
            label="Enforce Immutable Entities"
            description="Post-optimization enforcement of company names, dates, education, languages."
            checked={draft.agentDirectives.supervisor.enforceImmutableEntities}
            onChange={(v) => updateAgent("supervisor", { enforceImmutableEntities: v })}
          />
          <SwitchRow
            label="Enable Debug Logs"
            description="Emit detailed console logs for each pipeline stage (source, optimizer input/output, assembler, guardian)."
            checked={draft.agentDirectives.supervisor.enableDebugLogs}
            onChange={(v) => updateAgent("supervisor", { enableDebugLogs: v })}
          />
          <SwitchRow
            label="Enable Diff Viewer"
            description="Show before/after diff viewer in the UI after optimization completes."
            checked={draft.agentDirectives.supervisor.enableDiffViewer}
            onChange={(v) => updateAgent("supervisor", { enableDiffViewer: v })}
          />
        </CardContent>
      </Card>

      {/* Summary Agent Directive */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Icon name="AlignLeft" className="w-4 h-4 text-brand" /> Summary Agent
          </CardTitle>
          <CardDescription>Controls professional summary rewriting and ATS keyword injection.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>ATS Aggressiveness</Label>
              <Badge variant="outline" className="text-[10px]">{draft.agentDirectives.summary.atsAggressiveness}/100</Badge>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={draft.agentDirectives.summary.atsAggressiveness}
              onChange={(e) => updateAgent("summary", { atsAggressiveness: parseInt(e.target.value) })}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {draft.agentDirectives.summary.atsAggressiveness < 30 ? "Minimal — only rephrase existing content" :
               draft.agentDirectives.summary.atsAggressiveness < 70 ? "Moderate — embed keywords naturally" :
               "Aggressive — maximize keyword density (risk of stuffing)"}
            </p>
          </div>
          <SwitchRow
            label="Preserve Facts"
            description="Never add facts (employers, locations, languages, education) not in source resume."
            checked={draft.agentDirectives.summary.preserveFacts}
            onChange={(v) => updateAgent("summary", { preserveFacts: v })}
          />
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Min Characters"
              value={draft.agentDirectives.summary.minCharacters}
              onChange={(v) => updateAgent("summary", { minCharacters: v })}
              step={50}
              min={100}
              max={1000}
            />
            <NumberField
              label="Max Characters"
              value={draft.agentDirectives.summary.maxCharacters}
              onChange={(v) => updateAgent("summary", { maxCharacters: v })}
              step={50}
              min={300}
              max={1500}
            />
          </div>
        </CardContent>
      </Card>

      {/* Skills Agent Directive */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Icon name="Tags" className="w-4 h-4 text-brand" /> Skills Agent
          </CardTitle>
          <CardDescription>Controls skills enrichment and forbidden keyword filtering.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <NumberField
            label="Max Keywords"
            value={draft.agentDirectives.skills.maxKeywords}
            onChange={(v) => updateAgent("skills", { maxKeywords: v })}
            step={1}
            min={5}
            max={30}
          />
          <SwitchRow
            label="Allow Transferable Skills"
            description="Add transferable skills that bridge gaps between candidate experience and JD requirements."
            checked={draft.agentDirectives.skills.allowTransferableSkills}
            onChange={(v) => updateAgent("skills", { allowTransferableSkills: v })}
          />
          <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3 space-y-2">
            <div
              className="flex items-center justify-between cursor-not-allowed"
              onClick={() => toast.info("Locked OFF — company names as skills trigger a Structure Guardian veto and stall optimization (Keyword-Guardian deadlock fix). Must stay OFF.", { duration: 6000 })}
              title="Locked OFF — company names as skills trigger a Structure Guardian veto and stall optimization."
            >
              <div>
                <Label className="text-red-800 dark:text-red-200 flex items-center gap-1.5">
                  <Icon name="Lock" className="w-3 h-3 shrink-0" /> Allow Company Keywords
                  <Badge variant="outline" className="text-[9px] px-1 py-0 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700">Locked</Badge>
                </Label>
                <p className="text-xs text-red-700 dark:text-red-300">FORBIDDEN — company names as skills (e.g., "Qatar Duty Free")</p>
              </div>
              <Switch
                checked={draft.agentDirectives.skills.allowCompanyKeywords}
                aria-disabled="true"
                onCheckedChange={() => toast.info("Locked OFF — company names as skills trigger a Structure Guardian veto and stall optimization (Keyword-Guardian deadlock fix). Must stay OFF.", { duration: 6000 })}
                className="cursor-not-allowed opacity-60"
              />
            </div>
            <div
              className="flex items-center justify-between cursor-not-allowed"
              onClick={() => toast.info("Locked OFF — location names as skills trigger a Structure Guardian veto and stall optimization (Keyword-Guardian deadlock fix). Must stay OFF.", { duration: 6000 })}
              title="Locked OFF — location names as skills trigger a Structure Guardian veto and stall optimization."
            >
              <div>
                <Label className="text-red-800 dark:text-red-200 flex items-center gap-1.5">
                  <Icon name="Lock" className="w-3 h-3 shrink-0" /> Allow Location Keywords
                  <Badge variant="outline" className="text-[9px] px-1 py-0 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700">Locked</Badge>
                </Label>
                <p className="text-xs text-red-700 dark:text-red-300">FORBIDDEN — location names as skills (e.g., "Doha", "Qatar")</p>
              </div>
              <Switch
                checked={draft.agentDirectives.skills.allowLocationKeywords}
                aria-disabled="true"
                onCheckedChange={() => toast.info("Locked OFF — location names as skills trigger a Structure Guardian veto and stall optimization (Keyword-Guardian deadlock fix). Must stay OFF.", { duration: 6000 })}
                className="cursor-not-allowed opacity-60"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Experience Agent Directive */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Icon name="Briefcase" className="w-4 h-4 text-brand" /> Experience Agent
          </CardTitle>
          <CardDescription>Controls bullet rewriting and immutable field protection.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SwitchRow
            label="Rewrite Bullets Only"
            description="Only rewrite bullet points. Never modify title, company, dates, or location."
            checked={draft.agentDirectives.experience.rewriteBulletsOnly}
            onChange={(v) => updateAgent("experience", { rewriteBulletsOnly: v })}
          />
          <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3 space-y-2">
            <p className="text-xs font-medium text-red-800 dark:text-red-200">Immutable Fields (FORBIDDEN to rewrite in locked pipeline):</p>
            <div className="grid grid-cols-2 gap-2">
              <ImmutableSwitch
                label="Rewrite Title"
                checked={draft.agentDirectives.experience.rewriteTitle}
                lockReason="Locked OFF — the locked pipeline forbids rewriting job titles; only bullet text may change. This protects employers, dates and places from AI fabrication."
              />
              <ImmutableSwitch
                label="Rewrite Company"
                checked={draft.agentDirectives.experience.rewriteCompany}
                lockReason="Locked OFF — the locked pipeline forbids rewriting company names; only bullet text may change. This protects employers, dates and places from AI fabrication."
              />
              <ImmutableSwitch
                label="Rewrite Dates"
                checked={draft.agentDirectives.experience.rewriteDates}
                lockReason="Locked OFF — the locked pipeline forbids rewriting employment dates; only bullet text may change. This protects employers, dates and places from AI fabrication."
              />
              <ImmutableSwitch
                label="Rewrite Location"
                checked={draft.agentDirectives.experience.rewriteLocation}
                lockReason="Locked OFF — the locked pipeline forbids rewriting job locations; only bullet text may change. This protects employers, dates and places from AI fabrication."
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Max Expansion</Label>
              <Badge variant="outline" className="text-[10px]">{draft.agentDirectives.experience.maxExpansionPercent}%</Badge>
            </div>
            <input
              type="range"
              min={0}
              max={50}
              step={5}
              value={draft.agentDirectives.experience.maxExpansionPercent}
              onChange={(e) => updateAgent("experience", { maxExpansionPercent: parseInt(e.target.value) })}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Maximum percentage by which bullets can expand vs original length. 0% = same length, 50% = allow 50% longer.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Education Agent Directive */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Icon name="GraduationCap" className="w-4 h-4 text-brand" /> Education Agent
          </CardTitle>
          <CardDescription>Formatting only — no inference or additions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <SwitchRow
            label="Format Only"
            description="Only format education entries. Never add, remove, or infer education."
            checked={draft.agentDirectives.education.formatOnly}
            onChange={(v) => updateAgent("education", { formatOnly: v })}
          />
          <SwitchRow
            label="Strip Section Headers"
            description="Remove section-header keywords (e.g. KEY COMPETENCIES, SKILLS) from education degree, institution, field, and highlights fields."
            checked={draft.agentDirectives.education.stripSectionHeaders}
            onChange={(v) => updateAgent("education", { stripSectionHeaders: v })}
          />
        </CardContent>
      </Card>

      {/* Languages Agent Directive */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Icon name="Languages" className="w-4 h-4 text-brand" /> Languages Agent
          </CardTitle>
          <CardDescription>Formatting only — no inference or additions.</CardDescription>
        </CardHeader>
        <CardContent>
          <SwitchRow
            label="Format Only"
            description="Only format language entries. Never add, remove, or infer languages."
            checked={draft.agentDirectives.languages.formatOnly}
            onChange={(v) => updateAgent("languages", { formatOnly: v })}
          />
        </CardContent>
      </Card>

      {/* Additional Information Agent Directive */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Icon name="FileText" className="w-4 h-4 text-brand" /> Additional Information Agent
          </CardTitle>
          <CardDescription>Preserve and improve the Additional Information section.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <SwitchRow
            label="Preserve Section"
            description="Keep the Additional Information section intact. Never remove or replace it."
            checked={draft.agentDirectives.additionalInfo.preserveSection}
            onChange={(v) => updateAgent("additionalInfo", { preserveSection: v })}
          />
          <SwitchRow
            label="Improve Wording"
            description="Improve wording and formatting while preserving all original facts."
            checked={draft.agentDirectives.additionalInfo.improveWording}
            onChange={(v) => updateAgent("additionalInfo", { improveWording: v })}
          />
          <SwitchRow
            label="Strip Section Headers"
            description="Remove section-header keywords (e.g. KEY COMPETENCIES, SKILLS) that leaked into the Additional Information section."
            checked={draft.agentDirectives.additionalInfo.stripSectionHeaders}
            onChange={(v) => updateAgent("additionalInfo", { stripSectionHeaders: v })}
          />
        </CardContent>
      </Card>

      {/* Headline Agent Directive */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Icon name="Heading" className="w-4 h-4 text-brand" /> Headline Agent
          </CardTitle>
          <CardDescription>Controls the professional headline/title below the candidate's name.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SwitchRow
            label="Rewrite Headline"
            description="Allow the AI to rewrite or optimize the professional title based on target job description."
            checked={draft.agentDirectives.headline?.rewriteHeadline ?? false}
            onChange={(v) => updateAgent("headline", { rewriteHeadline: v })}
          />
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="headlineTone">Headline Alignment Strategy</Label>
              <select
                id="headlineTone"
                value={draft.agentDirectives.headline?.headlineTone ?? "preserve"}
                onChange={(e) => updateAgent("headline", { headlineTone: e.target.value as any })}
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm mt-1"
              >
                <option value="preserve">Preserve Original Title</option>
                <option value="exact-title-match">Exact JD Title Match</option>
                <option value="seniority-adjusted">Seniority-Adjusted Match</option>
                <option value="jd-aligned">JD Contextual Alignment</option>
              </select>
            </div>
            <NumberField
              label="Max Headline Length (Chars)"
              value={draft.agentDirectives.headline?.maxHeadlineChars ?? 80}
              onChange={(v) => updateAgent("headline", { maxHeadlineChars: v })}
              step={5}
              min={20}
              max={200}
            />
          </div>
        </CardContent>
      </Card>

      {/* Certifications Agent Directive */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Icon name="Award" className="w-4 h-4 text-brand" /> Certifications Agent
          </CardTitle>
          <CardDescription>Configure credentials formatting, limits, and expiration rules.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SwitchRow
            label="Format Only"
            description="Format existing certifications without suggesting new ones or deleting credentials."
            checked={draft.agentDirectives.certifications?.formatOnly ?? true}
            onChange={(v) => updateAgent("certifications", { formatOnly: v })}
          />
          <SwitchRow
            label="Strip Expired Certs"
            description="Automatically hide or filter out credentials older than the configured threshold."
            checked={draft.agentDirectives.certifications?.stripExpiredCerts ?? false}
            onChange={(v) => updateAgent("certifications", { stripExpiredCerts: v })}
          />
          <div className="grid sm:grid-cols-2 gap-4">
            <NumberField
              label="Max Cert Age (Years, 0 = no limit)"
              value={draft.agentDirectives.certifications?.maxCertAgeYears ?? 0}
              onChange={(v) => updateAgent("certifications", { maxCertAgeYears: v })}
              step={1}
              min={0}
              max={30}
            />
            <NumberField
              label="Max Certification Entries"
              value={draft.agentDirectives.certifications?.maxCertEntries ?? 5}
              onChange={(v) => updateAgent("certifications", { maxCertEntries: v })}
              step={1}
              min={1}
              max={20}
            />
          </div>
        </CardContent>
      </Card>

      {/* Guardian Agent Directive */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Icon name="ShieldCheck" className="w-4 h-4 text-brand" /> Guardian Agent
          </CardTitle>
          <CardDescription>Controls final validation sensitivity. Configure which checks trigger VETO (block export) vs warning (allow with notice).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <SwitchRow
            label="Enforce Entity Integrity"
            description="VETO on any company/school/language mismatch between original and optimized."
            checked={draft.agentDirectives.guardian.enforceEntityIntegrity}
            onChange={(v) => updateAgent("guardian", { enforceEntityIntegrity: v })}
          />
          <SwitchRow
            label="Enforce Page Utilization"
            description="VETO when page usage is below 85% (disabling makes it advisory-only)."
            checked={draft.agentDirectives.guardian.enforcePageUtilization}
            onChange={(v) => updateAgent("guardian", { enforcePageUtilization: v })}
          />
          <SwitchRow
            label="Enforce Content Length"
            description="VETO when total resume content is below minimum character threshold."
            checked={draft.agentDirectives.guardian.enforceContentLength}
            onChange={(v) => updateAgent("guardian", { enforceContentLength: v })}
          />
          <SwitchRow
            label="Enforce No Duplicates"
            description="VETO when duplicate sentences are detected in the optimized resume."
            checked={draft.agentDirectives.guardian.enforceNoDuplicates}
            onChange={(v) => updateAgent("guardian", { enforceNoDuplicates: v })}
          />
          <SwitchRow
            label="Enforce Summary Quality"
            description="VETO when summary is too short or generic (below word count target)."
            checked={draft.agentDirectives.guardian.enforceSummaryQuality}
            onChange={(v) => updateAgent("guardian", { enforceSummaryQuality: v })}
          />
          <NumberField
            label="Minimum Guardian Score"
            value={draft.agentDirectives.guardian.minimumScore}
            onChange={(v) => updateAgent("guardian", { minimumScore: v })}
            step={5}
            min={50}
            max={100}
          />
        </CardContent>
      </Card>

      {/* ===== COMPLIANCE ENFORCEMENT ENGINE ===== */}
      <Card className="border-rose-200 dark:border-rose-900">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Icon name="ShieldAlert" className="w-4 h-4 text-rose-500" /> Compliance Enforcement Engine
          </CardTitle>
          <CardDescription>
            Forces ALL agents to obey the directive. When enabled, outputs below the compliance threshold are rejected and retried. 
            Only disable specific rules if you understand the consequences.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Directive version + hash */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-3 rounded-lg bg-muted/30 border border-border">
              <Label className="text-xs text-muted-foreground">DIRECTIVE VERSION</Label>
              <p className="text-lg font-bold font-mono mt-1">{draft.directiveVersion || 1}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border border-border">
              <Label className="text-xs text-muted-foreground">DIRECTIVE HASH</Label>
              <p className="text-xs font-mono mt-1 truncate text-muted-foreground">
                {draft.directiveHash || "Auto-generated on save"}
              </p>
            </div>
          </div>

          {/* Global compliance threshold */}
          <div>
            <Label htmlFor="complianceThreshold">
              Compliance Threshold: <span className="font-bold">{draft.complianceThreshold ?? 100}%</span>
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Minimum compliance score required to accept an agent's output. Set to 100% for strict enforcement.
            </p>
            <input
              id="complianceThreshold"
              type="range"
              min={50}
              max={100}
              step={5}
              value={draft.complianceThreshold ?? 100}
              onChange={(e) => patch({ complianceThreshold: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* Global enforcement toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SwitchRow
              label="Enforce on ALL Agents"
              description="When ON, every agent (Summary, Skills, Experience, Education, Languages, QA, Guardian) must pass compliance individually. When OFF, only Supervisor checks."
              checked={draft.enforceComplianceOnAllAgents ?? true}
              onChange={(v) => patch({ enforceComplianceOnAllAgents: v })}
            />
            <SwitchRow
              label="Force Directive on Retry"
              description="When ON, failed agents receive the directive re-injected as 'SYSTEM POLICY — UPPER CASE, NO EXCEPTIONS' at the very top of their prompt on retry."
              checked={draft.forceDirectiveOnRetry ?? true}
              onChange={(v) => patch({ forceDirectiveOnRetry: v })}
            />
            <SwitchRow
              label="Strict Agent Lock"
              description="When ON, agents CANNOT deviate from directive rules under any circumstances. No creative interpretation allowed."
              checked={draft.strictAgentLock ?? true}
              onChange={(v) => patch({ strictAgentLock: v })}
            />
          </div>

          {/* Per-rule compliance toggles */}
          <div>
            <Label className="text-sm font-semibold mb-2 block">Per-Rule Compliance Checks</Label>
            <p className="text-xs text-muted-foreground mb-3">
              Toggle individual compliance rules on/off. Disabling a rule means it won't be checked during optimization.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {([
                ["entityPreservation", "Entity Pres.", "✓ entities match original"],
                ["sectionOrder", "Section Order", "✓ order follows blueprint"],
                ["immutableFields", "Immutable Fields", "✓ name/phone/email/schools"],
                ["hallucinationCheck", "No Hallucination", "✓ no fabricated content"],
                ["summaryLength", "Summary Length", "✓ within word count"],
                ["skillGrouping", "Skill Grouping", "✓ grouped by category"],
                ["chronology", "Chronology", "✓ dates in correct order"],
                ["pageCount", "Single Page", "✓ one page only"],
                ["bulletCount", "Bullet Count", "✓ bullets preserved"],
                ["languageSeparation", "Lang. Separate", "✓ not in skills"],
              ] as const).map(([key, label, desc]) => {
                const k = key as keyof typeof draft.complianceRules;
                return (
                  <div
                    key={key}
                    className={`relative flex flex-col gap-1 p-2.5 rounded-lg border transition-all cursor-pointer ${
                      draft.complianceRules?.[k]
                        ? "border-brand/40 bg-brand/5"
                        : "border-border bg-background opacity-60"
                    }`}
                    onClick={() => {
                      const rules = { ...draft.complianceRules, [k]: !draft.complianceRules?.[k] };
                      patch({ complianceRules: rules as typeof draft.complianceRules });
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">{label}</span>
                      <div className={`w-2 h-2 rounded-full ${draft.complianceRules?.[k] ? "bg-green-500" : "bg-muted-foreground"}`} />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{desc}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Force Directive button */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
            <div>
              <Label className="text-sm font-semibold text-rose-700 dark:text-rose-300">Force Directive Reset</Label>
              <p className="text-xs text-muted-foreground">
                Immediately re-injects the current directive into ALL active agent sessions, overriding any cached or stale directives.
              </p>
            </div>
            <Button
              variant="outline"
              className="border-rose-300 text-rose-700 hover:bg-rose-100 dark:hover:bg-rose-900 gap-2"
              onClick={async () => {
                const newVersion = (draft.directiveVersion || 0) + 1;
                const hashStr = Array.from(
                  new TextEncoder().encode(JSON.stringify(draft))
                ).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
                patch({ directiveVersion: newVersion, directiveHash: hashStr });
                toast.success("Directive forced — version bumped to v" + newVersion);
              }}
            >
              <Icon name="AlertTriangle" className="w-4 h-4" /> Force Directive
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function SwitchRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <Label>{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

// Locked invariant switch — intentionally NON-toggleable. These flags must stay
// OFF (entity integrity + Keyword-Guardian deadlock fix d29cde78). Rendered as
// a locked control that explains itself on click instead of a dead switch.
function ImmutableSwitch({ label, checked, lockReason }: { label: string; checked: boolean; lockReason: string }) {
  const explain = () => toast.info(lockReason, { duration: 6000 });
  return (
    <div
      className="flex items-center justify-between bg-white dark:bg-secondary/30 rounded-md p-2 border border-red-100 dark:border-red-900/50 cursor-not-allowed"
      onClick={explain}
      title={lockReason}
    >
      <Label className="text-xs text-red-800 dark:text-red-200 flex items-center gap-1.5">
        <Icon name="Lock" className="w-3 h-3 shrink-0" /> {label}
        <Badge variant="outline" className="text-[9px] px-1 py-0 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700">Locked</Badge>
      </Label>
      <Switch checked={checked} aria-disabled="true" onCheckedChange={explain} className="cursor-not-allowed opacity-60" />
    </div>
  );
}

// === Directive preview generator (mirrors the logic in ai.ts) ===

function generateDirectivePreview(c: OptimizerDirectiveConfig): string {
  const toneDesc = c.toneConfig ? `
═══════════════════════════════════════════════════════════════
TONE & WRITING STYLE
═══════════════════════════════════════════════════════════════
- Profile tone: ${c.toneConfig.tone}
- Verb tense (experience): ${c.toneConfig.bulletVerbTense}
- Enforce power verbs: ${c.toneConfig.enforcePowerVerbs ? "YES" : "NO"}
- Avoid filler phrases: ${c.toneConfig.avoidFillerPhrases ? "YES (avoid 'responsible for', 'helped with', etc.)" : "NO"}
- Require quantified metrics: ${c.toneConfig.requireQuantification ? "YES (min 1 metric per entry)" : "NO"}
- Avoid passive voice: ${c.toneConfig.avoidPassiveVoice ? "YES" : "NO"}` : "";

  const keywordsDesc = c.customKeywords ? `
═══════════════════════════════════════════════════════════════
CUSTOM KEYWORDS
═══════════════════════════════════════════════════════════════
- Forbidden terms: ${c.customKeywords.forbiddenKeywords.length > 0 ? c.customKeywords.forbiddenKeywords.join(", ") : "None"}
- Required terms: ${c.customKeywords.requiredKeywords.length > 0 ? c.customKeywords.requiredKeywords.join(", ") : "None"}
- Keyword placement priority: ${c.customKeywords.keywordPlacement}
- Max keyword density: ${c.customKeywords.maxKeywordDensityPercent > 0 ? `${c.customKeywords.maxKeywordDensityPercent}%` : "No limit"}` : "";

  const targetAtsDesc = c.targetAtsSystem && c.targetAtsSystem !== "generic" ? `
═══════════════════════════════════════════════════════════════
TARGET ATS PLATFORM
═══════════════════════════════════════════════════════════════
- Optimize for compatibility with: ${c.targetAtsSystem.toUpperCase()}` : "";

  return `You are the ResumeAI Pro Optimizer. You MUST preserve the EXACT layout framework described below.

═══════════════════════════════════════════════════════════════
PAGE FORMAT
═══════════════════════════════════════════════════════════════
- Document size: ${c.pageSize}
- Maximum pages: 1
- Required pages: EXACTLY 1
- NEVER generate a second page.
${c.enforceOnePage ? "- Validation: assert(pdf.pages === 1)" : ""}
${targetAtsDesc}

═══════════════════════════════════════════════════════════════
MARGINS (very compact)
═══════════════════════════════════════════════════════════════
- Top: ${c.marginTopMm}mm
- Bottom: ${c.marginBottomMm}mm
- Left: ${c.marginLeftMm}mm
- Right: ${c.marginRightMm}mm

═══════════════════════════════════════════════════════════════
FONT RULES
═══════════════════════════════════════════════════════════════
- Primary font: ${c.fontFamily}
- Body size: ${c.bodyFontSizePt}pt
- Section titles: ${c.sectionTitleSizePt}pt, BOLD, UPPERCASE, color ${c.sectionTitleColor}
- Name: BOLD, ${c.nameSizePt}pt, color ${c.nameColor}, UPPERCASE
- Body text: color ${c.bodyTextColor}

═══════════════════════════════════════════════════════════════
SPACING
═══════════════════════════════════════════════════════════════
- Line height: ${c.lineHeight}
- Section gap: ${c.sectionGapMm}mm
- Bullet indent: ${c.bulletIndentMm}mm

═══════════════════════════════════════════════════════════════
PHOTO
═══════════════════════════════════════════════════════════════
${c.photoEnabled ? `- Photo: ${c.photoWidthMm}×${c.photoHeightMm}mm, top-right corner
- ${c.showPlaceholderIfNoPhoto ? "Show empty placeholder if no photo uploaded" : "If no photo exists, remove photo section entirely. Do NOT use placeholders."}` : "- Photo section DISABLED. Do not include any photo."}

═══════════════════════════════════════════════════════════════
CONTENT LIMITS
═══════════════════════════════════════════════════════════════
- Summary: ${c.summaryMinWords}-${c.summaryMaxWords} words, single paragraph, no bullets
- Skills: max ${c.skillsMaxGroups} groups
- Experience: max ${c.experienceMaxEntries} entries, ${c.experienceBulletsPerEntry} bullets each
- Education: max ${c.educationMaxEntries} entries
- Languages: max ${c.languagesMaxEntries} entries
${toneDesc}
${keywordsDesc}

═══════════════════════════════════════════════════════════════
ONE-PAGE COMPRESSION
═══════════════════════════════════════════════════════════════
${c.enforceOnePage ? `If content exceeds one page, apply IN THIS ORDER:
1. Compress summary
2. Reduce bullet length
3. Remove repetitive achievements
4. Reduce spacing
5. Reduce font size to MINIMUM ${c.minFontSizePt}pt
6. Merge similar skills
NEVER create page two. assert(pdf.pages === 1).` : "Multi-page output allowed if content exceeds one page."}

${c.agentDirectives ? `
═══════════════════════════════════════════════════════════════
AGENT RULES (MANDATORY)
═══════════════════════════════════════════════════════════════
Summary: ${c.summaryMinWords}-${c.summaryMaxWords} words. ATS: ${c.agentDirectives.summary.atsAggressiveness}/100. No hallucinations. No parentheses.
Skills: Max ${c.skillsMaxGroups} groups. Never Targeted Keywords. No company/location names as skills.
Experience: ${c.agentDirectives.experience.rewriteBulletsOnly ? "Rewrite bullets ONLY." : ""} Role | Company | Date format. Preserve chronology.
Headline: Rewrite=${c.agentDirectives.headline?.rewriteHeadline ? "YES" : "NO"}. Strategy=${c.agentDirectives.headline?.headlineTone ?? "preserve"}. MaxChars=${c.agentDirectives.headline?.maxHeadlineChars ?? 80}.
Certifications: FormatOnly=${c.agentDirectives.certifications?.formatOnly ?? true}. Age limit=${c.agentDirectives.certifications?.maxCertAgeYears ?? 0} years. Max entries=${c.agentDirectives.certifications?.maxCertEntries ?? 5}.
Education: Diploma | School | Date format. Never remove schools.
Languages: Preserve all. Max ${c.languagesMaxEntries} entries.
Guardian: Min score ${c.agentDirectives.guardian.minimumScore}. VETO: entities=${c.agentDirectives.guardian.enforceEntityIntegrity}, duplicates=${c.agentDirectives.guardian.enforceNoDuplicates}.
` : ""}
`;
}

// === New configuration components added in P3 ===

function ToneWritingSection({ draft, patch }: { draft: OptimizerDirectiveConfig; patch: (p: Partial<OptimizerDirectiveConfig>) => void }) {
  const updateTone = (value: Partial<ToneWritingConfig>) => {
    patch({
      toneConfig: {
        ...draft.toneConfig,
        ...value,
      } as ToneWritingConfig,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Icon name="Smile" className="w-5 h-5 text-brand" /> Tone & Writing Style
        </CardTitle>
        <CardDescription>
          Configure the voice, grammatical tense, and style rules applied across all sections of the resume.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="writingTone">Resume Voice/Tone</Label>
            <select
              id="writingTone"
              value={draft.toneConfig?.tone ?? "confident"}
              onChange={(e) => updateTone({ tone: e.target.value as any })}
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm mt-1"
            >
              <option value="confident">Confident & Professional</option>
              <option value="formal">Formal & Corporate</option>
              <option value="action-driven">Action & Results-Driven</option>
              <option value="humble">Humble & Professional</option>
              <option value="technical">Highly Technical & Direct</option>
            </select>
          </div>
          <div>
            <Label htmlFor="bulletTense">Verb Tense (Experience Bullets)</Label>
            <select
              id="bulletTense"
              value={draft.toneConfig?.bulletVerbTense ?? "past-tense"}
              onChange={(e) => updateTone({ bulletVerbTense: e.target.value as any })}
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm mt-1"
            >
              <option value="past-tense">Past Tense (e.g. "Developed", "Managed")</option>
              <option value="present-tense">Present Tense (e.g. "Develop", "Manage")</option>
              <option value="auto">Auto (Match role active status)</option>
            </select>
          </div>
          <div>
            <Label htmlFor="experienceFormula">Experience Bullet Formula</Label>
            <select
              id="experienceFormula"
              value={draft.toneConfig?.experienceFormula ?? "auto"}
              onChange={(e) => updateTone({ experienceFormula: e.target.value as any })}
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm mt-1"
            >
              <option value="auto">Auto / Flexible (AI decides)</option>
              <option value="star">STAR Method (Situation, Task, Action, Result)</option>
              <option value="xyz">Google's XYZ Formula (Accomplished [X] by [Y] doing [Z])</option>
            </select>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <SwitchRow
            label="Enforce Power Verbs"
            description="Require every experience bullet point to start with a strong, active industry-recognized power verb."
            checked={draft.toneConfig?.enforcePowerVerbs ?? true}
            onChange={(v) => updateTone({ enforcePowerVerbs: v })}
          />
          <SwitchRow
            label="Avoid Filler Phrases"
            description="Ban passive and redundant phrases such as 'responsible for', 'duties included', 'helped with'."
            checked={draft.toneConfig?.avoidFillerPhrases ?? true}
            onChange={(v) => updateTone({ avoidFillerPhrases: v })}
          />
          <SwitchRow
            label="Avoid Passive Voice"
            description="Rewrite bullets constructed in passive voice into active voice (e.g., convert 'Led by me' to 'I led')."
            checked={draft.toneConfig?.avoidPassiveVoice ?? true}
            onChange={(v) => updateTone({ avoidPassiveVoice: v })}
          />
          <SwitchRow
            label="Require Quantification"
            description="Attempt to force numerical metric placeholders or metrics in every single experience entry."
            checked={draft.toneConfig?.requireQuantification ?? false}
            onChange={(v) => updateTone({ requireQuantification: v })}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function CustomKeywordsSection({ draft, patch }: { draft: OptimizerDirectiveConfig; patch: (p: Partial<OptimizerDirectiveConfig>) => void }) {
  const updateKeywords = (value: Partial<CustomKeywordsConfig>) => {
    patch({
      customKeywords: {
        ...draft.customKeywords,
        ...value,
      } as CustomKeywordsConfig,
    });
  };

  const parseKeywordsList = (text: string) => {
    return text.split(",").map((k) => k.trim()).filter(Boolean);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Icon name="Search" className="w-5 h-5 text-brand" /> Custom Keyword Controls
        </CardTitle>
        <CardDescription>
          Force the optimizer to include specific target keywords or absolutely avoid forbidden industry buzzwords.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="requiredKeywords">Required Keywords (comma separated)</Label>
          <Textarea
            id="requiredKeywords"
            placeholder="e.g. React Native, Project Management, Agile, ISO 13485"
            value={draft.customKeywords?.requiredKeywords?.join(", ") ?? ""}
            onChange={(e) => updateKeywords({ requiredKeywords: parseKeywordsList(e.target.value) })}
            rows={2}
            className="mt-1 font-mono text-xs"
          />
          <span className="text-[10px] text-muted-foreground">The optimizer will guarantee these terms are integrated into the content.</span>
        </div>

        <div>
          <Label htmlFor="forbiddenKeywords">Forbidden Keywords (comma separated)</Label>
          <Textarea
            id="forbiddenKeywords"
            placeholder="e.g. synergy, utilize, team player, go-getter"
            value={draft.customKeywords?.forbiddenKeywords?.join(", ") ?? ""}
            onChange={(e) => updateKeywords({ forbiddenKeywords: parseKeywordsList(e.target.value) })}
            rows={2}
            className="mt-1 font-mono text-xs"
          />
          <span className="text-[10px] text-muted-foreground">The optimizer will actively prune or replace these words if found.</span>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="keywordPlacement">Keyword Placement Priority</Label>
            <select
              id="keywordPlacement"
              value={draft.customKeywords?.keywordPlacement ?? "spread-evenly"}
              onChange={(e) => updateKeywords({ keywordPlacement: e.target.value as any })}
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm mt-1"
            >
              <option value="spread-evenly">Spread Evenly Across Sections</option>
              <option value="summary-first">Prioritize Summary Section</option>
              <option value="skills-first">Prioritize Skills Section</option>
            </select>
          </div>
          <NumberField
            label="Max Keyword Density (% per section, 0 = unlimited)"
            value={draft.customKeywords?.maxKeywordDensityPercent ?? 0}
            onChange={(v) => updateKeywords({ maxKeywordDensityPercent: v })}
            step={1}
            min={0}
            max={30}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function TargetATSSection({ draft, patch }: { draft: OptimizerDirectiveConfig; patch: (p: Partial<OptimizerDirectiveConfig>) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Icon name="Server" className="w-5 h-5 text-brand" /> Target ATS Platform
        </CardTitle>
        <CardDescription>
          Select the specific applicant tracking system used by the employer to customize layout and parsing heuristics.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Label htmlFor="targetAtsSelect">Employer ATS Platform</Label>
        <select
          id="targetAtsSelect"
          value={draft.targetAtsSystem ?? "generic"}
          onChange={(e) => patch({ targetAtsSystem: e.target.value as ATSSystemTarget })}
          className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm mt-1"
        >
          <option value="generic">Generic/Universal ATS Friendly</option>
          <option value="workday">Workday (Prefers strict table-free, standard margins)</option>
          <option value="taleo">Taleo (Prefers explicit section headers, simple lists)</option>
          <option value="greenhouse">Greenhouse (Excellent parsing, supports rich layouts)</option>
          <option value="icims">iCIMS (Requires clean headings, standard font sizes)</option>
          <option value="lever">Lever (Prefers raw text streams, clean typography)</option>
          <option value="successfactors">SAP SuccessFactors (Requires classic section ordering)</option>
          <option value="bamboohr">BambooHR (Prefers standard body sizing)</option>
          <option value="smartrecruiters">SmartRecruiters (Prefers bullet-only formats)</option>
        </select>
      </CardContent>
    </Card>
  );
}

function DirectiveExportImportSection({
  draft,
  setDraft,
  setDirty,
}: {
  draft: OptimizerDirectiveConfig;
  setDraft: React.Dispatch<React.SetStateAction<OptimizerDirectiveConfig>>;
  setDirty: (d: boolean) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(draft, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `optimizer-directive-v${draft.directiveVersion || 1}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success("Directive configuration exported successfully!");
    } catch (e) {
      toast.error("Failed to export directive configuration.");
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json && typeof json === "object" && "pageSize" in json && "agentDirectives" in json) {
          setDraft(json);
          setDirty(true);
          toast.success("Directive configuration imported! Review and click 'Save directive' to apply.");
        } else {
          toast.error("Invalid configuration file. Must be a valid OptimizerDirective JSON.");
        }
      } catch (err) {
        toast.error("Failed to parse JSON configuration file.");
      }
    };
    reader.readAsText(file);
    // Reset file input value
    e.target.value = "";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Icon name="RefreshCw" className="w-5 h-5 text-brand" /> Backup & Portability
        </CardTitle>
        <CardDescription>
          Export the current optimizer configuration to a JSON file or import a saved configuration to duplicate behaviors.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImportFileChange}
          accept=".json"
          className="hidden"
        />
        <Button onClick={handleExport} variant="outline" className="gap-2">
          <Icon name="Download" className="w-4 h-4" /> Export Config JSON
        </Button>
        <Button onClick={handleImportClick} variant="outline" className="gap-2">
          <Icon name="Upload" className="w-4 h-4" /> Import Config JSON
        </Button>
      </CardContent>
    </Card>
  );
}

function PageDensityVisualizer({ draft }: { draft: OptimizerDirectiveConfig }) {
  // A4 height is 297mm. Printable height = 297 - marginTop - marginBottom
  const pageHeightMm = draft.pageSize === "A4" ? 297 : 279;
  const printableHeightMm = pageHeightMm - (draft.marginTopMm || 15) - (draft.marginBottomMm || 15);
  
  // Estimate consumed height in mm
  let headerHeight = 35 + ((draft.nameSizePt || 24) - 24) * 0.4;
  let summaryHeight = ((draft.summaryMaxWords || 80) / 12) * 5 * (draft.lineHeight || 1.2) * ((draft.bodyFontSizePt || 10) / 10);
  let expHeight = (draft.experienceMaxEntries || 3) * (8 + (draft.experienceBulletsPerEntry || 3) * 5 * (draft.lineHeight || 1.2) * ((draft.bodyFontSizePt || 10) / 10));
  let eduHeight = (draft.educationMaxEntries || 2) * 7 * (draft.lineHeight || 1.2) * ((draft.bodyFontSizePt || 10) / 10);
  let skillsHeight = (draft.skillsMaxGroups || 3) * 6 * (draft.lineHeight || 1.2) * ((draft.bodyFontSizePt || 10) / 10);
  let totalSectionGaps = 4 * (draft.sectionGapMm || 5);
  
  let consumedHeight = headerHeight + summaryHeight + expHeight + eduHeight + skillsHeight + totalSectionGaps;
  const density = Math.round((consumedHeight / printableHeightMm) * 100);

  // Status mapping
  let statusText = "Optimal Single Page Fit";
  let statusColor = "text-emerald-600 dark:text-emerald-400";
  let progressColor = "bg-emerald-500";
  let warningText = "";

  if (density < 80) {
    statusText = "Sparse Layout";
    statusColor = "text-blue-500";
    progressColor = "bg-blue-500";
    warningText = "Your resume has too much empty space. Consider increasing font sizes, summary length, or margins to fill the page.";
  } else if (density > 100 && density <= 110) {
    statusText = "Potential Two-Page Spill";
    statusColor = "text-amber-500";
    progressColor = "bg-amber-500";
    warningText = "High risk of spilling onto page 2. Try reducing line height, body font size, or margins slightly to compress it.";
  } else if (density > 110) {
    statusText = "Definite Two-Page Overflow";
    statusColor = "text-red-500";
    progressColor = "bg-red-500";
    warningText = "Your content will overflow to a second page. If you want a strict one-page resume, apply compression or reduce entry counts.";
  }

  // Margin scaling for SVG page preview
  const scale = 0.6; // Scale A4 to fit the preview card
  const svgWidth = 210 * scale;
  const svgHeight = pageHeightMm * scale;
  
  const mt = (draft.marginTopMm || 15) * scale;
  const mb = (draft.marginBottomMm || 15) * scale;
  const ml = (draft.marginLeftMm || 15) * scale;
  const mr = (draft.marginRightMm || 15) * scale;
  
  // Calculate relative sizes for drawing
  const contentWidth = svgWidth - ml - mr;
  const contentHeight = svgHeight - mt - mb;
  
  const hH = Math.min(contentHeight * 0.15, headerHeight * scale);
  const sH = Math.min(contentHeight * 0.15, summaryHeight * scale);
  const eH = Math.min(contentHeight * 0.45, expHeight * scale);
  const edH = Math.min(contentHeight * 0.15, eduHeight * scale);
  const skH = Math.min(contentHeight * 0.1, skillsHeight * scale);
  const gap = totalSectionGaps * scale * 0.2;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Icon name="Gauge" className="w-5 h-5 text-brand" /> Page Density & Balance Simulator
        </CardTitle>
        <CardDescription>
          Visualize how font sizes, line heights, margins, and content limits affect A4/Letter page boundaries.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid md:grid-cols-3 gap-6">
        {/* Left/Middle Column: Gauge & Warnings */}
        <div className="md:col-span-2 space-y-4 flex flex-col justify-center">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Estimated Page Fill</span>
              <span className={`text-sm font-bold ${statusColor}`}>{density}% ({statusText})</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-3 overflow-hidden border">
              <div 
                className={`h-full transition-all duration-300 ${progressColor}`}
                style={{ width: `${Math.min(100, density)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs bg-muted/30 p-3 rounded-lg border">
            <div>
              <span className="text-muted-foreground block">Printable Height:</span>
              <span className="font-semibold text-foreground">{printableHeightMm.toFixed(0)}mm</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Content Height (Est):</span>
              <span className="font-semibold text-foreground">{consumedHeight.toFixed(0)}mm</span>
            </div>
            <div className="col-span-2 border-t pt-1.5 mt-1 text-[11px] text-muted-foreground leading-normal">
              {warningText ? (
                <p className="flex items-start gap-1.5 text-foreground/80">
                  <Icon name="Info" className="w-3.5 h-3.5 text-brand shrink-0 mt-0.5" />
                  {warningText}
                </p>
              ) : (
                <p className="text-emerald-700 dark:text-emerald-400 font-medium flex items-start gap-1.5">
                  <Icon name="CheckCircle2" className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  Your layout parameters are optimal! This resume will fit comfortably on a single page.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Stylized Live Page Render */}
        <div className="flex justify-center items-center">
          <div className="relative border border-border/80 shadow-premium rounded bg-white dark:bg-zinc-950 overflow-hidden flex flex-col items-center justify-center p-2" style={{ width: `${svgWidth + 16}px`, height: `${svgHeight + 16}px` }}>
            {/* SVG Page Representation */}
            <svg width={svgWidth} height={svgHeight} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              {/* Margins indicator (faint gray rect) */}
              <rect x={ml} y={mt} width={contentWidth} height={contentHeight} fill="none" stroke="#e4e4e7" strokeDasharray="2,2" strokeWidth="0.5" className="dark:stroke-zinc-800" />
              
              {/* Header Box (stylized lines) */}
              <rect x={ml + 5} y={mt + 2} width={contentWidth - 10} height={hH} fill="#1154a320" rx="1" />
              <line x1={ml + 10} y1={mt + 6} x2={ml + 35} y2={mt + 6} stroke="#1154a3" strokeWidth="2" />
              <line x1={ml + 10} y1={mt + 10} x2={ml + 50} y2={mt + 10} stroke="#71717a" strokeWidth="1" />

              {/* Summary Block */}
              <g transform={`translate(${ml}, ${mt + hH + gap})`}>
                <rect x="2" y="2" width={contentWidth - 4} height={sH} fill="#f4f4f5" className="dark:fill-zinc-800" rx="1" />
                <line x1="5" y1="6" x2={contentWidth - 10} y2="6" stroke="#d4d4d8" strokeWidth="1" className="dark:stroke-zinc-700" />
                <line x1="5" y1="10" x2={contentWidth - 25} y2="10" stroke="#d4d4d8" strokeWidth="1" className="dark:stroke-zinc-700" />
              </g>

              {/* Experience Block */}
              <g transform={`translate(${ml}, ${mt + hH + sH + gap * 2})`}>
                <rect x="2" y="2" width={contentWidth - 4} height={eH} fill="#f4f4f5" className="dark:fill-zinc-800" rx="1" />
                <line x1="5" y1="6" x2={contentWidth - 40} y2="6" stroke="#a1a1aa" strokeWidth="1.5" className="dark:stroke-zinc-600" />
                {Array.from({ length: Math.min(4, draft.experienceMaxEntries || 3) }).map((_, idx) => (
                  <g key={idx} transform={`translate(0, ${8 + idx * 12})`}>
                    <line x1="8" y1="4" x2={contentWidth - 15} y2="4" stroke="#e4e4e7" strokeWidth="1" className="dark:stroke-zinc-700" />
                    <line x1="8" y1="7" x2={contentWidth - 30} y2="7" stroke="#e4e4e7" strokeWidth="1" className="dark:stroke-zinc-700" />
                  </g>
                ))}
              </g>

              {/* Education Block */}
              <g transform={`translate(${ml}, ${mt + hH + sH + eH + gap * 3})`}>
                <rect x="2" y="2" width={contentWidth - 4} height={edH} fill="#f4f4f5" className="dark:fill-zinc-800" rx="1" />
                <line x1="5" y1="6" x2={contentWidth - 50} y2="6" stroke="#a1a1aa" strokeWidth="1.5" className="dark:stroke-zinc-600" />
              </g>

              {/* Skills Block */}
              <g transform={`translate(${ml}, ${mt + hH + sH + eH + edH + gap * 4})`}>
                <rect x="2" y="2" width={contentWidth - 4} height={skH} fill="#f4f4f5" className="dark:fill-zinc-800" rx="1" />
                <line x1="5" y1="4" x2={contentWidth - 20} y2="4" stroke="#a1a1aa" strokeWidth="1" className="dark:stroke-zinc-600" />
              </g>
            </svg>

            {/* Overflow Overlay warning indicator */}
            {density > 100 && (
              <div className="absolute inset-x-0 bottom-0 bg-red-500/90 text-white text-[9px] font-bold py-1 text-center backdrop-blur-xs flex items-center justify-center gap-1">
                <Icon name="AlertTriangle" className="w-3 h-3 animate-pulse" /> Page boundary spill!
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LayoutStructureSection({
  draft,
  patch,
}: {
  draft: OptimizerDirectiveConfig;
  patch: (p: Partial<OptimizerDirectiveConfig>) => void;
}) {
  const currentOrder = draft.sectionOrder ?? [
    "summary",
    "experience",
    "education",
    "skills",
    "languages",
    "projects",
    "certifications",
    "additionalInfo",
  ];

  const handleMoveSection = (index: number, direction: "up" | "down") => {
    const nextOrder = [...currentOrder];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex >= 0 && targetIndex < nextOrder.length) {
      const temp = nextOrder[index];
      nextOrder[index] = nextOrder[targetIndex];
      nextOrder[targetIndex] = temp;
      patch({ sectionOrder: nextOrder });
    }
  };

  const SECTION_METADATA: Record<string, { label: string; badge: string; desc: string }> = {
    summary: {
      label: "Professional Profile",
      badge: "SUMMARY",
      desc: "Summary paragraph / professional profile",
    },
    experience: {
      label: "Professional Experience",
      badge: "EXPERIENCE",
      desc: "Work history with job titles, companies, dates, and achievement bullets",
    },
    education: {
      label: "Education & Development",
      badge: "EDUCATION",
      desc: "Degrees, institutions, graduation dates, and coursework",
    },
    skills: {
      label: "Core Competencies & Skills",
      badge: "SKILLS",
      desc: "Categorized skills list with bullet points",
    },
    languages: {
      label: "Languages",
      badge: "LANGUAGES",
      desc: "Language proficiencies",
    },
    projects: {
      label: "Key Projects",
      badge: "PROJECTS",
      desc: "Projects with descriptions and tech stacks",
    },
    certifications: {
      label: "Certifications",
      badge: "CERTIFICATIONS",
      desc: "Licenses and certifications with issuing organizations",
    },
    additionalInfo: {
      label: "Additional Information",
      badge: "ADDITIONAL",
      desc: "Volunteer work, awards, publications, and other details",
    },
  };

  return (
    <div className="space-y-6">
      {/* SECTION ORDERING */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Icon name="ListOrdered" className="w-5 h-5 text-brand" /> Section Ordering (Drag to Reorder)
          </CardTitle>
          <CardDescription>
            Control the top-to-bottom sequence of sections on the resume. The AI will generate sections in this exact order, and all renderers (Preview, PDF, DOCX, DOC) will display them accordingly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="border border-input rounded-lg divide-y divide-border overflow-hidden bg-background">
            {currentOrder.map((sec, idx) => {
              const meta = SECTION_METADATA[sec] || {
                label: sec,
                badge: sec.toUpperCase(),
                desc: "Custom section",
              };
              return (
                <div key={sec} className="flex items-center justify-between p-3 bg-secondary/5 hover:bg-secondary/15 transition-colors gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="w-6 h-6 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">{meta.label}</span>
                        <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                          {meta.badge}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{meta.desc}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleMoveSection(idx, "up")}
                      disabled={idx === 0}
                      className="p-1 h-7 w-7"
                      title="Move Up"
                    >
                      <Icon name="ChevronUp" className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleMoveSection(idx, "down")}
                      disabled={idx === currentOrder.length - 1}
                      className="p-1 h-7 w-7"
                      title="Move Down"
                    >
                      <Icon name="ChevronDown" className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Spacing & Date Format grid */}
          <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-border/60">
            <div>
              <Label htmlFor="contactSpacingSelect">Contact Block Spacing</Label>
              <select
                id="contactSpacingSelect"
                value={draft.contactSpacing ?? "stacked"}
                onChange={(e) => patch({ contactSpacing: e.target.value as any })}
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm mt-1"
              >
                <option value="stacked">Stacked Layout (Multi-line contact details)</option>
                <option value="single-line">Single-Line Layout (Inline dividers email | phone | location)</option>
              </select>
              <span className="text-[10px] text-muted-foreground">Single-Line saves about 3-4 lines of page space, helpful for 1-page fits.</span>
            </div>

            <div>
              <Label htmlFor="dateFormatSelect">Date Format Standardization</Label>
              <select
                id="dateFormatSelect"
                value={draft.dateFormat ?? "auto"}
                onChange={(e) => patch({ dateFormat: e.target.value as any })}
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm mt-1"
              >
                <option value="auto">Auto / Flexible (Preserves candidate format)</option>
                <option value="month-year">Month Year (e.g., "June 2026")</option>
                <option value="short-date">Short Date (e.g., "06/2026")</option>
                <option value="year-only">Year Only (e.g., "2026")</option>
              </select>
              <span className="text-[10px] text-muted-foreground">Enforces a unified format for all experience and education entries.</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI MODEL SELECTION */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Icon name="Sparkles" className="w-5 h-5 text-brand" /> AI Model Selection
          </CardTitle>
          <CardDescription>
            Primary model used for resume generation and optimization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-md space-y-1.5">
            <Label htmlFor="primaryAiModelSelect">Primary Model</Label>
            <select
              id="primaryAiModelSelect"
              value={draft.aiModel || "gemini-2.5-flash"}
              onChange={(e) => patch({ aiModel: e.target.value })}
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm font-mono"
            >
              <option value="gemini-2.5-flash">gemini-2.5-flash</option>
              <option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite</option>
              <option value="gpt-4o-mini">gpt-4o-mini</option>
              <option value="gpt-4o">gpt-4o</option>
              <option value="claude-sonnet-4-5">claude-sonnet-4-5</option>
              <option value="deepseek-chat">deepseek-chat</option>
            </select>
            <p className="text-xs text-muted-foreground">Fast, high-quality optimization (recommended)</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CustomSectionInstructionsSection({
  draft,
  patch,
}: {
  draft: OptimizerDirectiveConfig;
  patch: (p: Partial<OptimizerDirectiveConfig>) => void;
}) {
  const instructions = draft.customSectionInstructions ?? {};

  const handleInstructionChange = (section: string, value: string) => {
    patch({
      customSectionInstructions: {
        ...instructions,
        [section]: value,
      },
    });
  };

  const sectionsToConfigure = [
    { key: "summary", label: "Summary / Profile Instructions", placeholder: "e.g., Focus on leadership, use active language, highlight aviation achievements." },
    { key: "skills", label: "Skills Section Instructions", placeholder: "e.g., Group skills by category: Technical, Hard, Soft. Focus on cloud technologies." },
    { key: "experience", label: "Work Experience Instructions", placeholder: "e.g., Emphasize managerial roles, highlight cost savings and customer retention achievements." },
    { key: "education", label: "Education Section Instructions", placeholder: "e.g., Highlight relevant coursework, list academic achievements." },
    { key: "languages", label: "Languages Instructions", placeholder: "e.g., List professional languages first, skip elementary proficiency." },
    { key: "projects", label: "Projects Instructions", placeholder: "e.g., Focus on open source projects, highlight scale and tech stack." },
    { key: "certifications", label: "Certifications Instructions", placeholder: "e.g., List safety and aviation certs first, skip expired ones." },
    { key: "additionalInfo", label: "Additional Info Instructions", placeholder: "e.g., Keep extremely brief, focus on hobbies that demonstrate leadership." },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Icon name="MessageSquare" className="w-5 h-5 text-brand" /> Custom Section-Level AI Instructions
        </CardTitle>
        <CardDescription>
          Provide specific instructions for individual resume sections. These prompts are supplied directly to each specialist agent during optimization.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          {sectionsToConfigure.map((sec) => (
            <div key={sec.key} className="space-y-1">
              <Label htmlFor={`inst_${sec.key}`}>{sec.label}</Label>
              <Textarea
                id={`inst_${sec.key}`}
                placeholder={sec.placeholder}
                value={instructions[sec.key] ?? ""}
                onChange={(e) => handleInstructionChange(sec.key, e.target.value)}
                rows={3}
                className="text-xs"
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
