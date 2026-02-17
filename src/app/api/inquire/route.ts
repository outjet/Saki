import { NextResponse } from "next/server";

type InquiryPayload = {
  propertySlug?: string;
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as InquiryPayload | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const propertySlug = String(body.propertySlug ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const message = String(body.message ?? "").trim();

  if (!name || !email || !propertySlug) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields." },
      { status: 400 }
    );
  }

  // Demo behavior: log the inquiry server-side.
  // Production: forward to email/SMS provider (Resend/SendGrid/Twilio) or store in a CRM.
  // Avoid logging PII in production; use secure storage / redaction as needed.
  console.log("[inquiry]", {
    at: new Date().toISOString(),
    propertySlug,
    name,
    email,
    phone,
    message
  });

  return NextResponse.json({ ok: true });
}

