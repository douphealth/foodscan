#!/usr/bin/env node
/** Packs the daily price data (the layout of the `prices-data` branch: 100 shards per chain, 100 web-shop shards, 64 observatory shards, 64 estimate shards)
 *  into the compact bundled layout that FoodScan 101 reads (10 shards per chain, 10 web-shop shards, 8 observatory shards, 8 candidate shards).
 *
 *    node tools/repack-v101.mjs <data checkout> [<assets dir>]     write the bundled files into <assets dir> (default: ./assets)
 *    node tools/repack-v101.mjs --verify [<assets dir>]            check that every record sits in the shard the worker will read it from
 *
 *  Nothing is changed or invented: records are moved, never edited. The shard rules are the worker's own (see fsGrSeed, fsWebPreShard, fsObsBundledId, fsCandBundledId):
 *    chains  : last digit of the 14-digit key                      -> assets/gr-prices-v72/<src>/d<digit>.json
 *    web     : last digit of the 14-digit key                      -> assets/gr-web-v93/d<digit>.json
 *    observ. : parseInt(first 6 hex digits of the id, 16) % 8      -> assets/gr-obs-v82/p-<n>.json
 *    cand.   : Number(last 6 digits of the 14-digit key) % 8       -> assets/gr-cand-v101/c-<n>.json   (class A/B same-brand matches `r`, observatory candidates `k`; no estimates) */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SOURCES = ['pk', 'li', 'ek', 'bz'];
const LATEST = ['bazaar-eshop-latest.json', 'ekatanalotis-latest.json', 'lidl-eshop-latest.json', 'posokanei-latest.json'];
const key14 = code => String(code).replace(/\D/g, '').padStart(14, '0');
const rd = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const wr = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(v)); };
const stampMax = list => list.filter(Boolean).sort().at(-1) || null;
export const obsShard = id => parseInt(String(id).slice(0, 6), 16) % 8;
export const candShard = code => Number(key14(code).slice(-6)) % 8;

export function repack(dataRoot, assets) {
  const report = {};
  // 1. chain price seeds
  for (const src of SOURCES) {
    const dir = path.join(dataRoot, 'seeds', src), groups = Array.from({ length: 10 }, () => ({ products: {}, head: null }));
    for (const f of fs.readdirSync(dir).filter(f => /^\d\d\.json$/.test(f)).sort()) {
      const j = rd(path.join(dir, f));
      if (Array.isArray(j.rows) && j.rows.length) throw new Error(`${src}/${f}: shared "rows" are not supported by this packer`);
      for (const [k, v] of Object.entries(j.products || {})) { const g = groups[Number(key14(k).slice(-1))]; g.head ||= j; g.products[k] = v; }
    }
    let n = 0;
    groups.forEach((g, d) => { const { products: _p, ...head } = g.head || { schema: 2 }; wr(path.join(assets, 'gr-prices-v72', src, `d${d}.json`), { ...head, products: g.products }); n += Object.keys(g.products).length; });
    report[src] = n;
  }
  for (const f of LATEST) fs.copyFileSync(path.join(dataRoot, 'seeds', f), path.join(assets, 'gr-prices-v72', f));
  // 2. web-shop prefill
  { const dir = path.join(dataRoot, 'web'), groups = Array.from({ length: 10 }, () => ({ products: {}, built: [], head: null }));
    for (const f of fs.readdirSync(dir).filter(f => /^\d\d\.json$/.test(f)).sort()) {
      const j = rd(path.join(dir, f));
      for (const [k, v] of Object.entries(j.products || {})) { const g = groups[Number(key14(k).slice(-1))]; g.head ||= j; g.built.push(j.built); g.products[k] = v; }
    }
    let n = 0;
    for (const g of groups) n += Object.keys(g.products).length;
    // A refresh that found no web-shop prices at all (the crawler did not run, e.g. no API key: manifest.json says why) is "no information", not "the shops
    // list nothing": the files already in the bundle keep their own dated prices instead of being emptied.
    if (n === 0) report.web = 'kept: the refresh holds no web-shop prices';
    else { groups.forEach((g, d) => { const { products: _p, built: _b, ...head } = g.head || { schema: 1 }; wr(path.join(assets, 'gr-web-v93', `d${d}.json`), { ...head, built: stampMax(g.built) || (g.head || {}).built, products: g.products }); }); report.web = n; } }
  // 3. observatory
  { const groups = Array.from({ length: 8 }, () => ({ items: {}, head: null, built: [] }));
    for (const f of fs.readdirSync(dataRoot).filter(f => /^o-\d\d\.json$/.test(f)).sort()) {
      const j = rd(path.join(dataRoot, f));
      for (const [id, v] of Object.entries(j.items || {})) { const g = groups[obsShard(id)]; g.head ||= j; g.built.push(j.built); g.items[id] = v; }
    }
    let n = 0;
    groups.forEach((g, i) => { const h = g.head || { v: 82 }; wr(path.join(assets, 'gr-obs-v82', `p-${i}.json`), { v: h.v, built: stampMax(g.built) || h.built, snapshot: h.snapshot, shard: i, shards: 8, items: g.items }); n += Object.keys(g.items).length; });
    report.observatory = n; }
  // 4. candidates (observatory candidates and same-brand class A/B neighbours; the estimates themselves are dropped)
  { const groups = Array.from({ length: 8 }, () => ({ items: {}, built: [] }));
    for (const f of fs.readdirSync(dataRoot).filter(f => /^e-\d\d\.json$/.test(f)).sort()) {
      const j = rd(path.join(dataRoot, f));
      for (const [code, it] of Object.entries(j.items || {})) {
        const o = {};
        if (it.k) o.k = it.k;
        if (it.e && (it.e.c === 'A' || it.e.c === 'B') && Array.isArray(it.e.x) && it.e.x.length) o.r = { c: it.e.c, x: it.e.x.slice(0, 3) };
        if (!Object.keys(o).length) continue;
        o.n = it.n; const g = groups[candShard(code)]; g.items[code] = o; g.built.push(j.built);
      }
    }
    let n = 0;
    groups.forEach((g, i) => { wr(path.join(assets, 'gr-cand-v101', `c-${i}.json`), { v: 101, built: stampMax(g.built), shard: i, shards: 8, items: g.items }); n += Object.keys(g.items).length; });
    report.candidates = n; }
  return report;
}

