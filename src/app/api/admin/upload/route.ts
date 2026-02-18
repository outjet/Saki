import { NextResponse } from "next/server";
import {
  adminAuth,
  adminBucket,
  adminConfigStatus,
  ownerAllowlist
} from "@/lib/firebase-admin";

type Folder = "hero" | "photos" | "floorplans" | "backgrounds" | "docs";

function safeName(name: string) {
  return name
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-/, "")
    .replace(/-$/, "");
}

function safeSlug(value: string) {
  return safeName(value.trim().toLowerCase());
}

async function authorize(req: Request) {
  const authz = req.headers.get("authorization") || "";
  const token = authz.startsWith("Bearer ") ? authz.slice("Bearer ".length) : "";
  if (!token) {
    return {
      ok: false as const,
      res: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    };
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

    return {
      ok: false as const,
      res: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    };
  }

  const email = String(decoded.email ?? "").toLowerCase();
  if (!ownerAllowlist().has(email)) {
    return {
      ok: false as const,
      res: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
    };
  }

  return { ok: true as const, decoded, email };
}

function normalizeFolder(value: string): Folder | null {
  if (
    value === "hero" ||
    value === "photos" ||
    value === "floorplans" ||
    value === "backgrounds" ||
    value === "docs"
  ) {
    return value;
  }
  return null;
}

export async function POST(req: Request) {
  const auth = await authorize(req);
  if (!auth.ok) return auth.res;

  try {
    const form = await req.formData();
    const slug = safeSlug(String(form.get("slug") ?? ""));
    const folder = normalizeFolder(String(form.get("folder") ?? ""));
    const file = form.get("file");

    if (!slug || !folder || !(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }

    const filename = safeName(file.name || "upload.bin");
    if (!filename) {
      return NextResponse.json({ ok: false, error: "Invalid filename" }, { status: 400 });
    }

    const objectPath = `listings/${slug}/${folder}/${filename}`;
    const contentType = file.type || "application/octet-stream";
    const bytes = Buffer.from(await file.arrayBuffer());

    await adminBucket().file(objectPath).save(bytes, {
      resumable: false,
      contentType,
      metadata: {
        contentType
      }
    });

    return NextResponse.json({ ok: true, objectPath });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("Admin upload failed", {
      message,
      error: e,
      adminConfig: adminConfigStatus()
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
