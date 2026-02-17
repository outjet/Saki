import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function parseServiceAccount() {
  const raw =
    process.env.FIREBASE_ADMIN_SDK_JSON || process.env.FIREBASE_SERVICE_ACCOUNT || "";
  if (!raw) return null;
  try {
    return JSON.parse(raw) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };
  } catch {
    return null;
  }
}

export function getAdminApp() {
  if (getApps().length === 0) {
    const serviceAccount = parseServiceAccount();
    const storageBucket =
      process.env.FIREBASE_STORAGE_BUCKET ||
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

    if (serviceAccount?.client_email && serviceAccount?.private_key) {
      initializeApp({
        credential: cert(serviceAccount as any),
        ...(storageBucket ? { storageBucket } : {})
      });
    } else {
      initializeApp({
        ...(storageBucket ? { storageBucket } : {})
      });
    }
  }
  return getApps()[0]!;
}

export function adminAuth() {
  getAdminApp();
  return getAuth();
}

export function adminDb() {
  getAdminApp();
  return getFirestore();
}

export function adminBucket() {
  getAdminApp();
  const storage = getStorage();
  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  return bucketName ? storage.bucket(bucketName) : storage.bucket();
}

export function adminConfigStatus() {
  const hasExplicitJson = Boolean(
    process.env.FIREBASE_ADMIN_SDK_JSON || process.env.FIREBASE_SERVICE_ACCOUNT
  );
  const hasBucket = Boolean(
    process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  );
  return { hasExplicitJson, hasBucket };
}

export function ownerAllowlist() {
  const raw = process.env.OWNER_EMAIL_ALLOWLIST || "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}
