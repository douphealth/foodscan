#!/usr/bin/env node
/** Reproducible overlay build: baseline (the v79 site zip as received) + src/ + data/ -> app/ (deployable tree) -> zip.
 *   node tools/build-v80.mjs [--zip] [--out <zip path>]
 * Every patch is an exact-match replacement that must hit the expected number of times, so a baseline that is not the one this
 * overlay was written for fails loudly instead of shipping a half-patched site. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeZip } from './lib/zip.mjs';
import { shardSeeds } from './lib/shard-seeds.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = (...a) => path.join(root, ...a);
const BASE = P('baseline'), APP = P('app'), SRC = P('src'), DATA = P('data');
const VERSION = '80.0.0', BUILD = '8000-price-intelligence', CODENAME = 'Complete-Prices';

fs.rmSync(APP, { recursive: true, force: true });
fs.cpSync(BASE, APP, { recursive: true });
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
const write = (f, s) => { fs.mkdirSync(path.dirname(path.join(APP, f)), { recursive: true }); fs.writeFileSync(path.join(APP, f), s); };
const norm = s => s.replace(/\r\n/g, '\n');
let patches = 0;
function patch(file, from, to, expected = 1) {
  const parts = norm(read(file)).split(from), n = parts.length - 1;
  if (n !== expected) throw new Error(`patch ${file}: expected ${expected} match(es) for ${JSON.stringify(from.slice(0, 90))}, found ${n}`);
  write(file, parts.join(to)); patches++;
}
const copy = (from, to) => { fs.mkdirSync(path.dirname(path.join(APP, to)), { recursive: true }); fs.copyFileSync(path.join(SRC, from), path.join(APP, to)); };

/* ---------- 1. data: refreshed seeds (observatory by product id, web shops re-read) + estimate shards ---------- */
// the four source seeds ship SHARDED (manifest + 100 small shards each): a cold lookup parses ~11 KB instead of 1.8 MB of JSON
const shardSummary = shardSeeds(path.join(DATA, 'seeds'), path.join(APP, 'assets/gr-prices-v72'));
fs.cpSync(path.join(DATA, 'gr-est-v80'), path.join(APP, 'assets/gr-est-v80'), { recursive: true });
fs.rmSync(path.join(APP, 'assets/gr-est-v80/validation.json'), { force: true });

/* ---------- 2. worker ---------- */
const W = '_worker.js';
patch(W, 'var VERSION = "79.0.0";', `var VERSION = "${VERSION}";`);
patch(W, 'var BUILD = "7800-evidence-only-truthful-health";', `var BUILD = "${BUILD}";`);
patch(W, 'const FS_PRICE_CURRENT_DAYS = 30, FS_PRICE_OLDER_DAYS = 90;', 'const FS_PRICE_CURRENT_DAYS = 7, FS_PRICE_OLDER_DAYS = 90;');
patch(W, ' * Freshness: current <= 30 days (only these can be "the cheapest"), older 31-90 days, historical > 90 days.', ' * Freshness: current <= 7 days (only these can be "the cheapest"), older 8-90 days, historical > 90 days.');
patch(W, 'function fsGrSeedLegacy(request, env, id) {', 'function fsGrSeedLegacyV79(request, env, id) {');
patch(W, 'async function fsGrSeed(request, env, id, code=null) {', 'async function fsGrSeedV79(request, env, id, code=null) {');
patch(W, 'async function fsPriceHealth(request, env, now=Date.now()) {', 'async function fsPriceHealthV79(request, env, now=Date.now()) {');
// estimate lookup rides along with the seed reads
patch(W, '  await Promise.all(pending);\n  return out;\n}', '  const est = await fsEstimateFor(request, env, code).catch(() => null);\n  if (est) { out.estimate = est.estimate; out.estimateMeta = est.meta; out.estimateName = est.name; }\n  await Promise.all(pending);\n  return out;\n}');
patch(W, "  const status = offers.length || others.length ? 'observations_available' : !active.length || down === active.length ? 'temporarily_unavailable' : down ? 'incomplete' : 'no_data';",
  "  // 80: an estimate is offered only when no recorded price of this exact barcode can lead the card (a current, older, not-ranked or out-of-stock one)\n  const leadable = offers.some(o => ['current', 'older', 'notRanked', 'outOfStock'].includes(o.tier));\n  const estimate = !leadable ? (official.estimate || null) : null;\n  const status = offers.length || others.length ? 'observations_available' : estimate ? 'estimate_only' : !active.length || down === active.length ? 'temporarily_unavailable' : down ? 'incomplete' : 'no_data';");
