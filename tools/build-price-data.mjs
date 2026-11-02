#!/usr/bin/env node
/** Builds the v77 price shards: exact, dated observations per barcode (from the four source files) + a measured estimate
 *  for barcodes that have no recorded price.
 *
 *   node tools/build-price-data.mjs --pk <posokanei snapshot.json> --off <extract.json> --seeds <dir with the 4 source files> --out <dir> [--now 2026-10-31]
 *
 * Output (dir): p-00..p-63.json (barcode -> {n, q, o:[observations], e:estimate}), manifest.json, validation.json.
 * No price is ever computed for an observation: tuples are copied from the sources with their dates. Only `e` is modelled, and
 * its range comes from the measured error of the same procedure on products with a known price (leave-one-out). */
import fs from 'node:fs';
import path from 'node:path';
import { features, buildIndex, neighbours, estimateFrom, classOf, quantile } from './lib/estimator.mjs';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d; };
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const PK = read(arg('pk')), OFF = read(arg('off')), SEEDS = arg('seeds'), OUT = arg('out');
const NOW = arg('now', new Date().toISOString().slice(0, 10));
const key14 = c => String(c).replace(/\D/g, '').padStart(14, '0');
const DAYS_BEFORE = n => new Date(Date.parse(NOW + 'T00:00:00Z') - n * 86400000).toISOString().slice(0, 10);
const round2 = n => Math.round(n * 100) / 100;
const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };

/* ---------- 1. exact observations, copied from the sources ---------- */
const seed = f => read(path.join(SEEDS, f));
const bz = seed('bazaar-eshop-latest.json'), li = seed('lidl-eshop-latest.json'), pk = seed('posokanei-latest.json'), ek = seed('ekatanalotis-latest.json');
const entries = new Map();   // key14 -> {n, q, o:[]}
const ent = c => { const k = key14(c); if (!entries.has(k)) entries.set(k, { n: '', q: null, o: [] }); return entries.get(k); };
for (const [c, p] of Object.entries(bz.products)) { const e = ent(c); e.n ||= p.n; e.o.push(['bz', 'bazaar', p.p, p.o && p.o > p.p ? p.o : null, p.d, p.f || bz.source.fetched_at, p.u || '', p.o > p.p ? 1 : 0, '']); }
for (const [c, p] of Object.entries(li.products)) { const e = ent(c); e.n ||= p.n; e.o.push(['li', 'lidl', p.p, p.o && p.o > p.p ? p.o : null, p.d, p.f || li.source.fetched_at, p.u || '', p.o > p.p ? 1 : 0, '']); }
for (const [c, p] of Object.entries(pk.products)) { const e = ent(c); e.n ||= p.n; if ((p.u === 'kg' || p.u === 'l') && p.q > 0) e.q ||= [p.u, p.q];
  for (const [chain, price, date, sale] of p.p) e.o.push(['pk', chain, price, null, date, pk.source.fetched_at, '', sale ? 1 : 0, p.m === 'a' ? 'a' : 'h']); }
for (const [c, p] of Object.entries(ek.products)) { const e = ent(c); e.n ||= p.n;
  for (const [chain, price, date, flag] of p.p) e.o.push(['ek', chain, price, null, date, '', '', flag ? 1 : 0, '']); }

