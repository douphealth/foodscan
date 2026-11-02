import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { APP } from './helpers.mjs';

const core = await import(pathToFileURL(path.join(APP, 'prices/price-core-v80.mjs')).href);
const { checkOffer, checkPayload, checkEstimate, summarize, freshnessOf, ageDays, unitDelta, CURRENT_DAYS, OLDER_DAYS, PRICE_VERSION } = core;

const NOW = Date.parse('2026-11-02T12:00:00Z');
const day = n => new Date(NOW - n * 86400000).toISOString().slice(0, 10);
const offer = (over = {}) => ({ id: 'pk:2026-11-01:ab:05201054015360', barcode: '5201054015360', price: 1.3, currency: 'EUR', basis: 'item', date: day(1), countryCode: 'GR',
  retailer: 'AB Βασιλόπουλος', retailerId: 'ab', storeName: 'AB Βασιλόπουλος', source: 'posokanei', sourceKind: 'official', match: 'reviewed', rankingEligible: true, ...over });
const estimate = (over = {}) => ({ unit: 'kg', unitLow: 4.7, unitMid: 6.4, unitHigh: 9.7, pack: [0.81, 1.1, 1.65], n: 7, cls: 'B', category: 'Γιαούρτι', examples: [{ name: 'Fage 200g', price: 1.3, source: 'posokanei', date: day(1), similarity: 65 }], ...over });
const payload = (over = {}) => ({ version: '80.0.0', barcode: '5201054015360', status: 'observations_available', offers: [], elsewhere: [], pack: { amount: 0.17, unit: 'kg' }, ...over });

test('freshness windows: current <= 7 days, older <= 90, then historical (v79 had 30)', () => {
  assert.equal(CURRENT_DAYS, 7); assert.equal(OLDER_DAYS, 90); assert.ok(PRICE_VERSION >= 79);
  assert.equal(freshnessOf(0), 'current'); assert.equal(freshnessOf(7), 'current'); assert.equal(freshnessOf(8), 'older'); assert.equal(freshnessOf(90), 'older'); assert.equal(freshnessOf(91), 'historical');
  assert.equal(ageDays(day(3), NOW), 3);
});

test('a price 5 days old is ranked; one 12 days old is shown as older and never ranked', () => {
  assert.equal(checkOffer(offer({ date: day(5) }), null, NOW).rankingEligible, true);
  const old = checkOffer(offer({ date: day(12) }), null, NOW); assert.equal(old.freshness, 'older'); assert.equal(old.rankingEligible, false);
});

test('offers without evidence are refused', () => {
  for (const bad of [{ id: 'x:1' }, { estimated: true }, { synthetic: true }, { benchmark: true }, { modelled: true }, { source: '' }, { storeName: '', retailer: '' }, { date: '2026-12-01' }, { date: 'yesterday' }, { price: 0 }, { price: -1 }, { currency: 'USD' }, { sourceKind: 'official', id: 'bz:1' }, { sourceKind: 'retailer', id: 'pk:1' }])
    assert.equal(checkOffer(offer(bad), null, NOW), null, JSON.stringify(bad));
});

test('lead: current price > last recorded price > none; an estimate is never shown (81)', () => {
  assert.equal(checkPayload(payload({ offers: [offer()], estimate: estimate() }), NOW).lead.kind, 'current');
  const older = checkPayload(payload({ offers: [offer({ date: day(30) })], estimate: estimate() }), NOW);
  assert.equal(older.lead.kind, 'older'); assert.equal(older.best, null); assert.equal(older.lead.offer.price, 1.3);
  const hist = checkPayload(payload({ offers: [offer({ date: day(140), id: 'ek:2026-06-16:ab:05201054015360', source: 'e-katanalotis', match: 'barcode' })], estimate: estimate() }), NOW);
  assert.equal(hist.lead.kind, 'historical');
  const est = checkPayload(payload({ status: 'estimate_only', estimate: estimate() }), NOW);
  assert.equal(est.lead.kind, 'none'); assert.equal(est.estimate, null); assert.equal(est.best, null); assert.equal(est.offers.length, 0); assert.equal(est.status, 'no_data');
  const none = checkPayload(payload({ status: 'no_data' }), NOW); assert.equal(none.lead.kind, 'none'); assert.equal(none.status, 'no_data');
});

test('a price the worker tied to ANOTHER pack size is not "the last recorded price" of this product', () => {
  const other = checkPayload(payload({ offers: [offer({ date: day(1), rankingEligible: false, packMismatch: true, tier: 'otherSize' })], estimate: estimate() }), NOW);
  assert.equal(other.latest, null); assert.equal(other.lead.kind, 'none');
});

test('81: related products keep their OWN recorded price; incomplete or weak ones are dropped; at most 3', () => {
  const rel = (over = {}) => ({ name: 'Fage Total 2% 200g', price: 1.3, source: 'Παρατηρητήριο Τιμών', date: day(1), similarity: 64, ...over });
  const r = checkPayload(payload({ status: 'no_data', related: [rel(), rel({ similarity: 40 }), rel({ price: 0 }), rel({ name: '' }), rel({ date: 'x' }), rel(), rel(), rel()] }), NOW);
  assert.equal(r.related.length, 3); assert.ok(r.related.every(x => x.price === 1.3 && x.similarity >= 55)); assert.equal(r.lead.kind, 'none'); assert.equal(r.best, null); assert.equal(r.currentCount, 0);
});

test('an estimate is never an offer: not ranked, not counted, not compared per kg', () => {
  const est = checkPayload(payload({ status: 'estimate_only', estimate: estimate() }), NOW);
  assert.equal(est.currentCount, 0); assert.equal(est.retailerCount, 0); assert.equal(est.best, null);
  assert.equal(unitDelta(est, checkPayload(payload({ offers: [offer()] }), NOW)), null);
});

test('estimates with inconsistent numbers are dropped', () => {
  assert.ok(checkEstimate(estimate()));
  for (const bad of [{ unitLow: 7 }, { unitHigh: 5 }, { unitMid: 0 }, { unit: 'box' }, { cls: 'Z' }, { n: 1 }, { unitHigh: 5000 }, { unitLow: -1 }]) assert.equal(checkEstimate(estimate(bad)), null, JSON.stringify(bad));
  assert.equal(checkEstimate(estimate({ pack: [3, 2, 1] })).pack, null); assert.equal(checkEstimate(null), null);
});

test('payloads from engines older than the estimate contract are refused', () => {
  assert.equal(checkPayload(payload({ version: '70.0.0' }), NOW), null); assert.equal(checkPayload(payload({ version: '78.0.0' }), NOW), null);
  assert.equal(checkPayload(payload({ barcode: '1234567890123' }), NOW), null);
});

test('prices outside Greece are kept apart and never ranked', () => {
  const r = checkPayload(payload({ elsewhere: [offer({ id: 'op:7', countryCode: 'FR', source: 'Open Prices', sourceKind: 'community', retailer: 'Carrefour', storeName: 'Carrefour', match: null, proofType: 'PRICE_TAG' })] }), NOW);
  assert.equal(r.offers.length, 0); assert.equal(r.elsewhere.length, 1); assert.equal(r.elsewhere[0].rankingEligible, false); assert.equal(r.best, null);
});
