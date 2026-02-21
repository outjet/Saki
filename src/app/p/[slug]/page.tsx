import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPropertyBySlug } from "@/lib/content";
import { formatAddressLine, formatOpenHouse } from "@/lib/format";
import { HeroKenBurns } from "@/components/hero-kenburns";
import { StickyNav, type StickyNavItem } from "@/components/sticky-nav";
import { Section } from "@/components/section";
import { Gallery } from "@/components/gallery";
import { VideoEmbed } from "@/components/video-embed";
import { ContactOverlay } from "@/components/contact-overlay";
import { GoogleMap } from "@/components/google-map";
import { DetailsBar } from "@/components/details-bar";
import { CompsTable } from "@/components/comps-table";
import type { PropertyComp } from "@/lib/types";

const FALLBACK_COMPS_BY_SLUG: Record<string, PropertyComp[]> = {
  "23760-emmons-road": [
    {
      address: "23312 Emmons Rd.",
      bedsBaths: "4 Bed",
      lotSize: "3.3 Acres",
      saleDate: "10/02/2025",
      salePrice: "$660,000"
    },
    {
      address: "19322 East River Rd.",
      bedsBaths: "4 Bed",
      lotSize: "8 Acres",
      saleDate: "01/05/2025",
      salePrice: "$625,000"
    },
    {
      address: "23678 Wallys Way",
      bedsBaths: "4 Bed / 3 Bath",
      lotSize: "0.24 Acres",
      saleDate: "08/21/2025",
      salePrice: "$611,575"
    },
    {
      address: "23671 Wallys Way",
      bedsBaths: "4 Bed / 3 Bath",
      lotSize: "0.30 Acres",
      saleDate: "05/15/2025",
      salePrice: "$623,109"
    },
    {
      address: "23685 Wallys Way",
      bedsBaths: "—",
      lotSize: "0.35 Acres",
      saleDate: "06/06/2025",
      salePrice: "$696,430"
    },
    {
      address: "24848 River Glen Dr",
      bedsBaths: "4 Bed / 3.5 Bath",
      lotSize: "1 Acre",
      saleDate: "11/24/2025",
      salePrice: "$780,000"
    },
    {
      address: "23926 West Rim Dr",
      bedsBaths: "4 Bed / 3.5 Bath",
      lotSize: "1.6 Acres",
      saleDate: "12/09/2025",
      salePrice: "$630,000"
    },
    {
      address: "33840 Willow Creek Ct",
      bedsBaths: "3 Bed / 3 Bath",
      lotSize: "2 Acres",
      saleDate: "11/24/2025",
      salePrice: "$635,100"
    },
    {
      address: "27385 Capel Rd",
      bedsBaths: "4 Bed / 2.5 Bath",
      lotSize: "10 Acres",
      saleDate: "10/03/2025",
      salePrice: "$755,000"
    },
    {
      address: "1074 Greenhouse Trail",
      bedsBaths: "2 Bed / 2 Bath",
      lotSize: "0.19 Acres",
      saleDate: "10/06/2025",
      salePrice: "$647,287"
    },
    {
      address: "10261 Baker Creek Lane",
      bedsBaths: "3 Bed / 4 Bath",
      lotSize: "0.36 Acres",
      saleDate: "08/29/2025",
      salePrice: "$650,000"
    },
    {
      address: "12740 Root Rd",
      bedsBaths: "3 Bed / 2.5 Bath",
      lotSize: "7.2 Acres",
      saleDate: "05/02/2025",
      salePrice: "$705,000"
    }
  ]
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const property = await getPropertyBySlug(params.slug);
  if (!property) return { title: "Property not found" };

  const title = formatAddressLine(property.address);
  return {
    title,
    description: property.headline ?? property.description.slice(0, 140)
  };
}

