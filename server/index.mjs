import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIELDS, normalizePlace, selectPlaces } from './places.mjs';

const app = express();
app.disable('x-powered-by');
// The authenticated hosting proxy handles TLS. Never trust forwarded IPs here.
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:'], connectSrc: ["'self'"], fontSrc: ["'self'"], objectSrc: ["'none'"], upgradeInsecureRequests: null } }, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: '4kb' }));
app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.get('/api/config', (_req, res) => res.json({ live: Boolean(process.env.GOOGLE_PLACES_API_KEY), provider: 'Google Maps' }));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, validate: { xForwardedForHeader: false }, message: { error: 'A few too many searches. Please try again in 15 minutes.' } }));
let dailyCount = 0, day = '';
async function google(url, options = {}) {
  if (!process.env.GOOGLE_PLACES_API_KEY) throw Object.assign(new Error('Live search is not connected yet. You can explore the sample instead.'), { status: 503 });
  const today = new Date().toISOString().slice(0, 10);
  if (day !== today) { day = today; dailyCount = 0; }
  const configuredLimit = Number(process.env.GOOGLE_DAILY_REQUEST_LIMIT || 100);
  const limit = Number.isFinite(configuredLimit) ? Math.max(1, configuredLimit) : 100;
  if (dailyCount >= limit) throw Object.assign(new Error('Today’s search limit has been reached. Please try again tomorrow.'), { status: 429 });
  dailyCount++;
  const response = await fetch(`https://places.googleapis.com/v1/${url}`, { ...options, headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY, ...options.headers }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) {
    // Do not log upstream bodies, request coordinates, or API credentials.
    throw Object.assign(new Error(response.status === 429 ? 'Google’s search quota is temporarily exhausted. Please try again later.' : response.status === 403 || response.status === 400 ? 'Google Places could not complete this search. The app owner should check the API key, Places API (New), and billing.' : 'The restaurant provider is unavailable. Please try again shortly.'), { status: response.status === 429 ? 429 : 502 });
  }
  return response.json();
}
app.post('/api/search', async (req, res, next) => {
  try {
    const { latitude, longitude, radius = 5 } = req.body || {};
    if (typeof latitude !== 'number' || typeof longitude !== 'number' || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || ![2, 5, 10, 20].includes(radius)) return res.status(400).json({ error: 'Please provide a valid location and search radius.' });
    const center = { latitude, longitude };
    const result = await google('places:searchText', { method: 'POST', headers: { 'X-Goog-FieldMask': FIELDS.split(',').map(f => `places.${f}`).join(',') }, body: JSON.stringify({ textQuery: 'restaurants meat chicken beef generous portions good value', includedType: 'restaurant', strictTypeFiltering: true, languageCode: 'en', pageSize: 20, locationBias: { circle: { center, radius: radius * 1000 } } }) });
    res.json({ places: selectPlaces(result.places || [], center, radius), scanned: result.places?.length || 0 });
  } catch (error) { next(error); }
});
app.post('/api/saved', async (req, res, next) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length > 12 || ids.some(id => typeof id !== 'string' || !/^[\w-]{1,255}$/.test(id))) return res.status(400).json({ error: 'Please provide up to 12 valid saved places.' });
    // Sequential requests avoid an unbounded provider fan-out.
    const places = [];
    for (const id of [...new Set(ids)]) {
      const place = await google(`places/${encodeURIComponent(id)}?languageCode=en`, { headers: { 'X-Goog-FieldMask': FIELDS } });
      places.push(normalizePlace(place));
    }
    res.json({ places });
  } catch (error) { next(error); }
});
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
app.use(express.static(root, { maxAge: '1h', setHeaders(res, file) { if (file.endsWith('index.html') || file.endsWith('.webmanifest')) res.set('Cache-Control', 'no-cache'); } }));
app.get('/{*path}', (_req, res) => res.sendFile(path.join(root, 'index.html')));
app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: error.status ? error.message : 'Something went wrong. Please try again.' }));
const port = Number(process.env.PORT || 3000);
app.listen(port, '0.0.0.0', () => console.log(`Platewise listening on port ${port}`));
