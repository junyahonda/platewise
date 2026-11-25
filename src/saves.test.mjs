import test from "node:test";
import assert from "node:assert/strict";
import { SAVED_KEY, readSavedIds, changeBookmark, createSavedStore } from "./saves.mjs";

test("another tab's bookmark survives a change using the latest stored IDs", () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key) };
  data.set(SAVED_KEY, JSON.stringify(["node-1"]));
  const next = changeBookmark(readSavedIds(storage), "node-2", true);
  assert.deepEqual(next, ["node-1", "node-2"]);
  assert.deepEqual(changeBookmark(next, "node-2", true), next);
  assert.deepEqual(changeBookmark(next, "node-1", false), ["node-2"]);
});
test("stored IDs are validated and deduplicated; inaccessible storage permits a memory fallback", () => {
  assert.deepEqual(readSavedIds({ getItem: () => '["node-1","node-1","invalid"]' }), ["node-1"]);
  assert.equal(readSavedIds({ getItem() { throw Error("blocked"); } }), null);
});
test("session-only saves and removals survive when reads succeed but writes fail", () => {
  const store = createSavedStore({
    getItem: () => '["node-1"]',
    setItem() { throw Error("quota"); },
    removeItem() { throw Error("blocked"); },
  });
  assert.equal(store.write(changeBookmark(store.read(), "node-2", true)), false);
  store.write(changeBookmark(store.read(), "node-3", true));
  assert.deepEqual(store.read(), ["node-1", "node-2", "node-3"]);
  store.write(changeBookmark(store.read(), "node-1", false));
  assert.deepEqual(store.read(), ["node-2", "node-3"]);
  store.write([]);
  assert.deepEqual(store.read(), []);
});
test("clear removes old persistent saves even after a quota failure", () => {
  const data = new Map([[SAVED_KEY, '["node-1"]']]);
  const storage = { getItem: key => data.get(key), setItem() { throw Error("quota"); }, removeItem: key => data.delete(key) };
  const store = createSavedStore(storage);
  assert.equal(store.write(["node-1", "node-2"]), false);
  assert.equal(store.write([]), true);
  assert.deepEqual(createSavedStore(storage).read(), []);
});
