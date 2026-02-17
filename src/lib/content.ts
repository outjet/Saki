import fs from "node:fs/promises";
import path from "node:path";
import type { Property, PropertyFront } from "@/lib/types";
import {
  getPropertyFromFirestore,
  listPropertySlugsFromFirestore
} from "@/lib/property-store";

const CONTENT_ROOT = path.join(process.cwd(), "content", "properties");
const PUBLIC_LISTINGS_ROOT = path.join(process.cwd(), "public", "listings");

async function fileExists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function isMediaFile(name: string) {
  const lower = name.toLowerCase();
  return (
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".png") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".avif") ||
    lower.endsWith(".svg")
  );
}

async function listPublicFiles(slug: string, subdir: string) {
  const dir = path.join(PUBLIC_LISTINGS_ROOT, slug, subdir);
  if (!(await fileExists(dir))) return [];

  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((n) => (subdir === "docs" ? true : isMediaFile(n)))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  return files.map((f) => `/listings/${slug}/${subdir}/${f}`);
}

async function loadProperty(slug: string): Promise<Property> {
  const jsonPath = path.join(CONTENT_ROOT, slug, "property.json");
  const raw = await fs.readFile(jsonPath, "utf8");
  const parsed = JSON.parse(raw) as Omit<Property, "slug"> & { slug?: string };

  const media = parsed.media ?? {};

  const hero =
    media.hero && media.hero.length > 0 ? media.hero : await listPublicFiles(slug, "hero");

  const photos =
    media.photos && media.photos.length > 0
      ? media.photos
      : await listPublicFiles(slug, "photos");

  const mergedPhotos = Array.from(new Set([...hero, ...photos]));

  const floorplans =
    media.floorplans && media.floorplans.length > 0
      ? media.floorplans
      : await listPublicFiles(slug, "floorplans");

  const docs =
    media.documents && media.documents.length > 0
      ? media.documents
      : (await listPublicFiles(slug, "docs")).map((href) => ({
          label: path.basename(href),
          href
        }));

  return {
    ...parsed,
    slug,
    media: {
      ...media,
      hero,
      photos: mergedPhotos,
      floorplans,
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
