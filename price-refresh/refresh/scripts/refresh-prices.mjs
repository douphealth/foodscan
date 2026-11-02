#!/usr/bin/env node
/** FoodScan 80 · daily price refresh. Reads the public sources, rebuilds the seed files and the estimate shards, writes them to --out.
 *
 *   node refresh/scripts/refresh-prices.mjs --work work --out out --prev <dir with the previous seeds/ and manifest.json> [--skip-crawl] [--skip-off]
 *
 *   1. observatory (posokanei): newest daily snapshot (github.com/spyrosavl/posokanei). The barcode links are NOT re-derived: the
 *      previous seed's links (barcode <-> observatory product id, reviewed or exact auto-match) are kept, and only their chain prices
 *      are re-read by product id. A product renamed since the link was reviewed is skipped (src/posokanei.mjs).
 *   2. Bazaar and Lidl web shops: polite crawl, one request at a time. The shop's robots.txt must equal the reviewed copy in
 *      refresh/data/ (else the crawl is skipped until a person reads it). A failed or too-small crawl keeps the previous observations
 *      with their ORIGINAL dates; they are never re-dated.
 *   3. Open Food Facts export (names, brands, pack sizes, categories of the Greek market): re-downloaded when older than 7 days.
 *   4. tools/build-price-data.mjs: calibrated estimates (leave-one-out) for barcodes with no recorded price.
 *   5. seeds are published SHARDED (tools/lib/shard-seeds.mjs) so the site's worker parses ~11 KB per lookup, not 1.8 MB.
 *   6. gate: nothing is written to --out when the new data lost more than 10 % of the previous barcodes, the estimator is not calibrated,
 *      or a source file is incomplete. e-katanalotis is a frozen historical file and is carried forward unchanged. */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { shardSeeds, unshard } from '../../tools/lib/shard-seeds.mjs';

