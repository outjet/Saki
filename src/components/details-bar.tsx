import type { Property } from "@/lib/types";
import { formatMoney } from "@/lib/format";

function IconBed(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M3 11.5V7.8C3 6.8 3.8 6 4.8 6h14.4c1 0 1.8.8 1.8 1.8v3.7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M3 12h18c.6 0 1 .4 1 1v3.5M2 16.5V13c0-.6.4-1 1-1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M5 18.5V16.5M19 18.5V16.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconBath(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M7 10V6.8C7 5.8 7.8 5 8.8 5h.9c1 0 1.8.8 1.8 1.8V10"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M4 11h16a1 1 0 0 1 0 2H4a1 1 0 0 1 0-2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M6 13v2.2A4.8 4.8 0 0 0 10.8 20h2.4A4.8 4.8 0 0 0 18 15.2V13"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconRuler(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M5 7h14v12H5V7Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M8 7v3M11 7v2M14 7v3M17 7v2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconLayers(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M12 4 3 9l9 5 9-5-9-5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M3 13l9 5 9-5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 17l9 5 9-5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Stat({
  icon,
  count,
  suffix
}: {
  icon: React.ReactNode;
  count: string;
  suffix?: string;
}) {
  return (
    <div className="flex min-w-[150px] flex-1 flex-col items-center px-4 py-5 text-center">
      <span className="mb-2 inline-flex h-11 w-11 items-center justify-center text-ink-950">
        {icon}
      </span>
      <span className="text-2xl font-semibold tracking-tight text-ink-950">
        {count}
      </span>
      {suffix ? <span className="mt-1 text-sm text-ink-600">{suffix}</span> : null}
    </div>
  );
}

export function DetailsBar({ property }: { property: Property }) {
  const lot =
    property.lot.acres != null
      ? `${property.lot.acres} Acres`
      : property.lot.sqft != null
        ? `${property.lot.sqft.toLocaleString()} sqft`
        : "—";

  return (
    <section id="details" className="full-bleed bg-ink-50">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-8 px-4 py-6 sm:px-6 lg:flex-row">
        <div className="text-center lg:text-left">
          <div className="text-sm font-medium text-ink-600">Offered At</div>
          <div className="mt-1 text-4xl font-semibold tracking-tight text-ink-950 sm:text-5xl">
            {formatMoney(property.price)}
          </div>
        </div>

        <div className="flex w-full flex-wrap justify-center lg:w-auto lg:flex-nowrap lg:justify-end">
          <Stat icon={<IconBed className="h-11 w-11" />} count={`${property.beds} Beds`} />
          <Stat icon={<IconBath className="h-11 w-11" />} count={`${property.baths} Baths`} />
          <Stat
            icon={<IconRuler className="h-11 w-11" />}
            count={`${property.homeSqft.toLocaleString()} sqft`}
            suffix="Home Size"
          />
          <Stat
            icon={<IconLayers className="h-11 w-11" />}
            count={lot}
            suffix="Lot Size"
          />
        </div>
      </div>
    </section>
  );
}

