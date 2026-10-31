import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { APP, importFile } from './helpers.mjs';

// A D1-shaped wrapper over SQLite (node:sqlite): prepare().bind().run()/first()/all(), enough for the Worker's backup queries.
function d1() {
  const db = new DatabaseSync(':memory:');
  return { raw: db, prepare: sql => { let args = []; const stmt = { bind: (...a) => { args = a; return stmt; }, run: async () => { db.prepare(sql).run(...args); return { success: true }; }, first: async () => db.prepare(sql).get(...args) ?? null, all: async () => ({ results: db.prepare(sql).all(...args) }) }; return stmt; } };
}
const assets = { fetch: async () => new Response('nf', { status: 404 }) };
let worker;
before(async () => { globalThis.fetch = () => Promise.reject(new TypeError('offline')); worker = (await importFile(join(APP, '_worker.js'))).default; });
const TOKEN = 'k7Tq2mV9xR4nB8cZ1wY5uJ3hG6fD0sAaPlOeIiUyTrE'; // 43 url-safe chars (256 bit when generated randomly)
const BLOB = Buffer.from('opaque-encrypted-bytes'.repeat(20)).toString('base64');
const call = (env, method = 'GET', { token = TOKEN, body, query = '' } = {}) => worker.fetch(new Request(`https://food-scan.gearuptofit.com/api/sync${query}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }), { ASSETS: assets, ...env }, { waitUntil() {} });
const enabled = () => ({ FOODSCAN_SYNC: '1', FOOD_DB: d1() });

test('the endpoint is dormant unless explicitly enabled and bound', async () => {
  assert.equal((await call({ FOOD_DB: d1() }, 'POST', { body: { data: BLOB } })).status, 404);
  assert.equal((await call({ FOODSCAN_SYNC: '1' }, 'POST', { body: { data: BLOB } })).status, 404);
});

test('the old token-in-the-URL / any-string-token behaviour is gone', async () => {
  const env = enabled();
  assert.equal((await call(env, 'GET', { token: null, query: '?token=a' })).status, 400, 'token in the address is refused');
  assert.equal((await call(env, 'POST', { token: 'a', body: { data: BLOB } })).status, 401, 'a short guessable key is refused');
  assert.equal((await call(env, 'POST', { token: 'x'.repeat(42), body: { data: BLOB } })).status, 401);
  assert.equal((await call(env, 'GET', { token: null })).status, 401);
});

test('only an opaque, size-capped blob is stored: readable JSON and oversize payloads are refused', async () => {
  const env = enabled();
  assert.equal((await call(env, 'POST', { body: { data: '{"foods":["5201673006909"]}' } })).status, 400);
  assert.equal((await call(env, 'POST', { body: { data: 'A'.repeat(262145) } })).status, 400);
  assert.equal((await call(env, 'POST', { body: { data: '' } })).status, 400);
  assert.equal((await call(env, 'POST', { body: 'not json' })).status, 400);
  assert.equal((await call(env, 'POST', { body: { data: BLOB } })).status, 204);
});

test('round trip, wrong key, owner delete; the database never holds the key itself', async () => {
  const env = enabled();
  assert.equal((await call(env, 'POST', { body: { data: BLOB } })).status, 204);
  const got = await call(env, 'GET'); assert.equal(got.status, 200); assert.equal((await got.json()).data, BLOB); assert.equal(got.headers.get('Cache-Control'), 'no-store');
  assert.equal((await call(env, 'GET', { token: 'Z' + TOKEN.slice(1) })).status, 404, 'unknown key looks exactly like no backup');
  const rows = env.FOOD_DB.raw.prepare('SELECT * FROM cloud_sync_v2').all();
  assert.equal(rows.length, 1); assert.match(rows[0].id, /^[0-9a-f]{64}$/); assert.ok(!JSON.stringify(rows).includes(TOKEN));
  assert.equal((await call(env, 'DELETE')).status, 204);
  assert.equal((await call(env, 'GET')).status, 404);
});

test('abuse limits: writes are rate limited per key, the table is capped, retention is enforced', async () => {
  const env = enabled();
  assert.equal((await call(env, 'POST', { body: { data: BLOB } })).status, 204);
  const again = await call(env, 'POST', { body: { data: BLOB } }); assert.equal(again.status, 429); assert.equal(again.headers.get('Retry-After'), '5');
  env.FOOD_DB.raw.prepare('UPDATE cloud_sync_v2 SET updated_at=updated_at-?').run(200 * 864e5);
  assert.equal((await call(env, 'GET')).status, 404, 'a backup older than 180 days is not served');
  // capacity: fill to the cap with fresh rows, a new key is refused, an existing key can still update
  const full = enabled(), ins = full.FOOD_DB.raw;
  await call(full, 'POST', { body: { data: BLOB } });
  ins.exec('BEGIN'); const st = ins.prepare('INSERT INTO cloud_sync_v2(id,payload,created_at,updated_at) VALUES(?,?,?,?)'); for (let i = 0; i < 20000; i++) st.run('id' + i, 'QQ==', Date.now(), Date.now()); ins.exec('COMMIT');
  assert.equal((await call(full, 'POST', { token: 'n'.repeat(43), body: { data: BLOB } })).status, 503);
});

test('the legacy plaintext-token table is never read', async () => {
  const env = enabled();
  env.FOOD_DB.raw.exec("CREATE TABLE cloud_sync(token TEXT PRIMARY KEY, payload TEXT, updated_at INTEGER); INSERT INTO cloud_sync VALUES('" + TOKEN + "','LEGACY',1)");
  assert.equal((await call(env, 'GET')).status, 404);
});
