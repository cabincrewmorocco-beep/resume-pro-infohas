// ============================================================================
// Zustand Store — Applications & Interviews Slice
// ============================================================================

"use client";

import type { StateCreator } from "zustand";
import type { AppState } from "../store";
import type { InterviewPackage, InterviewSessionRecord } from "../types";
import { uid } from "./helpers";

const APPLICATIONS_KEY = "resumeai_applications";
const INTERVIEWS_KEY = "resumeai_interviews";
const SESSIONS_KEY = "resumeai_interview_sessions";

export interface ApplicationRecord {
  id: string;
  company: string;
  role: string;
  location?: string;
  salary?: string;
  url?: string;
  status: "wishlist" | "applied" | "screening" | "interviewing" | "offer" | "rejected" | string;
  appliedDate?: string;
  notes?: string;
  resumeId?: string;
  jdId?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface ApplicationsSlice {
  applications: ApplicationRecord[];
  activeApplicationId: string | null;
  interviews: InterviewPackage[];
  activeInterviewId: string | null;
  interviewSessions: InterviewSessionRecord[];

  setActiveApplication: (id: string | null) => void;
  addApplication: (app: Partial<ApplicationRecord>) => void;
  updateApplication: (id: string, patch: Partial<ApplicationRecord>) => void;
  removeApplication: (id: string) => void;
  moveApplication: (id: string, status: string) => void;

  addInterview: (pkg: InterviewPackage) => void;
  removeInterview: (id: string) => void;
  setActiveInterview: (id: string | null) => void;

  addInterviewSession: (session: InterviewSessionRecord) => void;
  removeInterviewSession: (id: string) => void;
}

export const createApplicationsSlice: StateCreator<AppState, [], [], ApplicationsSlice> = (set, get) => {
  const loadStored = <T>(key: string, fallback: T): T => {
    if (typeof localStorage === "undefined") return fallback;
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch {
      return fallback;
    }
  };

  const initialApps = loadStored<ApplicationRecord[]>(APPLICATIONS_KEY, []);
  const initialInterviews = loadStored<InterviewPackage[]>(INTERVIEWS_KEY, []);
  const initialSessions = loadStored<InterviewSessionRecord[]>(SESSIONS_KEY, []);

  return {
    applications: initialApps,
    activeApplicationId: initialApps[0]?.id || null,
    interviews: initialInterviews,
    activeInterviewId: initialInterviews[0]?.id || null,
    interviewSessions: initialSessions,

    setActiveApplication: (id: string | null) => set({ activeApplicationId: id }),

    addApplication: (app: Partial<ApplicationRecord>) => {
      const newApp: ApplicationRecord = {
        id: app.id || uid("app"),
        company: app.company || "New Company",
        role: app.role || "Software Engineer",
        status: app.status || "applied",
        appliedDate: app.appliedDate || new Date().toISOString(),
        createdAt: new Date().toISOString(),
        ...app,
      };
      const next = [newApp, ...get().applications];
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(next));
      }
      set({ applications: next, activeApplicationId: newApp.id });
    },

    updateApplication: (id: string, patch: Partial<ApplicationRecord>) => {
      const next = get().applications.map((a) =>
        a.id === id ? { ...a, ...patch, updatedAt: new Date().toISOString() } : a
      );
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(next));
      }
      set({ applications: next });
    },

    removeApplication: (id: string) => {
      const next = get().applications.filter((a) => a.id !== id);
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(next));
      }
      set({ applications: next });
    },

    moveApplication: (id: string, status: string) => {
      get().updateApplication(id, { status });
    },

    addInterview: (pkg: InterviewPackage) => {
      const next = [pkg, ...get().interviews.filter((i) => i.id !== pkg.id)];
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(INTERVIEWS_KEY, JSON.stringify(next));
      }
      set({ interviews: next, activeInterviewId: pkg.id });
    },

    removeInterview: (id: string) => {
      const next = get().interviews.filter((i) => i.id !== id);
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(INTERVIEWS_KEY, JSON.stringify(next));
      }
      set({ interviews: next });
    },

    setActiveInterview: (id: string | null) => set({ activeInterviewId: id }),

    addInterviewSession: (session: InterviewSessionRecord) => {
      const next = [session, ...get().interviewSessions.filter((s) => s.id !== session.id)];
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(SESSIONS_KEY, JSON.stringify(next));
      }
      set({ interviewSessions: next });
    },

    removeInterviewSession: (id: string) => {
      const next = get().interviewSessions.filter((s) => s.id !== id);
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(SESSIONS_KEY, JSON.stringify(next));
      }
      set({ interviewSessions: next });
    },
  };
};
