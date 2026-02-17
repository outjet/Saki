"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function Gallery({
  images,
  columns = 3,
  aspect = "aspect-[4/3]",
  label = "Photos"
}: {
  images: string[];
  columns?: 2 | 3 | 4;
  aspect?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const gridCols =
    columns === 2
      ? "sm:grid-cols-2"
      : columns === 4
        ? "sm:grid-cols-4"
        : "sm:grid-cols-3";

  const current = images[index] ?? images[0];
  const canPrev = index > 0;
  const canNext = index < images.length - 1;

  const title = useMemo(
    () => `${label} (${clamp(index + 1, 1, images.length)} / ${images.length})`,
    [index, images.length, label]
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowLeft" && canPrev) setIndex((i) => i - 1);
      if (e.key === "ArrowRight" && canNext) setIndex((i) => i + 1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, canPrev, canNext]);

  if (images.length === 0) return null;

  return (
    <>
      <div className={`grid gap-3 ${gridCols}`}>
        {images.map((src, i) => (
          <button
            key={src}
            type="button"
            onClick={() => {
              setIndex(i);
              setOpen(true);
            }}
            className={`relative ${aspect} overflow-hidden rounded-2xl bg-ink-50 ring-1 ring-ink-100 hover:ring-ink-300`}
            aria-label={`Open ${label.toLowerCase()} ${i + 1}`}
          >
            <Image
              src={src}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 33vw"
            />
          </button>
        ))}
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-5xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 pb-3">
              <p className="text-sm font-medium text-white/90">{title}</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15"
              >
                Close
              </button>
            </div>

            <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-black">
              <Image
                src={current}
                alt=""
                fill
                className="object-contain"
                sizes="100vw"
                priority
              />
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={!canPrev}
                onClick={() => setIndex((i) => i - 1)}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white enabled:hover:bg-white/15 disabled:opacity-40"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={!canNext}
                onClick={() => setIndex((i) => i + 1)}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white enabled:hover:bg-white/15 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

