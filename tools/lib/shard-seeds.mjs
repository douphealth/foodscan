/** Seed files -> the sharded layout the worker reads (v79's own sharded-seed format, extended to every source).
 *
 *  <seeds>/bazaar-eshop-latest.json (one 0.9 MB object)  ->  <out>/bazaar-eshop-latest.json   manifest: schema 2, sharded:'bz/', source{...counts.products}, products:{}
 *                                                            <out>/bz/00.json .. bz/99.json   {schema:2, source:{snapshot}, products:{<14-digit barcode>: record}, rows:[]}
 *  The shard of a barcode is the last two digits of its 14-digit form. A lookup parses the ~2 KB manifest and one ~9 KB shard per source
 *  (about 1 ms) instead of 1.8 MB of JSON (about 18 ms: more than the Workers Free plan's ~10 ms CPU budget on a cold start).
 *  Records are copied untouched: nothing is recomputed here. */
import fs from 'node:fs';
import path from 'node:path';

export const SEED_DIRS = { 'posokanei-latest.json': 'pk/', 'ekatanalotis-latest.json': 'ek/', 'bazaar-eshop-latest.json': 'bz/', 'lidl-eshop-latest.json': 'li/' };
const key14 = c => String(c).replace(/\D/g, '').padStart(14, '0');

export function shardSeeds(inDir, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const summary = {};
  for (const [file, dir] of Object.entries(SEED_DIRS)) {
    const doc = JSON.parse(fs.readFileSync(path.join(inDir, file), 'utf8'));
    if (![1, 2].includes(doc.schema) || !doc.products || !doc.source?.snapshot) throw new Error(`${file}: not a seed file`);
    if (doc.sharded) throw new Error(`${file}: already sharded`);
    const shards = Array.from({ length: 100 }, () => ({}));
    let n = 0;
    for (const [code, rec] of Object.entries(doc.products)) { if (typeof rec === 'number') throw new Error(`${file}: row-shared records are not expected in a monolithic seed`); shards[Number(key14(code).slice(-2))][key14(code)] = rec; n++; }
    const { products, ...rest } = doc;
    const manifest = { ...rest, schema: 2, sharded: dir, source: { ...rest.source, counts: { ...(rest.source.counts || {}), products: n } }, products: {} };
    fs.rmSync(path.join(outDir, dir), { recursive: true, force: true }); fs.mkdirSync(path.join(outDir, dir), { recursive: true });
    shards.forEach((p, i) => fs.writeFileSync(path.join(outDir, dir, String(i).padStart(2, '0') + '.json'), JSON.stringify({ schema: 2, source: { snapshot: doc.source.snapshot }, products: p, rows: [] })));
    fs.writeFileSync(path.join(outDir, file), JSON.stringify(manifest));
    summary[file] = { products: n, biggestShardKB: Math.round(Math.max(...shards.map(s => JSON.stringify(s).length)) / 1024) };
  }
  return summary;
}
/** The inverse, for tests: manifest + shards -> the monolithic products object. */
export function unshard(dir, file) {
  const man = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')), products = {};
  for (const f of fs.readdirSync(path.join(dir, man.sharded)).sort()) Object.assign(products, JSON.parse(fs.readFileSync(path.join(dir, man.sharded, f), 'utf8')).products);
  return { manifest: man, products };
}
