import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";

let app: FirebaseApp | null = null;

function env(name: string) {
  const v = process.env[name];
  return typeof v === "string" ? v.trim() : "";
}

export function firebaseApp() {
  if (app) return app;

  const config = {
    apiKey: env("NEXT_PUBLIC_FIREBASE_API_KEY"),
    authDomain: env("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
    projectId: env("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
    storageBucket: env("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: env("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID") || undefined,
    appId: env("NEXT_PUBLIC_FIREBASE_APP_ID") || undefined
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
