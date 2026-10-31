#!/usr/bin/env node
/** Golden fixtures for the 2023 calculator: real Open Food Facts API records that carry the SOURCE'S OWN component points
 * (nutriscore.2023.data.components), captured earlier in seven countries. For each product class a deterministic selection is written to
 * tests/fixtures/golden-off-2023.json, so the calculator is tested against OFF's numbers, not against itself.
 *   node tools/make-golden.mjs <dir with <country>/graded.json> */
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
const dir = resolve(process.argv[2] || 'D:/Claude/FoodScan/app/tests/grading');
const files = [];
const walk = d => { for (const e of readdirSync(d)) { const f = join(d, e); statSync(f).isDirectory() ? walk(f) : e === 'graded.json' && files.push(f); } };
walk(dir);
const classOf = d => d.is_water === 1 ? 'water' : d.is_beverage === 1 ? 'beverage' : d.is_cheese === 1 ? 'cheese' : d.is_fat_oil_nuts_seeds === 1 ? 'fat' : d.is_red_meat_product === 1 ? 'red-meat' : 'general';
const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const pools = {};
for (const f of files) for (const p of JSON.parse(readFileSync(f, 'utf8')).products) {
  const d = p.nutriscore?.['2023']?.data; if (!d?.components || !/^[a-e]$/.test(p.nutriscore_grade || '') || !Number.isFinite(p.nutriscore_score)) continue;
  (pools[classOf(d)] ||= []).push(p);
}
const keep = ['code', 'product_name', 'brands', 'quantity', 'nutrition_data_per', 'nutriscore_grade', 'nutriscore_score', 'categories_tags', 'countries_tags', 'ingredients_text', 'additives_tags', 'pnns_groups_2', 'nutriments', 'nutriscore'];
const out = {};
for (const [cls, list] of Object.entries(pools)) {
  list.sort((a, b) => hash(a.code) - hash(b.code));
  out[cls] = list.slice(0, 24).map(p => { const o = {}; for (const k of keep) if (p[k] !== undefined) o[k] = p[k]; return o; });
}
const target = resolve('tests/fixtures/golden-off-2023.json');
writeFileSync(target, JSON.stringify({ note: 'Real Open Food Facts API records with the source\'s own Nutri-Score 2023 component points (captured Oct 2026, ODbL).', classes: out }));
console.log(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, `${v.length} of ${pools[k].length}`])));
