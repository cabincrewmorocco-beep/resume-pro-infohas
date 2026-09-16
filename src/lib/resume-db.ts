// ============================================================================
// ResumeAI Pro — Local IndexedDB Database Engine & Storage Helper
// Provides durable, asynchronous client-side storage with localStorage fallback
// ============================================================================

export const DB_NAME = "ResumeEngineDB";
export const DB_VERSION = 2;

export const STORE_RESUMES = "resumes";
export const STORE_JDS = "job_descriptions";
export const STORE_COVER_LETTERS = "cover_letters";
export const STORE_ATS = "ats_reports";
export const STORE_APPLICATIONS = "applications";
export const STORE_INTERVIEWS = "interviews";
export const STORE_MATERIALS = "materials";
export const STORE_AUDIT_LOGS = "audit_logs";
export const STORE_SETTINGS = "settings";

const ALL_STORES = [
  STORE_RESUMES,
  STORE_JDS,
  STORE_COVER_LETTERS,
  STORE_ATS,
  STORE_APPLICATIONS,
  STORE_INTERVIEWS,
  STORE_MATERIALS,
  STORE_AUDIT_LOGS,
  STORE_SETTINGS,
];

let dbPromise: Promise<IDBDatabase | null> | null = null;

export function isIndexedDBAvailable(): boolean {
  try {
    return typeof window !== "undefined" && "indexedDB" in window && window.indexedDB !== null;
  } catch {
    return false;
  }
}

export function safeGetLocalStorage<T = any>(key: string, fallback: T): T {
  try {
    if (typeof window === "undefined" || !window.localStorage) return fallback;
    const item = window.localStorage.getItem(key);
    if (!item) return fallback;
    return JSON.parse(item) as T;
  } catch {
    return fallback;
  }
}

export function safeSetLocalStorage(key: string, value: any): boolean {
  try {
    if (typeof window === "undefined" || !window.localStorage) return false;
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn(`[storage] LocalStorage write failed for key "${key}":`, err);
    return false;
  }
}

function openDB(): Promise<IDBDatabase | null> {
  if (!isIndexedDBAvailable()) return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        ALL_STORES.forEach((storeName) => {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: "id" });
          }
        });
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = (err) => {
        console.warn("[resume-db] Failed to open IndexedDB:", err);
        resolve(null);
      };

      request.onblocked = () => {
        console.warn("[resume-db] IndexedDB open blocked");
      };
    } catch (e) {
      console.warn("[resume-db] Unexpected error opening IndexedDB:", e);
      resolve(null);
    }
  });

  return dbPromise;
}

export async function getAllFromStore<T = any>(storeName: string): Promise<T[]> {
  const db = await openDB();
  if (!db) return [];

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.getAll();

      req.onsuccess = () => resolve((req.result as T[]) || []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export async function putToStore<T extends { id: string }>(storeName: string, item: T): Promise<boolean> {
  if (!item || !item.id) return false;
  const db = await openDB();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.put(item);

      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function putBatchToStore<T extends { id: string }>(storeName: string, items: T[]): Promise<boolean> {
  if (!items || items.length === 0) return true;
  const db = await openDB();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);

      items.forEach((item) => {
        if (item && item.id) {
          store.put(item);
        }
      });

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function deleteFromStore(storeName: string, id: string): Promise<boolean> {
  if (!id) return false;
  const db = await openDB();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.delete(id);

      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

// ============================================================================
// Domain Specific DB Helpers
// ============================================================================

// Resumes
export async function getAllResumesFromDB<T = any>(): Promise<T[]> {
  const fromIDB = await getAllFromStore<T>(STORE_RESUMES);
  if (fromIDB && fromIDB.length > 0) return fromIDB;
  return safeGetLocalStorage<T[]>("resumeai_resumes", []);
}

export async function saveResumeToDB<T extends { id: string }>(resume: T): Promise<boolean> {
  if (!resume || !resume.id) return false;
  return putToStore(STORE_RESUMES, resume);
}

export async function saveAllResumesToDB<T extends { id: string }>(resumes: T[]): Promise<boolean> {
  return putBatchToStore(STORE_RESUMES, resumes);
}

export async function deleteResumeFromDB(id: string): Promise<boolean> {
  return deleteFromStore(STORE_RESUMES, id);
}

// Job Descriptions
export async function getAllJDsFromDB<T = any>(): Promise<T[]> {
  const fromIDB = await getAllFromStore<T>(STORE_JDS);
  if (fromIDB && fromIDB.length > 0) return fromIDB;
  return safeGetLocalStorage<T[]>("resumeai_jds", []);
}

export async function saveJDToDB<T extends { id: string }>(jd: T): Promise<boolean> {
  if (!jd || !jd.id) return false;
  return putToStore(STORE_JDS, jd);
}

export async function deleteJDFromDB(id: string): Promise<boolean> {
  return deleteFromStore(STORE_JDS, id);
}

// Cover Letters
export async function getAllCoverLettersFromDB<T = any>(): Promise<T[]> {
  const fromIDB = await getAllFromStore<T>(STORE_COVER_LETTERS);
  if (fromIDB && fromIDB.length > 0) return fromIDB;
  return safeGetLocalStorage<T[]>("resumeai_cover_letters", []);
}

export async function saveCoverLetterToDB<T extends { id: string }>(cl: T): Promise<boolean> {
  if (!cl || !cl.id) return false;
  return putToStore(STORE_COVER_LETTERS, cl);
}

export async function deleteCoverLetterFromDB(id: string): Promise<boolean> {
  return deleteFromStore(STORE_COVER_LETTERS, id);
}

// ATS Reports
export async function getAllATSReportsFromDB<T = any>(): Promise<T[]> {
  const fromIDB = await getAllFromStore<T>(STORE_ATS);
  if (fromIDB && fromIDB.length > 0) return fromIDB;
  return safeGetLocalStorage<T[]>("resumeai_ats_reports", []);
}

export async function saveATSReportToDB<T extends { id: string }>(report: T): Promise<boolean> {
  if (!report || !report.id) return false;
  return putToStore(STORE_ATS, report);
}

// Applications
export async function getAllApplicationsFromDB<T = any>(): Promise<T[]> {
  const fromIDB = await getAllFromStore<T>(STORE_APPLICATIONS);
  if (fromIDB && fromIDB.length > 0) return fromIDB;
  return safeGetLocalStorage<T[]>("resumeai_applications", []);
}

export async function saveApplicationToDB<T extends { id: string }>(app: T): Promise<boolean> {
  if (!app || !app.id) return false;
  return putToStore(STORE_APPLICATIONS, app);
}

export async function saveAllApplicationsToDB<T extends { id: string }>(apps: T[]): Promise<boolean> {
  return putBatchToStore(STORE_APPLICATIONS, apps);
}

export async function deleteApplicationFromDB(id: string): Promise<boolean> {
  return deleteFromStore(STORE_APPLICATIONS, id);
}

// Settings
export async function getSettingFromDB<T = any>(key: string, fallback: T = null as unknown as T): Promise<T> {
  const all = await getAllFromStore<{ id: string; value: any }>(STORE_SETTINGS);
  const found = all.find((s) => s.id === key);
  if (found) return found.value as T;
  return safeGetLocalStorage(`resumeai_setting_${key}`, fallback);
}

export async function saveSettingToDB(key: string, value: any): Promise<boolean> {
  return putToStore(STORE_SETTINGS, { id: key, value });
}
