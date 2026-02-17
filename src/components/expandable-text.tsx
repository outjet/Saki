"use client";

import { useMemo, useState } from "react";

export function ExpandableText({
  text,
  initialChars = 360
}: {
  text: string;
  initialChars?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const { head, tail } = useMemo(() => {
    const t = text.trim();
    if (t.length <= initialChars) return { head: t, tail: "" };
    return { head: t.slice(0, initialChars).trimEnd(), tail: t.slice(initialChars) };
  }, [text, initialChars]);

  if (!tail) return <p className="whitespace-pre-line text-ink-800">{head}</p>;

  return (
    <div className="text-ink-800">
      <p className="whitespace-pre-line">
        {expanded ? head + tail : head + "…"}
      </p>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-3 inline-flex items-center rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-800 hover:bg-ink-50"
      >
        {expanded ? "Show less" : "Read more"}
      </button>
    </div>
  );
}

