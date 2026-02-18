import type { Property } from "@/lib/types";
import { adminBucket, adminDb } from "@/lib/firebase-admin";

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

const signedUrlCache = new Map<
  string,
  { url: string; expiresAtMs: number }
>();

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
  const now = Date.now();
  const expiresAtMs = now + hours * 60 * 60 * 1000;
  const expires = new Date(expiresAtMs);
  const urls = await Promise.all(
    objectPaths.map(async (name) => {
      const cached = signedUrlCache.get(name);
      if (cached && cached.expiresAtMs - now > 5 * 60 * 1000) {
        return cached.url;
      }
      const [url] = await bucket.file(name).getSignedUrl({
        version: "v4",
        action: "read",
        expires
      });
      signedUrlCache.set(name, { url, expiresAtMs });
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

async function resolveMediaRef(ref: string | undefined) {
  const cleaned = String(ref ?? "").trim();
  if (!cleaned || !isStorageObjectPath(cleaned)) return cleaned || undefined;
  const [signed] = await signedReadUrls([cleaned]).catch(() => [] as string[]);
  return signed || cleaned;
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
  const [
    hero,
    photos,
    floorplans,
    backgrounds,
    overviewBackdrop,
    contactVideos,
    contactVideo,
    documents
  ] = await Promise.all([
    resolveMediaRefs(base.hero),
    resolveMediaRefs(base.photos),
    resolveMediaRefs(base.floorplans),
    resolveMediaRefs(base.backgrounds),
    resolveMediaRef(base.overviewBackdrop),
    resolveMediaRefs(base.contactVideos),
    resolveMediaRef(base.contactVideo),
    resolveDocumentRefs(base.documents)
  ]);

  return {
    ...base,
    hero,
    photos,
    floorplans,
    backgrounds,
    overviewBackdrop: overviewBackdrop || backgrounds[0] || photos[0] || hero[0],
    contactVideos,
    contactVideo: contactVideo || contactVideos[0],
    documents
  };
}

async function autoDiscoverMedia(slug: string) {
  const base = `listings/${slug}/`;
  const [
    heroPaths,
    photoPaths,
    floorplanPaths,
    backgroundPaths,
    contactVideoPaths,
    docPaths
  ] = await Promise.all([
    listObjectPaths(`${base}hero/`).catch(() => [] as string[]),
    listObjectPaths(`${base}photos/`).catch(() => [] as string[]),
    listObjectPaths(`${base}floorplans/`).catch(() => [] as string[]),
    listObjectPaths(`${base}backgrounds/`).catch(() => [] as string[]),
    listObjectPaths(`${base}contactvideo/`).catch(() => [] as string[]),
    listObjectPaths(`${base}docs/`).catch(() => [] as string[])
  ]);

  const noCloudMedia =
    heroPaths.length === 0 &&
    photoPaths.length === 0 &&
    floorplanPaths.length === 0 &&
    backgroundPaths.length === 0 &&
    contactVideoPaths.length === 0 &&
    docPaths.length === 0;

  if (noCloudMedia) {
    return {
      hero: [] as string[],
      photos: [] as string[],
      floorplans: [] as string[],
      backgrounds: [] as string[],
      overviewBackdrop: undefined as string | undefined,
      contactVideos: [] as string[],
      contactVideo: undefined as string | undefined,
      documents: [] as { label: string; href: string }[]
    };
  }

  const [heroUrls, photoUrls, floorUrls, backgroundUrls, contactVideoUrls, docUrls] =
    await Promise.all([
    signedReadUrls(heroPaths),
    signedReadUrls(photoPaths),
    signedReadUrls(floorplanPaths),
    signedReadUrls(backgroundPaths),
    signedReadUrls(contactVideoPaths),
    signedReadUrls(docPaths)
  ]);

  const mergedPhotos = Array.from(new Set([...heroUrls, ...photoUrls]));

  return {
    hero: heroUrls,
    photos: mergedPhotos,
    floorplans: floorUrls,
    backgrounds: backgroundUrls,
    overviewBackdrop: backgroundUrls[0],
    contactVideos: contactVideoUrls,
    contactVideo: contactVideoUrls[0],
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
    !media.backgrounds?.length ||
    !media.contactVideos?.length ||
    !media.documents?.length;

  const discovered = needsDiscover ? await autoDiscoverMedia(slug).catch(() => null) : null;
  const mergedMedia = {
    ...media,
    hero: media.hero?.length ? media.hero : discovered?.hero ?? [],
    photos: media.photos?.length ? media.photos : discovered?.photos ?? [],
    floorplans: media.floorplans?.length
      ? media.floorplans
      : discovered?.floorplans ?? [],
    backgrounds: media.backgrounds?.length
      ? media.backgrounds
      : discovered?.backgrounds ?? [],
    overviewBackdrop:
      media.overviewBackdrop ||
      media.backgrounds?.[0] ||
      discovered?.overviewBackdrop ||
      discovered?.backgrounds?.[0],
    contactVideos: media.contactVideos?.length
      ? media.contactVideos
      : discovered?.contactVideos ?? [],
    contactVideo:
      media.contactVideo ||
      media.contactVideos?.[0] ||
      discovered?.contactVideo ||
      discovered?.contactVideos?.[0],
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
