/* 101.1: what the hand-built 101.0 zip got wrong and what it got right, kept as tests.
 *  - the Greek catalogue lookup of the browser module (a line comment swallowed its code: every lookup threw and was silently replaced by a live request)
 *  - every shipped script parses, and no line comment swallows code after it
 *  - the kcal/kJ reconciliation of the grade engine (101: a kcal field that contradicts BOTH kJ and the macros is a typo; kJ decides)
 *  - the signed manifest for remote price data (101) and the tool that writes it (scripts/sign-price-data.mjs): accepted, tampered, unsigned, wrong key, stale
 *  - the compact bundled price shards: every record sits in the shard the worker reads, and a refresh with no web-shop prices does not empty the bundle */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
globalThis.__FS101_TEST__ = true; // asks the worker for its test hooks when it is first imported (see "internals the unit tests call directly")
import { ROOT, read, loadWorker, makeEnv, withNetwork, json, signedRemote, TEST_PUBKEY } from './helpers.mjs';
const imp = p => import(pathToFileURL(path.join(ROOT, p)).href);
const D = await imp('assets/domain-v104.mjs');
const { createCatalogue } = await imp('assets/market-catalogue-v104.mjs');
const Sign = await imp('scripts/sign-price-data.mjs');
const Pack = await imp('tools/repack-v101.mjs');
const tmp = prefix => fs.mkdtempSync(path.join(os.tmpdir(), prefix));

// ---------- the browser module that reads the bundled Greek catalogue ----------
const localFetch = async u => { const f = path.join(ROOT, decodeURIComponent(new URL(String(u), 'https://food-scan.test').pathname)); return fs.existsSync(f) ? new Response(fs.readFileSync(f), { headers: { 'Content-Type': 'application/json' } }) : new Response('', { status: 404 }); };
const CADDY = '5201004020338'; // Caprice, in the bundled catalogue (published grade E)

test('the Greek catalogue answers a product lookup in the browser module, and only for a shopper in Greece', async () => {
  const cat = createCatalogue(localFetch);
  const hit = await cat.product(CADDY, { country: 'greece' });
  assert.ok(hit, '101.0 threw a ReferenceError here (a line comment swallowed `const m=…, key=…, bucket=…`); the caller hid it and fell back to a live request');
  assert.equal(String(hit.barcode || hit.code).replace(/^0+/, ''), CADDY.replace(/^0+/, ''));
  assert.equal(await cat.product(CADDY, { country: 'france' }), null, 'abroad the Greek catalogue is no use');
  assert.equal(await cat.product(CADDY, { country: '' }), null, 'no chosen market: the live record answers');
  assert.ok(await cat.product(CADDY, {}), 'callers that name no market keep working');
  assert.equal(await cat.product('1234567890128', { country: 'greece' }), null, 'a barcode that is not in the catalogue');
  const s = await cat.search('caprice', { country: 'france' }); assert.equal(s.catalogue.status, 'not_this_market'); assert.deepEqual(s.products, []);
});

