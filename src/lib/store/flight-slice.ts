// ============================================================================
// Zustand Store — Flight Logs, Audit, and Job Queue Slice
// ============================================================================

"use client";

import type { StateCreator } from "zustand";
import type { AppState } from "../store";
import type { AuditLog } from "../types";
import { uid } from "./helpers";

export interface FlightRecord {
  id: string;
  timestamp: string;
  stage: string;
  status: "success" | "warning" | "error" | "info";
  message: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export interface FlightSlice {
  flightRecords: FlightRecord[];
  logs: AuditLog[];
  backgroundJobs: any[];

  pushFlightRecord: (record: Partial<FlightRecord>) => void;
  clearFlightLog: () => void;
  log: (entry: Partial<AuditLog>) => void;
  clearLogs: () => void;
  enqueueJob: (job: any) => void;
  runWorkerQueue: () => Promise<void>;
  clearJobHistory: () => void;
  incUsage: (tokens?: number) => void;
  dismissFollowUp: (id: string) => void;
}

export const createFlightSlice: StateCreator<AppState, [], [], FlightSlice> = (set, get) => ({
  flightRecords: [],
  logs: [],
  backgroundJobs: [],

  pushFlightRecord: (rec: Partial<FlightRecord>) => {
    const record: FlightRecord = {
      id: rec.id || uid("fl"),
      timestamp: rec.timestamp || new Date().toISOString(),
      stage: rec.stage || "pipeline",
      status: rec.status || "info",
      message: rec.message || "",
      durationMs: rec.durationMs,
      metadata: rec.metadata,
    };
    set((s) => ({ flightRecords: [record, ...s.flightRecords.slice(0, 199)] }));
  },

  clearFlightLog: () => set({ flightRecords: [] }),

  log: (entry: Partial<AuditLog>) => {
    const logItem: AuditLog = {
      id: entry.id || uid("log"),
      timestamp: entry.timestamp || new Date().toISOString(),
      action: entry.action || "audit",
      details: entry.details,
      level: entry.level || "info",
    };
    set((s) => ({ logs: [logItem, ...s.logs.slice(0, 499)] }));
  },

  clearLogs: () => set({ logs: [] }),

  enqueueJob: (job: any) => set((s) => ({ backgroundJobs: [...s.backgroundJobs, job] })),

  runWorkerQueue: async () => {
    // Process queued background jobs
  },

  clearJobHistory: () => set({ backgroundJobs: [] }),

  incUsage: (tokens = 1) => {
    // Increment usage
  },

  dismissFollowUp: (id: string) => {
    // Dismiss follow-up notification
  },
});
