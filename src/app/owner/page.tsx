"use client";

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from "firebase/auth";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { firebaseAuth } from "@/lib/firebase-client";

type Draft = {
  slug: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  price: number;
  beds: number;
  baths: number;
  homeSqft: number;
  lotAcres: number;
  headline: string;
  description: string;
  featuresText: string;
  agentName: string;
  agentPhone: string;
  agentEmail: string;
  openHouseIso: string;
  lat: string;
  lon: string;
};

type MediaFolder =
  | "hero"
  | "photos"
  | "floorplans"
  | "backgrounds"
  | "contactvideo"
  | "docs";

type OwnerMediaItem = {
  objectPath: string;
  name: string;
  signedUrl: string;
  contentType?: string;
  size?: string | number;
  updated?: string;
  label?: string;
  space?: string;
};

type OwnerMediaState = {
  hero: OwnerMediaItem[];
  photos: OwnerMediaItem[];
  photoSpaceOrder: string[];
  floorplans: OwnerMediaItem[];
  backgrounds: OwnerMediaItem[];
  contactVideos: OwnerMediaItem[];
  docs: OwnerMediaItem[];
};

type PropertyMediaExtras = {
  video?: {
    title?: string;
    embedUrl?: string;
    mp4Url?: string;
    posterUrl?: string;
  };
  tours?: { label: string; href: string }[];
};

type LoadedProperty = {
  slug?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  price?: { amount?: number };
  beds?: number;
  baths?: number;
  homeSqft?: number;
  lot?: { acres?: number };
  headline?: string;
  description?: string;
  features?: string[];
  agent?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  openHouses?: { startIso?: string }[];
  location?: { lat?: number; lon?: number };
  media?: {
    video?: PropertyMediaExtras["video"];
    tours?: PropertyMediaExtras["tours"];
  };
};

function blankDraft(slug = "23760-emmons-road"): Draft {
  return {
    slug,
    street: "",
    city: "",
    state: "",
    zip: "",
    price: 0,
    beds: 0,
    baths: 0,
    homeSqft: 0,
    lotAcres: 0,
    headline: "",
    description: "",
    featuresText: "",
    agentName: "",
    agentPhone: "",
    agentEmail: "",
    openHouseIso: "",
    lat: "",
    lon: ""
  };
}

const initialDraft: Draft = blankDraft();

const emptyMediaState: OwnerMediaState = {
  hero: [],
  photos: [],
  photoSpaceOrder: [],
  floorplans: [],
  backgrounds: [],
  contactVideos: [],
  docs: []
};

const PHOTO_SPACE_FALLBACK = "Unassigned";
const PHOTO_SPACE_SUGGESTIONS = [
  "Front yard",
  "Back yard",
  "Kitchen",
  "Living room",
  "Dining room",
  "Primary bedroom",
  "Bedroom 2",
  "Bedroom 3",
  "Bathroom",
  "Garage",
  "Office",
  "Laundry"
];

function safeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-/, "")
    .replace(/-$/, "");
}

function asNumber(value: unknown, fallback: number) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function asString(value: unknown, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function draftFromProperty(property: LoadedProperty, current: Draft): Draft {
  return {
    slug: asString(property.slug, current.slug),
    street: asString(property.address?.street, current.street),
    city: asString(property.address?.city, current.city),
    state: asString(property.address?.state, current.state),
    zip: asString(property.address?.zip, current.zip),
    price: asNumber(property.price?.amount, current.price),
    beds: asNumber(property.beds, current.beds),
    baths: asNumber(property.baths, current.baths),
    homeSqft: asNumber(property.homeSqft, current.homeSqft),
    lotAcres: asNumber(property.lot?.acres, current.lotAcres),
    headline: asString(property.headline, current.headline),
    description: asString(property.description, current.description),
    featuresText: (Array.isArray(property.features) ? property.features : []).join("\n"),
    agentName: asString(property.agent?.name, current.agentName),
    agentPhone: asString(property.agent?.phone, current.agentPhone),
    agentEmail: asString(property.agent?.email, current.agentEmail),
    openHouseIso: asString(property.openHouses?.[0]?.startIso, current.openHouseIso),
    lat:
      property.location?.lat !== undefined
        ? String(property.location.lat)
        : current.lat,
    lon:
      property.location?.lon !== undefined
        ? String(property.location.lon)
        : current.lon
  };
}

async function readResponse<T>(res: Response) {
  const raw = await res.text();
  try {
    return { raw, data: JSON.parse(raw) as T };
  } catch {
    return { raw, data: null as T | null };
  }
}

function isImageItem(item: OwnerMediaItem) {
  if ((item.contentType || "").startsWith("image/")) return true;
  const lower = item.name.toLowerCase();
  return (
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".png") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".avif") ||
    lower.endsWith(".gif") ||
    lower.endsWith(".svg")
  );
}

