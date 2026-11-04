import test from 'node:test';
import assert from 'node:assert/strict';
import { compare, op, daysAgo, daysAhead, json, makeEnv, withNetwork, loadWorker } from './helpers.mjs';

const CODE = '3017620422003'; // valid GTIN-13

test('a French shopper gets French euro prices, ranked, with the other countries kept apart', async () => {
  const items = [
    op({ code: CODE, price: 3.29, cc: 'FR', brand: 'Carrefour', date: daysAgo(1) }),
    op({ code: CODE, price: 3.15, cc: 'FR', brand: 'Leclerc', date: daysAgo(2) }),
    op({ code: CODE, price: 3.49, cc: 'FR', brand: 'Auchan', date: daysAgo(3) }),
    op({ code: CODE, price: 2.89, cc: 'DE', brand: 'Lidl', date: daysAgo(1) }),
    op({ code: CODE, price: 4.99, cc: 'US', currency: 'USD', brand: 'Walmart', date: daysAgo(1) }),
  ];
  const { res, body } = await compare(CODE, { items, country: 'FR' });
  assert.equal(res.status, 200);
  assert.equal(body.country, 'FR'); assert.equal(body.currency, 'EUR'); assert.equal(body.market.source, 'network');
  assert.equal(body.summary.lowestCurrentPrice, 3.15);
  assert.deepEqual(body.offers.map(o => o.retailer).sort(), ['Auchan', 'Carrefour', 'Leclerc']);
  assert.ok(body.offers.every(o => o.countryCode === 'FR' && o.currency === 'EUR'));
  assert.deepEqual(body.elsewhere.map(o => o.countryCode).sort(), ['DE', 'US']);
  assert.ok(body.elsewhere.every(o => o.rankingEligible === false));
  assert.equal(body.elsewhere.find(o => o.countryCode === 'US').currency, 'USD'); // never converted
  assert.equal(body.summary.typical.price, 3.29); assert.equal(body.summary.typical.n, 3);
});

test('an American shopper gets USD; an EUR price seen in a US store is never ranked', async () => {
  const items = [
    op({ code: CODE, price: 4.49, currency: 'USD', cc: 'US', brand: 'Kroger', date: daysAgo(2) }),
    op({ code: CODE, price: 4.99, currency: 'USD', cc: 'US', brand: 'Walmart', date: daysAgo(1) }),
    op({ code: CODE, price: 1.0, currency: 'EUR', cc: 'US', brand: 'Target', date: daysAgo(1) }), // wrong currency for the US
  ];
  const { body } = await compare(CODE, { items, market: 'US' });
  assert.equal(body.currency, 'USD'); assert.equal(body.summary.lowestCurrentPrice, 4.49);
  const target = body.offers.find(o => o.retailer === 'Target');
  assert.equal(target.rankingEligible, false); assert.equal(target.tier, 'otherCurrency'); assert.equal(target.otherCurrency, true);
  assert.equal(body.summary.latestOfferId, body.offers.find(o => o.retailer === 'Walmart').id); // the other-currency one is never "the last price"
});

test('?market= beats the network country; uk and el are normalised; no signal falls back to Greece', async () => {
  const items = [op({ code: CODE, price: 2.5, currency: 'GBP', cc: 'GB', brand: 'Tesco', date: daysAgo(1) })];
  assert.equal((await compare(CODE, { items, market: 'uk', country: 'DE' })).body.country, 'GB');
  assert.equal((await compare(CODE, { items, market: 'el' })).body.country, 'GR');
  assert.equal((await compare(CODE, { items, country: 'DE' })).body.country, 'DE');
  assert.equal((await compare(CODE, { items })).body.country, 'GR');
  assert.equal((await compare(CODE, { items, market: 'zz!', country: 'IT' })).body.country, 'IT'); // junk is ignored
});

test('currencies with big numbers work (JPY, VND) and absurd values are refused', async () => {
  const items = [
    op({ code: CODE, price: 398, currency: 'JPY', cc: 'JP', brand: 'Aeon', date: daysAgo(1) }),
    op({ code: CODE, price: 99999999, currency: 'JPY', cc: 'JP', brand: 'Seiyu', date: daysAgo(1) }),
  ];
  const { body } = await compare(CODE, { items, market: 'JP' });
  assert.equal(body.currency, 'JPY'); assert.equal(body.offers.length, 1); assert.equal(body.offers[0].price, 398);
});

