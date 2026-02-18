import type { Property } from "@/lib/types";
import { adminBucket, adminDb } from "@/lib/firebase-admin";
import fs from "node:fs/promises";
import path from "node:path";

function isServerFirebaseAvailable() {
  return Boolean(
    process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCLOUD_PROJECT ||
      process.env.FIREBASE_CONFIG ||
      process.env.FIREBASE_PROJECT_ID
  );
}

function byName(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true });
}

const PUBLIC_LISTINGS_ROOT = path.join(process.cwd(), "public", "listings");
const ENABLE_PUBLIC_LISTINGS_FALLBACK =
  String(process.env.ENABLE_PUBLIC_LISTINGS_FALLBACK ?? "true").toLowerCase() !==
  "false";

async function fileExists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function isMediaFile(name: string) {
  const lower = name.toLowerCase();
  return (
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".png") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".avif") ||
    lower.endsWith(".svg")
  );
}

async function listPublicFiles(slug: string, subdir: string) {
  const dir = path.join(PUBLIC_LISTINGS_ROOT, slug, subdir);
  if (!(await fileExists(dir))) return [];

  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((n) => (subdir === "docs" ? true : isMediaFile(n)))
    .sort(byName);

  return files.map((f) => `/listings/${slug}/${subdir}/${f}`);
}

async function listObjectPaths(prefix: string) {
  const bucket = adminBucket();
  const [files] = await bucket.getFiles({ prefix });
  return files
    .map((f) => f.name)
    .filter((n) => !n.endsWith("/"))
    .sort(byName);
}

async function signedReadUrls(objectPaths: string[], hours = 24) {
  const bucket = adminBucket();
  const expires = Date.now() + hours * 60 * 60 * 1000;
  const urls = await Promise.all(
    objectPaths.map(async (name) => {
      const [url] = await bucket.file(name).getSignedUrl({
        version: "v4",
        action: "read",
        expires
      });
      return url;
    })
  );
  return urls;
}

function isStorageObjectPath(value: string) {
  return value.startsWith("listings/");
}

function cleanStringList(list: string[] | undefined) {
  return (list ?? []).map((v) => String(v ?? "").trim()).filter(Boolean);
}

async function resolveMediaRefs(refs: string[] | undefined) {
  const cleaned = cleanStringList(refs);
  const storagePaths = cleaned.filter(isStorageObjectPath);
  if (storagePaths.length === 0) return cleaned;

  const signed = await signedReadUrls(storagePaths).catch(() => [] as string[]);
  const signedByPath = new Map<string, string>();
  for (const [idx, path] of storagePaths.entries()) {
    const url = signed[idx];
    if (url) signedByPath.set(path, url);
  }

  return cleaned.map((value) => signedByPath.get(value) ?? value);
}

async function resolveDocumentRefs(
  docs: { label: string; href: string }[] | undefined
) {
  const cleaned = (docs ?? [])
    .map((doc) => ({
      label: String(doc?.label ?? "").trim(),
      href: String(doc?.href ?? "").trim()
    }))
    .filter((doc) => Boolean(doc.href));

  const storagePaths = cleaned
    .map((doc) => doc.href)
    .filter(isStorageObjectPath);
  if (storagePaths.length === 0) return cleaned;

  const signed = await signedReadUrls(storagePaths).catch(() => [] as string[]);
  const signedByPath = new Map<string, string>();
  for (const [idx, path] of storagePaths.entries()) {
    const url = signed[idx];
    if (url) signedByPath.set(path, url);
  }

  return cleaned.map((doc) => ({
    ...doc,
    href: signedByPath.get(doc.href) ?? doc.href
  }));
}

async function resolveMediaForRender(media: Property["media"] | undefined) {
  const base = media ?? {};
  const [hero, photos, floorplans, documents] = await Promise.all([
    resolveMediaRefs(base.hero),
    resolveMediaRefs(base.photos),
    resolveMediaRefs(base.floorplans),
    resolveDocumentRefs(base.documents)
  ]);

  return {
    ...base,
    hero,
    photos,
    floorplans,
    documents
  };
}

