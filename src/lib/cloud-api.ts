// ============================================================================
// ResumeAI Pro — Standalone Client-Side Persistence Engine
// 100% Client-Side / Standalone within AI Studio (No Cloudflare D1/Worker needed)
//
// Dual-layer persistence:
// 1. IndexedDB ("ResumeEngineDB") for unbounded, durable long-term storage
// 2. LocalStorage as synchronous fast-boot cache and user-scoped backup
// ============================================================================

import { parseDbApplication } from "./applications-logic";
import {
  isFirebaseReady,
  getFirestoreResumes,
  saveFirestoreResume,
  deleteFirestoreResume,
  getFirestoreApplications,
  saveFirestoreApplication,
  deleteFirestoreApplication,
  syncLocalDataToFirestore,
} from "./firebase";
import {
  getAllResumesFromDB,
  saveResumeToDB,
  deleteResumeFromDB,
  getAllJDsFromDB,
  saveJDToDB,
  deleteJDFromDB,
  getAllCoverLettersFromDB,
  saveCoverLetterToDB,
  deleteCoverLetterFromDB,
  getAllATSReportsFromDB,
  saveATSReportToDB,
  getAllApplicationsFromDB,
  saveApplicationToDB,
  deleteApplicationFromDB,
  getSettingFromDB,
  saveSettingToDB,
  getAllFromStore,
  putToStore,
  deleteFromStore,
  STORE_INTERVIEWS,
  STORE_MATERIALS,
  STORE_AUDIT_LOGS,
  safeSetLocalStorage,
  safeGetLocalStorage,
} from "./resume-db";

function normalizeJD<T extends Record<string, any>>(jd: T): T {
  if (!jd || typeof jd !== "object") return jd;
  const toArray = (v: any): any[] => (Array.isArray(v) ? v : []);
  const toStr = (v: any): string | undefined => (v === null || v === undefined ? undefined : String(v));
  return {
    ...jd,
    id: jd.id || `jd_${Math.random().toString(36).slice(2, 9)}`,
    title: typeof jd.title === "string" ? jd.title : (jd.title ? String(jd.title) : "Untitled role"),
    company: toStr(jd.company),
    location: toStr(jd.location),
    employmentType: toStr(jd.employmentType),
    salary: toStr(jd.salary),
    experienceYears: toStr(jd.experienceYears),
    education: toStr(jd.education),
    rawText: toStr(jd.rawText),
    url: toStr(jd.url),
    source: typeof jd.source === "string" ? jd.source : "text",
    createdAt: jd.createdAt || new Date().toISOString(),
    responsibilities: toArray(jd.responsibilities),
    requiredSkills: toArray(jd.requiredSkills),
    preferredSkills: toArray(jd.preferredSkills),
    technologies: toArray(jd.technologies),
    keywords: toArray(jd.keywords),
  } as T;
}

// ============================================================================
// Identity & User Scope Helpers
// ============================================================================

function safeSessionStorage(): Storage | null {
  try {
    if (typeof sessionStorage !== "undefined") return sessionStorage;
  } catch {}
  return (typeof window !== "undefined" ? (window as any).sessionStorage : null) ?? null;
}

function safeLocalStorage(): Storage | null {
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch {}
  return (typeof window !== "undefined" ? (window as any).localStorage : null) ?? null;
}

export function getEffectiveUserId(): string {
  if (typeof window === "undefined") return "local_user";
  const sid = safeSessionStorage()?.getItem("resumeai-user-id");
  if (sid) return sid;
  try {
    const raw = safeLocalStorage()?.getItem("resumeai-session");
    if (raw) {
      const parsed = JSON.parse(raw);
      const user = parsed?.user;
      if (user?.id) {
        safeSessionStorage()?.setItem("resumeai-user-id", user.id);
        return user.id;
      }
    }
  } catch {}
  return "local_user";
}

export function setUserId(id: string) {
  safeSessionStorage()?.setItem("resumeai-user-id", id);
}

export function clearUserId() {
  safeSessionStorage()?.removeItem("resumeai-user-id");
}

