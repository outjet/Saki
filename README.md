# Saki — Property Listing Demo

Modern single-property / portfolio listing site built with Next.js + Tailwind and **folder-based content** (easy updates without touching code).

## Quickstart

1. Install deps: `npm install`
2. Run dev: `npm run dev`
3. Open: http://localhost:3000
4. Owner panel: http://localhost:3000/owner

## Deploy

This app uses Next.js server routes (for `/owner` and admin APIs), so it must be deployed with **Firebase App Hosting** (or another server runtime). Firebase Hosting (static `out/`) is not used for SSR.

### Firebase App Hosting (recommended)

1. Firebase Console → **App Hosting** → **Get started**
2. Connect your GitHub repo and choose a branch (e.g. `main`)
3. Add environment variables:
   - `OWNER_EMAIL_ALLOWLIST`
   - `NEXT_PUBLIC_FIREBASE_*` (client config)
   - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (optional)
4. Deploy. App Hosting will build and run Next.js with SSR.

### Custom domain

In Firebase Console → App Hosting → Domains, add `emmons.casa` (and `www` if desired) and follow the DNS instructions.

## Content model (owner-friendly)

Each property is a folder:

- `content/properties/<slug>/property.json` — all text + structured fields
- `public/listings/<slug>/hero/` — optional hero carousel images (jpg/png/webp/svg)
- `public/listings/<slug>/photos/` — drop photos here (jpg/png/webp/svg)
- `public/listings/<slug>/floorplans/` — optional
- `public/listings/<slug>/docs/` — optional PDFs/brochures

If `property.json` omits `hero`, `photos`, `floorplans`, or `documents`, the site will auto-discover files from those folders.

## Inquiry handling

The inquiry form posts to `POST /api/inquire` and currently logs submissions on the server.
Wire it to email/SMS by updating `src/app/api/inquire/route.ts`.

In static hosting, `/api/inquire` won’t exist. Set `NEXT_PUBLIC_INQUIRY_ENDPOINT` to a webhook / Firebase Function URL (or swap the form to a provider).

## Google Maps

To render the full-width Google Map section, set:

- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in `.env.local`

## Owner Auth + Live Content (Firebase)

The `/owner` page can save listing content to **Firestore** and upload media to **Firebase Storage**.

### Environment variables

Client (public):

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` (optional)
- `NEXT_PUBLIC_FIREBASE_APP_ID` (optional)

Server (private):

- `OWNER_EMAIL_ALLOWLIST` (comma-separated emails that can manage `/owner`)
- Local dev: set `GOOGLE_APPLICATION_CREDENTIALS` to a downloaded service account key JSON file, **or** set `FIREBASE_SERVICE_ACCOUNT` to the JSON string.

### Data storage

- Firestore: `properties/<slug>` (same shape as `property.json`, plus metadata)
- Storage: `listings/<slug>/{hero,photos,floorplans,docs}/...`
