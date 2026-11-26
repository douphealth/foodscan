/* FoodScan 105: the price answer no longer waits for the slowest source.
 * Measured on the live 104.0.0 before this release: a product's own price appeared 4.9 s after its grade (0.58 s), because the whole answer waited for
 * one shop's product page (2.5 s time-out, then a retry), and a cold worker read the signed price files one after another (11 subrequests in a chain).
 * These tests run the REAL worker with a fake network: a shop page that answers late, and a signed remote that answers slowly. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadWorker, makeEnv, withNetwork, fakeOpenPrices, signedRemote, json, read } from './helpers.mjs';

const CODE = '5449000214799'; // in the bundled Bazaar seed, with the shop's product path
const shopPage = (price, ms, hits) => async () => {
  hits.n++; await new Promise(r => setTimeout(r, ms));
  return new Response(`<div itemscope itemtype="https://schema.org/Product"><meta itemprop="gtin13" content="${CODE}"><meta itemprop="price" content="${price}"><meta itemprop="priceCurrency" content="EUR"></div>`, { headers: { 'Content-Type': 'text/html' } });
};
let ip = 1;
const request = qs => new Request(`https://food-scan.test/api/prices/compare?barcode=${CODE}&market=GR${qs}`, { headers: { 'CF-Connecting-IP': '198.51.100.' + (ip++ % 250 + 1) } });
const bazaar = body => body.offers.find(o => String(o.id || '').startsWith('bz:'));
/** Runs fn inside one fake network (Open Prices empty, the shop page as given); returns what fn returns after every waitUntil has settled. */
async function withShop(ms, fn, env = {}) {
  const hits = { n: 0 }, pending = [], worker = await loadWorker();
  const ctx = { waitUntil: p => pending.push(p) }, full = makeEnv({ FOODSCAN_PRICE_DATA_URL: 'off', ...env });
  const ask = async qs => { const t = Date.now(), res = await worker.fetch(request(qs), full, ctx); return { res, body: await res.json(), ms: Date.now() - t }; };
  return withNetwork([...fakeOpenPrices([]).handlers, [/bazaar-online\.gr/, shopPage(0.95, ms, hits)]], async () => { const out = await fn(ask, hits); await Promise.allSettled(pending); return out; });
}

test('105: without quick=1 the answer still waits for the shop, exactly as before (an app tab from before 105)', async () => {
  const { res, body, ms } = await withShop(900, ask => ask('&fresh=1'));
  assert.ok(ms >= 850, 'waited for the shop page: ' + ms);
  assert.equal(body.livePending, undefined);
  assert.equal(body.providers.bazaar.live, 'confirmed');
  assert.equal(bazaar(body).price, 0.95); assert.equal(bazaar(body).rankingEligible, true);
  assert.match(res.headers.get('cache-control'), /s-maxage=600/);
});

test('105: quick=1 with a shop that answers in time is the complete, cacheable answer in one step', async () => {
  const { res, body } = await withShop(40, ask => ask('&quick=1&fresh=1'));
  assert.equal(body.livePending, undefined);
  assert.equal(body.providers.bazaar.live, 'confirmed');
  assert.equal(body.summary.bestOfferId, bazaar(body).id);
  assert.match(res.headers.get('cache-control'), /s-maxage=600/);
  assert.match(res.headers.get('server-timing'), /^sources;dur=\d+$/);
});

test('105: quick=1 with a slow shop answers before the shop does, and the shop price is "last seen", never ranked', async () => {
  const { res, body, ms } = await withShop(2000, ask => ask('&quick=1'));
  assert.ok(ms < 1500, 'answered before the shop page did: ' + ms);
  assert.deepEqual(body.livePending, ['bazaar']);
  assert.equal(body.providers.bazaar.live, 'pending');
  const o = bazaar(body);
  assert.equal(o.tier, 'lastSeen'); assert.equal(o.rankingEligible, false); assert.equal(o.liveUnconfirmed, true);
  assert.notEqual(o.price, 0.95, 'the stored price, not the one the page will confirm');
  assert.equal(body.summary.bestOfferId, null, 'a price still being checked is not the cheapest');
  assert.equal(res.headers.get('cache-control'), 'no-store', 'a snapshot is never cached');
  assert.match(res.headers.get('server-timing'), /live;desc="pending"/);
});