export default async function PropertyPage({
  params
}: {
  params: { slug: string };
}) {
  const property = await getPropertyBySlug(params.slug);
  if (!property) notFound();

  const addressLine = formatAddressLine(property.address);
  const openHouseCtaText =
    property.openHouseCtaText || "Visit us at our upcoming Open House!";
  const contactCtaText =
    property.contactCtaText ||
    "For more information, call/text Carolyn or John at 216-505-7557, or leave a message below.";

  const photos = property.media?.photos ?? [];
  const heroImages =
    property.media?.hero && property.media.hero.length > 0 ? property.media.hero : photos;
  const floorplans = property.media?.floorplans ?? [];
  const documents = property.media?.documents ?? [];
  const tours = property.media?.tours ?? [];
  const hasVideo = Boolean(property.media?.video?.embedUrl || property.media?.video?.mp4Url);
  const hasMap = Boolean(property.location);
  const hasGoogleKey = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
  const contactVideo = property.media?.contactVideo || property.media?.contactVideos?.[0];
  const fallbackComps = FALLBACK_COMPS_BY_SLUG[property.slug] ?? [];
  const comps = property.comps && property.comps.length > 0 ? property.comps : fallbackComps;
  const overviewBackdrop =
    property.media?.overviewBackdrop ||
    property.media?.backgrounds?.[0] ||
    photos[0] ||
    heroImages[0] ||
    "/placeholders/hero.svg";

  const nav: StickyNavItem[] = [
    { id: "overview", label: "Overview" },
    ...(photos.length > 0 ? [{ id: "photos", label: "Photos" }] : []),
    ...(hasVideo ? [{ id: "video", label: "Video" }] : []),
    ...(tours.length > 0 ? [{ id: "tours", label: "Tours" }] : []),
    ...(floorplans.length > 0 ? [{ id: "floorplans", label: "Floor plans" }] : []),
    ...(documents.length > 0 ? [{ id: "documents", label: "Documents" }] : []),
    { id: "contact", label: "Contact" },
    ...(comps.length > 0 ? [{ id: "comps", label: "Comps" }] : []),
    ...(hasMap ? [{ id: "map", label: "Map" }] : [])
  ];

  return (
    <main>
      <HeroKenBurns images={heroImages} title={addressLine} />
      <StickyNav items={nav} overlay />
      <DetailsBar property={property} />

      <section className="relative py-10 sm:py-12">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url("${overviewBackdrop}")` }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-black/60" aria-hidden="true" />
        <div className="relative container-page">
          <section id="overview" className="py-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-white/85">
                  {property.headline ?? "Key details, story, and open house info."}
                </p>
              </div>
            </div>
            <div className="mt-6 grid gap-8 lg:grid-cols-12">
              <div className="lg:col-span-8">
                <div className="mt-3">
                  <p className="whitespace-pre-line text-white/90">{property.description}</p>
                </div>
              </div>

              <div className="lg:col-span-4">
                {property.openHouses && property.openHouses.length > 0 ? (
                  <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-300/30 via-amber-100/20 to-white/10 p-5 shadow-[0_0_0_1px_rgba(255,237,20,0.25),0_18px_40px_rgba(0,0,0,0.3)]">
                    <p className="inline-flex rounded-full border border-amber-100/80 bg-amber-200 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-950">
                      Open House
                    </p>
                    <h3 className="mt-3 text-xl font-semibold leading-tight text-[#ffed14]">
                      {openHouseCtaText}
                    </h3>
                    <ul className="mt-4 grid gap-3 text-sm text-white/95">
                      {property.openHouses.map((oh) => (
                        <li
                          key={oh.startIso}
                          className="rounded-xl border border-white/25 bg-black/25 px-3 py-2"
                        >
                          <p className="text-base font-semibold">{formatOpenHouse(oh)}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div>
                    {/* <h3 className="text-base font-semibold text-white">Schedule a tour</h3> */}
                    <p className="mt-2 text-sm text-white/85">
                      {/* Contact the agent below to arrange a private showing. */}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {property.features && property.features.length > 0 ? (
            <section id="features" className="py-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-white">
                    Feature highlights
                  </h2>
                </div>
              </div>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {property.features.map((feature) => (
                  <li key={feature} className="flex gap-3 text-white/90">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-white" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </section>

      {photos.length > 0 ? (
        <Section
          id="photos"
          title="Photos"
        >
          <Gallery images={photos} columns={3} label="Photos" />
        </Section>
      ) : null}

      <ContactOverlay
        propertySlug={property.slug}
        contactCtaText={contactCtaText}
        contactVideo={contactVideo}
      />

      {comps.length > 0 ? (
        <Section id="comps" title="Comparable Sales">
          <CompsTable comps={comps} />
        </Section>
      ) : null}

      {property.location ? (
        <section id="map" className="py-10 sm:py-12">
          <div className="container-page">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="section-title">Map</h2>
              </div>
              <a
                className="text-sm font-medium text-ink-700 hover:text-ink-950"
                href={`https://www.google.com/maps?q=${property.location.lat},${property.location.lon}`}
                target="_blank"
                rel="noreferrer"
              >
                Open in Google Maps
              </a>
            </div>
          </div>

          <div className="mt-6 full-bleed">
            {hasGoogleKey ? (
              <GoogleMap
                lat={property.location.lat}
                lon={property.location.lon}
                mapElementId={`styled-google-map-${property.slug}`}
                markerTitle={addressLine}
                mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID}
                heightPx={650}
                zoom={17}
                mapTypeId="satellite"
              />
            ) : (
              <iframe
                title="Map"
                className="block w-full"
                style={{ height: "650px" }}
                loading="lazy"
                src={(() => {
                  const { lat, lon } = property.location;
                  const d = 0.01;
                  const left = lon - d;
                  const right = lon + d;
                  const top = lat + d;
                  const bottom = lat - d;
                  return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${lat}%2C${lon}`;
                })()}
              />
            )}
          </div>
        </section>
      ) : null}

      {hasVideo ? (
        <Section id="video" title="Video">
          <VideoEmbed video={property.media?.video} />
        </Section>
      ) : null}

      {tours.length > 0 ? (
        <Section id="tours" title="Tours">
          <div className="card p-6">
            <ul className="grid gap-3 sm:grid-cols-2">
              {tours.map((t) => (
                <li key={t.href}>
                  <a
                    className="flex items-center justify-between rounded-2xl border border-ink-200 bg-white px-4 py-3 text-sm font-medium text-ink-900 hover:bg-ink-50"
                    href={t.href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className="truncate">{t.label}</span>
                    <span className="text-ink-500">↗</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      ) : null}

      {floorplans.length > 0 ? (
        <Section id="floorplans" title="Floor plans">
          <Gallery images={floorplans} columns={2} aspect="aspect-[16/10]" label="Floor plans" />
          <p className="mt-4 text-sm text-ink-600">
            Hotspots can be added next (data-driven overlays per plan).
          </p>
        </Section>
      ) : null}

      {documents.length > 0 ? (
        <Section id="documents" title="Documents">
          <div className="card p-6">
            <ul className="grid gap-3 sm:grid-cols-2">
              {documents.map((d) => (
                <li key={d.href}>
                  <a
                    className="flex items-center justify-between rounded-2xl border border-ink-200 bg-white px-4 py-3 text-sm font-medium text-ink-900 hover:bg-ink-50"
                    href={d.href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className="truncate">{d.label}</span>
                    <span className="text-ink-500">Download</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      ) : null}

      <footer className="border-t border-ink-100">
        <div className="container-page py-10 text-sm text-ink-600">
          <p>
            <a className="font-medium text-ink-700 hover:text-ink-900" href="/owner">
              Owner login
            </a>
          </p>
        </div>
      </footer>
    </main>
  );
}
