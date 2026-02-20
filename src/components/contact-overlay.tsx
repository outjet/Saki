"use client";

import { useState } from "react";
import { InquiryForm } from "@/components/inquiry-form";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function ContactOverlay({
  propertySlug,
  contactCtaText,
  contactVideo
}: {
  propertySlug: string;
  contactCtaText: string;
  contactVideo?: string;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  function trackToggle(nextCollapsed: boolean) {
    if (typeof window === "undefined") return;

    const panelState = nextCollapsed ? "hidden" : "shown";
    const payload = {
      panel_state: panelState,
      property_slug: propertySlug,
      section: "contact"
    };

    if (typeof window.gtag === "function") {
      window.gtag("event", "contact_panel_toggle", payload);
    }

    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({
        event: "contact_panel_toggle",
        ...payload
      });
    }
  }

  function toggleContactPanel() {
    setIsCollapsed((prev) => {
      const next = !prev;
      trackToggle(next);
      return next;
    });
  }

  return (
    <section id="contact" className="relative py-10 sm:py-12">
      {contactVideo ? (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          aria-hidden="true"
        >
          <source src={contactVideo} />
        </video>
      ) : null}
      <div className="absolute inset-0 bg-black/30" aria-hidden="true" />
      <div className="relative container-page">
        <div className="flex justify-end">
          <button
            type="button"
            className="inline-flex h-10 items-center rounded-full border border-white/45 bg-black/35 px-4 text-sm font-semibold text-white transition hover:bg-black/50"
            onClick={toggleContactPanel}
            aria-expanded={!isCollapsed}
            aria-controls={`contact-panel-${propertySlug}`}
          >
            {isCollapsed ? "Show contact form" : "Hide contact form"}
          </button>
        </div>

        <div
          id={`contact-panel-${propertySlug}`}
          className={`overflow-hidden transition-all duration-500 ease-out ${
            isCollapsed
              ? "mt-0 max-h-0 -translate-y-4 opacity-0"
              : "mt-4 max-h-[1000px] translate-y-0 opacity-100"
          }`}
          aria-hidden={isCollapsed}
        >
          <div className="rounded-3xl border border-white/20 bg-slate-700/35 p-6 sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-white">Contact</h2>
                <p className="mt-1 text-sm text-white/85">
                  <b>{contactCtaText}</b>
                </p>
              </div>
            </div>
            <div className="mt-6">
              <div className="mx-auto max-w-3xl">
                <InquiryForm propertySlug={propertySlug} tone="dark" />
              </div>
            </div>
          </div>
        </div>

        <div
          className={`pt-5 text-center transition-opacity duration-300 ${
            isCollapsed ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          aria-hidden={!isCollapsed}
        >
          <p className="inline-flex rounded-full border border-white/45 bg-black/30 px-4 py-2 text-sm text-white/95">
            Enjoy the aerial view. Bring the form back any time.
          </p>
        </div>
      </div>
    </section>
  );
}