test('105: the follow-up joins the shop check already running (one request to the shop) and equals the one-step answer', async () => {
  const two = await withShop(1200, async (ask, hits) => {
    const snap = await ask('&quick=1&fresh=1');       // fresh: skips any edge copy
    const done = await ask('');                       // what the app sends next: the same request without quick
    return { snap, done, hits: hits.n };
  });
  assert.deepEqual(two.snap.body.livePending, ['bazaar']);
  assert.equal(two.hits, 1, 'the shop page was asked once, not once per step');
  assert.equal(two.done.body.livePending, undefined);
  assert.equal(two.done.body.providers.bazaar.live, 'confirmed');
  assert.match(two.done.res.headers.get('server-timing'), /live;desc="joined"/);
  assert.match(two.done.res.headers.get('cache-control'), /s-maxage=600/);
  const plain = await withShop(40, ask => ask('&fresh=1'));
  const shape = b => b.offers.map(o => [o.id, o.price, o.tier, o.rankingEligible, o.freshness, o.unitPrice ?? null]);
  assert.deepEqual(shape(two.done.body), shape(plain.body), 'two steps end at the same offers as one step');
  assert.equal(two.done.body.summary.bestOfferId, plain.body.summary.bestOfferId);
});

test('105: a snapshot never starts the paid web search (a price only still being checked is not "no current price")', async () => {
  let lookups = 0;
  const FS_WEB_PRICES = { lookup: async () => { lookups++; return { status: 'ok_empty', items: [] }; } };
  const { body } = await withShop(1200, ask => ask('&quick=1&fresh=1'), { FS_WEB_PRICES });
  assert.deepEqual(body.livePending, ['bazaar']);
  assert.equal(body.summary.currentOffers, 0, 'the snapshot itself has no current price yet');
  assert.equal(lookups, 0, 'and the complete answer has one (the confirmed shop price), so no search ran at all');
});

const SEEDS = ['posokanei', 'ekatanalotis', 'bazaar-eshop', 'lidl-eshop'].map(n => `seeds/${n}-latest.json`);
/** One Greek price lookup on a site origin no earlier test used (the worker remembers each origin's files for 30 minutes). */
async function coldLookup(origin, remote, handlers) {
  const worker = await loadWorker(), pending = [], env = makeEnv({ ...remote.env, FS_SHOP_LIVE: '0' }), ctx = { waitUntil: p => pending.push(p) };
  return withNetwork([...fakeOpenPrices([]).handlers, ...handlers], async () => {
    const res = await worker.fetch(new Request(`${origin}/api/prices/compare?barcode=5201004021328&market=GR&fresh=1`, { headers: { 'CF-Connecting-IP': '198.51.100.251' } }), env, ctx);
    const body = await res.json();
    const health = await (await worker.fetch(new Request(`${origin}/api/prices/health`), env, ctx)).json();
    await Promise.allSettled(pending); return { body, health };
  });
}

test('105: a cold worker reads the signed price files side by side, not one after another', async () => {
  const url = 'https://remote105.test/data-' + Date.now();
  const remote = signedRemote(url, Object.fromEntries(SEEDS.map(f => [f, { schema: 2 }])));
  let inFlight = 0, most = 0; const order = [];
  const slow = remote.handlers.map(([re, h]) => [re, async (u, init) => { const name = u.slice(url.length + 1); inFlight++; most = Math.max(most, inFlight); order.push(['start', name]);
    await new Promise(r => setTimeout(r, 60)); inFlight--; order.push(['end', name]); return h(u, init); }]);
  const t = Date.now(), { body } = await coldLookup('https://cold-a.food-scan.test', remote, slow), took = Date.now() - t;
  const asked = order.filter(o => o[0] === 'start').map(o => o[1]);
  assert.ok(body.providers.observatory, 'answered');
  for (const f of SEEDS) assert.ok(asked.includes(f), 'asked for ' + f + ' (asked: ' + asked.join(', ') + ')');
  assert.ok(most >= 5, 'the manifest and the four sources\' files were in flight together: ' + most);
  const firstSeed = order.findIndex(o => o[0] === 'start' && o[1].startsWith('seeds/')), manifestEnd = order.findIndex(o => o[0] === 'end' && o[1] === 'integrity.json');
  assert.ok(firstSeed >= 0 && firstSeed < manifestEnd, 'the files are asked for while the signed manifest is still loading');
  assert.ok(took < asked.length * 60, `${asked.length} remote reads of 60 ms each took ${took} ms, less than one after another`);
});

