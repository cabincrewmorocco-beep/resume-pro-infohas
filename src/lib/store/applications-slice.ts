// ============================================================================
// Zustand Store — Applications & Interviews Slice
// ============================================================================

"use client";

import type { StateCreator } from "zustand";
import type { AppState } from "../store";
import type { InterviewPackage, InterviewSessionRecord } from "../types";
import { uid } from "./helpers";
import {
  getAllApplicationsFromDB,
  saveApplicationToDB,
  saveAllApplicationsToDB,
  deleteApplicationFromDB,
  getAllFromStore,
  putToStore,
  putBatchToStore,
  deleteFromStore,
  STORE_INTERVIEWS,
  safeSetLocalStorage,
} from "../resume-db";

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
  [key: string]: any;
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

  // Asynchronous reconciliation with IndexedDB:
  // Loads all stored applications and interviews directly from client IndexedDB
  if (typeof window !== "undefined") {
    setTimeout(async () => {
      try {
        const [dbApps, dbInterviews] = await Promise.all([
          getAllApplicationsFromDB<ApplicationRecord>(),
          getAllFromStore<InterviewPackage>(STORE_INTERVIEWS),
        ]);

        if (dbApps && dbApps.length > 0) {
          const current = get().applications;
          const map = new Map<string, ApplicationRecord>();
          for (const a of [...dbApps, ...current]) {
            if (a && a.id) {
              const existing = map.get(a.id);
              if (!existing) {
                map.set(a.id, a);
              } else {
                const existingTime = new Date(existing.updatedAt || 0).getTime();
                const newTime = new Date(a.updatedAt || 0).getTime();
                if (newTime >= existingTime) map.set(a.id, a);
              }
            }
          }
          const merged = Array.from(map.values());
          if (merged.length !== current.length) {
            safeSetLocalStorage(APPLICATIONS_KEY, merged);
            set({
              applications: merged,
              activeApplicationId: get().activeApplicationId || merged[0]?.id || null,
            });
          }
        } else if (initialApps.length > 0) {
          saveAllApplicationsToDB(initialApps).catch(() => {});
        }

        if (dbInterviews && dbInterviews.length > 0) {
          const current = get().interviews;
          const map = new Map<string, InterviewPackage>();
          for (const iv of [...dbInterviews, ...current]) {
            if (iv && iv.id) map.set(iv.id, iv);
          }
          const merged = Array.from(map.values());
          if (merged.length !== current.length) {
            safeSetLocalStorage(INTERVIEWS_KEY, merged);
            set({ interviews: merged });
          }
        } else if (initialInterviews.length > 0) {
          putBatchToStore(STORE_INTERVIEWS, initialInterviews).catch(() => {});
        }
      } catch (e) {
        console.warn("[applications-slice] IndexedDB reconciliation error:", e);
      }
    }, 60);
  }

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
      safeSetLocalStorage(APPLICATIONS_KEY, next);
      saveApplicationToDB(newApp).catch(() => {});
      saveAllApplicationsToDB(next).catch(() => {});
      set({ applications: next, activeApplicationId: newApp.id });
    },

    updateApplication: (id: string, patch: Partial<ApplicationRecord>) => {
      const next = get().applications.map((a) =>
        a.id === id ? { ...a, ...patch, updatedAt: new Date().toISOString() } : a
      );
      safeSetLocalStorage(APPLICATIONS_KEY, next);
      saveAllApplicationsToDB(next).catch(() => {});
      set({ applications: next });
    },

    removeApplication: (id: string) => {
      const next = get().applications.filter((a) => a.id !== id);
      safeSetLocalStorage(APPLICATIONS_KEY, next);
      deleteApplicationFromDB(id).catch(() => {});
      saveAllApplicationsToDB(next).catch(() => {});
      set({ applications: next });
    },

    moveApplication: (id: string, status: string) => {
      get().updateApplication(id, { status });
    },

    addInterview: (pkg: InterviewPackage) => {
      const next = [pkg, ...get().interviews.filter((i) => i.id !== pkg.id)];
      safeSetLocalStorage(INTERVIEWS_KEY, next);
      putToStore(STORE_INTERVIEWS, pkg).catch(() => {});
      set({ interviews: next, activeInterviewId: pkg.id });
    },

    removeInterview: (id: string) => {
      const next = get().interviews.filter((i) => i.id !== id);
      safeSetLocalStorage(INTERVIEWS_KEY, next);
      deleteFromStore(STORE_INTERVIEWS, id).catch(() => {});
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
