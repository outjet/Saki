"use client";

import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { useMemo, useState } from "react";
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

const initial: Draft = {
  slug: "23760-emmons-road",
  street: "23760 Emmons Road",
  city: "Columbia Station",
  state: "OH",
  zip: "44028",
  price: 650000,
  beds: 4,
  baths: 3,
  homeSqft: 2750,
  lotAcres: 2.84,
  headline: "Modern comfort on a private 2.84-acre setting.",
  description:
    "Introducing 23760 Emmons Road, a stunning property located in Columbia Station, OH. This home offers comfort, privacy, and room to roam. Oversized windows fill the interior with natural light, and thoughtful finishes bring a warm, inviting feel throughout.\n\n(Replace this demo copy with your real description.)",
  featuresText: "Hardwood floors\nOversized windows\nLarge lot\nPrivate setting\nUpdated kitchen\nThree-car garage",
  agentName: "Cacey Example",
  agentPhone: "(440) 555-0123",
  agentEmail: "cacey@example.com",
  openHouseIso: "2026-02-28T09:45:00-05:00",
  lat: "41.2902254",
  lon: "-81.8927872"
};

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function OwnerPage() {
  const [d, setD] = useState<Draft>(initial);
  const [authState, setAuthState] = useState<
    | { status: "signed_out" }
    | { status: "checking" }
    | { status: "forbidden"; email?: string }
    | { status: "error"; message: string }
    | { status: "ready"; email: string; token: string }
  >({ status: "signed_out" });

  async function ensureSignedIn() {
    const auth = firebaseAuth();
    try {
      if (!auth.currentUser) {
        setAuthState({ status: "checking" });
        await signInWithPopup(auth, new GoogleAuthProvider());
      }
      const token = await auth.currentUser!.getIdToken();
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
      setAuthState({ status: "ready", email: me.email!, token });
      return token;
    } catch (e) {
      setAuthState({
        status: "error",
        message: e instanceof Error ? e.message : "Sign-in failed."
      });
      return null;
    }
  }

  async function doSignOut() {
    await signOut(firebaseAuth());
    setAuthState({ status: "signed_out" });
  }

  const json = useMemo(() => {
    const features = d.featuresText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const property = {
      address: { street: d.street, city: d.city, state: d.state, zip: d.zip },
      price: { amount: Number(d.price || 0), currency: "USD" as const },
      beds: Number(d.beds || 0),
      baths: Number(d.baths || 0),
      homeSqft: Number(d.homeSqft || 0),
      lot: { acres: Number(d.lotAcres || 0) },
      headline: d.headline,
      description: d.description,
      features,
      agent: {
        name: d.agentName,
        phone: d.agentPhone || undefined,
        email: d.agentEmail || undefined
      },
      openHouses: d.openHouseIso
        ? [{ startIso: d.openHouseIso, note: "Open house" }]
        : [],
      location:
        d.lat && d.lon
          ? { lat: Number(d.lat), lon: Number(d.lon) }
          : undefined,
      media: {
        // Leave these empty to auto-discover from /public/listings/<slug>/*
        hero: [],
        photos: [],
        floorplans: [],
        documents: [],
        video: {
          title: "Property video",
          embedUrl: ""
        },
        tours: []
      }
    };

    return JSON.stringify(property, null, 2);
  }, [d]);

  async function saveToFirebase() {
    const token = (await ensureSignedIn()) ?? null;
    if (!token) return;
    const payload = JSON.parse(json) as any;
    const res = await fetch("/api/admin/property", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ slug: d.slug, property: payload })
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) throw new Error(data.error ?? "Save failed");
  }

  async function uploadFiles(folder: "hero" | "photos" | "floorplans" | "docs", files: FileList) {
    const token = (await ensureSignedIn()) ?? null;
    if (!token) return;

    const list = Array.from(files);
    for (const file of list) {
      const res = await fetch("/api/admin/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({
          slug: d.slug,
          folder,
          filename: file.name,
          contentType: file.type || "application/octet-stream"
        })
      });
      const data = (await res.json()) as { ok?: boolean; signedUrl?: string; error?: string };
      if (!res.ok || !data.ok || !data.signedUrl) {
        throw new Error(data.error ?? "Failed to create upload URL");
      }
      const put = await fetch(data.signedUrl, {
        method: "PUT",
        headers: { "content-type": file.type || "application/octet-stream" },
        body: file
      });
      if (!put.ok) {
        throw new Error(`Upload failed for ${file.name}`);
      }
    }
  }

  return (
    <main>
      <header className="border-b border-ink-100">
        <div className="container-page py-10">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-600">
            Owner Panel
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Update listing content
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-ink-700">
            Fill out fields and download a ready-to-drop{" "}
            <span className="font-mono text-[0.92em]">property.json</span>. Then
            place media in{" "}
            <span className="font-mono text-[0.92em]">
              public/listings/&lt;slug&gt;/
            </span>
            .
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {authState.status === "ready" ? (
              <>
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
              </>
            ) : (
              <button
                type="button"
                onClick={() => void ensureSignedIn()}
                className="rounded-xl bg-ink-950 px-4 py-2 text-sm font-semibold text-white"
              >
                Sign in with Google
              </button>
            )}
            {authState.status === "forbidden" ? (
              <span className="text-sm text-red-700">
                This account isn’t authorized.
              </span>
            ) : authState.status === "error" ? (
              <span className="text-sm text-red-700">{authState.message}</span>
            ) : null}
          </div>
        </div>
      </header>

      <section className="container-page py-10">
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="card p-6">
              <div className="mb-6 grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <p className="text-sm font-semibold text-ink-950">Media uploads</p>
                  <p className="mt-1 text-sm text-ink-600">
                    Uploads go to Firebase Storage under{" "}
                    <span className="font-mono text-[0.92em]">
                      listings/{d.slug}/…
                    </span>
                    . The site will auto-discover them.
                  </p>
                </div>
                <UploadRow
                  label="Hero images"
                  hint="Top carousel (wide images recommended)."
                  onPick={(files) => void uploadFiles("hero", files)}
                />
                <UploadRow
                  label="Gallery photos"
                  hint="Shown in Photos section (hero images are included too)."
                  onPick={(files) => void uploadFiles("photos", files)}
                />
                <UploadRow
                  label="Floor plans"
                  hint="Optional."
                  onPick={(files) => void uploadFiles("floorplans", files)}
                />
                <UploadRow
                  label="Documents"
                  hint="PDFs/brochures."
                  accept=".pdf"
                  onPick={(files) => void uploadFiles("docs", files)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Slug">
                  <input
                    value={d.slug}
                    onChange={(e) => setD({ ...d, slug: e.target.value })}
                    className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm"
                  />
                </Field>
                <div className="hidden sm:block" />
                <Field label="Street">
                  <input
                    value={d.street}
                    onChange={(e) => setD({ ...d, street: e.target.value })}
                    className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm"
                  />
                </Field>
                <Field label="City">
                  <input
                    value={d.city}
                    onChange={(e) => setD({ ...d, city: e.target.value })}
                    className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm"
                  />
                </Field>
                <Field label="State">
                  <input
                    value={d.state}
                    onChange={(e) => setD({ ...d, state: e.target.value })}
                    className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm"
                  />
                </Field>
                <Field label="Zip">
                  <input
                    value={d.zip}
                    onChange={(e) => setD({ ...d, zip: e.target.value })}
                    className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm"
                  />
                </Field>

                <Field label="Price (USD)">
                  <input
                    type="number"
                    value={d.price}
                    onChange={(e) => setD({ ...d, price: Number(e.target.value) })}
                    className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm"
                  />
                </Field>
                <Field label="Beds">
                  <input
                    type="number"
                    value={d.beds}
                    onChange={(e) => setD({ ...d, beds: Number(e.target.value) })}
                    className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm"
                  />
                </Field>
                <Field label="Baths">
                  <input
                    type="number"
                    value={d.baths}
                    onChange={(e) => setD({ ...d, baths: Number(e.target.value) })}
                    className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm"
                  />
                </Field>
                <Field label="Home sqft">
                  <input
                    type="number"
                    value={d.homeSqft}
                    onChange={(e) =>
                      setD({ ...d, homeSqft: Number(e.target.value) })
                    }
                    className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm"
                  />
                </Field>
                <Field label="Lot acres">
                  <input
                    type="number"
                    value={d.lotAcres}
                    onChange={(e) =>
                      setD({ ...d, lotAcres: Number(e.target.value) })
                    }
                    className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm"
                  />
                </Field>

                <Field label="Headline">
                  <input
                    value={d.headline}
                    onChange={(e) => setD({ ...d, headline: e.target.value })}
                    className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm"
                  />
                </Field>
                <div className="hidden sm:block" />

                <Field label="Description">
                  <textarea
                    value={d.description}
                    onChange={(e) => setD({ ...d, description: e.target.value })}
                    rows={6}
                    className="w-full rounded-xl border border-ink-200 px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Features (one per line)">
                  <textarea
                    value={d.featuresText}
                    onChange={(e) => setD({ ...d, featuresText: e.target.value })}
                    rows={6}
                    className="w-full rounded-xl border border-ink-200 px-3 py-2 text-sm"
                  />
                </Field>

                <Field label="Agent name">
                  <input
                    value={d.agentName}
                    onChange={(e) => setD({ ...d, agentName: e.target.value })}
                    className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm"
                  />
                </Field>
                <Field label="Agent phone">
                  <input
                    value={d.agentPhone}
                    onChange={(e) => setD({ ...d, agentPhone: e.target.value })}
                    className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm"
                  />
                </Field>
                <Field label="Agent email">
                  <input
                    value={d.agentEmail}
                    onChange={(e) => setD({ ...d, agentEmail: e.target.value })}
                    className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm"
                  />
                </Field>
                <Field label="Open house start (ISO)">
                  <input
                    value={d.openHouseIso}
                    onChange={(e) => setD({ ...d, openHouseIso: e.target.value })}
                    className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm"
                  />
                </Field>
                <Field label="Latitude">
                  <input
                    value={d.lat}
                    onChange={(e) => setD({ ...d, lat: e.target.value })}
                    className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm"
                  />
                </Field>
                <Field label="Longitude">
                  <input
                    value={d.lon}
                    onChange={(e) => setD({ ...d, lon: e.target.value })}
                    className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm"
                  />
                </Field>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => downloadText("property.json", json)}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-ink-950 px-5 text-sm font-semibold text-white"
                >
                  Download `property.json`
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await saveToFirebase();
                      alert("Saved to Firebase.");
                    } catch (e) {
                      alert(e instanceof Error ? e.message : "Save failed");
                    }
                  }}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-ink-200 bg-white px-5 text-sm font-semibold text-ink-900 hover:bg-ink-50"
                >
                  Save to Firebase
                </button>
                <a
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-ink-200 bg-white px-5 text-sm font-semibold text-ink-900 hover:bg-ink-50"
                  href="/"
                >
                  Back to site
                </a>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="card overflow-hidden">
              <div className="border-b border-ink-100 px-6 py-4">
                <p className="text-sm font-semibold text-ink-950">
                  Output preview
                </p>
                <p className="mt-1 text-sm text-ink-600">
                  Save this to{" "}
                  <span className="font-mono text-[0.92em]">
                    content/properties/{d.slug}/property.json
                  </span>
                  .
                </p>
              </div>
              <pre className="max-h-[70vh] overflow-auto bg-ink-950 p-5 text-xs text-white/90">
                {json}
              </pre>
            </div>

            <div className="mt-6 card p-6">
              <p className="text-sm font-semibold text-ink-950">Media folders</p>
              <ul className="mt-3 grid gap-2 text-sm text-ink-700">
                <li>
                  Hero:{" "}
                  <span className="font-mono text-[0.92em]">
                    public/listings/{d.slug}/hero/
                  </span>
                </li>
                <li>
                  Photos:{" "}
                  <span className="font-mono text-[0.92em]">
                    public/listings/{d.slug}/photos/
                  </span>
                </li>
                <li>
                  Floor plans:{" "}
                  <span className="font-mono text-[0.92em]">
                    public/listings/{d.slug}/floorplans/
                  </span>
                </li>
                <li>
                  Docs:{" "}
                  <span className="font-mono text-[0.92em]">
                    public/listings/{d.slug}/docs/
                  </span>
                </li>
              </ul>
              <p className="mt-4 text-sm text-ink-600">
                Leave `media.photos` empty to auto-discover files from these
                folders.
              </p>
            </div>
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
  onPick: (files: FileList) => void;
}) {
  return (
    <label className="card flex flex-col justify-between gap-3 p-4">
      <div>
        <p className="text-sm font-semibold text-ink-950">{label}</p>
        <p className="mt-1 text-sm text-ink-600">{hint}</p>
      </div>
      <input
        type="file"
        multiple
        accept={accept}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) onPick(e.target.files);
          e.currentTarget.value = "";
        }}
        className="block w-full text-sm text-ink-700 file:mr-3 file:rounded-lg file:border file:border-ink-200 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-ink-900 hover:file:bg-ink-50"
      />
    </label>
  );
}
