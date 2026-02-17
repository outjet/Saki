import { NextResponse } from "next/server";
import { adminAuth, adminConfigStatus, ownerAllowlist } from "@/lib/firebase-admin";

export async function GET(req: Request) {
  const authz = req.headers.get("authorization") || "";
  const token = authz.startsWith("Bearer ") ? authz.slice("Bearer ".length) : "";
  if (!token) {
    return NextResponse.json({ ok: false, allowed: false }, { status: 401 });
  }

  try {
    const decoded = await adminAuth().verifyIdToken(token);
    const email = String(decoded.email ?? "").toLowerCase();
    const allowed = ownerAllowlist().has(email);
    return NextResponse.json({
      ok: true,
      allowed,
      email,
      uid: decoded.uid,
      name: decoded.name ?? null,
      picture: decoded.picture ?? null
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    const looksLikeMissingCreds =
      msg.includes("Could not load the default credentials") ||
      msg.includes("default credentials") ||
      msg.includes("invalid_grant") ||
      msg.includes("ENOTFOUND");

    if (looksLikeMissingCreds) {
      const status = adminConfigStatus();
      return NextResponse.json(
        {
          ok: false,
          allowed: false,
          error:
            "Server Firebase Admin SDK is not configured. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT.",
          status
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: false, allowed: false }, { status: 401 });
  }
}
