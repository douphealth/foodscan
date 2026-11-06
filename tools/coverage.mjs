#!/usr/bin/env node
/** How many products of the bundled catalogue end up with what, using the same order the product page uses:
 *  published grade > calculated estimate (quick grade) > not rated (the method does not cover it) > estimate from similar products > nothing (photo offered). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const W = await import(path.join(here, '../prices/swaps-v88.mjs')), SW = await import(path.join(here, 'build-swaps.mjs'));
const D = await import(path.join(here, '../assets/domain-v8500.mjs')), Q = await import(path.join(here, '../prices/quick-grade-v85.mjs')), S = await import(path.join(here, '../prices/similar-v86.mjs')), B = await import(path.join(here, 'build-peers.mjs'));
export function coverage() {
  const dir = path.join(here, '../assets/greece-r20261030'), prep = S.prepare(JSON.parse(fs.readFileSync(B.fileFor(JSON.parse(fs.readFileSync(path.join(dir, 'index.json'))).revision), 'utf8'))), swaps = W.prepare(JSON.parse(fs.readFileSync(SW.fileFor(JSON.parse(fs.readFileSync(path.join(dir, 'index.json'))).revision), 'utf8')));
  const c = { total: 0, published: 0, calculated: 0, notRated: 0, imputed: 0, typical: 0, maker: 0, category: 0, none: 0 };
  for (const f of fs.readdirSync(dir).filter(f => f.startsWith('part-')).sort()) for (const raw of JSON.parse(fs.readFileSync(path.join(dir, f))).products) {
    c.total++;
    const p = D.parseProduct({ status: 1, product: raw }, raw.code), a = D.assessGrade(p);
    p.family = /^part-([a-z-]+)-\d+\.json$/.exec(f)[1]; // as the worker reports it (catalogueSnapshot.family)
    if (a.grade) { c.published++; continue; }
    let q = Q.quickGrade(p, { alcohol: raw.nutriments?.alcohol_100g });
    if (q.ok) { c.calculated++; continue; }
    if (q.reason === 'exempt' || q.reason === 'excluded') { c.notRated++; continue; }
    if (['inputs-missing', 'too-uncertain', 'no-table'].includes(q.reason)) {
      const pk = q.reason === 'too-uncertain' ? S.peerKind(p, prep) : null, q2 = pk ? Q.quickGrade(p, { alcohol: raw.nutriments?.alcohol_100g, kindsOverride: [pk.kind] }) : null;
      if (q2?.ok) { c.calculated++; continue; }
      const sm = S.similarGrade(p, prep); if (sm.ok) { c[sm.mode === 'typical' && sm.basis === 'maker' ? 'maker' : sm.mode]++; continue; }
      if ((raw.categories_tags || []).length) { const k = D.ns23Kinds(p), kind = k.kinds?.length ? k.kinds[0] : Q.inferKinds(p).kinds[0]; if (W.categoryGrade({ code: p.barcode, name: p.name, brand: (raw.brands || '').split(',')[0], categories: raw.categories_tags, kind }, swaps).ok) { c.category++; continue; } }
    }
    c.none++;
  }
  return c;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const c = coverage(), pct = n => `${n} (${(100 * n / c.total).toFixed(1)} %)`;
  console.log(`Catalogue ${c.total} products\n  published grade (what the app shows today)      ${pct(c.published)}\n  calculated estimate from its own numbers          ${pct(c.calculated)}\n  estimate: missing numbers borrowed from similar   ${pct(c.imputed)}\n  estimate: typical for similar products            ${pct(c.typical)}\n  estimate: typical for the maker's similar products ${pct(c.maker)}\n  estimate: typical for products in its categories  ${pct(c.category)}\n  not rated (the method does not cover it)          ${pct(c.notRated)}\n  nothing to show but the label photo               ${pct(c.none)}\n  => some grade or an explanation for ${pct(c.total - c.none)}`);
}
