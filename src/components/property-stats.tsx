import type { Property } from "@/lib/types";
import { formatMoney } from "@/lib/format";

export function PropertyStats({ property }: { property: Property }) {
  const lot =
    property.lot.acres != null
      ? `${property.lot.acres} acres`
      : property.lot.sqft != null
        ? `${property.lot.sqft.toLocaleString()} sqft`
        : "—";

  const items: { label: string; value: string }[] = [
    { label: "Offered at", value: formatMoney(property.price) },
    { label: "Beds", value: String(property.beds) },
    { label: "Baths", value: String(property.baths) },
    { label: "Home size", value: `${property.homeSqft.toLocaleString()} sqft` },
    { label: "Lot size", value: lot }
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-5">
      {items.map((i) => (
        <div key={i.label} className="card p-4">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-500">
            {i.label}
          </p>
          <p className="mt-1 text-lg font-semibold tracking-tight text-ink-950">
            {i.value}
          </p>
        </div>
      ))}
    </div>
  );
}

