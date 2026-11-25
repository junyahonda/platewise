import test from 'node:test';
import assert from 'node:assert/strict';
import { distanceKm, normalizePlace, selectPlaces } from './places.mjs';

const center = { latitude: 37.77, longitude: -122.42 };
const review = (text, rating = 5) => ({ rating, text: { text }, authorAttribution: { displayName: 'Test author', uri: 'https://example.com/author' }, googleMapsUri: 'https://example.com/review' });
const place = (overrides = {}) => ({ id: 'test-place', displayName: { text: 'Test grill' }, types: ['barbecue_restaurant'], location: { latitude: 37.775, longitude: -122.42 }, businessStatus: 'OPERATIONAL', priceLevel: 'PRICE_LEVEL_INEXPENSIVE', rating: 4.6, userRatingCount: 200, ...overrides });

test('straight-line distance is accurate and symmetric, including identical points', () => {
  assert.equal(distanceKm(center, center), 0);
  const point = { latitude: 38.77, longitude: -122.42 };
  assert.ok(Math.abs(distanceKm(center, point) - 111.195) < .01);
  assert.equal(distanceKm(center, point), distanceKm(point, center));
});
test('portion review evidence retains author and review link', () => {
  const result = normalizePlace(place({ reviews: [review('Generous portions of chicken. Great value!')] }), center);
  assert.equal(result.portion.text, 'Generous portions of chicken.');
  assert.equal(result.portion.author, 'Test author');
  assert.equal(result.portion.url, 'https://example.com/review');
  assert.equal(result.value.text, 'Great value!');
  assert.equal(result.meat, true);
});
test('a low price or good rating never manufactures a portion claim', () => {
  const result = normalizePlace(place(), center);
  assert.equal(result.portion, null);
  assert.equal(result.value, null);
});
test('negative and low-rated reviews are not positive portion or value evidence', () => {
  for (const text of ['Not generous portions.', 'The small portions were not good value.', 'Used to have huge portions.', 'The portions are tiny.']) {
    const result = normalizePlace(place({ reviews: [review(text)] }), center);
    assert.equal(result.portion, null);
    assert.equal(result.value, null);
  }
  assert.equal(normalizePlace(place({ reviews: [review('Huge portions, great value.', 2)] }), center).portion, null);
});
test('plant-based meat reviews and vegetarian names do not establish meat evidence', () => {
  const result = normalizePlace(place({ displayName: { text: 'Vegan chicken kitchen' }, types: ['vegan_restaurant'], reviews: [review('The vegan chicken comes in huge portions.')] }), center);
  assert.equal(result.meat, false);
  assert.equal(selectPlaces([place({ types: ['vegan_restaurant'], reviews: [review('Huge portions of vegan chicken.')] })], center, 5).length, 0);
});
test('review meat evidence works without meat-specific cuisine types', () => {
  assert.equal(normalizePlace(place({ types: ['restaurant'], reviews: [review('Delicious chicken with generous portions.')] }), center).meat, true);
});
test('nearby shortlist excludes out-of-radius, closed, meat-unknown and value-unknown places', () => {
  const rejected = [
    place({ location: { latitude: 38, longitude: -122.42 } }),
    place({ businessStatus: 'CLOSED_PERMANENTLY' }),
    place({ types: ['restaurant'] }),
    place({ priceLevel: 'PRICE_LEVEL_EXPENSIVE' }),
    place({ priceLevel: undefined }),
    place({ rating: 3.9 }),
    place({ location: undefined }),
  ];
  assert.deepEqual(selectPlaces(rejected, center, 5), []);
});
test('review-backed portions outrank a cheap restaurant without portion evidence', () => {
  const cheap = place({ id: 'cheap' });
  const portion = place({ id: 'portions', priceLevel: 'PRICE_LEVEL_MODERATE', reviews: [review('Huge portions of beef.')] });
  assert.deepEqual(selectPlaces([cheap, portion], center, 5).map(p=>p.id), ['portions', 'cheap']);
});
test('missing fields remain explicitly unknown, including saved distances', () => {
  const result = normalizePlace({ id: 'unknown' });
  assert.equal(result.price, null);
  assert.equal(result.rating, null);
  assert.equal(result.open, null);
  assert.equal(result.distance, null);
  assert.equal(result.meat, false);
  assert.ok(result.mapsUrl.includes('query_place_id=unknown'));
});
