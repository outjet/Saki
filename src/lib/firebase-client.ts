import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";

let app: FirebaseApp | null = null;

type FirebasePublicConfig = {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
};

declare global {
  interface Window {
    __FIREBASE_PUBLIC_CONFIG__?: FirebasePublicConfig;
  }
}

function runtimeFirebaseConfig(): FirebasePublicConfig {
  if (typeof window === "undefined") return {};
  return window.__FIREBASE_PUBLIC_CONFIG__ ?? {};
}

export function firebaseApp() {
  if (app) return app;

  const runtime = runtimeFirebaseConfig();
  const apiKey = runtime.apiKey?.trim() || process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  const authDomain =
    runtime.authDomain?.trim() || process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim();
  const projectId =
    runtime.projectId?.trim() || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  const storageBucket =
    runtime.storageBucket?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() ||
    undefined;
  const messagingSenderId =
    runtime.messagingSenderId?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim() ||
    undefined;
  const appId =
    runtime.appId?.trim() || process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim() || undefined;

  if (!apiKey || !authDomain || !projectId) {
    throw new Error(
      "Missing Firebase client config. Set FIREBASE_WEB_CONFIG_JSON or NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, and NEXT_PUBLIC_FIREBASE_PROJECT_ID."
    );
  }

  const config = {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId
  };

  app = initializeApp(config);
  return app;
}

export function firebaseAuth() {
  return getAuth(firebaseApp());
}
