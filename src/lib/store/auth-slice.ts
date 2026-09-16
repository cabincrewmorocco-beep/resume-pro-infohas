// ============================================================================
// Zustand Store — Auth & Session Slice
// ============================================================================

"use client";

import type { StateCreator } from "zustand";
import type { AppState } from "../store";
import type { User, ViewKey } from "../types";
import { SUPER_ADMIN_SEED, verifyPassword, hashPassword, canSignIn } from "../auth-utils";
import { uid } from "./helpers";
import {
  loginWithEmail,
  registerWithEmail as fbRegisterWithEmail,
  loginWithGoogle,
  loginAsGuest,
  logoutFirebaseUser,
  syncLocalDataToFirestore,
  onFirebaseAuthStateChanged,
} from "../firebase";

const USER_STORAGE_KEY = "resumeai_session_user";
const USERS_STORAGE_KEY = "resumeai_users_list";
const THEME_STORAGE_KEY = "resumeai_theme";

export interface AuthSlice {
  user: User | null;
  users: User[];
  isAuthed: boolean;
  authOpen: boolean;
  view: ViewKey;
  theme: "light" | "dark";
  sidebarCollapsed: boolean;
  synced: boolean;
  _needsRehydrate: boolean;

  openAuth: () => void;
  closeAuth: () => void;
  signIn: (user: User) => void;
  signInWithEmail: (email: string, pass: string) => Promise<{ success: boolean; ok: boolean; error?: string; user?: User }>;
  signInWithGoogle: () => Promise<{ success: boolean; ok: boolean; error?: string; user?: User }>;
  signInAsGuest: () => Promise<{ success: boolean; ok: boolean; error?: string; user?: User }>;
  signInWithPuter: () => Promise<{ success: boolean; ok: boolean; error?: string; user?: User }>;
  signOut: () => void;
  registerWithEmail: (nameOrEmail: string, emailOrPass: string, passOrName: string, maybeUsername?: string) => Promise<{ success: boolean; ok: boolean; error?: string; user?: User }>;
  changePassword: (oldPass: string, newPass: string) => Promise<{ success: boolean; error?: string }>;
  updateUserEmail: (newEmail: string) => Promise<{ success: boolean; error?: string }>;
  updateUserName: (newName: string) => Promise<{ success: boolean; error?: string }>;
  adminCreateUser: (userData: Partial<User>) => void;
  deleteUser: (id: string) => void;
  approveUser: (id: string) => void;
  promoteToAdmin: (id: string) => void;
  demoteToUser: (id: string) => void;
  suspendUser: (id: string) => void;
  unsuspendUser: (id: string) => void;
  resetUserPassword: (id: string, newPass: string) => void;
  rehydrateSession: () => void;
  setView: (view: ViewKey) => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
}

