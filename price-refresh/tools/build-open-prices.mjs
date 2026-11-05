#!/usr/bin/env node
/** Open Prices daily snapshot for FoodScan (87).
 *
 * Reads the four official daily dumps of Open Prices (https://prices.openfoodfacts.org/data/, regenerated every day by the project; ODbL) and writes
 * compact per-barcode shards to `<out>/` (published to the `prices-data` branch by .github/workflows/refresh-prices.yml):
 *   op/manifest.json   build time, the CUTOFF (newest `created` timestamp in the dump), counts per country, licence
 *   op/NNN.json        256 shards by barcode: the observations of the last 120 days, with their store, proof and pack
 * The site's worker reads the shard of a scanned barcode and then asks the live API ONLY for prices created after the cutoff
 * (`product_code__in=<variants>&created__gte=<cutoff>`): one small request instead of up to nine, nothing missed, and the snapshot still answers
 * when the API is slow or down. Every observation is re-validated by the worker exactly as a live one (fsPriceNormalizeOpen).
 *
 *   node tools/build-open-prices.mjs --out out/op [--from <dir with the four .jsonl.gz>] [--prev prev/op] [--days 120]
 * With --prev, a failed download or a suspicious dump (fewer than 70 % of the previous observations) keeps the previous snapshot. */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

export const BASE = 'https://prices.openfoodfacts.org/data/';
export const DUMPS = ['prices', 'proofs', 'locations', 'products'];
export const SHARDS = 256;
export const shardOf = code14 => String(Number(code14.slice(-6)) % SHARDS).padStart(3, '0');
const key14 = c => String(c).replace(/\D/g, '').padStart(14, '0');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const txt = (v, n) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '');

async function* rows(file) { const rl = readline.createInterface({ input: fs.createReadStream(file).pipe(zlib.createGunzip()), crlfDelay: Infinity }); for await (const line of rl) if (line) yield JSON.parse(line); }

async function download(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const ua = 'FoodScanRefresh/87 (+https://food-scan.gearuptofit.com/how/; daily snapshot, ODbL)';
  const meta = {};
  for (const d of DUMPS) {
    const res = await fetch(BASE + d + '.jsonl.gz', { headers: { 'User-Agent': ua }, signal: AbortSignal.timeout(300000) });
    if (!res.ok) throw new Error(`${d}: HTTP ${res.status}`);
    meta[d] = res.headers.get('last-modified') || null;
    await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(path.join(dir, d + '.jsonl.gz')));
  }
  return meta;
}

