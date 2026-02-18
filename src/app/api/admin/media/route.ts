import { NextResponse } from "next/server";
import {
  adminAuth,
  adminBucket,
  adminConfigStatus,
  adminDb,
  ownerAllowlist
} from "@/lib/firebase-admin";

type Folder = "hero" | "photos" | "floorplans" | "backgrounds" | "docs";

type MediaItem = {
  objectPath: string;
  name: string;
  signedUrl: string;
  contentType?: string;
  size?: string | number;
  updated?: string;
  label?: string;
};

type UpdatePayload = {
  slug?: string;
  media?: {
    hero?: string[];
    photos?: string[];
    floorplans?: string[];
    backgrounds?: string[];
    overviewBackdrop?: string;
    documents?: { label?: string; href?: string }[];
  };
};

type DeletePayload = {
  slug?: string;
  objectPath?: string;
};

function safeName(value: string) {
  return value
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-/, "")
    .replace(/-$/, "");
}

function sanitizeSlug(value: string) {
  return safeName(value.trim().toLowerCase());
}

function isPathInFolder(slug: string, folder: Folder, objectPath: string) {
  return objectPath.startsWith(`listings/${slug}/${folder}/`);
}

function normalizePathList(
  slug: string,
  folder: Folder,
  list: unknown
): string[] {
  if (!Array.isArray(list)) return [];
  const deduped = new Set<string>();
  for (const entry of list) {
    const path = String(entry ?? "").trim();
    if (!path || !isPathInFolder(slug, folder, path)) continue;
    deduped.add(path);
  }
  return Array.from(deduped);
}

function normalizeDocuments(
  slug: string,
  docs: unknown
): { label: string; href: string }[] {
  if (!Array.isArray(docs)) return [];
  const used = new Set<string>();
  const out: { label: string; href: string }[] = [];
  for (const entry of docs) {
    const href = String((entry as any)?.href ?? "").trim();
    if (!href || !isPathInFolder(slug, "docs", href)) continue;
    if (used.has(href)) continue;
    used.add(href);
    const rawLabel = String((entry as any)?.label ?? "").trim();
    out.push({
      label: rawLabel || href.split("/").pop() || "Document",
      href
    });
  }
  return out;
}

function mergeOrdered(
  discovered: string[],
  preferred: string[]
) {
  const preferredKnown = preferred.filter((path) => discovered.includes(path));
  const remaining = discovered.filter((path) => !preferredKnown.includes(path));
  return [...preferredKnown, ...remaining];
}

