/* FoodScan 88: healthier swaps from the same shelf.
 * The product page used to look for alternatives only by the product's Open Food Facts category, in one market: a record with no category (half the Greek catalogue) or
 * a thin category got "No comparison available". This finds products of the SAME kind from the whole bundled Greek catalogue (assets/swaps-<rev>.json) and keeps only
 * those with a BETTER grade FoodScan can stand behind (published, or calculated from complete numbers). Same kind means, in order of weight: shared Open Food Facts
 * category tags (rare tags count more), the same PNNS group, a similar name (Greek and Greeklish spellings count as the same), the same catalogue family, and always
 * the same Nutri-Score table (a drink is never offered for a food). Measured on the catalogue: tools/swaps-validate.mjs, qa/swaps.test.mjs. Pure functions, no DOM. */
import { tokens } from './similar-v86.mjs';
import { ns23Fold } from '../assets/domain-v8500.mjs';

const KIND = { g: 'general', b: 'beverage', w: 'water', c: 'cheese', f: 'fat' };
export const RANK = { A: 0, B: 1, C: 2, D: 3, E: 4 };
/** weights of the signals; a signal the TARGET lacks is left out and the rest are rescaled, so a record with no category is judged on what it has */
const W = { cats: 0.5, pnns: 0.15, name: 0.25, family: 0.1 };
/** Printed on the card: floors of tools/swaps-validate.mjs (qa/swaps.test.mjs fails if a figure exceeds the measurement). */
export const SWAP_RELIABILITY = { aisle: 89, shelf: 75, aisleInferred: 70, shelfInferred: 56, sample: 3037 };
export const PARAMS = { minSim: 0.42, minCats: 0.34, limit: 6, gain: 0.07, requireCats: true };

export function prepare(json) {
  const catDf = new Map(), rows = json.rows.map(r => ({ code: r[0], name: r[1], brand: r[2], grade: r[3], points: r[4], how: r[5], kind: KIND[r[6]] || 'general', family: r[7], pnns: r[8] >= 0 ? json.pnns[r[8]] : '', cats: r[9].map(i => json.categories[i]), img: r[10], tokens: tokens(r[1]), key: ns23Fold(r[1]) + '|' + ns23Fold(r[2]) }));
  for (const r of rows) for (const c of r.cats) catDf.set(c, (catDf.get(c) || 0) + 1);
  const nameDf = new Map(); for (const r of rows) for (const t of r.tokens) nameDf.set(t, (nameDf.get(t) || 0) + 1);
  const idf = (m, t) => Math.log((rows.length + 1) / (1 + (m.get(t) || 0)));
  return { rows, catIdf: t => idf(catDf, t), nameIdf: t => idf(nameDf, t), catDf };
}

/** The image of a row, from the Open Food Facts image path (the catalogue stores only the file part). */
export function imageOf(row) {
  if (!row.img) return '';
  const c = String(row.code).padStart(13, '0'), p = c.length > 8 ? `${c.slice(0, 3)}/${c.slice(3, 6)}/${c.slice(6, 9)}/${c.slice(9)}` : c;
  return `https://images.openfoodfacts.org/images/products/${p}/${row.img}.200.jpg`;
}

/**
 * target: { code, name, brand, categories: [...tags], pnns, family, kind, grade (published or calculated letter, or null), estimate (likely letter of an estimate, or null) }
 * Returns { ok, mode: 'better' | 'best', against, swaps: [{ row, sim, why: [...] }], reason }.
 *   better: the target has a grade (or an estimate); only strictly better grades are offered.
 *   best:   the target has neither; the best-graded products of the same shelf are offered, and the card says the comparison is not against this product's grade.
 */
/** A record with no category: the shelf is borrowed from the products named most like it (and of the same table and family) - the category tags that nearly all of them
 *  share. Returns [] when they do not agree. */
export function inferShelf(t, prep, { k = 12, minName = 0.5, share = 0.6, exclude = null } = {}) {
  const ttoks = tokens(t.name || ''); if (!ttoks.length) return [];
  const total = ttoks.reduce((s, x) => s + prep.nameIdf(x), 0) || 1, set = new Set(ttoks), key = ns23Fold(t.name || '') + '|' + ns23Fold(t.brand || ''), near = [];
  for (const r of prep.rows) {
    if (!r.cats.length || r.code === t.code || r.code === exclude || r.key === key || (t.kind && r.kind !== t.kind)) continue;
    let nm = 0; for (const x of r.tokens) if (set.has(x)) nm += prep.nameIdf(x); nm /= total;
    if (nm >= minName) near.push({ r, w: nm + (t.family && t.family !== 'other' && r.family === t.family ? 0.2 : 0) });
  }
  if (near.length < 3) return [];
  near.sort((a, b) => b.w - a.w); const top = near.slice(0, k), sum = top.reduce((s, x) => s + x.w, 0), by = new Map();
  for (const { r, w } of top) for (const c of r.cats) by.set(c, (by.get(c) || 0) + w);
  return [...by].filter(([, w]) => w / sum >= share).map(([c]) => c);
}