export const createAuthSlice: StateCreator<AppState, [], [], AuthSlice> = (set, get) => {
  const loadStoredUser = (): User | null => {
    if (typeof localStorage === "undefined") return null;
    try {
      const raw = localStorage.getItem(USER_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const loadStoredUsers = (): User[] => {
    if (typeof localStorage === "undefined") return [];
    try {
      const raw = localStorage.getItem(USERS_STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      if (!list.some((u: User) => u.email === SUPER_ADMIN_SEED.email)) {
        list.push({
          id: "u_superadmin",
          email: SUPER_ADMIN_SEED.email,
          name: SUPER_ADMIN_SEED.name,
          username: SUPER_ADMIN_SEED.username,
          role: SUPER_ADMIN_SEED.role,
          status: SUPER_ADMIN_SEED.status,
          passwordHash: hashPassword(SUPER_ADMIN_SEED.password),
          createdAt: new Date().toISOString(),
        });
      }
      return list;
    } catch {
      return [];
    }
  };

  const initialUser = loadStoredUser();
  const initialUsers = loadStoredUsers();

  return {
    user: initialUser,
    users: initialUsers,
    isAuthed: initialUser !== null,
    authOpen: false,
    view: "builder",
    theme: (typeof localStorage !== "undefined" && (localStorage.getItem(THEME_STORAGE_KEY) as "light" | "dark")) || "dark",
    sidebarCollapsed: false,
    synced: true,
    _needsRehydrate: false,

    openAuth: () => set({ authOpen: true }),
    closeAuth: () => set({ authOpen: false }),

    signIn: (user: User) => {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
      }
      set({ user, isAuthed: true, authOpen: false });
      (get() as any).loadCustomDirectiveProfiles?.();
    },

    signInWithEmail: async (email: string, pass: string) => {
      const users = get().users;
      const normalized = email.trim().toLowerCase();

      // 1. Check superadmin seed directly
      if (normalized === SUPER_ADMIN_SEED.email.toLowerCase()) {
        if (pass === SUPER_ADMIN_SEED.password) {
          const adminUser: User = {
            id: "u_superadmin",
            email: SUPER_ADMIN_SEED.email,
            name: SUPER_ADMIN_SEED.name,
            username: SUPER_ADMIN_SEED.username,
            role: "super_admin",
            status: "approved",
            createdAt: new Date().toISOString(),
          };
          get().signIn(adminUser);
          return { success: true, ok: true, user: adminUser };
        }
      }

      // 2. Try Firebase Authentication
      try {
        const fbUser = await loginWithEmail(normalized, pass);
        if (fbUser) {
          const user: User = {
            id: fbUser.uid,
            email: fbUser.email || normalized,
            name: fbUser.displayName || normalized.split("@")[0] || "User",
            role: "user",
            status: "approved",
            provider: "firebase_email",
            createdAt: new Date().toISOString(),
          };
          get().signIn(user);
          syncLocalDataToFirestore(user.id).catch(() => {});
          return { success: true, ok: true, user };
        }
      } catch (fbErr: any) {
        // Fallback to local stored user if offline or previously created locally
        const match = users.find((u) => u.email.toLowerCase() === normalized);
        if (match) {
          const allowed = canSignIn(match);
          if (!allowed.allowed) {
            return { success: false, ok: false, error: allowed.reason || "Account access denied." };
          }
          if (match.passwordHash && !verifyPassword(pass, match.passwordHash)) {
            return { success: false, ok: false, error: "Invalid email or password." };
          }
          get().signIn(match);
          syncLocalDataToFirestore(match.id).catch(() => {});
          return { success: true, ok: true, user: match };
        }
        return {
          success: false,
          ok: false,
          error: fbErr?.message?.replace("Firebase: ", "") || "Invalid email or password.",
        };
      }

      return { success: false, ok: false, error: "Invalid email or password." };
    },

    signInWithGoogle: async () => {
      try {
        const fbUser = await loginWithGoogle();
        if (fbUser) {
          const user: User = {
            id: fbUser.uid,
            email: fbUser.email || "google-user@infohas.pro",
            name: fbUser.displayName || "Google Candidate",
            role: "user",
            status: "approved",
            provider: "google",
            createdAt: new Date().toISOString(),
          };
          get().signIn(user);
          syncLocalDataToFirestore(user.id).catch(() => {});
          return { success: true, ok: true, user };
        }
        return { success: false, ok: false, error: "Google sign-in was cancelled" };
      } catch (err: any) {
        return {
          success: false,
          ok: false,
          error: err?.message?.replace("Firebase: ", "") || "Google sign-in encountered an issue",
        };
      }
    },

    signInAsGuest: async () => {
      try {
        let guestId = `guest_${uid()}`;
        try {
          const fbUser = await loginAsGuest();
          if (fbUser) {
            guestId = fbUser.uid;
          }
        } catch {
          // offline local fallback
        }
        const guestUser: User = {
          id: guestId,
          email: "guest@resumepro.local",
          name: "Guest Candidate",
          role: "guest",
          status: "approved",
          provider: "anonymous",
          createdAt: new Date().toISOString(),
        };
        get().signIn(guestUser);
        return { success: true, ok: true, user: guestUser };
      } catch (err: any) {
        return { success: false, ok: false, error: err instanceof Error ? err.message : "Guest access failed" };
      }
    },

    signInWithPuter: async () => {
      try {
        if (typeof window !== "undefined" && (window as any).puter?.auth) {
          const puterUser = await (window as any).puter.auth.signIn();
          if (puterUser) {
            const user: User = {
              id: `puter_${puterUser.username || uid()}`,
              email: puterUser.email || `${puterUser.username || "puter"}@puter.com`,
              name: puterUser.username || "Puter User",
              role: "user",
              status: "approved",
              createdAt: new Date().toISOString(),
            };
            get().signIn(user);
            return { success: true, ok: true, user };
          }
        }
        // Fallback demo user
        const guestUser: User = {
          id: `u_${uid()}`,
          email: "user@resumeai.pro",
          name: "ResumeAI User",
          role: "user",
          status: "approved",
          createdAt: new Date().toISOString(),
        };
        get().signIn(guestUser);
        return { success: true, ok: true, user: guestUser };
      } catch (err) {
        return { success: false, ok: false, error: err instanceof Error ? err.message : "Puter auth failed" };
      }
    },

    signOut: () => {
      logoutFirebaseUser().catch(() => {});
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(USER_STORAGE_KEY);
      }
      set({ user: null, isAuthed: false, authOpen: false });
    },

    registerWithEmail: async (arg1: string, arg2: string, arg3: string, maybeUsername?: string) => {
      // Flexibly detect argument order: (name, email, pass) vs (email, pass, name, username)
      let name = arg1;
      let email = arg2;
      let pass = arg3;
      let username = maybeUsername;

      if (arg1.includes("@")) {
        email = arg1;
        pass = arg2;
        name = arg3;
      }

      const users = [...get().users];
      const normalized = email.trim().toLowerCase();

      // 1. Try Firebase Authentication
      try {
        const fbUser = await fbRegisterWithEmail(normalized, pass, name);
        if (fbUser) {
          const newUser: User = {
            id: fbUser.uid,
            name: name.trim() || fbUser.displayName || "User",
            email: normalized,
            username: username?.trim() || undefined,
            role: "user",
            status: "approved",
            provider: "firebase_email",
            createdAt: new Date().toISOString(),
          };
          users.push(newUser);
          if (typeof localStorage !== "undefined") {
            localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
          }
          set({ users });
          get().signIn(newUser);
          syncLocalDataToFirestore(newUser.id).catch(() => {});
          return { success: true, ok: true, user: newUser };
        }
      } catch (fbErr: any) {
        // If Firebase throws, verify if it's already in use
        if (fbErr?.code === "auth/email-already-in-use" || users.some((u) => u.email.toLowerCase() === normalized)) {
          return { success: false, ok: false, error: "An account with this email already exists." };
        }
      }

      // 2. Fallback offline registration
      const newUser: User = {
        id: `u_${uid()}`,
        name: name.trim() || "User",
        email: normalized,
        username: username?.trim() || undefined,
        role: "user",
        status: "approved",
        passwordHash: hashPassword(pass),
        createdAt: new Date().toISOString(),
      };

      users.push(newUser);
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
      }
      set({ users });
      get().signIn(newUser);
      return { success: true, ok: true, user: newUser };
    },

    changePassword: async (oldPass: string, newPass: string) => {
      const currentUser = get().user;
      if (!currentUser) return { success: false, error: "Not signed in" };
      const users = get().users.map((u) => {
        if (u.id === currentUser.id) {
          return { ...u, passwordHash: hashPassword(newPass) };
        }
        return u;
      });
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
      }
      set({ users });
      return { success: true };
    },

    updateUserEmail: async (newEmail: string) => {
      const currentUser = get().user;
      if (!currentUser) return { success: false, error: "Not signed in" };
      const updated = { ...currentUser, email: newEmail };
      const users = get().users.map((u) => (u.id === currentUser.id ? updated : u));
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updated));
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
      }
      set({ user: updated, users });
      return { success: true };
    },

    updateUserName: async (newName: string) => {
      const currentUser = get().user;
      if (!currentUser) return { success: false, error: "Not signed in" };
      const updated = { ...currentUser, name: newName };
      const users = get().users.map((u) => (u.id === currentUser.id ? updated : u));
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updated));
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
      }
      set({ user: updated, users });
      return { success: true };
    },

    adminCreateUser: (userData: Partial<User>) => {
      const newUser: User = {
        id: `u_${uid()}`,
        name: userData.name || "User",
        email: userData.email || `user_${uid()}@example.com`,
        role: userData.role || "user",
        status: userData.status || "approved",
        createdAt: new Date().toISOString(),
        ...userData,
      };
      const users = [...get().users, newUser];
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
      }
      set({ users });
    },

    deleteUser: (id: string) => {
      const users = get().users.filter((u) => u.id !== id);
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
      }
      set({ users });
    },

    approveUser: (id: string) => {
      const users = get().users.map((u) => (u.id === id ? { ...u, status: "approved" as const } : u));
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
      }
      set({ users });
    },

    promoteToAdmin: (id: string) => {
      const users = get().users.map((u) => (u.id === id ? { ...u, role: "admin" as const } : u));
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
      }
      set({ users });
    },

    demoteToUser: (id: string) => {
      const users = get().users.map((u) => (u.id === id ? { ...u, role: "user" as const } : u));
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
      }
      set({ users });
    },

    suspendUser: (id: string) => {
      const users = get().users.map((u) => (u.id === id ? { ...u, status: "suspended" as const } : u));
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
      }
      set({ users });
    },

    unsuspendUser: (id: string) => {
      const users = get().users.map((u) => (u.id === id ? { ...u, status: "approved" as const } : u));
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
      }
      set({ users });
    },

    resetUserPassword: (id: string, newPass: string) => {
      const users = get().users.map((u) => (u.id === id ? { ...u, passwordHash: hashPassword(newPass) } : u));
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
      }
      set({ users });
    },

    rehydrateSession: () => {
      const user = loadStoredUser();
      set({ user, isAuthed: user !== null, _needsRehydrate: false });
      if (typeof window !== "undefined") {
        onFirebaseAuthStateChanged((fbUser) => {
          if (fbUser) {
            const current = get().user;
            const isGoogle = fbUser.providerData?.some((p) => p.providerId === "google.com") || current?.provider === "google";
            if (!current || current.id !== fbUser.uid || (!current.provider && isGoogle)) {
              const u: User = {
                id: fbUser.uid,
                email: fbUser.email || current?.email || "candidate@resumepro.cloud",
                name: fbUser.displayName || current?.name || "Candidate",
                role: current?.role || "user",
                status: "approved",
                provider: fbUser.isAnonymous ? "anonymous" : isGoogle ? "google" : "firebase_auth",
                createdAt: current?.createdAt || new Date().toISOString(),
              };
              set({ user: u, isAuthed: true });
              if (typeof localStorage !== "undefined") {
                localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(u));
              }
              (get() as any).loadCustomDirectiveProfiles?.();
              syncLocalDataToFirestore(u.id).catch(() => {});
            }
          }
        });
      }
    },

    setView: (view: ViewKey) => set({ view }),

    toggleTheme: () => {
      const next = get().theme === "dark" ? "light" : "dark";
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      }
      set({ theme: next });
    },

    toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  };
};
