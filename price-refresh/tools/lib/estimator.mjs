/* FoodScan 77 · comparable-product price estimator (pure functions, Node only; the output is shipped as static shards).
 *
 * An estimate is NEVER a recorded price. It answers: "what do comparable products with a recorded price cost?"
 * Reference items are real, dated observations: the Ministry price observatory (posokanei: median of the Greek chains that
 * report the product), and the Bazaar and Lidl web shops. A query (a barcode with a name, brand and pack size from Open
 * Food Facts) is compared with every reference item that shares a word with it:
 *   score = 0.65 * idf-weighted cosine of the descriptive words (Greek/Latin spelling folded by the phonetic skeleton)
 *         + 0.20 * same brand + 0.15 * pack-size closeness
 * The estimate is the score-weighted median of the neighbours' unit prices (EUR per kg, per L or per piece) times the
 * query's own pack size. The range is NOT a guess: it comes from the measured errors of the same procedure on products whose
 * price is known (leave-one-out, tools/build-price-data.mjs), per confidence class. */
import { canon, skel, tokens, packSize, brandSk, findBrand } from './matcher.mjs';

export const STEM = sk => (sk.length >= 6 ? sk.slice(0, 5) : sk);
const median = a => { const s = a.slice().sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
export const quantile = (a, q) => { const s = a.slice().sort((x, y) => x - y); if (!s.length) return null; const p = (s.length - 1) * q, i = Math.floor(p); return s[i] + (s[Math.min(i + 1, s.length - 1)] - s[i]) * (p - i); };
export function weightedMedian(vals, weights) {
  const pairs = vals.map((v, i) => [v, weights[i]]).sort((a, b) => a[0] - b[0]);
  const total = pairs.reduce((s, p) => s + p[1], 0); let acc = 0;
  for (const [v, w] of pairs) { acc += w; if (acc >= total / 2) return v; }
  return pairs.at(-1)?.[0] ?? null;
}

/** A name/brand/quantity record -> the features used for comparison. */
export function features({ name, brand, quantity, productQuantity }) {
  const full = String(name || '').trim();
  const bsk = brand ? brandSk(brand, '') : [];
  let size = packSize(full, quantity);
  if (!size && productQuantity > 0) {
    const text = (full + ' ' + (quantity || '')).toLowerCase();
    size = /\b(?:ml|cl|l|lt|lit|liter|litre|λιτρ)/.test(text) ? { unit: 'l', amount: productQuantity / 1000 } : /(?:^|\s)\d+(?:[.,]\d+)?\s*(?:g|gr|kg|γρ)/.test(text) ? { unit: 'kg', amount: productQuantity / 1000 } : null;
  }
  const toks = tokens(full);
  const bpos = bsk.length ? findBrand(toks, bsk) : null;
  const words = toks.filter((t, i) => !(bpos && i >= bpos[0] && i < bpos[1]) && !t.init && !(bsk.length && t.sk === bsk.join('')));
  return { full, bsk, bkey: bsk.join(''), size, words: [...new Set(words.map(t => (t.num ? 'n:' + t.sk : STEM(t.sk))))] };
}

export function buildIndex(items) {
  const df = new Map(), post = new Map();
  items.forEach((it, i) => {
    for (const w of it.f.words) { df.set(w, (df.get(w) || 0) + 1); if (!post.has(w)) post.set(w, []); post.get(w).push(i); }
  });
  const N = items.length, idf = w => Math.log(1 + N / (1 + (df.get(w) || 0)));
  return { items, df, post, idf, N };
}

const sizeSim = (a, b) => (a && b && a.unit === b.unit && a.amount > 0 && b.amount > 0) ? Math.exp(-Math.abs(Math.log(a.amount / b.amount))) : 0;

/** All neighbours of one query with their scores, best first (at most `limit`). `skip(item)` removes items that are the product itself. */
export function neighbours(index, q, { limit = 12, minScore = 0.3, skip = null, maxDf = 900 } = {}) {
  if (!q.words.length) return [];
  const { items, post, idf } = index;
  const qW = q.words.reduce((s, w) => s + idf(w), 0);
  if (qW <= 0) return [];
  const cand = new Map();
  for (const w of q.words) {
    const list = post.get(w); if (!list || list.length > maxDf) continue;
    const wi = idf(w);
    for (const i of list) cand.set(i, (cand.get(i) || 0) + wi);
  }
  const out = [];
  for (const [i, common] of cand) {
    const it = items[i]; if (skip && skip(it)) continue;
    const cW = it.f.words.reduce((s, w) => s + idf(w), 0);
    const cos = common / Math.sqrt(qW * Math.max(cW, 1e-9));
    const brandSame = q.bkey && it.f.bkey && q.bkey === it.f.bkey ? 1 : 0;
    const brandDiff = q.bkey && it.f.bkey && q.bkey !== it.f.bkey ? 1 : 0;
    const sz = sizeSim(q.size, it.f.size);
    const score = 0.65 * cos + 0.20 * brandSame + 0.15 * sz - 0.08 * brandDiff;
    if (score >= minScore) out.push({ i, score, cos, brandSame: !!brandSame, sz });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}

/** Estimate from neighbours: unit price (weighted median) and, when the query pack size is known in the same unit, the pack price. */
export function estimateFrom(index, q, nbrs, { k = 7 } = {}) {
  if (!nbrs.length) return null;
  // use the unit most of the strong neighbours share, and (if the query states one) that unit only
  const want = q.size?.unit || null;
  let pool = nbrs.filter(n => index.items[n.i].unit && (!want || index.items[n.i].unit === want));
  if (!pool.length) return null;
  const unit = want || (() => { const c = {}; for (const n of pool.slice(0, k)) c[index.items[n.i].unit] = (c[index.items[n.i].unit] || 0) + n.score; return Object.entries(c).sort((a, b) => b[1] - a[1])[0][0]; })();
  pool = pool.filter(n => index.items[n.i].unit === unit);
  // category consistency: when most of the neighbour weight sits in one observatory category, drop neighbours of other categories
  // ("Olive" hand cream next to olive oil). Items with no category (web-shop names) stay.
  const catW = new Map(); let catTotal = 0;
  for (const n of pool.slice(0, k + 3)) { const c = index.items[n.i].cat; if (!c) continue; const w = Math.pow(n.score, 3); catW.set(c, (catW.get(c) || 0) + w); catTotal += w; }
  let modal = null; if (catTotal > 0) { const [c, w] = [...catW.entries()].sort((a, b) => b[1] - a[1])[0]; if (w / catTotal >= 0.45) modal = c; }
  if (modal) pool = pool.filter(n => !index.items[n.i].cat || index.items[n.i].cat === modal);
  const use = pool.slice(0, k);
  if (!use.length) return null;
  const vals = use.map(n => index.items[n.i].unitPrice), wts = use.map(n => Math.pow(n.score, 3));
  const unitMid = weightedMedian(vals, wts);
  const top = use[0].score;
  return { unit, unitMid, n: use.length, top, brandSame: use.some(n => n.brandSame), size: q.size && q.size.unit === unit ? q.size.amount : null, use, category: modal };
}

/** Confidence class of the neighbour search by its best score; below 0.38 there is no estimate (class E is the separate category model). */
export const classOf = top => (top >= 0.7 ? 'A' : top >= 0.55 ? 'B' : top >= 0.45 ? 'C' : top >= 0.38 ? 'D' : null);