async function authorize(req: Request) {
  const authz = req.headers.get("authorization") || "";
  const token = authz.startsWith("Bearer ") ? authz.slice("Bearer ".length) : "";
  if (!token) {
    return { ok: false as const, res: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  }

  let decoded: { email?: string; uid: string };
  try {
    decoded = await adminAuth().verifyIdToken(token);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    const looksLikeMissingCreds =
      msg.includes("Could not load the default credentials") ||
      msg.includes("default credentials") ||
      msg.includes("invalid_grant") ||
      msg.includes("ENOTFOUND");

    if (looksLikeMissingCreds) {
      return {
        ok: false as const,
        res: NextResponse.json(
          {
            ok: false,
            error:
              "Server Firebase Admin SDK is not configured. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT.",
            status: adminConfigStatus()
          },
          { status: 500 }
        )
      };
    }

    return { ok: false as const, res: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  }

  const email = String(decoded.email ?? "").toLowerCase();
  if (!ownerAllowlist().has(email)) {
    return { ok: false as const, res: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true as const, decoded, email };
}

async function getSignedReadUrl(objectPath: string) {
  const bucket = adminBucket();
  const [signedUrl] = await bucket.file(objectPath).getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 24 * 60 * 60 * 1000
  });
  return signedUrl;
}

async function listFolderItems(slug: string, folder: Folder): Promise<MediaItem[]> {
  const prefix = `listings/${slug}/${folder}/`;
  const bucket = adminBucket();
  const [files] = await bucket.getFiles({ prefix });
  const names = files
    .map((f) => f.name)
    .filter((name) => !name.endsWith("/"))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const items = await Promise.all(
    names.map(async (objectPath) => {
      const file = files.find((f) => f.name === objectPath);
      const signedUrl = await getSignedReadUrl(objectPath);
      return {
        objectPath,
        name: objectPath.split("/").pop() || objectPath,
        signedUrl,
        contentType: file?.metadata?.contentType,
        size: file?.metadata?.size,
        updated: file?.metadata?.updated
      };
    })
  );

  return items;
}

export async function GET(req: Request) {
  const auth = await authorize(req);
  if (!auth.ok) return auth.res;

  const slugRaw = new URL(req.url).searchParams.get("slug") || "";
  const slug = sanitizeSlug(slugRaw);
  if (!slug) {
    return NextResponse.json({ ok: false, error: "Missing slug" }, { status: 400 });
  }

  try {
    const [heroItems, photoItems, floorplanItems, backgroundItems, docItems, snap] = await Promise.all([
      listFolderItems(slug, "hero"),
      listFolderItems(slug, "photos"),
      listFolderItems(slug, "floorplans"),
      listFolderItems(slug, "backgrounds"),
      listFolderItems(slug, "docs"),
      adminDb().doc(`properties/${slug}`).get()
    ]);

    const media = (snap.exists ? (snap.data() as any)?.media : {}) || {};
    const docLabelByPath = new Map<string, string>();
    for (const doc of Array.isArray(media.documents) ? media.documents : []) {
      const href = String((doc as any)?.href ?? "").trim();
      const label = String((doc as any)?.label ?? "").trim();
      if (href && label) docLabelByPath.set(href, label);
    }

    const heroOrder = normalizePathList(slug, "hero", media.hero);
    const photoOrder = normalizePathList(slug, "photos", media.photos);
    const floorplanOrder = normalizePathList(slug, "floorplans", media.floorplans);
    const backgroundOrder = normalizePathList(slug, "backgrounds", [
      ...(Array.isArray(media.backgrounds) ? media.backgrounds : []),
      media.overviewBackdrop
    ]);
    const docOrder = normalizePathList(
      slug,
      "docs",
      (Array.isArray(media.documents) ? media.documents : []).map((d: any) => d?.href)
    );

    const orderedHeroPaths = mergeOrdered(
      heroItems.map((item) => item.objectPath),
      heroOrder
    );
    const orderedPhotoPaths = mergeOrdered(
      photoItems.map((item) => item.objectPath),
      photoOrder
    );
    const orderedFloorPaths = mergeOrdered(
      floorplanItems.map((item) => item.objectPath),
      floorplanOrder
    );
    const orderedBackgroundPaths = mergeOrdered(
      backgroundItems.map((item) => item.objectPath),
      backgroundOrder
    );
    const orderedDocPaths = mergeOrdered(
      docItems.map((item) => item.objectPath),
      docOrder
    );

    const byPath = new Map<string, MediaItem>();
    for (const item of [...heroItems, ...photoItems, ...floorplanItems, ...backgroundItems, ...docItems]) {
      byPath.set(item.objectPath, item);
    }

    const orderedDocs = orderedDocPaths
      .map((path) => byPath.get(path))
      .filter(Boolean)
      .map((item) => ({
        ...(item as MediaItem),
        label: docLabelByPath.get((item as MediaItem).objectPath) || (item as MediaItem).name
      }));

    return NextResponse.json({
      ok: true,
      slug,
      media: {
        hero: orderedHeroPaths.map((path) => byPath.get(path)).filter(Boolean),
        photos: orderedPhotoPaths.map((path) => byPath.get(path)).filter(Boolean),
        floorplans: orderedFloorPaths.map((path) => byPath.get(path)).filter(Boolean),
        backgrounds: orderedBackgroundPaths.map((path) => byPath.get(path)).filter(Boolean),
        docs: orderedDocs
      }
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("Admin media GET failed", {
      message,
      slug,
      error: e,
      adminConfig: adminConfigStatus()
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await authorize(req);
  if (!auth.ok) return auth.res;

  const body = (await req.json().catch(() => null)) as UpdatePayload | null;
  const slug = sanitizeSlug(String(body?.slug ?? ""));
  if (!slug) {
    return NextResponse.json({ ok: false, error: "Missing slug" }, { status: 400 });
  }

  const nextMedia = {
    hero: normalizePathList(slug, "hero", body?.media?.hero),
    photos: normalizePathList(slug, "photos", body?.media?.photos),
    floorplans: normalizePathList(slug, "floorplans", body?.media?.floorplans),
    backgrounds: normalizePathList(slug, "backgrounds", body?.media?.backgrounds),
    documents: normalizeDocuments(slug, body?.media?.documents)
  };

  try {
    await adminDb()
      .doc(`properties/${slug}`)
      .set(
        {
          media: {
            ...nextMedia,
            overviewBackdrop: nextMedia.backgrounds[0] || null
          },
          updatedAt: new Date().toISOString(),
          updatedBy: { uid: auth.decoded.uid, email: auth.email }
        },
        { merge: true }
      );

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("Admin media POST failed", {
      message,
      slug,
      error: e,
      adminConfig: adminConfigStatus()
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await authorize(req);
  if (!auth.ok) return auth.res;

  const body = (await req.json().catch(() => null)) as DeletePayload | null;
  const slug = sanitizeSlug(String(body?.slug ?? ""));
  const objectPath = String(body?.objectPath ?? "").trim();
  if (!slug || !objectPath) {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }
  if (!objectPath.startsWith(`listings/${slug}/`)) {
    return NextResponse.json({ ok: false, error: "Invalid object path" }, { status: 400 });
  }

  try {
    await adminBucket().file(objectPath).delete({ ignoreNotFound: true });

    const ref = adminDb().doc(`properties/${slug}`);
    await adminDb().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return;
      const data = snap.data() as any;
      const media = (data?.media ?? {}) as any;

      const nextHero = normalizePathList(
        slug,
        "hero",
        (Array.isArray(media.hero) ? media.hero : []).filter((p: string) => p !== objectPath)
      );
      const nextPhotos = normalizePathList(
        slug,
        "photos",
        (Array.isArray(media.photos) ? media.photos : []).filter((p: string) => p !== objectPath)
      );
      const nextFloorplans = normalizePathList(
        slug,
        "floorplans",
        (Array.isArray(media.floorplans) ? media.floorplans : []).filter(
          (p: string) => p !== objectPath
        )
      );
      const nextBackgrounds = normalizePathList(
        slug,
        "backgrounds",
        (Array.isArray(media.backgrounds) ? media.backgrounds : []).filter(
          (p: string) => p !== objectPath
        )
      );
      const nextDocuments = normalizeDocuments(
        slug,
        (Array.isArray(media.documents) ? media.documents : []).filter(
          (d: any) => String(d?.href ?? "").trim() !== objectPath
        )
      );

      tx.set(
        ref,
        {
          media: {
            hero: nextHero,
            photos: nextPhotos,
            floorplans: nextFloorplans,
            backgrounds: nextBackgrounds,
            overviewBackdrop: nextBackgrounds[0] || null,
            documents: nextDocuments
          },
          updatedAt: new Date().toISOString(),
          updatedBy: { uid: auth.decoded.uid, email: auth.email }
        },
        { merge: true }
      );
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("Admin media DELETE failed", {
      message,
      slug,
      objectPath,
      error: e,
      adminConfig: adminConfigStatus()
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
