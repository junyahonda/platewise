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
test("plant-only saved listings cannot carry a stronger meat claim", () => {
  for (const tags of [
    { cuisine: "burger", "diet:vegan": "only" },
    { cuisine: "burger", "diet:meat": "no" },
    { name: "Vegan Burger" },
    { cuisine: "chicken;vegetarian" },
  ]) {
    const p = normalizePlace(place(tags));
    assert.equal(p.meat, false);
    assert.equal(p.meatConfidence, "excluded");
    assert.match(p.meatReason, /plant-only|no meat/);
  }
  assert.equal(normalizePlace(place({ cuisine: "" })).meatConfidence, "unknown");
});
test("value is a heuristic; no ratings, prices or portion evidence invented", () => {
  const p = normalizePlace(place());
  assert.equal(p.valueHint, true);
  assert.equal(p.rating, undefined);
  assert.equal(p.price, undefined);
  assert.equal(p.portion, undefined);
  assert.match(p.valueReason, /guess/);
});
test("value labels name mapped formats and strong meat clues outrank broad cuisine guesses", () => {
  const burger = place({ name: "Burger Kitchen", amenity: "fast_food", cuisine: "burger" }, { id: 1, lat: 37.778 });
  const sandwich = place({ name: "Juice & Sandwich", amenity: "fast_food", cuisine: "sandwich" }, { id: 2, lat: 37.771 });
  assert.deepEqual(selectPlaces([sandwich, burger], center, 2).map(p => p.id), ["node-1", "node-2"]);
  assert.equal(normalizePlace(burger).valueLabel, "Fast-food clue");
  assert.equal(normalizePlace(place({ amenity: "restaurant", buffet: "yes" })).valueLabel, "Buffet clue");
  assert.equal(normalizePlace(place({ amenity: "restaurant" })).valueLabel, "Casual-cuisine clue");
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
test("explicit no-takeaway overrides a fast-food format clue", () => {
  assert.equal(normalizePlace(place({ amenity: "fast_food", takeaway: "no" })).takeaway, false);
  assert.equal(normalizePlace(place({ amenity: "fast_food" })).takeaway, true);
  assert.equal(normalizePlace(place({ takeaway: "yes" })).takeaway, true);
  assert.equal(normalizePlace(place({ takeaway: "only" })).takeaway, true);
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
  assert.match(nearbyQuery(1, 2, 5), /nwr\(0\.954751,/);
  assert.match(nearbyQuery(1, 2, 5), /tags center 500/);
  assert.equal((nearbyQuery(0,179.99,5).match(/nwr\(/g)||[]).length,2);
  const q = savedQuery(["node-12", "way-34", "node-56"]);
  assert.match(q, /node\(id:12,56\)/);
  assert.match(q, /way\(id:34\)/);
  assert.match(q, /tags center 12/);
});
test("unknown menus remain available when filters are cleared without claiming meat", () => {
  const result = selectPlaces([place({ cuisine: "", name: "The Summit Corral" })], center, 2);
  assert.equal(result.length, 1);
  assert.equal(result[0].meatConfidence, "unknown");
  assert.equal(result[0].meat, false);
  assert.equal(result[0].valueHint, false);
  assert.match(nearbyQuery(1, 2, 2), /cafe\|deli/);
});
test("Directions uses the explicit search origin rather than the external browser's location", () => {
  const url = new URL(normalizePlace(place(), center).mapsUrl);
  assert.equal(url.searchParams.get("origin"), "37.77,-122.42");
  assert.equal(url.searchParams.get("destination"), "37.775,-122.42");
  assert.equal(new URL(normalizePlace(place()).mapsUrl).searchParams.has("origin"), false);
});
test("formal cuisine overrides misleading fast-food value tags", () => {
  for (const tags of [{ cuisine: "steak_house" }, { name: "Bobby Van’s Steakhouse", cuisine: "burger" }]) {
    const result = normalizePlace(place({ amenity: "fast_food", ...tags }));
    assert.equal(result.valueHint, false);
    assert.equal(result.valueLabel, "Value unknown");
  }
});
