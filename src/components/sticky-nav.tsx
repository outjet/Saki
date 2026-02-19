"use client";

import { useEffect, useMemo, useState } from "react";

export type StickyNavItem = { id: string; label: string };

export function StickyNav({
  items,
  overlay = false
}: {
  items: StickyNavItem[];
  overlay?: boolean;
}) {
  const ids = useMemo(() => items.map((i) => i.id), [items]);
  const [activeId, setActiveId] = useState(ids[0] ?? "");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const targets = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) =>
              (a.boundingClientRect.top ?? 0) - (b.boundingClientRect.top ?? 0)
          )[0];
        if (visible?.target?.id) setActiveId(visible.target.id);
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: [0, 0.15, 0.3, 0.5] }
    );

    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, [ids]);

  useEffect(() => {
    if (!overlay) return;
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [overlay]);

  const wrapperClassName = overlay
    ? [
        "fixed inset-x-0 top-0 z-40 transition",
        scrolled ? "border-b border-ink-100 glass" : "border-b border-transparent bg-transparent"
      ].join(" ")
    : "sticky top-0 z-30 border-b border-ink-100 glass";

  const linkInactiveClassName = overlay && !scrolled
    ? "text-white/85 hover:bg-white/10 hover:text-white"
    : "text-ink-700 hover:bg-ink-50 hover:text-ink-950";

  const linkActiveClassName = overlay && !scrolled
    ? "bg-white text-ink-950"
    : "bg-ink-950 text-white";

  return (
    <>
      <div className={wrapperClassName}>
        <div className="container-page">
          <nav className="flex gap-1 overflow-auto py-3">
            {items.map((item) => {
              const active = item.id === activeId;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className={[
                    "whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition",
                    active ? linkActiveClassName : linkInactiveClassName
                  ].join(" ")}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>
        </div>
      </div>
    </>
  );
}
