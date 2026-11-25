# Platewise

A phone-first **static** restaurant finder using OpenStreetMap, React, and Vite.
No API key, application server, database, or data-provider account is needed.

## Run

Node 22+: `npm ci && npm run build && npm start`

Open port 3000. `npm start` only serves the built static files; no API routes.
Use `npm run dev` for hot reloading. Deploy the `dist/` folder anywhere static.
“Find food near me” requests location; “Explore San Francisco” searches a labeled
example location using real data. Searches start at 2 km; wider areas can be slow.
If GPS is denied, the manual form accepts coordinates from a map pin. City/ZIP
geocoding and an in-app map are not included; search-area links open OpenStreetMap.

## Honest clues

OpenStreetMap has **no diner reviews, reliable prices, or portion measurements**.
The owner chose this no-key source with that tradeoff.

- **Meat indicated:** meat-specific cuisine, name, or dietary map tags.
- **Meat likely:** cuisines that commonly include meat; menus are unverified.
- **Menu unknown:** other mapped food listings appear when filters allow them;
  they are not meat recommendations. Clear filters to inspect sparse-area listings.
- Mapped vegetarian-only/vegan-only places and `diet:meat=no` are excluded;
  vegetarian options alone do not exclude a place.
- **Value guess:** fast-food/food-court/buffet formats or selected casual cuisines.
  This is not restaurant-specific evidence of price, portion size, or quality.
  Steakhouse/fine-dining clues suppress format-based value guesses.
- Mapped hours are not live opening status. Food art is illustrative, not photos.

One search checks up to 500 named food places and shortlists up to 40 compatible
places, deduplicating nearby same-name nodes/buildings. Coverage is not complete,
especially in dense areas. Distances are straight-line, not travel distances.
Queries include mapped delis and cafes; an unmapped business cannot be found.
Directions use the last search coordinates as origin, explicitly labeled in the UI.
The selected radius is a draft until Search; results label the last successful
radius. Editing it cancels a pending search. Failures keep the previous shortlist.

## Provider and privacy

The browser POSTs directly to [VK Maps Overpass](https://maps.mail.ru/osm/tools/overpass/api/interpreter).
Its [listed public-use policy](https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances)
permits projects without a key; CORS is supported. This suits small personal use,
not high volume. A gateway timeout (HTTP 504) retries once after 1.5 seconds,
using the same query and radius; Cancel/navigation also stop the retry wait.
Each attempt has a 32-second deadline, so two attempts can take about 66 seconds.
Other errors, including rate limits, do not retry automatically. No parallel
queries, retry loops, background polling, or bulk collection.
Polite per-tab limits: 20 requests/15 minutes, 100/day, and a
30-second cooldown after provider rate limiting. These are not security controls.
`VITE_OVERPASS_URL` can select another public endpoint at build time; never put
keys in `VITE_` variables, since their values are visible in browser code.

No coordinates are persisted or sent to a Platewise server. The map provider
receives the browser’s query, IP, and site origin and may retain request data.
Hosting processes normal site requests. Only up to 12 saved OSM IDs persist in
browser localStorage. Saved reuses in-memory listings during this visit and has
an explicit refresh action; Discover filters never hide bookmarks. No analytics or
advertising trackers. Data is **© OpenStreetMap contributors, ODbL**, with source
links and attribution on every screen. Google Maps directions need no API key.
Fonts are self-hosted with included OFL licenses.
Tab links survive refresh and browser Back/Forward. Search coordinates/results
are deliberately not persisted, so a full reload starts a new search session.
Failed/cancelled provider attempts and the single 504 retry count toward request limits too, because they
may already have reached the public service. Limit errors state the retry window.

## GitHub Pages

The public repository is `junyahonda/platewise`. The Pages workflow tests, builds,
and deploys `dist/` from `main`. In **Settings → Pages**, choose **GitHub Actions**
and custom domain **food.junyahonda.com**. Actions uses that setting, not CNAME.
`public/CNAME` also records the intended domain.

After setting the domain in GitHub, add one record at GoDaddy or Namecheap:

| Type | Host / Name | Target / Value | TTL |
| --- | --- | --- | --- |
| CNAME | food | junyahonda.github.io | Default / Automatic |

No `https://` or `/platewise` in the target. Replace conflicts only for `food`;
leave root, email, and other records alone. DNS and GitHub’s free certificate can
take up to 24 hours. Enable **Enforce HTTPS** when the certificate is available.
Device location requires HTTPS except on localhost. Vite’s `/` base assumes the
custom domain, not a `/platewise/` project path.

## Android home screen

In Android Chrome, choose **⋮ → Add to Home screen / Install app**. The manifest
has standalone display and 192/512 PNG icons. The in-app install action uses the
browser prompt when available, otherwise it shows menu instructions. Search needs
internet; no offline use is promised. Verify installation on a physical phone.

The temporary Devin preview requires sign-in and its managing session remaining
available. GitHub Pages is public and independent of the preview session.

## Checks

`npm test && npm run build`

Tests cover map normalization, meat confidence, exclusions, honest value clues,
distance/radius filtering, deduplication, bounded queries, direct provider calls,
input validation, cooldown/recovery, network failures, and timeouts.