test('a probable typing mistake is flagged, never ranked and not counted; a real promotion stays', async () => {
  const items = [
    op({ code: CODE, price: 1.8, cc: 'FR', brand: 'Carrefour' }), op({ code: CODE, price: 1.85, cc: 'FR', brand: 'Leclerc' }),
    op({ code: CODE, price: 1.9, cc: 'FR', brand: 'Auchan' }), op({ code: CODE, price: 1.95, cc: 'FR', brand: 'Monoprix' }),
    op({ code: CODE, price: 0.19, cc: 'FR', brand: 'Casino' }),                                                     // 10x too low
    op({ code: CODE, price: 1.2, cc: 'FR', brand: 'Intermarché', discounted: true, was: 1.9, discountType: 'SALE' }), // real promotion
  ];
  const { body } = await compare(CODE, { items, market: 'FR' });
  const casino = body.offers.find(o => o.retailer === 'Casino');
  assert.equal(casino.suspect, true); assert.equal(casino.rankingEligible, false); assert.equal(casino.tier, 'suspect');
  assert.equal(body.summary.lowestCurrentPrice, 1.2); // the promotion, not 0.19
  assert.ok(body.summary.typical.low >= 1.2, 'the suspect price is not in the typical range');
  assert.equal(body.summary.suspect, 1);
});

test('dates: tomorrow (time zones) counts as today outside Greece; two days ahead is rejected; no proof means never "cheapest"', async () => {
  const items = [
    op({ code: CODE, price: 2.0, cc: 'NZ', currency: 'NZD', brand: 'Countdown', date: daysAhead(1) }),
    op({ code: CODE, price: 1.0, cc: 'NZ', currency: 'NZD', brand: 'Pak n Save', date: daysAhead(2) }),
    op({ code: CODE, price: 1.5, cc: 'NZ', currency: 'NZD', brand: 'New World', date: daysAgo(1), proof: null }),
  ];
  const { body } = await compare(CODE, { items, market: 'NZ' });
  assert.deepEqual(body.offers.map(o => o.retailer).sort(), ['Countdown', 'New World']);
  const cd = body.offers.find(o => o.retailer === 'Countdown'); assert.equal(cd.ageDays, 0); assert.equal(cd.rankingEligible, true);
  assert.equal(body.offers.find(o => o.retailer === 'New World').rankingEligible, false);
  assert.equal(body.summary.lowestCurrentPrice, 2.0);
});

test('old prices are kept as the last recorded price, never ranked', async () => {
  const items = [op({ code: CODE, price: 2.2, cc: 'ES', brand: 'Mercadona', date: daysAgo(40) })];
  const { body } = await compare(CODE, { items, market: 'ES' });
  assert.equal(body.summary.lowestCurrentPrice, null); assert.equal(body.offers[0].tier, 'older'); assert.equal(body.offers[0].freshness, 'older');
  assert.equal(body.summary.latestOfferId, body.offers[0].id); assert.equal(body.status, 'observations_available');
});

test('the country filter is used first; if the API rejects it the plain newest-300 read still answers', async () => {
  const items = Array.from({ length: 250 }, (_, i) => op({ code: CODE, price: 1 + i / 100, cc: i < 240 ? 'IN' : 'FR', currency: i < 240 ? 'INR' : 'EUR', brand: 'B' + i, date: daysAgo(1 + (i % 5)) }));
  const ok = await compare(CODE, { items, market: 'FR' });
  assert.equal(ok.body.offers.length, 10); assert.ok(ok.calls.some(c => c.includes('location__osm_address_country_code=FR')));
  const rejected = await compare(CODE, { items, market: 'FR', opts: { rejectFilter: true } });
  assert.equal(rejected.body.status, 'observations_available'); assert.equal(rejected.body.offers.length, 10);
  assert.ok(rejected.calls.some(c => !c.includes('location__osm_address_country_code')));
});

