// ============================================================================
// Directive Sync Service
// Synchronizes Custom Directive Profiles between Firestore and localStorage
// with state updates, validation guardrails, and automatic fallback handling.
// ============================================================================

"use client";

import type { DirectiveProfile } from "./directive-profiles";
import {
  BUILT_IN_PROFILES,
  isBuiltInProfile,
  applyProfileToConfig,
  registerCustomProfiles,
} from "./directive-profiles";
import {
  saveFirestoreDirectiveProfile,
  deleteFirestoreDirectiveProfile,
  getFirestoreDirectiveProfiles,
} from "./firebase";
import { useApp } from "./store";
import type { OptimizerDirectiveConfig } from "./types";

export const LOCAL_STORAGE_KEY = "custom_directives_v1";
export const FALLBACK_PROFILE_ID = "aviation-hospitality";

export class DirectiveSyncService {
  /**
   * Reads custom directive profiles from localStorage.
   */
  public loadLocalProfiles(): DirectiveProfile[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (p): p is DirectiveProfile => Boolean(p && typeof p === "object" && p.id && p.name)
      );
    } catch (err) {
      console.warn("[DirectiveSyncService] Failed to load local profiles:", err);
      return [];
    }
  }

  /**
   * Writes custom directive profiles to localStorage.
   */
  public saveLocalProfiles(profiles: DirectiveProfile[]): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(profiles));
    } catch (err) {
      console.warn("[DirectiveSyncService] Failed to save local profiles:", err);
    }
  }

  /**
   * Synchronizes profiles bidirectionally between Firestore and localStorage.
   * Merges remote Firestore profiles with local storage, registers them into
   * the runtime registry, and updates the Zustand store.
   */
  public async syncProfiles(userId?: string): Promise<DirectiveProfile[]> {
    const localProfiles = this.loadLocalProfiles();
    const profileMap = new Map<string, DirectiveProfile>();

    // Seed with local profiles
    for (const p of localProfiles) {
      if (p && p.id) {
        profileMap.set(p.id, p);
      }
    }

    // If authenticated, fetch from Firestore and merge
    if (userId) {
      try {
        const firestoreProfiles = await getFirestoreDirectiveProfiles(userId);
        if (Array.isArray(firestoreProfiles)) {
          for (const fp of firestoreProfiles) {
            if (fp && fp.id) {
              const existing = profileMap.get(fp.id);
              // Merge: take firestore or newer version
              profileMap.set(fp.id, {
                ...existing,
                ...fp,
                tags: fp.tags || existing?.tags || ["custom"],
                overrides: {
                  ...(existing?.overrides || {}),
                  ...(fp.overrides || {}),
                },
              });
            }
          }
        }

        // Upload any local profiles that don't yet exist in Firestore
        for (const [id, profile] of profileMap.entries()) {
          const inFirestore = firestoreProfiles?.some((fp: any) => fp.id === id);
          if (!inFirestore) {
            await saveFirestoreDirectiveProfile(userId, profile).catch((e) => {
              console.warn(`[DirectiveSyncService] Non-blocking push error for ${id}:`, e);
            });
          }
        }
      } catch (err) {
        console.warn("[DirectiveSyncService] Firestore sync non-blocking error:", err);
      }
    }

    const merged = Array.from(profileMap.values());

    // 1. Update localStorage
    this.saveLocalProfiles(merged);

    // 2. Register with in-memory registry
    registerCustomProfiles(merged);

    // 3. Update Zustand application state
    useApp.setState({ customDirectiveProfiles: merged });

    // 4. Verify that active profile exists; if not, trigger fallback
    this.ensureActiveProfileValid();

    return merged;
  }

  /**
   * Adds or updates a custom directive profile across state, localStorage, and Firestore.
   */
  public async addOrUpdateProfile(
    profile: DirectiveProfile,
    userId?: string
  ): Promise<DirectiveProfile[]> {
    const currentProfiles = this.loadLocalProfiles();
    const updatedList = [
      ...currentProfiles.filter((p) => p.id !== profile.id),
      profile,
    ];

    // 1. Local storage
    this.saveLocalProfiles(updatedList);

    // 2. Runtime registry
    registerCustomProfiles(updatedList);

    // 3. Application state
    useApp.setState({ customDirectiveProfiles: updatedList });

    // 4. Firestore async sync
    const uid = userId || useApp.getState().user?.id;
    if (uid) {
      saveFirestoreDirectiveProfile(uid, profile).catch((err) => {
        console.warn(`[DirectiveSyncService] Firestore save failed for ${profile.id}:`, err);
      });
    }

    return updatedList;
  }

  /**
   * Deletes a custom directive profile.
   * Enforces safety guardrail (cannot delete built-ins) and triggers fallback to
   * 'Aviation / Hospitality' if the deleted profile was currently active.
   */
  public async deleteProfile(
    profileId: string,
    userId?: string
  ): Promise<{ profiles: DirectiveProfile[]; fallbackTriggered: boolean }> {
    // Safety guardrail: Built-in system profiles cannot be deleted
    if (isBuiltInProfile(profileId)) {
      throw new Error(`Cannot delete built-in system profile: "${profileId}". Built-in profiles are protected.`);
    }

    const currentProfiles = this.loadLocalProfiles();
    const nextList = currentProfiles.filter((p) => p.id !== profileId);

    // 1. Local storage
    this.saveLocalProfiles(nextList);

    // 2. Runtime registry
    registerCustomProfiles(nextList);

    // 3. Application state
    useApp.setState({ customDirectiveProfiles: nextList });

    // 4. Firestore deletion
    const uid = userId || useApp.getState().user?.id;
    if (uid) {
      deleteFirestoreDirectiveProfile(uid, profileId).catch((err) => {
        console.warn(`[DirectiveSyncService] Firestore delete failed for ${profileId}:`, err);
      });
    }

    // 5. Active Profile Fallback Check
    let fallbackTriggered = false;
    const appState = useApp.getState();
    const currentConfig = appState.optimizerDirective;

    const isActive = currentConfig?.selectedProfileId === profileId;

    if (isActive) {
      fallbackTriggered = true;
      this.triggerFallbackToAviation();
    }

    return { profiles: nextList, fallbackTriggered };
  }

  /**
   * Reverts active optimizer configuration to the default 'Aviation / Hospitality' profile.
   */
  public triggerFallbackToAviation(): void {
    const fallbackProfile = BUILT_IN_PROFILES[FALLBACK_PROFILE_ID];
    if (!fallbackProfile) return;

    const appState = useApp.getState();
    const currentConfig = appState.optimizerDirective;

    const updatedConfig: OptimizerDirectiveConfig = applyProfileToConfig(
      currentConfig,
      fallbackProfile
    );
    updatedConfig.selectedProfileId = FALLBACK_PROFILE_ID;

    // Apply to config in store to ensure full consistency
    if (appState.updateOptimizerDirective) {
      appState.updateOptimizerDirective(updatedConfig);
    }

    console.log(
      `[DirectiveSyncService] Active profile removed. Gracefully reverted to "${fallbackProfile.name}".`
    );
  }

  /**
   * Validates whether current selectedProfileId exists in built-ins or custom profiles.
   * If missing or invalid, reverts to 'Aviation / Hospitality'.
   */
  public ensureActiveProfileValid(): boolean {
    const appState = useApp.getState();
    const activeId = appState.optimizerDirective?.selectedProfileId;
    if (!activeId) return true;

    if (isBuiltInProfile(activeId)) return true;

    const customList = appState.customDirectiveProfiles || this.loadLocalProfiles();
    const exists = customList.some((p) => p.id === activeId);

    if (!exists) {
      console.warn(
        `[DirectiveSyncService] Active profile "${activeId}" not found in custom or built-in profiles. Reverting to fallback.`
      );
      this.triggerFallbackToAviation();
      return false;
    }

    return true;
  }
}

// Singleton export
export const directiveSyncService = new DirectiveSyncService();
