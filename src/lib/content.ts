import fs from "node:fs/promises";
import path from "node:path";
import type { Property, PropertyFront } from "@/lib/types";
import {
  getPropertyFromFirestore,
  listPropertySlugsFromFirestore
} from "@/lib/property-store";

const CONTENT_ROOT = path.join(process.cwd(), "content", "properties");

async function fileExists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function loadProperty(slug: string): Promise<Property> {
  const jsonPath = path.join(CONTENT_ROOT, slug, "property.json");
  const raw = await fs.readFile(jsonPath, "utf8");
  const parsed = JSON.parse(raw) as Omit<Property, "slug"> & { slug?: string };

  const media = parsed.media ?? {};

  const hero = Array.isArray(media.hero) ? media.hero : [];
  const photos = Array.isArray(media.photos) ? media.photos : [];
  const backgrounds = Array.isArray(media.backgrounds) ? media.backgrounds : [];

  const mergedPhotos = Array.from(new Set([...hero, ...photos]));

  const floorplans = Array.isArray(media.floorplans) ? media.floorplans : [];
  const docs = Array.isArray(media.documents) ? media.documents : [];

  return {
    ...parsed,
    slug,
    media: {
      ...media,
      hero,
      photos: mergedPhotos,
      floorplans,
      backgrounds,
      overviewBackdrop:
        media.overviewBackdrop || backgrounds[0] || mergedPhotos[0],
      documents: docs
    }
  };
}

export async function getAllPropertySlugs() {
  try {
    const fromFs = await listPropertySlugsFromFirestore();
    if (fromFs && fromFs.length > 0) return fromFs;
  } catch {
    // ignore and fall back to local content
  }

  if (!(await fileExists(CONTENT_ROOT))) return [];
  const entries = await fs.readdir(CONTENT_ROOT, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

export async function getAllProperties(): Promise<PropertyFront[]> {
  const slugs = await getAllPropertySlugs();
  const props = await Promise.all(slugs.map((s) => loadProperty(s)));

  return props.map((p) => ({
    slug: p.slug,
    address: p.address,
    price: p.price,
    beds: p.beds,
    baths: p.baths,
    homeSqft: p.homeSqft,
    headline: p.headline,
    heroImage: p.media?.photos?.[0]
  }));
}

export async function getPropertyBySlug(slug: string): Promise<Property | null> {
  try {
    const fromFs = await getPropertyFromFirestore(slug);
    if (fromFs) return fromFs;
  } catch {
    // ignore and fall back to local content
  }

  const jsonPath = path.join(CONTENT_ROOT, slug, "property.json");
  if (!(await fileExists(jsonPath))) return null;
  return loadProperty(slug);
}
