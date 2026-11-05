/* FoodScan 86: a grade estimate from similar products, for the products the record cannot grade by itself.
 *   typical:  the record has no usable nutrition (or none at all). The product is matched by brand and name to graded products of the catalogue; the estimate is
 *             the band of letters those products carry ("products like this are usually C or D"). It says nothing about this exact product's numbers.
 *   imputed:  the record has SOME numbers (energy, fat, ... but not sugars or salt). The missing ones are borrowed from the most similar products whose known numbers
 *             also match, one product at a time, and the official Nutri-Score 2023 points are computed for every borrowed combination; the estimate is the band of
 *             letters that results.
 * Neither is shown as a calculated grade: the card says what it is, lists the similar products it used, and quotes how often this kind of estimate has contained the
 * published letter (tools/similar-validate.mjs, qa/similar.test.mjs). Pure functions; the peers come from assets/peers-<revision>.json (tools/build-peers.mjs). */
import { ns23Score, ns23Fold } from '../assets/domain-v8500.mjs';
import { inferKinds } from './quick-grade-v85.mjs';

const KIND = { g: 'general', b: 'beverage', w: 'water', c: 'cheese', f: 'fat' };
const STOP = new Set('and the with from for of in a an the με και απο για του της των το τα την στο στη kai mit und der die das de la le les del di da pack packet product προιον συσκευασια'.split(' '));
// 87.2: Greek script and Greeklish written the same product in different ways ("μπισκότα", "mpiskota", "biskota"); both are reduced to one sound skeleton
const GR = { 'ου': 'u', 'μπ': 'b', 'ντ': 'd', 'γκ': 'g', 'γγ': 'g', 'αι': 'e', 'ει': 'i', 'οι': 'i', 'υι': 'i', 'αυ': 'av', 'ευ': 'ev', 'θ': 'th', 'ψ': 'ps', 'ξ': 'x', 'χ': 'x', 'α': 'a', 'β': 'v', 'γ': 'g', 'δ': 'd', 'ε': 'e', 'ζ': 'z', 'η': 'i', 'ι': 'i', 'κ': 'k', 'λ': 'l', 'μ': 'm', 'ν': 'n', 'ο': 'o', 'π': 'p', 'ρ': 'r', 'σ': 's', 'ς': 's', 'τ': 't', 'υ': 'i', 'φ': 'f', 'ω': 'o' };
const LAT = [['mp', 'b'], ['nt', 'd'], ['gk', 'g'], ['ou', 'u'], ['ai', 'e'], ['ei', 'i'], ['oi', 'i'], ['ch', 'x'], ['ks', 'x'], ['ph', 'f'], ['y', 'i'], ['w', 'o'], ['h', 'i'], ['c', 'k'], ['q', 'k']];
export const skeleton = t => { let x = t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/ου|μπ|ντ|γκ|γγ|αι|ει|οι|υι|αυ|ευ|[α-ως]/g, m => GR[m] ?? m); for (const [a, b] of LAT) x = x.split(a).join(b); return x.replace(/(.)\1+/g, '$1'); };
const tokens = s => [...new Set(ns23Fold(s || '').split(/[^\p{L}]+/u).filter(t => t.length >= 3 && !STOP.has(t)).map(skeleton))];
/** The maker's part of a barcode: GS1 company prefixes are 7 to 9 digits (13-digit form). In-store and restricted codes (2x, 02x, 04x) and short codes say nothing about the maker. */
export const makerOf = code => { const c = String(code || '').replace(/\D/g, '').padStart(13, '0').slice(-13); return /^(0000|02|04|2)/.test(c) ? '' : c; };
const makerSim = (a, b) => { if (!a || !b) return 0; let i = 0; while (i < 13 && a[i] === b[i]) i++; return i >= 9 ? 1 : i >= 8 ? 0.8 : i >= 7 ? 0.5 : 0; };
const FIELDS = ['kj', 'sugars', 'saturatedFat', 'salt', 'fibre', 'protein', 'fat', 'carbohydrates'];
// how far apart two values may be and still count as "the same kind of product": relative share plus an absolute slack per nutrient
const SLACK = { kj: 60, sugars: 1.5, saturatedFat: 0.8, salt: 0.15, fibre: 1, protein: 1.5, fat: 1.5, carbohydrates: 3 };
const known = v => typeof v === 'number' && Number.isFinite(v);

