// node --test price-refresh/refresh/test/
import test from 'node:test';
import assert from 'node:assert/strict';
import { priceLinks, sameProduct } from '../src/pricelink.mjs';
import { quarantineOutliers, loadLinks } from '../src/posokanei.mjs';

const day = '2026-11-01';
const obs = (id, name, brand, unit, q, prices) => ({ id, name, brand, unit, unit_quantity: q, category: 'Μπύρα', subcategory: 'Ποτά', available_countries: ['GR'],
  retailer_prices: Object.entries(prices).map(([retailer, price]) => ({ country: 'GR', retailer, price, last_updated: day + 'T00:00:00', is_discount: false })) });
const shop = products => ({ products: Object.fromEntries(Object.entries(products).map(([e, [n, p, o]]) => [e.padStart(14, '0'), { n, p, o: o ?? null, d: '2026-11-02' }])) });
// GTINs with valid check digits
const AMSTEL = '5201261000029', HEINEKEN = '5201261000159', FIX = '5201246002383';

test('links a barcode when the same chain reports the same price to the cent, same brand and size', () => {
  const products = [obs('a', 'ΑΜΣΤΕΛ Μπύρα Lager 500ml', 'ΑΜΣΤΕΛ', 'l', 0.5, { bazaar: 1.53, sklavenitis: 1.49, ab: 1.55 })];
  const { links } = priceLinks({ products, snapshotDate: day, shops: { bazaar: shop({ [AMSTEL]: ['Amstel Μπύρα 500ml', 1.53] }) } });
  assert.equal(links.length, 1); assert.equal(links[0].ean, AMSTEL); assert.equal(links[0].pk_id, 'a'); assert.equal(links[0].method, 'auto-price');
});

test('no link when the price differs by one cent, or when the shop price is a sale price', () => {
  const products = [obs('a', 'ΑΜΣΤΕΛ Μπύρα Lager 500ml', 'ΑΜΣΤΕΛ', 'l', 0.5, { bazaar: 1.53 })];
  assert.equal(priceLinks({ products, snapshotDate: day, shops: { bazaar: shop({ [AMSTEL]: ['Amstel Μπύρα 500ml', 1.52] }) } }).links.length, 0);
  assert.equal(priceLinks({ products, snapshotDate: day, shops: { bazaar: shop({ [AMSTEL]: ['Amstel Μπύρα 500ml', 1.53, 1.80] }) } }).links.length, 0);
});

test('no link across brands, sizes or variants even at the same price', () => {
  const products = [obs('a', 'ΑΜΣΤΕΛ Μπύρα Lager 500ml', 'ΑΜΣΤΕΛ', 'l', 0.5, { bazaar: 1.53 }), obs('z', 'ΑΜΣΤΕΛ Μπύρα Zero 330ml', 'ΑΜΣΤΕΛ', 'l', 0.33, { bazaar: 1.20 })];
  const r = priceLinks({ products, snapshotDate: day, shops: { bazaar: shop({ [HEINEKEN]: ['Heineken Μπύρα 500ml', 1.53], [AMSTEL]: ['Amstel Μπύρα 330ml', 1.20], [FIX]: ['Amstel Μπύρα Zero 500ml', 1.53] }) } });
  assert.equal(r.links.length, 0);
});

test('two products at the same price that both fit make the barcode unlinkable (uniqueness both ways)', () => {
  const products = [obs('a', 'ΑΜΣΤΕΛ Μπύρα 500ml', 'ΑΜΣΤΕΛ', 'l', 0.5, { bazaar: 1.53 }), obs('b', 'ΑΜΣΤΕΛ Μπύρα Κουτί 500ml', 'ΑΜΣΤΕΛ', 'l', 0.5, { bazaar: 1.53 })];
  const r = priceLinks({ products, snapshotDate: day, shops: { bazaar: shop({ [AMSTEL]: ['Amstel Μπύρα 500ml', 1.53] }) } });
  assert.equal(r.links.length, 0); assert.equal(r.refused[0].why, 'several_products_same_price');
});

test('already linked barcodes and products are never re-linked', () => {
  const products = [obs('a', 'ΑΜΣΤΕΛ Μπύρα Lager 500ml', 'ΑΜΣΤΕΛ', 'l', 0.5, { bazaar: 1.53 })];
  const shops = { bazaar: shop({ [AMSTEL]: ['Amstel Μπύρα 500ml', 1.53] }) };
  assert.equal(priceLinks({ products, snapshotDate: day, shops, linked: { eans: new Set([AMSTEL]), ids: new Set(), rejected: new Set() } }).links.length, 0);
  assert.equal(priceLinks({ products, snapshotDate: day, shops, linked: { eans: new Set(), ids: new Set(['a']), rejected: new Set() } }).links.length, 0);
  assert.equal(priceLinks({ products, snapshotDate: day, shops, linked: { eans: new Set(), ids: new Set(), rejected: new Set([AMSTEL]) } }).links.length, 0);
});

test('two different rare product-line words refuse the pair (Nivea Protect & Care is not Hydrocare)', async () => {
  const { tokens, brandSk, packSize, packCount } = await import('../src/matcher.mjs');
  const o = { size: packSize('NIVEA Men Hydrocare Αφρός Ξυρίσματος Με Αλόη 200ml'), count: 1, toks: tokens('NIVEA Men Hydrocare Αφρός Ξυρίσματος Με Αλόη 200ml'), bsk: brandSk('NIVEA', ''), cat: new Set() };
  const s = { size: packSize('Nivea For Men Αφρός Ξυρίσματος Protect & Care 200ml'), count: packCount('x 200ml'), toks: tokens('Nivea For Men Αφρός Ξυρίσματος Protect & Care 200ml') };
  assert.equal(sameProduct(s, o, new Map()), null);
});

test('quarantine: a chain far below the median of the other chains is left out; dearer chains are kept', () => {
  const r = (retailer_id, price) => ({ retailer_id, price, observed_at: day, discount_type: '' });
  const { keep, dropped } = quarantineOutliers([r('marketin', 0.99), r('masoutis', 1.8), r('synka', 1.8), r('ab', 1.89), r('bazaar', 3.5)]);
  assert.deepEqual(dropped.map(d => d.chain), ['marketin']);
  assert.equal(keep.length, 4);
  assert.equal(quarantineOutliers([r('a', 0.5), r('b', 2)]).dropped.length, 0); // fewer than two other chains: nothing to compare with
});

test('link files accept the auto-price method', () => {
  assert.equal(loadLinks({ schema: 2, links: [{ ean: AMSTEL, pk_id: 'a', method: 'auto-price' }] }).size, 1);
});
