import test from "node:test";
import assert from "node:assert/strict";
import { SAVED_KEY, readSavedIds, changeBookmark } from "./saves.mjs";

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
