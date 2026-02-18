import type { PropertyAgent } from "@/lib/types";

export function AgentCard({ agent }: { agent: PropertyAgent }) {
  return (
    <div className="card p-6">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink-950">{agent.name}</p>
        {agent.brokerage ? (
          <p className="mt-0.5 text-sm text-ink-700">{agent.brokerage}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {agent.phone ? (
            <a
              className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-800 hover:bg-ink-50"
              href={`tel:${agent.phone}`}
            >
              {agent.phone}
            </a>
          ) : null}
          {agent.email ? (
            <a
              className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-800 hover:bg-ink-50"
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