function reorderItems(list: OwnerMediaItem[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) {
    return list;
  }
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function photoSpaceName(item: OwnerMediaItem) {
  const value = String(item.space ?? "").trim();
  return value || PHOTO_SPACE_FALLBACK;
}

function normalizeRoomName(value: string) {
  return String(value ?? "").trim();
}

function toLocalDateTimeInput(iso: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function fromLocalDateTimeInput(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

export default function OwnerPage() {
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [media, setMedia] = useState<OwnerMediaState>(emptyMediaState);
  const [mediaDirty, setMediaDirty] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [loadingListing, setLoadingListing] = useState(false);
  const [savingListing, setSavingListing] = useState(false);
  const [autoLoadedSlug, setAutoLoadedSlug] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [mediaExtras, setMediaExtras] = useState<PropertyMediaExtras>({
    video: { title: "Property video", embedUrl: "" },
    tours: []
  });

  const [authState, setAuthState] = useState<
    | { status: "signed_out" }
    | { status: "checking" }
    | { status: "forbidden"; email?: string }
    | { status: "error"; message: string }
    | { status: "ready"; email: string; token: string }
  >({ status: "signed_out" });
  const normalizedSlug = useMemo(() => safeSlug(draft.slug), [draft.slug]);
  const readyToken = authState.status === "ready" ? authState.token : null;

  async function ensureSignedIn() {
    try {
      const auth = firebaseAuth();
      if (!auth.currentUser) {
        setAuthState({ status: "checking" });
        await signInWithPopup(auth, new GoogleAuthProvider());
      }
      const user = auth.currentUser;
      if (!user) {
        setAuthState({ status: "signed_out" });
        return null;
      }
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/me", {
        headers: { authorization: `Bearer ${token}` }
      });
      const me = (await res.json()) as {
        ok?: boolean;
        allowed?: boolean;
        email?: string;
        error?: string;
      };

      if (res.status >= 500) {
        setAuthState({
          status: "error",
          message: me.error ?? "Server auth is not configured."
        });
        return null;
      }

      if (!me.ok || !me.allowed) {
        setAuthState({ status: "forbidden", email: me.email });
        return null;
      }

      setAuthState({ status: "ready", email: me.email || "", token });
      if (normalizedSlug) void loadMediaWithToken(token, normalizedSlug);
      return token;
    } catch (e) {
      setAuthState({
        status: "error",
        message: e instanceof Error ? e.message : "Sign-in failed."
      });
      return null;
    }
  }

  async function getToken() {
    if (authState.status === "ready") return authState.token;
    return ensureSignedIn();
  }

  async function doSignOut() {
    await signOut(firebaseAuth());
    setAuthState({ status: "signed_out" });
    setAutoLoadedSlug(null);
    setMedia(emptyMediaState);
    setMediaDirty(false);
    setStatusMessage("");
  }

  useEffect(() => {
    const auth = firebaseAuth();
    setAuthState({ status: "checking" });
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setAuthState({ status: "signed_out" });
        setAutoLoadedSlug(null);
        setMedia(emptyMediaState);
        setMediaDirty(false);
        return;
      }
      void (async () => {
        try {
          const token = await user.getIdToken();
          const res = await fetch("/api/admin/me", {
            headers: { authorization: `Bearer ${token}` }
          });
          const me = (await res.json()) as {
            ok?: boolean;
            allowed?: boolean;
            email?: string;
            error?: string;
          };

          if (res.status >= 500) {
            setAuthState({
              status: "error",
              message: me.error ?? "Server auth is not configured."
            });
            return;
          }

          if (!me.ok || !me.allowed) {
            setAuthState({ status: "forbidden", email: me.email });
            return;
          }

          setAuthState({ status: "ready", email: me.email || "", token });
        } catch (e) {
          setAuthState({
            status: "error",
            message: e instanceof Error ? e.message : "Sign-in failed."
          });
        }
      })();
    });
    return () => unsub();
  }, []);

  function mediaManifest(nextMedia: OwnerMediaState) {
    const photoSpaces = nextMedia.photos.reduce<Record<string, string>>((acc, item) => {
      const space = String(item.space ?? "").trim();
      if (space) acc[item.objectPath] = space;
      return acc;
    }, {});

    return {
      hero: nextMedia.hero.map((item) => item.objectPath),
      photos: nextMedia.photos.map((item) => item.objectPath),
      photoSpaces,
      photoSpaceOrder: nextMedia.photoSpaceOrder,
      floorplans: nextMedia.floorplans.map((item) => item.objectPath),
      backgrounds: nextMedia.backgrounds.map((item) => item.objectPath),
      overviewBackdrop: nextMedia.backgrounds[0]?.objectPath || undefined,
      contactVideos: nextMedia.contactVideos.map((item) => item.objectPath),
      contactVideo: nextMedia.contactVideos[0]?.objectPath || undefined,
      documents: nextMedia.docs.map((item) => ({
        label: item.label?.trim() || item.name,
        href: item.objectPath
      }))
    };
  }

  const loadListingWithToken = useCallback(
    async (token: string, slug: string, showMessage = true) => {
      if (!slug) {
        setStatusMessage("Set a slug first.");
        return;
      }
      setLoadingListing(true);
      try {
        const res = await fetch(`/api/admin/property?slug=${encodeURIComponent(slug)}`, {
          headers: { authorization: `Bearer ${token}` }
        });
        const { data, raw } = await readResponse<{
          ok?: boolean;
          property?: LoadedProperty | null;
          error?: string;
        }>(res);

        if (!res.ok || !data?.ok) {
          throw new Error(data?.error || raw || "Failed to load listing");
        }

        if (data.property) {
          setDraft(draftFromProperty(data.property as LoadedProperty, blankDraft(slug)));
          setMediaExtras({
            video: data.property.media?.video,
            tours: data.property.media?.tours || []
          });
          if (showMessage) setStatusMessage("Loaded listing from Firestore.");
        } else if (showMessage) {
          setDraft(blankDraft(slug));
          setStatusMessage("No Firestore listing found for this slug yet.");
        }
      } catch (e) {
        setStatusMessage(e instanceof Error ? e.message : "Failed to load listing");
      } finally {
        setLoadingListing(false);
      }
    },
    []
  );

  async function loadListing(showMessage = true) {
    const token = await getToken();
    if (!token) return;
    const slug = safeSlug(draft.slug);
    if (!slug) {
      setStatusMessage("Set a slug first.");
      return;
    }
    await loadListingWithToken(token, slug, showMessage);
  }

  async function loadMedia(showMessage = false) {
    const token = await getToken();
    if (!token) return;
    if (!normalizedSlug) {
      setStatusMessage("Set a slug first.");
      return;
    }
    await loadMediaWithToken(token, normalizedSlug, showMessage);
  }

  const loadMediaWithToken = useCallback(async (token: string, slug: string, showMessage = false) => {
    setMediaBusy(true);
    try {
      const res = await fetch(`/api/admin/media?slug=${encodeURIComponent(slug)}`, {
        headers: { authorization: `Bearer ${token}` }
      });
      const { data, raw } = await readResponse<{
        ok?: boolean;
        error?: string;
        media?: OwnerMediaState;
      }>(res);

      if (!res.ok || !data?.ok || !data.media) {
        throw new Error(data?.error || raw || "Failed to load media");
      }

      setMedia(data.media);
      setMediaDirty(false);
      if (showMessage) setStatusMessage("Media refreshed from Storage.");
      return data.media;
    } catch (e) {
      setStatusMessage(e instanceof Error ? e.message : "Failed to load media");
      return null;
    } finally {
      setMediaBusy(false);
    }
  }, []);

  async function persistMediaWithToken(
    token: string,
    slug: string,
    nextMedia: OwnerMediaState,
    showMessage = true
  ) {
    setMediaBusy(true);
    try {
      const res = await fetch("/api/admin/media", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ slug, media: mediaManifest(nextMedia) })
      });
      const { data, raw } = await readResponse<{ ok?: boolean; error?: string }>(res);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || raw || "Failed to save media order");
      }
      setMediaDirty(false);
      if (showMessage) setStatusMessage("Media order saved.");
      return true;
    } catch (e) {
      setStatusMessage(e instanceof Error ? e.message : "Failed to save media order");
      return false;
    } finally {
      setMediaBusy(false);
    }
  }

  async function persistMedia(nextMedia: OwnerMediaState, showMessage = true) {
    const token = await getToken();
    if (!token) return false;
    const slug = safeSlug(draft.slug);
    if (!slug) {
      setStatusMessage("Set a slug first.");
      return false;
    }
    return persistMediaWithToken(token, slug, nextMedia, showMessage);
  }

  async function saveListing() {
    const token = await getToken();
    if (!token) return;

    const slug = safeSlug(draft.slug);
    if (!slug) {
      setStatusMessage("Set a slug first.");
      return;
    }

    const features = draft.featuresText
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean);

    const payload = {
      address: {
        street: draft.street,
        city: draft.city,
        state: draft.state,
        zip: draft.zip
      },
      price: { amount: Number(draft.price || 0), currency: "USD" as const },
      beds: Number(draft.beds || 0),
      baths: Number(draft.baths || 0),
      homeSqft: Number(draft.homeSqft || 0),
      lot: { acres: Number(draft.lotAcres || 0) },
      headline: draft.headline,
      description: draft.description,
      features,
      agent: {
        name: draft.agentName,
        phone: draft.agentPhone || undefined,
        email: draft.agentEmail || undefined
      },
      openHouses: draft.openHouseIso ? [{ startIso: draft.openHouseIso, note: "Open house" }] : [],
      location:
        draft.lat && draft.lon
          ? { lat: Number(draft.lat), lon: Number(draft.lon) }
          : undefined,
      media: {
        ...mediaManifest(media),
        video: mediaExtras.video,
        tours: mediaExtras.tours || []
      }
    };

    setSavingListing(true);
    try {
      const res = await fetch("/api/admin/property", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ slug, property: payload })
      });
      const { data, raw } = await readResponse<{ ok?: boolean; error?: string }>(res);

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || raw || "Save failed");
      }

      setMediaDirty(false);
      setStatusMessage("Listing saved to Firestore.");
    } catch (e) {
      setStatusMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingListing(false);
    }
  }

  async function uploadFiles(folder: MediaFolder, files: FileList) {
    const token = await getToken();
    if (!token) return;

    const slug = safeSlug(draft.slug);
    if (!slug) {
      setStatusMessage("Set a slug first.");
      return;
    }

    setMediaBusy(true);
    try {
      const fileList = Array.from(files);
      for (const [index, file] of fileList.entries()) {
        setStatusMessage(`Uploading ${index + 1}/${fileList.length}: ${file.name}`);
        const form = new FormData();
        form.set("slug", slug);
        form.set("folder", folder);
        form.set("file", file, file.name);

        const uploadRes = await fetch("/api/admin/upload", {
          method: "POST",
          headers: { authorization: `Bearer ${token}` },
          body: form
        });

        const uploadBody = await readResponse<{ ok?: boolean; error?: string }>(
          uploadRes
        );
        if (!uploadRes.ok || !uploadBody.data?.ok) {
          throw new Error(
            uploadBody.data?.error || uploadBody.raw || "Upload failed"
          );
        }
      }

      const loadedMedia = await loadMediaWithToken(token, slug);
      if (loadedMedia) {
        await persistMediaWithToken(token, slug, loadedMedia, false);
      }
      setStatusMessage(`Uploaded ${files.length} file(s) to ${folder}.`);
    } catch (e) {
      setStatusMessage(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setMediaBusy(false);
    }
  }

  async function uploadFilesToPhotoSpace(spaceRaw: string, files: FileList) {
    const token = await getToken();
    if (!token) return;

    const slug = safeSlug(draft.slug);
    if (!slug) {
      setStatusMessage("Set a slug first.");
      return;
    }

    const space = normalizeRoomName(spaceRaw);
    const beforePaths = new Set(media.photos.map((item) => item.objectPath));

    setMediaBusy(true);
    try {
      const fileList = Array.from(files);
      for (const [index, file] of fileList.entries()) {
        setStatusMessage(`Uploading ${index + 1}/${fileList.length}: ${file.name}`);
        const form = new FormData();
        form.set("slug", slug);
        form.set("folder", "photos");
        form.set("file", file, file.name);

        const uploadRes = await fetch("/api/admin/upload", {
          method: "POST",
          headers: { authorization: `Bearer ${token}` },
          body: form
        });
        const uploadBody = await readResponse<{ ok?: boolean; error?: string }>(uploadRes);
        if (!uploadRes.ok || !uploadBody.data?.ok) {
          throw new Error(uploadBody.data?.error || uploadBody.raw || "Upload failed");
        }
      }

      const loadedMedia = await loadMediaWithToken(token, slug);
      if (loadedMedia) {
        const nextMedia = {
          ...loadedMedia,
          photoSpaceOrder:
            space &&
            !loadedMedia.photoSpaceOrder.some((entry) => entry.toLowerCase() === space.toLowerCase())
              ? [...loadedMedia.photoSpaceOrder, space]
              : loadedMedia.photoSpaceOrder,
          photos: loadedMedia.photos.map((item) =>
            !beforePaths.has(item.objectPath) && space
              ? { ...item, space }
              : item
          )
        };
        setMedia(nextMedia);
        await persistMediaWithToken(token, slug, nextMedia, false);
      }
      setStatusMessage(
        space
          ? `Uploaded ${files.length} file(s) to photos (${space}).`
          : `Uploaded ${files.length} file(s) to photos.`
      );
    } catch (e) {
      setStatusMessage(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setMediaBusy(false);
    }
  }

  async function deleteMediaItem(folder: MediaFolder, item: OwnerMediaItem) {
    const token = await getToken();
    if (!token) return;

    const slug = safeSlug(draft.slug);
    if (!slug) return;

    setMediaBusy(true);
    try {
      const res = await fetch("/api/admin/media", {
        method: "DELETE",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ slug, objectPath: item.objectPath })
      });
      const { data, raw } = await readResponse<{ ok?: boolean; error?: string }>(res);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || raw || "Failed to delete media item");
      }

      await loadMedia();
      setStatusMessage(`Deleted ${item.name} from ${folder}.`);
    } catch (e) {
      setStatusMessage(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setMediaBusy(false);
    }
  }

  async function moveMediaItem(folder: MediaFolder, index: number, direction: -1 | 1) {
    const list =
      folder === "contactvideo"
        ? media.contactVideos
        : folder === "hero"
          ? media.hero
          : folder === "photos"
            ? media.photos
            : folder === "floorplans"
              ? media.floorplans
              : folder === "backgrounds"
                ? media.backgrounds
                : media.docs;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= list.length) return;
    const reordered = reorderItems(list, index, nextIndex);
    const nextMedia =
      folder === "contactvideo"
        ? { ...media, contactVideos: reordered }
        : folder === "hero"
          ? { ...media, hero: reordered }
          : folder === "photos"
            ? { ...media, photos: reordered }
            : folder === "floorplans"
              ? { ...media, floorplans: reordered }
              : folder === "backgrounds"
                ? { ...media, backgrounds: reordered }
                : { ...media, docs: reordered };
    setMedia(nextMedia);
    setMediaDirty(true);
    await persistMedia(nextMedia, false);
  }

  async function reorderMediaItem(folder: MediaFolder, from: number, to: number) {
    const list =
      folder === "contactvideo"
        ? media.contactVideos
        : folder === "hero"
          ? media.hero
          : folder === "photos"
            ? media.photos
            : folder === "floorplans"
              ? media.floorplans
              : folder === "backgrounds"
                ? media.backgrounds
                : media.docs;
    const reordered = reorderItems(list, from, to);
    if (reordered === list) return;
    const nextMedia =
      folder === "contactvideo"
        ? { ...media, contactVideos: reordered }
        : folder === "hero"
          ? { ...media, hero: reordered }
          : folder === "photos"
            ? { ...media, photos: reordered }
            : folder === "floorplans"
              ? { ...media, floorplans: reordered }
              : folder === "backgrounds"
                ? { ...media, backgrounds: reordered }
                : { ...media, docs: reordered };
    setMedia(nextMedia);
    setMediaDirty(true);
    await persistMedia(nextMedia, false);
  }

  async function assignPhotoSpace(item: OwnerMediaItem, nextSpace: string) {
    const space = normalizeRoomName(nextSpace);
    const nextSpaceOrder =
      space && !media.photoSpaceOrder.some((entry) => entry.toLowerCase() === space.toLowerCase())
        ? [...media.photoSpaceOrder, space]
        : media.photoSpaceOrder;
    const nextMedia = {
      ...media,
      photoSpaceOrder: nextSpaceOrder,
      photos: media.photos.map((photo) =>
        photo.objectPath === item.objectPath
          ? { ...photo, space: space || undefined }
          : photo
      )
    };
    setMedia(nextMedia);
    setMediaDirty(true);
    await persistMedia(nextMedia, false);
  }

  async function movePhotoSpaceGroup(fromSpace: string, toSpace: string) {
    if (fromSpace === toSpace) return;
    const existingSpaces = new Set(
      media.photos.map((item) => photoSpaceName(item).toLowerCase())
    );
    for (const name of media.photoSpaceOrder) {
      existingSpaces.add(name.toLowerCase());
    }
    const orderedRooms = [...media.photoSpaceOrder];
    for (const item of media.photos) {
      const space = photoSpaceName(item);
      if (!orderedRooms.some((entry) => entry.toLowerCase() === space.toLowerCase())) {
        orderedRooms.push(space);
      }
    }
    const fromIndex = orderedRooms.findIndex((room) => room === fromSpace);
    const toIndex = orderedRooms.findIndex((room) => room === toSpace);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;

    const nextSpaceOrder = [...orderedRooms];
    const [movedRoom] = nextSpaceOrder.splice(fromIndex, 1);
    nextSpaceOrder.splice(toIndex, 0, movedRoom);

    const roomOrderIndex = new Map(
      nextSpaceOrder.map((room, index) => [room.toLowerCase(), index])
    );
    const nextPhotos = [...media.photos].sort((a, b) => {
      const roomA = photoSpaceName(a).toLowerCase();
      const roomB = photoSpaceName(b).toLowerCase();
      return (roomOrderIndex.get(roomA) ?? Number.MAX_SAFE_INTEGER) -
        (roomOrderIndex.get(roomB) ?? Number.MAX_SAFE_INTEGER);
    });

    const nextMedia = {
      ...media,
      photoSpaceOrder: nextSpaceOrder,
      photos: nextPhotos
    };
    setMedia(nextMedia);
    setMediaDirty(true);
    await persistMedia(nextMedia, false);
  }

  async function addPhotoSpace(spaceRaw: string) {
    const space = normalizeRoomName(spaceRaw);
    if (!space) return;
    if (media.photoSpaceOrder.some((entry) => entry.toLowerCase() === space.toLowerCase())) {
      return;
    }
    const nextMedia = {
      ...media,
      photoSpaceOrder: [...media.photoSpaceOrder, space]
    };
    setMedia(nextMedia);
    setMediaDirty(true);
    await persistMedia(nextMedia, false);
  }

  async function renameDocument(item: OwnerMediaItem, label: string) {
    const nextMedia = {
      ...media,
      docs: media.docs.map((doc) =>
        doc.objectPath === item.objectPath
          ? { ...doc, label }
          : doc
      )
    };
    setMedia(nextMedia);
    setMediaDirty(true);
    await persistMedia(nextMedia, false);
  }

  const propertyJson = useMemo(() => {
    const features = draft.featuresText
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean);

    const data = {
      address: {
        street: draft.street,
        city: draft.city,
        state: draft.state,
        zip: draft.zip
      },
      price: { amount: Number(draft.price || 0), currency: "USD" as const },
      beds: Number(draft.beds || 0),
      baths: Number(draft.baths || 0),
      homeSqft: Number(draft.homeSqft || 0),
      lot: { acres: Number(draft.lotAcres || 0) },
      headline: draft.headline,
      description: draft.description,
      features,
      agent: {
        name: draft.agentName,
        phone: draft.agentPhone || undefined,
        email: draft.agentEmail || undefined
      },
      openHouses: draft.openHouseIso ? [{ startIso: draft.openHouseIso, note: "Open house" }] : [],
      location:
        draft.lat && draft.lon
          ? { lat: Number(draft.lat), lon: Number(draft.lon) }
          : undefined,
      media: {
        ...mediaManifest(media),
        video: mediaExtras.video,
        tours: mediaExtras.tours || []
      }
    };

    return JSON.stringify(data, null, 2);
  }, [draft, media, mediaExtras]);

  useEffect(() => {
    if (!readyToken || !normalizedSlug) return;
    const timer = setTimeout(() => {
      void loadMediaWithToken(readyToken, normalizedSlug);
    }, 220);
    return () => clearTimeout(timer);
  }, [readyToken, normalizedSlug, loadMediaWithToken]);

  useEffect(() => {
    if (!readyToken || !normalizedSlug || autoLoadedSlug === normalizedSlug) return;
    const timer = setTimeout(() => {
      void loadListingWithToken(readyToken, normalizedSlug, false);
      setAutoLoadedSlug(normalizedSlug);
    }, 220);
    return () => clearTimeout(timer);
  }, [autoLoadedSlug, loadListingWithToken, normalizedSlug, readyToken]);

  if (authState.status !== "ready") {
    return (
      <main>
        <section className="container-page py-16">
          <div className="mx-auto max-w-xl rounded-2xl border border-ink-200 bg-white p-8 text-center">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-600">
              Owner Panel
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink-950">
              Authentication Required
            </h1>
            <p className="mt-3 text-sm text-ink-700">
              Sign in with an authorized Google account to access listing management.
            </p>

            {authState.status === "checking" ? (
              <p className="mt-6 text-sm text-ink-700">Checking session...</p>
            ) : (
              <button
                type="button"
                onClick={() => void ensureSignedIn()}
                className="mt-6 rounded-xl bg-ink-950 px-5 py-3 text-sm font-semibold text-white"
              >
                Sign in with Google
              </button>
            )}

            {authState.status === "forbidden" ? (
              <p className="mt-4 text-sm text-red-700">
                This account is not on the owner allowlist.
              </p>
            ) : authState.status === "error" ? (
              <p className="mt-4 text-sm text-red-700">{authState.message}</p>
            ) : null}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main>
      <header className="border-b border-ink-100">
        <div className="container-page py-10">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-600">
            Owner Panel
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Listing Studio
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-ink-700">
            Manage listing details, photos, and documents.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="text-sm text-ink-700">
              Signed in as <span className="font-medium">{authState.email}</span>
            </span>
            <button
              type="button"
              onClick={() => void doSignOut()}
              className="rounded-xl border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-900 hover:bg-ink-50"
            >
              Sign out
            </button>
            <a
              href={normalizedSlug ? `/p/${normalizedSlug}` : "/"}
              className="rounded-xl border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-900 hover:bg-ink-50"
            >
              Back to Listing
            </a>
            {/* <button
              type="button"
              onClick={() => void loadListing()}
              disabled={loadingListing}
              className="rounded-xl border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-900 enabled:hover:bg-ink-50 disabled:opacity-50"
            >
              {loadingListing ? "Loading..." : "Load Listing"}
            </button> */}

            <button
              type="button"
              onClick={() => void saveListing()}
              disabled={savingListing}
              className="rounded-xl bg-ink-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {savingListing ? "Saving..." : "Save Listing"}
            </button>
          </div>

          {statusMessage ? (
            <p className="mt-3 text-sm text-ink-700">{statusMessage}</p>
          ) : null}
          {mediaDirty ? (
            <p className="mt-1 text-xs text-amber-700">
              You have unsaved media ordering/label changes.
            </p>
          ) : null}
        </div>
      </header>

      <section className="container-page py-10">
        <div className="grid gap-6">
          <div className="card p-6">
              <h2 className="text-base font-semibold text-ink-950">Listing Details</h2>
              <p className="mt-1 text-sm text-ink-600">
                Update the property information below.
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Slug">
                  <input
                    value={draft.slug}
                    onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                    className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm"
                  />
                </Field>
                <div className="hidden sm:block" />

                <Field label="Street">
                  <input
                    value={draft.street}
                    onChange={(e) => setDraft({ ...draft, street: e.target.value })}
                    className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm"
                  />
                </Field>
                <Field label="City">
                  <input
                    value={draft.city}
                    onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                    className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm"
                  />
                </Field>
                <Field label="State">
                  <input
                    value={draft.state}
                    onChange={(e) => setDraft({ ...draft, state: e.target.value })}
                    className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm"
                  />
                </Field>
                <Field label="ZIP">
                  <input
                    value={draft.zip}
                    onChange={(e) => setDraft({ ...draft, zip: e.target.value })}
                    className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm"
                  />
                </Field>

                <Field label="Price (USD)">
                  <input
                    type="number"
                    value={draft.price}
                    onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })}
                    className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm"
                  />
                </Field>
                <Field label="Beds">
                  <input
                    type="number"
                    value={draft.beds}
                    onChange={(e) => setDraft({ ...draft, beds: Number(e.target.value) })}
                    className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm"
                  />
                </Field>
                <Field label="Baths">
                  <input
                    type="number"
                    value={draft.baths}
                    onChange={(e) => setDraft({ ...draft, baths: Number(e.target.value) })}
                    className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm"
                  />
                </Field>
                <Field label="Home sqft">
                  <input
                    type="number"
                    value={draft.homeSqft}
                    onChange={(e) => setDraft({ ...draft, homeSqft: Number(e.target.value) })}
                    className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm"
                  />
                </Field>
                <Field label="Lot acres">
                  <input
                    type="number"
                    value={draft.lotAcres}
                    onChange={(e) => setDraft({ ...draft, lotAcres: Number(e.target.value) })}
                    className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm"
                  />
                </Field>

                <Field label="Headline">
                  <input
                    value={draft.headline}
                    onChange={(e) => setDraft({ ...draft, headline: e.target.value })}
                    className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm"
                  />
                </Field>
                <div className="hidden sm:block" />

                <Field label="Description">
                  <textarea
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    rows={6}
                    className="w-full rounded-xl border border-ink-200 px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Features (one per line)">
                  <textarea
                    value={draft.featuresText}
                    onChange={(e) => setDraft({ ...draft, featuresText: e.target.value })}
                    rows={6}
                    className="w-full rounded-xl border border-ink-200 px-3 py-2 text-sm"
                  />
                </Field>

                <Field label="Contact name">
                  <input
                    value={draft.agentName}
                    onChange={(e) => setDraft({ ...draft, agentName: e.target.value })}
                    className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm"
                  />
                </Field>
                <Field label="Contact phone">
                  <input
                    value={draft.agentPhone}
                    onChange={(e) => setDraft({ ...draft, agentPhone: e.target.value })}
                    className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm"
                  />
                </Field>
                <Field label="Contact email">
                  <input
                    value={draft.agentEmail}
                    onChange={(e) => setDraft({ ...draft, agentEmail: e.target.value })}
                    className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm"
                  />
                </Field>

                <Field label="Open house date & time">
                  <input
                    type="datetime-local"
                    value={toLocalDateTimeInput(draft.openHouseIso)}
                    onChange={(e) =>
                      setDraft({ ...draft, openHouseIso: fromLocalDateTimeInput(e.target.value) })
                    }
                    className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm"
                  />
                </Field>
                <Field label="Latitude">
                  <input
                    value={draft.lat}
                    onChange={(e) => setDraft({ ...draft, lat: e.target.value })}
                    className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm"
                  />
                </Field>
                <Field label="Longitude">
                  <input
                    value={draft.lon}
                    onChange={(e) => setDraft({ ...draft, lon: e.target.value })}
                    className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm"
                  />
                </Field>
              </div>
          </div>

          <div className="card p-6">
              <h2 className="text-base font-semibold text-ink-950">Media Manager</h2>
              <p className="mt-1 text-sm text-ink-600">
                Upload and arrange your listing media.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void loadMedia(true)}
                  disabled={mediaBusy}
                  className="rounded-xl border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-900 enabled:hover:bg-ink-50 disabled:opacity-50"
                >
                  Load Images
                </button>
                <button
                  type="button"
                  onClick={() => void persistMedia(media)}
                  disabled={mediaBusy || !mediaDirty}
                  className="rounded-xl border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-900 enabled:hover:bg-ink-50 disabled:opacity-50"
                >
                  Save Media Order
                </button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <UploadRow
                  label="Upload section background"
                  hint="Used behind overview and features"
                  onPick={(files) => uploadFiles("backgrounds", files)}
                />
                <UploadRow
                  label="Upload contact video"
                  hint="Plays behind contact section"
                  accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                  onPick={(files) => uploadFiles("contactvideo", files)}
                />
                <UploadRow
                  label="Upload hero"
                  hint="Top slideshow images"
                  onPick={(files) => uploadFiles("hero", files)}
                />
                <UploadRow
                  label="Upload photos"
                  hint="Gallery images"
                  onPick={(files) => uploadFiles("photos", files)}
                />
                <UploadRow
                  label="Upload floorplans"
                  hint="Plans and schematics"
                  onPick={(files) => uploadFiles("floorplans", files)}
                />
                <UploadRow
                  label="Upload docs"
                  hint="PDF brochures/disclosures"
                  accept=".pdf"
                  onPick={(files) => uploadFiles("docs", files)}
                />
              </div>

              <div className="mt-6 grid gap-4">
                <MediaPanel
                  title="Section Background"
                  folder="backgrounds"
                  items={media.backgrounds}
                  busy={mediaBusy}
                  onMove={(index, dir) => void moveMediaItem("backgrounds", index, dir)}
                  onReorder={(from, to) => void reorderMediaItem("backgrounds", from, to)}
                  onDelete={(item) => void deleteMediaItem("backgrounds", item)}
                />
                <MediaPanel
                  title="Contact Video Background"
                  folder="contactvideo"
                  items={media.contactVideos}
                  busy={mediaBusy}
                  onMove={(index, dir) => void moveMediaItem("contactvideo", index, dir)}
                  onReorder={(from, to) => void reorderMediaItem("contactvideo", from, to)}
                  onDelete={(item) => void deleteMediaItem("contactvideo", item)}
                />
                <MediaPanel
                  title="Hero"
                  folder="hero"
                  items={media.hero}
                  busy={mediaBusy}
                  onMove={(index, dir) => void moveMediaItem("hero", index, dir)}
                  onReorder={(from, to) => void reorderMediaItem("hero", from, to)}
                  onDelete={(item) => void deleteMediaItem("hero", item)}
                />
                <MediaPanel
                  title="Photos"
                  folder="photos"
                  items={media.photos}
                  photoSpaceOrder={media.photoSpaceOrder}
                  busy={mediaBusy}
                  onMove={(index, dir) => void moveMediaItem("photos", index, dir)}
                  onReorder={(from, to) => void reorderMediaItem("photos", from, to)}
                  onDelete={(item) => void deleteMediaItem("photos", item)}
                  onAssignPhotoSpace={(item, space) => void assignPhotoSpace(item, space)}
                  onMovePhotoSpaceGroup={(fromSpace, toSpace) =>
                    void movePhotoSpaceGroup(fromSpace, toSpace)
                  }
                  onAddPhotoSpace={(space) => void addPhotoSpace(space)}
                  onDropFilesToPhotoSpace={(space, files) =>
                    void uploadFilesToPhotoSpace(space, files)
                  }
                />
                <MediaPanel
                  title="Floorplans"
                  folder="floorplans"
                  items={media.floorplans}
                  busy={mediaBusy}
                  onMove={(index, dir) => void moveMediaItem("floorplans", index, dir)}
                  onReorder={(from, to) => void reorderMediaItem("floorplans", from, to)}
                  onDelete={(item) => void deleteMediaItem("floorplans", item)}
                />
                <MediaPanel
                  title="Documents"
                  folder="docs"
                  items={media.docs}
                  busy={mediaBusy}
                  onMove={(index, dir) => void moveMediaItem("docs", index, dir)}
                  onReorder={(from, to) => void reorderMediaItem("docs", from, to)}
                  onDelete={(item) => void deleteMediaItem("docs", item)}
                  onRename={(item, label) => void renameDocument(item, label)}
                />
              </div>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-ink-100 px-6 py-4">
              <p className="text-sm font-semibold text-ink-950">Firestore payload preview</p>
              <p className="mt-1 text-sm text-ink-600">
                Preview of what will be saved.
              </p>
            </div>
            <pre className="max-h-[50vh] overflow-auto bg-ink-950 p-5 text-xs text-white/90">
              {propertyJson}
            </pre>
          </div>
        </div>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-ink-900">
      {label}
      {children}
    </label>
  );
}

