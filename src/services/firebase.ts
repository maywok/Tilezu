// Firebase integration for custom profile system
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, type Firestore } from 'firebase/firestore';

// Replace with your Firebase project config or set VITE_FIREBASE_* env vars.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'YOUR_API_KEY',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'YOUR_AUTH_DOMAIN',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'YOUR_PROJECT_ID',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? 'YOUR_STORAGE_BUCKET',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? 'YOUR_MESSAGING_SENDER_ID',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? 'YOUR_APP_ID',
};

export function isFirebaseConfigured(): boolean {
  return (
    firebaseConfig.apiKey !== 'YOUR_API_KEY'
    && firebaseConfig.projectId !== 'YOUR_PROJECT_ID'
  );
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

function ensureFirebase(): { app: FirebaseApp; auth: Auth; db: Firestore } | null {
  if (!isFirebaseConfigured()) {
    return null;
  }

  if (!app) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  }

  return { app, auth: auth!, db: db! };
}

export function onUserChanged(callback: (user: User | null) => void) {
  const firebase = ensureFirebase();
  if (!firebase) {
    callback(null);
    return () => {};
  }

  return onAuthStateChanged(firebase.auth, callback);
}

export function signIn(email: string, password: string) {
  const firebase = ensureFirebase();
  if (!firebase) {
    return Promise.reject(new Error('Firebase is not configured.'));
  }

  return signInWithEmailAndPassword(firebase.auth, email, password);
}

export function signUp(email: string, password: string) {
  const firebase = ensureFirebase();
  if (!firebase) {
    return Promise.reject(new Error('Firebase is not configured.'));
  }

  return createUserWithEmailAndPassword(firebase.auth, email, password);
}

export function signOutUser() {
  const firebase = ensureFirebase();
  if (!firebase) {
    return Promise.resolve();
  }

  return signOut(firebase.auth);
}

export async function saveUserProfile(uid: string, profile: Record<string, unknown>) {
  const firebase = ensureFirebase();
  if (!firebase) {
    return;
  }

  await setDoc(doc(firebase.db, 'profiles', uid), profile);
}

export async function getUserProfile(uid: string) {
  const firebase = ensureFirebase();
  if (!firebase) {
    return null;
  }

  const snap = await getDoc(doc(firebase.db, 'profiles', uid));
  return snap.exists() ? snap.data() : null;
}
