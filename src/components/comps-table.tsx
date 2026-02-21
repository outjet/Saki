import type { PropertyComp } from "@/lib/types";

export function CompsTable({ comps }: { comps: PropertyComp[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-separate border-spacing-0">
          <thead className="bg-ink-50">
            <tr>
              <th
                scope="col"
                className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-ink-600"
              >
                Address
              </th>
              <th
                scope="col"
                className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-ink-600"
              >
                Beds/Baths
              </th>
              <th
                scope="col"
                className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-ink-600"
              >
                Lot Size
              </th>
              <th
                scope="col"
                className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-ink-600"
              >
                Sale Date
              </th>
              <th
                scope="col"
                className="whitespace-nowrap px-5 py-3 text-right text-xs font-semibold uppercase tracking-[0.14em] text-ink-600"
              >
                Sale Price
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {comps.map((c) => (
              <tr
                key={`${c.address}-${c.saleDate}`}
                className="odd:bg-white even:bg-ink-50/40 hover:bg-amber-50/40"
              >
                <td className="px-5 py-4 text-sm font-medium text-ink-950">
                  {c.address}
                </td>
                <td className="px-5 py-4 text-sm text-ink-700">{c.bedsBaths}</td>
                <td className="px-5 py-4 text-sm text-ink-700">{c.lotSize}</td>
                <td className="px-5 py-4 text-sm text-ink-700">{c.saleDate}</td>
                <td className="px-5 py-4 text-right text-sm font-semibold text-ink-950">
                  {c.salePrice}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
