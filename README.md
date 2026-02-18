# Saki — Property Listing Demo

Modern single-property / portfolio listing site built with Next.js + Tailwind and Firestore/Storage-backed owner management.

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
3. Configure environment variables for your target runtime.
   - For local development, copy `.env.example` to `.env.local` and fill values.
   - For App Hosting, set `FIREBASE_WEB_CONFIG_JSON` in `apphosting.yaml` to your Firebase web app config JSON.
4. Deploy. App Hosting will build and run Next.js with SSR.

### Custom domain

In Firebase Console → App Hosting → Domains, add `emmons.casa` (and `www` if desired) and follow the DNS instructions.

## Content model (owner-friendly)

Listing content is managed from `/owner` and stored in Firebase:

- Firestore document: `properties/<slug>` for listing fields and media order
- Storage objects: `listings/<slug>/{hero,photos,floorplans,backgrounds,contactvideo,docs}/...`

Local `content/properties/<slug>/property.json` remains a fallback seed for development.

## Inquiry handling

The contact form posts directly to Formspree using AJAX.

Set:

- `NEXT_PUBLIC_FORMSPREE_ENDPOINT` (example: `https://formspree.io/f/mykdpdkz`)

## Google Maps

To render the full-width Google Map section, set:

- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in `.env.local`

## Analytics

To enable Google Analytics (GA4), set:

- `NEXT_PUBLIC_GA_MEASUREMENT_ID` (example: `G-XXXXXXXX`)

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
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- `NEXT_PUBLIC_FORMSPREE_ENDPOINT`
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`
- `FIREBASE_WEB_CONFIG_JSON` (recommended on Firebase App Hosting; JSON containing the same fields above)

Server (private):

- `OWNER_EMAIL_ALLOWLIST` (comma-separated emails that can manage `/owner`)
- Local dev: set `GOOGLE_APPLICATION_CREDENTIALS` to a downloaded service account key JSON file, **or** set `FIREBASE_SERVICE_ACCOUNT` to the JSON string.

### Data storage

- Firestore: `properties/<slug>` (same shape as `property.json`, plus metadata)
- Storage: `listings/<slug>/{hero,photos,floorplans,backgrounds,contactvideo,docs}/...`
