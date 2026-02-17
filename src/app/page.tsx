import type { Metadata } from "next";
import { getPropertyBySlug } from "@/lib/content";
import { formatAddressLine } from "@/lib/format";
import PropertyPage from "@/app/p/[slug]/page";

const DEDICATED_SLUG = "23760-emmons-road";

export async function generateMetadata(): Promise<Metadata> {
  const property = await getPropertyBySlug(DEDICATED_SLUG);
  if (!property) return { title: "Property" };
  return {
    title: formatAddressLine(property.address),
    description: property.headline ?? property.description.slice(0, 140)
  };
}

export default async function HomePage() {
  return <PropertyPage params={{ slug: DEDICATED_SLUG }} />;
}
