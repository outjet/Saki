"use client";

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from "firebase/auth";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
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
};

type OwnerMediaState = {
  hero: OwnerMediaItem[];
  photos: OwnerMediaItem[];
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
  floorplans: [],
  backgrounds: [],
  contactVideos: [],
  docs: []
};

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
    return {
      hero: nextMedia.hero.map((item) => item.objectPath),
      photos: nextMedia.photos.map((item) => item.objectPath),
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
    } catch (e) {
      setStatusMessage(e instanceof Error ? e.message : "Failed to load media");
    } finally {
      setMediaBusy(false);
    }
  }, []);

  async function persistMedia(nextMedia: OwnerMediaState) {
    const token = await getToken();
    if (!token) return false;
    const slug = safeSlug(draft.slug);
    if (!slug) {
      setStatusMessage("Set a slug first.");
      return false;
    }

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
      setStatusMessage("Media order saved.");
      return true;
    } catch (e) {
      setStatusMessage(e instanceof Error ? e.message : "Failed to save media order");
      return false;
    } finally {
      setMediaBusy(false);
    }
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

      await loadMedia();
      setStatusMessage(`Uploaded ${files.length} file(s) to ${folder}.`);
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
            <button
              type="button"
              onClick={() => void loadListing()}
              disabled={loadingListing}
              className="rounded-xl border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-900 enabled:hover:bg-ink-50 disabled:opacity-50"
            >
              {loadingListing ? "Loading..." : "Load Listing"}
            </button>

            <button
              type="button"
              onClick={() => void saveListing()}
              disabled={savingListing}
              className="rounded-xl bg-ink-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {savingListing ? "Saving..." : "Save Listing"}
            </button>

            <button
              type="button"
              onClick={() => void loadMedia(true)}
              disabled={mediaBusy}
              className="rounded-xl border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-900 enabled:hover:bg-ink-50 disabled:opacity-50"
            >
              Refresh Media
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

                <Field label="Open house start (ISO)">
                  <input
                    value={draft.openHouseIso}
                    onChange={(e) => setDraft({ ...draft, openHouseIso: e.target.value })}
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
                  onDelete={(item) => void deleteMediaItem("backgrounds", item)}
                />
                <MediaPanel
                  title="Contact Video Background"
                  folder="contactvideo"
                  items={media.contactVideos}
                  busy={mediaBusy}
                  onMove={(index, dir) => void moveMediaItem("contactvideo", index, dir)}
                  onDelete={(item) => void deleteMediaItem("contactvideo", item)}
                />
                <MediaPanel
                  title="Hero"
                  folder="hero"
                  items={media.hero}
                  busy={mediaBusy}
                  onMove={(index, dir) => void moveMediaItem("hero", index, dir)}
                  onDelete={(item) => void deleteMediaItem("hero", item)}
                />
                <MediaPanel
                  title="Photos"
                  folder="photos"
                  items={media.photos}
                  busy={mediaBusy}
                  onMove={(index, dir) => void moveMediaItem("photos", index, dir)}
                  onDelete={(item) => void deleteMediaItem("photos", item)}
                />
                <MediaPanel
                  title="Floorplans"
                  folder="floorplans"
                  items={media.floorplans}
                  busy={mediaBusy}
                  onMove={(index, dir) => void moveMediaItem("floorplans", index, dir)}
                  onDelete={(item) => void deleteMediaItem("floorplans", item)}
                />
                <MediaPanel
                  title="Documents"
                  folder="docs"
                  items={media.docs}
                  busy={mediaBusy}
                  onMove={(index, dir) => void moveMediaItem("docs", index, dir)}
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
  const [status, setStatus] = useState<
    | { state: "idle" }
    | { state: "picked"; count: number }
    | { state: "uploading"; count: number }
    | { state: "done"; count: number }
    | { state: "error"; message: string }
  >({ state: "idle" });

  return (
    <div className="rounded-xl border border-ink-200 bg-ink-50/70 p-4 min-h-[170px]">
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
          const files = input.files;
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
          } finally {
            input.value = "";
          }
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
        Images: JPG, PNG, WEBP, AVIF. Videos: MP4, WEBM, MOV. Docs: PDF.
      </p>
    </div>
  );
}

function MediaPanel({
  title,
  folder,
  items,
  busy,
  onMove,
  onDelete,
  onRename
}: {
  title: string;
  folder: MediaFolder;
  items: OwnerMediaItem[];
  busy: boolean;
  onMove: (index: number, direction: -1 | 1) => void;
  onDelete: (item: OwnerMediaItem) => void;
  onRename?: (item: OwnerMediaItem, label: string) => void;
}) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink-950">{title}</p>
        <span className="rounded-full bg-ink-100 px-2 py-1 text-xs text-ink-700">
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-ink-600">No files yet.</p>
      ) : null}
      {items.length > 0 ? (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {items.map((item, index) => (
            <li key={item.objectPath} className="rounded-xl border border-ink-100 p-3">
              <div className="flex gap-3">
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
                </div>
              </div>

              {folder === "docs" && onRename ? (
                <input
                  defaultValue={item.label || item.name}
                  onBlur={(e) => onRename(item, e.target.value)}
                  className="mt-2 h-9 w-full rounded-lg border border-ink-200 px-2 text-xs"
                />
              ) : null}

              <div className="mt-3 border-t border-ink-100 pt-3 flex flex-wrap gap-2">
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
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
