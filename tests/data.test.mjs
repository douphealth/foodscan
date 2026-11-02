import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { APP, allEstimates, estManifest, seed, gtinOK } from './helpers.mjs';

const est = allEstimates(), m = estManifest();
const bz = seed('bazaar-eshop-latest.json'), li = seed('lidl-eshop-latest.json'), pk = seed('posokanei-latest.json'), ek = seed('ekatanalotis-latest.json');
const CHAINS = new Set(['ab', 'sklavenitis', 'lidl', 'mymarket', 'masoutis', 'kritikos', 'galaxias', 'marketin', 'synka', 'chalkiadakis', 'bazaar', 'discount-markt']);

test('64 estimate shards: schema 80, each barcode in the shard the worker will read', () => {
  const dir = path.join(APP, 'assets/gr-est-v80'), files = fs.readdirSync(dir).filter(f => /^e-\d+\.json$/.test(f)); assert.equal(files.length, 64);
  for (const f of files) {
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); assert.equal(d.v, 80); const id = Number(f.match(/\d+/)[0]);
    for (const k of Object.keys(d.items)) assert.equal(Number(k.slice(-6)) % 64, id, `${k} is in the wrong shard`);
    assert.ok(fs.statSync(path.join(dir, f)).size < 300000, 'a shard stays small enough to parse inside a request');
  }
});

test('every seed observation is a copied, dated, positive price for a known chain, and no date is in the future', () => {
  const today = new Date().toISOString().slice(0, 10); let n = 0;
  for (const [code, p] of Object.entries(pk.products)) for (const [chain, price, date] of p.p) { n++; assert.ok(CHAINS.has(chain), `${code} ${chain}`); assert.ok(price > 0 && price < 2000, `${code} ${price}`); assert.match(date, /^\d{4}-\d{2}-\d{2}$/); assert.ok(date <= today, `${code} dated ${date}`); }
  for (const [name, doc] of [['bazaar', bz], ['lidl', li]]) for (const [code, p] of Object.entries(doc.products)) { n++; assert.ok(p.p > 0 && p.p < 2000, `${name} ${code} ${p.p}`); assert.match(p.d, /^\d{4}-\d{2}-\d{2}$/); assert.ok(p.d <= today, `${name} ${code} dated ${p.d}`); if (p.o != null) assert.ok(p.o > p.p, `${name} ${code}: a "was" price must be higher`); }
  assert.ok(n > 8000, 'observations: ' + n); assert.ok(ek.source.snapshot);
});

test('coverage floor: bundled data must keep covering the Greek market', () => {
  assert.ok(Object.keys(bz.products).length >= 6000, 'bazaar ' + Object.keys(bz.products).length);
  assert.ok(Object.keys(pk.products).length >= 1100, 'observatory links ' + Object.keys(pk.products).length);
  assert.ok(m.withEstimate >= 9000, 'barcodes with an estimate: ' + m.withEstimate);
});

test('estimates are consistent and never attached to a barcode that has a recorded price in the bundled sources', () => {
  const recorded = new Set([...Object.keys(bz.products), ...Object.keys(li.products), ...Object.keys(pk.products)]); let n = 0;
  for (const [code, e] of Object.entries(est)) {
    n++; assert.ok(!recorded.has(code), `${code} has both a recorded price and an estimate`);
    const { u, m: mid, a, b, p, n: nn, c, x } = e.e;
    assert.ok(['kg', 'l', 'pcs'].includes(u)); assert.ok(a > 0 && a <= mid && mid <= b, `${code}`); assert.ok(nn >= 2); assert.ok(['A', 'B', 'C', 'D', 'E'].includes(c));
    if (p) { assert.equal(p.length, 3); assert.ok(p[0] <= p[1] && p[1] <= p[2]); assert.ok(p[2] < 2000); }
    if (c === 'E') assert.equal(x.length, 0); else assert.ok(x.length >= 1 && x.length <= 3);
  }
  assert.equal(n, m.withEstimate);
});

test('the estimator is calibrated: held-out coverage of the stated 80% range is within 70-90%, errors are reported per class', () => {
  const { classes, holdout } = m.estimator;
  for (const c of ['A', 'B', 'C', 'D', 'E']) { assert.ok(classes[c]?.usable && classes[c].n >= 100, c); assert.ok(classes[c].lo < 0 && classes[c].hi > 0); assert.ok(holdout[c].coverage80 >= 70 && holdout[c].coverage80 <= 90, `${c} held-out ${holdout[c].coverage80}`); }
  assert.ok(classes.A.medianAbsPctError <= 20 && classes.B.medianAbsPctError <= 20); assert.ok(classes.E.medianAbsPctError <= 40);
});

test('observatory links are consistent with web-shop prices that carry the barcode themselves (independent check)', () => {
  let both = 0, equal = 0;
  for (const [code, p] of Object.entries(pk.products)) for (const [shop, chain] of [[bz, 'bazaar'], [li, 'lidl']]) { const s = shop.products[code], pr = p.p.find(x => x[0] === chain); if (!s || !pr) continue; both++; if (Math.abs(pr[1] - s.p) < 0.005) equal++; }
  // the observatory file is one day older than the web-shop re-read; 4 % of web-shop prices really changed in those two days (measured), so agreement is high but not total
  assert.ok(both > 300, 'comparisons: ' + both); assert.ok(equal / both >= 0.88, `${equal}/${both} agree`);
});

test('no seed is made of identical prices at six or more chains for many products (the signature of the invented v70 prices)', () => {
  const flat = Object.values(pk.products).filter(p => p.p.length >= 6 && new Set(p.p.map(x => x[1])).size === 1).length; assert.ok(flat < 150, 'flat products: ' + flat);
});

test('the shipped seed shards reassemble to exactly the source seeds: every barcode in its shard, nothing added, nothing lost', () => {
  const root = path.join(APP, 'assets/gr-prices-v72');
  for (const [file, doc] of [['bazaar-eshop-latest.json', bz], ['lidl-eshop-latest.json', li], ['posokanei-latest.json', pk], ['ekatanalotis-latest.json', ek]]) {
    const man = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')); assert.equal(man.schema, 2); assert.match(man.sharded, /^[a-z0-9-]+\/$/); assert.deepEqual(man.products, {});
    assert.equal(man.source.snapshot, doc.source.snapshot); assert.equal(man.source.counts.products, Object.keys(doc.products).length);
    let n = 0;
    for (let i = 0; i < 100; i++) { const id = String(i).padStart(2, '0'), sh = JSON.parse(fs.readFileSync(path.join(root, man.sharded, id + '.json'), 'utf8')); assert.equal(sh.source.snapshot, man.source.snapshot);
      for (const [code, rec] of Object.entries(sh.products)) { n++; assert.equal(code.slice(-2), id, `${file} ${code} in shard ${id}`); assert.deepEqual(rec, doc.products[code]); } }
    assert.equal(n, Object.keys(doc.products).length, file);
  }
});