/** peers JSON -> searchable structure */
export function prepare(json) {
  const rows = json.rows.map(r => ({ code: r[0], name: r[1], brand: r[2], grade: r[3], kind: KIND[r[4]] || 'general', family: r[5], v: r[6], tokens: tokens(r[1]), maker: makerOf(r[0]) }));
  const df = new Map(); for (const r of rows) for (const t of r.tokens) df.set(t, (df.get(t) || 0) + 1);
  const idf = t => Math.log((rows.length + 1) / (1 + (df.get(t) || 0)));
  const byBrand = new Map(); for (const r of rows) if (r.brand) (byBrand.get(r.brand) || byBrand.set(r.brand, []).get(r.brand)).push(r);
  return { rows, idf, byBrand };
}

function targetVector(p) {
  const n = p.nutrition || {};
  return [known(n.kj) ? n.kj : known(n.kcal) ? n.kcal * 4.184 : null, n.sugars, n.saturatedFat, n.salt, n.fiber, n.protein, n.fat, n.carbohydrates].map(v => (known(v) ? v : null));
}
/** 0 = identical on every number both have, 1 = nothing alike */
function distance(a, b) {
  let sum = 0, n = 0;
  for (let i = 0; i < FIELDS.length; i++) if (a[i] !== null && b[i] !== null) { const f = FIELDS[i]; sum += Math.min(1, Math.abs(a[i] - b[i]) / (Math.max(a[i], b[i]) * 0.35 + SLACK[f])); n++; }
  return n ? sum / n : 0.5;
}

