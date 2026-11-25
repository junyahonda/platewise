const MEAT_CUISINES = new Set([
  "burger",
  "chicken",
  "fried_chicken",
  "barbecue",
  "bbq",
  "kebab",
  "shawarma",
  "steak_house",
  "steakhouse",
  "wings",
  "sausage",
  "hot_dog",
]);
const MIXED_CUISINES = new Set([
  "mexican",
  "tex-mex",
  "chinese",
  "thai",
  "vietnamese",
  "korean",
  "japanese",
  "indian",
  "turkish",
  "lebanese",
  "sandwich",
  "pizza",
  "american",
  "brazilian",
  "greek",
  "filipino",
  "peruvian",
  "ramen",
  "noodle",
  "noodles",
  "african",
  "ethiopian",
  "caribbean",
  "pakistani",
  "tacos",
  "burrito",
  "deli",
]);
const CASUAL_CUISINES = new Set([
  "burger",
  "chicken",
  "fried_chicken",
  "kebab",
  "shawarma",
  "sandwich",
  "pizza",
  "mexican",
  "tex-mex",
  "chinese",
  "vietnamese",
  "noodle",
  "noodles",
  "ramen",
  "tacos",
  "burrito",
  "deli",
  "hot_dog",
]);
const meatName =
  /\b(chicken|beef|pork|steak|brisket|ribs|lamb|carnitas|shawarma|kebab|burger|barbecue|bbq|wings|taqueria)\b/i;