patch(W, '    offers, elsewhere:others, providers,\n', '    offers, elsewhere:others, estimate, data:official.estimateMeta || null, providers,\n');
patch(W, "(sample.productName || '')", "(sample.productName || official.estimateName || '')");
patch(W, ' and licensed retailer feeds when configured. Nothing is estimated.`,', ' and licensed retailer feeds when configured. A recorded price is never estimated. When a barcode has no recorded price, an estimate field from comparable products with a recorded price may be returned instead: it is labelled, carries a range calibrated on the measured error of the method, and is never an offer (never ranked, never named the cheapest).`,');
patch(W, "'Only observations from the last 30 days, with no expired promotion and a dated proof, can be \"the cheapest\". Future-dated observations are rejected.'", "'Only observations from the last 7 days, with no expired promotion and a dated proof, can be \"the cheapest\". Older prices are still shown, as the last recorded price, with their age. Future-dated observations are rejected.'");
patch(W, 'Prices older than 30 days are shown only as "older price" with their date.', 'Prices older than 7 days are shown as "older price" with their date and age.');
patch(W, 'async function fsPricesRoute(request,env,ctx) {', norm(fs.readFileSync(P('src/worker/est-v80.js'), 'utf8')) + '\nasync function fsPricesRoute(request,env,ctx) {');

/* ---------- 3. client files ---------- */
for (const f of ['price-core-v80.mjs', 'price-client-v80.mjs', 'native-v80.js', 'native-v80.css', 'prices-v80.js', 'prices-v80.css', 'prices-base-v80.css', 'add-price-v80.mjs', 'ocr-parse-v80.mjs']) copy('prices/' + f, 'prices/' + f);
copy('ui-v80.css', 'ui-v80.css');
// Greek capitals: every rule the app uppercases gets a calmer letter-spacing in Greek (wide tracking on accented capitals reads as broken)
let greek = '';
{
  const css = read('assets/app-V52SOTA1-v7540.css'), sels = new Set();
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*text-transform:\s*uppercase[^{}]*)\}/g)) {
    const sel = m[1].replace(/^[\s\S]*\{/, '').trim();
    if (sel && !sel.startsWith('@')) for (const one of sel.split(',')) { const t = one.trim(); if (t && !t.includes('@')) sels.add(t); }
  }
  greek = ['', '/* 80: Greek capitals */', [...sels].map(x => 'html:lang(el) ' + x).join(',\n') + '{letter-spacing:.035em!important;overflow-wrap:anywhere}', ''].join('\n');
}

/* ---------- 4. pages and service worker ---------- */
for (const f of ['index.html', 'demo/index.html', 'how/index.html', 'prices/index.html']) {
  patch(f, 'data-foodscan-version="79.0.0"', `data-foodscan-version="${VERSION}"`);
  let s = norm(read(f)).replace(/-v79\.(css|js|mjs)/g, '-v80.$1');
  s = s.replace('</head>', '<link rel="stylesheet" href="/ui-v80.css"></head>');
  write(f, s);
}
{
  let s = norm(read('sw.js'));
  s = s.replace("const CACHE = 'foodscan-79.0.0';", `const CACHE = 'foodscan-${VERSION}';`).replace(/-v79\.(css|js|mjs)/g, '-v80.$1');
  s = s.replace("'/market-hint-v71.js',", "'/market-hint-v71.js','/ui-v80.css',");
  if (!s.includes(`foodscan-${VERSION}`) || /-v79\./.test(s) || !s.includes('/ui-v80.css')) throw new Error('sw.js patch incomplete');
  write('sw.js', s);
}
patch('prices/native-v80.js', "export const BUILD = 'foodscan-79.0.0';", `export const BUILD = 'foodscan-${VERSION}';`);
patch('prices/native-v80.js', ' (price-core-v79).', ' (price-core-v80).');
// the Prices page footer
patch('prices/index.html', 'Prices: the Ministry of Development price observatory (posokanei.gov.gr, national chain prices, only for reviewed barcodes), e-katanalotis (older prices, shown as history) and Open Prices by Open Food Facts (ODbL). Confirm shelf prices, discounts and availability before purchasing.',
  'Recorded prices: the Ministry of Development price observatory (posokanei.gov.gr, national chain prices, linked to barcodes by exact or name-and-size matching), the Bazaar and Lidl web shops (re-read on every scan when they answer), e-katanalotis (older prices, shown as history) and Open Prices by Open Food Facts (ODbL). Estimates are labelled and are not recorded prices. Confirm shelf prices, discounts and availability before purchasing.');

write(`RELEASE-${VERSION}.md`, norm(fs.readFileSync(P('src/RELEASE-80.0.0.md'), 'utf8')));
fs.appendFileSync(path.join(APP, 'ui-v80.css'), greek);

/* ---------- 6. checks and zip ---------- */
for (const f of ['index.html', 'prices/index.html', 'sw.js', 'prices/prices-v80.js', 'prices/native-v80.js', 'prices/price-client-v80.mjs']) if (/-v79\./.test(read(f))) throw new Error('v79 reference left in ' + f);
console.error(`patched ${patches} spots; app/ ready`, JSON.stringify(shardSummary));
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
if (process.argv.includes('--zip')) {
  const out = arg('--out', P(`FoodScan-${VERSION}-${CODENAME}-Cloudflare-Pages.zip`));
  const n = writeZip(APP, out);
  console.error(`zip ${out} (${n} files, ${(fs.statSync(out).size / 1048576).toFixed(1)} MB)`);
}
