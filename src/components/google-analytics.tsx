"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

export function GoogleAnalytics({
  measurementId
}: {
  measurementId?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTrackedPathRef = useRef<string>("");
  const lastTrackedPropertyRef = useRef<string>("");

  useEffect(() => {
    if (!measurementId) return;
    if (typeof window === "undefined") return;

    const query = searchParams.toString();
    const pagePath = query ? `${pathname}?${query}` : pathname;
    if (lastTrackedPathRef.current === pagePath) return;
    const sendTracking = () => {
      if (typeof window.gtag !== "function") return false;
      lastTrackedPathRef.current = pagePath;

      window.gtag("event", "page_view", {
        page_path: pagePath,
        page_location: window.location.href,
        page_title: document.title
      });

      const match = pathname.match(/^\/p\/([^/]+)/);
      if (!match) {
        lastTrackedPropertyRef.current = "";
        return true;
      }

      const propertySlug = decodeURIComponent(match[1] || "").trim();
      if (!propertySlug || lastTrackedPropertyRef.current === propertySlug) return true;
      lastTrackedPropertyRef.current = propertySlug;
      window.gtag("event", "view_property", {
        property_slug: propertySlug,
        page_path: pagePath
      });
      return true;
    };

    if (sendTracking()) return;
    const retry = window.setTimeout(() => {
      void sendTracking();
    }, 350);
    return () => window.clearTimeout(retry);
  }, [measurementId, pathname, searchParams]);

  if (!measurementId) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js', new Date());gtag('config', '${measurementId}', { send_page_view: false });`}
      </Script>
    </>
  );
}
