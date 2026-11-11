/* 92: web price search with webclaw and NO model: one barcode search, the price read by code, then the 84 verifier. The shop pages here are made up
 * (modelled on the shapes seen on real Greek shop pages on 11 Nov 2026), so no third-party content is stored. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { read, makeEnv, compare, fakeD1, json } from './helpers.mjs';
const src = read('src/worker/webprices.js');
const W = new Function(src + '\nreturn { fsWebFromPage, fsWebVerifyOffers, fsWebEuroAmounts, fsWebConfigured };')();
const q = { code: '05201024005438', market: 'GR', currencies: ['EUR'], name: 'lays chorizo and onion', brand: 'Lays', quantity: '95 γρ' };
const page = (url, text, title = '') => ({ url, title, site: '', text });

test('the price attached to the product is read; per-kg prices, struck-through old prices and other products further down are not', () => {
  const kiosk = page('https://www.kiosk-example.gr/p/3605', "# LAY'S CHORIZO & ONION 95gr\n- **Model:** 5201024005438\n1,80€\nΧωρίς ΦΠΑ: 1,80€\nΠοσότητα");
  const o = W.fsWebFromPage(q, kiosk); assert.equal(o.price, 1.8); assert.equal(o.packSize, '95gr'); assert.equal(o.match, 'barcode');
  const shop = page('https://shop-example.gr/lays', "# LAY'S Chorizo 95gr\n~~2,10€~~ 1,85 €\n(19,47 € / κιλό)\nBarcode: 5201024005438\n\n## Σχετικά προϊόντα\nOREO 154g 1,74 €\nFROU FROU 200g 2,19 €");
  assert.equal(W.fsWebFromPage(q, shop).price, 1.85, 'the struck-through 2,10 and the per-kilo 19,47 are ignored');
  assert.deepEqual(W.fsWebEuroAmounts('0,87 € / 100 g and 2,60 € and ανά κιλό 8,00 €').map(a => a.v), [2.6]);
});

test('no barcode on the page, no pack size, two different prices side by side, or sold out: no price', () => {
  const why = {};
  assert.equal(W.fsWebFromPage(q, page('https://x.gr/a', "# LAY'S CHORIZO 95gr\n1,80€"), why), null); assert.equal(why.reason, 'barcode_not_on_page');
  assert.equal(W.fsWebFromPage(q, page('https://x.gr/b', "# LAY'S CHORIZO\n5201024005438\n1,80€")), null, 'no pack size in the product heading');
  const w2 = {}; assert.equal(W.fsWebFromPage(q, page('https://x.gr/c', "# LAY'S CHORIZO 95gr\n5201024005438\n1,80€ 2,40€"), w2), null); assert.equal(w2.reason, 'ambiguous_price');
  const sold = W.fsWebFromPage(q, page('https://x.gr/d', "# LAY'S CHORIZO & ONION 95gr\nBarcode: 5201024005438\n1,80€\nΕξαντλήθηκε"));
  assert.equal(sold.inStock, false);
  assert.equal(W.fsWebVerifyOffers([sold], [page('https://x.gr/d', "# LAY'S CHORIZO & ONION 95gr\nBarcode: 5201024005438\n1,80€\nΕξαντλήθηκε")], q).length, 0, 'the verifier drops sold-out items');
});

test('the verifier still applies: another pack size than the label is refused', () => {
  const p = page('https://x.gr/e', "# LAY'S CHORIZO & ONION 150gr\nBarcode: 5201024005438\n2,40€");
  const o = W.fsWebFromPage(q, p); assert.ok(o);
  assert.equal(W.fsWebVerifyOffers([o], [p], q).length, 0, '150 g is not the label\'s 95 g');
});

test('WEBCLAW_API_KEY alone switches the search on (no Firecrawl, no Anthropic); a Cyprus or B2B page never counts; the price shows on the card', async () => {
  assert.equal(W.fsWebConfigured({ FOODSCAN_PRICES_DB: {}, WEBCLAW_API_KEY: 'x' }), true);
  assert.equal(W.fsWebConfigured({ FOODSCAN_PRICES_DB: {}, FIRECRAWL_API_KEY: 'x' }), false);
  const db = fakeD1(); db.exec(read('d1-schema/prices_db.sql'));
  const env = makeEnv({ FOODSCAN_PRICE_DATA_URL: 'off', FOODSCAN_PRICES_DB: db, WEBCLAW_API_KEY: 'test-key' });
  const calls = [];
  const webclaw = [/^https:\/\/api\.webclaw\.io\/v1\/search/, (url, init) => { calls.push(JSON.parse(init.body)); assert.equal(init.headers.Authorization, 'Bearer test-key'); return json({ results: [
    { url: 'https://cheap-example.com.cy/lays/5201024005438', metadata: { title: 'Lays' }, markdown: "# LAY'S CHORIZO & ONION 95gr\n5201024005438\n1,10€" },
    { url: 'https://b2b.maker-example.gr/lays', metadata: { title: 'Lays' }, markdown: "# LAY'S CHORIZO & ONION 95gr\n5201024005438\n0,90€" },
    { url: 'https://www.kiosk-example.gr/p/3605', metadata: { title: "LAY'S CHORIZO & ONION 95gr", site_name: 'Kiosk Example' }, markdown: "# LAY'S CHORIZO & ONION 95gr\n- **Model:** 5201024005438\n1,80€\nΧωρίς ΦΠΑ: 1,80€" },
  ] }); }];
  const blockedModel = [/api\.(anthropic|firecrawl)\./, () => { throw new Error('no model and no Firecrawl may be called'); }];
  const r = await compare('5201024005438', { market: 'GR', env, extra: [webclaw, blockedModel], deep: true });
  assert.equal(calls.length, 1, 'one search'); assert.equal(calls[0].query, '5201024005438'); assert.equal(calls[0].country, 'gr');
  const web = r.body.offers.filter(o => String(o.id).startsWith('ws:'));
  assert.equal(web.length, 1, JSON.stringify(r.body.providers.webSearch)); assert.equal(web[0].price, 1.8);
  assert.ok(!r.body.offers.some(o => o.price === 1.1 || o.price === 0.9), 'the Cyprus shop and the B2B site never count');
});
