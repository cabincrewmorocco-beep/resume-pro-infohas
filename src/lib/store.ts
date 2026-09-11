// ============================================================================
// ResumeAI Pro — Global Zustand Store (Slicing Implementation)
// ============================================================================

"use client";

import { create } from "zustand";
import { createAuthSlice, type AuthSlice } from "./store/auth-slice";
import { createResumesSlice, type ResumesSlice } from "./store/resumes-slice";
import { createApplicationsSlice, type ApplicationsSlice } from "./store/applications-slice";
import { createAdminSlice, type AdminSlice } from "./store/admin-slice";
import { createDevWorkspaceSlice, type DevWorkspaceSlice } from "./store/dev-workspace-slice";
import { createFlightSlice, type FlightSlice } from "./store/flight-slice";
import { registerHook } from "./ai/hooks";

import { BRAND } from "./brand";
import { uid } from "./store/helpers";

export type AppState = AuthSlice & ResumesSlice & ApplicationsSlice & AdminSlice & DevWorkspaceSlice & FlightSlice;

export const useApp = create<AppState>()((...a) => ({
  ...createAuthSlice(...a),
  ...createResumesSlice(...a),
  ...createApplicationsSlice(...a),
  ...createAdminSlice(...a),
  ...createDevWorkspaceSlice(...a),
  ...createFlightSlice(...a),
}));

// ----------------------------------------------------------------------------
// Flight Recorder Console sink
// ----------------------------------------------------------------------------
if (typeof window !== "undefined") {
  registerHook("AfterPersist", (ctx) => {
    const record = ctx.result as unknown as AppState["flightRecords"][number] | undefined;
    if (record && typeof record === "object") {
      useApp.getState().pushFlightRecord(record);
    }
  });
}

export { BRAND };
export { uid };

if (typeof window !== "undefined") {
  (window as any).useApp = useApp;
}
export default useApp;
