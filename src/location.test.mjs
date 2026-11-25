import test from "node:test";
import assert from "node:assert/strict";
import { currentLocation } from "./location.mjs";

test("location settles even when the browser never calls either callback", async () => {
  let lateSuccess;
  const result = currentLocation({ geolocation: { getCurrentPosition(success) { lateSuccess = success; } }, timeoutMs: 5 });
  await assert.rejects(result, /took too long.*San Francisco/);
  lateSuccess({ coords: { latitude: 1, longitude: 2 } });
  await assert.rejects(result, /took too long/);
});
test("location success and permission denial settle immediately", async () => {
  const coords = { latitude: 1, longitude: 2 };
  assert.equal(await currentLocation({ geolocation: { getCurrentPosition(success) { success({ coords }); } } }), coords);
  await assert.rejects(currentLocation({ geolocation: { getCurrentPosition(_, failure) { failure({ code: 1 }); } } }), /Location is off/);
});