const here = path.dirname(fileURLToPath(import.meta.url)), repo = path.resolve(here, '..', '..');
const arg = (n, d = null) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d; }, flag = n => process.argv.includes('--' + n);
const work = path.resolve(arg('work', 'work')), out = path.resolve(arg('out', 'out')), prev = arg('prev') ? path.resolve(arg('prev')) : null;
const UA = 'FoodScan-refresh/80 (+https://food-scan.gearuptofit.com/how/; daily price refresh, polite)';
const log = (...a) => console.error('[refresh]', ...a);
const run = (cmd, args, opts = {}) => { log(cmd, args.join(' ').slice(0, 170)); const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: opts.cwd || repo, env: { ...process.env, PYTHONUTF8: '1' } }); if (r.status !== 0) throw new Error(`${cmd} exited with ${r.status}`); };
const readJSON = f => JSON.parse(fs.readFileSync(f, 'utf8'));
async function download(url, file) { const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' }); if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`); await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(file)); }
const today = new Date().toISOString().slice(0, 10);
fs.mkdirSync(work, { recursive: true }); const seeds = path.join(work, 'seeds'); fs.rmSync(seeds, { recursive: true, force: true }); fs.mkdirSync(seeds, { recursive: true });
// the published seeds are SHARDED (manifest + shards); they are read back into the monolithic form the build works on
const prevSeed = n => { const d = prev && path.join(prev, 'seeds'), f = d && path.join(d, n); if (!f || !fs.existsSync(f)) return null; const doc = readJSON(f); if (!doc.sharded) return doc; const u = unshard(d, n), { sharded, ...rest } = u.manifest; return { ...rest, products: u.products }; };
const bundledSeed = n => { const f = path.join(repo, 'data/seeds', n); return fs.existsSync(f) ? readJSON(f) : null; };
const base = n => prevSeed(n) || bundledSeed(n);
if (!base('posokanei-latest.json') || !base('bazaar-eshop-latest.json') || !base('lidl-eshop-latest.json') || !base('ekatanalotis-latest.json')) throw new Error('no previous seeds: pass --prev <dir with seeds/> or keep data/seeds in the repository');

/* 1. observatory snapshot + links from the previous seed */
const pkFile = path.join(work, 'pk.json'); let pkDate = null;
for (let d = 0; d < 6 && !pkDate; d++) {
  const day = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
  try { await download(`https://raw.githubusercontent.com/spyrosavl/posokanei/main/data/${day.slice(0, 4)}/posokanei-${day}.json`, pkFile); pkDate = day; log('posokanei snapshot', day, (fs.statSync(pkFile).size / 1048576).toFixed(1) + ' MB'); } catch (e) { log('no snapshot for', day, String(e).slice(0, 80)); }
}
if (!pkDate) throw new Error('no posokanei snapshot in the last 6 days');
const snap = readJSON(pkFile); if (!Array.isArray(snap.products) || snap.products.length < 5000) throw new Error('posokanei snapshot rejected: ' + (snap.products?.length || 0) + ' products');
const oldPk = base('posokanei-latest.json');
const linkDoc = { schema: 2, built: today, links: Object.entries(oldPk.products).map(([ean, p]) => ({ ean: ean.replace(/^0+(?=\d{8})/, ''), pk_id: p.id, pk_name: p.n, method: p.m === 'a' ? 'auto-exact' : 'hand' })) };
const linkFile = path.join(work, 'links.json'); fs.writeFileSync(linkFile, JSON.stringify(linkDoc));
run('node', [path.join(repo, 'refresh/scripts/import.mjs'), '--file', pkFile, '--links', linkFile, '--no-ek', '--seed-dir', seeds, '--now', today]);
fs.copyFileSync(path.join(seeds, 'posokanei-latest.json'), path.join(work, 'pk-seed-new.json'));
// e-katanalotis: frozen since 16 Jun 2026, history only: carried forward unchanged
fs.writeFileSync(path.join(seeds, 'ekatanalotis-latest.json'), JSON.stringify(base('ekatanalotis-latest.json')));

/* 2. web shops: previous observations first, then the new crawl over them (new overrides old per barcode) */
const bz = base('bazaar-eshop-latest.json'), li = base('lidl-eshop-latest.json'), nBz0 = Object.keys(bz.products).length, nLi0 = Object.keys(li.products).length;
async function robotsUnchanged(url, saved, what) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' }); const text = (await res.text()).replace(/\r\n/g, '\n').trim();
  if (text !== fs.readFileSync(path.join(repo, saved), 'utf8').replace(/\r\n/g, '\n').trim()) { log(`${what}: robots.txt CHANGED since it was reviewed (${saved}); the crawl is skipped until a person reads it`); return false; } return true;
}
if (!flag('skip-crawl')) {
  try {
    if (await robotsUnchanged('https://www.bazaar-online.gr/robots.txt', 'refresh/data/bazaar-robots-2026-10-31.txt', 'bazaar')) {
      const w = path.join(work, 'bz'); fs.rmSync(w, { recursive: true, force: true }); fs.mkdirSync(path.join(w, 'cache'), { recursive: true });
      await download('https://www.bazaar-online.gr/', path.join(w, 'seed.html'));
      run('python3', [path.join(repo, 'refresh/scripts/bazaar_crawl.py')], { cwd: w }); fs.copyFileSync(path.join(repo, 'refresh/data/bazaar-robots-2026-10-31.txt'), path.join(w, 'robots.txt'));
      run('python3', [path.join(repo, 'refresh/scripts/bazaar.py'), path.join(w, 'cache'), path.join(work, 'bazaar-new.json'), '--robots', path.join(w, 'robots.txt')]);
      const nb = readJSON(path.join(work, 'bazaar-new.json'));
      if (Object.keys(nb.products).length > 3000) { Object.assign(bz.products, nb.products); bz.source = { ...bz.source, ...nb.source }; log('Bazaar crawl', Object.keys(nb.products).length, 'products'); } else log('Bazaar crawl too small, previous kept');
    }
  } catch (e) { log('Bazaar crawl failed, previous observations kept:', String(e).slice(0, 200)); }
  try {
    if (await robotsUnchanged('https://www.lidl-hellas.gr/robots.txt', 'refresh/data/chains-evidence/robots-www.lidl.gr.txt', 'lidl')) {
      const w = path.join(work, 'li'); fs.rmSync(w, { recursive: true, force: true }); fs.mkdirSync(path.join(w, 'cache'), { recursive: true });
      await download('https://www.lidl-hellas.gr/p/export/GR/el/product_sitemap.xml.gz', path.join(w, 'sitemap.xml.gz'));
      run('python3', [path.join(repo, 'refresh/scripts/lidl_crawl.py'), w]); run('node', [path.join(repo, 'refresh/scripts/lidl-seed.mjs'), w, path.join(work, 'lidl-new.json')]);
      const nl = readJSON(path.join(work, 'lidl-new.json'));
      if (Object.keys(nl.products).length > 150) { Object.assign(li.products, nl.products); li.source = { ...li.source, ...nl.source }; log('Lidl crawl', Object.keys(nl.products).length, 'products'); } else log('Lidl crawl too small, previous kept');
    }
  } catch (e) { log('Lidl crawl failed, previous observations kept:', String(e).slice(0, 200)); }
}
fs.writeFileSync(path.join(seeds, 'bazaar-eshop-latest.json'), JSON.stringify(bz)); fs.writeFileSync(path.join(seeds, 'lidl-eshop-latest.json'), JSON.stringify(li));

