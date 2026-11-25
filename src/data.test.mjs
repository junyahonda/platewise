import test from "node:test";
import assert from "node:assert/strict";
import { createMapClient, OVERPASS_URL } from "./data.mjs";

const location = { latitude: 37.76, longitude: -122.42, radius: 2 };
const element = { type: "node", id: 42, lat: 37.761, lon: -122.42,
  tags: { name: "Test Burgers", amenity: "fast_food", cuisine: "burger" } };
const json = body => new Response(JSON.stringify(body));

test("static search calls the external provider directly and normalizes real-shaped data", async () => {
  let request;
  const client = createMapClient({ fetchImpl: async (...args) => {
    request = args; return json({ elements: [element] });
  }});
  const result = await client.searchNearby(location);
  assert.equal(request[0], OVERPASS_URL);
  assert.equal(request[1].credentials, "omit");
  assert.equal(request[1].method, "POST");
  assert.match(request[1].body.get("data"), /nwr\(/);
  assert.equal(result.places[0].name, "Test Burgers");
  assert.equal(result.scanned, 1);
});

test("invalid input and empty saves never contact the free provider", async () => {
  let calls = 0;
  const client = createMapClient({ fetchImpl: async () => { calls++; return json({ elements: [] }); }});
  await assert.rejects(client.searchNearby({ ...location, latitude: Infinity }), /valid location/);
  await assert.rejects(client.searchNearby({ ...location, longitude: 181 }), /valid location/);
  await assert.rejects(client.searchNearby({ ...location, radius: "2" }), /valid location/);
  await assert.rejects(client.fetchSaved(["node-1);out;"]), /valid saved/);
  assert.deepEqual(await client.fetchSaved([]), { places: [] });
  assert.equal(calls, 0);
});

test("saved lookup batches and deduplicates IDs without a backend", async () => {
  let query;
  const client = createMapClient({ fetchImpl: async (_url, options) => {
    query = options.body.get("data"); return json({ elements: [element] });
  }});
  const result = await client.fetchSaved(["node-42", "node-42", "way-12"]);
  assert.match(query, /node\(id:42\)/);
  assert.match(query, /way\(id:12\)/);
  assert.equal(result.places[0].id, "node-42");
});

test("rate limiting imposes cooldown and recovers without automatic retries", async () => {
  let time = Date.now(), calls = 0;
  const client = createMapClient({ now: () => time, fetchImpl: async () => {
    calls++; return calls === 1 ? new Response("busy", { status: 429 }) : json({ elements: [] });
  }});
  await assert.rejects(client.searchNearby(location), /busy/);
  await assert.rejects(client.searchNearby(location), /30 seconds/);
  assert.equal(calls, 1);
  time += 30001;
  assert.deepEqual((await client.searchNearby(location)).places, []);
  assert.equal(calls, 2);
});

test("saved listings get distances only when an explicit search center exists", async () => {
  const client = createMapClient({ fetchImpl: async () => json({ elements: [element] }) });
  assert.equal((await client.fetchSaved(["node-42"])).places[0].distance, null);
  const saved = await client.fetchSaved(["node-42"], location);
  assert.ok(saved.places[0].distance > 0 && saved.places[0].distance < 0.2);
});

test("deleted saved listings are returned as removable missing IDs", async () => {
  const client = createMapClient({ fetchImpl: async () => json({ elements: [element] }) });
  const saved = await client.fetchSaved(["node-42", "node-99"]);
  assert.deepEqual(saved.missingIds, ["node-99"]);
  assert.equal(saved.places[0].id, "node-42");
});

test("network, malformed responses, and provider query failures have readable errors", async () => {
  for (const [fetchImpl, message] of [
    [async () => { throw new TypeError("Failed to fetch"); }, /connection/],
    [async () => new Response("<html>gateway error</html>"), /unreadable/],
    [async () => json({}), /incomplete/],
    [async () => json({ remark: "timeout", elements: [] }), /smaller search radius/],
  ]) await assert.rejects(createMapClient({ fetchImpl }).searchNearby(location), message);
});

test("concurrent requests are rejected and timeout releases the client", async () => {
  const client = createMapClient({ timeoutMs: 5, fetchImpl: (_url, { signal }) =>
    new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true })) });
  const first = client.searchNearby(location);
  await assert.rejects(client.searchNearby(location), /still running/);
  await assert.rejects(first, /didn’t respond in time/);
  await assert.rejects(client.searchNearby(location), /didn’t respond in time/);
});
test("cancel frees the client for navigation and old cleanup cannot release a newer request", async () => {
  let calls = 0;
  const client = createMapClient({ fetchImpl: (_url, { signal }) => {
    calls++;
    if (calls > 1) return Promise.resolve(json({ elements: [element] }));
    return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
  }});
  const first = client.searchNearby(location);
  client.cancel();
  const second = client.searchNearby(location);
  await assert.rejects(first, /cancelled/);
  assert.equal((await second).places.length, 1);
});
test("gateway timeouts and request caps explain the cause and recovery", async () => {
  await assert.rejects(createMapClient({ fetchImpl: async () => new Response("timeout", { status: 504 }) }).searchNearby(location), /timed out.*504.*smaller radius/);
  let time = Date.now();
  const client = createMapClient({ now: () => time, fetchImpl: async () => json({ elements: [] }) });
  for (let i = 0; i < 20; i++) await client.searchNearby(location);
  await assert.rejects(client.searchNearby(location), /15 minutes/);
  time += 15 * 60000;
  assert.equal((await client.searchNearby(location)).places.length, 0);
});
