import test from "node:test";
import assert from "node:assert/strict";
import {
  distanceKm,
  normalizePlace,
  selectPlaces,
  nearbyQuery,
  savedQuery,
} from "./places.mjs";
const center = { latitude: 37.77, longitude: -122.42 };
const place = (tags = {}, extra = {}) => ({
  id: 123,
  type: "node",
  lat: 37.775,
  lon: -122.42,
  tags: {
    name: "Test kitchen",
    amenity: "restaurant",
    cuisine: "chicken",
    ...tags,
  },
  ...extra,
});
test("distance is accurate, symmetric and handles antipodes", () => {
  assert.equal(distanceKm(center, center), 0);
  const p = { latitude: 38.77, longitude: -122.42 };
  assert.ok(Math.abs(distanceKm(center, p) - 111.195) < 0.01);
  assert.equal(distanceKm(center, p), distanceKm(p, center));
  assert.ok(
    Number.isFinite(
      distanceKm(
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 180 },
      ),
    ),
  );
});
test("meat-specific and mixed cuisines have distinct confidence", () => {
  assert.equal(normalizePlace(place()).meatConfidence, "indicated");
  const mixed = normalizePlace(place({ cuisine: "vietnamese" }));
  assert.equal(mixed.meat, true);
  assert.equal(mixed.meatConfidence, "likely");
});
test("vegetarian options do not exclude meat, but vegetarian-only does", () => {
  assert.equal(normalizePlace(place({ "diet:vegetarian": "yes" })).meat, true);
  for (const tags of [
    { "diet:vegetarian": "only" },
    { "diet:vegan": "only" },
    { "diet:meat": "no" },
    { name: "Vegan chicken kitchen" },
    { cuisine: "vegetarian" },
  ])
    assert.equal(normalizePlace(place(tags)).meat, false);
});
test("missing cuisine is unknown, not a meat claim", () =>
  assert.equal(normalizePlace(place({ cuisine: "" })).meat, false));
test("value is a heuristic; no ratings, prices or portion evidence invented", () => {
  const p = normalizePlace(place());
  assert.equal(p.valueHint, true);
  assert.equal(p.rating, undefined);
  assert.equal(p.price, undefined);
  assert.equal(p.portion, undefined);
  assert.match(p.valueReason, /guess/);
});
test("way and relation center coordinates work", () => {
  const p = normalizePlace(
    place(
      {},
      {
        type: "way",
        lat: undefined,
        lon: undefined,
        center: { lat: 37.775, lon: -122.42 },
      },
    ),
    center,
  );
  assert.ok(p.distance > 0);
  assert.equal(p.id, "way-123");
});
test("shortlist excludes distant, closed and plant-only places", () =>
  assert.equal(
    selectPlaces(
      [
        place({}, { lat: 38 }),
        place({ "disused:amenity": "restaurant" }),
        place({ "diet:vegan": "only" }),
      ],
      center,
      5,
    ).length,
    0,
  ));
test("duplicate nodes and buildings within 60m appear once", () =>
  assert.equal(
    selectPlaces(
      [place(), place({}, { id: 124, type: "way", lat: 37.7751 })],
      center,
      5,
    ).length,
    1,
  ));
test("casual format clues rank first; distance breaks ties", () => {
  const p = selectPlaces(
    [
      place({}, { id: 1 }),
      place({ amenity: "fast_food" }, { id: 2, lat: 37.78 }),
    ],
    center,
    5,
  );
  assert.equal(p[0].id, "node-2");
});
test("nearby and saved queries are bounded and batched", () => {
  assert.match(nearbyQuery(1, 2, 5), /around:5000,1,2/);
  assert.match(nearbyQuery(1, 2, 5), /tags 500/);
  const q = savedQuery(["node-12", "way-34", "node-56"]);
  assert.match(q, /node\(id:12,56\)/);
  assert.match(q, /way\(id:34\)/);
  assert.match(q, /tags 12/);
});
