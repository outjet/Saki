"use client";

import Script from "next/script";
import { useEffect, useMemo, useRef, useState } from "react";

type GoogleMapProps = {
  lat: number;
  lon: number;
  mapId?: string;
  zoom?: number;
  heightPx?: number;
  mapTypeId?: "roadmap" | "satellite" | "hybrid" | "terrain";
  mapStyle?: unknown;
  markerTitle?: string;
  mapElementId: string;
};

export function GoogleMap({
  lat,
  lon,
  mapId,
  zoom = 17,
  heightPx = 650,
  mapTypeId = "satellite",
  mapStyle,
  markerTitle,
  mapElementId
}: GoogleMapProps) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const [ready, setReady] = useState(false);
  const [shouldLoadMapScript, setShouldLoadMapScript] = useState(false);
  const [scrollZoom, setScrollZoom] = useState(false);

  const mapRef = useRef<any>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const src = useMemo(() => {
    if (!key) return null;
    const params = new URLSearchParams({ v: "3", key });
    return `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
  }, [key]);

  useEffect(() => {
    if (shouldLoadMapScript) return;
    const target = wrapperRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setShouldLoadMapScript(true);
          observer.disconnect();
          break;
        }
      },
      { rootMargin: "300px 0px", threshold: 0.01 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [shouldLoadMapScript]);

  useEffect(() => {
    if (!shouldLoadMapScript) return;
    if (typeof window === "undefined") return;
    const g = (window as any).google;
    if (g?.maps) setReady(true);
  }, [shouldLoadMapScript]);

  // Create map once
  useEffect(() => {
    if (!ready) return;
    if (typeof window === "undefined") return;

    const g = (window as any).google;
    if (!g?.maps) return;

    const el = document.getElementById(mapElementId);
    if (!el) return;

    // If you hot-reload / re-render and the same element is reused,
    // this prevents creating multiple map instances.
    if (mapRef.current) return;

    const center = { lat, lng: lon };

    const map = new g.maps.Map(el, {
      center,
      zoom,
      mapTypeId,
      styles: mapStyle as any,
      ...(mapId ? { mapId } : {}),

      // keep the map "normal"
      streetViewControl: true,
      mapTypeControl: true,
      fullscreenControl: true,
      zoomControl: true,
      scaleControl: true,
      rotateControl: true,

      // only protect page scrolling:
      scrollwheel: false,
      // Optional: helps on trackpads/touch. "cooperative" is less hijacky than "greedy".
      gestureHandling: "cooperative",

      // keep these always enabled
      draggable: true
    });

    new g.maps.Marker({
      position: center,
      map,
      title: markerTitle
    });

    mapRef.current = map;
  }, [ready, mapElementId, lat, lon, zoom, mapTypeId, mapStyle, markerTitle, mapId]);

  // Update scrollwheel dynamically after map exists
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.setOptions) return;

    map.setOptions({
      scrollwheel: scrollZoom,
      // keep gestureHandling cooperative; enabling scrollwheel is enough
      gestureHandling: "cooperative"
    });
  }, [scrollZoom]);

  if (!src) {
    return (
      <div
        className="flex items-center justify-center rounded-none bg-ink-50"
        style={{ height: `${heightPx}px` }}
      >
        <div className="max-w-xl px-6 text-center">
          <p className="text-sm font-semibold text-ink-950">
            Google Maps API key not set
          </p>
          <p className="mt-2 text-sm text-ink-700">
            Set{" "}
            <span className="font-mono text-[0.92em]">
              NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
            </span>{" "}
            to render the full map.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {shouldLoadMapScript ? (
        <Script src={src} strategy="lazyOnload" onLoad={() => setReady(true)} />
      ) : null}

      {/* Wrapper captures "intent" without an overlay */}
      <div
        ref={wrapperRef}
        style={{ width: "100%", height: `${heightPx}px`, position: "relative", overflow: "hidden" }}
        onPointerDown={() => setScrollZoom(true)}   // click/tap means "I mean it"
        onMouseLeave={() => setScrollZoom(false)}   // leaving restores safe scroll
      >
        <div
          id={mapElementId}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    </>
  );
}
