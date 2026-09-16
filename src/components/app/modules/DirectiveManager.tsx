"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge, Icon } from "@/components/shared";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useApp } from "@/lib/store";
import {
  DirectiveProfile,
  BUILT_IN_PROFILES,
  isBuiltInProfile,
  applyProfileToConfig,
  slugifyProfileId,
} from "@/lib/directive-profiles";
import { SEED_OPTIMIZER_DIRECTIVE } from "@/lib/mock-data";
import type { OptimizerDirectiveConfig } from "@/lib/types";

export interface DirectiveManagerProps {
  className?: string;
  onProfileSelect?: (profile: DirectiveProfile) => void;
  selectedProfileId?: string;
}

export function DirectiveManager({
  className = "",
  onProfileSelect,
  selectedProfileId: propSelectedProfileId,
}: DirectiveManagerProps) {
  const customProfiles = useApp((s) => s.customDirectiveProfiles) || [];
  const saveCustomProfiles = useApp((s) => s.saveCustomDirectiveProfiles);
  const deleteCustomDirectiveProfile = useApp((s) => s.deleteCustomDirectiveProfile);
  const activeConfig = useApp((s) => s.optimizerDirectiveConfig || (s as any).optimizerDirective);
  const updateActiveConfig = useApp((s) => s.updateOptimizerDirective);

  const activeProfileId = propSelectedProfileId || activeConfig?.selectedProfileId || "aviation-hospitality";

  // Filter & Search state
  const [filterTab, setFilterTab] = useState<"all" | "builtin" | "custom">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const builtInProfilesList = useMemo(() => Object.values(BUILT_IN_PROFILES), []);

  const allProfiles = useMemo(() => {
    return [...builtInProfilesList, ...(customProfiles || [])];
  }, [builtInProfilesList, customProfiles]);

  const filteredProfiles = useMemo(() => {
    return allProfiles.filter((p) => {
      const isBuiltIn = isBuiltInProfile(p.id);
      if (filterTab === "builtin" && !isBuiltIn) return false;
      if (filterTab === "custom" && isBuiltIn) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.tags?.some((t) => t.toLowerCase().includes(q)) ||
        p.overrides?.customDirectiveOverride?.toLowerCase().includes(q)
      );
    });
  }, [allProfiles, filterTab, searchQuery]);

  // Create / Edit modal state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [deleteModalProfile, setDeleteModalProfile] = useState<DirectiveProfile | null>(null);

  // Form State
  const [form, setForm] = useState<{
    id: string;
    name: string;
    industryTag: string;
    baseTemplate: string;
    instructions: string;
    a4Preset: "strict-1page" | "standard" | "executive-2page" | "custom";
    maxBullets: number;
    summaryWords: number;
    bodyFontSizePt: number;
    sectionTitleSizePt: number;
  }>({
    id: "",
    name: "",
    industryTag: "Airport Retail",
    baseTemplate: "aviation-hospitality",
    instructions: "Enforce strict single-page A4 format, highlight passenger diplomacy, luxury retail revenue metrics, bilingual communication, and 5-star airline customer service standards.",
    a4Preset: "strict-1page",
    maxBullets: 4,
    summaryWords: 70,
    bodyFontSizePt: 9.5,
    sectionTitleSizePt: 11,
  });

  const openCreateDialog = () => {
    setIsEditing(false);
    setForm({
      id: "",
      name: "",
      industryTag: "Airport Retail",
      baseTemplate: "aviation-hospitality",
      instructions: "Enforce strict single-page A4 format, highlight passenger diplomacy, luxury retail revenue metrics, bilingual communication, and 5-star airline customer service standards.",
      a4Preset: "strict-1page",
      maxBullets: 4,
      summaryWords: 70,
      bodyFontSizePt: 9.5,
      sectionTitleSizePt: 11,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (profile: DirectiveProfile) => {
    setIsEditing(true);
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

    setForm({
      id: profile.id,
      name: profile.name,
      industryTag: profile.tags?.find((t) => t !== "custom" && !t.includes("page")) || profile.tags?.[0] || "",
      baseTemplate: "custom",
      instructions: String(overrides.customDirectiveOverride || ""),
      a4Preset: preset,
      maxBullets: bullets,
      summaryWords,
      bodyFontSizePt: fontPt,
      sectionTitleSizePt: titlePt,
    });
    setDialogOpen(true);
  };

  const handleCloneBuiltIn = (profile: DirectiveProfile) => {
    setIsEditing(false);
    const overrides = profile.overrides || {};
    const bullets = overrides.experienceBulletsPerEntry ?? 4;
    const words = overrides.summaryMaxWords ?? 75;
    const fontPt = overrides.bodyFontSizePt ?? 9.5;
    const titlePt = overrides.sectionTitleSizePt ?? 11;
    const instructions = overrides.customDirectiveOverride || profile.description || "";

    setForm({
      id: "",
      name: `${profile.name} (Custom Copy)`,
      industryTag: profile.tags?.find((t) => t !== "custom" && !t.includes("page")) || profile.tags?.[0] || "Aviation",
      baseTemplate: profile.id,
      instructions,
      a4Preset: "custom",
      maxBullets: bullets,
      summaryWords: words,
      bodyFontSizePt: fontPt,
      sectionTitleSizePt: titlePt,
    });
    setDialogOpen(true);
  };

  const applyA4Preset = (preset: "strict-1page" | "standard" | "executive-2page") => {
    if (preset === "strict-1page") {
      setForm((prev) => ({
        ...prev,
        a4Preset: "strict-1page",
        maxBullets: 4,
        summaryWords: 70,
        bodyFontSizePt: 9.5,
        sectionTitleSizePt: 11,
      }));
    } else if (preset === "standard") {
      setForm((prev) => ({
        ...prev,
        a4Preset: "standard",
        maxBullets: 5,
        summaryWords: 110,
        bodyFontSizePt: 10,
        sectionTitleSizePt: 12,
      }));
    } else if (preset === "executive-2page") {
      setForm((prev) => ({
        ...prev,
        a4Preset: "executive-2page",
        maxBullets: 7,
        summaryWords: 180,
        bodyFontSizePt: 10.5,
        sectionTitleSizePt: 13,
      }));
    }
  };

  const handleBaseTemplateChange = (templateId: string) => {
    let suggestedTag = form.industryTag;
    let suggestedPrompt = form.instructions;

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

    setForm((prev) => ({
      ...prev,
      baseTemplate: templateId,
      industryTag: suggestedTag,
      instructions: suggestedPrompt,
    }));
  };

  const handleSave = (activate: boolean = false) => {
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      toast.error("Directive profile name is required.");
      return;
    }

    const id = form.id || slugifyProfileId(trimmedName);
    const baseTemplate = form.baseTemplate !== "blank" && form.baseTemplate !== "custom"
      ? (BUILT_IN_PROFILES[form.baseTemplate] || BUILT_IN_PROFILES["aviation-hospitality"])
      : null;

    const baseOverrides: Partial<OptimizerDirectiveConfig> = baseTemplate
      ? JSON.parse(JSON.stringify(baseTemplate.overrides || {}))
      : {};

    const tags = [
      form.industryTag.trim(),
      "custom",
      form.a4Preset === "strict-1page" ? "1-page" : form.a4Preset === "executive-2page" ? "2-page" : "standard",
    ].filter(Boolean);

    const overrides: Partial<OptimizerDirectiveConfig> = {
      ...baseOverrides,
      selectedProfileId: id,
      customDirectiveOverride: form.instructions.trim() || undefined,
      experienceBulletsPerEntry: form.maxBullets,
      summaryMaxWords: form.summaryWords,
      summaryMinWords: Math.max(25, Math.floor(form.summaryWords * 0.4)),
      bodyFontSizePt: form.bodyFontSizePt,
      sectionTitleSizePt: form.sectionTitleSizePt,
      pageSize: "A4",
      agentDirectives: {
        ...(baseOverrides.agentDirectives || SEED_OPTIMIZER_DIRECTIVE.agentDirectives),
        summary: {
          ...(baseOverrides.agentDirectives?.summary || SEED_OPTIMIZER_DIRECTIVE.agentDirectives.summary),
          maxCharacters: form.summaryWords * 7,
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
      name: trimmedName,
      description: form.industryTag.trim()
        ? `Target: ${form.industryTag.trim()}. Custom directive profile with ${form.a4Preset} A4 constraints.`
        : "Custom user-created directive profile for targeted resume optimization.",
      tags,
      overrides,
    };

    const updatedList = [...customProfiles.filter((p) => p.id !== id), newProfile];
    saveCustomProfiles(updatedList);

    if (activate) {
      const activatedConfig = applyProfileToConfig(activeConfig, newProfile);
      activatedConfig.selectedProfileId = id;
      if (form.instructions.trim()) {
        activatedConfig.customDirectiveOverride = form.instructions.trim();
      }
      activatedConfig.experienceBulletsPerEntry = form.maxBullets;
      activatedConfig.summaryMaxWords = form.summaryWords;
      activatedConfig.bodyFontSizePt = form.bodyFontSizePt;
      activatedConfig.sectionTitleSizePt = form.sectionTitleSizePt;
      updateActiveConfig(activatedConfig);
      toast.success(`Directive Profile "${trimmedName}" saved and activated!`);
    } else {
      toast.success(`Directive Profile "${trimmedName}" saved.`);
    }

    if (onProfileSelect) {
      onProfileSelect(newProfile);
    }

    setDialogOpen(false);
  };

  const handleActivateProfile = (profile: DirectiveProfile) => {
    const updated = applyProfileToConfig(activeConfig, profile);
    updated.selectedProfileId = profile.id;
    updateActiveConfig(updated);
    if (onProfileSelect) {
      onProfileSelect(profile);
    }
    toast.success(`Activated directive profile: "${profile.name}"`);
  };

  const handleDeleteProfile = () => {
    if (!deleteModalProfile) return;
    const { id, name } = deleteModalProfile;

    if (isBuiltInProfile(id)) {
      toast.error("Built-in system profiles cannot be deleted.");
      setDeleteModalProfile(null);
      return;
    }

    deleteCustomDirectiveProfile(id);

    if (activeProfileId === id) {
      const fallback = BUILT_IN_PROFILES["aviation-hospitality"];
      const fallbackConfig = fallback ? applyProfileToConfig(activeConfig, fallback) : { ...activeConfig };
      fallbackConfig.selectedProfileId = "aviation-hospitality";
      updateActiveConfig(fallbackConfig);
      toast.success(`Directive "${name}" deleted. Reverted to Aviation / Hospitality default.`);
    } else {
      toast.success(`Directive "${name}" deleted.`);
    }

    setDeleteModalProfile(null);
  };

  return (
    <Card id="directive-manager-card" className={`border-border/80 ${className}`}>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border/50">
        <div className="space-y-1">
          <CardTitle className="text-lg flex items-center gap-2">
            <Icon name="SlidersHorizontal" className="w-5 h-5 text-brand" />
            Optimization Directive Profiles
          </CardTitle>
          <CardDescription>
            Manage ATS and recruiter directive profiles, industry prompt rules, and strict A4 page constraints.
          </CardDescription>
        </div>
        <Button
          id="btn-create-directive-profile"
          onClick={openCreateDialog}
          className="bg-brand hover:bg-brand-dark text-white gap-2 shadow-sm shrink-0"
        >
          <Icon name="Plus" className="w-4 h-4" />
          Create New Directive Profile
        </Button>
      </CardHeader>

      <CardContent className="pt-5 space-y-4">
        {/* FILTERS & SEARCH TOOLBAR */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-secondary/50 rounded-lg border border-border/60 self-start sm:self-auto flex-wrap">
            <button
              onClick={() => setFilterTab("all")}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-all flex items-center gap-1.5 ${
                filterTab === "all"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>All Profiles</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-secondary text-muted-foreground font-mono">
                {allProfiles.length}
              </span>
            </button>
            <button
              onClick={() => setFilterTab("builtin")}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-all flex items-center gap-1.5 ${
                filterTab === "builtin"
                  ? "bg-background text-sky-700 dark:text-sky-300 shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon name="ShieldCheck" className="w-3.5 h-3.5 text-sky-600" />
              <span>Built-in</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300 font-mono">
                {builtInProfilesList.length}
              </span>
            </button>
            <button
              onClick={() => setFilterTab("custom")}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-all flex items-center gap-1.5 ${
                filterTab === "custom"
                  ? "bg-background text-purple-700 dark:text-purple-300 shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon name="User" className="w-3.5 h-3.5 text-purple-600" />
              <span>Custom</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300 font-mono">
                {customProfiles.length}
              </span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Icon
              name="Search"
              className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search profiles or tags..."
              className="pl-8.5 pr-8 h-8.5 text-xs bg-background"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <Icon name="X" className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* PROFILES GRID OR EMPTY STATE */}
        {filteredProfiles.length === 0 ? (
          <div className="text-center py-10 px-4 border border-dashed border-border/80 rounded-xl bg-secondary/15 space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-brand/10 text-brand grid place-items-center">
              <Icon name="SlidersHorizontal" className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-base">No Profiles Found</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                {searchQuery
                  ? `No profiles match "${searchQuery}". Try a different keyword or reset your filter.`
                  : filterTab === "custom"
                  ? "You haven't created any custom directive profiles yet. Create one or clone a built-in profile to get started."
                  : "No profiles available under this category."}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              {searchQuery && (
                <Button
                  onClick={() => setSearchQuery("")}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  Clear Search
                </Button>
              )}
              {filterTab === "custom" && (
                <Button
                  onClick={openCreateDialog}
                  size="sm"
                  className="bg-brand hover:bg-brand-dark text-white text-xs gap-1.5"
                >
                  <Icon name="Plus" className="w-3.5 h-3.5" />
                  Create First Custom Profile
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-4.5">
            {filteredProfiles.map((profile) => {
              const isBuiltIn = isBuiltInProfile(profile.id);
              const isActive = activeProfileId === profile.id;
              const overrides = profile.overrides || {};
              const bullets = overrides.experienceBulletsPerEntry ?? 4;
              const words = overrides.summaryMaxWords ?? 70;
              const fontSize = overrides.bodyFontSizePt ?? 9.5;
              const instructions = overrides.customDirectiveOverride;

              return (
                <div
                  key={profile.id}
                  id={`profile-card-${profile.id}`}
                  className={`group relative rounded-xl border p-4 sm:p-4.5 transition-all duration-200 flex flex-col justify-between gap-3 ${
                    isActive
                      ? "border-emerald-600/80 bg-emerald-500/5 ring-1 ring-emerald-500/40 shadow-sm dark:bg-emerald-950/20"
                      : isBuiltIn
                      ? "border-border/80 bg-card hover:border-sky-500/50 hover:shadow-xs"
                      : "border-border/80 bg-card hover:border-purple-500/50 hover:shadow-xs"
                  }`}
                >
                  {/* CARD HEADER & ACTION BUTTONS */}
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4
                            className="font-semibold text-sm sm:text-base text-foreground break-words leading-snug"
                            title={profile.name}
                          >
                            {profile.name}
                          </h4>
                          {isActive && (
                            <Badge className="text-[10px] px-1.5 py-0 bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-0.5 shrink-0">
                              <Icon name="Check" className="w-2.5 h-2.5" />
                              Active
                            </Badge>
                          )}
                        </div>

                        {/* DISTINCT SYSTEM VS CUSTOM BADGE */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isBuiltIn ? (
                            <Badge
                              variant="outline"
                              className="text-[11px] px-2 py-0.5 bg-sky-50 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200 border-sky-300 dark:border-sky-800 font-semibold gap-1 shrink-0 shadow-xs"
                            >
                              <Icon name="ShieldCheck" className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                              Built-in
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[11px] px-2 py-0.5 bg-purple-50 text-purple-800 dark:bg-purple-950/60 dark:text-purple-200 border-purple-300 dark:border-purple-800 font-semibold gap-1 shrink-0 shadow-xs"
                            >
                              <Icon name="User" className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                              Custom
                            </Badge>
                          )}

                          {profile.tags?.slice(0, 2).map((tag) => (
                            <Badge
                              key={tag}
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 bg-secondary/50 font-mono text-muted-foreground shrink-0"
                            >
                              #{tag}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* CARD CONTROLS: Clone for Built-in, Edit + Trash Icon for Custom */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isBuiltIn ? (
                          <>
                            <button
                              onClick={() => handleCloneBuiltIn(profile)}
                              title="Clone & customize this built-in profile"
                              className="h-8 w-8 grid place-items-center rounded-lg hover:bg-sky-500/15 text-muted-foreground hover:text-sky-700 dark:hover:text-sky-300 transition-colors border border-transparent hover:border-sky-300/40"
                              aria-label={`Clone ${profile.name}`}
                            >
                              <Icon name="Copy" className="w-4 h-4" />
                            </button>
                            <span
                              title="Built-in system profile (protected against deletion)"
                              className="h-8 w-8 grid place-items-center text-muted-foreground/40 cursor-default"
                            >
                              <Icon name="Lock" className="w-4 h-4" />
                            </span>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => openEditDialog(profile)}
                              title="Edit directive profile"
                              className="h-8 w-8 grid place-items-center rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors border border-border/50"
                              aria-label={`Edit ${profile.name}`}
                            >
                              <Icon name="Pencil" className="w-3.5 h-3.5" />
                            </button>
                            <button
                              id={`btn-delete-profile-${profile.id}`}
                              onClick={() => setDeleteModalProfile(profile)}
                              title={`Delete custom profile "${profile.name}"`}
                              className="h-8 w-8 grid place-items-center rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-900/60 transition-all shadow-xs hover:scale-105 active:scale-95 cursor-pointer"
                              aria-label={`Delete custom profile ${profile.name}`}
                            >
                              <Icon name="Trash2" className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* DESCRIPTION OR INSTRUCTION PREVIEW */}
                    {instructions ? (
                      <p className="text-xs text-muted-foreground line-clamp-2 bg-secondary/25 p-2 rounded-md font-mono text-[11px] leading-relaxed border border-border/40">
                        {instructions}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed min-h-[32px]">
                        {profile.description || "Standard resume optimization directive profile."}
                      </p>
                    )}

                    {/* A4 CONSTRAINTS SPEC PILLS */}
                    <div className="pt-1 flex items-center gap-1.5 flex-wrap text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1 bg-secondary/60 px-2 py-0.5 rounded text-foreground font-medium text-[10.5px]">
                        <Icon name="List" className="w-3 h-3 text-brand" />
                        Max {bullets} bullets
                      </span>
                      <span className="flex items-center gap-1 bg-secondary/60 px-2 py-0.5 rounded text-foreground font-medium text-[10.5px]">
                        <Icon name="AlignLeft" className="w-3 h-3 text-brand" />
                        {words}w summary
                      </span>
                      <span className="flex items-center gap-1 bg-secondary/60 px-2 py-0.5 rounded text-foreground font-medium text-[10.5px]">
                        <Icon name="Type" className="w-3 h-3 text-brand" />
                        {fontSize}pt
                      </span>
                    </div>
                  </div>

                  {/* CARD FOOTER */}
                  <div className="pt-3 mt-1 border-t border-border/60 flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      {isBuiltIn ? (
                        <>
                          <Icon name="ShieldCheck" className="w-3 h-3 text-sky-600/80" />
                          <span>Protected System Profile</span>
                        </>
                      ) : (
                        <>
                          <Icon name="UserCheck" className="w-3 h-3 text-purple-600/80" />
                          <span>User Custom Profile</span>
                        </>
                      )}
                    </span>

                    {!isActive ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleActivateProfile(profile)}
                        className="h-7.5 px-2.5 text-xs gap-1.5 hover:border-emerald-600 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                      >
                        <Icon name="CheckCircle" className="w-3 h-3" />
                        Activate
                      </Button>
                    ) : (
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded">
                        <Icon name="Check" className="w-3.5 h-3.5" /> In Use
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* CREATE / EDIT DIALOG */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Icon name={isEditing ? "Pencil" : "Sparkles"} className="w-5 h-5 text-brand" />
              {isEditing ? "Edit Custom Directive Profile" : "Create New Directive Profile"}
            </DialogTitle>
            <DialogDescription>
              Configure the custom parameters, recruiter instructions, and strict A4 constraints for this profile.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 1. Name */}
            <div>
              <Label htmlFor="dm-name" className="text-sm font-semibold flex items-center justify-between">
                <span>Directive Profile Name <span className="text-destructive">*</span></span>
                <span className="text-xs text-muted-foreground font-normal">e.g. Qatar Duty Free - Strict One Page</span>
              </Label>
              <Input
                id="dm-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Qatar Duty Free - Strict One Page"
                className="mt-1"
              />
            </div>

            {/* 2. Industry Tag */}
            <div>
              <Label htmlFor="dm-industry-tag" className="text-sm font-semibold">
                Industry / Role Tag
              </Label>
              <Input
                id="dm-industry-tag"
                value={form.industryTag}
                onChange={(e) => setForm((f) => ({ ...f, industryTag: e.target.value }))}
                placeholder="e.g. Airport Retail, Cabin Crew, Corporate"
                className="mt-1"
              />
              <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                <span className="text-[11px] text-muted-foreground font-medium mr-1">Suggested:</span>
                {[
                  "Airport Retail",
                  "Cabin Crew",
                  "VIP Aviation",
                  "Hospitality Management",
                  "Corporate",
                  "Engineering",
                ].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, industryTag: tag }))}
                    className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                      form.industryTag === tag
                        ? "bg-brand text-white border-brand font-medium"
                        : "bg-secondary/60 hover:bg-secondary border-border text-foreground"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Base Template */}
            <div>
              <Label htmlFor="dm-base-template" className="text-sm font-semibold">
                Base Template Selector
              </Label>
              <select
                id="dm-base-template"
                value={form.baseTemplate}
                onChange={(e) => handleBaseTemplateChange(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm mt-1"
              >
                <option value="aviation-hospitality">Aviation / Hospitality (Default InfoHAS)</option>
                <option value="ats-conservative">ATS Conservative (Structure-Preserving)</option>
                <option value="ats-aggressive">ATS Aggressive (High Keyword Density)</option>
                <option value="executive">Executive / High-End (Executive Narrative)</option>
                <option value="tech">Tech / Engineering (Architecture & Metrics)</option>
                <option value="blank">Start Blank</option>
              </select>
              <p className="text-[11px] text-muted-foreground mt-1">
                Inherits baseline agent parameters and layout defaults from the chosen template.
              </p>
            </div>

            {/* 4. Instructions */}
            <div>
              <Label htmlFor="dm-instructions" className="text-sm font-semibold flex items-center justify-between">
                <span>Custom Instructions (System Prompt / Directive Override)</span>
                <span className="text-[11px] text-brand font-mono">Injected into Optimizer</span>
              </Label>
              <Textarea
                id="dm-instructions"
                value={form.instructions}
                onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
                placeholder="Enter custom directives (e.g. 'Enforce strict 1-page A4 format, highlight duty-free sales quotas, luxury client relations, Qatar Airways 5-star service standards...')."
                rows={4}
                className="mt-1 font-sans text-xs leading-relaxed"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Explicit instructions provided to the AI optimizer agents for bullet rewriting, phrasing, and keyword prioritization.
              </p>
            </div>

            {/* 5. A4 Constraints */}
            <div className="border border-border/80 rounded-lg p-3 bg-secondary/20 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <Icon name="FileText" className="w-4 h-4 text-brand" /> A4 Constraints & Page Budget
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Predefined page budgets designed to prevent text overflows on physical A4 sheets.
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono capitalize">
                  {form.a4Preset.replace("-", " ")}
                </Badge>
              </div>

              {/* Preset buttons */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => applyA4Preset("strict-1page")}
                  className={`p-2.5 rounded-md border text-left transition-all ${
                    form.a4Preset === "strict-1page"
                      ? "border-brand bg-brand/10 dark:bg-brand/20 ring-1 ring-brand text-brand"
                      : "border-input bg-background hover:bg-secondary/40 text-foreground"
                  }`}
                >
                  <div className="text-xs font-semibold">Strict 1-Page</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Max 4 bullets • 70w summary • 9.5pt</div>
                </button>

                <button
                  type="button"
                  onClick={() => applyA4Preset("standard")}
                  className={`p-2.5 rounded-md border text-left transition-all ${
                    form.a4Preset === "standard"
                      ? "border-brand bg-brand/10 dark:bg-brand/20 ring-1 ring-brand text-brand"
                      : "border-input bg-background hover:bg-secondary/40 text-foreground"
                  }`}
                >
                  <div className="text-xs font-semibold">Standard Pro</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Max 5 bullets • 110w summary • 10pt</div>
                </button>

                <button
                  type="button"
                  onClick={() => applyA4Preset("executive-2page")}
                  className={`p-2.5 rounded-md border text-left transition-all ${
                    form.a4Preset === "executive-2page"
                      ? "border-brand bg-brand/10 dark:bg-brand/20 ring-1 ring-brand text-brand"
                      : "border-input bg-background hover:bg-secondary/40 text-foreground"
                  }`}
                >
                  <div className="text-xs font-semibold">Executive 2-Page</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Max 7 bullets • 180w summary • 10.5pt</div>
                </button>
              </div>

              {/* Numerical Sliders/Inputs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border/50">
                <div>
                  <Label htmlFor="dm-bullets" className="text-[11px] text-muted-foreground">Bullets / Role</Label>
                  <Input
                    id="dm-bullets"
                    type="number"
                    min={2}
                    max={10}
                    value={form.maxBullets}
                    onChange={(e) => setForm((f) => ({ ...f, maxBullets: Number(e.target.value) || 4, a4Preset: "custom" }))}
                    className="h-8 text-xs mt-0.5"
                  />
                </div>
                <div>
                  <Label htmlFor="dm-summary" className="text-[11px] text-muted-foreground">Summary Words</Label>
                  <Input
                    id="dm-summary"
                    type="number"
                    min={30}
                    max={300}
                    step={5}
                    value={form.summaryWords}
                    onChange={(e) => setForm((f) => ({ ...f, summaryWords: Number(e.target.value) || 75, a4Preset: "custom" }))}
                    className="h-8 text-xs mt-0.5"
                  />
                </div>
                <div>
                  <Label htmlFor="dm-font-size" className="text-[11px] text-muted-foreground">Body Font (pt)</Label>
                  <Input
                    id="dm-font-size"
                    type="number"
                    min={8}
                    max={13}
                    step={0.5}
                    value={form.bodyFontSizePt}
                    onChange={(e) => setForm((f) => ({ ...f, bodyFontSizePt: Number(e.target.value) || 9.5, a4Preset: "custom" }))}
                    className="h-8 text-xs mt-0.5"
                  />
                </div>
                <div>
                  <Label htmlFor="dm-title-size" className="text-[11px] text-muted-foreground">Title Font (pt)</Label>
                  <Input
                    id="dm-title-size"
                    type="number"
                    min={10}
                    max={16}
                    step={0.5}
                    value={form.sectionTitleSizePt}
                    onChange={(e) => setForm((f) => ({ ...f, sectionTitleSizePt: Number(e.target.value) || 11, a4Preset: "custom" }))}
                    className="h-8 text-xs mt-0.5"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleSave(false)}
              className="gap-1.5"
            >
              <Icon name="Save" className="w-4 h-4" /> Save Profile
            </Button>
            <Button
              onClick={() => handleSave(true)}
              className="bg-brand hover:bg-brand-dark text-white gap-1.5 shadow-sm font-medium"
            >
              <Icon name="CheckCircle" className="w-4 h-4" /> Save & Activate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CONFIRM DELETE DIALOG */}
      <Dialog open={!!deleteModalProfile} onOpenChange={(open) => { if (!open) setDeleteModalProfile(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Icon name="Trash2" className="w-5 h-5 text-destructive" /> Delete Directive Profile
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>&ldquo;{deleteModalProfile?.name}&rdquo;</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="text-xs text-muted-foreground bg-destructive/10 border border-destructive/20 rounded-md p-3 space-y-2">
            <p className="font-semibold text-destructive flex items-center gap-1.5">
              <Icon name="AlertTriangle" className="w-4 h-4 text-destructive shrink-0" />
              <span>Permanent removal</span>
            </p>
            <p>
              This directive profile will be permanently deleted from local storage and your cloud database.
            </p>
            {activeProfileId === deleteModalProfile?.id && (
              <div className="pt-2 border-t border-destructive/20 text-amber-700 dark:text-amber-300 font-medium">
                <strong>Active Profile Warning:</strong> This profile is currently active. Deleting it will automatically reset your active optimizer directive to the default <em>Aviation / Hospitality</em> profile.
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteModalProfile(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteProfile}
              className="gap-1.5 shadow-sm"
            >
              <Icon name="Trash2" className="w-4 h-4" /> Delete Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default DirectiveManager;
