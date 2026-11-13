#!/usr/bin/env node
/** Truthful coverage of the catalogue this release ships, per food family and overall, computed with the same engine the app uses.
 * Writes release-qa/coverage.json and release-qa/coverage.md. Coverage is "records Open Food Facts lists for Greece", never supermarket stock.
 *   node tools/catalogue-coverage.mjs [dir] */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseProduct, assessGrade, dataQuality } from '../src/domain.mjs';
import { ACTIVE_CATALOGUE_DIR } from '../tests/helpers.mjs';

const dir = resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : ACTIVE_CATALOGUE_DIR);
const m = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8')), snap = { provider: 'openfoodfacts-daily-export', exportedAt: m.exportedAt, revision: m.revision };
const rows = {}, add = (family, key) => { const r = (rows[family] ||= { records: 0 }); r[key] = (r[key] || 0) + 1; };
const ages = [];
for (const f of readdirSync(dir).filter(f => /^part-.*\.json$/.test(f))) {
  const d = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  for (const raw of d.products) {
    const fam = d.family, p0 = parseProduct({ product: raw, fetchedAt: m.exportedAt }, String(raw.code)); add(fam, 'records');
    if (raw.last_modified_t) ages.push((m.exportedAt / 1000 - raw.last_modified_t) / 86400);
    if (!p0) { add(fam, 'unparseable'); continue; }
    const p = { ...p0, catalogueSnapshot: snap }, a = assessGrade(p), q = dataQuality(p);
    if (p.name && !p.nameMissing) add(fam, 'named'); if (p.ingredients) add(fam, 'ingredients'); if ((raw.categories_tags || []).length) add(fam, 'categories'); if (p.image) add(fam, 'photo');
    const n = p.nutrition; if (['kcal', 'sugars', 'saturatedFat', 'salt'].every(k => n[k] != null) && n.fat != null && n.protein != null) add(fam, 'fullNutrition'); else if (!Object.values(n).some(v => typeof v === 'number')) add(fam, 'noNutrition');
    if (p.nutriScore) add(fam, 'sourceGraded');
    if (a.status === 'withheld') add(fam, 'withheld'); else if (a.method) add(fam, 'comparableGrade'); else if (a.grade) add(fam, 'gradeNotComparable');
    if (q.state === 'blocked') add(fam, 'quarantined');
  }
}
const total = Object.values(rows).reduce((t, r) => { for (const [k, v] of Object.entries(r)) t[k] = (t[k] || 0) + v; return t; }, {});
ages.sort((a, b) => a - b); const med = ages[Math.floor(ages.length / 2)], pct = (a, b) => (b ? Math.round(a / b * 1000) / 10 : 0);
const report = { catalogue: { revision: m.revision, exportedAt: new Date(m.exportedAt).toISOString(), products: m.productCount, source: m.source, license: m.license, note: 'Records Open Food Facts lists for Greece. Not a complete inventory of Greek supermarkets, not stock, not prices.' },
  overall: { ...total, medianDaysSinceLastEdit: Math.round(med), olderThanTwoYears: ages.filter(d => d > 730).length }, byFamily: rows };
writeFileSync(resolve('release-qa/coverage.json'), JSON.stringify(report, null, 1));
const cols = ['records', 'named', 'ingredients', 'categories', 'fullNutrition', 'sourceGraded', 'comparableGrade', 'gradeNotComparable', 'withheld'];
const md = [`# Catalogue coverage: ${m.revision}`, '', `${m.productCount} records Open Food Facts lists for Greece (export ${new Date(m.exportedAt).toISOString().slice(0, 10)}). Not a complete inventory of supermarket products and not stock or prices. Percentages are of the family's records.`, '', `| family | ${cols.join(' | ')} |`, `|${'---|'.repeat(cols.length + 1)}`,
  ...Object.entries(rows).sort((a, b) => b[1].records - a[1].records).map(([f, r]) => `| ${f} | ${r.records} | ${cols.slice(1).map(c => pct(r[c] || 0, r.records) + '%').join(' | ')} |`),
  `| **all** | ${total.records} | ${cols.slice(1).map(c => pct(total[c] || 0, total.records) + '%').join(' | ')} |`, '', `Median record last edited ${Math.round(med)} days before the export; ${ages.filter(d => d > 730).length} records not edited for over two years.`].join('\n');
writeFileSync(resolve('release-qa/coverage.md'), md + '\n');
console.log(JSON.stringify({ products: m.productCount, ...Object.fromEntries(cols.map(c => [c, `${pct(total[c] || 0, total.records)}%`])) }));