test('outside Greece no Greek source is consulted or reported (no phantom "unavailable" providers)', async () => {
  const { body } = await compare(CODE, { items: [op({ code: CODE, price: 3, cc: 'DE', brand: 'Edeka' })], market: 'DE' });
  assert.deepEqual(Object.keys(body.providers).sort(), ['liveDatabase', 'openPrices']);
  assert.equal(body.providerSummary.unavailable, 0); assert.equal(body.scope, 'market');
  assert.equal(body.candidates.length, 0); assert.equal(body.estimate, null);
});

test('an Open Prices outage is "temporarily unavailable", never "no data"; an empty answer is "no_data"', async () => {
  const down = await compare(CODE, { items: [], market: 'FR', opts: { status: 503 } });
  assert.equal(down.body.status, 'temporarily_unavailable'); assert.equal(down.res.headers.get('cache-control'), 'no-store');
  const empty = await compare(CODE, { items: [], market: 'FR' });
  assert.equal(empty.body.status, 'no_data');
});

test('Greece still works as before: Greek chain names, euro, Greek market code', async () => {
  const items = [op({ code: CODE, price: 4.1, cc: 'GR', brand: 'ΑΒ Βασιλόπουλος', city: 'Athens', date: daysAgo(1) }), op({ code: CODE, price: 4.3, cc: 'GR', brand: 'Σκλαβενίτης', city: 'Athens', date: daysAgo(1) })];
  const { body } = await compare(CODE, { items, market: 'GR' });
  assert.equal(body.country, 'GR'); assert.equal(body.scope, 'greece');
  assert.deepEqual(body.offers.map(o => o.retailerId).sort(), ['ab', 'sklavenitis']);
  assert.ok(Object.keys(body.providers).includes('observatory'));
});

test('invalid input is refused', async () => {
  const bad = await compare('1234567890123', { market: 'FR' }); assert.equal(bad.res.status, 400);
  const nearby = await compare(CODE, { market: 'FR', nearby: { lat: '95', lon: '4', radius_km: '10' } }); assert.equal(nearby.res.status, 400);
});

test('nearby works worldwide, inside the shopper\'s own market only', async () => {
  const near = op({ code: CODE, price: 3.1, cc: 'FR', brand: 'Carrefour' }); near.location.osm_lat = 45.76; near.location.osm_lon = 4.83;
  const far = op({ code: CODE, price: 2.1, cc: 'FR', brand: 'Leclerc' }); far.location.osm_lat = 43.3; far.location.osm_lon = 5.4; // Marseille
  const { body } = await compare(CODE, { items: [near, far], market: 'FR', nearby: { lat: '45.76', lon: '4.83', radius_km: '25' } });
  assert.deepEqual(body.offers.map(o => o.retailer), ['Carrefour']); assert.equal(body.scope, 'nearby');
});

test('a probable typing mistake in ANOTHER country is dropped from "seen elsewhere" (a Greek shopper must not read "seen in France: 0.39")', async () => {
  const items = [op({ code: CODE, price: 3.3, cc: 'FR', brand: 'Leclerc' }), op({ code: CODE, price: 3.4, cc: 'FR', brand: 'Carrefour' }), op({ code: CODE, price: 3.5, cc: 'FR', brand: 'Auchan' }),
    op({ code: CODE, price: 3.6, cc: 'FR', brand: 'Monoprix' }), op({ code: CODE, price: 0.39, cc: 'FR', brand: 'Casino' })];
  const { body } = await compare(CODE, { items, market: 'GR' });
  assert.equal(body.elsewhere.length, 4); assert.ok(body.elsewhere.every(o => o.price >= 3.3));
});

test('the same barcode in the same country keeps one price per store (the newest)', async () => {
  const a = op({ code: CODE, price: 3.5, cc: 'FR', brand: 'Carrefour', date: daysAgo(10) }); const b = op({ code: CODE, price: 3.2, cc: 'FR', brand: 'Carrefour', date: daysAgo(1) });
  b.location.id = a.location.id; // same shop
  const { body } = await compare(CODE, { items: [a, b], market: 'FR' });
  assert.equal(body.offers.length, 1); assert.equal(body.offers[0].price, 3.2);
});
