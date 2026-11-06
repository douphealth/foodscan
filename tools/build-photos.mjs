#!/usr/bin/env node
/** Builds assets/photos-<revision>.json: a real photo for catalogue products whose record has no front image.
 * The catalogue (Open Food Facts CSV export) only carries the front image of the main language. Many products have other photos on Open Food Facts: a front image
 * selected for another language, or photos uploaded but never selected. This asks the Open Food Facts API (search by barcode, 50 at a time, politely spaced) for
 * the image list of every catalogue product without a front image and keeps, in order: a front image of any language, then the first uploaded photo (contributors
 * usually start with the front), then a packaging image. Photos are Open Food Facts' own (CC BY-SA), served from images.openfoodfacts.org like every other photo.
 *   node tools/build-photos.mjs [--limit N]          writes the file (needs network)
 * No photo is invented: a product with no photo on Open Food Facts gets none. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), dir = path.join(here, '../assets/greece-r20261030');
const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json')));
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
export const fileFor = rev => path.join(here, `../assets/photos-${rev}.json`);

/** The image list of one product -> the file part of the best photo ("front_en.4.400", "1.400"), or null. */
export function bestPhoto(images) {
  if (!images || typeof images !== 'object') return null;
  const sel = k => (images[k]?.rev ? `${k}.${images[k].rev}.400` : null);
  const fronts = Object.keys(images).filter(k => /^front_[a-z]{2}$/.test(k)).sort();
  for (const k of fronts) { const s = sel(k); if (s) return s; }
  const raw = Object.keys(images).filter(k => /^\d+$/.test(k)).map(Number).sort((a, b) => a - b);
  if (raw.length) return `${raw[0]}.400`;
  const pack = Object.keys(images).filter(k => /^packaging_[a-z]{2}$/.test(k)).sort();
  for (const k of pack) { const s = sel(k); if (s) return s; }
  return null;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const codes = [];
  for (const f of fs.readdirSync(dir).filter(f => f.startsWith('part-')).sort()) for (const r of JSON.parse(fs.readFileSync(path.join(dir, f))).products) if (!r.image_front_small_url) codes.push(r.code);
  const limit = Number(arg('--limit', codes.length)), todo = codes.slice(0, limit), photos = {}, ua = 'FoodScanBuild/89 (+https://food-scan.gearuptofit.com/how/; photo index, 50 barcodes per request)';
  let asked = 0, answered = 0;
  for (let i = 0; i < todo.length; i += 50) {
    const batch = todo.slice(i, i + 50), url = `https://world.openfoodfacts.org/api/v2/search?code=${batch.join(',')}&fields=code,images&page_size=50`;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await fetch(url, { headers: { 'User-Agent': ua }, signal: AbortSignal.timeout(60000) });
        if (res.status === 429 || res.status >= 500) throw new Error('HTTP ' + res.status);
        const j = await res.json(); asked += batch.length;
        for (const p of j.products || []) { answered++; const b = bestPhoto(p.images); if (b && batch.includes(p.code)) photos[p.code] = b; }
        break;
      } catch (e) { console.error(`batch ${i / 50}: ${e.message}, retry ${attempt + 1}`); await new Promise(r => setTimeout(r, 15000 * (attempt + 1))); }
    }
    await new Promise(r => setTimeout(r, 6500)); // the search API allows about 10 requests a minute
  }
  const out = { schema: 1, revision: index.revision, built: new Date().toISOString(), source: 'Open Food Facts product images (CC BY-SA 4.0)', asked, answered, photos: Object.fromEntries(Object.entries(photos).sort()) };
  fs.writeFileSync(fileFor(index.revision), JSON.stringify(out));
  console.log(`${path.basename(fileFor(index.revision))}: asked ${asked}, answered ${answered}, photo found for ${Object.keys(photos).length}`);
}