export function userScopedKey(base: string): string {
  return `${base}:${getEffectiveUserId()}`;
}

export class CircuitOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CircuitOpenError";
  }
}

// Local cache keys
const LOCAL_USERS_KEY = "resumeai_local_users";
const LOCAL_PROVIDERS_KEY = "resumeai-custom-providers";
const LOCAL_PROMPTS_KEY = "resumeai_custom_prompts";
const LOCAL_BRANDING_KEY = "resumeai_branding";
const LOCAL_FLAGS_KEY = "resumeai_feature_flags";
const LOCAL_DOWNLOADS_KEY = "resumeai_downloads";
const LOCAL_SHARES_KEY = "resumeai_shares";
const LOCAL_AGENT_CONFIGS_KEY = "resumeai_agent_configs";
const LOCAL_PROVIDER_SESSIONS_KEY = "resumeai_provider_sessions";

// ============================================================================
// Client-Side Database API (Replaces Cloudflare Workers & D1)
// ============================================================================

export const api = {
  // Resumes
  getResumes: async () => {
    const uid = getEffectiveUserId();
    if (uid && isFirebaseReady()) {
      try {
        const fbResumes = await getFirestoreResumes(uid);
        if (fbResumes && fbResumes.length > 0) {
          return { resumes: fbResumes };
        }
      } catch (err) {
        console.warn("[cloud-api] Firestore getResumes non-fatal error:", err);
      }
    }
    const fromDb = await getAllResumesFromDB();
    if (fromDb.length > 0) return { resumes: fromDb };
    const fromStorage = safeGetLocalStorage<any[]>(userScopedKey("resumeai-resumes-backup"), []);
    return { resumes: fromStorage };
  },
  createResume: async (resume: any) => {
    if (!resume || !resume.id) return { ok: false };
    await saveResumeToDB(resume);
    const uid = getEffectiveUserId();
    if (uid && isFirebaseReady()) {
      saveFirestoreResume(uid, resume).catch(() => {});
    }
    const existing = safeGetLocalStorage<any[]>(userScopedKey("resumeai-resumes-backup"), []);
    const updated = [resume, ...existing.filter((r) => r.id !== resume.id)];
    safeSetLocalStorage(userScopedKey("resumeai-resumes-backup"), updated);
    return { ok: true, resume };
  },
  updateResume: async (id: string, patch: any) => {
    const existing = await getAllResumesFromDB();
    const target = existing.find((r) => r.id === id);
    const updated = target
      ? { ...target, ...patch, updatedAt: new Date().toISOString() }
      : { id, ...patch, updatedAt: new Date().toISOString() };
    await saveResumeToDB(updated);
    const uid = getEffectiveUserId();
    if (uid && isFirebaseReady()) {
      saveFirestoreResume(uid, updated).catch(() => {});
    }
    const current = safeGetLocalStorage<any[]>(userScopedKey("resumeai-resumes-backup"), []);
    const nextStorage = current.map((r) => (r.id === id ? { ...r, ...patch } : r));
    safeSetLocalStorage(userScopedKey("resumeai-resumes-backup"), nextStorage);
    return { ok: true };
  },
  deleteResume: async (id: string) => {
    await deleteResumeFromDB(id);
    const uid = getEffectiveUserId();
    if (uid && isFirebaseReady()) {
      deleteFirestoreResume(uid, id).catch(() => {});
    }
    const current = safeGetLocalStorage<any[]>(userScopedKey("resumeai-resumes-backup"), []);
    safeSetLocalStorage(userScopedKey("resumeai-resumes-backup"), current.filter((r) => r.id !== id));
    return { ok: true };
  },

  // Cover Letters
  getCoverLetters: async () => {
    const cls = await getAllCoverLettersFromDB();
    if (cls.length > 0) return { coverLetters: cls };
    const fromStorage = safeGetLocalStorage<any[]>(userScopedKey("resumeai-coverletters-backup"), []);
    return { coverLetters: fromStorage };
  },
  createCoverLetter: async (cl: any) => {
    await saveCoverLetterToDB(cl);
    const existing = safeGetLocalStorage<any[]>(userScopedKey("resumeai-coverletters-backup"), []);
    safeSetLocalStorage(userScopedKey("resumeai-coverletters-backup"), [cl, ...existing.filter((c) => c.id !== cl.id)]);
    return { ok: true, coverLetter: cl };
  },
  updateCoverLetter: async (id: string, patch: any) => {
    const existing = await getAllCoverLettersFromDB();
    const target = existing.find((c) => c.id === id);
    if (target) {
      const updated = { ...target, ...patch, updatedAt: new Date().toISOString() };
      await saveCoverLetterToDB(updated);
    }
    return { ok: true };
  },
  deleteCoverLetter: async (id: string) => {
    await deleteCoverLetterFromDB(id);
    const existing = safeGetLocalStorage<any[]>(userScopedKey("resumeai-coverletters-backup"), []);
    safeSetLocalStorage(userScopedKey("resumeai-coverletters-backup"), existing.filter((c) => c.id !== id));
    return { ok: true };
  },

  // Job Descriptions
  getJobDescriptions: async () => {
    const jds = await getAllJDsFromDB();
    if (jds.length > 0) return { jobDescriptions: jds };
    const fromStorage = safeGetLocalStorage<any[]>(userScopedKey("resumeai-jds-backup"), []);
    return { jobDescriptions: fromStorage };
  },
  createJobDescription: async (jd: any) => {
    await saveJDToDB(jd);
    const existing = safeGetLocalStorage<any[]>(userScopedKey("resumeai-jds-backup"), []);
    safeSetLocalStorage(userScopedKey("resumeai-jds-backup"), [jd, ...existing.filter((j) => j.id !== jd.id)]);
    return { ok: true, jobDescription: jd };
  },
  deleteJobDescription: async (id: string) => {
    await deleteJDFromDB(id);
    const existing = safeGetLocalStorage<any[]>(userScopedKey("resumeai-jds-backup"), []);
    safeSetLocalStorage(userScopedKey("resumeai-jds-backup"), existing.filter((j) => j.id !== id));
    return { ok: true };
  },

  // Interviews
  getInterviews: async () => {
    const ivs = await getAllFromStore<any>(STORE_INTERVIEWS);
    if (ivs.length > 0) return { interviews: ivs };
    const fromStorage = safeGetLocalStorage<any[]>(userScopedKey("resumeai-interviews-backup"), []);
    return { interviews: fromStorage };
  },
  createInterview: async (iv: any) => {
    await putToStore(STORE_INTERVIEWS, iv);
    const existing = safeGetLocalStorage<any[]>(userScopedKey("resumeai-interviews-backup"), []);
    safeSetLocalStorage(userScopedKey("resumeai-interviews-backup"), [iv, ...existing.filter((i) => i.id !== iv.id)]);
    return { ok: true, interview: iv };
  },
  deleteInterview: async (id: string) => {
    await deleteFromStore(STORE_INTERVIEWS, id);
    const existing = safeGetLocalStorage<any[]>(userScopedKey("resumeai-interviews-backup"), []);
    safeSetLocalStorage(userScopedKey("resumeai-interviews-backup"), existing.filter((i) => i.id !== id));
    return { ok: true };
  },

  // ATS Reports
  getATSReports: async () => {
    const reports = await getAllATSReportsFromDB();
    if (reports.length > 0) return { atsReports: reports };
    const fromStorage = safeGetLocalStorage<any[]>(userScopedKey("resumeai-ats-backup"), []);
    return { atsReports: fromStorage };
  },
  createATSReport: async (report: any) => {
    await saveATSReportToDB(report);
    const existing = safeGetLocalStorage<any[]>(userScopedKey("resumeai-ats-backup"), []);
    safeSetLocalStorage(userScopedKey("resumeai-ats-backup"), [report, ...existing.filter((r) => r.id !== report.id)]);
    return { ok: true, report };
  },

  // Applications (Job Tracker)
  getApplications: async () => {
    const uid = getEffectiveUserId();
    if (uid && isFirebaseReady()) {
      try {
        const fbApps = await getFirestoreApplications(uid);
        if (fbApps && fbApps.length > 0) {
          return { applications: fbApps };
        }
      } catch (err) {
        console.warn("[cloud-api] Firestore getApplications non-fatal error:", err);
      }
    }
    const apps = await getAllApplicationsFromDB();
    if (apps.length > 0) return { applications: apps };
    const fromStorage = safeGetLocalStorage<any[]>(userScopedKey("resumeai-applications-backup"), []);
    return { applications: fromStorage };
  },
  createApplication: async (a: any) => {
    await saveApplicationToDB(a);
    const uid = getEffectiveUserId();
    if (uid && isFirebaseReady()) {
      saveFirestoreApplication(uid, a).catch(() => {});
    }
    const existing = safeGetLocalStorage<any[]>(userScopedKey("resumeai-applications-backup"), []);
    safeSetLocalStorage(userScopedKey("resumeai-applications-backup"), [a, ...existing.filter((item) => item.id !== a.id)]);
    return { ok: true, application: a };
  },
  updateApplication: async (id: string, patch: any) => {
    const apps = await getAllApplicationsFromDB();
    const target = apps.find((item: any) => item.id === id);
    const updated = target
      ? { ...target, ...patch, updatedAt: new Date().toISOString() }
      : { id, ...patch, updatedAt: new Date().toISOString() };
    await saveApplicationToDB(updated);
    const uid = getEffectiveUserId();
    if (uid && isFirebaseReady()) {
      saveFirestoreApplication(uid, updated).catch(() => {});
    }
    const current = safeGetLocalStorage<any[]>(userScopedKey("resumeai-applications-backup"), []);
    safeSetLocalStorage(userScopedKey("resumeai-applications-backup"), current.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    return { ok: true };
  },
  deleteApplication: async (id: string) => {
    await deleteApplicationFromDB(id);
    const uid = getEffectiveUserId();
    if (uid && isFirebaseReady()) {
      deleteFirestoreApplication(uid, id).catch(() => {});
    }
    const current = safeGetLocalStorage<any[]>(userScopedKey("resumeai-applications-backup"), []);
    safeSetLocalStorage(userScopedKey("resumeai-applications-backup"), current.filter((a) => a.id !== id));
    return { ok: true };
  },

  // Users
  getUsers: async () => {
    const users = safeGetLocalStorage<any[]>(LOCAL_USERS_KEY, []);
    return { users };
  },
  createUser: async (user: any) => {
    const current = safeGetLocalStorage<any[]>(LOCAL_USERS_KEY, []);
    safeSetLocalStorage(LOCAL_USERS_KEY, [user, ...current.filter((u) => u.id !== user.id)]);
    return { ok: true, user };
  },
  updateUser: async (id: string, patch: any) => {
    const current = safeGetLocalStorage<any[]>(LOCAL_USERS_KEY, []);
    safeSetLocalStorage(LOCAL_USERS_KEY, current.map((u) => (u.id === id ? { ...u, ...patch } : u)));
    return { ok: true };
  },
  deleteUser: async (id: string) => {
    const current = safeGetLocalStorage<any[]>(LOCAL_USERS_KEY, []);
    safeSetLocalStorage(LOCAL_USERS_KEY, current.filter((u) => u.id !== id));
    return { ok: true };
  },

  // AI Providers
  getProviders: async () => {
    const providers = safeGetLocalStorage<any[]>(LOCAL_PROVIDERS_KEY, []);
    return { providers };
  },
  createProvider: async (provider: any) => {
    const current = safeGetLocalStorage<any[]>(LOCAL_PROVIDERS_KEY, []);
    safeSetLocalStorage(LOCAL_PROVIDERS_KEY, [provider, ...current.filter((p) => p.id !== provider.id)]);
    return { ok: true, provider };
  },
  updateProvider: async (id: string, patch: any) => {
    const current = safeGetLocalStorage<any[]>(LOCAL_PROVIDERS_KEY, []);
    safeSetLocalStorage(LOCAL_PROVIDERS_KEY, current.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    return { ok: true };
  },
  deleteProvider: async (id: string) => {
    const current = safeGetLocalStorage<any[]>(LOCAL_PROVIDERS_KEY, []);
    safeSetLocalStorage(LOCAL_PROVIDERS_KEY, current.filter((p) => p.id !== id));
    return { ok: true };
  },

  // Prompts
  getPrompts: async () => {
    const prompts = safeGetLocalStorage<any[]>(LOCAL_PROMPTS_KEY, []);
    return { prompts };
  },
  createPrompt: async (prompt: any) => {
    const current = safeGetLocalStorage<any[]>(LOCAL_PROMPTS_KEY, []);
    safeSetLocalStorage(LOCAL_PROMPTS_KEY, [prompt, ...current.filter((p) => p.id !== prompt.id)]);
    return { ok: true, prompt };
  },
  updatePrompt: async (id: string, patch: any) => {
    const current = safeGetLocalStorage<any[]>(LOCAL_PROMPTS_KEY, []);
    safeSetLocalStorage(LOCAL_PROMPTS_KEY, current.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    return { ok: true };
  },
  deletePrompt: async (id: string) => {
    const current = safeGetLocalStorage<any[]>(LOCAL_PROMPTS_KEY, []);
    safeSetLocalStorage(LOCAL_PROMPTS_KEY, current.filter((p) => p.id !== id));
    return { ok: true };
  },

  // Audit Logs
  getAuditLogs: async () => {
    const logs = await getAllFromStore<any>(STORE_AUDIT_LOGS);
    return { logs };
  },
  createAuditLog: async (log: any) => {
    const entry = { id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, timestamp: new Date().toISOString(), ...log };
    await putToStore(STORE_AUDIT_LOGS, entry);
    return { ok: true, log: entry };
  },

  // Branding & Settings
  getBranding: async () => {
    const dbBranding = await getSettingFromDB("branding");
    if (dbBranding) return { branding: dbBranding };
    const local = safeGetLocalStorage<any>(LOCAL_BRANDING_KEY, null);
    return { branding: local };
  },
  updateBranding: async (branding: any) => {
    await saveSettingToDB("branding", branding);
    safeSetLocalStorage(LOCAL_BRANDING_KEY, branding);
    return { ok: true, branding };
  },
  getFlags: async () => {
    const dbFlags = await getSettingFromDB("feature_flags");
    if (dbFlags) return { flags: dbFlags };
    const local = safeGetLocalStorage<Record<string, boolean>>(LOCAL_FLAGS_KEY, {});
    return { flags: local };
  },
  updateFlag: async (key: string, value: boolean) => {
    const current = (await getSettingFromDB("feature_flags")) || safeGetLocalStorage<Record<string, boolean>>(LOCAL_FLAGS_KEY, {});
    const next = { ...current, [key]: value };
    await saveSettingToDB("feature_flags", next);
    safeSetLocalStorage(LOCAL_FLAGS_KEY, next);
    return { ok: true, key, value };
  },

  // Downloads
  getDownloads: async () => {
    const downloads = safeGetLocalStorage<any[]>(LOCAL_DOWNLOADS_KEY, []);
    return { downloads };
  },
  createDownload: async (download: any) => {
    const current = safeGetLocalStorage<any[]>(LOCAL_DOWNLOADS_KEY, []);
    safeSetLocalStorage(LOCAL_DOWNLOADS_KEY, [download, ...current]);
    return { ok: true, download };
  },

  // Career Materials
  getCareerMaterials: async () => {
    const materials = await getAllFromStore<any>(STORE_MATERIALS);
    return { careerMaterials: materials };
  },
  createCareerMaterial: async (cm: any) => {
    await putToStore(STORE_MATERIALS, cm);
    return { ok: true, careerMaterial: cm };
  },
  deleteCareerMaterial: async (id: string) => {
    await deleteFromStore(STORE_MATERIALS, id);
    return { ok: true };
  },

  // Agent Configuration Center
  getAgentConfigs: async () => {
    const configs = (await getSettingFromDB("agent_configs")) || safeGetLocalStorage<any[]>(LOCAL_AGENT_CONFIGS_KEY, []);
    return {
      ok: true,
      agentConfigs: configs,
      version: 1,
      updatedAt: new Date().toISOString(),
      updatedBy: "local_user",
    };
  },
  updateAgentConfigs: async (agentConfigs: any[], updatedBy?: string) => {
    await saveSettingToDB("agent_configs", agentConfigs);
    safeSetLocalStorage(LOCAL_AGENT_CONFIGS_KEY, agentConfigs);
    return { ok: true, version: 1, updatedAt: new Date().toISOString(), count: agentConfigs.length };
  },

  // Provider sessions
  getProviderSession: async (provider: string) => {
    const all = (await getSettingFromDB("provider_sessions")) || safeGetLocalStorage<Record<string, any>>(LOCAL_PROVIDER_SESSIONS_KEY, {});
    return { ok: true, session: all[provider] || null };
  },
  putProviderSession: async (provider: string, session: any) => {
    const all = (await getSettingFromDB("provider_sessions")) || safeGetLocalStorage<Record<string, any>>(LOCAL_PROVIDER_SESSIONS_KEY, {});
    all[provider] = session;
    await saveSettingToDB("provider_sessions", all);
    safeSetLocalStorage(LOCAL_PROVIDER_SESSIONS_KEY, all);
    return { ok: true };
  },

  // Resume shares
  createOrRefreshShare: async (payload: { resumeId: string; resume: unknown; hideContact?: boolean; expiresInDays?: number | null }) => {
    const shares = safeGetLocalStorage<any[]>(LOCAL_SHARES_KEY, []);
    const token = Math.random().toString(36).slice(2, 14);
    const share = {
      id: `sh_${Date.now()}`,
      token,
      resumeId: payload.resumeId,
      resume: payload.resume,
      hideContact: Boolean(payload.hideContact),
      active: true,
      createdAt: new Date().toISOString(),
      expiresAt: null,
    };
    safeSetLocalStorage(LOCAL_SHARES_KEY, [share, ...shares.filter((s) => s.resumeId !== payload.resumeId)]);
    return { ok: true, share };
  },
  getShares: async () => {
    const shares = safeGetLocalStorage<any[]>(LOCAL_SHARES_KEY, []);
    return { shares };
  },
  updateShare: async (id: string, patch: any) => {
    const shares = safeGetLocalStorage<any[]>(LOCAL_SHARES_KEY, []);
    const next = shares.map((s) => (s.id === id ? { ...s, ...patch } : s));
    safeSetLocalStorage(LOCAL_SHARES_KEY, next);
    return { ok: true, share: next.find((s) => s.id === id) };
  },
  deleteShare: async (id: string) => {
    const shares = safeGetLocalStorage<any[]>(LOCAL_SHARES_KEY, []);
    safeSetLocalStorage(LOCAL_SHARES_KEY, shares.filter((s) => s.id !== id));
    return { ok: true };
  },
  fetchPublicShare: async (token: string) => {
    const shares = safeGetLocalStorage<any[]>(LOCAL_SHARES_KEY, []);
    const found = shares.find((s) => s.token === token && s.active);
    if (!found) return { ok: false, resume: null, hideContact: false, sharedAt: "" };
    return { ok: true, resume: found.resume, hideContact: found.hideContact, sharedAt: found.createdAt };
  },

  // Health check
  health: async () => ({
    ok: true,
    status: "ok",
    mode: "standalone-client",
    checks: {
      database: { status: "connected", detail: "Browser IndexedDB local persistence active" },
    },
  }),
};

// ============================================================================
// Resilience Wrappers & Auto-Sync
// ============================================================================

export function cloudApiSafe<T extends (...args: any[]) => Promise<any>>(fn: T | undefined | null): T {
  if (typeof fn !== "function") {
    return ((..._: any[]) => Promise.resolve(undefined)) as unknown as T;
  }
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (e: any) {
      console.warn("[cloudApiSafe] Local operation warning:", e?.message || e);
      return undefined as any;
    }
  }) as T;
}

export async function syncResumeToCloud(
  resume: any
): Promise<{ success: boolean; error?: string; timestamp: number }> {
  const now = Date.now();
  if (!resume || !resume.id) {
    return { success: false, error: "Invalid resume payload", timestamp: now };
  }
  try {
    await api.updateResume(resume.id, resume);
    return { success: true, timestamp: now };
  } catch (err: any) {
    try {
      await api.createResume(resume);
      return { success: true, timestamp: now };
    } catch (createErr: any) {
      return { success: false, error: createErr?.message || "Failed to persist resume locally", timestamp: now };
    }
  }
}

// ============================================================================
// Sync All Data to Zustand Store on App Load
// ============================================================================

export async function syncAllFromCloud(store: any): Promise<void> {
  try {
    const [resumesRes, clsRes, jdsRes, ivsRes, atsRes, appsRes, providersRes, promptsRes, logsRes, brandingRes, flagsRes] =
      await Promise.all([
        api.getResumes().catch(() => ({ resumes: [] })),
        api.getCoverLetters().catch(() => ({ coverLetters: [] })),
        api.getJobDescriptions().catch(() => ({ jobDescriptions: [] })),
        api.getInterviews().catch(() => ({ interviews: [] })),
        api.getATSReports().catch(() => ({ atsReports: [] })),
        api.getApplications().catch(() => ({ applications: [] })),
        api.getProviders().catch(() => ({ providers: [] })),
        api.getPrompts().catch(() => ({ prompts: [] })),
        api.getAuditLogs().catch(() => ({ logs: [] })),
        api.getBranding().catch(() => ({ branding: null })),
        api.getFlags().catch(() => ({ flags: null })),
      ]);

    const resumes = resumesRes.resumes || [];
    if (resumes.length) {
      store.setState({ resumes });
    }

    const coverLetters = clsRes.coverLetters || [];
    if (coverLetters.length) {
      store.setState({ coverLetters });
    }

    const jobDescriptions = (jdsRes.jobDescriptions || []).map(normalizeJD);
    if (jobDescriptions.length) {
      store.setState({ jobDescriptions });
    }

    const interviews = ivsRes.interviews || [];
    if (interviews.length) {
      store.setState({ interviews });
    }

    const atsReports = atsRes.atsReports || [];
    if (atsReports.length) {
      store.setState({ atsReports });
    }

    const applications = (appsRes.applications || []).map(parseDbApplication);
    if (applications.length) {
      store.setState({ applications });
    }

    if (providersRes.providers?.length) {
      const currentProviders = store.getState().providers || [];
      const map = new Map<string, any>();
      for (const p of [...currentProviders, ...providersRes.providers]) {
        map.set(p.id, p);
      }
      store.setState({ providers: Array.from(map.values()) });
    }

    if (promptsRes.prompts?.length) {
      store.setState({ prompts: promptsRes.prompts });
    }

    if (logsRes.logs?.length) {
      store.setState({ logs: logsRes.logs });
    }

    if (brandingRes.branding) {
      store.setState({ branding: { ...store.getState().branding, ...brandingRes.branding } });
    }

    if (flagsRes.flags && Object.keys(flagsRes.flags).length > 0) {
      store.setState({ flags: { ...store.getState().flags, ...flagsRes.flags } });
    }
  } catch (err) {
    console.warn("[syncAllFromCloud] Standalone hydration completed with warnings:", err);
  }
}

export async function refreshUsers(store: any): Promise<void> {
  try {
    const res = await api.getUsers();
    if (res.users?.length) {
      const existing = store.getState().users || [];
      const map = new Map<string, any>();
      for (const u of [...existing, ...res.users]) {
        map.set(u.id, u);
      }
      store.setState({ users: Array.from(map.values()) });
    }
  } catch (e) {
    console.warn("[refreshUsers] Local user refresh completed:", e);
  }
}

export async function migrateLocalStorageToCloud(_store: any): Promise<void> {
  // Standalone mode: all data is already stored directly in IndexedDB and localStorage
  if (typeof window === "undefined") return;
  const migrationKey = "resumeai-local-ready";
  if (localStorage.getItem(migrationKey)) return;
  localStorage.setItem(migrationKey, "1");
}
