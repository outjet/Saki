"use client";

import { useMemo, useState } from "react";

export function ExpandableText({
  text,
  initialChars = 360,
  tone = "default"
}: {
  text: string;
  initialChars?: number;
  tone?: "default" | "light";
}) {
  const [expanded, setExpanded] = useState(false);
  const { head, tail } = useMemo(() => {
    const t = text.trim();
    if (t.length <= initialChars) return { head: t, tail: "" };
    return { head: t.slice(0, initialChars).trimEnd(), tail: t.slice(initialChars) };
  }, [text, initialChars]);

  const textClass = tone === "light" ? "text-white/90" : "text-ink-800";
  const buttonClass =
    tone === "light"
      ? "mt-3 inline-flex items-center rounded-xl border border-white/30 bg-black/35 px-3 py-2 text-sm font-medium text-white hover:bg-black/45"
      : "mt-3 inline-flex items-center rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-800 hover:bg-ink-50";

  if (!tail) return <p className={`whitespace-pre-line ${textClass}`}>{head}</p>;

  return (
    <div className={textClass}>
      <p className="whitespace-pre-line">
        {expanded ? head + tail : head + "…"}
      </p>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={buttonClass}
      >
        {expanded ? "Show less" : "Read more"}
      </button>
    </div>
  );
}
