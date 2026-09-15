// ============================================================================
// Resume DB — Durable Local Persistence Engine (IndexedDB + Storage Sync)
// ============================================================================
// Provides database-grade local persistence:
// 1. 100% standalone, client-side persistence directly within AI Studio.
// 2. Survives browser refresh, cache clears, and memory limits without 5MB quota.
// 3. Dual-layer storage: IndexedDB for unbounded full-fidelity objects,
//    plus localStorage for instant synchronous fast-boot caching.
// 4. Zero external backend, Cloudflare D1, or external worker dependencies.
// ============================================================================

import type { ResumeData, JobDescription, ATSReport, CoverLetter, CareerMaterial, InterviewPackage } from "@/lib/types";

const DB_NAME = "ResumeEngineDB";
const DB_VERSION = 2;

export const STORE_RESUMES = "resumes";
export const STORE_JDS = "job_descriptions";
export const STORE_ATS = "ats_reports";
export const STORE_APPLICATIONS = "applications";
export const STORE_COVER_LETTERS = "cover_letters";
export const STORE_SETTINGS = "settings";
export const STORE_INTERVIEWS = "interviews";
export const STORE_MATERIALS = "career_materials";
export const STORE_AUDIT_LOGS = "audit_logs";

let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

export function isIndexedDBAvailable(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window;
}

export async function getResumeDB(): Promise<IDBDatabase> {
  if (!isIndexedDBAvailable()) {
    throw new Error("IndexedDB is not supported in this environment");
  }

  if (dbInstance) return dbInstance;
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = request.result;
      const stores = [
        STORE_RESUMES,
        STORE_JDS,
        STORE_ATS,
        STORE_APPLICATIONS,
        STORE_COVER_LETTERS,
        STORE_SETTINGS,
        STORE_INTERVIEWS,
        STORE_MATERIALS,
        STORE_AUDIT_LOGS,
      ];

      for (const storeName of stores) {
        if (!db.objectStoreNames.contains(storeName)) {
          const keyPath = storeName === STORE_SETTINGS ? "key" : "id";
          db.createObjectStore(storeName, { keyPath });
        }
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
        dbPromise = null;
      };
      resolve(dbInstance);
    };

    request.onerror = () => {
      console.warn("[resume-db] Failed to open IndexedDB database:", request.error);
      reject(request.error);
    };
  });

  return dbPromise;
}

// ============================================================================
// Generic Store Helpers
// ============================================================================

export async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  try {
    const db = await getResumeDB();
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
      req.onerror = () => {
        console.warn(`[resume-db] Error reading ${storeName}:`, req.error);
        resolve([]);
      };
    });
  } catch (err) {
    console.warn(`[resume-db] getAllFromStore(${storeName}) failed:`, err);
    return [];
  }
}

export async function putToStore<T extends Record<string, any>>(storeName: string, item: T): Promise<void> {
  if (!item) return;
  try {
    const db = await getResumeDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => {
        console.warn(`[resume-db] Error writing to ${storeName}:`, req.error);
        reject(req.error);
      };
    });
  } catch (err) {
    console.warn(`[resume-db] putToStore(${storeName}) failed:`, err);
  }
}

export async function putBatchToStore<T extends Record<string, any>>(storeName: string, items: T[]): Promise<void> {
  if (!Array.isArray(items) || items.length === 0) return;
  try {
    const db = await getResumeDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      for (const item of items) {
        if (item) store.put(item);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        console.warn(`[resume-db] Error batch-writing to ${storeName}:`, tx.error);
        reject(tx.error);
      };
    });
  } catch (err) {
    console.warn(`[resume-db] putBatchToStore(${storeName}) failed:`, err);
  }
}

export async function deleteFromStore(storeName: string, key: string): Promise<void> {
  if (!key) return;
  try {
    const db = await getResumeDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => {
        console.warn(`[resume-db] Error deleting key "${key}" from ${storeName}:`, req.error);
        reject(req.error);
      };
    });
  } catch (err) {
    console.warn(`[resume-db] deleteFromStore(${storeName}, ${key}) failed:`, err);
  }
}

// ============================================================================
// Resumes
// ============================================================================

