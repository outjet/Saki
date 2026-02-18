"use client";

import Script from "next/script";
import { useEffect, useMemo, useRef, useState } from "react";

type GoogleMapProps = {
  lat: number;
  lon: number;
  zoom?: number;
  heightPx?: number;
  mapTypeId?: "roadmap" | "satellite" | "hybrid" | "terrain";
  mapStyle?: unknown;
  markerTitle?: string;
  mapId?: string;
  mapElementId: string;
};

export function GoogleMap({
  lat,
  lon,
  zoom = 17,
  heightPx = 650,
  mapTypeId = "satellite",
  mapStyle,
  markerTitle,
  mapId,
  mapElementId
}: GoogleMapProps) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const effectiveMapId = mapId ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;
  const [ready, setReady] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const mapRef = useRef<unknown>(null);
  const unlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverUnlockDelayMs = 2000;

  const src = useMemo(() => {
    if (!key) return null;
    const params = new URLSearchParams({
      v: "3",
      key,
      loading: "async",
      libraries: "marker"
    });
    return `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
  }, [key]);

  useEffect(() => {
    if (!ready) return;
    if (typeof window === "undefined") return;
    let cancelled = false;

    void (async () => {
      const g = (window as unknown as { google?: any }).google;
      if (!g?.maps) return;

      const el = document.getElementById(mapElementId);
      if (!el) return;
      if (mapRef.current) return;

      const center = { lat, lng: lon };

      const mapsLib = g.maps.importLibrary
        ? await g.maps.importLibrary("maps").catch(() => null)
        : null;
      if (cancelled) return;

      const MapCtor = (mapsLib as any)?.Map ?? g.maps.Map;
      if (typeof MapCtor !== "function") return;

      const map = new MapCtor(el, {
        center,
        zoom,
        mapTypeId,
        styles: mapStyle as any,
        ...(effectiveMapId ? { mapId: effectiveMapId } : {}),
        streetViewControl: true,
        mapTypeControl: true,
        fullscreenControl: true,
        zoomControl: interactive,
        scaleControl: true,
        rotateControl: true,
        scrollwheel: false,
        draggable: interactive,
        gestureHandling: interactive ? "greedy" : "none"
      });

      const markerLib = g.maps.importLibrary
        ? await g.maps.importLibrary("marker").catch(() => null)
        : null;
      if (cancelled) return;

      const AdvancedMarkerElement =
        (markerLib as any)?.AdvancedMarkerElement ?? g.maps.marker?.AdvancedMarkerElement;

      if (effectiveMapId && typeof AdvancedMarkerElement === "function") {
        new AdvancedMarkerElement({
          position: center,
          map,
          title: markerTitle
        });
      } else if (typeof g.maps.Marker === "function") {
        new g.maps.Marker({
          position: center,
          map,
          title: markerTitle
        });
      }

      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
    };
  }, [
    effectiveMapId,
    interactive,
    lat,
    lon,
    mapElementId,
    mapStyle,
    mapTypeId,
    markerTitle,
    ready,
    zoom
  ]);

  useEffect(() => {
    const g = (window as unknown as { google?: any }).google;
    if (!g?.maps) return;
    const map = mapRef.current as any;
    if (!map?.setOptions) return;
    map.setOptions({
      zoomControl: interactive,
      scrollwheel: false,
      draggable: interactive,
      gestureHandling: interactive ? "greedy" : "none"
    });
  }, [interactive]);

  useEffect(() => {
    return () => {
      if (unlockTimerRef.current) {
        clearTimeout(unlockTimerRef.current);
        unlockTimerRef.current = null;
      }
    };
  }, []);

  function clearUnlockTimer() {
    if (unlockTimerRef.current) {
      clearTimeout(unlockTimerRef.current);
      unlockTimerRef.current = null;
    }
  }

  function startHoverUnlockTimer() {
    if (interactive || unlockTimerRef.current) return;
    unlockTimerRef.current = setTimeout(() => {
      setInteractive(true);
      unlockTimerRef.current = null;
    }, hoverUnlockDelayMs);
  }

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
      <Script src={src} strategy="afterInteractive" onLoad={() => setReady(true)} />
      <div className="relative" style={{ width: "100%", height: `${heightPx}px`, overflow: "hidden" }}>
        <div
          id={mapElementId}
          className={interactive ? "" : "grayscale"}
          style={{ width: "100%", height: `${heightPx}px` }}
        />
        {!interactive ? (
          <button
            type="button"
            onClick={() => {
              clearUnlockTimer();
              setInteractive(true);
            }}
            onMouseEnter={() => {
              startHoverUnlockTimer();
            }}
            onMouseLeave={() => {
              clearUnlockTimer();
            }}
            className="absolute inset-0 z-10 flex w-full items-center justify-center bg-black/25 text-center text-white"
            aria-label="Enable map interactions"
          >
            <span className="rounded-xl bg-black/55 px-4 py-3 text-sm font-medium">
              Tap to interact with map
            </span>
          </button>
        ) : null}
      </div>
    </>
  );
}
