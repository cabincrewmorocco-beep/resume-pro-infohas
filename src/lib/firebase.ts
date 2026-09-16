// ============================================================================
// ResumeAI Pro — Firebase Auth & Firestore Client Integration
// ============================================================================

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  type Auth,
  type User as FirebaseUser,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  type Firestore,
} from "firebase/firestore";
import { getAllResumesFromDB, getAllApplicationsFromDB } from "./resume-db";

const metaEnv = (import.meta as any).env || {};
const firebaseConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || "AIzaSyDummyKeyForGracefulInitializationClientSide",
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || "infohas-ats-pro.firebaseapp.com",
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || "ai-studio-infohasatspro-ef38e692-9712-4295-b102-60af70e3c8ec",
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || "infohas-ats-pro.appspot.com",
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || "604352585869",
  appId: metaEnv.VITE_FIREBASE_APP_ID || "1:604352585869:web:abcdef123456",
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let googleProvider: GoogleAuthProvider | null = null;

try {
  if (typeof window !== "undefined") {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    // Initialize Google Auth Provider with custom parameters & standard scopes
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: "select_account" });
    googleProvider.addScope("email");
    googleProvider.addScope("profile");

    // Configure persistent local storage session in browser
    setPersistence(auth, browserLocalPersistence).catch((persistErr) => {
      console.warn("[Firebase Auth] setPersistence initial warning:", persistErr);
    });
  }
} catch (err) {
  console.warn("[Firebase] Initializing client-side Firebase gracefully:", err);
}

export { app, auth, db, googleProvider };

export function isFirebaseReady(): boolean {
  return !!auth && !!db;
}

// ----------------------------------------------------------------------------
// Authentication Handlers
// ----------------------------------------------------------------------------

export async function loginWithEmail(email: string, pass: string): Promise<FirebaseUser> {
  if (!auth) throw new Error("Firebase Auth is not ready.");
  const cred = await signInWithEmailAndPassword(auth, email, pass);
  return cred.user;
}

export async function registerWithEmail(email: string, pass: string, name?: string): Promise<FirebaseUser> {
  if (!auth) throw new Error("Firebase Auth is not ready.");
  const cred = await createUserWithEmailAndPassword(auth, email, pass);
  if (name && cred.user) {
    await updateProfile(cred.user, { displayName: name }).catch(() => {});
  }
  return cred.user;
}

export async function loginWithGoogle(): Promise<FirebaseUser | null> {
  if (!auth) throw new Error("Firebase Auth is not ready.");
  try {
    if (!googleProvider) {
      googleProvider = new GoogleAuthProvider();
      googleProvider.setCustomParameters({ prompt: "select_account" });
      googleProvider.addScope("email");
      googleProvider.addScope("profile");
    }

    // Ensure local persistence is verified before popup invocation
    try {
      await setPersistence(auth, browserLocalPersistence);
    } catch (persistErr) {
      console.warn("[Firebase Auth] Popup persistence setup notice:", persistErr);
    }

    const cred = await signInWithPopup(auth, googleProvider);
    return cred.user;
  } catch (err: any) {
    if (err?.code === "auth/popup-closed-by-user" || err?.code === "auth/cancelled-popup-request") {
      return null;
    }
    throw err;
  }
}

export async function loginAsGuest(): Promise<FirebaseUser> {
  if (!auth) throw new Error("Firebase Auth is not ready.");
  const cred = await signInAnonymously(auth);
  return cred.user;
}

export async function logoutFirebaseUser(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
}

export function onFirebaseAuthStateChanged(callback: (user: FirebaseUser | null) => void): () => void {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

// ----------------------------------------------------------------------------
// Firestore Database Operations (User Scoped)
// ----------------------------------------------------------------------------

export async function getFirestoreResumes(userId: string): Promise<any[]> {
  if (!db || !userId) return [];
  try {
    const colRef = collection(db, "users", userId, "resumes");
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (err) {
    console.warn("[Firestore] Failed to read resumes:", err);
    return [];
  }
}

export async function saveFirestoreResume(userId: string, resume: any): Promise<void> {
  if (!db || !userId || !resume?.id) return;
  try {
    const docRef = doc(db, "users", userId, "resumes", resume.id);
    await setDoc(docRef, { ...resume, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    console.warn("[Firestore] Failed to save resume:", err);
  }
}

export async function deleteFirestoreResume(userId: string, resumeId: string): Promise<void> {
  if (!db || !userId || !resumeId) return;
  try {
    const docRef = doc(db, "users", userId, "resumes", resumeId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn("[Firestore] Failed to delete resume:", err);
  }
}

export async function getFirestoreApplications(userId: string): Promise<any[]> {
  if (!db || !userId) return [];
  try {
    const colRef = collection(db, "users", userId, "applications");
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (err) {
    console.warn("[Firestore] Failed to read applications:", err);
    return [];
  }
}

export async function saveFirestoreApplication(userId: string, appData: any): Promise<void> {
  if (!db || !userId || !appData?.id) return;
  try {
    const docRef = doc(db, "users", userId, "applications", appData.id);
    await setDoc(docRef, { ...appData, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    console.warn("[Firestore] Failed to save application:", err);
  }
}

export async function deleteFirestoreApplication(userId: string, appId: string): Promise<void> {
  if (!db || !userId || !appId) return;
  try {
    const docRef = doc(db, "users", userId, "applications", appId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn("[Firestore] Failed to delete application:", err);
  }
}

// ----------------------------------------------------------------------------
// Directive Profiles Firestore Sync (users/{uid}/directive_profiles/{profileId})
// ----------------------------------------------------------------------------

export async function getFirestoreDirectiveProfiles(userId: string): Promise<any[]> {
  if (!db || !userId) return [];
  try {
    const colRef = collection(db, "users", userId, "directive_profiles");
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (err) {
    console.warn("[Firestore] Failed to read directive profiles:", err);
    return [];
  }
}

export async function saveFirestoreDirectiveProfile(userId: string, profile: any): Promise<void> {
  if (!db || !userId || !profile?.id) return;
  try {
    const docRef = doc(db, "users", userId, "directive_profiles", profile.id);
    await setDoc(docRef, { ...profile, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    console.warn("[Firestore] Failed to save directive profile:", err);
  }
}

export async function deleteFirestoreDirectiveProfile(userId: string, profileId: string): Promise<void> {
  if (!db || !userId || !profileId) return;
  try {
    const docRef = doc(db, "users", userId, "directive_profiles", profileId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn("[Firestore] Failed to delete directive profile:", err);
  }
}

/**
 * Background synchronization from local IndexedDB cache into Firestore for authenticated users
 */
export async function syncLocalDataToFirestore(userId: string): Promise<void> {
  if (!db || !userId) return;
  try {
    const [localResumes, localApps] = await Promise.all([
      getAllResumesFromDB(),
      getAllApplicationsFromDB(),
    ]);

    for (const r of localResumes) {
      if (r && r.id) {
        await saveFirestoreResume(userId, r);
      }
    }

    for (const a of localApps) {
      if (a && a.id) {
        await saveFirestoreApplication(userId, a);
      }
    }

    // Sync any locally cached custom directive profiles
    try {
      const localCustom = localStorage.getItem("custom_directives_v1");
      if (localCustom) {
        const parsed = JSON.parse(localCustom);
        if (Array.isArray(parsed)) {
          for (const p of parsed) {
            if (p && p.id) {
              await saveFirestoreDirectiveProfile(userId, p);
            }
          }
        }
      }
    } catch {}
  } catch (err) {
    console.warn("[Firestore] Local data sync encountered non-blocking warning:", err);
  }
}