const plantName = /\b(vegan|vegetarian|plant[- ]based|meatless)\b/i;
export function distanceKm(a, b) {
  const rad = Math.PI / 180,
    dLat = (b.latitude - a.latitude) * rad,
    dLon = (b.longitude - a.longitude) * rad;
  const value = Math.min(
    1,
    Math.max(
      0,
      Math.sin(dLat / 2) ** 2 +
        Math.cos(a.latitude * rad) *
          Math.cos(b.latitude * rad) *
          Math.sin(dLon / 2) ** 2,
    ),
  );
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}
export function directionsUrl(location, center) {
  if (!location) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}${center ? `&origin=${center.latitude},${center.longitude}` : ""}`;
}
export function normalizePlace(element, center) {
  const tags = element.tags || {},
    latitude = element.lat ?? element.center?.lat,
    longitude = element.lon ?? element.center?.lon;
  const cuisines = (tags.cuisine || "")
    .toLowerCase()
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const name = tags.name || tags["name:en"] || "";
  const plantOnly =
    tags["diet:vegan"] === "only" ||
    tags["diet:vegetarian"] === "only" ||
    tags["diet:meat"] === "no" ||
    plantName.test(name) ||
    cuisines.some((c) => ["vegan", "vegetarian"].includes(c));
  const explicit =
    tags["diet:meat"] === "yes" ||
    cuisines.some((c) => MEAT_CUISINES.has(c)) ||
    meatName.test(name);
  const likely = cuisines.some((c) => MIXED_CUISINES.has(c));
  const casual =
    tags.amenity === "fast_food" ||
    tags.amenity === "food_court" ||
    tags.buffet === "yes" ||
    tags.all_you_can_eat === "yes";
  // Contradictory format tags must not turn a steakhouse into a value recommendation.
  const formal = cuisines.some(c => ["steak_house", "steakhouse", "fine_dining"].includes(c)) || /\b(steakhouse|steak house|fine dining)\b/i.test(name);
  const valueHint = !formal && (casual || cuisines.some((c) => CASUAL_CUISINES.has(c)));
  const format = !valueHint ? null : tags.amenity === "fast_food" ? "Fast-food" : tags.amenity === "food_court" ? "Food-court" : casual ? "Buffet" : null;
  const location =
    Number.isFinite(latitude) && Number.isFinite(longitude)
      ? { latitude, longitude }
      : null;
  return {
    id: `${element.type}-${element.id}`,
    name,
    category: cuisines.length
      ? cuisines.map((c) => c.replaceAll("_", " ")).join(" · ")
      : (tags.amenity || "restaurant").replaceAll("_", " "),
    location,
    distance: center && location ? distanceKm(center, location) : null,
    address:
      [
        [tags["addr:housenumber"], tags["addr:street"]]
          .filter(Boolean)
          .join(" "),
        tags["addr:city"],
      ]
        .filter(Boolean)
        .join(", ") || "Street address not mapped",
    meat: !plantOnly && (explicit || likely),
    meatConfidence: plantOnly ? "excluded" : explicit ? "indicated" : likely ? "likely" : "unknown",
    meatReason: plantOnly
      ? "Map tags or the name now indicate a plant-only place or no meat."
      : explicit
        ? "Meat is indicated by cuisine, name, or dietary map tags."
        : likely
          ? "This cuisine commonly includes meat, but this menu has not been checked."
          : "There is no useful meat clue in the current map listing.",
    valueHint,
    valueLabel: format ? `${format} clue` : valueHint ? "Casual-cuisine clue" : "Value unknown",
    casual,
    takeaway:
      tags.takeaway !== "no" &&
      (["yes", "only"].includes(tags.takeaway) || tags.amenity === "fast_food"),
    valueReason: format
      ? `Mapped as ${format.toLowerCase()}. That format can suggest value, but prices and portions have not been checked.`
      : valueHint
        ? "This cuisine can offer filling casual meals. That is a general guess, not evidence about this restaurant."
        : "No useful value clue is mapped for this place.",
    hours: tags.opening_hours || null,
    sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
    mapsUrl: directionsUrl(location, center),
    closed:
      tags.disused === "yes" ||
      tags.abandoned === "yes" || tags.demolished === "yes" ||
      tags.closed === "yes" || tags.opening_hours === "closed" ||
      Boolean(
        tags["disused:amenity"] ||
          tags["abandoned:amenity"] ||
          tags["demolished:amenity"],
      ),
  };
}
export function selectPlaces(elements, center, radius) {
  const result = elements
    .map((e) => normalizePlace(e, center))
    .filter(
      (p) =>
        p.name &&
        p.meatConfidence !== "excluded" &&
        !p.closed &&
        p.distance !== null &&
        p.distance <= radius,
    )
    .sort(
      (a, b) =>
        Number(b.valueHint) - Number(a.valueHint) ||
        Number(b.meatConfidence === "indicated") - Number(a.meatConfidence === "indicated") ||
        Number(b.casual) - Number(a.casual) ||
        a.distance - b.distance,
    );
  const unique = [];
  for (const p of result)
    if (
      !unique.some(
        (e) =>
          e.id === p.id || (e.name.trim().toLowerCase() === p.name.trim().toLowerCase() &&
          distanceKm(e.location, p.location) < 0.06),
      )
    )
      unique.push(p);
  return unique.slice(0, 40);
}
export function nearbyQuery(latitude, longitude, radius) {
  // Indexed bounding-box lookup is much faster than Overpass's around search.
  // Exact circle membership is checked with distanceKm after normalization.
  const deltaLat = radius / 110.5;
  const south = Math.max(-90, latitude - deltaLat), north = Math.min(90, latitude + deltaLat);
  const maxLat = Math.max(Math.abs(south), Math.abs(north));
  const deltaLon = maxLat >= 89.9 ? 180 : Math.min(180, radius / (111 * Math.cos(maxLat * Math.PI / 180)));
  const west = longitude - deltaLon, east = longitude + deltaLon;
  const boxes = deltaLon === 180 ? [[-180, 180]] : west < -180 ? [[west + 360, 180], [-180, east]] : east > 180 ? [[west, 180], [-180, east - 360]] : [[west, east]];
  const clauses = boxes.map(([w,e]) => `nwr(${south.toFixed(6)},${w.toFixed(6)},${north.toFixed(6)},${e.toFixed(6)})[~"^(amenity|shop)$"~"^(restaurant|fast_food|food_court|cafe|deli)$"]["name"];`).join('');
  return `[out:json][timeout:25];(${clauses});out tags center 500;`;
}
export function savedQuery(ids) {
  const parts = ["node", "way", "relation"]
    .map((type) => {
      const numbers = ids
        .filter((id) => id.startsWith(`${type}-`))
        .map((id) => id.split("-")[1]);
      return numbers.length ? `${type}(id:${numbers.join(",")});` : "";
    })
    .join("");
  return `[out:json][timeout:25];(${parts});out tags center 12;`;
}
