/* QA helpers for the FoodScan worker: runs the REAL _worker.js handler with an ASSETS binding over the repository root (like Cloudflare Pages)
 * and a fake network. Nothing here touches the internet. Run: node --test qa/ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const read = (f, enc = 'utf8') => fs.readFileSync(path.join(ROOT, f), enc);

export const assets = { fetch: async request => {
  const url = new URL(request.url); let file = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!file.startsWith(ROOT)) return new Response('Forbidden', { status: 403 });
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) return new Response('Not found', { status: 404 });
  return new Response(fs.readFileSync(file), { headers: { 'Content-Type': file.endsWith('.json') ? 'application/json' : 'text/plain' } });
} };
let workerPromise;
export const loadWorker = () => (workerPromise ||= import(pathToFileURL(path.join(ROOT, '_worker.js')).href + '?t=' + Date.now()).then(m => m.default));
export const makeEnv = (extra = {}) => ({ ASSETS: assets, ...extra });

/** Runs fn with a fake network: each [regex, handler] answers matching URLs; every other host fails. */
export async function withNetwork(handlers, fn) {
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    for (const [re, h] of handlers) if (re.test(url)) return h(url, init);
    throw new TypeError('network blocked in tests: ' + url);
  };
  try { return await fn(); } finally { globalThis.fetch = real; }
}
export const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const daysAgo = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
export const daysAhead = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

let nextId = 1000;
/** One Open Prices item in the shape of the real API (GET /api/v1/prices). */
export function op({ code, price, currency = 'EUR', date = daysAgo(1), cc = 'FR', brand = 'Carrefour', name, per = 'UNIT', proof = 'RECEIPT', discounted = false, was = null, discountType = null, city = 'Lyon', type = 'OSM', id = nextId++ }) {
  return { id, product_code: code, type: 'PRODUCT', price, currency, date, price_per: per, price_is_discounted: discounted, price_without_discount: was, discount_type: discountType, duplicate_of: null,
    proof: proof ? { type: proof, file_path: `0001/${id}.webp`, draft: false } : null,
    location: { id: id * 10, type, osm_brand: brand, osm_name: name || `${brand} ${id}`, osm_address_country_code: cc, osm_address_city: city, osm_lat: 45.7 + (id % 50) / 100, osm_lon: 4.8 },
    product: { product_name: 'Test product', quantity: '500 g' } };
}
/** A fake Open Prices that filters by `location__osm_address_country_code` like the real API, pages by 100, and can reject the filter. */
export function fakeOpenPrices(items, { rejectFilter = false, status = 200 } = {}) {
  const calls = [];
  const handler = (u) => {
    const url = new URL(u); calls.push(url.search);
    if (status !== 200) return json({ detail: 'x' }, status);
    const cc = url.searchParams.get('location__osm_address_country_code');
    if (cc && rejectFilter) return json({ detail: 'unknown filter' }, 422);
    const code = url.searchParams.get('product_code');
    let list = items.filter(i => String(i.product_code).replace(/^0+/, '') === String(code).replace(/^0+/, ''));
    if (cc) list = list.filter(i => i.location?.osm_address_country_code?.toUpperCase() === cc.toUpperCase());
    list = list.slice().sort((a, b) => b.date.localeCompare(a.date));
    const page = Number(url.searchParams.get('page') || 1), size = Number(url.searchParams.get('size') || 10);
    return json({ items: list.slice((page - 1) * size, page * size), total: list.length, page, size, pages: Math.ceil(list.length / size) });
  };
  return { handlers: [[/prices\.openfoodfacts\.org/, handler]], calls };
}

let ipN = 1;
/** GET /api/prices/compare as a visitor in `cf.country`, optionally with ?market=. */
export async function compare(code, { items = [], market, country, nearby, opts = {}, env = makeEnv(), fresh = true } = {}) {
  const worker = await loadWorker();
  const fake = fakeOpenPrices(items, opts);
  const qs = new URLSearchParams({ barcode: code, ...(market ? { market } : {}), ...(fresh ? { fresh: '1' } : {}), ...(nearby || {}) });
  const request = new Request(`https://food-scan.test/api/prices/compare?${qs}`, { headers: { 'CF-Connecting-IP': '203.0.113.' + (ipN++ % 250 + 1) } });
  if (country) Object.defineProperty(request, 'cf', { value: { country } });
  return withNetwork(fake.handlers, async () => { const res = await worker.fetch(request, env, { waitUntil() {} }); return { res, body: await res.json(), calls: fake.calls }; });
}
