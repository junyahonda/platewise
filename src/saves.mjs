export const SAVED_KEY = "platewise-osm-saved";
export function readSavedIds(storage) {
  try {
    const value = JSON.parse((storage ?? globalThis.localStorage).getItem(SAVED_KEY) || "[]");
    return Array.isArray(value) ? [...new Set(value.filter(id =>
      typeof id === "string" && /^(node|way|relation)-[1-9]\d{0,15}$/.test(id)))].slice(0, 12) : [];
  } catch { return null; }
}
export function changeBookmark(ids, id, save) {
  return save ? [...new Set([...ids, id])] : ids.filter(existing => existing !== id);
}
export function createSavedStore(storage) {
  let ids = readSavedIds(storage) ?? [];
  let persistent = true;
  return {
    read() {
      if (persistent) ids = readSavedIds(storage) ?? ids;
      return ids;
    },
    write(next) {
      ids = next;
      // Quota failures can block writes while deletion is still allowed.
      if (!persistent && ids.length) return false;
      try {
        const target = storage ?? globalThis.localStorage;
        if (ids.length) target.setItem(SAVED_KEY, JSON.stringify(ids));
        else target.removeItem(SAVED_KEY);
        persistent = true;
        return true;
      } catch {
        persistent = false;
        return false;
      }
    },
  };
}
