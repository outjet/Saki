import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";

let app: FirebaseApp | null = null;

export function firebaseApp() {
  if (app) return app;

  // Next.js only inlines env vars on the client when they are referenced
  // explicitly (e.g. `process.env.NEXT_PUBLIC_FOO`), not dynamically
  // (e.g. `process.env[name]`).
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim();
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() || undefined;
  const messagingSenderId =
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim() || undefined;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim() || undefined;

  if (!apiKey || !authDomain || !projectId) {
    throw new Error(
      "Missing Firebase client env vars. Set NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, and NEXT_PUBLIC_FIREBASE_PROJECT_ID."
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
