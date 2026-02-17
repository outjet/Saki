import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPropertyBySlug } from "@/lib/content";
import { formatAddressLine, formatOpenHouse } from "@/lib/format";
import { HeroKenBurns } from "@/components/hero-kenburns";
import { StickyNav, type StickyNavItem } from "@/components/sticky-nav";
import { Section } from "@/components/section";
import { ExpandableText } from "@/components/expandable-text";
import { FeatureGrid } from "@/components/feature-grid";
import { Gallery } from "@/components/gallery";
import { VideoEmbed } from "@/components/video-embed";
import { AgentCard } from "@/components/agent-card";
import { InquiryForm } from "@/components/inquiry-form";
import { GoogleMap } from "@/components/google-map";
import { DetailsBar } from "@/components/details-bar";

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

  const photos = property.media?.photos ?? [];
  const heroImages =
    property.media?.hero && property.media.hero.length > 0 ? property.media.hero : photos;
  const floorplans = property.media?.floorplans ?? [];
  const documents = property.media?.documents ?? [];
  const tours = property.media?.tours ?? [];
  const hasVideo = Boolean(property.media?.video?.embedUrl || property.media?.video?.mp4Url);
  const hasMap = Boolean(property.location);
  const hasGoogleKey = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);

  const nav: StickyNavItem[] = [
    { id: "overview", label: "Overview" },
    ...(property.features && property.features.length > 0
      ? [{ id: "features", label: "Features" }]
      : []),
    ...(photos.length > 0 ? [{ id: "photos", label: "Photos" }] : []),
    ...(hasMap ? [{ id: "map", label: "Map" }] : []),
    ...(hasVideo ? [{ id: "video", label: "Video" }] : []),
    ...(tours.length > 0 ? [{ id: "tours", label: "Tours" }] : []),
    ...(floorplans.length > 0 ? [{ id: "floorplans", label: "Floor plans" }] : []),
    ...(documents.length > 0 ? [{ id: "documents", label: "Documents" }] : []),
    { id: "contact", label: "Contact" }
  ];

  return (
    <main>
      <HeroKenBurns images={heroImages} title={addressLine} />
      <StickyNav items={nav} />
      <DetailsBar property={property} />

      <Section
        id="overview"
        title="Overview"
        subtitle={property.headline ?? "Key details, story, and open house info."}
      >
        <div className="mt-6 grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <div className="card p-6">
              <h3 className="text-base font-semibold text-ink-950">Description</h3>
              <div className="mt-3">
                <ExpandableText text={property.description} />
              </div>
            </div>
          </div>

          <div className="lg:col-span-4">
            {property.openHouses && property.openHouses.length > 0 ? (
              <div className="card p-6">
                <h3 className="text-base font-semibold text-ink-950">
                  Open house
                </h3>
                <ul className="mt-3 grid gap-2 text-sm text-ink-800">
                  {property.openHouses.map((oh) => (
                    <li key={oh.startIso} className="rounded-xl bg-ink-50 px-3 py-2">
                      <p className="font-medium">{formatOpenHouse(oh)}</p>
                      {oh.note ? (
                        <p className="mt-1 text-ink-600">{oh.note}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="card p-6">
                <h3 className="text-base font-semibold text-ink-950">
                  Schedule a tour
                </h3>
                <p className="mt-2 text-sm text-ink-700">
                  Contact the agent below to arrange a private showing.
                </p>
              </div>
            )}
          </div>
        </div>
      </Section>

      {property.features && property.features.length > 0 ? (
        <Section id="features" title="Feature highlights">
          <FeatureGrid features={property.features} />
        </Section>
      ) : null}

      {photos.length > 0 ? (
        <Section
          id="photos"
          title="Photos"
          subtitle="Click any photo to view full-screen."
        >
          <Gallery images={photos} columns={3} label="Photos" />
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

      <Section id="contact" title="Contact">
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-4">
            {property.agent ? (
              <AgentCard agent={property.agent} />
            ) : (
              <div className="card p-6">
                <p className="text-sm font-semibold text-ink-950">Seller</p>
                <p className="mt-2 text-sm text-ink-700">
                  Add agent/seller details in{" "}
                  <span className="font-mono text-[0.92em]">property.json</span>.
                </p>
              </div>
            )}
          </div>
          <div className="lg:col-span-8">
            <InquiryForm propertySlug={property.slug} />
          </div>
        </div>
      </Section>

      <footer className="border-t border-ink-100">
        <div className="container-page py-10 text-sm text-ink-600">
          <p>© {new Date().getFullYear()} Saki. Demo content.</p>
        </div>
      </footer>
    </main>
  );
}
