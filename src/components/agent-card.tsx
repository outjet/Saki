import type { PropertyAgent } from "@/lib/types";

export function AgentCard({
  agent,
  tone = "light"
}: {
  agent: PropertyAgent;
  tone?: "light" | "dark";
}) {
  const isDark = tone === "dark";
  return (
    <div
      className={
        isDark
          ? "rounded-2xl border border-white/20 bg-black/20 p-6"
          : "card p-6"
      }
    >
      <div className="min-w-0">
        <p className={isDark ? "text-sm font-semibold text-white" : "text-sm font-semibold text-ink-950"}>
          {agent.name}
        </p>
        {agent.brokerage ? (
          <p className={isDark ? "mt-0.5 text-sm text-white/80" : "mt-0.5 text-sm text-ink-700"}>
            {agent.brokerage}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {agent.phone ? (
            <a
              className={
                isDark
                  ? "rounded-xl border border-white/30 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/20"
                  : "rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-800 hover:bg-ink-50"
              }
              href={`tel:${agent.phone}`}
            >
              {agent.phone}
            </a>
          ) : null}
          {agent.email ? (
            <a
              className={
                isDark
                  ? "rounded-xl border border-white/30 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/20"
                  : "rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-800 hover:bg-ink-50"
              }
              href={`mailto:${agent.email}`}
            >
              {agent.email}
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