/* ---------- 2. reference items: real, dated prices of products (no barcode needed) ---------- */
const NON_FOOD = /Χαρτικά|Στοματική|Υγιεινή|Καθαριστικά|Καθαριότητα|Μαλλιά|Σώμα|Κουζίνα|Κρεμοσάπουνα|Αντισηπτικά|Ξύρισμα|Βαφές|Styling|Ρούχα|Απορρυπαντικ|Σκύλος|Γάτα|Γυναικεία|Αντηλιακά|Προσωπική|Ενυδάτωση|Μετά τον Ήλιο|Βρεφική φροντίδα|Κατοικίδια|Μπάνιο|Ξυραφάκια|Εντομοκτόνα|Αποσμητικά|Σαμπουάν|Αφρόλουτρα|Οδοντόκρεμες|Ακράτεια|Πάνες|Χλωρίνη|Υγρά πιάτων/;
const refs = [];
const GR_CHAIN = new Set(['market_in', 'sklavenitis', 'galaxias', 'masoutis', 'mymarket', 'ab_vasilopoulos', 'synka', 'halkiadakis', 'bazaar', 'kritikos', 'lidl']);
const pkLinked = new Map(); // pk id -> barcode(s)
for (const [c, p] of Object.entries(pk.products)) if (p.id) pkLinked.set(p.id, key14(c));
for (const p of PK.products) {
  const rp = (p.retailer_prices || []).filter(r => r.country === 'GR' && GR_CHAIN.has(r.retailer) && r.price > 0);
  if (!rp.length) continue;
  if (NON_FOOD.test(String(p.subcategory || '') + '|' + String(p.category || ''))) continue;
  const u = String(p.unit || '').toLowerCase(), q = Number(p.unit_quantity);
  const unit = u === 'kg' ? 'kg' : u === 'l' ? 'l' : u === 'pcs' ? 'pcs' : null;
  if (!unit || !(q > 0)) continue;
  const f = features({ name: p.name, brand: (p.brand || '').trim(), quantity: '' });
  f.size = { unit, amount: q };
  const unitPrices = rp.map(r => r.price_normalized > 0 ? r.price_normalized : r.price / q).filter(x => x > 0);
  if (!unitPrices.length) continue;
  refs.push({ src: 'pk', id: p.id, cat: String(p.category || ''), name: p.name.replace(/\s+/g, ' ').trim(), f, unit, unitPrice: med(unitPrices), price: med(rp.map(r => r.price)), chains: rp.length, date: String(rp[0].last_updated).slice(0, 10), barcode: pkLinked.get(p.id) || null });
}
for (const [src, doc] of [['bz', bz], ['li', li]]) for (const [c, p] of Object.entries(doc.products)) {
  const f = features({ name: p.n, brand: '', quantity: '' });
  if (!f.size || !(p.p > 0)) continue;
  if (f.size.amount <= 0) continue;
  refs.push({ src, id: src + ':' + c, name: p.n, f, unit: f.size.unit, unitPrice: p.p / f.size.amount, price: p.p, chains: 1, date: p.d, barcode: key14(c) });
}
console.error('reference items', refs.length, 'pk', refs.filter(r => r.src === 'pk').length);
const index = buildIndex(refs);

/* ---------- 3. query set: every product of the Greek market (Open Food Facts) + every priced barcode ---------- */
const offBy = new Map();
for (const r of OFF.rows) { const [code, name, brands, quantity, pq, cats, pnns, countries, scans, generic] = r;
  offBy.set(key14(code), { name: name || generic || '', brand: String(brands || '').split(',')[0].trim(), quantity, pq: Number(pq) || 0, cats, pnns, countries, scans: Number(scans) || 0 }); }
const queryOf = code => {
  const o = offBy.get(code); const e = entries.get(code);
  const name = o?.name || e?.n || '';
  if (!name) return null;
  const q = features({ name, brand: o?.brand || '', quantity: o?.quantity || '', productQuantity: o?.pq || 0 });
  if (!q.size && e?.q) q.size = { unit: e.q[0], amount: e.q[1] };
  return { f: q, name, off: o };
};
const unitFromSize = s => s ? s.unit : null;