/** The snapshot itself, from the four dump files in `dir`. Pure apart from reading the files; `now` fixes "today" for tests. */
export async function build(dir, { days = 120, now = Date.now(), perBarcode = 40 } = {}) {
  const since = new Date(now - days * 864e5).toISOString().slice(0, 10), today = new Date(now + 864e5).toISOString().slice(0, 10);
  const proofs = new Map(), locations = new Map(), products = new Map();
  for await (const p of rows(path.join(dir, 'proofs.jsonl.gz'))) proofs.set(p.id, [p.draft === true ? 1 : 0, txt(p.type, 30).toUpperCase(), /^(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:jpe?g|png|webp)$/i.test(p.file_path || '') ? p.file_path : '']);
  for await (const l of rows(path.join(dir, 'locations.jsonl.gz')))
    locations.set(l.id, [txt(l.type, 10), txt(l.osm_address_country_code, 4).toUpperCase(), txt(l.osm_address_country, 40), txt(l.osm_brand, 80), txt(l.osm_name, 100), txt(l.osm_address_city, 60), num(l.osm_lat), num(l.osm_lon)]);
  const keep = new Map(); let cutoff = '', total = 0, kept = 0;
  const skip = {}; const no = r => { skip[r] = (skip[r] || 0) + 1; };
  for await (const p of rows(path.join(dir, 'prices.jsonl.gz'))) {
    total++; if (p.created > cutoff) cutoff = p.created;
    if (p.type !== 'PRODUCT' || !/^\d{8,14}$/.test(String(p.product_code || ''))) { no('not a barcode price'); continue; }
    if (p.duplicate_of !== null && p.duplicate_of !== undefined) { no('duplicate'); continue; }
    if (!(p.date >= since && p.date <= today)) { no('outside the window'); continue; }
    if (!/^[A-Z]{3}$/.test(String(p.currency || '')) || !(num(p.price) > 0)) { no('no price or currency'); continue; }
    const proof = proofs.get(p.proof_id); if (proof && proof[0] === 1) { no('draft proof'); continue; }
    const loc = locations.get(p.location_id); if (!loc || !(loc[3] || loc[4])) { no('no store'); continue; }
    const k = key14(p.product_code);
    const per = p.price_per === 'KILOGRAM' ? 'K' : p.price_per === 'LITER' ? 'L' : '';
    const o = [p.id, Math.round(num(p.price) * 1000) / 1000, p.currency, p.date, per, p.price_is_discounted === true ? 1 : 0, num(p.price_without_discount), txt(p.discount_type, 40), proof ? proof[1] : '', proof ? proof[2] : '', p.location_id, String(p.created || '').slice(0, 19) + 'Z'];
    (keep.get(k) || keep.set(k, []).get(k)).push(o); kept++;
  }
  for await (const pr of rows(path.join(dir, 'products.jsonl.gz'))) { const k = key14(pr.code || ''); if (keep.has(k)) products.set(k, [txt(pr.product_name, 120), txt(pr.quantity, 40), num(pr.product_quantity), txt(pr.product_quantity_unit, 4)]); }
  const shards = Array.from({ length: SHARDS }, () => ({ locations: {}, products: {} })), byCountry = {};
  for (const [k, list] of keep) {
    list.sort((a, b) => (a[3] < b[3] ? 1 : a[3] > b[3] ? -1 : b[0] - a[0]));
    const use = list.slice(0, perBarcode), s = shards[Number(shardOf(k))];
    s.products[k] = { m: products.get(k) || null, o: use };
    for (const o of use) { s.locations[o[10]] ||= locations.get(o[10]); const cc = locations.get(o[10])[1] || '??'; byCountry[cc] = (byCountry[cc] || 0) + 1; }
  }
  return { cutoff, shards, manifest: { schema: 1, source: 'Open Prices daily dumps', url: BASE, license: 'ODbL 1.0 (Open Prices, Open Food Facts); proof images CC BY-SA 4.0',
    built: new Date(now).toISOString(), cutoff, windowDays: days, since, shards: SHARDS, barcodes: keep.size, observations: [...keep.values()].reduce((n, l) => n + Math.min(l.length, perBarcode), 0), inspected: total, kept, skipped: skip,
    byCountry: Object.fromEntries(Object.entries(byCountry).sort((a, b) => b[1] - a[1])) } };
}

export function write(out, snap) {
  fs.mkdirSync(out, { recursive: true });
  snap.shards.forEach((s, i) => fs.writeFileSync(path.join(out, String(i).padStart(3, '0') + '.json'), JSON.stringify({ schema: 1, cutoff: snap.cutoff, built: snap.manifest.built, ...s })));
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(snap.manifest, null, 1));
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const out = arg('--out', 'out/op'), prev = arg('--prev', null), from = arg('--from', null), days = Number(arg('--days', 120));
  const keepPrev = why => {
    console.error(`open prices: ${why}`);
    if (prev && fs.existsSync(path.join(prev, 'manifest.json'))) { fs.cpSync(prev, out, { recursive: true }); console.error('open prices: previous snapshot kept'); process.exit(0); }
    process.exit(1);
  };
  try {
    const dir = from || path.join(path.dirname(out), '..', 'work', 'open-prices');
    if (!from) await download(dir);
    const snap = await build(dir, { days });
    const before = prev && fs.existsSync(path.join(prev, 'manifest.json')) ? JSON.parse(fs.readFileSync(path.join(prev, 'manifest.json'))).observations : 0;
    if (before && snap.manifest.observations < before * 0.7) keepPrev(`only ${snap.manifest.observations} observations, previous ${before}: dump looks incomplete`);
    write(out, snap);
    console.error(`open prices: ${snap.manifest.barcodes} barcodes, ${snap.manifest.observations} observations, cutoff ${snap.cutoff}, top countries ${Object.entries(snap.manifest.byCountry).slice(0, 6).map(([c, n]) => c + ' ' + n).join(', ')}`);
  } catch (e) { keepPrev(String(e.message || e)); }
}
