/* 102.0: every shopper is placed by where they really are. These tests pin: the time-zone -> country table, the one location order shared by every page
 * (choice, profile, network, phone clock, browser language, nothing), the offer (never a silent switch) when a roaming phone's clock disagrees with the
 * network, "Automatic" really being automatic, country-specific drink sizes, the worker never inventing Greek prices for a visitor nobody can place,
 * and the Home hub's wiring. Nothing here touches the network. */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, read, compare, loadWorker, makeEnv, withNetwork, fakeOpenPrices } from './helpers.mjs';

const imp = f => import(pathToFileURL(path.join(ROOT, f)).href + '?t=' + Math.random());

/** Runs fn(market) with a fake device: a fresh localStorage, an optional <meta name="fs-country">, a time zone and browser languages. Everything is restored. */
async function withDevice({ meta = null, zone = 'UTC', langs = ['en'], store = {} } = {}, fn) {
  const keep = { ls: globalThis.localStorage, doc: globalThis.document, dtf: Intl.DateTimeFormat, nav: Object.getOwnPropertyDescriptor(globalThis, 'navigator') };
  const mem = new Map(Object.entries(store));
  globalThis.localStorage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
  globalThis.document = { querySelector: sel => (sel === 'meta[name="fs-country"]' && meta ? { content: meta.content, getAttribute: a => (a === 'data-source' ? meta.source ?? null : null) } : null) };
  Intl.DateTimeFormat = function () { return { resolvedOptions: () => ({ timeZone: zone }) }; };
  Object.defineProperty(globalThis, 'navigator', { value: { languages: langs, language: langs[0] }, configurable: true });
  try { return await fn(await imp('prices/market-v83.mjs'), mem); }
  finally {
    globalThis.localStorage = keep.ls; globalThis.document = keep.doc; Intl.DateTimeFormat = keep.dtf;
    if (keep.nav) Object.defineProperty(globalThis, 'navigator', keep.nav); else delete globalThis.navigator;
  }
}

test('the device time zone names its country, including old zone names; UTC and unknown zones name none', async () => {
  const { countryOfZone, TZ_COUNTRY_COUNT } = await imp('prices/tz-country-v102.mjs');
  const cases = { 'Europe/Athens': 'GR', 'America/New_York': 'US', 'America/Sao_Paulo': 'BR', 'Asia/Tokyo': 'JP', 'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN', 'Australia/Sydney': 'AU', 'Africa/Cairo': 'EG', 'Pacific/Auckland': 'NZ', 'Europe/London': 'GB',
    UTC: '', 'Etc/GMT+5': '', '': '', 'Mars/Olympus': '' };
  for (const [zone, cc] of Object.entries(cases)) assert.equal(countryOfZone(zone), cc, zone);
  assert.equal(countryOfZone(undefined), ''); assert.equal(countryOfZone(null), '');
  assert.ok(TZ_COUNTRY_COUNT >= 240, 'the table covers (almost) every country');
});