export function findSwaps(t0, prep, { exclude = null, limit = PARAMS.limit, minSim = PARAMS.minSim, minCats = PARAMS.minCats, gain = PARAMS.gain, infer = true, requireCats = PARAMS.requireCats } = {}) {
  let t = t0, inferred = false;
  if (infer && !(t.categories || []).some(c => prep.catDf.has(c))) { const shelf = inferShelf(t, prep, { exclude }); if (shelf.length) { t = { ...t, categories: shelf }; inferred = true; } }
  const tcats = (t.categories || []).filter(c => prep.catDf.has(c)), ttoks = tokens(t.name || ''), family = t.family && t.family !== 'other' ? t.family : '', pnns = t.pnns && t.pnns !== 'unknown' ? t.pnns : '';
  const have = { cats: tcats.length > 0, pnns: Boolean(pnns), name: ttoks.length > 0, family: Boolean(family) };
  const wsum = Object.entries(W).reduce((s, [k, w]) => s + (have[k] ? w : 0), 0);
  if (!have.cats && !have.name) return { ok: false, reason: 'nothing-to-match' };
  const catTotal = tcats.reduce((s, c) => s + prep.catIdf(c), 0) || 1, nameTotal = ttoks.reduce((s, x) => s + prep.nameIdf(x), 0) || 1, tset = new Set(tcats), nset = new Set(ttoks);
  const against = t.grade || t.estimate || null, mode = against ? 'better' : 'best', key = ns23Fold(t.name || '') + '|' + ns23Fold(t.brand || '');
  const out = [];
  for (const r of prep.rows) {
    if (r.code === t.code || r.code === exclude || r.key === key) continue;
    if (requireCats && !r.cats.length) continue; // a swap must be on a known shelf, so that "same shelf" can be checked
    if (t.kind && r.kind !== t.kind) continue; // never a drink for a food, a cheese for a yogurt's table, ...
    if (against && RANK[r.grade] >= RANK[against]) continue;
    let cat = 0; if (have.cats) { for (const c of r.cats) if (tset.has(c)) cat += prep.catIdf(c); cat /= catTotal; if (cat < minCats && r.cats.length) continue; }
    let nm = 0; if (have.name) { for (const x of r.tokens) if (nset.has(x)) nm += prep.nameIdf(x); nm /= nameTotal; }
    const sim = ((have.cats ? W.cats * cat : 0) + (have.pnns ? W.pnns * (r.pnns === pnns ? 1 : 0) : 0) + (have.name ? W.name * nm : 0) + (have.family ? W.family * (r.family === family ? 1 : 0) : 0)) / wsum;
    if (sim < minSim) continue;
    if (have.cats && !r.cats.length && nm < 0.5) continue; // a candidate with no category of its own must at least be named like the target
    out.push({ row: r, sim, cat, nm, score: sim + gain * ((against ? RANK[against] : 4) - RANK[r.grade]) - 0.002 * (r.points ?? 0) });
  }
  if (!out.length) return { ok: false, mode, against, inferredShelf: inferred, reason: against === 'A' ? 'already-best' : 'none-found' };
  out.sort((a, b) => b.score - a.score);
  const seen = new Set(), swaps = [];
  for (const x of out) { const b = ns23Fold(x.row.brand) || x.row.code; if (seen.has(b + x.row.grade) && swaps.length >= 3) continue; seen.add(b + x.row.grade); swaps.push(x); if (swaps.length >= limit) break; } // a little brand variety
  swaps.sort((a, b) => RANK[a.row.grade] - RANK[b.row.grade] || b.score - a.score); // the healthiest first
  return { ok: true, mode, against, inferredShelf: inferred, swaps: swaps.map(x => ({ row: x.row, sim: Math.round(x.sim * 100) / 100, sharedCats: x.cat, sameName: x.nm, tier: inferred ? 'inferred' : have.cats && x.cat >= 0.6 ? 'shelf' : 'aisle' })) };
}
