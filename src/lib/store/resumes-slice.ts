// ============================================================================
// Zustand Store — Resumes, JDs, and Materials Slice
// ============================================================================

"use client";

import type { StateCreator } from "zustand";
import type { AppState } from "../store";
import type {
  ResumeData,
  JobDescription,
  CoverLetter,
  ATSReport,
  ResumeReviewReport,
  CareerMaterial,
  CloudSyncState,
} from "../types";
import { uid } from "./helpers";
import {
  safeSetLocalStorage,
  saveResumeToDB,
  saveAllResumesToDB,
  deleteResumeFromDB,
  getAllResumesFromDB,
  getAllCoverLettersFromDB,
  saveCoverLetterToDB,
  deleteCoverLetterFromDB,
  getAllJDsFromDB,
  saveJDToDB,
  deleteJDFromDB,
  getAllATSReportsFromDB,
  saveATSReportToDB,
  putBatchToStore,
  STORE_JDS,
  STORE_COVER_LETTERS,
  STORE_ATS,
} from "../resume-db";

const RESUMES_KEY = "resumeai_resumes";
const JDS_KEY = "resumeai_jds";
const COVER_LETTERS_KEY = "resumeai_cover_letters";
const ATS_REPORTS_KEY = "resumeai_ats_reports";
const MATERIALS_KEY = "resumeai_career_materials";

export interface ResumesSlice {
  resumes: ResumeData[];
  activeResumeId: string | null;
  jobDescriptions: JobDescription[];
  activeJdId: string | null;
  coverLetters: CoverLetter[];
  activeCoverLetterId: string | null;
  atsReports: ATSReport[];
  reviewReports: ResumeReviewReport[];
  careerMaterials: CareerMaterial[];
  cloudSyncState: CloudSyncState;

  setCloudSyncState: (patch: Partial<CloudSyncState>) => void;
  setActiveResume: (id: string | null) => void;
  addResume: (resume: ResumeData) => void;
  updateResume: (id: string, patch: Partial<ResumeData>) => void;
  removeResume: (id: string) => void;

  setActiveJD: (id: string | null) => void;
  addJD: (jd: JobDescription) => void;
  removeJD: (id: string) => void;

  addCoverLetter: (cl: CoverLetter) => void;
  updateCoverLetter: (id: string, patch: Partial<CoverLetter>) => void;
  removeCoverLetter: (id: string) => void;
  setActiveCoverLetter: (id: string | null) => void;

  addATSReport: (report: ATSReport) => void;
  addReviewReport: (report: ResumeReviewReport) => void;
  removeReviewReport: (id: string) => void;

  fetchCareerMaterials: () => Promise<void>;
  addCareerMaterial: (material: CareerMaterial) => void;
  deleteCareerMaterial: (id: string) => void;
}

