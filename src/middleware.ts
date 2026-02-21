import { NextRequest, NextResponse } from "next/server";

const TRACKING_QUERY_PARAMS = new Set([
  "fbclid",
  "gclid",
  "gbraid",
  "wbraid",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "mc_cid",
  "mc_eid"
]);

export function middleware(request: NextRequest) {
  const nextUrl = request.nextUrl.clone();
  let shouldRedirect = false;

  for (const key of TRACKING_QUERY_PARAMS) {
    if (!nextUrl.searchParams.has(key)) continue;
    nextUrl.searchParams.delete(key);
    shouldRedirect = true;
  }

  if (!shouldRedirect) {
    return NextResponse.next();
  }

  return NextResponse.redirect(nextUrl, { status: 308 });
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"]
};