/* ---------- 4. truth set and leave-one-out calibration ---------- */
// truth: barcodes with a real price today (web shops, or an observatory link: the median of its Greek chains) and a pack size
const truth = [];
for (const [code, e] of entries) {
  const live = e.o.filter(o => o[0] !== 'ek' && o[4] >= DAYS_BEFORE(14));
  if (!live.length) continue;
  const price = med(live.map(o => o[2]));
  truth.push({ code, price, reviewedPk: live.some(o => o[0] === 'pk' && o[8] === 'h') });
}
const own = code => it => it.barcode === code || it.id === 'bz:' + code || it.id === 'li:' + code;
const results = [];
for (const t of truth) {
  const q = queryOf(t.code); if (!q || !q.f.size) continue;
  const nb = neighbours(index, q.f, { limit: 14, minScore: 0.3, skip: own(t.code) });
  const est = estimateFrom(index, q.f, nb); if (!est || !est.size || est.n < 2) continue;
  const unitTrue = t.price / est.size;
  if (!classOf(est.top)) continue;
  results.push({ code: t.code, top: est.top, n: est.n, cls: classOf(est.top), predUnit: est.unitMid, trueUnit: unitTrue, lr: Math.log(unitTrue / est.unitMid), hasOff: !!q.off });
}
const classes = {};
const holdout = {};
for (const c of ['A', 'B', 'C', 'D']) {
  const r = results.filter(x => x.cls === c); if (r.length < 25) { classes[c] = { n: r.length, usable: false }; continue; }
  const lrs = r.map(x => x.lr), ape = r.map(x => Math.abs(Math.exp(x.lr) - 1));
  const lo = quantile(lrs, 0.1), hi = quantile(lrs, 0.9);
  // honesty check on the range: share of truths inside [pred*e^lo, pred*e^hi] is 80 % by construction; also report the half-width and the median error
  classes[c] = { n: r.length, usable: true, lo: Math.round(lo * 1000) / 1000, hi: Math.round(hi * 1000) / 1000, medianAbsPctError: Math.round(quantile(ape, 0.5) * 1000) / 10,
    within25pct: Math.round(100 * ape.filter(x => x <= 0.25).length / r.length), within50pct: Math.round(100 * ape.filter(x => x <= 0.5).length / r.length) };
}
// split-sample check: fit the ranges on half of the truth, measure the coverage on the other half
const half = results.filter((_, i) => i % 2 === 0), other = results.filter((_, i) => i % 2 === 1);
for (const c of ['A', 'B', 'C', 'D']) {
  const fit = half.filter(x => x.cls === c), test = other.filter(x => x.cls === c); if (fit.length < 25 || test.length < 25) continue;
  const lo = quantile(fit.map(x => x.lr), 0.1), hi = quantile(fit.map(x => x.lr), 0.9);
  holdout[c] = { fit: fit.length, test: test.length, coverage80: Math.round(100 * test.filter(x => x.lr >= lo && x.lr <= hi).length / test.length) };
}
const bins = [];
for (let lo = 0.3; lo < 1.0; lo += 0.05) {
  const r = results.filter(x => x.top >= lo && x.top < lo + 0.05); if (r.length < 20) continue;
  const ape = r.map(x => Math.abs(Math.exp(x.lr) - 1));
  bins.push({ from: Math.round(lo * 100) / 100, n: r.length, medianAbsPctError: Math.round(quantile(ape, 0.5) * 1000) / 10, p80: Math.round(quantile(ape, 0.8) * 100) });
}
console.error('truth', truth.length, 'evaluated', results.length); console.error(JSON.stringify(classes)); console.error(JSON.stringify(holdout)); console.error(bins.map(b => `${b.from}:${b.n}:${b.medianAbsPctError}%/p80 ${b.p80}%`).join('  '));
// by number of neighbours and by whether the query had an Open Food Facts record
for (const n of [1, 2, 3, 4, 5, 6, 7]) { const r = results.filter(x => x.n === n); if (r.length > 20) console.error('n=' + n, r.length, Math.round(quantile(r.map(x => Math.abs(Math.exp(x.lr) - 1)), 0.5) * 1000) / 10 + '%'); }

