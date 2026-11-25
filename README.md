# Platewise

A phone-first personal restaurant finder. React + Vite, a small Express backend, and Google Places API (New). Built for Android Chrome and home-screen use.

## Run

Use Node 22 or newer:

```sh
npm ci
cp .env.example .env
# Fill GOOGLE_PLACES_API_KEY in .env to enable live search.
npm run build
npm start
```

Open port 3000. Without a key, the UI offers explicitly fictional sample places; clicking live search explains the setup requirement. No sample is presented as a nearby recommendation. For development, run `npm start` for the API and `npm run dev` for Vite in another terminal.

## Google setup

Enable **Places API (New)** and billing on the key’s Google Cloud project. Use a server-side key restricted to Places API, not an HTTP-referrer-restricted browser key. Set Google Cloud API quotas as a hard billing safeguard. Do not put secrets in `VITE_` variables or commit `.env`.

One explicit nearby search makes one Text Search request for up to 20 places. The field mask includes reviews and opening hours, which may use a higher-priced Google SKU; consult Google’s current pricing before enabling. Saved refreshes make one Place Details request per saved ID, up to 12. No background polling, autocomplete, or photo requests. An in-memory global daily request cap (default 100) and API burst limit provide additional protection, not a persistent billing guarantee. Restarting resets the cap; configure a provider-side quota too.

## Honest recommendations

Google does not offer a reliable portions-per-dollar field. Platewise shows source evidence, not an invented numerical score:

- Meat-specific restaurant types, name clues, or positive review mentions establish a **meat clue**, never a verified current menu.
- Positive review sentences mentioning generous portions rank first, then value mentions.
- Restaurants with a known lower price level and at least a 4.0 rating may also appear, explicitly labeled as lower-price clues rather than verified big portions.
- Matching is conservative English keyword matching. Negative or ambiguous sentences are excluded, but keywords are imperfect. Google returns a limited review sample, so results are not comprehensive.
- Location-biased results are filtered by straight-line distance to the selected radius. No claim about travel distance is made.

Google content and coordinates are not persisted or cached by the application. Only saved place IDs are stored in browser localStorage, as permitted by Google’s place-ID exception. A saved view fetches fresh content. Reviews display author attribution and available links; source information is labeled Google Maps. Policy and Google terms links are available from every screen’s footer.

## Install and hosting

Deploy with `npm run build` and `npm start` behind HTTPS. The manifest contains standalone display, names, start URL, and 192/512 PNG icons, including a maskable icon. In Android Chrome, choose **⋮ → Add to Home screen / Install app**. An in-app prompt is used only if Chrome emits `beforeinstallprompt`; instructions are always available.

Devin Apps authenticates access and blocks service worker scripts, so this build intentionally does not register a service worker or promise offline use. Modern Chrome supports menu installation without a service worker, but the exact install UI must be checked on the owner’s phone. A Devin sign-in and network connection remain necessary. The app depends on its managing session remaining available; archiving the session takes it offline.

For another host, deploy this same server behind HTTPS, set the environment key, and ensure POST bodies containing locations are not logged. No database is needed. Preferences and provider normalization are isolated for later extension.

## Checks

```sh
npm test
npm run build
```

Tests cover distance filtering, ranking and false-positive evidence exclusions. The server validates coordinates and radii, rate-limits requests, keeps the API key server-side, sets no-store on API responses, and uses a restrictive CSP.
