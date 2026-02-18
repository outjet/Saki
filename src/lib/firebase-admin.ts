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

function parseWebConfigProjectId() {
  const raw = process.env.FIREBASE_WEB_CONFIG_JSON || "";
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw) as { projectId?: string };
    return parsed.projectId?.trim() || "";
  } catch {
    return "";
  }
}

function parseWebConfigStorageBucket() {
  const raw = process.env.FIREBASE_WEB_CONFIG_JSON || "";
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw) as { storageBucket?: string };
    return parsed.storageBucket?.trim() || "";
  } catch {
    return "";
  }
}

function resolveProjectId(serviceAccount: { project_id?: string } | null) {
  return (
    serviceAccount?.project_id ||
    process.env.FIREBASE_PROJECT_ID ||
    parseWebConfigProjectId() ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    ""
  );
}

function resolveStorageBucket() {
  return (
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    parseWebConfigStorageBucket() ||
    ""
  );
}

export function getAdminApp() {
  if (getApps().length === 0) {
    const serviceAccount = parseServiceAccount();
    const storageBucket = resolveStorageBucket() || undefined;
    const projectId = resolveProjectId(serviceAccount) || undefined;

    if (serviceAccount?.client_email && serviceAccount?.private_key) {
      initializeApp({
        credential: cert(serviceAccount as any),
        ...(projectId ? { projectId } : {}),
        ...(storageBucket ? { storageBucket } : {})
      });
    } else {
      initializeApp({
        ...(projectId ? { projectId } : {}),
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
  const app = getAdminApp();
  return getFirestore(app);
}

export function adminBucket() {
  const app = getAdminApp();
  const storage = getStorage(app);
  const bucketName = resolveStorageBucket() || undefined;
  return bucketName ? storage.bucket(bucketName) : storage.bucket();
}

export function adminConfigStatus() {
  const hasExplicitJson = Boolean(
    process.env.FIREBASE_ADMIN_SDK_JSON || process.env.FIREBASE_SERVICE_ACCOUNT
  );
  const hasBucket = Boolean(
    process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  );
  const serviceAccount = parseServiceAccount();
  const resolvedProjectId = resolveProjectId(serviceAccount) || null;
  const resolvedStorageBucket = resolveStorageBucket() || null;
  return { hasExplicitJson, hasBucket, resolvedProjectId, resolvedStorageBucket };
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
