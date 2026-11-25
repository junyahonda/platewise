# Platewise

A phone-first personal restaurant finder using **OpenStreetMap**, with no API key or account needed for restaurant data. React + Vite and a small Express server. No database required.

## Run

Node 22 or newer:

```sh
npm ci
npm run build
npm start
```

The production server listens on port 3000, configurable with `PORT`. Optional settings are in `.env.example`; copy to `.env` only if needed. For development, run `npm start` for the API and `npm run dev` for Vite in another terminal.

Tap **Find food near me** to request your phone’s current location. The secondary **Explore San Francisco** action makes a real live search around a clearly labeled example location, not fictional data.

## Honest value guesses

OpenStreetMap provides no diner reviews, reliable meal prices, or portion measurements. The owner chose this no-key alternative with that tradeoff.

- **Meat indicated:** meat-specific cuisine, restaurant name, or explicit dietary tags.
- **Meat likely:** broad cuisine tags that commonly include meat.
- Mapped vegetarian-only/vegan-only places and explicit `diet:meat=no` are excluded. Vegetarian options alone do not exclude a restaurant.
- **Value guess:** fast-food/food-court/buffet formats or a selected casual cuisine. Format clues rank first, then distance. This is not evidence about this restaurant’s actual prices, portions, or quality.
- The UI makes no claims about ratings, reviews, actual prices, known generous portions, or live opening status. Raw mapped hours are labeled as such.

Map tags can be missing or outdated. Menus must be checked. The search covers up to 500 named restaurant/fast-food/food-court elements and shortlists up to 40 meat-compatible places, deduplicating nearby same-name node/building pairs. The cap can omit places in dense areas; coverage is never presented as comprehensive. Distance is straight-line.

## Provider and privacy

Search uses one bounded Overpass query on [VK Maps’ public service](https://maps.mail.ru/osm/tools/overpass/api/interpreter), whose [listed usage policy](https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances) permits projects without a key. This is appropriate for a small personal app, not a high-volume service. No parallel queries, no automatic retry loops, no bulk collection, and no background polling. A global in-memory cap defaults to 100 requests/day and an API burst limit to 20/15 minutes. A 30-second cooldown follows upstream rate limiting. Free public infrastructure can be slow or unavailable; the UI reports that clearly. Larger usage should move to a dedicated provider by setting `OVERPASS_URL`.

Coordinates are sent in POST bodies and not logged or persisted by the application. The provider and host may retain technical request information. Only saved OSM element IDs are stored in browser localStorage; Saved refreshes them with one batched query (up to 12 IDs). API responses use `Cache-Control: no-store`. The application includes no analytics or advertising trackers.

Data is **© OpenStreetMap contributors, ODbL** with linked attribution on every screen and per-listing source links. External Google Maps directions use coordinates and require no API key. Food art is illustrative, never a photo of the restaurant.

## Android home screen and deployment

Build with `npm run build` and serve `npm start` behind HTTPS. The web manifest includes standalone display, names, start URL, and 192/512 PNG icons, including maskable artwork. In Android Chrome, choose **⋮ → Add to Home screen / Install app**. If Chrome offers `beforeinstallprompt`, the in-app install button uses it; otherwise it shows instructions.

Devin Apps requires Devin sign-in and blocks service workers, so no worker is registered and no offline functionality is promised. Modern Chrome supports menu installation without a service worker, but the exact install experience must be checked on the owner’s physical phone. The app depends on its managing session staying available; archiving or ending it takes the app offline.

## Checks

```sh
npm test
npm run build
```

Tests cover source normalization, explicit versus likely meat clues, plant-only exclusions, radius filtering, duplicate suppression, distance, no invented review/price/portion data, and bounded batched queries. CI runs both commands on Node 22. The API validates coordinates, radii, and saved IDs, has small JSON limits, rate limiting, provider timeouts, and a restrictive CSP. Fonts are self-hosted with included OFL licenses.