test('the tz table check passes on the real table and fails on a broken copy (a zone in two countries, an old name pointing nowhere)', async () => {
  const { spawnSync } = await import('node:child_process'), fs = await import('node:fs'), os = await import('node:os');
  const run = root => spawnSync(process.execPath, [path.join(root, 'tools/build-tz-country.mjs'), '--check'], { encoding: 'utf8' });
  const good = run(ROOT); assert.equal(good.status, 0, good.stderr); assert.match(good.stdout, /^OK: \d+ zones in \d+ countries/);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-tz-')); fs.mkdirSync(path.join(tmp, 'tools')); fs.mkdirSync(path.join(tmp, 'prices'));
  try {
    fs.copyFileSync(path.join(ROOT, 'tools/build-tz-country.mjs'), path.join(tmp, 'tools/build-tz-country.mjs'));
    let mod = read('prices/tz-country-v102.mjs');
    mod = mod.replace('AD:Europe/Andorra;', 'AD:Europe/Andorra,Europe/Tirane;').replace('Africa/Asmera>Africa/Nairobi,', 'Africa/Asmera>Africa/Nowhere,');   // Tirane is Albania's; Nowhere does not exist
    fs.writeFileSync(path.join(tmp, 'prices/tz-country-v102.mjs'), mod);
    const bad = run(tmp); assert.equal(bad.status, 1);
    assert.match(bad.stderr, /zone Europe\/Tirane is in both AD and AL/); assert.match(bad.stderr, /Africa\/Asmera points at unknown zone Africa\/Nowhere/);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('the browser language names a country only when it carries a region (script subtags and underscores included)', async () => {
  const { languageCountry } = await imp('prices/market-v83.mjs');
  assert.equal(languageCountry(['en-US', 'el']), 'US'); assert.equal(languageCountry(['el', 'en-GB']), 'GB');   // the first language that has a region
  assert.equal(languageCountry(['fr-CA']), 'CA'); assert.equal(languageCountry(['en_GB']), 'GB');
  assert.equal(languageCountry(['zh-Hant-TW']), 'TW'); assert.equal(languageCountry(['zh-Hans-CN']), 'CN'); assert.equal(languageCountry(['sr-Latn-RS']), 'RS');
  assert.equal(languageCountry(['el']), ''); assert.equal(languageCountry(['de']), ''); assert.equal(languageCountry(['es-419']), '');   // a bare language or a world region says nothing
  assert.equal(languageCountry([]), ''); assert.equal(languageCountry([null, '']), '');
});

test('one location order for every page: choice, profile, network, phone clock, language, nothing (and nothing is never Greece)', async () => {
  // nothing known at all: the app asks
  await withDevice({}, m => assert.deepEqual(m.detectMarket(), { code: '', source: 'unknown' }));
  // browser language alone (a guess), then the phone's clock beats it
  await withDevice({ langs: ['pt-BR'] }, m => assert.deepEqual(m.detectMarket(), { code: 'BR', source: 'language' }));
  await withDevice({ langs: ['pt-BR'], zone: 'Asia/Tokyo' }, m => assert.deepEqual(m.detectMarket(), { code: 'JP', source: 'device' }));
  // the network beats the clock; the clock disagreeing makes an offer, never a switch
  await withDevice({ meta: { content: 'DE' }, zone: 'Europe/Berlin' }, m => assert.deepEqual(m.detectMarket(), { code: 'DE', source: 'network' }));
  await withDevice({ meta: { content: 'DE' }, zone: 'Europe/Madrid' }, m => assert.deepEqual(m.detectMarket(), { code: 'DE', source: 'network', suggest: 'ES' }));
  // the shopper's own profile country beats the network; an explicit choice beats the profile
  await withDevice({ meta: { content: 'DE' }, store: { 'fs13:profile': JSON.stringify({ country: 'france' }) } }, m => assert.deepEqual(m.detectMarket(), { code: 'FR', source: 'profile' }));
  await withDevice({ meta: { content: 'DE' }, store: { 'fs13:profile': JSON.stringify({ country: 'france' }), 'foodscan:market:v83': 'JP' } }, m => assert.deepEqual(m.detectMarket(), { code: 'JP', source: 'choice' }));
  // Cloudflare's "unknown" codes and a tag written by the time-zone hint are not network answers
  await withDevice({ meta: { content: 'XX' } }, m => assert.equal(m.detectMarket().code, ''));
  await withDevice({ meta: { content: 'T1' }, zone: 'Europe/Paris' }, m => assert.deepEqual(m.detectMarket(), { code: 'FR', source: 'device' }));
  await withDevice({ meta: { content: 'FR', source: 'timezone' }, zone: 'Asia/Tokyo' }, m => assert.deepEqual(m.detectMarket(), { code: 'JP', source: 'device' }));
});

test('the country list has no duplicate or retired entries (Serbia once, never YU), and names are in the six app languages', async () => {
  const { ALL_MARKETS, marketsSorted, marketName } = await imp('prices/market-v83.mjs');
  assert.ok(!ALL_MARKETS.includes('YU') && ALL_MARKETS.includes('RS') && ALL_MARKETS.includes('XK'));
  for (const lang of ['en', 'el', 'fr', 'de', 'es', 'it']) {
    const names = marketsSorted(lang).map(c => c.name); assert.equal(new Set(names).size, names.length, `${lang}: every country appears once`);
  }
  assert.equal(marketName('GR', 'el'), 'Ελλάδα'); assert.equal(marketName('DE', 'de'), 'Deutschland'); assert.equal(marketName('uk', 'en'), 'United Kingdom');
});

test('the network country is remembered (a cached page shell has no tag) and the offer can be declined for that pair only', async () => {
  await withDevice({ meta: { content: 'DE' }, zone: 'Europe/Madrid' }, async (m, mem) => {
    assert.equal(m.networkCountry(), 'DE'); assert.equal(mem.get('foodscan:net:v102'), 'DE');
    assert.equal(m.detectMarket().suggest, 'ES');
    m.dismissSuggestion('DE', 'ES'); assert.deepEqual(m.detectMarket(), { code: 'DE', source: 'network' });
    assert.equal(m.suggestionFor('DE', 'IT'), 'IT', 'a different phone country is a new offer');
  });
  // the page has no tag now, but the same device remembered the last network answer
  await withDevice({ store: { 'foodscan:net:v102': 'NL' } }, m => assert.deepEqual(m.detectMarket(), { code: 'NL', source: 'network' }));
});

test('"Automatic" really is automatic: choosing a country and then going back follows the network again', async () => {
  await withDevice({ meta: { content: 'DE' } }, (m, mem) => {
    m.setMarket('jp');
    assert.deepEqual(m.detectMarket(), { code: 'JP', source: 'choice' }); assert.equal(JSON.parse(mem.get('fs13:profile')).country, 'japan');
    m.setMarket('');   // before 102.0 the profile's "japan" kept winning for ever
    assert.equal(JSON.parse(mem.get('fs13:profile')).country, 'any');
    assert.deepEqual(m.detectMarket(), { code: 'DE', source: 'network' });
  });
  // a profile that never named a country is left alone
  await withDevice({ store: { 'fs13:profile': JSON.stringify({ diet: 'vegan' }) } }, (m, mem) => { m.setMarket(''); assert.equal(JSON.parse(mem.get('fs13:profile')).country, undefined); });
});

test('one-tap drink sizes follow the country: US cups and cans, 350 ml cans in Japan and Brazil, 375 ml in Australia, 330 ml elsewhere', async () => {
  const { presetsFor } = await imp('daily-v98-core.mjs');
  const drink = { basis: 'ml' }, amounts = (p, c) => presetsFor(p, c).map(x => `${x.kind}:${x.amount}`);
  assert.deepEqual(amounts(drink, 'US'), ['cup:240', 'can:355', 'bottle:500']);
  assert.deepEqual(amounts(drink, 'us'), amounts(drink, 'US'));
  assert.ok(amounts(drink, 'CA').includes('can:355') && amounts(drink, 'MX').includes('can:355'));
  assert.ok(amounts(drink, 'JP').includes('can:350') && amounts(drink, 'BR').includes('can:350'));
  assert.ok(amounts(drink, 'AU').includes('can:375'));
  for (const c of ['', 'GR', 'DE', 'GB', 'IN', 'ZZ', undefined]) assert.deepEqual(amounts(drink, c), ['glass:200', 'cup:250', 'can:330', 'bottle:500'], String(c));
  // the product's own pack always comes first, and solid foods do not change by country
  assert.equal(presetsFor({ basis: 'ml', quantity: '330 ml' }, 'US')[0].amount, 330);
  assert.deepEqual(amounts({ basis: 'g' }, 'US'), amounts({ basis: 'g' }, 'GR'));
});

test('the worker never invents Greek prices for a visitor nobody can place, and a stated country always wins', async () => {
  const CODE = '5201004023360';
  for (const country of ['XX', 'T1']) {
    const { res, body, calls } = await compare(CODE, { country });
    assert.equal(res.status, 200); assert.equal(body.status, 'market_unknown', country); assert.equal(body.offers.length, 0); assert.equal(body.market.code, '');
    assert.equal(calls.length, 0, 'no price source is asked for a visitor nobody can place');
    assert.equal(res.headers.get('cache-control'), 'no-store', 'an answer about who the visitor is must not be shared');
    assert.match(body.limitations.join(' '), /Choose your country/);
  }
  // an explicit ?market= (the shopper's choice) beats a network that cannot say
  const chosen = await compare(CODE, { country: 'XX', market: 'US' });
  assert.notEqual(chosen.body.status, 'market_unknown'); assert.equal(chosen.body.market.code, 'US');
  // the network's country decides when the shopper chose nothing
  const de = await compare(CODE, { country: 'DE' }); assert.equal(de.body.market.code, 'DE');
  // a runtime with no geolocation at all (a local preview, these tests) keeps the old Greek default
  const local = await compare(CODE, {}); assert.equal(local.body.market.code, 'GR');
});

test('the list lookup says the same: no country, no prices, a clear status per code', async () => {
  const worker = await loadWorker(), fake = fakeOpenPrices([], {});
  const request = new Request('https://food-scan.test/api/prices/peek?codes=5201004023360,3017620422003', { headers: { 'CF-Connecting-IP': '203.0.113.9' } });
  Object.defineProperty(request, 'cf', { value: { country: 'XX' } });
  const res = await withNetwork(fake.handlers, () => worker.fetch(request, makeEnv(), { waitUntil() {} })), body = await res.json();
  assert.equal(res.status, 200); assert.equal(body.status, 'market_unknown'); assert.equal(body.market, '');
  assert.deepEqual(body.items.map(i => i.status), ['market_unknown', 'market_unknown']); assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal(fake.calls.length, 0, 'no price source is asked for a visitor nobody can place');
});

test('the Home hub shows where the shopper is, and everything that depends on the country follows it', () => {
  const hub = read('daily-v98.js'), css = read('daily-v98.css'), sw = read('sw.js');
  assert.match(hub, /import \{[^}]*detectMarket[^}]*setMarket[^}]*dismissSuggestion[^}]*\} from '\.\/prices\/market-v83\.mjs'/);
  // shown in both hub states: a brand-new phone is exactly where the country matters most
  assert.equal((hub.match(/\$\{locHtml\(t, lang\(\)\)\}/g) || []).length, 2); assert.equal((hub.match(/; wireLoc\(h, view, t\)/g) || []).length, 2);   // two calls (the definition has no "; " before it)
  // the amounts, the change detection and the price cache all follow the country
  assert.match(hub, /presetsFor\(p, marketNow\(\)\.code\)/); assert.match(hub, /\$\{mk\.code\}:\$\{mk\.source\}:\$\{mk\.suggest \|\| ''\}/);
  assert.match(hub, /addEventListener\('foodscan:market'/); assert.match(hub, /priceBook\.clear\(\)/);
  // a country offer is only ever a tap away, never silent
  assert.match(hub, /data-fs102-use/); assert.match(hub, /data-fs102-keep/); assert.ok(!/setMarket\(m\.suggest\)/.test(hub));
  // both languages have every location string
  const en = hub.slice(hub.indexOf('const TX'), hub.indexOf('\n  el: {')), el = hub.slice(hub.indexOf('\n  el: {'), hub.indexOf('\n};', hub.indexOf('\n  el: {')));
  for (const k of ['locLabel', 'locChange', 'locAuto', 'locPick', 'locSrc', 'locUnknownTitle', 'locUnknownSub', 'locSuggest', 'locUse', 'locKeep', 'locSaved']) { assert.ok(en.includes(k + ':'), 'en ' + k); assert.ok(el.includes(k + ':'), 'el ' + k); }
  assert.match(css, /\.fs102-loc__sel/); assert.match(css, /\.fs102-loc__sug/);
  // offline: the hub imports the location module, which imports the time-zone table: both are precached
  assert.ok(sw.includes("'/prices/market-v83.mjs'") && sw.includes("'/prices/tz-country-v102.mjs'"));
});