/* 3. Open Food Facts extract (the date is inside the file: a cache restore must not make an old extract look new) */
const offGz = path.join(work, 'off.csv.gz'), offJson = path.join(work, 'off-extract.json'), maxAge = Number(arg('off-max-age-days', 7)) * 86400000;
const offAge = () => { try { return Date.now() - Date.parse(readJSON(offJson).exportedAt); } catch { return Infinity; } };
if (!flag('skip-off') && !(offAge() <= maxAge)) { await download('https://openfoodfacts-ds.s3.eu-west-3.amazonaws.com/en.openfoodfacts.org.products.csv.gz', offGz); run('node', [path.join(repo, 'tools/extract-off.mjs'), offGz, offJson, '--seeds', seeds]); fs.rmSync(offGz, { force: true }); }
if (!fs.existsSync(offJson)) throw new Error('no Open Food Facts extract (run without --skip-off once)');

/* 4. estimates */
const stage = path.join(work, 'out-stage'); fs.rmSync(stage, { recursive: true, force: true });
run('node', [path.join(repo, 'tools/build-price-data.mjs'), '--pk', pkFile, '--off', offJson, '--seeds', seeds, '--out', stage, '--now', today]);

/* 5. gate */
const nm = readJSON(path.join(stage, 'manifest.json')), newPk = readJSON(path.join(seeds, 'posokanei-latest.json'));
const counts = { posokanei: Object.keys(newPk.products).length, bazaar: Object.keys(bz.products).length, lidl: Object.keys(li.products).length };
if (counts.posokanei < Object.keys(oldPk.products).length * 0.9) throw new Error(`gate: ${counts.posokanei} observatory links read, previous ${Object.keys(oldPk.products).length}`);
if (counts.bazaar < nBz0 * 0.9 || counts.lidl < nLi0 * 0.9) throw new Error(`gate: web-shop seeds shrank (bazaar ${nBz0} -> ${counts.bazaar}, lidl ${nLi0} -> ${counts.lidl})`);
if (prev && fs.existsSync(path.join(prev, 'manifest.json'))) { const pm = readJSON(path.join(prev, 'manifest.json')); if (nm.withEstimate < pm.withEstimate * 0.8) throw new Error(`gate: ${nm.withEstimate} estimates, previous ${pm.withEstimate}`); }
for (const c of ['A', 'B', 'C', 'D', 'E']) if (!nm.estimator.classes[c]?.usable) throw new Error('gate: estimator class ' + c + ' is not usable');
for (const [c, h] of Object.entries(nm.estimator.holdout)) if (h.coverage80 < 65 || h.coverage80 > 95) throw new Error(`gate: class ${c} held-out coverage ${h.coverage80}%`);
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(path.join(out, 'seeds'), { recursive: true });
for (const f of fs.readdirSync(stage)) if (f !== 'validation.json') fs.copyFileSync(path.join(stage, f), path.join(out, f));
const shardSummary = shardSeeds(seeds, path.join(out, 'seeds')); // manifest + 100 small shards per source: a lookup parses ~11 KB instead of 1.8 MB
fs.writeFileSync(path.join(out, 'README.txt'), 'FoodScan price data (generated). Observations are copied from public sources with their dates; estimates are labelled and calibrated (see manifest.json). https://food-scan.gearuptofit.com/how/\n');
log('written', out, JSON.stringify({ built: nm.built, counts, shards: shardSummary, withEstimate: nm.withEstimate, snapshot: newPk.source.snapshot }));