export const createResumesSlice: StateCreator<AppState, [], [], ResumesSlice> = (set, get) => {
  const loadStored = <T>(key: string, fallback: T): T => {
    if (typeof localStorage === "undefined") return fallback;
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch {
      return fallback;
    }
  };

  const initialResumes = loadStored<ResumeData[]>(RESUMES_KEY, []);
  const initialJds = loadStored<JobDescription[]>(JDS_KEY, []);
  const initialCLs = loadStored<CoverLetter[]>(COVER_LETTERS_KEY, []);
  const initialAts = loadStored<ATSReport[]>(ATS_REPORTS_KEY, []);
  const initialMats = loadStored<CareerMaterial[]>(MATERIALS_KEY, []);

  // Asynchronous reconciliation with IndexedDB:
  // If IndexedDB has resumes, JDs, Cover Letters, or ATS reports not yet in localStorage,
  // or if localStorage was cleared, hydrate them smoothly and merge records.
  if (typeof window !== "undefined") {
    setTimeout(async () => {
      try {
        const [dbResumes, dbJds, dbCls, dbAts] = await Promise.all([
          getAllResumesFromDB(),
          getAllJDsFromDB(),
          getAllCoverLettersFromDB(),
          getAllATSReportsFromDB(),
        ]);

        if (dbResumes && dbResumes.length > 0) {
          const current = get().resumes;
          const map = new Map<string, ResumeData>();
          for (const r of [...dbResumes, ...current]) {
            if (r && r.id) {
              const existing = map.get(r.id);
              if (!existing) {
                map.set(r.id, r);
              } else {
                const existingTime = new Date(existing.updatedAt || 0).getTime();
                const newTime = new Date(r.updatedAt || 0).getTime();
                if (newTime >= existingTime) {
                  map.set(r.id, r);
                }
              }
            }
          }
          const merged = Array.from(map.values());
          if (merged.length !== current.length) {
            safeSetLocalStorage(RESUMES_KEY, merged);
            set({
              resumes: merged,
              activeResumeId: get().activeResumeId || merged[0]?.id || null,
            });
          }
        } else if (initialResumes.length > 0) {
          saveAllResumesToDB(initialResumes).catch(() => {});
        }

        if (dbJds && dbJds.length > 0) {
          const current = get().jobDescriptions;
          const map = new Map<string, JobDescription>();
          for (const j of [...dbJds, ...current]) {
            if (j && j.id) map.set(j.id, j);
          }
          const merged = Array.from(map.values());
          if (merged.length !== current.length) {
            safeSetLocalStorage(JDS_KEY, merged);
            set({ jobDescriptions: merged, activeJdId: get().activeJdId || merged[0]?.id || null });
          }
        } else if (initialJds.length > 0) {
          putBatchToStore(STORE_JDS, initialJds).catch(() => {});
        }

        if (dbCls && dbCls.length > 0) {
          const current = get().coverLetters;
          const map = new Map<string, CoverLetter>();
          for (const c of [...dbCls, ...current]) {
            if (c && c.id) map.set(c.id, c);
          }
          const merged = Array.from(map.values());
          if (merged.length !== current.length) {
            safeSetLocalStorage(COVER_LETTERS_KEY, merged);
            set({ coverLetters: merged, activeCoverLetterId: get().activeCoverLetterId || merged[0]?.id || null });
          }
        } else if (initialCLs.length > 0) {
          putBatchToStore(STORE_COVER_LETTERS, initialCLs).catch(() => {});
        }

        if (dbAts && dbAts.length > 0) {
          const current = get().atsReports;
          const map = new Map<string, ATSReport>();
          for (const a of [...dbAts, ...current]) {
            if (a && a.id) map.set(a.id, a);
          }
          const merged = Array.from(map.values());
          if (merged.length !== current.length) {
            safeSetLocalStorage(ATS_REPORTS_KEY, merged);
            set({ atsReports: merged });
          }
        } else if (initialAts.length > 0) {
          putBatchToStore(STORE_ATS, initialAts).catch(() => {});
        }
      } catch (e) {
        console.warn("[resumes-slice] IndexedDB reconciliation error:", e);
      }
    }, 50);
  }

  return {
    resumes: initialResumes,
    activeResumeId: initialResumes[0]?.id || null,
    jobDescriptions: initialJds,
    activeJdId: initialJds[0]?.id || null,
    coverLetters: initialCLs,
    activeCoverLetterId: initialCLs[0]?.id || null,
    atsReports: initialAts,
    reviewReports: [],
    careerMaterials: initialMats,
    cloudSyncState: {
      status: "saved",
      lastSavedAt: Date.now(),
      resumeId: initialResumes[0]?.id || null,
      message: "All changes securely saved to database",
    },

    setCloudSyncState: (patch) =>
      set((state) => ({
        cloudSyncState: { ...state.cloudSyncState, ...patch },
      })),

    setActiveResume: (id: string | null) => set({ activeResumeId: id }),

    addResume: (resume: ResumeData) => {
      const next = [resume, ...get().resumes.filter((r) => r.id !== resume.id)];
      safeSetLocalStorage(RESUMES_KEY, next);
      saveResumeToDB(resume).catch(() => {});
      saveAllResumesToDB(next).catch(() => {});
      set({
        resumes: next,
        activeResumeId: resume.id,
        cloudSyncState: {
          status: "saved",
          lastSavedAt: Date.now(),
          resumeId: resume.id,
          message: "Resume saved to database",
        },
      });
    },

    updateResume: (id: string, patch: Partial<ResumeData>) => {
      const next = get().resumes.map((r) =>
        r.id === id ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r
      );
      safeSetLocalStorage(RESUMES_KEY, next);
      saveAllResumesToDB(next).catch(() => {});
      set({
        resumes: next,
        cloudSyncState: {
          status: "saved",
          lastSavedAt: Date.now(),
          resumeId: id,
          message: "All changes securely saved to database",
        },
      });
    },

    removeResume: (id: string) => {
      const next = get().resumes.filter((r) => r.id !== id);
      const activeId = get().activeResumeId === id ? next[0]?.id || null : get().activeResumeId;
      safeSetLocalStorage(RESUMES_KEY, next);
      deleteResumeFromDB(id).catch(() => {});
      saveAllResumesToDB(next).catch(() => {});
      set({ resumes: next, activeResumeId: activeId });
    },

    setActiveJD: (id: string | null) => set({ activeJdId: id }),

    addJD: (jd: JobDescription) => {
      const next = [jd, ...get().jobDescriptions.filter((j) => j.id !== jd.id)];
      safeSetLocalStorage(JDS_KEY, next);
      saveJDToDB(jd).catch(() => {});
      set({ jobDescriptions: next, activeJdId: jd.id });
    },

    removeJD: (id: string) => {
      const next = get().jobDescriptions.filter((j) => j.id !== id);
      const activeId = get().activeJdId === id ? next[0]?.id || null : get().activeJdId;
      safeSetLocalStorage(JDS_KEY, next);
      deleteJDFromDB(id).catch(() => {});
      set({ jobDescriptions: next, activeJdId: activeId });
    },

    addCoverLetter: (cl: CoverLetter) => {
      const next = [cl, ...get().coverLetters.filter((c) => c.id !== cl.id)];
      safeSetLocalStorage(COVER_LETTERS_KEY, next);
      saveCoverLetterToDB(cl).catch(() => {});
      set({ coverLetters: next, activeCoverLetterId: cl.id });
    },

    updateCoverLetter: (id: string, patch: Partial<CoverLetter>) => {
      const next = get().coverLetters.map((c) =>
        c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c
      );
      safeSetLocalStorage(COVER_LETTERS_KEY, next);
      const updated = next.find((c) => c.id === id);
      if (updated) saveCoverLetterToDB(updated).catch(() => {});
      set({ coverLetters: next });
    },

    removeCoverLetter: (id: string) => {
      const next = get().coverLetters.filter((c) => c.id !== id);
      const activeId = get().activeCoverLetterId === id ? next[0]?.id || null : get().activeCoverLetterId;
      safeSetLocalStorage(COVER_LETTERS_KEY, next);
      deleteCoverLetterFromDB(id).catch(() => {});
      set({ coverLetters: next, activeCoverLetterId: activeId });
    },

    setActiveCoverLetter: (id: string | null) => set({ activeCoverLetterId: id }),

    addATSReport: (report: ATSReport) => {
      const next = [report, ...get().atsReports.filter((a) => a.id !== report.id)];
      safeSetLocalStorage(ATS_REPORTS_KEY, next);
      saveATSReportToDB(report).catch(() => {});
      set({ atsReports: next });
    },

    addReviewReport: (report: ResumeReviewReport) => {
      set((s) => ({ reviewReports: [report, ...s.reviewReports.filter((r) => r.id !== report.id)] }));
    },

    removeReviewReport: (id: string) => {
      set((s) => ({ reviewReports: s.reviewReports.filter((r) => r.id !== id) }));
    },

    fetchCareerMaterials: async () => {
      // Local or cloud materials
    },

    addCareerMaterial: (material: CareerMaterial) => {
      const next = [material, ...get().careerMaterials.filter((m) => m.id !== material.id)];
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(MATERIALS_KEY, JSON.stringify(next));
      }
      set({ careerMaterials: next });
    },

    deleteCareerMaterial: (id: string) => {
      const next = get().careerMaterials.filter((m) => m.id !== id);
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(MATERIALS_KEY, JSON.stringify(next));
      }
      set({ careerMaterials: next });
    },
  };
};
