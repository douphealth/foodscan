#!/usr/bin/env node
/** Catalogue audit: runs every shipped record through the app's own parser and grade engine and reports
 * internal contradictions, so every number in the validation report is reproducible.
 *   node tools/audit-catalogue.mjs [--dir app/assets/greece-v620] [--domain app/assets/domain-v620.mjs] [--out release-qa/catalogue-audit.json]
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const dir = resolve(arg('--dir', 'app/assets/greece-v610'));
const domainPath = resolve(arg('--domain', 'app/assets/domain-v610.mjs'));
const out = arg('--out', '');
const { parseProduct, assessGrade, estimateNutriScore, dataQuality } = await import(pathToFileURL(domainPath).href);

const manifest = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'));
const records = [];
for (const f of readdirSync(dir).filter(f => /^part-.*\.json$/.test(f))) {
  const d = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  for (const p of d.products) records.push({ raw: p, file: f, family: d.family });
}

const GRADES = 'ABCDE';
const gradeOfScore = s => s <= 0 ? 'A' : s <= 2 ? 'B' : s <= 10 ? 'C' : s <= 18 ? 'D' : 'E';
const tally = {};
const bump = (k, n = 1) => { tally[k] = (tally[k] || 0) + n; };
const examples = {};
const keep = (k, v) => { (examples[k] ||= []).length < 8 && examples[k].push(v); };
const now = manifest.exportedAt;
const ageDays = [];
const identity = new Map();

for (const { raw, family } of records) {
  let p = parseProduct({ product: raw, fetchedAt: manifest.exportedAt }, String(raw.code));
  if (p) p = { ...p, catalogueSnapshot: { provider: 'openfoodfacts-daily-export', exportedAt: manifest.exportedAt, revision: manifest.revision } };
  bump('records');
  if (!p) { bump('unparseable'); keep('unparseable', raw.code); continue; }
  const a = assessGrade(p);
  bump(`status:${a.status}`);
  bump(`family:${family}`);
  if (raw.last_modified_t) ageDays.push((now / 1000 - raw.last_modified_t) / 86400);
  if (!raw.categories_tags?.length) bump('noCategoryTags');
  if (!p.ingredients) bump('noIngredients');
  if (!p.image) bump('noImage');
  if (!(raw.countries_tags || []).includes('en:greece')) { bump('notListedGreece'); keep('notListedGreece', raw.code); }

  const q = dataQuality(p);
  if (q.state === 'blocked') { bump('blocked'); for (const r of q.reasons) bump(`blockedReason:${r.slice(0, 60)}`); keep('blocked', { code: p.barcode, name: p.name, reasons: q.reasons }); }

  // Source grade vs the points the source itself reports.
  const letter = /^[a-e]$/i.test(raw.nutriscore_grade || '') ? raw.nutriscore_grade.toUpperCase() : null;
  if (letter) {
    bump('sourceGraded');
    if (Number.isFinite(raw.nutriscore_score) && gradeOfScore(raw.nutriscore_score) !== letter) { bump('sourceGradeVsOwnScore'); keep('sourceGradeVsOwnScore', { code: p.barcode, name: p.name, letter, score: raw.nutriscore_score }); }
    const e = estimateNutriScore(p);
    if (e.ok) {
      bump('reproducible');
      if (e.grade !== letter) { bump('reproduceMismatch'); keep('reproduceMismatch', { code: p.barcode, name: p.name, source: letter, calculated: e.grade, range: e.range, score: raw.nutriscore_score }); }
    } else bump(`notReproducible:${e.reason}`);
    if (a.status === 'withheld') bump('gradedButWithheld');
  } else {
    bump('sourceUngraded');
    if (a.status === 'estimated') bump('ungradedButCalculated');
  }
  if (a.grade) bump(`shown:${a.grade}`);

  // Nutrition sanity.
  const n = p.nutrition;
  if (n.kcal != null && n.kj != null && Math.abs(n.kcal * 4.184 - n.kj) > Math.max(60, n.kj * 0.15)) { bump('kcalKjMismatch'); keep('kcalKjMismatch', { code: p.barcode, name: p.name, kcal: n.kcal, kj: n.kj }); }
  const fields = ['kcal', 'fat', 'saturatedFat', 'carbohydrates', 'sugars', 'protein', 'salt'].filter(k => n[k] != null).length;
  if (fields === 0) bump('noNutrition'); else if (fields < 5) bump('partialNutrition');
  if (n.salt != null && n.sodium != null && n.salt > 0 && Math.abs(n.sodium / 400 - n.salt) > Math.max(0.05, n.salt * 0.3)) bump('saltSodiumMismatch');

  // Duplicate identity (same brand + name + quantity under different barcodes).
  const key = `${(p.brand || '').toLowerCase()}|${(p.name || '').toLowerCase()}|${(p.quantity || '').toLowerCase()}`;
  if (p.name && !p.nameMissing) { if (!identity.has(key)) identity.set(key, []); identity.get(key).push(p.barcode); }
}
const dupGroups = [...identity.entries()].filter(([, v]) => v.length > 1);
tally.duplicateGroups = dupGroups.length;
tally.duplicateRecords = dupGroups.reduce((s, [, v]) => s + v.length, 0);
examples.duplicateGroups = dupGroups.slice(0, 8).map(([k, v]) => ({ key: k, codes: v }));
ageDays.sort((a, b) => a - b);
const pct = q => Math.round(ageDays[Math.floor(q * (ageDays.length - 1))]);
tally.sourceAgeDays = { p10: pct(0.1), p50: pct(0.5), p90: pct(0.9), olderThan2y: ageDays.filter(d => d > 730).length, olderThan4y: ageDays.filter(d => d > 1460).length };

const report = { generatedFrom: dir, manifestVersion: manifest.version, products: records.length, tally, examples };
const sorted = Object.fromEntries(Object.entries(tally).sort(([a], [b]) => a.localeCompare(b)));
console.log(JSON.stringify({ products: records.length, tally: sorted }, null, 1));
for (const k of ['reproduceMismatch', 'sourceGradeVsOwnScore', 'blocked', 'kcalKjMismatch', 'duplicateGroups']) console.log(`\n# examples ${k}`, JSON.stringify(examples[k] || [], null, 0).slice(0, 1500));
if (out) { mkdirSync(dirname(resolve(out)), { recursive: true }); writeFileSync(out, JSON.stringify(report, null, 1)); }
