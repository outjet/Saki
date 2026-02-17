export function FeatureGrid({ features }: { features: string[] }) {
  return (
    <div className="card p-6">
      <ul className="grid gap-3 sm:grid-cols-2">
        {features.map((f) => (
          <li key={f} className="flex gap-3">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-ink-900" />
            <span className="text-sm text-ink-800">{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

