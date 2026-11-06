#!/usr/bin/env node
/** Builds assets/estimates-<revision>.json: for every catalogue product with no published grade, what its product page shows, computed with the page's own order
 * (prices/reader-v85.js loadQuick): calculated from its own numbers > table from similar products > missing numbers borrowed > typical for similar products
 * (name, brand, maker, family) > not rated. Lists (search, categories) read it so a row shows the estimate the product page would show, marked as an estimate,
 * instead of "–". Format: code -> "LETTERS|LIKELY|TIER", tier q calculated, i borrowed, t typical, m maker, x not rated.
 *   node tools/build-estimates.mjs            writes the file
 *   node tools/build-estimates.mjs --check    fails if the file is not what the catalogue produces (qa/fill.test.mjs runs this) */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), dir = path.join(here, '../assets/greece-r20261030');
const D = await import(path.join(here, '../assets/domain-v8500.mjs')), Q = await import(path.join(here, '../prices/quick-grade-v85.mjs')), S = await import(path.join(here, '../prices/similar-v86.mjs')), P = await import(path.join(here, 'build-peers.mjs'));
const W = await import(path.join(here, '../prices/swaps-v88.mjs')), SW = await import(path.join(here, 'build-swaps.mjs'));
const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json')));
export const fileFor = rev => path.join(here, `../assets/estimates-${rev}.json`);

/** The page's verdict for one parsed product (p.family set): null when the page shows nothing, else { letters, likely, tier }. */
export function verdict(p, alcohol, prep, raw = null, swaps = null) {
  const a = D.assessGrade(p); if (a.grade || a.status === 'withheld') return null;
  const q = Q.quickGrade(p, { alcohol });
  if (q.ok) return { letters: q.letters, likely: q.likely || (q.letters.length === 1 ? q.letters[0] : ''), tier: 'q' };
  if (q.reason === 'exempt' || q.reason === 'excluded') return { letters: [], likely: '', tier: 'x' };
  if (!['inputs-missing', 'too-uncertain', 'no-table'].includes(q.reason)) return null;
  const pk = q.reason === 'too-uncertain' ? S.peerKind(p, prep) : null, q2 = pk ? Q.quickGrade(p, { alcohol, kindsOverride: [pk.kind] }) : null;
  if (q2?.ok) return { letters: q2.letters, likely: q2.likely || (q2.letters.length === 1 ? q2.letters[0] : ''), tier: 'q' };
  const sm = S.similarGrade(p, prep);
  if (sm.ok) return { letters: sm.letters, likely: sm.likely, tier: sm.mode === 'imputed' ? 'i' : sm.basis === 'maker' ? 'm' : 't' };
  if (!swaps || !(raw?.categories_tags || []).length) return null; // 89: products that share its categories (prices/reader-v85.js categoryEstimate)
  const k = D.ns23Kinds(p), kind = k.kinds?.length ? k.kinds[0] : Q.inferKinds(p).kinds[0];
  const cg = W.categoryGrade({ code: p.barcode, name: p.name, brand: (raw.brands || '').split(',')[0], categories: raw.categories_tags, kind }, swaps);
  return cg.ok ? { letters: cg.letters, likely: cg.likely, tier: 'c' } : null;
}

export function build() {
  const prep = S.prepare(JSON.parse(fs.readFileSync(P.fileFor(index.revision), 'utf8'))), swaps = W.prepare(JSON.parse(fs.readFileSync(SW.fileFor(index.revision), 'utf8'))), e = {};
  for (const f of fs.readdirSync(dir).filter(f => f.startsWith('part-')).sort()) {
    const family = /^part-([a-z-]+)-\d+\.json$/.exec(f)[1];
    for (const raw of JSON.parse(fs.readFileSync(path.join(dir, f))).products) {
      const p = D.parseProduct({ status: 1, product: raw }, raw.code); p.family = family;
      const v = verdict(p, raw.nutriments?.alcohol_100g, prep, raw, swaps); if (v) e[raw.code] = `${v.letters.join('')}|${v.likely}|${v.tier}`;
    }
  }
  return { schema: 1, revision: index.revision, format: 'code -> LETTERS|LIKELY|TIER (q calculated, i borrowed, t typical, m maker, c categories, x not rated)', e: Object.fromEntries(Object.entries(e).sort()) };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const o = build(), text = JSON.stringify(o), file = fileFor(o.revision);
  if (process.argv.includes('--check')) { const same = fs.existsSync(file) && fs.readFileSync(file, 'utf8') === text; console.log(same ? `OK: ${path.basename(file)} matches the catalogue` : 'DIFFERENT: run node tools/build-estimates.mjs'); process.exit(same ? 0 : 1); }
  fs.writeFileSync(file, text);
  const by = {}; for (const v of Object.values(o.e)) { const t = v.split('|')[2]; by[t] = (by[t] || 0) + 1; }
  console.log(`${path.basename(file)}: ${Object.keys(o.e).length} products ${JSON.stringify(by)}, ${text.length} bytes`);
}
