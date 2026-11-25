import test from "node:test";
import assert from "node:assert/strict";
import { setImmediate as nextTurn } from "node:timers/promises";
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
  await assert.rejects(createMapClient({ retryDelayMs: 0, fetchImpl: async () => new Response("timeout", { status: 504 }) }).searchNearby(location), /timed out.*504.*smaller radius/);
  let time = Date.now();
  const client = createMapClient({ now: () => time, fetchImpl: async () => json({ elements: [] }) });
  for (let i = 0; i < 20; i++) await client.searchNearby(location);
  await assert.rejects(client.searchNearby(location), /15 minutes/);
  time += 15 * 60000;
  assert.equal((await client.searchNearby(location)).places.length, 0);
});

test("one transient 504 retries the identical query after a delay", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const requests = [];
  const client = createMapClient({ fetchImpl: async (_url, options) => {
    requests.push(options);
    return requests.length === 1 ? new Response("timeout", { status: 504 }) : json({ elements: [element] });
  }});
  const result = client.searchNearby(location);
  await nextTurn();
  assert.equal(requests.length, 1);
  t.mock.timers.tick(1499);
  await nextTurn();
  assert.equal(requests.length, 1);
  t.mock.timers.tick(1);
  assert.equal((await result).places[0].id, "node-42");
  assert.equal(requests.length, 2);
  assert.equal(requests[0].body.get("data"), requests[1].body.get("data"));
  assert.equal(requests[0].signal, requests[1].signal);
});

test("persistent 504 stops after two attempts and releases the client for manual retry", async () => {
  let calls = 0;
  const client = createMapClient({ retryDelayMs: 0, fetchImpl: async () => {
    calls++;
    return calls <= 2 ? new Response("timeout", { status: 504 }) : json({ elements: [element] });
  }});
  await assert.rejects(client.searchNearby(location), /timed out.*504/);
  assert.equal(calls, 2);
  assert.equal((await client.searchNearby(location)).places.length, 1);
  assert.equal(calls, 3);
});

test("other HTTP failures never trigger automatic retries", async () => {
  for (const status of [400, 403, 406, 429, 500, 503]) {
    let calls = 0;
    const client = createMapClient({ retryDelayMs: 0, fetchImpl: async () => {
      calls++;
      return new Response("error", { status });
    }});
    await assert.rejects(client.searchNearby(location), /busy|unavailable/);
    assert.equal(calls, 1, `HTTP ${status}`);
  }
});

test("Cancel during the retry wait prevents stale retries and preserves a newer request's lock", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0, finishNewRequest;
  const client = createMapClient({ fetchImpl: async () => {
    calls++;
    if (calls === 1) return new Response("timeout", { status: 504 });
    return new Promise(resolve => { finishNewRequest = resolve; });
  }});
  const first = client.searchNearby(location);
  await nextTurn();
  await assert.rejects(client.searchNearby(location), /still running/);
  client.cancel();
  const second = client.searchNearby(location);
  await assert.rejects(first, /cancelled/);
  await assert.rejects(client.searchNearby(location), /still running/);
  t.mock.timers.tick(2000);
  await nextTurn();
  assert.equal(calls, 2);
  finishNewRequest(json({ elements: [element] }));
  assert.equal((await second).places.length, 1);
});

test("Cancel also aborts an in-flight retry and allows a fresh search", async () => {
  let calls = 0;
  const retryStarted = Promise.withResolvers();
  const client = createMapClient({ retryDelayMs: 0, fetchImpl: async (_url, { signal }) => {
    calls++;
    if (calls === 1) return new Response("timeout", { status: 504 });
    if (calls === 2) {
      retryStarted.resolve();
      return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
    }
    return json({ elements: [element] });
  }});
  const result = client.searchNearby(location);
  await retryStarted.promise;
  client.cancel();
  await assert.rejects(result, /cancelled/);
  assert.equal((await client.searchNearby(location)).places.length, 1);
  assert.equal(calls, 3);
});

test("the retry has its own timeout and releases the client afterward", async () => {
  let calls = 0;
  const client = createMapClient({ retryDelayMs: 0, timeoutMs: 5, fetchImpl: async (_url, { signal }) => {
    calls++;
    if (calls === 1) return new Response("timeout", { status: 504 });
    if (calls === 2) return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
    return json({ elements: [] });
  }});
  await assert.rejects(client.searchNearby(location), /didn’t respond in time/);
  assert.equal(calls, 2);
  await client.searchNearby(location);
  assert.equal(calls, 3);
});

test("automatic retries count toward request caps and cannot bypass the last slot", async () => {
  for (const successes of [18, 19]) {
    let calls = 0, time = Date.now();
    const client = createMapClient({ retryDelayMs: 0, now: () => time, fetchImpl: async () => {
      calls++;
      return calls > successes ? new Response("timeout", { status: 504 }) : json({ elements: [] });
    }});
    for (let i = 0; i < successes; i++) await client.searchNearby(location);
    await assert.rejects(client.searchNearby(location), successes === 18 ? /504/ : /15 minutes/);
    assert.equal(calls, 20);
    await assert.rejects(client.searchNearby(location), /15 minutes/);
    assert.equal(calls, 20);
    time += 15 * 60000;
    await assert.rejects(client.searchNearby(location), /504/);
    assert.equal(calls, 22);
  }
});

test("saved-place refresh also recovers from a transient gateway timeout", async () => {
  let calls = 0;
  const client = createMapClient({ retryDelayMs: 0, fetchImpl: async () => {
    calls++;
    return calls === 1 ? new Response("timeout", { status: 504 }) : json({ elements: [element] });
  }});
  assert.equal((await client.fetchSaved(["node-42"])).places[0].id, "node-42");
  assert.equal(calls, 2);
});