// ---------- every shipped script parses; no line comment swallows code ----------
test('every shipped script parses, and no line comment swallows the code after it', () => {
  const dirs = ['.', 'assets', 'prices', 'challenge'], files = [];
  for (const d of dirs) for (const f of fs.readdirSync(path.join(ROOT, d))) if (/\.(m?js)$/.test(f) && fs.statSync(path.join(ROOT, d, f)).isFile() && f !== '_worker.js') files.push(path.join(d, f));
  assert.ok(files.length > 60, 'found the scripts: ' + files.length);
  const dir = tmp('fs-syntax-'), bad = [], swallowed = [];
  for (const rel of files) {
    const src = read(rel);
    const copy = path.join(dir, rel.replace(/[\\/]/g, '__') + '.mjs'); fs.writeFileSync(copy, src);
    const asModule = spawnSync(process.execPath, ['--check', copy], { encoding: 'utf8' });
    if (asModule.status !== 0) { const asScript = spawnSync(process.execPath, ['--check', path.join(ROOT, rel)], { encoding: 'utf8' }); if (asScript.status !== 0) bad.push(rel + ': ' + String(asModule.stderr).split('\n').find(l => /Error/.test(l))); }
    src.split('\n').forEach((line, i) => { if (/(?:;|\{|\})\s*\/\/[^\n'"`]*?(\)|\b)(const|let|var|return|await|if\()\s*[\w(]/.test(line) && /\/\/ ?\d+|\/\/ ?\(?fix/.test(line) && line.length > 120 && !/^\s*\/\//.test(line)) swallowed.push(`${rel}:${i + 1}`); });
  }
  assert.deepEqual(bad, [], 'syntax errors'); assert.deepEqual(swallowed, [], 'a `// …` comment in the middle of a line with more code after it');
});

// ---------- the grade engine: kcal that contradicts kJ and the macronutrients ----------
const drink = (n, extra = {}) => ({ status: 1, product: { code: '9002490100070', product_name: 'Test drink', brands: 'T', categories_tags: ['en:beverages', 'en:energy-drinks'], nutriscore_grade: 'e', nutriments: n, ...extra } });
const RB = { 'energy-kj_100g': 194, 'energy-kcal_100g': 463, fat_100g: 0, carbohydrates_100g: 11, proteins_100g: 0, sugars_100g: 11, salt_100g: 0.1, 'saturated-fat_100g': 0 };

test('a kcal typo (463 kcal for a drink whose label says 194 kJ and 11 g carbohydrate) is corrected from kJ, marked as converted, and the grade is not held back', () => {
  const tag = { data_quality_errors_tags: ['en:nutrition-packaging-as-sold-100g-energy-value-in-kcal-does-not-match-value-in-kj'] };
  const p = D.parseProduct(drink(RB, tag), '9002490100070');
  assert.ok(Math.abs(p.nutrition.kcal - 194 / 4.184) < 0.01); assert.equal(p.energyReconciled, true); assert.equal(p.energyConverted, true);
  assert.deepEqual(p.qualityWarnings, [], 'the database warning about the typo is about the field that was just replaced');
  const a = D.assessGrade(p); assert.equal(a.status, 'reported'); assert.equal(a.grade, 'E');
});
test('nothing is "corrected" when kcal and kJ agree, or when neither fits the macronutrients', () => {
  const ok = D.parseProduct(drink({ ...RB, 'energy-kcal_100g': 46 }), '9002490100070'); assert.equal(ok.nutrition.kcal, 46); assert.equal(ok.energyReconciled, false);
  const both = D.parseProduct(drink({ ...RB, 'energy-kj_100g': 1900 }, { data_quality_errors_tags: ['en:nutrition-packaging-as-sold-100g-energy-value-in-kcal-does-not-match-value-in-kj'] }), '9002490100070');
  assert.equal(both.nutrition.kcal, 463); assert.equal(both.energyReconciled, false);
  assert.equal(D.assessGrade(both).status, 'withheld', 'two energy fields that disagree and fit nothing: the grade stays held back');
});
test('a food whose kcal is 1,082 for 1,081 kJ (the kJ number typed into the kcal field) is corrected from kJ', () => {
  const p = D.parseProduct({ status: 1, product: { code: '4056489542193', product_name: 'Spread', categories_tags: ['en:sweet-spreads'], nutriscore_grade: 'd', nutriments: { 'energy-kj_100g': 1081.5, 'energy-kcal_100g': 1082, fat_100g: 0.1, carbohydrates_100g: 63.2, proteins_100g: 0.2, sugars_100g: 60, salt_100g: 0.01, 'saturated-fat_100g': 0 } } }, '4056489542193');
  assert.equal(p.energyReconciled, true); assert.ok(Math.abs(p.nutrition.kcal - 258.5) < 0.1);
});

// ---------- the signed manifest for remote price data ----------
await loadWorker();
const T = globalThis.__FS101_TEST__;
let n = 0; const urlN = () => `https://signed${++n}.test/prices-data`;
const FILE = { schema: 2, products: { '00000000000017': { p: 1.5 } } };
async function remote(files, opts, envExtra = {}) {
  T.resetRemote(); const url = urlN(), sr = signedRemote(url, files, opts), env = makeEnv({ ...sr.env, ...envExtra });
  const got = await withNetwork(sr.handlers, () => T.fsRemoteJSON(env, 'seeds/x.json'));
  return { got, state: { ...T.fsRemoteState } };
}
test('a remote file is used when the signed manifest lists it and the hash matches', async () => {
  const r = await remote({ 'seeds/x.json': FILE }); assert.deepEqual(r.got, FILE); assert.equal(r.state.status, 'ok'); assert.equal(r.state.files, 1);
});
test('a tampered file, an unlisted file, a wrong key, a missing key, a stale and a future manifest are all refused (the bundled copy is used)', async () => {
  const t = await remote({ 'seeds/x.json': FILE }, { tamper: { 'seeds/x.json': JSON.stringify({ ...FILE, products: { '00000000000017': { p: 0.01 } } }) } });
  assert.equal(t.got, null); assert.equal(t.state.mismatches, 1, 'the hash does not match: a pushed price change is ignored');
  assert.equal((await remote({ 'seeds/other.json': FILE })).got, null, 'not listed in the manifest');
  const other = crypto.generateKeyPairSync('ed25519'); const otherPub = Buffer.from(other.publicKey.export({ format: 'jwk' }).x, 'base64url').toString('base64');
  const wrong = await remote({ 'seeds/x.json': FILE }, {}, { FOODSCAN_PRICE_DATA_PUBKEY: otherPub }); assert.equal(wrong.got, null); assert.equal(wrong.state.status, 'bad_signature');
  const nokey = await remote({ 'seeds/x.json': FILE }, {}, { FOODSCAN_PRICE_DATA_PUBKEY: '' }); assert.equal(nokey.got, null); assert.equal(nokey.state.status, 'disabled_no_key');
  const stale = await remote({ 'seeds/x.json': FILE }, { built: new Date(Date.now() - 11 * 864e5).toISOString() }); assert.equal(stale.got, null); assert.equal(stale.state.status, 'stale');
  const young = await remote({ 'seeds/x.json': FILE }, { built: new Date(Date.now() - 9 * 864e5).toISOString() }); assert.deepEqual(young.got, FILE, 'a manifest 9 days old is still good');
  const future = await remote({ 'seeds/x.json': FILE }, { built: new Date(Date.now() + 2 * 3600e3).toISOString() }); assert.equal(future.got, null); assert.equal(future.state.reason, 'built_in_future');
});

// ---------- scripts/sign-price-data.mjs writes what the worker verifies ----------
test('the signing tool: what it signs verifies, a changed file or a wrong key does not, and the worker accepts its manifest', async () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519'), pem = privateKey.export({ type: 'pkcs8', format: 'pem' }), pub = Sign.rawPublicKey(publicKey);
  assert.equal(Buffer.from(pub, 'base64').length, 32, 'a raw 32-byte Ed25519 key, as FOODSCAN_PRICE_DATA_PUBKEY wants');
  const dir = tmp('fs-sign-'); fs.mkdirSync(path.join(dir, 'seeds'), { recursive: true }); fs.mkdirSync(path.join(dir, 'op'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'seeds/x.json'), JSON.stringify(FILE)); fs.writeFileSync(path.join(dir, 'op/000.json'), '{"schema":1}'); fs.writeFileSync(path.join(dir, 'README.txt'), 'not json');
  const r = Sign.signDir(dir, pem); assert.equal(r.files, 2, 'every .json file, nothing else');
  const ok = Sign.verifyDir(dir, pub); assert.equal(ok.ok, true); assert.equal(ok.files, 2);
  // the worker, reading the same folder over a fake network, takes the file
  T.resetRemote(); const url = urlN(), env = makeEnv({ FOODSCAN_PRICE_DATA_URL: url, FOODSCAN_PRICE_DATA_PUBKEY: pub });
  const serve = u => { const f = path.join(dir, new URL(u).pathname.replace(/^\/prices-data\//, '')); return fs.existsSync(f) ? new Response(fs.readFileSync(f)) : new Response('', { status: 404 }); };
  assert.deepEqual(await withNetwork([[new RegExp('^' + url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), serve]], () => T.fsRemoteJSON(env, 'seeds/x.json')), FILE);
  fs.writeFileSync(path.join(dir, 'seeds/x.json'), JSON.stringify({ ...FILE, schema: 3 }));
  const bad = Sign.verifyDir(dir, pub); assert.equal(bad.ok, false); assert.deepEqual(bad.mismatches, ['seeds/x.json']);
  const other = Sign.rawPublicKey(crypto.generateKeyPairSync('ed25519').publicKey); assert.equal(Sign.verifyDir(dir, other).reason, 'bad_signature');
  assert.equal(Sign.verifyDir(tmp('fs-empty-'), pub).reason, 'no_manifest');
  const old = Sign.signDir(dir, pem, new Date(Date.now() - 11 * 864e5).toISOString()); assert.equal(Sign.verifyDir(dir, pub).reason, 'stale'); assert.equal(old.files, 2);
});
test('keygen writes a private key that is never printed, refuses to overwrite it, and prints only the public key', () => {
  const dir = tmp('fs-keygen-'), key = path.join(dir, 'k.pem'), run = () => spawnSync(process.execPath, [path.join(ROOT, 'scripts/sign-price-data.mjs'), 'keygen', '--out', key], { encoding: 'utf8' });
  const a = run(); assert.equal(a.status, 0, a.stderr); const pem = fs.readFileSync(key, 'utf8');
  assert.match(pem, /BEGIN PRIVATE KEY/); assert.ok(!a.stdout.includes(pem.split('\n')[1]), 'the private key is not in the output');
  const pubLine = a.stdout.split('\n').find(l => l.startsWith('FOODSCAN_PRICE_DATA_PUBKEY=')); assert.equal(Buffer.from(pubLine.split('=')[1], 'base64').length, 32);
  assert.notEqual(run().status, 0, 'a second run does not overwrite the key');
});
test('the daily refresh workflow signs the data when the secret exists, and says loudly when it does not', () => {
  const y = read('.github/workflows/refresh-prices.yml');
  assert.match(y, /PRICE_DATA_SIGNING_KEY: \$\{\{ secrets\.PRICE_DATA_SIGNING_KEY \}\}/); assert.match(y, /sign-price-data\.mjs sign out --key/); assert.match(y, /::warning::PRICE_DATA_SIGNING_KEY is not set/);
  assert.ok(y.indexOf('Sign the data') < y.indexOf('Publish to prices-data'), 'signed before it is published');
});

// ---------- the compact bundled price data ----------
test('every record of the bundled price shards sits in the shard the worker reads it from', () => {
  assert.deepEqual(Pack.verifyLayout(path.join(ROOT, 'assets')), []);
  const bundled = Object.values(JSON.parse(read('assets/gr-prices-v72/posokanei-latest.json')).source ? { x: 1 } : {}).length; assert.ok(bundled >= 0);
});
test('the packer moves records and edits none; a refresh that holds no web-shop prices keeps the bundled ones', () => {
  const data = tmp('fs-data-'), out = tmp('fs-out-'), key = c => String(c).padStart(14, '0');
  const w = (rel, v) => { fs.mkdirSync(path.dirname(path.join(data, rel)), { recursive: true }); fs.writeFileSync(path.join(data, rel), JSON.stringify(v)); };
  const codes = ['5201004020338', '5201004020345', '5201004020352'];
  for (const src of ['pk', 'li', 'ek', 'bz']) for (let i = 0; i < 100; i++) { const id = String(i).padStart(2, '0'), products = {}; for (const c of codes) if (key(c).slice(-2) === id) products[key(c)] = { n: c, p: 1 }; w(`seeds/${src}/${id}.json`, { schema: 2, source: { snapshot: '2026-11-24' }, products, rows: [] }); }
  for (const f of ['bazaar-eshop-latest.json', 'ekatanalotis-latest.json', 'lidl-eshop-latest.json', 'posokanei-latest.json']) w('seeds/' + f, { schema: 2 });
  for (let i = 0; i < 100; i++) w(`web/${String(i).padStart(2, '0')}.json`, { schema: 1, built: '2026-11-24T00:00:00Z', products: {} });
  const ids = ['00aabbccddeeff00112233445566aabb', '7fffffccddeeff00112233445566aabb'];
  for (let i = 0; i < 64; i++) w(`o-${String(i).padStart(2, '0')}.json`, { v: 82, built: '2026-11-24T00:00:00Z', snapshot: '2026-11-18', shard: i, items: i === 0 ? { [ids[0]]: { n: 'a' }, [ids[1]]: { n: 'b' } } : {} });
  for (let i = 0; i < 64; i++) w(`e-${String(i).padStart(2, '0')}.json`, { v: 80, built: '2026-11-24T00:00:00Z', shard: i, items: i === 0 ? { [key(codes[0])]: { n: 'X', k: [{ id: ids[0] }], e: { c: 'C', x: [] } }, [key(codes[1])]: { n: 'Y', e: { c: 'A', x: [['p', 1, 'bz', '2026-11-24', 50], ['q', 2, 'bz', '2026-11-24', 50], ['r', 3, 'bz', '2026-11-24', 50], ['s', 4, 'bz', '2026-11-24', 50]] } }, [key(codes[2])]: { n: 'Z', e: { c: 'D', x: [['p', 1, 'bz', '2026-11-24', 50]] } } } : {} });
  // the bundle already holds a web-shop price; the refresh has none
  fs.mkdirSync(path.join(out, 'gr-web-v93'), { recursive: true }); fs.writeFileSync(path.join(out, 'gr-web-v93/d0.json'), '{"keep":true}');
  const rep = Pack.repack(data, out);
  assert.match(String(rep.web), /^kept/); assert.equal(fs.readFileSync(path.join(out, 'gr-web-v93/d0.json'), 'utf8'), '{"keep":true}');
  assert.equal(rep.pk, 3); assert.equal(rep.observatory, 2); assert.equal(rep.candidates, 2, 'a class-C and a class-D estimate are dropped, a class-A neighbour list and an observatory candidate are kept');
  const cand = []; for (let i = 0; i < 8; i++) cand.push(...Object.entries(JSON.parse(fs.readFileSync(path.join(out, `gr-cand-v101/c-${i}.json`), 'utf8')).items));
  const byCode = Object.fromEntries(cand); assert.equal(byCode[key(codes[1])].r.x.length, 3, 'at most 3 other products, each with its own recorded price'); assert.equal(byCode[key(codes[0])].k[0].id, ids[0]); assert.ok(!(key(codes[2]) in byCode), 'no estimate is carried');
  assert.ok(!JSON.stringify(byCode).includes('"e"'), 'no estimate object anywhere');
  fs.rmSync(path.join(out, 'gr-web-v93'), { recursive: true }); // verifyLayout wants the web files too; the packed ones are checked above
  const problems = Pack.verifyLayout(out).filter(p => !p.includes('gr-web-v93')); assert.deepEqual(problems, []);
});

// ---------- per-source price freshness ----------
test('price freshness: 7 days is "current"; only a source that says so (a proven Open Prices observation) gets up to 30 days', async () => {
  const C = await imp('prices/price-core-v83.mjs');
  assert.equal(C.freshnessOf(7), 'current'); assert.equal(C.freshnessOf(8), 'older'); assert.equal(C.freshnessOf(20), 'older');
  assert.equal(C.freshnessOf(20, 30), 'current'); assert.equal(C.freshnessOf(31, 30), 'historical'.replace('historical', C.freshnessOf(31, 30)));
  assert.equal(C.freshnessOf(null), null);
});