function UploadRow({
  label,
  hint,
  accept,
  onPick
}: {
  label: string;
  hint: string;
  accept?: string;
  onPick: (files: FileList) => Promise<void>;
}) {
  const inputId = useId();
  const [isDragOver, setIsDragOver] = useState(false);
  const [status, setStatus] = useState<
    | { state: "idle" }
    | { state: "picked"; count: number }
    | { state: "uploading"; count: number }
    | { state: "done"; count: number }
    | { state: "error"; message: string }
  >({ state: "idle" });

  async function processFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setStatus({ state: "picked", count: files.length });
    try {
      setStatus({ state: "uploading", count: files.length });
      await onPick(files);
      setStatus({ state: "done", count: files.length });
    } catch (err) {
      setStatus({
        state: "error",
        message: err instanceof Error ? err.message : "Upload failed"
      });
    }
  }

  return (
    <div
      className={`rounded-xl border p-4 min-h-[170px] transition ${
        isDragOver ? "border-ink-400 bg-ink-100/80" : "border-ink-200 bg-ink-50/70"
      }`}
      onDragEnter={(e) => {
        if (e.dataTransfer.types.includes("Files")) setIsDragOver(true);
      }}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setIsDragOver(false);
        void processFiles(e.dataTransfer.files);
      }}
    >
      <p className="text-sm font-semibold text-ink-950">{label}</p>
      <p className="mt-1 text-xs text-ink-600">{hint}</p>
      <div className="mt-3 min-h-[1.25rem]">
        {status.state === "picked" ? (
          <p className="text-xs text-ink-700">Selected {status.count} file(s).</p>
        ) : status.state === "uploading" ? (
          <p className="text-xs text-ink-700">Uploading {status.count} file(s)...</p>
        ) : status.state === "done" ? (
          <p className="text-xs text-green-700">Uploaded {status.count} file(s).</p>
        ) : status.state === "error" ? (
          <p className="text-xs text-red-700">{status.message}</p>
        ) : null}
      </div>

      <input
        id={inputId}
        type="file"
        multiple
        accept={accept}
        disabled={status.state === "uploading"}
        onChange={async (e) => {
          const input = e.currentTarget;
          await processFiles(input.files);
          input.value = "";
        }}
        className="sr-only"
      />

      <label
        htmlFor={inputId}
        className="mt-3 inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-lg border border-ink-200 bg-white px-3 text-sm font-semibold text-ink-900 hover:bg-ink-50"
      >
        Choose Files
      </label>
      <p className="mt-2 text-xs text-ink-500">
        Drag files here or choose files. Images: JPG, PNG, WEBP, AVIF. Videos: MP4, WEBM, MOV. Docs: PDF.
      </p>
    </div>
  );
}

