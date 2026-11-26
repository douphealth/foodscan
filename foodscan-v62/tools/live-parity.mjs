#!/usr/bin/env node
/** Independent source check: re-reads a deterministic sample of catalogue products from the live Open Food Facts API (paced, one request
 * per ~1.3 s) and compares what FoodScan would show from the catalogue copy with what it would show from the live record.
 *   node tools/live-parity.mjs [--n 60] [--out release-qa/live-parity.json] [--domain src/domain.mjs]
 * Nothing here is written to the app: it only measures how stale a dated catalogue grade can be. */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const N = Number(arg('--n', 60)), out = arg('--out', 'release-qa/live-parity.json'), dir = resolve(arg('--dir', 'app/assets/greece-v610'));
const { parseProduct, assessGrade } = await import(pathToFileURL(resolve(arg('--domain', 'src/domain.mjs'))).href);
const manifest = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'));
const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const byFamily = {};
for (const f of readdirSync(dir).filter(f => /^part-.*\.json$/.test(f))) { const d = JSON.parse(readFileSync(join(dir, f), 'utf8')); for (const p of d.products) (byFamily[d.family] ||= []).push(p); }
// round-robin over families so the sample covers the catalogue, graded and ungraded records both
const wanted = arg('--codes', '') ? arg('--codes', '').split(',') : null;
const sample = []; const lists = Object.values(byFamily).map(l => l.sort((a, b) => hash(a.code) - hash(b.code)));
if (wanted) { for (const l of lists) for (const p of l) if (wanted.includes(String(p.code))) sample.push(p); }
else for (let i = 0; sample.length < N && lists.some(l => l[i]); i++) for (const l of lists) if (l[i] && sample.length < N) sample.push(l[i]);

const FIELDS = 'code,product_name,product_name_en,product_name_el,generic_name,brands,quantity,serving_size,serving_quantity,serving_quantity_unit,nutrition_data_per,nutriscore_grade,nutriscore_score,nutriscore,nutrition_grades,nova_group,ingredients_text,ingredients_text_en,ingredients_text_el,allergens_tags,traces_tags,labels_tags,categories_tags,countries_tags,additives_tags,additives_n,pnns_groups_2,data_quality_errors_tags,nutriments,last_modified_t,product_type,obsolete,image_front_small_url';
const UA = 'FoodScan-QA/62.0 (+https://food-scan.gearuptofit.com/how/)';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function live(code) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${FIELDS}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
      if (res.status === 404) return { missing: true };
      if (res.ok) { const j = await res.json(); return j.status === 1 || j.product ? { product: j.product } : { missing: true }; }
      if ([429, 502, 503].includes(res.status)) { await sleep(3000 * (attempt + 1)); continue; }
      return { error: res.status };
    } catch (e) { await sleep(2000 * (attempt + 1)); }
  }
  return { error: 'unreachable' };
}
const close = (a, b, tol) => a == null && b == null || a != null && b != null && Math.abs(a - b) <= tol;
const rows = [];
for (const raw of sample) {
  const cat = parseProduct({ product: raw, fetchedAt: manifest.exportedAt }, String(raw.code)), a = assessGrade(cat);
  const l = await live(raw.code);
  const row = { code: raw.code, name: raw.product_name, family: Object.keys(byFamily).find(k => byFamily[k].includes(raw)) };
  row.catalogue = { grade: a.grade, status: a.status, method: a.method, sourceGrade: raw.nutriscore_grade, modified: raw.last_modified_t };
  if (l.missing || l.error) { row.live = { missing: !!l.missing, error: l.error || null }; rows.push(row); await sleep(1300); continue; }
  const lp = parseProduct({ product: l.product, fetchedAt: Date.now() }, String(raw.code));
  if (!lp) { row.live = { unparseable: true }; rows.push(row); await sleep(1300); continue; }
  const b = assessGrade(lp), n1 = cat.nutrition, n2 = lp.nutrition;
  row.live = { grade: b.grade, status: b.status, method: b.method, modified: l.product.last_modified_t, greece: (l.product.countries_tags || []).includes('en:greece') };
  row.changedSince = (l.product.last_modified_t || 0) > (raw.last_modified_t || 0);
  row.sameShownGrade = a.grade === b.grade;
  row.nutritionSame = ['kcal', 'sugars', 'saturatedFat', 'salt', 'protein', 'fat'].every(k => close(n1[k], n2[k], Math.max(0.15, Math.abs(n1[k] || 0) * 0.02)));
  if (!row.sameShownGrade) row.diff = { catalogue: `${a.grade ?? '-'}/${a.status}`, live: `${b.grade ?? '-'}/${b.status}`, nutritionSame: row.nutritionSame, changedSince: row.changedSince };
  rows.push(row); process.stdout.write(row.sameShownGrade ? '.' : 'x'); await sleep(1300);
}
const have = rows.filter(r => r.live && !r.live.missing && !r.live.error && !r.live.unparseable);
const summary = { sampled: rows.length, readLive: have.length, notReadable: rows.length - have.length, sameShownGrade: have.filter(r => r.sameShownGrade).length, differentShownGrade: have.filter(r => !r.sameShownGrade).length,
  recordChangedSinceExport: have.filter(r => r.changedSince).length, nutritionIdentical: have.filter(r => r.nutritionSame).length, stillListedForGreece: have.filter(r => r.live.greece).length,
  gradedInCatalogue: have.filter(r => r.catalogue.grade).length, gradedAndSameGrade: have.filter(r => r.catalogue.grade && r.sameShownGrade).length,
  gradedButDifferentLetters: have.filter(r => r.catalogue.grade && r.live.grade && r.catalogue.grade !== r.live.grade).map(r => ({ code: r.code, name: r.name, catalogue: r.catalogue.grade, live: r.live.grade, changedSince: r.changedSince, nutritionSame: r.nutritionSame })) };
console.log('\n' + JSON.stringify(summary, null, 1));
mkdirSync(dirname(resolve(out)), { recursive: true });
writeFileSync(out, JSON.stringify({ capturedAt: new Date().toISOString(), catalogueRevision: manifest.revision, domain: arg('--domain', 'src/domain.mjs'), summary, rows }, null, 1));
