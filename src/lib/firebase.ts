// ============================================================================
// Firebase SDK & Firestore Persistence Engine
// Provides Native Firebase Authentication & Cloud Firestore (`users/{userId}/*`)
// With 100% Graceful Offline / LocalStorage / IndexedDB Fallback
// ============================================================================

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signInAnonymously,
  signOut as fbSignOut,
  onAuthStateChanged,
  updateProfile,
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
  query,
  orderBy,
  type Firestore,
} from "firebase/firestore";

import firebaseConfigJson from "../../firebase-applet-config.json";
import type { ResumeData } from "./types";
import type { ApplicationRecord } from "./applications-logic";
import {
  getAllResumesFromDB,
  saveResumeToDB,
  deleteResumeFromDB,
  getAllApplicationsFromDB,
  saveApplicationToDB,
  deleteApplicationFromDB,
  getAllCoverLettersFromDB,
  saveCoverLetterToDB,
  deleteCoverLetterFromDB,
  getAllJDsFromDB,
  saveJDToDB,
  deleteJDFromDB,
  getAllATSReportsFromDB,
  saveATSReportToDB,
} from "./resume-db";

// ---------------------------------------------------------------------------
// 1. Initialization
// ---------------------------------------------------------------------------

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let isFirebaseInitialized = false;

try {
  const config = firebaseConfigJson;
  if (config && config.apiKey && config.projectId) {
    if (!getApps().length) {
      app = initializeApp(config);
    } else {
      app = getApp();
    }

    if (app) {
      auth = getAuth(app);
      // Support custom firestoreDatabaseId if configured in project
      if (config.firestoreDatabaseId && config.firestoreDatabaseId !== "(default)") {
        db = getFirestore(app, config.firestoreDatabaseId);
      } else {
        db = getFirestore(app);
      }
      isFirebaseInitialized = true;
    }
  }
} catch (initErr) {
  console.warn("[Firebase] Initialization error, using offline local fallback:", initErr);
  isFirebaseInitialized = false;
}

export { app, auth, db, isFirebaseInitialized };

export function isFirebaseReady(): boolean {
  return Boolean(isFirebaseInitialized && auth && db);
}

// ---------------------------------------------------------------------------
// 2. Authentication API (Email/Password, Google Popup, Guest/Anonymous)
// ---------------------------------------------------------------------------

export async function loginWithEmail(email: string, pass: string) {
  if (!auth) {
    throw new Error("Firebase Auth is not initialized. Using local offline mode.");
  }
  const credential = await signInWithEmailAndPassword(auth, email.trim(), pass);
  return credential.user;
}

export async function registerWithEmail(email: string, pass: string, displayName?: string) {
  if (!auth) {
    throw new Error("Firebase Auth is not initialized. Using local offline mode.");
  }
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), pass);
  if (displayName && credential.user) {
    try {
      await updateProfile(credential.user, { displayName });
    } catch {}
  }
  return credential.user;
}

export async function loginWithGoogle() {
  if (!auth) {
    throw new Error("Firebase Auth is not initialized.");
  }
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const credential = await signInWithPopup(auth, provider);
  return credential.user;
}

export async function loginAsGuest() {
  if (!auth) {
    throw new Error("Firebase Auth is not initialized.");
  }
  const credential = await signInAnonymously(auth);
  return credential.user;
}

export async function logoutFirebaseUser() {
  if (!auth) return;
  await fbSignOut(auth);
}

export function onFirebaseAuthStateChanged(callback: (user: any) => void) {
  if (!auth) return () => {};
  return onAuthStateChanged(auth, callback);
}

export function onFirebaseAuthStateChange(callback: (user: FirebaseUser | null) => void) {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export function getActiveFirebaseUser(): FirebaseUser | null {
  return auth?.currentUser ?? null;
}

// ---------------------------------------------------------------------------
// 3. Firestore Direct Calls: Resumes (`users/{userId}/resumes`)
// ---------------------------------------------------------------------------

export async function getFirestoreResumes(userId: string): Promise<ResumeData[]> {
  if (!db || !userId) {
    return await getAllResumesFromDB();
  }

  try {
    const resumesRef = collection(db, "users", userId, "resumes");
    const q = query(resumesRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      // If Firestore has no documents yet, check local DB fallback
      return await getAllResumesFromDB();
    }

    const results: ResumeData[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      results.push({
        id: docSnap.id,
        ...data,
      } as ResumeData);
    });

    // Mirror to local DB for offline access
    for (const r of results) {
      saveResumeToDB(r).catch(() => {});
    }

    return results;
  } catch (err) {
    console.warn("[Firebase] Failed to fetch resumes from Firestore, fallback to local DB:", err);
    return await getAllResumesFromDB();
  }
}

