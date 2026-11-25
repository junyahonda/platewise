const items = [
  ['demo-grill', 'The neighborhood grill', 'Barbecue', 0.7, 4.7, 328, 1, 'Generous portions of chicken and rice. Great value for a filling lunch.', 'grill'],
  ['demo-tacos', 'A little taco spot', 'Mexican', 1.2, 4.6, 216, 1, 'The carnitas plate was huge. Enough to share, and really good value.', 'tacos'],
  ['demo-bowl', 'Your next rice bowl', 'Korean', 1.8, 4.8, 482, 2, 'Big portions of beef and vegetables, with enough for leftovers.', 'bowl'],
  ['demo-noodles', 'The corner noodle house', 'Vietnamese', 2.4, 4.5, 197, 1, 'A large serving of chicken noodles at a reasonably priced neighborhood spot.', 'noodles'],
];
export const demoPlaces = items.map(([id, name, category, distance, rating, reviewCount, price, text, art]) => ({ id, name, category, distance, rating, reviewCount, price, open: true, meat: true, meatReason: 'Meat mentioned in a sample review', portion: { text, author: 'Sample reviewer', time: 'Illustrative only' }, value: null, art, demo: true, attributions: [], address: 'Fictional example · not a real recommendation' }));
