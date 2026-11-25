import { nearbyQuery, savedQuery, normalizePlace, selectPlaces } from "./places.mjs";

export const OVERPASS_URL = import.meta.env?.VITE_OVERPASS_URL ||
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter";

// Requests go straight to the public map service: no key or application server.
// These polite per-tab limits are not a server-side security or billing control.
export function createMapClient({ fetchImpl = globalThis.fetch, now = Date.now,
  endpoint = OVERPASS_URL, timeoutMs = 32000 } = {}) {
  let busy = false, activeController = null, coolUntil = 0, day = "", count = 0, recent = [];
  async function overpass(query) {
    const time = now(), today = new Date(time).toISOString().slice(0, 10);
    if (day !== today) { day = today; count = 0; }
    recent = recent.filter(t => time - t < 15 * 60 * 1000);
    if (busy) throw Error("Another map request is still running. Cancel it or wait a moment.");
    if (time < coolUntil)
      throw Error(`The map service is busy. Retry in ${Math.ceil((coolUntil - time) / 1000)} seconds.`);
    if (count >= 100) throw Error("This tab has reached its daily request limit. Retry after midnight UTC. Cached saved places are still available.");
    if (recent.length >= 20)
      throw Error(`This tab has reached its short-term request limit. Retry in ${Math.max(1, Math.ceil((recent[0] + 15 * 60000 - time) / 60000))} minutes. Cached saved places are still available.`);
    busy = true; count++; recent.push(time);
    const controller = new AbortController();
    activeController = controller;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(endpoint, {
        method: "POST", mode: "cors", credentials: "omit", cache: "no-store",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        referrerPolicy: "strict-origin-when-cross-origin",
        body: new URLSearchParams({ data: query }), signal: controller.signal,
      });
      if (!response.ok) {
        if (response.status === 429 || response.status === 406) coolUntil = now() + 30000;
        if (response.status === 504) throw Error("The map service timed out (504). Retry or choose a smaller radius.");
        throw Error(response.status === 429 || response.status === 406
          ? "The map service is busy. Retry in 30 seconds."
          : `The map service is unavailable (${response.status}). Please retry later.`);
      }
      let data;
      try { data = await response.json(); }
      catch { throw Error("The map service returned an unreadable response. Please try again later."); }
      if (data.remark)
        throw Error("The map query could not finish. Try a smaller search radius.");
      if (!Array.isArray(data.elements))
        throw Error("The map service returned an incomplete response. Please try again later.");
      return data;
    } catch (error) {
      if (controller.signal.reason === "cancelled") throw Error("Search cancelled.");
      if (controller.signal.aborted)
        throw Error("The map service didn’t respond in time. Please try again or choose a smaller radius.");
      if (error instanceof TypeError)
        throw Error("We couldn’t reach the map service. Check your connection and try again.");
      throw error;
    } finally {
      clearTimeout(timer);
      if (activeController === controller) { activeController = null; busy = false; }
    }
  }
  return {
    cancel() {
      activeController?.abort("cancelled");
      activeController = null;
      busy = false;
    },
    async searchNearby({ latitude, longitude, radius = 2 } = {}) {
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
          Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || ![2, 5, 10, 20].includes(radius))
        throw Error("Please provide a valid location and search radius.");
      const result = await overpass(nearbyQuery(latitude, longitude, radius));
      return { places: selectPlaces(result.elements, { latitude, longitude }, radius),
        scanned: result.elements.length, updated: result.osm3s?.timestamp_osm_base || null };
    },
    async fetchSaved(ids, center) {
      if (!Array.isArray(ids) || ids.length > 12 || ids.some(id =>
        typeof id !== "string" || !/^(node|way|relation)-[1-9]\d{0,15}$/.test(id)))
        throw Error("Please provide up to 12 valid saved places.");
      if (!ids.length) return { places: [] };
      const result = await overpass(savedQuery([...new Set(ids)]));
      const places = result.elements.map(e => normalizePlace(e, center));
      return { places, missingIds: [...new Set(ids)].filter(id => !places.some(p => p.id === id)) };
    },
  };
}

export const { searchNearby, fetchSaved, cancel: cancelMapRequest } = createMapClient();
