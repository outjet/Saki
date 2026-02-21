#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import admin from "firebase-admin";

function parseServiceAccount() {
  const raw = process.env.FIREBASE_ADMIN_SDK_JSON || process.env.FIREBASE_SERVICE_ACCOUNT || "";
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function resolveProjectId(serviceAccount) {
  return (
    serviceAccount?.project_id ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    ""
  );
}

function safeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-/, "")
    .replace(/-$/, "");
}

function usageAndExit(message) {
  if (message) console.error(message);
  console.error("Usage: node scripts/push-property-to-firestore.mjs <slug>");
  console.error("Example: node scripts/push-property-to-firestore.mjs 23760-emmons-road");
  console.error("");
  console.error(
    "Auth: set FIREBASE_SERVICE_ACCOUNT to a service-account JSON string, or rely on GOOGLE_APPLICATION_CREDENTIALS (ADC)."
  );
  process.exit(1);
}

const slug = safeSlug(process.argv[2]);
if (!slug) usageAndExit("Missing <slug>.");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const jsonPath = path.join(repoRoot, "content", "properties", slug, "property.json");

const serviceAccount = parseServiceAccount();
const projectId = resolveProjectId(serviceAccount) || undefined;

if (!admin.apps.length) {
  if (serviceAccount?.client_email && serviceAccount?.private_key) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      ...(projectId ? { projectId } : {})
    });
  } else {
    admin.initializeApp({
      ...(projectId ? { projectId } : {})
    });
  }
}

let property;
try {
  const raw = await fs.readFile(jsonPath, "utf8");
  property = JSON.parse(raw);
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  usageAndExit(`Failed to read/parse ${jsonPath}: ${msg}`);
}

const db = admin.firestore();
await db
  .doc(`properties/${slug}`)
  .set(
    {
      ...property,
      updatedAt: new Date().toISOString(),
      updatedBy: { source: "cli" }
    },
    { merge: true }
  );

console.log(`✅ Wrote properties/${slug} (merge: true) from ${jsonPath}`);

