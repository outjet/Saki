import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";

let app: FirebaseApp | null = null;

export function firebaseApp() {
  if (app) return app;

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() ?? "";
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() ?? "";
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ?? "";
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() ?? "";
  const messagingSenderId =
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim() ?? "";
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim() ?? "";

  const config = {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId: messagingSenderId || undefined,
    appId: appId || undefined
  };

  if (!config.apiKey || !config.authDomain || !config.projectId) {
    throw new Error(
      "Missing Firebase client env vars. Set NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, and NEXT_PUBLIC_FIREBASE_PROJECT_ID."
    );
  }

  app = initializeApp(config);
  return app;
}

export function firebaseAuth() {
  return getAuth(firebaseApp());
}