test('105: a file fetched ahead of the manifest is still refused when its bytes do not match the signed hash', async () => {
  const url = 'https://remote105.test/tamper-' + Date.now(), name = 'seeds/bazaar-eshop-latest.json';
  // a manifest that would win (valid, newer, same size) if it were accepted; the bytes served differ from the bytes that were signed
  const bundled = JSON.parse(read('assets/gr-prices-v72/bazaar-eshop-latest.json'));
  const newer = { ...bundled, source: { ...bundled.source, fetched_at: new Date().toISOString(), snapshot: new Date().toISOString().slice(0, 10) } };
  const remote = signedRemote(url, { [name]: newer }, { tamper: { [name]: JSON.stringify({ ...newer, forged: true }) } });
  const { body, health } = await coldLookup('https://cold-b.food-scan.test', remote, remote.handlers);
  assert.equal(health.remote.integrity.status, 'ok', 'the signed manifest itself verified');
  assert.ok(health.remote.integrity.mismatches >= 1, 'the forged file was counted as a mismatch');
  assert.equal(body.providers.bazaar.snapshot, bundled.source.snapshot, 'and the bundled Bazaar data answered instead');
  const src = read('src/worker/prices.js');
  assert.match(src, /const m = await mTask; if \(!m\) return drop\(early\);\s*const want = m\.files\[name\]; if \(!want\) return drop\(early\);/, 'no manifest or an unlisted file: the early fetch is dropped unread');
});

test('105: the app asks in two steps, never keeps a snapshot, and announces the complete answer', async () => {
  // real payloads from the worker: the snapshot and the complete answer of the same product
  const two = await withShop(900, async ask => ({ snap: (await ask('&quick=1&fresh=1')).body, done: (await ask('')).body }));
  const asked = [], events = [], real = { fetch: globalThis.fetch, window: globalThis.window };
  globalThis.window = { dispatchEvent: e => { events.push(e.detail); return true; } };
  globalThis.fetch = async u => { asked.push(String(u)); return json(/[?&]quick=1/.test(String(u)) ? two.snap : two.done); };
  try {
    const { getPrices, peekPrices } = await import('../prices/price-client-v83.mjs?t=' + Date.now());
    const first = await getPrices(CODE, { market: 'GR' });
    assert.match(asked[0], /[?&]quick=1/, 'the first request is the quick one');
    assert.equal(first.livePending, true);
    assert.equal(first.best, null, 'nothing is shown as the cheapest while a shop is still being checked');
    assert.equal(peekPrices(CODE, 'GR'), null, 'the snapshot is not kept on the device');
    for (let i = 0; i < 50 && !events.length; i++) await new Promise(r => setTimeout(r, 10));
    assert.equal(asked.length, 2); assert.doesNotMatch(asked[1], /quick=1/, 'the follow-up is the same request without quick');
    assert.equal(events.length, 1); assert.equal(events[0].code, CODE); assert.equal(events[0].result.livePending, false);
    assert.equal(events[0].result.best.price, 0.95, 'the confirmed shop price leads once the complete answer is in');
    assert.equal(peekPrices(CODE, 'GR').best.price, 0.95, 'and the complete answer is the one kept');
    // a forced re-read ("Try again", a rescan) waits for everything in one request
    asked.length = 0; await getPrices(CODE, { market: 'GR', fresh: true });
    assert.doesNotMatch(asked[0], /quick=1/); assert.match(asked[0], /fresh=1/);
  } finally { globalThis.fetch = real.fetch; if (real.window === undefined) delete globalThis.window; else globalThis.window = real.window; }
});

test('105: the price card says a shop is being checked instead of "could not confirm", in all six languages', () => {
  const src = read('prices/native-v83.js');
  for (const l of ['en', 'el', 'fr', 'de', 'es', 'it']) assert.match(src, new RegExp(`\\n  ${l}:\\['[^']+…', '[^']+'\\],`), 'liveWait strings for ' + l);
  assert.match(src, /tx\(r\.livePending \? 'liveWait' : 'liveFail'\)/);
  assert.match(src, /r\?\.livePending && r\.best \? `<p class="fp80-stale fp105-wait" role="status">/);
  assert.match(src, /if \(e\.detail\.cheap\) cheapResults\.set\(c, /, 'a chip\'s complete answer goes back to the chips');
  // Seen in the browser while building 105: the card is redrawn only when its state key changes, and the key did not include the note, so the card
  // stayed on "Checking…" after the complete answer arrived with the same price. Both cards (with and without a grade card) carry it now.
  assert.equal(src.split("(r.livePending ? ':checking' : '')").length - 1, 2, 'the "checking" note is part of both redraw keys');
  assert.match(src, /have\.status === 'incomplete' \|\| have\.liveUnsettled\) \? 60000 : TTL/, 'an answer whose shop check never finished is asked again after a minute');
  assert.match(read('prices/native-v83.css'), /\.fp105-wait::before\{[^}]*animation:fp105-pulse/);
  assert.match(read('prices/native-v83.css'), /prefers-reduced-motion:reduce\)\{\.fp105-wait::before\{animation:none\}\}/);
});
