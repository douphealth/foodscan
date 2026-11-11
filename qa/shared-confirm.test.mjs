/* 91: shared shopper confirmations (POST /api/prices/confirm, FOODSCAN_PRICES_DB). Real SQLite (node:sqlite) with the real schema file, the real bundled
 * estimate shards (which list the observatory candidates of a barcode) and the real observatory shards. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { read, loadWorker, makeEnv, withNetwork, compare, peek, fakeD1 } from './helpers.mjs';

const CODE = '5201310704960', PK = 'aef9980492af473a9f06b65dd12c66d0', OTHER = 'f858cef465194801b9987a04f1857bbe'; // ΥΦΑΝΤΗΣ ΠΑΡΙΖΑΚΙ 330G; candidate "ΥΦΑΝΤΗΣ παριζάκι γαλοπούλα 330g"
function database() { const db = fakeD1(); db.exec(read('d1-schema/prices_db.sql')); return db; }
async function vote(env, pk, v, ip, code = CODE) {
  const worker = await loadWorker();
  const req = new Request('https://food-scan.test/api/prices/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://food-scan.test', 'CF-Connecting-IP': ip }, body: JSON.stringify({ barcode: code, pk, vote: v }) });
  return withNetwork([], async () => { const res = await worker.fetch(req, env, { waitUntil() {} }); return { status: res.status, body: await res.json() }; });
}
const offline = { FOODSCAN_PRICE_DATA_URL: 'off' };

test('without the database, a confirmation still works on the device and the server says shared confirmations are off', async () => {
  const r = await vote(makeEnv(offline), PK, 1, '198.51.100.7');
  assert.equal(r.status, 503); assert.equal(r.body.error, 'not_configured');
});

test('one confirmation is pending; a second voter on another network shares the link with everyone; the product page then shows its chain prices', async () => {
  const env = makeEnv({ ...offline, FOODSCAN_PRICES_DB: database() });
  const before = await compare(CODE, { market: 'GR', env });
  assert.ok(before.body.candidates.some(c => c.id === PK), 'the product is offered as a candidate');
  assert.equal(before.body.community, null);
  const a = await vote(env, PK, 1, '198.51.100.7');
  assert.equal(a.status, 200); assert.equal(a.body.status, 'pending'); assert.equal(a.body.confirmations, 1); assert.equal(a.body.needed, 2);
  const same = await vote(env, PK, 1, '198.51.100.99'); // same /24 network: the same voter
  assert.equal(same.body.status, 'pending'); assert.equal(same.body.confirmations, 1, 'one household counts once');
  const b = await vote(env, PK, 1, '192.0.2.9');
  assert.equal(b.body.status, 'shared'); assert.equal(b.body.confirmations, 2);
  const after = await compare(CODE, { market: 'GR', env });
  assert.equal(after.body.community?.id, PK); assert.equal(after.body.community.confirmations, 2);
  const shared = after.body.offers.filter(o => o.match === 'community-confirmed');
  assert.ok(shared.length > 0, 'the confirmed product\'s own chain prices are shown');
  assert.ok(shared.every(o => o.id.startsWith('pk:')), 'observatory prices only');
  assert.deepEqual(after.body.candidates, [], 'no more candidates once shared');
  const p = await peek([CODE], { market: 'GR', env });
  assert.ok(p.body.items[0].best || p.body.items[0].latest, 'lists show the shared prices too');
});

test('disputes switch a shared link off; a product FoodScan did not offer, or another pack size, is refused', async () => {
  const env = makeEnv({ ...offline, FOODSCAN_PRICES_DB: database() });
  await vote(env, PK, 1, '198.51.100.7'); assert.equal((await vote(env, PK, 1, '192.0.2.9')).body.status, 'shared');
  await vote(env, PK, -1, '203.0.113.5');
  assert.equal((await compare(CODE, { market: 'GR', env })).body.community, null, 'one dispute against two confirmations is enough to stop showing it (disputes must stay under half)');
  assert.equal((await vote(env, 'a'.repeat(32), 1, '198.51.100.7')).status, 422, 'not a candidate');
  const otherSize = await vote(env, OTHER, 1, '198.51.100.7'); // "IFANTIS Πάριζα σε φέτες 200g" for a 330 g barcode
  assert.equal(otherSize.status, 422); assert.equal(otherSize.body.error, 'pack_mismatch', 'the barcode\'s record says 330 g: a 200 g product is never linked');
});

test('a voter can withdraw a confirmation, and cross-site requests are refused', async () => {
  const env = makeEnv({ ...offline, FOODSCAN_PRICES_DB: database() });
  await vote(env, PK, 1, '198.51.100.7');
  const w = await vote(env, PK, 0, '198.51.100.7'); assert.equal(w.body.confirmations, 0);
  const worker = await loadWorker();
  const res = await worker.fetch(new Request('https://food-scan.test/api/prices/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.test' }, body: JSON.stringify({ barcode: CODE, pk: PK, vote: 1 }) }), env, { waitUntil() {} });
  assert.equal(res.status, 403);
});
