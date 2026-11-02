#!/usr/bin/env node
/* FoodScan 72 · box import: official Greek prices -> seed assets, D1 SQL, and (optionally) the admin import endpoint.
 *
 *   node ingest/scripts/import.mjs                       # newest archive snapshot (today, else up to 4 days back)
 *   node ingest/scripts/import.mjs --date 2026-10-30     # one day
 *   node ingest/scripts/import.mjs --file pk.json --ek-file prices.json
 *   options: --seed-dir assets/gr-prices-v72  --sql out.sql  --post https://SITE  (token in FOODSCAN_PRICES_ADMIN_TOKEN)
 *            --no-ek (skip the e-katanalotis file)  --now 2026-10-31 (age checks against that day; tests only)
 *
 * Nothing is estimated: the seed and the SQL hold only prices copied from the snapshot, each with its own date. */
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { ingestSnapshot, archiveURL, SOURCE as PK } from '../src/posokanei.mjs';
import { parseFeed, FEED_URL, MERCHANTS, SOURCE as EK } from '../src/ekatanalotis.mjs';
import { rowFor, sqlFor, importRecordFor } from '../src/d1.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), opt = n => { const i = args.indexOf('--' + n); return i < 0 ? null : args[i + 1]; }, flag = n => args.includes('--' + n);
const now = opt('now') ? Date.parse(opt('now') + 'T12:00:00Z') : Date.now();
const seedDir = opt('seed-dir') || path.join(here, '..', '..', 'assets', 'gr-prices-v77-src');
const linkFile = opt('links') || ['ean-posokanei-map-v2.json', 'ean-posokanei-map-v1.json'].map(f => path.join(here, '..', 'data', f)).find(f => fs.existsSync(f));
const linkDoc = JSON.parse(fs.readFileSync(linkFile, 'utf8'));
const label = id => Object.values(MERCHANTS).find(m => m[0] === id)?.[1] || id;
const UA = { 'User-Agent': 'FoodScan-ingest/72 (+https://food-scan.gearuptofit.com/how/)' };

async function snapshotStream() {
  if (opt('file')) return { stream: fs.createReadStream(opt('file'), { highWaterMark: 1 << 16 }), archive: archiveURL(path.basename(opt('file')).match(/\d{4}-\d{2}-\d{2}/)?.[0] || '') };
  const days = opt('date') ? [opt('date')] : [0, 1, 2, 3, 4].map(d => new Date(now - d * 86400000).toISOString().slice(0, 10));
  for (const d of days) {
    const url = archiveURL(d), res = await fetch(url, { headers: UA });
    if (res.ok) return { stream: Readable.fromWeb(res.body), archive: url };
    await res.body?.cancel(); console.error(`no snapshot for ${d} (HTTP ${res.status})`);
  }
  throw new Error('no_snapshot_found');
}

const { stream, archive } = await snapshotStream();
const pk = await ingestSnapshot(stream, linkDoc, { archive, now });
const nowISO = new Date().toISOString();
console.log(`posokanei ${pk.meta.date}: scanned ${pk.stats.scanned} products, ${pk.stats.found}/${pk.stats.linked} linked found, ${pk.records.length} chain prices, renamed ${pk.stats.renamed.length}`, pk.stats.chains);
for (const r of pk.stats.renamed) console.log('  skipped (renamed since review):', r.ean, '|', r.was, '→', r.now);

fs.mkdirSync(seedDir, { recursive: true });
const pkSeed = { schema: 1, source: { ...PK, archive, snapshot: pk.meta.date, fetched_at: pk.meta.fetched_at, api: pk.meta.source },
  link_file: { file: path.basename(linkFile), built: linkDoc.built, links: linkDoc.links.length, hand: linkDoc.links.filter(l => (l.method || 'hand') === 'hand').length, auto_exact: linkDoc.links.filter(l => l.method === 'auto-exact').length }, generated: nowISO, products: pk.products };
fs.writeFileSync(path.join(seedDir, 'posokanei-latest.json'), JSON.stringify(pkSeed));

let ek = null;
if (!flag('no-ek')) {
  const doc = opt('ek-file') ? JSON.parse(fs.readFileSync(opt('ek-file'), 'utf8')) : await (await fetch(FEED_URL, { headers: UA })).json();
  ek = parseFeed(doc);
  const ekSeed = { schema: 1, source: { ...EK, feed: FEED_URL, snapshot: ek.date }, generated: nowISO, products: ek.products };
  for (const f of fs.readdirSync(seedDir)) if (/^ekatanalotis-.*\.json$/.test(f)) fs.rmSync(path.join(seedDir, f));
  fs.writeFileSync(path.join(seedDir, 'ekatanalotis-latest.json'), JSON.stringify(ekSeed));
  console.log(`e-katanalotis ${ek.date}: ${ek.stats.validEAN} barcodes, ${ek.stats.prices} chain prices`);
}

// D1: only current prices (<= 30 days) go to the database; older e-katanalotis prices stay in the seed as history.
const pkRows = pk.records.map(r => rowFor(r, PK, nowISO));
const ekRecords = [];
if (ek && ek.date && (now - Date.parse(ek.date + 'T00:00:00Z')) / 86400000 <= 30)
  for (const [k, p] of Object.entries(ek.products)) for (const [chain, price, date] of p.p)
    ekRecords.push({ barcode: k.replace(/^0+(?=\d{8,})/, ''), retailer_id: chain, retailer: label(chain), store_scope: 'national', store_id: 'ekatanalotis', store_name: label(chain), price, basis: 'item', observed_at: date, discount_type: '', source_url: EK.url });
const rows = [...pkRows, ...ekRecords.map(r => rowFor(r, EK, nowISO))];
if (opt('sql')) { fs.writeFileSync(opt('sql'), sqlFor(rows)); console.log(`SQL: ${rows.length} rows -> ${opt('sql')}`); }

if (opt('post')) {
  const token = process.env.FOODSCAN_PRICES_ADMIN_TOKEN; if (!token) throw new Error('FOODSCAN_PRICES_ADMIN_TOKEN not set');
  const groups = [[PK, pk.records], [EK, ekRecords]];
  for (const [src, recs] of groups) for (let i = 0; i < recs.length; i += 100) {
    const res = await fetch(new URL('/api/prices/admin/import', opt('post')), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ source_id: src.id, source_label: src.label, license_ref: src.license, rights_confirmed: true, records: recs.slice(i, i + 100).map(importRecordFor) }) });
    const body = await res.text(); if (!res.ok) throw new Error(`import ${src.id} batch ${i / 100}: HTTP ${res.status} ${body.slice(0, 200)}`);
  }
  console.log('posted', pk.records.length + ekRecords.length, 'records');
}
