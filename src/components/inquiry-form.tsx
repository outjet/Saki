"use client";

import { useState } from "react";

type FormState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export function InquiryForm({ propertySlug }: { propertySlug: string }) {
  const [state, setState] = useState<FormState>({ status: "idle" });

  async function submit(formData: FormData) {
    setState({ status: "submitting" });
    try {
      const endpoint =
        process.env.NEXT_PUBLIC_INQUIRY_ENDPOINT?.trim() || "/api/inquire";

      const payload = {
        propertySlug,
        name: String(formData.get("name") ?? ""),
        email: String(formData.get("email") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        message: String(formData.get("message") ?? "")
      };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Submission failed");
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
        void submit(new FormData(e.currentTarget));
      }}
      aria-label="Inquiry form"
    >
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
          Phone (optional)
          <input
            name="phone"
            className="h-11 rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none placeholder:text-ink-400 focus:border-ink-400"
            placeholder="(555) 555-5555"
          />
        </label>
        <div className="hidden sm:block" />
        <label className="grid gap-2 text-sm font-medium text-ink-900 sm:col-span-2">
          Message
          <textarea
            name="message"
            rows={4}
            className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none placeholder:text-ink-400 focus:border-ink-400"
            placeholder="I’d like to schedule a showing…"
          />
        </label>
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
        ) : (
          <p className="text-sm text-ink-600">
            Submissions are logged server-side in this demo.
          </p>
        )}
      </div>
    </form>
  );
}
