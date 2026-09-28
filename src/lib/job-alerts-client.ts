/**
 * Client service for Google Search Grounded Job Alerts & Scraping
 */

export interface ScrapedJobPosting {
  id: string;
  title: string;
  company: string;
  location: string;
  remoteType: "Remote" | "Hybrid" | "On-site" | string;
  salaryRange: string;
  url: string;
  postedTime: string;
  source: string;
  matchScore: number; // 0 - 100
  matchedKeywords: string[];
  missingKeywords: string[];
  whyItMatchesGoal: string;
  summary: string;
  requirements: string[];
  isNew?: boolean;
}

export interface JobAlertConfig {
  id: string;
  role: string;
  location: string;
  keywords: string[];
  careerGoals: string;
  active: boolean;
  frequency: "instant" | "daily" | "weekly";
  createdAt: string;
  lastScannedAt?: string;
  unreadCount?: number;
}

export interface JobAlertScanResponse {
  ok: boolean;
  provider?: string;
  grounded?: boolean;
  searchQueries?: string[];
  sources?: Array<{ title: string; url: string }>;
  data: {
    scrapedAt: string;
    query: string;
    jobs: ScrapedJobPosting[];
  };
  error?: string;
}

const ALERTS_STORAGE_KEY = "resumeai_job_alerts_v1";
const MATCHED_JOBS_STORAGE_KEY = "resumeai_matched_jobs_v1";

export async function scanJobAlerts(params: {
  role: string;
  location?: string;
  keywords?: string[];
  careerGoals?: string;
}): Promise<JobAlertScanResponse> {
  const res = await fetch("/api/gemini/job-alerts-scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to scan job alerts (HTTP ${res.status})`);
  }

  return await res.json();
}

export function getStoredAlertConfigs(): JobAlertConfig[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ALERTS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveStoredAlertConfigs(configs: JobAlertConfig[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(configs));
  } catch {}
}

export function getStoredMatchedJobs(): ScrapedJobPosting[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MATCHED_JOBS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveStoredMatchedJobs(jobs: ScrapedJobPosting[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(MATCHED_JOBS_STORAGE_KEY, JSON.stringify(jobs));
  } catch {}
}