function MediaPanel({
  title,
  folder,
  items,
  photoSpaceOrder = [],
  busy,
  onMove,
  onReorder,
  onDelete,
  onRename,
  onAssignPhotoSpace,
  onMovePhotoSpaceGroup,
  onAddPhotoSpace,
  onDropFilesToPhotoSpace
}: {
  title: string;
  folder: MediaFolder;
  items: OwnerMediaItem[];
  photoSpaceOrder?: string[];
  busy: boolean;
  onMove: (index: number, direction: -1 | 1) => void;
  onReorder: (from: number, to: number) => void;
  onDelete: (item: OwnerMediaItem) => void;
  onRename?: (item: OwnerMediaItem, label: string) => void;
  onAssignPhotoSpace?: (item: OwnerMediaItem, space: string) => void;
  onMovePhotoSpaceGroup?: (fromSpace: string, toSpace: string) => void;
  onAddPhotoSpace?: (space: string) => void;
  onDropFilesToPhotoSpace?: (space: string, files: FileList) => void;
}) {
  const isPhotoPanel = folder === "photos";
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const handleDragIndex = useRef<number | null>(null);
  const [collapsedSpaces, setCollapsedSpaces] = useState<Record<string, boolean>>({});
  const [spaceDragName, setSpaceDragName] = useState<string | null>(null);
  const [spaceDropName, setSpaceDropName] = useState<string | null>(null);
  const spaceListId = useId();
  const [newRoomValue, setNewRoomValue] = useState("");

  const groupedPhotos = useMemo(() => {
    const groups: { space: string; items: { item: OwnerMediaItem; index: number }[] }[] = [];
    items.forEach((item, index) => {
      const space = photoSpaceName(item);
      const existing = groups.find((group) => group.space === space);
      if (existing) {
        existing.items.push({ item, index });
      } else {
        groups.push({ space, items: [{ item, index }] });
      }
    });
    const byRoom = new Map(groups.map((group) => [group.space.toLowerCase(), group]));
    const ordered: { space: string; items: { item: OwnerMediaItem; index: number }[] }[] = [];
    for (const room of photoSpaceOrder) {
      const key = room.toLowerCase();
      if (byRoom.has(key)) {
        ordered.push(byRoom.get(key)!);
      } else {
        ordered.push({ space: room, items: [] });
      }
      byRoom.delete(key);
    }
    for (const group of groups) {
      if (byRoom.has(group.space.toLowerCase())) ordered.push(group);
    }
    return ordered;
  }, [items, photoSpaceOrder]);
  const existingPhotoSpaces = useMemo(
    () =>
      isPhotoPanel
        ? Array.from(
            new Set(
              items
                .map((item) => String(item.space ?? "").trim())
                .filter(Boolean)
            )
          )
        : [],
    [isPhotoPanel, items]
  );
  const photoSpaceOptions = useMemo(() => {
    const merged = [...existingPhotoSpaces, ...PHOTO_SPACE_SUGGESTIONS];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const value of merged) {
      const key = value.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(value);
    }
    return out;
  }, [existingPhotoSpaces]);

  useEffect(() => {
    if (!isPhotoPanel) return;
    setCollapsedSpaces((prev) => {
      const next: Record<string, boolean> = {};
      for (const group of groupedPhotos) {
        next[group.space] = prev[group.space] ?? true;
      }
      return next;
    });
  }, [groupedPhotos, isPhotoPanel]);

  function toggleSpace(space: string) {
    setCollapsedSpaces((prev) => ({ ...prev, [space]: !prev[space] }));
  }

  function onAddRoomSubmit() {
    if (!onAddPhotoSpace) return;
    const value = normalizeRoomName(newRoomValue);
    if (!value) return;
    onAddPhotoSpace(value);
    setNewRoomValue("");
  }

  function renderItemRow(item: OwnerMediaItem, index: number) {
    return (
      <li
        key={item.objectPath}
        onDragOver={(e) => {
          if (busy) return;
          e.preventDefault();
          setDropIndex(index);
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (busy || dragIndex == null || dragIndex === index) {
            setDragIndex(null);
            setDropIndex(null);
            return;
          }
          onReorder(dragIndex, index);
          setDragIndex(null);
          setDropIndex(null);
        }}
        onDragEnd={() => {
          setDragIndex(null);
          setDropIndex(null);
          handleDragIndex.current = null;
        }}
        className={`rounded-xl border p-3 ${
          dropIndex === index ? "border-ink-300 bg-ink-50" : "border-ink-100"
        }`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <button
              type="button"
              aria-label={`Drag ${item.name}`}
              draggable={!busy}
              disabled={busy}
              onMouseDown={() => {
                handleDragIndex.current = index;
              }}
              onTouchStart={() => {
                handleDragIndex.current = index;
              }}
              onDragStart={(e) => {
                if (busy) {
                  e.preventDefault();
                  return;
                }
                setDragIndex(index);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setDropIndex(null);
                handleDragIndex.current = null;
              }}
              className="mt-1 inline-flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-700 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
            >
              ::
            </button>
            {isImageItem(item) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.signedUrl}
                alt={item.name}
                className="h-20 w-28 shrink-0 rounded-lg object-cover sm:h-24 sm:w-32"
                loading="lazy"
              />
            ) : (
              <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-lg bg-ink-50 text-xs text-ink-600 sm:h-24 sm:w-32">
                File
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs text-ink-500">#{index + 1}</p>
              <p className="truncate text-sm font-medium text-ink-900">{item.name}</p>
              <p className="truncate text-xs text-ink-600">{item.objectPath}</p>
              {isPhotoPanel && onAssignPhotoSpace ? (
                <input
                  list={spaceListId}
                  defaultValue={item.space || ""}
                  placeholder="Assign a space (e.g., Kitchen)"
                  autoComplete="off"
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    onAssignPhotoSpace(item, (e.currentTarget as HTMLInputElement).value);
                    (e.currentTarget as HTMLInputElement).blur();
                  }}
                  onBlur={(e) => onAssignPhotoSpace(item, e.target.value)}
                  className="mt-2 h-9 w-full rounded-lg border border-ink-200 px-2 text-xs"
                />
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:ml-auto sm:justify-end">
            <button
              type="button"
              onClick={() => onMove(index, -1)}
              disabled={busy || index === 0}
              className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-900 disabled:opacity-40"
            >
              Up
            </button>
            <button
              type="button"
              onClick={() => onMove(index, 1)}
              disabled={busy || index === items.length - 1}
              className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-900 disabled:opacity-40"
            >
              Down
            </button>
            <button
              type="button"
              onClick={() => onDelete(item)}
              disabled={busy}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-40"
            >
              Delete
            </button>
          </div>
        </div>

        {folder === "docs" && onRename ? (
          <input
            defaultValue={item.label || item.name}
            onBlur={(e) => onRename(item, e.target.value)}
            className="mt-3 h-9 w-full rounded-lg border border-ink-200 px-2 text-xs"
          />
        ) : null}
      </li>
    );
  }

  return (
    <div className="rounded-xl border border-ink-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink-950">{title}</p>
        <span className="rounded-full bg-ink-100 px-2 py-1 text-xs text-ink-700">
          {items.length}
        </span>
      </div>
      <p className="mt-1 text-xs text-ink-600">Drag by handle to reorder.</p>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-ink-600">No files yet.</p>
      ) : null}
      {items.length > 0 && !isPhotoPanel ? (
        <ul className="mt-3 space-y-3">
          {items.map((item, index) => renderItemRow(item, index))}
        </ul>
      ) : null}
      {items.length > 0 && isPhotoPanel ? (
        <>
          <datalist id={spaceListId}>
            {photoSpaceOptions.map((space) => (
              <option key={space} value={space} />
            ))}
          </datalist>
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-ink-200 bg-ink-50/70 p-3">
            <p className="text-xs font-semibold text-ink-800">Add Room</p>
            <input
              list={spaceListId}
              value={newRoomValue}
              onChange={(e) => setNewRoomValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                onAddRoomSubmit();
              }}
              placeholder="Type room name"
              className="h-9 min-w-[220px] flex-1 rounded-lg border border-ink-200 px-2 text-xs"
            />
            <button
              type="button"
              onClick={onAddRoomSubmit}
              disabled={!newRoomValue.trim() || busy}
              className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-900 disabled:opacity-40"
            >
              Add Room
            </button>
          </div>
          <ul className="mt-3 space-y-3">
            {groupedPhotos.map((group) => {
            const collapsed = Boolean(collapsedSpaces[group.space]);
            return (
              <li
                key={group.space}
                onDragOver={(e) => {
                  if (busy) return;
                  e.preventDefault();
                  setSpaceDropName(group.space);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (busy) {
                    setSpaceDragName(null);
                    setSpaceDropName(null);
                    setDragIndex(null);
                    setDropIndex(null);
                    return;
                  }
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    if (onDropFilesToPhotoSpace) {
                      onDropFilesToPhotoSpace(group.space, e.dataTransfer.files);
                    }
                    setSpaceDragName(null);
                    setSpaceDropName(null);
                    setDragIndex(null);
                    setDropIndex(null);
                    return;
                  }
                  if (dragIndex != null && onAssignPhotoSpace) {
                    const dragged = items[dragIndex];
                    if (dragged) onAssignPhotoSpace(dragged, group.space);
                    setDragIndex(null);
                    setDropIndex(null);
                    setSpaceDragName(null);
                    setSpaceDropName(null);
                    return;
                  }
                  if (spaceDragName && spaceDragName !== group.space && onMovePhotoSpaceGroup) {
                    onMovePhotoSpaceGroup(spaceDragName, group.space);
                  }
                  setSpaceDragName(null);
                  setSpaceDropName(null);
                }}
                onDragEnd={() => {
                  setSpaceDragName(null);
                  setSpaceDropName(null);
                }}
                className={`rounded-xl border p-3 ${
                  spaceDropName === group.space ? "border-ink-300 bg-ink-50" : "border-ink-100"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    aria-label={`Drag room ${group.space}`}
                    draggable={!busy}
                    disabled={busy}
                    onDragStart={(e) => {
                      if (busy) {
                        e.preventDefault();
                        return;
                      }
                      setSpaceDragName(group.space);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setSpaceDragName(null);
                      setSpaceDropName(null);
                    }}
                    className="inline-flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-700 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ::
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSpace(group.space)}
                    className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-900"
                  >
                    {collapsed ? "Expand" : "Collapse"}
                  </button>
                  <p className="text-sm font-semibold text-ink-900">{group.space}</p>
                  <span className="rounded-full bg-ink-100 px-2 py-1 text-xs text-ink-700">
                    {group.items.length}
                  </span>
                </div>

                {!collapsed ? (
                  <ul className="mt-3 space-y-3">
                    {group.items.map(({ item, index }) => renderItemRow(item, index))}
                  </ul>
                ) : null}
              </li>
            );
            })}
          </ul>
        </>
      ) : null}
    </div>
  );
}