async function autoDiscoverMedia(slug: string) {
  const base = `listings/${slug}/`;
  const [heroPaths, photoPaths, floorplanPaths, docPaths] = await Promise.all([
    listObjectPaths(`${base}hero/`).catch(() => [] as string[]),
    listObjectPaths(`${base}photos/`).catch(() => [] as string[]),
    listObjectPaths(`${base}floorplans/`).catch(() => [] as string[]),
    listObjectPaths(`${base}docs/`).catch(() => [] as string[])
  ]);

  const noCloudMedia =
    heroPaths.length === 0 &&
    photoPaths.length === 0 &&
    floorplanPaths.length === 0 &&
    docPaths.length === 0;

  if (noCloudMedia) {
    if (!ENABLE_PUBLIC_LISTINGS_FALLBACK) {
      return {
        hero: [] as string[],
        photos: [] as string[],
        floorplans: [] as string[],
        documents: [] as { label: string; href: string }[]
      };
    }

    const [hero, photos, floorplans, docs] = await Promise.all([
      listPublicFiles(slug, "hero").catch(() => [] as string[]),
      listPublicFiles(slug, "photos").catch(() => [] as string[]),
      listPublicFiles(slug, "floorplans").catch(() => [] as string[]),
      listPublicFiles(slug, "docs").catch(() => [] as string[])
    ]);

    const mergedPhotos = Array.from(new Set([...hero, ...photos]));
    return {
      hero,
      photos: mergedPhotos,
      floorplans,
      documents: docs.map((href) => ({
        label: href.split("/").pop() ?? "Document",
        href
      }))
    };
  }

  const [heroUrls, photoUrls, floorUrls, docUrls] = await Promise.all([
    signedReadUrls(heroPaths),
    signedReadUrls(photoPaths),
    signedReadUrls(floorplanPaths),
    signedReadUrls(docPaths)
  ]);

  const mergedPhotos = Array.from(new Set([...heroUrls, ...photoUrls]));

  return {
    hero: heroUrls,
    photos: mergedPhotos,
    floorplans: floorUrls,
    documents: docUrls.map((href, idx) => ({
      label: docPaths[idx]?.split("/").pop() ?? "Document",
      href
    }))
  };
}

export async function getPropertyFromFirestore(
  slug: string
): Promise<Property | null> {
  if (!isServerFirebaseAvailable()) return null;

  let snap: FirebaseFirestore.DocumentSnapshot;
  try {
    snap = await adminDb().doc(`properties/${slug}`).get();
  } catch (e) {
    console.warn("[property-store] Firestore read failed", {
      slug,
      message: e instanceof Error ? e.message : String(e)
    });
    return null;
  }

  if (!snap.exists) return null;

  const data = snap.data() as Omit<Property, "slug">;
  const base: Property = { ...(data as any), slug };

  const media = base.media ?? {};
  const needsDiscover =
    !media.hero?.length ||
    !media.photos?.length ||
    !media.floorplans?.length ||
    !media.documents?.length;

  const discovered = needsDiscover ? await autoDiscoverMedia(slug).catch(() => null) : null;
  const mergedMedia = {
    ...media,
    hero: media.hero?.length ? media.hero : discovered?.hero ?? [],
    photos: media.photos?.length ? media.photos : discovered?.photos ?? [],
    floorplans: media.floorplans?.length
      ? media.floorplans
      : discovered?.floorplans ?? [],
    documents: media.documents?.length ? media.documents : discovered?.documents ?? []
  };

  const resolvedMedia = await resolveMediaForRender(mergedMedia).catch(
    () => mergedMedia
  );

  return {
    ...base,
    media: resolvedMedia
  };
}

export async function listPropertySlugsFromFirestore(): Promise<string[] | null> {
  if (!isServerFirebaseAvailable()) return null;
  try {
    const snap = await adminDb().collection("properties").get();
    return snap.docs.map((d) => d.id).sort(byName);
  } catch (e) {
    console.warn("[property-store] Firestore list failed", {
      message: e instanceof Error ? e.message : String(e)
    });
    return null;
  }
}
