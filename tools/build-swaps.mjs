#!/usr/bin/env node
/** Builds assets/swaps-<revision>.json: every product of the bundled Greek catalogue that can be RECOMMENDED as a healthier swap, i.e. one with a grade FoodScan can stand
 * behind: the published Nutri-Score, or the official Nutri-Score 2023 calculated from its own complete numbers when the table is settled (quick grade, one letter, high
 * confidence). Each row carries what is needed to tell whether two products sit on the same shelf (Open Food Facts category tags, PNNS group, catalogue family, name,
 * Nutri-Score table) and to show the swap (name, brand, grade, points, photo). prices/swaps-v88.mjs does the matching in the browser.
 *   node tools/build-swaps.mjs            writes the file
 *   node tools/build-swaps.mjs --check    fails if the file is not what the catalogue produces (qa/swaps.test.mjs runs this) */
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), dir = path.join(here, '../assets/greece-r20261030');
const D = await import(pathToFileURL(path.join(here, '../assets/domain-v104.mjs')).href);
const Q = await import(pathToFileURL(path.join(here, '../prices/quick-grade-v85.mjs')).href);
const KIND = { general: 'g', beverage: 'b', water: 'w', cheese: 'c', fat: 'f' };
const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json')));
const IMG = /^https:\/\/images\.openfoodfacts\.org\/images\/products\/[\d/]+\/(front_[a-z]{2}\.\d+)\.(?:200|400)\.jpg$/;
const clean = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

export function build() {
  const rows = [], cats = new Map(), pnns = new Map(), id = (m, v) => (m.has(v) ? m.get(v) : (m.set(v, m.size), m.size - 1));
  for (const f of fs.readdirSync(dir).filter(f => f.startsWith('part-')).sort()) {
    const family = /^part-([a-z-]+)-\d+\.json$/.exec(f)[1];
    for (const raw of JSON.parse(fs.readFileSync(path.join(dir, f))).products) {
      const p = D.parseProduct({ status: 1, product: raw }, raw.code);
      if (!p.name || p.nameMissing || D.ns23Kinds(p).exempt || raw.nutriments?.alcohol_100g > 1.2) continue;
      let grade = /^[A-E]$/.test(p.nutriScore || '') ? p.nutriScore : '', pts = Number.isFinite(p.nutriScoreValue) ? p.nutriScoreValue : null, how = 'p';
      // 103: a drink the source graded with the table for solid foods (a soda at B, an iced tea at A) never enters the swaps with that letter:
      // the letter the drinks table gives is used when it is a single one, otherwise the product is left out
      const fix = D.ns23DrinkCheck(p);
      if (fix) { if (fix.state !== 'corrected') continue; grade = fix.calc.grade; pts = fix.calc.score; how = 'c'; }
      // the same for a drink whose published points leave out the sweeteners its ingredient list names (a zero-sugar cola at B)
      const sweet = fix ? null : D.ns23SweetenerCheck(p);
      if (sweet) { grade = sweet.calc.grade; pts = sweet.calc.score; how = 'c'; }
      // a product whose grade the app itself holds back (impossible values, a record that contradicts itself) is never offered as the better choice
      if (D.assessGrade(p).status === 'withheld') continue;
      const kinds = D.ns23Kinds(p), q = Q.quickGrade(p, { alcohol: raw.nutriments?.alcohol_100g });
      if (!grade) { if (!(q.ok && q.letters.length === 1 && q.confidence === 'high')) continue; grade = q.letters[0]; pts = q.data?.score ?? null; how = 'c'; }
      const kind = kinds.kinds?.length ? kinds.kinds[0] : q.kinds?.[0] || Q.inferKinds(p).kinds[0];
      const img = IMG.exec(raw.image_front_small_url || '')?.[1] || '';
      const tags = (raw.categories_tags || []).filter(t => /^[a-z]{2}:[a-z0-9-]{2,80}$/.test(t)).map(t => id(cats, t));
      rows.push([raw.code, clean(p.name, 90), clean((raw.brands || '').split(',')[0], 40), grade, pts, how, KIND[kind] || 'g', family, raw.pnns_groups_2 && raw.pnns_groups_2 !== 'unknown' ? id(pnns, raw.pnns_groups_2) : -1, tags, img]);
    }
  }
  rows.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return { schema: 1, revision: index.revision, source: 'Open Food Facts (ODbL), bundled Greek catalogue', fields: ['code', 'name', 'brand', 'grade', 'points', 'how (p published, c calculated)', 'kind', 'family', 'pnns', 'categories', 'image'], categories: [...cats.keys()], pnns: [...pnns.keys()], rows };
}
export const serialise = o => JSON.stringify(o);
export const fileFor = rev => path.join(here, `../assets/swaps-${rev}.json`);
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const o = build(), text = serialise(o), file = fileFor(o.revision);
  if (process.argv.includes('--check')) {
    const same = fs.existsSync(file) && fs.readFileSync(file, 'utf8') === text;
    console.log(same ? `OK: ${path.basename(file)} matches the catalogue (${o.rows.length} rows)` : 'DIFFERENT: run node tools/build-swaps.mjs'); process.exit(same ? 0 : 1);
  }
  fs.writeFileSync(file, text);
  console.log(`${path.basename(file)}: ${o.rows.length} rows (${o.rows.filter(r => r[5] === 'c').length} calculated), ${o.categories.length} category tags, ${text.length} bytes, sha256 ${crypto.createHash('sha256').update(text).digest('hex').slice(0, 16)}`);
}