/* ---------- 4b. category-level model (class E): median unit price of products of the same Open Food Facts category ---------- */
const catItems = [];
for (const t of truth) {
  const o = offBy.get(t.code); if (!o || !o.cats) continue;
  const f = features({ name: o.name || entries.get(t.code)?.n || '', brand: o.brand, quantity: o.quantity, productQuantity: o.pq });
  if (!f.size || f.size.unit === 'pcs') continue;
  catItems.push({ code: t.code, cats: o.cats.split(',').filter(Boolean), unit: f.size.unit, up: t.price / f.size.amount });
}
const catGroups = new Map();
for (const it of catItems) for (const c of it.cats) { const k = it.unit + '|' + c; if (!catGroups.has(k)) catGroups.set(k, []); catGroups.get(k).push(it); }
const CAT_MIN = 8;
function catPredict(unit, cats, self = null) {
  let best = null;
  for (const c of cats) { const g = (catGroups.get(unit + '|' + c) || []).filter(x => x !== self); if (g.length >= CAT_MIN && (!best || g.length < best.length)) best = g; }
  return best ? { m: med(best.map(x => x.up)), n: best.length } : null;
}
const catRes = [];
for (const it of catItems) { const p = catPredict(it.unit, it.cats, it); if (p) catRes.push({ lr: Math.log(it.up / p.m), top: 0 }); }
if (catRes.length >= 100) {
  const ape = catRes.map(x => Math.abs(Math.exp(x.lr) - 1)), lo = quantile(catRes.map(x => x.lr), 0.1), hi = quantile(catRes.map(x => x.lr), 0.9);
  classes.E = { n: catRes.length, usable: true, lo: Math.round(lo * 1000) / 1000, hi: Math.round(hi * 1000) / 1000, medianAbsPctError: Math.round(quantile(ape, 0.5) * 1000) / 10,
    within25pct: Math.round(100 * ape.filter(x => x <= 0.25).length / ape.length), within50pct: Math.round(100 * ape.filter(x => x <= 0.5).length / ape.length) };
  const h1 = catRes.filter((_, i) => i % 2 === 0), h2 = catRes.filter((_, i) => i % 2 === 1);
  const l = quantile(h1.map(x => x.lr), 0.1), u = quantile(h1.map(x => x.lr), 0.9);
  holdout.E = { fit: h1.length, test: h2.length, coverage80: Math.round(100 * h2.filter(x => x.lr >= l && x.lr <= u).length / h2.length) };
}
console.error('class E', JSON.stringify(classes.E), JSON.stringify(holdout.E), 'groups', catGroups.size);

/* ---------- 5. estimates for every barcode of the Greek market without a current exact price ---------- */
const CLASS_SHOWN = new Set(Object.entries(classes).filter(([, v]) => v.usable && v.medianAbsPctError <= 45).map(([k]) => k));
const hasLive = e => e && e.o.some(o => o[0] !== 'ek'); // any recorded price from the web shops or the observatory: the card shows it (with its age), not an estimate
const universe = new Set([...offBy.keys()].filter(c => offBy.get(c).countries.includes('en:greece') || c.startsWith('05' + '20') || c.startsWith('0520')));
for (const c of entries.keys()) universe.add(c);
const samples = []; let made = 0; const byClass = { A: 0, B: 0, C: 0, D: 0 };
const bumpCount = new Map();
for (const code of universe) {
  const e = entries.get(code);
  if (hasLive(e)) continue;                       // an exact price exists: no estimate is attached
  const q = queryOf(code); if (!q) continue;
  const nb = neighbours(index, q.f, { limit: 14, minScore: 0.3, skip: own(code) });
  const est = estimateFrom(index, q.f, nb); if (!est) continue;
  const cls = classOf(est.top); if (!cls || !CLASS_SHOWN.has(cls) || est.n < (cls === 'D' ? 3 : 2)) continue;
  const cal = classes[cls];
  const lo = est.unitMid * Math.exp(cal.lo), hi = est.unitMid * Math.exp(cal.hi);
  const pack = est.size ? [round2(lo * est.size), round2(est.unitMid * est.size), round2(hi * est.size)] : null;
  const ex = est.use.slice(0, 3).map(n => { const it = index.items[n.i]; return [it.name.slice(0, 80), round2(it.price), it.src === 'pk' ? 'pk' + it.chains : it.src, it.date, Math.round(n.score * 100)]; });
  const rec = ent(code);
  rec.n ||= q.name;
  rec.e = { g: est.category || '', u: est.unit, m: round2(est.unitMid * 1000) / 1000, a: round2(lo * 100) / 100, b: round2(hi * 100) / 100, p: pack, n: est.n, c: cls, x: ex };
  if (!rec.q && est.size) rec.q = [est.unit, est.size];
  made++; byClass[cls]++;
  if (made % 97 === 0) samples.push({ code, cls, name: q.name, brand: q.f.bkey, size: q.f.size, est: rec.e });
}
// class E: barcodes the neighbour search could not place, but whose Open Food Facts categories are known
if (classes.E?.usable && CLASS_SHOWN.has('E')) for (const code of universe) {
  const e = entries.get(code); if (hasLive(e) || e?.e) continue;
  const o = offBy.get(code); if (!o || !o.cats) continue;
  const q = queryOf(code); if (!q?.f.size || q.f.size.unit === 'pcs') { if (!q?.f.size) { /* unit unknown: try both */ } if (q?.f.size?.unit === 'pcs') continue; }
  const units = q?.f.size ? [q.f.size.unit] : ['kg', 'l'];
  let hit = null; for (const u of units) { const p = catPredict(u, o.cats.split(',').filter(Boolean)); if (p && (!hit || p.n > hit.p.n)) hit = { u, p }; }
  if (!hit) continue;
  const cal = classes.E, lo = hit.p.m * Math.exp(cal.lo), hi = hit.p.m * Math.exp(cal.hi), size = q?.f.size?.unit === hit.u ? q.f.size.amount : null;
  const rec = ent(code); rec.n ||= q?.name || o.name;
  rec.e = { g: '', u: hit.u, m: round2(hit.p.m * 1000) / 1000, a: round2(lo * 100) / 100, b: round2(hi * 100) / 100, p: size ? [round2(lo * size), round2(hit.p.m * size), round2(hi * size)] : null, n: hit.p.n, c: 'E', x: [] };
  if (!rec.q && size) rec.q = [hit.u, size];
  made++; byClass.E = (byClass.E || 0) + 1;
}
console.error('estimates', made, byClass);

