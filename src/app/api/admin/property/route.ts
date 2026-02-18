import { NextResponse } from "next/server";
import type { Property } from "@/lib/types";
import {
  adminAuth,
  adminConfigStatus,
  adminDb,
  ownerAllowlist
} from "@/lib/firebase-admin";

type Payload = {
  slug?: string;
  property?: Omit<Property, "slug">;
};

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
  if (!body?.slug || !body.property) {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  const slug = String(body.slug).trim();
  if (!slug) {
    return NextResponse.json({ ok: false, error: "Missing slug" }, { status: 400 });
  }

  try {
    await adminDb()
      .doc(`properties/${slug}`)
      .set(
        {
          ...body.property,
          updatedAt: new Date().toISOString(),
          updatedBy: { uid: decoded.uid, email }
        },
        { merge: true }
      );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const code = (e as any)?.code;
    const status = (e as any)?.status;
    const looksLikeFirestoreNotFound =
      code === 5 ||
      status === "NOT_FOUND" ||
      message.startsWith("5 NOT_FOUND") ||
      message.includes("The database (default) does not exist");

    const publicMessage = looksLikeFirestoreNotFound
      ? `Firestore returned NOT_FOUND. This usually means the server is targeting the wrong GCP project, or Firestore isn't enabled for the target project. (${message})`
      : message;
    try {
      console.error("Admin property write failed", {
        message,
        code,
        status,
        error: e,
        slug,
        uid: decoded?.uid,
        email,
        adminConfig: adminConfigStatus()
      });
    } catch (logErr) {
      console.error("Failed to log error detail", logErr);
    }
    return NextResponse.json({ ok: false, error: publicMessage }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
