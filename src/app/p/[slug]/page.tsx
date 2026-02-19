import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPropertyBySlug } from "@/lib/content";
import { formatAddressLine, formatOpenHouse } from "@/lib/format";
import { HeroKenBurns } from "@/components/hero-kenburns";
import { StickyNav, type StickyNavItem } from "@/components/sticky-nav";
import { Section } from "@/components/section";
import { ExpandableText } from "@/components/expandable-text";
import { Gallery } from "@/components/gallery";
import { VideoEmbed } from "@/components/video-embed";
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
  const contactVideo = property.media?.contactVideo || property.media?.contactVideos?.[0];
  const overviewBackdrop =
    property.media?.overviewBackdrop ||
    property.media?.backgrounds?.[0] ||
    photos.find((src) => /DJI_0868\.png/i.test(src)) ||
    heroImages.find((src) => /DJI_0868\.png/i.test(src)) ||
    photos[0] ||
    heroImages[0] ||
    "/placeholders/hero.svg";

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
                <h2 className="text-2xl font-semibold tracking-tight text-white">Overview</h2>
                <p className="mt-1 text-sm text-white/85">
                  {property.headline ?? "Key details, story, and open house info."}
                </p>
              </div>
            </div>
            <div className="mt-6 grid gap-8 lg:grid-cols-12">
              <div className="lg:col-span-8">
                <h3 className="text-base font-semibold text-white">Description</h3>
                <div className="mt-3">
                  <ExpandableText text={property.description} tone="light" />
                </div>
              </div>

              <div className="lg:col-span-4">
                {property.openHouses && property.openHouses.length > 0 ? (
                  <div>
                    <h3 className="text-base font-semibold text-white">Open house</h3>
                    <ul className="mt-3 grid gap-3 text-sm text-white/90">
                      {property.openHouses.map((oh) => (
                        <li key={oh.startIso} className="border-t border-white/25 pt-3">
                          <p className="font-medium">{formatOpenHouse(oh)}</p>
                          {oh.note ? <p className="mt-1 text-white/80">{oh.note}</p> : null}
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

      <section id="contact" className="relative py-10 sm:py-12">
        {contactVideo ? (
          <video
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            aria-hidden="true"
          >
            <source src={contactVideo} />
          </video>
        ) : null}
        <div className="relative container-page">
          <div className="rounded-3xl border border-white/20 bg-slate-700/35 p-6 sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-white">Contact</h2>
                <p className="mt-1 text-sm text-white/85">
                  Please reach out with any questions.
                </p>
              </div>
            </div>
            <div className="mt-6">
              <div className="mx-auto max-w-3xl">
                <InquiryForm propertySlug={property.slug} tone="dark" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-ink-100">
        <div className="container-page py-10 text-sm text-ink-600">
          <p>© {new Date().getFullYear()} outjet productions</p>
          <p className="mt-2">
            <a className="font-medium text-ink-700 hover:text-ink-900" href="/owner">
              Owner login
            </a>
          </p>
        </div>
      </footer>
    </main>
  );
}
