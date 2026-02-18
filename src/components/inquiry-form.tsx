"use client";

import { useState } from "react";

type FormState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export function InquiryForm({ propertySlug }: { propertySlug: string }) {
  const [state, setState] = useState<FormState>({ status: "idle" });
  const endpoint =
    process.env.NEXT_PUBLIC_FORMSPREE_ENDPOINT?.trim() ||
    "https://formspree.io/f/mykdpdkz";

  async function submit(form: HTMLFormElement) {
    setState({ status: "submitting" });
    try {
      const formData = new FormData(form);
      const name = String(formData.get("name") ?? "");
      const email = String(formData.get("email") ?? "");
      const phone = String(formData.get("phone") ?? "");
      if (!name || !email || !phone) {
        throw new Error("Name, email, and phone are required.");
      }
      formData.set("propertySlug", propertySlug);
      formData.set("source", "listing-contact");
      formData.set("_subject", `Listing inquiry: ${propertySlug}`);

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: formData
      });

      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; errors?: { message?: string }[] }
        | null;

      if (!res.ok) {
        const message =
          data?.errors?.map((e) => e.message).filter(Boolean).join(", ") ||
          data?.error ||
          "Submission failed";
        throw new Error(message);
      }

      form.reset();
      setState({
        status: "success",
        message: "Thanks — your inquiry was sent. We’ll get back to you shortly."
      });
    } catch (e) {
      setState({
        status: "error",
        message: e instanceof Error ? e.message : "Something went wrong."
      });
    }
  }

  return (
    <form
      className="card p-6"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(e.currentTarget);
      }}
      aria-label="Inquiry form"
    >
      <div className="mb-4">
        <p className="text-base font-semibold text-ink-950">Contact us</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-ink-900">
          Name
          <input
            name="name"
            required
            className="h-11 rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none ring-0 placeholder:text-ink-400 focus:border-ink-400"
            placeholder="Your name"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-ink-900">
          Email
          <input
            name="email"
            type="email"
            required
            className="h-11 rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none placeholder:text-ink-400 focus:border-ink-400"
            placeholder="you@example.com"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-ink-900">
          Phone
          <input
            name="phone"
            required
            className="h-11 rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none placeholder:text-ink-400 focus:border-ink-400"
            placeholder="(555) 555-5555"
          />
        </label>
        <div className="hidden sm:block" />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <button
          type="submit"
          disabled={state.status === "submitting" || state.status === "success"}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-ink-950 px-5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {state.status === "submitting" ? "Sending…" : "Send inquiry"}
        </button>

        {state.status === "success" ? (
          <p className="text-sm text-ink-700">{state.message}</p>
        ) : state.status === "error" ? (
          <p className="text-sm text-red-700">{state.message}</p>
        ) : null}
      </div>
    </form>
  );
}
