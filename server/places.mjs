export const MEAT_TYPES = new Set(['barbecue_restaurant', 'steak_house', 'hamburger_restaurant', 'chicken_restaurant', 'chicken_wings_restaurant', 'korean_barbecue_restaurant', 'kebab_shop']);
const meatPattern = /\b(beef|chicken|pork|steak|brisket|ribs|lamb|carnitas|al pastor|shawarma|kebab|burger|barbecue|bbq|meat)\b/i;
const portionPattern = /\b(generous|huge|large|big|hefty|massive|heaping|enormous)\s+(?:\w+\s+){0,2}(portions?|servings?|plates?)\b|\b(plenty of food|enough for two|enough to share|leftovers)\b/i;
const valuePattern = /\b(good|great|excellent|amazing|best)\s+(?:\w+\s+){0,2}value\b|\b(affordable|reasonably priced|bang for (?:your|the) buck|worth (?:the|every) (?:money|penny)|cheap and delicious)\b/i;
const negationPattern = /\b(not|never|hardly|isn't|aren't|wasn't|weren't|no longer|used to|overpriced|small portions?|tiny portions?|poor value|bad value)\b/i;
const nonMeatPattern = /\b(vegan|vegetarian|plant[- ]based|meatless|beyond|impossible|mock|faux|no meat)\b/i;

export function distanceKm(a, b) {
  const r = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * r, dLng = (b.longitude - a.longitude) * r;
  return 6371 * 2 * Math.atan2(Math.sqrt(Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin(dLng / 2) ** 2), Math.sqrt(1 - (Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin(dLng / 2) ** 2)));
}
function reviewSentences(reviews = []) {
  return reviews.filter(r => (r.rating ?? 0) >= 4).flatMap(review => {
    const original = review.text?.text || review.originalText?.text || '';
    return original.split(/(?<=[.!?])\s+/).filter(text => !negationPattern.test(text)).map(text => ({ text, author: review.authorAttribution?.displayName || 'Google reviewer', authorUrl: review.authorAttribution?.uri, url: review.googleMapsUri, time: review.relativePublishTimeDescription }));
  });
}
export function normalizePlace(place, center) {
  const reviews = reviewSentences(place.reviews);
  const portion = reviews.find(r => portionPattern.test(r.text));
  const value = reviews.find(r => valuePattern.test(r.text));
  const meatReview = reviews.find(r => meatPattern.test(r.text) && !nonMeatPattern.test(r.text));
  const meatType = (place.types || []).find(t => MEAT_TYPES.has(t));
  const meatName = !nonMeatPattern.test(place.displayName?.text || '') && meatPattern.test(place.displayName?.text || '');
  const price = { PRICE_LEVEL_FREE: 0, PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2, PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4 }[place.priceLevel];
  return {
    id: place.id, name: place.displayName?.text || 'Restaurant', address: place.formattedAddress || '',
    category: (place.primaryTypeDisplayName?.text || place.primaryType || 'Restaurant').replaceAll('_', ' '),
    distance: center && place.location ? distanceKm(center, place.location) : null,
    rating: place.rating ?? null, reviewCount: place.userRatingCount ?? 0, price: price ?? null,
    open: place.currentOpeningHours?.openNow ?? null,
    meat: Boolean(meatType || meatReview || meatName),
    meatReason: meatType ? `${meatType.replaceAll('_', ' ')} listing` : meatReview ? 'Meat mentioned in a review' : meatName ? 'Meat indicated by restaurant name' : 'Menu not verified',
    portion: portion || null, value: value || null,
    mapsUrl: place.googleMapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.displayName?.text || 'Restaurant')}&query_place_id=${encodeURIComponent(place.id)}`,
    attributions: place.attributions || [], closed: place.businessStatus && place.businessStatus !== 'OPERATIONAL',
  };
}
export function selectPlaces(places, center, radius) {
  return places.map(p => normalizePlace(p, center)).filter(p => !p.closed && p.meat && p.distance !== null && p.distance <= radius && (p.portion || p.value || (p.price !== null && p.price <= 2 && p.rating >= 4))).sort((a, b) => Number(Boolean(b.portion)) - Number(Boolean(a.portion)) || Number(Boolean(b.value)) - Number(Boolean(a.value)) || (a.price ?? 5) - (b.price ?? 5) || a.distance - b.distance);
}
export const FIELDS = 'id,displayName,formattedAddress,location,primaryType,primaryTypeDisplayName,types,rating,userRatingCount,priceLevel,currentOpeningHours,googleMapsUri,reviews,attributions,businessStatus';