/* ---------- 6. write shards ---------- */
fs.mkdirSync(OUT, { recursive: true });
const SHARDS = 64, shards = Array.from({ length: SHARDS }, () => ({}));
let obsBarcodes = 0;
for (const [code, e] of entries) {
  if (e.o.length) obsBarcodes++;
  if (!e.e) continue;                       // v80: the shipped shards hold ESTIMATES only; recorded prices come from the source seeds
  const s = Number(code.slice(-6)) % SHARDS;
  const rec = { n: (e.n || '').slice(0, 120) };
  if (e.q) rec.q = e.q; rec.e = e.e;
  shards[s][code] = rec;
}
const stamp = new Date().toISOString();
shards.forEach((items, i) => fs.writeFileSync(path.join(OUT, `e-${String(i).padStart(2, '0')}.json`), JSON.stringify({ v: 80, built: stamp, shard: i, items })));
const manifest = {
  version: 80, built: stamp, shards: SHARDS, barcodes: entries.size, withObservations: obsBarcodes, withEstimate: made, estimatesByClass: byClass,
  sources: { posokanei: { snapshot: pk.source.snapshot, fetchedAt: pk.source.fetched_at, products: Object.keys(pk.products).length, reference: PK.products.length, date: PK.date },
    bazaar: { snapshot: bz.source.snapshot, fetchedAt: bz.source.fetched_at, products: Object.keys(bz.products).length },
    lidl: { snapshot: li.source.snapshot, fetchedAt: li.source.fetched_at, products: Object.keys(li.products).length },
    ekatanalotis: { snapshot: ek.source.snapshot, products: Object.keys(ek.products).length, historical: true } },
  estimator: { referenceItems: refs.length, classes, shownClasses: [...CLASS_SHOWN], holdout, truthEvaluated: results.length },
};
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
fs.writeFileSync(path.join(OUT, 'validation.json'), JSON.stringify({ classes, holdout, truthEvaluated: results.length, sample: results.slice(0, 40), samples }, null, 1));
console.error('written', OUT, 'barcodes', entries.size, 'with observations', obsBarcodes);