const NEEDED = [0, 1, 2, 3]; // energy, sugars, saturated fat, salt: what a grade needs
/** The estimate for a normalised product (domain parseProduct) from the prepared peers; `exclude` removes a code (and, with `noTwins`, products with the same name and brand). */
/** Parameters chosen on the catalogue (tools/similar-validate.mjs): with numbers known, similar numbers matter more than similar names. */
/** 87.2, typical: with no numbers, the maker (from the barcode) and the catalogue's product family count too; measured leave-one-out (tools/similar-validate.mjs). */
const PARAMS = { imputed: { minSim: 0, k: 25, mass: 0.9, dMax: 0.35, bonus: 0.1 }, typical: { minSim: 0.2, k: 40, mass: 0.85, dMax: 0.4, bonus: 0 } };
const TYPICAL_W = { name: 0.45, brand: 0.2, maker: 0.2, family: 0.15 };
export function similarGrade(p, prep, { exclude = null, noTwins = false, maxWidth = 3, ...override } = {}) {
  const name = p.name || '', toks = tokens(name), brand = ns23Fold((p.brand || '').split(',')[0]).trim();
  const tv = targetVector(p), have = tv.map(v => v !== null), complete = NEEDED.every(i => have[i]);
  const knownCount = have.filter(Boolean).length, { minSim, k, mass, dMax, bonus } = { ...PARAMS[knownCount >= 3 ? 'imputed' : 'typical'], ...override };
  if (complete) return { ok: false, reason: 'complete' };
  const maker = makerOf(p.barcode || p.code), family = p.family && p.family !== 'other' ? p.family : '', typical = knownCount < 3, named = Boolean(toks.length || brand);
  if (!named && !(typical && (maker || family))) return { ok: false, reason: 'no-name' };
  const idfSum = toks.reduce((s, t) => s + prep.idf(t), 0) || 1, set = new Set(toks);
  const inf = inferKinds(p), kindOf = peer => (inf.via === 'default' ? peer.kind : inf.kinds[0]);
  const scored = [];
  for (const peer of prep.rows) {
    if (peer.code === exclude) continue;
    if (noTwins && peer.name === ns23Fold(name) && peer.brand === brand) continue;
    const brandEq = brand && peer.brand === brand ? 1 : 0;
    let overlap = 0; for (const t of peer.tokens) if (set.has(t)) overlap += prep.idf(t);
    const nameSim = toks.length ? overlap / idfSum : 0;
    const sim = typical ? TYPICAL_W.name * nameSim + TYPICAL_W.brand * brandEq + TYPICAL_W.maker * makerSim(maker, peer.maker) + TYPICAL_W.family * (family && peer.family === family ? 1 : 0) : 0.65 * nameSim + 0.35 * brandEq;
    if (sim < minSim) continue;
    if (knownCount >= 3 && NEEDED.some(i => peer.v[i] === null)) continue; // a peer with no numbers cannot lend any
    const d = knownCount ? distance(tv, peer.v) : 0;
    if (d > dMax) continue;
    scored.push({ peer, sim, d, w: (sim + bonus) * (1 - d) ** 2 });
  }
  if (scored.length < 3) return { ok: false, reason: 'no-similar', n: scored.length };
  scored.sort((a, b) => b.w - a.w);
  const top = scored.slice(0, k), anyKnown = knownCount >= 3;
  const mode = anyKnown ? 'imputed' : 'typical', dist = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  let total = 0;
  for (const { peer, w } of top) {
    let letter;
    if (!anyKnown && peer.grade) letter = peer.grade;
    else {
      const v = FIELDS.map((_, i) => (have[i] ? tv[i] : peer.v[i]));
      if (NEEDED.some(i => v[i] === null)) continue;
      const kind = kindOf(peer); if (kind === 'water') { letter = 'A'; } else if (kind === 'fat' && v[6] === null) continue;
      else letter = ns23Score({ kj: v[0], sugars: v[1], saturatedFat: v[2], salt: v[3], fibre: v[4] ?? 0, protein: v[5] ?? 0, fat: v[6], fvl: 0, sweeteners: 0, redMeat: false }, kind).grade;
    }
    dist[letter] += w; total += w;
  }
  if (!total) return { ok: false, reason: 'no-similar', n: 0 };
  const L = 'ABCDE'; let best = null;
  for (let a = 0; a < 5; a++) for (let b = a; b < 5; b++) { let m = 0; for (let i = a; i <= b; i++) m += dist[L[i]]; m /= total; if (m >= mass && (!best || b - a < best.b - best.a || (b - a === best.b - best.a && m > best.m))) best = { a, b, m }; }
  const letters = [...L].slice(best.a, best.b + 1), likely = [...L].sort((x, y) => dist[y] - dist[x])[0];
  if (letters.length > maxWidth) return { ok: false, reason: 'too-wide', letters, dist };
  const distN = Object.fromEntries(Object.entries(dist).map(([g, w]) => [g, w / total]));
  return { ok: true, mode, basis: mode === 'typical' && !named ? 'maker' : 'name', letters, likely, share: Math.round(best.m * 100) / 100, dist: distN, n: top.length, topSim: Math.round(top[0].sim * 100) / 100, kind: inf.via === 'default' ? top[0].peer.kind : inf.kinds[0],
    imputed: mode === 'imputed' ? ['sugars', 'saturatedFat', 'salt'].filter((_, i) => !have[i + 1]).concat(have[0] ? [] : ['energy']) : [],
    peers: top.slice(0, 6).map(({ peer }) => ({ code: peer.code, name: peer.name, brand: peer.brand, grade: peer.grade })) };
}

/** The Nutri-Score table most of the similar products use, when nearly all agree: for a product whose own figures are complete but whose table is unknown. */
export function peerKind(p, prep, { minShare = 0.75, minSim = 0.3, k = 25 } = {}) {
  const toks = tokens(p.name || ''), brand = ns23Fold((p.brand || '').split(',')[0]).trim();
  if (!toks.length && !brand) return null;
  const idfSum = toks.reduce((s, t) => s + prep.idf(t), 0) || 1, set = new Set(toks), top = [];
  for (const peer of prep.rows) {
    let overlap = 0; for (const t of peer.tokens) if (set.has(t)) overlap += prep.idf(t);
    const sim = 0.65 * (overlap / idfSum) + (brand && peer.brand === brand ? 0.35 : 0);
    if (sim >= minSim) top.push({ kind: peer.kind, sim });
  }
  if (top.length < 3) return null;
  top.sort((a, b) => b.sim - a.sim); const use = top.slice(0, k), total = use.reduce((s, x) => s + x.sim, 0), by = {};
  for (const x of use) by[x.kind] = (by[x.kind] || 0) + x.sim;
  const [kind, w] = Object.entries(by).sort((a, b) => b[1] - a[1])[0];
  return w / total >= minShare ? { kind, share: Math.round(100 * w / total) / 100, n: use.length } : null;
}
