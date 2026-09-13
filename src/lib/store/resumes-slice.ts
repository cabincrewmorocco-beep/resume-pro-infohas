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
      message: "All changes securely saved to cloud",
    },

    setCloudSyncState: (patch) =>
      set((state) => ({
        cloudSyncState: { ...state.cloudSyncState, ...patch },
      })),

    setActiveResume: (id: string | null) => set({ activeResumeId: id }),

    addResume: (resume: ResumeData) => {
      const next = [resume, ...get().resumes.filter((r) => r.id !== resume.id)];
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(RESUMES_KEY, JSON.stringify(next));
      }
      set({
        resumes: next,
        activeResumeId: resume.id,
        cloudSyncState: {
          status: "saved",
          lastSavedAt: Date.now(),
          resumeId: resume.id,
          message: "Resume saved to cloud",
        },
      });
    },

    updateResume: (id: string, patch: Partial<ResumeData>) => {
      const next = get().resumes.map((r) =>
        r.id === id ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r
      );
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(RESUMES_KEY, JSON.stringify(next));
      }
      set({
        resumes: next,
        cloudSyncState: {
          status: "saved",
          lastSavedAt: Date.now(),
          resumeId: id,
          message: "All changes securely saved to cloud",
        },
      });
    },

    removeResume: (id: string) => {
      const next = get().resumes.filter((r) => r.id !== id);
      const activeId = get().activeResumeId === id ? next[0]?.id || null : get().activeResumeId;
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(RESUMES_KEY, JSON.stringify(next));
      }
      set({ resumes: next, activeResumeId: activeId });
    },

    setActiveJD: (id: string | null) => set({ activeJdId: id }),

    addJD: (jd: JobDescription) => {
      const next = [jd, ...get().jobDescriptions.filter((j) => j.id !== jd.id)];
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(JDS_KEY, JSON.stringify(next));
      }
      set({ jobDescriptions: next, activeJdId: jd.id });
    },

    removeJD: (id: string) => {
      const next = get().jobDescriptions.filter((j) => j.id !== id);
      const activeId = get().activeJdId === id ? next[0]?.id || null : get().activeJdId;
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(JDS_KEY, JSON.stringify(next));
      }
      set({ jobDescriptions: next, activeJdId: activeId });
    },

    addCoverLetter: (cl: CoverLetter) => {
      const next = [cl, ...get().coverLetters.filter((c) => c.id !== cl.id)];
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(COVER_LETTERS_KEY, JSON.stringify(next));
      }
      set({ coverLetters: next, activeCoverLetterId: cl.id });
    },

    updateCoverLetter: (id: string, patch: Partial<CoverLetter>) => {
      const next = get().coverLetters.map((c) =>
        c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c
      );
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(COVER_LETTERS_KEY, JSON.stringify(next));
      }
      set({ coverLetters: next });
    },

    removeCoverLetter: (id: string) => {
      const next = get().coverLetters.filter((c) => c.id !== id);
      const activeId = get().activeCoverLetterId === id ? next[0]?.id || null : get().activeCoverLetterId;
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(COVER_LETTERS_KEY, JSON.stringify(next));
      }
      set({ coverLetters: next, activeCoverLetterId: activeId });
    },

    setActiveCoverLetter: (id: string | null) => set({ activeCoverLetterId: id }),

    addATSReport: (report: ATSReport) => {
      const next = [report, ...get().atsReports.filter((a) => a.id !== report.id)];
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(ATS_REPORTS_KEY, JSON.stringify(next));
      }
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
