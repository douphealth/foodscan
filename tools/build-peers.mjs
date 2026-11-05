#!/usr/bin/env node
/** Builds assets/peers-<revision>.json from the bundled catalogue: one compact row for every product that has a published Nutri-Score or all four numbers a grade needs.
 * The quick grade uses it to estimate a grade for a product the record cannot grade by itself (prices/similar-v86.mjs): from similar products' real values, never invented.
 *   node tools/build-peers.mjs            writes the file
 *   node tools/build-peers.mjs --check    fails if the file is not what the catalogue produces (qa/similar.test.mjs runs this) */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), dir = path.join(here, '../assets/greece-r20261030');
const D = await import(path.join(here, '../assets/domain-v8500.mjs'));
const Q = await import(path.join(here, '../prices/quick-grade-v85.mjs'));
const KIND = { general: 'g', beverage: 'b', water: 'w', cheese: 'c', fat: 'f' };
const r = (v, d = 1) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 10 ** d) / 10 ** d : null);
const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json')));

export function build() {
  const rows = [];
  for (const f of fs.readdirSync(dir).filter(f => f.startsWith('part-')).sort()) {
    const shard = JSON.parse(fs.readFileSync(path.join(dir, f)));
    for (const raw of shard.products) {
      const p = D.parseProduct({ status: 1, product: raw }, raw.code), grade = /^[A-E]$/.test(p.nutriScore || '') ? p.nutriScore : '', complete = Boolean(D.ns23Inputs(p));
      if (!grade && !complete) continue;
      if (D.ns23Kinds(p).exempt || raw.nutriments?.alcohol_100g > 1.2) continue;
      const n = p.nutrition || {}, where = D.ns23Kinds(p), inf = where.kinds.length ? where.kinds[0] : Q.inferKinds(p).kinds[0];
      rows.push([raw.code, D.ns23Fold(p.name || ''), D.ns23Fold((raw.brands || '').split(',')[0]).trim(), grade, KIND[inf] || 'g', shard.family,
        [r(n.kj ?? (n.kcal != null ? n.kcal * 4.184 : null), 0), r(n.sugars), r(n.saturatedFat), r(n.salt, 2), r(n.fiber), r(n.protein), r(n.fat), r(n.carbohydrates)]]);
    }
  }
  rows.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return { schema: 1, revision: index.revision, fields: ['code', 'name', 'brand', 'grade', 'kind', 'family', ['kj', 'sugars', 'saturatedFat', 'salt', 'fibre', 'protein', 'fat', 'carbohydrates']], rows };
}
export const serialise = o => JSON.stringify(o);
export const fileFor = rev => path.join(here, `../assets/peers-${rev}.json`);
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const o = build(), text = serialise(o), file = fileFor(o.revision);
  if (process.argv.includes('--check')) {
    const same = fs.existsSync(file) && fs.readFileSync(file, 'utf8') === text;
    console.log(same ? `OK: ${path.basename(file)} matches the catalogue (${o.rows.length} rows)` : `DIFFERENT: run node tools/build-peers.mjs`); process.exit(same ? 0 : 1);
  }
  fs.writeFileSync(file, text);
  console.log(`${path.basename(file)}: ${o.rows.length} rows, ${text.length} bytes, sha256 ${crypto.createHash('sha256').update(text).digest('hex').slice(0, 16)}`);
}