export async function saveFirestoreResume(userId: string, resume: ResumeData): Promise<boolean> {
  // Always save locally first so user never loses work
  await saveResumeToDB(resume).catch(() => {});

  if (!db || !userId || !resume.id) {
    return true;
  }

  try {
    const resumeRef = doc(db, "users", userId, "resumes", resume.id);
    const payload = {
      ...resume,
      userId,
      updatedAt: resume.updatedAt || new Date().toISOString(),
      createdAt: resume.createdAt || new Date().toISOString(),
    };
    await setDoc(resumeRef, payload, { merge: true });
    return true;
  } catch (err) {
    console.warn("[Firebase] Firestore saveResume failed, cached locally:", err);
    return false;
  }
}

export async function deleteFirestoreResume(userId: string, resumeId: string): Promise<boolean> {
  await deleteResumeFromDB(resumeId).catch(() => {});

  if (!db || !userId || !resumeId) {
    return true;
  }

  try {
    const resumeRef = doc(db, "users", userId, "resumes", resumeId);
    await deleteDoc(resumeRef);
    return true;
  } catch (err) {
    console.warn("[Firebase] Firestore deleteResume error:", err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// 4. Firestore Direct Calls: Applications (`users/{userId}/applications`)
// ---------------------------------------------------------------------------

export async function getFirestoreApplications(userId: string): Promise<ApplicationRecord[]> {
  if (!db || !userId) {
    return await getAllApplicationsFromDB();
  }

  try {
    const appsRef = collection(db, "users", userId, "applications");
    const q = query(appsRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return await getAllApplicationsFromDB();
    }

    const list: ApplicationRecord[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      list.push({
        id: docSnap.id,
        ...data,
      } as ApplicationRecord);
    });

    for (const app of list) {
      saveApplicationToDB(app).catch(() => {});
    }

    return list;
  } catch (err) {
    console.warn("[Firebase] Firestore getApplications error, fallback to local DB:", err);
    return await getAllApplicationsFromDB();
  }
}

export async function saveFirestoreApplication(userId: string, application: ApplicationRecord): Promise<boolean> {
  await saveApplicationToDB(application).catch(() => {});

  if (!db || !userId || !application.id) {
    return true;
  }

  try {
    const appRef = doc(db, "users", userId, "applications", application.id);
    const payload = {
      ...application,
      userId,
      updatedAt: application.updatedAt || new Date().toISOString(),
      createdAt: application.createdAt || new Date().toISOString(),
    };
    await setDoc(appRef, payload, { merge: true });
    return true;
  } catch (err) {
    console.warn("[Firebase] Firestore saveApplication error:", err);
    return false;
  }
}

export async function deleteFirestoreApplication(userId: string, applicationId: string): Promise<boolean> {
  await deleteApplicationFromDB(applicationId).catch(() => {});

  if (!db || !userId || !applicationId) {
    return true;
  }

  try {
    const appRef = doc(db, "users", userId, "applications", applicationId);
    await deleteDoc(appRef);
    return true;
  } catch (err) {
    console.warn("[Firebase] Firestore deleteApplication error:", err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// 5. Cloud Firestore Synchronization helper
// ---------------------------------------------------------------------------

export async function syncLocalDataToFirestore(userId: string): Promise<void> {
  if (!db || !userId) return;

  try {
    // 1. Sync local resumes to Firestore if missing
    const localResumes = await getAllResumesFromDB();
    for (const resume of localResumes) {
      if (resume && resume.id) {
        const resumeRef = doc(db, "users", userId, "resumes", resume.id);
        await setDoc(
          resumeRef,
          {
            ...resume,
            userId,
            updatedAt: resume.updatedAt || new Date().toISOString(),
            createdAt: resume.createdAt || new Date().toISOString(),
          },
          { merge: true }
        ).catch(() => {});
      }
    }

    // 2. Sync local applications to Firestore
    const localApps = await getAllApplicationsFromDB();
    for (const appRecord of localApps) {
      if (appRecord && appRecord.id) {
        const appRef = doc(db, "users", userId, "applications", appRecord.id);
        await setDoc(
          appRef,
          {
            ...appRecord,
            userId,
            updatedAt: appRecord.updatedAt || new Date().toISOString(),
            createdAt: appRecord.createdAt || new Date().toISOString(),
          },
          { merge: true }
        ).catch(() => {});
      }
    }
  } catch (e) {
    console.warn("[Firebase] Sync local to cloud non-fatal:", e);
  }
}