/** Every record must sit in the shard the worker looks in. Returns a list of problems (empty = fine). */
export function verifyLayout(assets) {
  const bad = [];
  for (const src of SOURCES) for (let d = 0; d < 10; d++) {
    const f = path.join(assets, 'gr-prices-v72', src, `d${d}.json`); if (!fs.existsSync(f)) { bad.push('missing ' + f); continue; }
    for (const k of Object.keys(rd(f).products || {})) if (Number(key14(k).slice(-1)) !== d) bad.push(`${src}/d${d}: ${k} belongs in d${key14(k).slice(-1)}`);
  }
  for (let d = 0; d < 10; d++) { const f = path.join(assets, 'gr-web-v93', `d${d}.json`); if (!fs.existsSync(f)) { bad.push('missing ' + f); continue; }
    for (const k of Object.keys(rd(f).products || {})) if (Number(key14(k).slice(-1)) !== d) bad.push(`web/d${d}: ${k} belongs in d${key14(k).slice(-1)}`); }
  for (let i = 0; i < 8; i++) {
    const fo = path.join(assets, 'gr-obs-v82', `p-${i}.json`), fc = path.join(assets, 'gr-cand-v101', `c-${i}.json`);
    if (!fs.existsSync(fo)) bad.push('missing ' + fo); else for (const id of Object.keys(rd(fo).items || {})) if (obsShard(id) !== i) bad.push(`obs/p-${i}: ${id} belongs in p-${obsShard(id)}`);
    if (!fs.existsSync(fc)) bad.push('missing ' + fc); else for (const c of Object.keys(rd(fc).items || {})) if (candShard(c) !== i) bad.push(`cand/c-${i}: ${c} belongs in c-${candShard(c)}`);
  }
  for (const f of LATEST) if (!fs.existsSync(path.join(assets, 'gr-prices-v72', f))) bad.push('missing ' + f);
  return bad;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const here = path.dirname(fileURLToPath(import.meta.url)), args = process.argv.slice(2);
  if (args[0] === '--verify') { const bad = verifyLayout(path.resolve(args[1] || path.join(here, '../assets'))); console.log(bad.length ? bad.slice(0, 30).join('\n') + `\n${bad.length} problem(s)` : 'OK: every record is in the shard the worker reads'); process.exit(bad.length ? 1 : 0); }
  if (!args[0]) { console.error('usage: node tools/repack-v101.mjs <data checkout> [<assets dir>]  |  --verify [<assets dir>]'); process.exit(2); }
  console.log('packed', JSON.stringify(repack(path.resolve(args[0]), path.resolve(args[1] || path.join(here, '../assets')))));
}
