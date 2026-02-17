import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page py-16">
      <div className="card p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Not found</h1>
        <p className="mt-2 text-ink-700">That page doesn’t exist.</p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-ink-950 px-4 py-2 text-sm font-medium text-white"
        >
          Back to listings
        </Link>
      </div>
    </div>
  );
}

