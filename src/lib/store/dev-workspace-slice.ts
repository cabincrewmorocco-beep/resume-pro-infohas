// ============================================================================
// Zustand Store — AI Dev Workspace Slice
// ============================================================================

"use client";

import type { StateCreator } from "zustand";
import type { AppState } from "../store";
import type {
  AITask,
  AIWorkspacePatch,
  AIGitBranch,
  AIGitCommit,
  AIRollback,
  AIDevAgentSettings,
  AIDevAgentHistory,
  AIDevReport,
  AIHealingIssue,
  AIHealingReport,
} from "../types";
import {
  SEED_AI_TASKS,
  SEED_AI_PATCHES,
  SEED_AI_BRANCHES,
  SEED_AI_COMMITS,
  SEED_AI_DEV_SETTINGS,
  SEED_AI_DEV_HISTORY,
} from "../mock-data";

export interface DevWorkspaceSlice {
  aiTasks: AITask[];
  aiPatches: AIWorkspacePatch[];
  aiBranches: AIGitBranch[];
  aiCommits: AIGitCommit[];
  aiRollbacks: AIRollback[];
  aiDevSettings: AIDevAgentSettings;
  aiDevHistory: AIDevAgentHistory[];
  aiDevReports: AIDevReport[];
  aiHealingIssues: AIHealingIssue[];
  aiHealingProgress: number;
  aiHealingReport: AIHealingReport | null;

  addAITask: (task: AITask) => void;
  updateAITask: (id: string, patch: Partial<AITask>) => void;
  addAIPatch: (patch: AIWorkspacePatch) => void;
  updateAIPatch: (id: string, patch: Partial<AIWorkspacePatch>) => void;
  addAIRollback: (rb: AIRollback) => void;
  updateAIDevSettings: (patch: Partial<AIDevAgentSettings>) => void;
  addAIDevHistory: (hist: AIDevAgentHistory) => void;
  addAIDevReport: (report: AIDevReport) => void;
  setAIHealingIssues: (issues: AIHealingIssue[]) => void;
  updateAIHealingIssue: (id: string, patch: Partial<AIHealingIssue>) => void;
  setAIHealingProgress: (progress: number) => void;
  setAIHealingReport: (report: AIHealingReport | null) => void;
}

export const createDevWorkspaceSlice: StateCreator<AppState, [], [], DevWorkspaceSlice> = (set) => ({
  aiTasks: [...SEED_AI_TASKS],
  aiPatches: [...SEED_AI_PATCHES],
  aiBranches: [...SEED_AI_BRANCHES],
  aiCommits: [...SEED_AI_COMMITS],
  aiRollbacks: [],
  aiDevSettings: { ...SEED_AI_DEV_SETTINGS },
  aiDevHistory: [...SEED_AI_DEV_HISTORY],
  aiDevReports: [],
  aiHealingIssues: [],
  aiHealingProgress: 100,
  aiHealingReport: null,

  addAITask: (task: AITask) => set((s) => ({ aiTasks: [task, ...s.aiTasks] })),
  updateAITask: (id: string, patch: Partial<AITask>) =>
    set((s) => ({ aiTasks: s.aiTasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
  addAIPatch: (patch: AIWorkspacePatch) => set((s) => ({ aiPatches: [patch, ...s.aiPatches] })),
  updateAIPatch: (id: string, patch: Partial<AIWorkspacePatch>) =>
    set((s) => ({ aiPatches: s.aiPatches.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
  addAIRollback: (rb: AIRollback) => set((s) => ({ aiRollbacks: [rb, ...s.aiRollbacks] })),
  updateAIDevSettings: (patch: Partial<AIDevAgentSettings>) =>
    set((s) => ({ aiDevSettings: { ...s.aiDevSettings, ...patch } })),
  addAIDevHistory: (hist: AIDevAgentHistory) => set((s) => ({ aiDevHistory: [hist, ...s.aiDevHistory] })),
  addAIDevReport: (report: AIDevReport) => set((s) => ({ aiDevReports: [report, ...s.aiDevReports] })),
  setAIHealingIssues: (issues: AIHealingIssue[]) => set({ aiHealingIssues: issues }),
  updateAIHealingIssue: (id: string, patch: Partial<AIHealingIssue>) =>
    set((s) => ({ aiHealingIssues: s.aiHealingIssues.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
  setAIHealingProgress: (progress: number) => set({ aiHealingProgress: progress }),
  setAIHealingReport: (report: AIHealingReport | null) => set({ aiHealingReport: report }),
});