export async function getAllResumesFromDB(): Promise<ResumeData[]> {
  return getAllFromStore<ResumeData>(STORE_RESUMES);
}

export async function saveResumeToDB(resume: ResumeData): Promise<void> {
  if (!resume || !resume.id) return;
  await putToStore(STORE_RESUMES, resume);
}

export async function saveAllResumesToDB(resumes: ResumeData[]): Promise<void> {
  await putBatchToStore(STORE_RESUMES, resumes);
}

export async function deleteResumeFromDB(id: string): Promise<void> {
  await deleteFromStore(STORE_RESUMES, id);
}

// ============================================================================
// Job Descriptions
// ============================================================================

export async function getAllJDsFromDB(): Promise<JobDescription[]> {
  return getAllFromStore<JobDescription>(STORE_JDS);
}

export async function saveJDToDB(jd: JobDescription): Promise<void> {
  if (!jd || !jd.id) return;
  await putToStore(STORE_JDS, jd);
}

export async function deleteJDFromDB(id: string): Promise<void> {
  await deleteFromStore(STORE_JDS, id);
}

// ============================================================================
// ATS Reports
// ============================================================================

export async function getAllATSReportsFromDB(): Promise<ATSReport[]> {
  return getAllFromStore<ATSReport>(STORE_ATS);
}

export async function saveATSReportToDB(report: ATSReport): Promise<void> {
  if (!report || !report.id) return;
  await putToStore(STORE_ATS, report);
}

// ============================================================================
// Applications (Job Tracker)
// ============================================================================

export async function getAllApplicationsFromDB<T = any>(): Promise<T[]> {
  return getAllFromStore<T>(STORE_APPLICATIONS);
}

export async function saveApplicationToDB<T extends Record<string, any>>(app: T): Promise<void> {
  if (!app || !app.id) return;
  await putToStore(STORE_APPLICATIONS, app);
}

export async function saveAllApplicationsToDB<T extends Record<string, any>>(apps: T[]): Promise<void> {
  await putBatchToStore(STORE_APPLICATIONS, apps);
}

export async function deleteApplicationFromDB(id: string): Promise<void> {
  await deleteFromStore(STORE_APPLICATIONS, id);
}

// ============================================================================
// Cover Letters
// ============================================================================

export async function getAllCoverLettersFromDB(): Promise<CoverLetter[]> {
  return getAllFromStore<CoverLetter>(STORE_COVER_LETTERS);
}

export async function saveCoverLetterToDB(cl: CoverLetter): Promise<void> {
  if (!cl || !cl.id) return;
  await putToStore(STORE_COVER_LETTERS, cl);
}

export async function deleteCoverLetterFromDB(id: string): Promise<void> {
  await deleteFromStore(STORE_COVER_LETTERS, id);
}

// ============================================================================
// Settings & Key-Value Configuration
// ============================================================================

export async function getSettingFromDB<T = any>(key: string): Promise<T | null> {
  try {
    const db = await getResumeDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_SETTINGS, "readonly");
      const store = tx.objectStore(STORE_SETTINGS);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function saveSettingToDB(key: string, value: any): Promise<void> {
  await putToStore(STORE_SETTINGS, { key, value, updatedAt: new Date().toISOString() });
}

// ============================================================================
// Safe LocalStorage Fallback (Dual-layer resilience)
// ============================================================================

export function safeSetLocalStorage<T>(key: string, data: T): void {
  if (typeof window === "undefined" || !window.localStorage) return;

  try {
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch (quotaErr) {
    console.warn(`[storage] Quota exceeded for key "${key}", attempting pruned save:`, quotaErr);
    try {
      if (Array.isArray(data)) {
        const pruned = data.map((item) => {
          if (item && typeof item === "object" && "rawText" in item) {
            const { rawText, ...rest } = item;
            return rest;
          }
          return item;
        });
        window.localStorage.setItem(key, JSON.stringify(pruned));
      }
    } catch (fallbackErr) {
      console.error(`[storage] Failed to save even pruned data to localStorage:`, fallbackErr);
    }
  }
}

export function safeGetLocalStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined" || !window.localStorage) return fallback;
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}
