import { NextResponse } from "next/server";
import {
  adminAuth,
  adminBucket,
  adminConfigStatus,
  ownerAllowlist
} from "@/lib/firebase-admin";

type Payload = {
  slug?: string;
  folder?: "hero" | "photos" | "floorplans" | "docs";
  filename?: string;
  contentType?: string;
};

function safeName(name: string) {
  return name
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-/, "")
    .replace(/-$/, "");
}

export async function POST(req: Request) {
  const authz = req.headers.get("authorization") || "";
  const token = authz.startsWith("Bearer ") ? authz.slice("Bearer ".length) : "";
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
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
      return NextResponse.json(
        {
          ok: false,
          error:
            "Server Firebase Admin SDK is not configured. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT.",
          status: adminConfigStatus()
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const email = String(decoded.email ?? "").toLowerCase();
  if (!ownerAllowlist().has(email)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Payload | null;
  const slug = safeName(String(body?.slug ?? "").trim());
  const folder = body?.folder;
  const filename = safeName(String(body?.filename ?? "").trim());
  const contentType = String(body?.contentType ?? "application/octet-stream");

  if (!slug || !folder || !filename) {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  const objectPath = `listings/${slug}/${folder}/${filename}`;
  try {
    const bucket = adminBucket();
    const file = bucket.file(objectPath);

    const expires = Date.now() + 15 * 60 * 1000;
    const [signedUrl] = await file.getSignedUrl({
      version: "v4",
      action: "write",
      expires,
      contentType
    });

    return NextResponse.json({ ok: true, objectPath, signedUrl });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const looksLikeSignBlob =
      message.includes("signBlob") ||
      message.includes("iam.serviceAccounts.signBlob") ||
      message.includes("permission") ||
      message.includes("serviceAccounts.signBlob");

    const publicMessage = looksLikeSignBlob
      ? `Failed to sign upload URL. The Cloud Run/App Hosting service account likely needs iam.serviceAccounts.signBlob (roles/iam.serviceAccountTokenCreator on itself). (${message})`
      : message;

    try {
      console.error("Admin upload-url failed", {
        message,
        error: e,
        objectPath,
        uid: decoded?.uid,
        email,
        adminConfig: adminConfigStatus()
      });
    } catch (logErr) {
      console.error("Failed to log error detail", logErr);
    }

    return NextResponse.json({ ok: false, error: publicMessage }, { status: 500 });
  }
}
