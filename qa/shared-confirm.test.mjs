/* 91: shared shopper confirmations (POST /api/prices/confirm, FOODSCAN_PRICES_DB). Real SQLite (node:sqlite) with the real schema file, the real bundled
 * candidate shards (which list the observatory candidates of a barcode) and the real observatory shards.
 * 101 (fix 10): a link is shared only after at least 5 independent confirmations AND an admin's approval (GET/POST /api/prices/links/review). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { read, loadWorker, makeEnv, withNetwork, compare, peek, fakeD1 } from './helpers.mjs';

const CODE = '5201310704960', PK = 'aef9980492af473a9f06b65dd12c66d0', OTHER = 'f858cef465194801b9987a04f1857bbe'; // ΥΦΑΝΤΗΣ ΠΑΡΙΖΑΚΙ 330G; candidate "ΥΦΑΝΤΗΣ παριζάκι γαλοπούλα 330g"
const TOKEN = 'a'.repeat(40);
const NET = i => `10.7.${i}.1`; // one voter per /24 network
function database() { const db = fakeD1(); db.exec(read('d1-schema/prices_db.sql')); return db; }
async function vote(env, pk, v, ip, code = CODE) {
  const worker = await loadWorker();
  const req = new Request('https://food-scan.test/api/prices/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://food-scan.test', 'CF-Connecting-IP': ip }, body: JSON.stringify({ barcode: code, pk, vote: v }) });
  return withNetwork([], async () => { const res = await worker.fetch(req, env, { waitUntil() {} }); return { status: res.status, body: await res.json() }; });
}
async function review(env, method, body, token = TOKEN) {
  const worker = await loadWorker();
  const req = new Request('https://food-scan.test/api/prices/links/review', { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const res = await worker.fetch(req, env, { waitUntil() {} }); return { status: res.status, body: await res.json() };
}
const offline = { FOODSCAN_PRICE_DATA_URL: 'off' };
/** Five voters on five networks confirm PK; returns the answer to the fifth. */
async function fiveVotes(env, pk = PK) { let last; for (let i = 1; i <= 5; i++) last = await vote(env, pk, 1, NET(i)); return last; }

test('without the database, a confirmation still works on the device and the server says shared confirmations are off', async () => {
  const r = await vote(makeEnv(offline), PK, 1, '198.51.100.7');
  assert.equal(r.status, 503); assert.equal(r.body.error, 'not_configured');
});

test('101: four confirmations are pending, the fifth puts the link in review, and only an admin approval shares it with everyone', async () => {
  const env = makeEnv({ ...offline, FOODSCAN_PRICES_DB: database(), FOODSCAN_PRICES_ADMIN_TOKEN: TOKEN });
  const before = await compare(CODE, { market: 'GR', env });
  assert.ok(before.body.candidates.some(c => c.id === PK), 'the product is offered as a candidate');
  assert.equal(before.body.community, null);
  const a = await vote(env, PK, 1, '198.51.100.7');
  assert.equal(a.status, 200); assert.equal(a.body.status, 'pending'); assert.equal(a.body.confirmations, 1); assert.equal(a.body.needed, 5); assert.equal(a.body.review, true);
  const same = await vote(env, PK, 1, '198.51.100.99'); // same /24 network: the same voter
  assert.equal(same.body.confirmations, 1, 'one household counts once');
  for (let i = 1; i <= 3; i++) assert.equal((await vote(env, PK, 1, NET(i))).body.status, 'pending', `${i + 1} voters are not enough`);
  const fifth = await vote(env, PK, 1, NET(4));
  assert.equal(fifth.body.confirmations, 5); assert.equal(fifth.body.status, 'pending_review');
  assert.equal((await compare(CODE, { market: 'GR', env })).body.community, null, 'nothing is shared before the review');
  assert.equal((await review(env, 'GET', null, '')).status, 401, 'the review list needs the admin token');
  const list = await review(env, 'GET'); assert.equal(list.status, 200); assert.equal(list.body.min, 5);
  assert.ok(list.body.pending.some(r => r.ean === '05201310704960' && r.pk_id === PK && r.confirmations === 5), JSON.stringify(list.body));
  const ok = await review(env, 'POST', { barcode: CODE, approve: true }); assert.equal(ok.status, 200); assert.equal(ok.body.status, 'active');
  const after = await compare(CODE, { market: 'GR', env });
  assert.equal(after.body.community?.id, PK); assert.equal(after.body.community.confirmations, 5);
  const shared = after.body.offers.filter(o => o.match === 'community-confirmed');
  assert.ok(shared.length > 0, 'the confirmed product\'s own chain prices are shown');
  assert.ok(shared.every(o => o.id.startsWith('pk:')), 'observatory prices only');
  assert.deepEqual(after.body.candidates, [], 'no more candidates once shared');
  const p = await peek([CODE], { market: 'GR', env });
  assert.ok(p.body.items[0].best || p.body.items[0].latest, 'lists show the shared prices too');
});

test('101: a rejected link is never shared, and nothing is approved that is not waiting for review', async () => {
  const env = makeEnv({ ...offline, FOODSCAN_PRICES_DB: database(), FOODSCAN_PRICES_ADMIN_TOKEN: TOKEN });
  assert.equal((await review(env, 'POST', { barcode: CODE, approve: true })).status, 409, 'nothing pending yet');
  await fiveVotes(env);
  assert.equal((await review(env, 'POST', { barcode: CODE, approve: false })).body.status, 'rejected');
  assert.equal((await compare(CODE, { market: 'GR', env })).body.community, null);
  assert.equal((await review(env, 'POST', { barcode: CODE, approve: true })).status, 409, 'a rejected link is not pending any more');
  assert.equal((await review(env, 'POST', { barcode: '123', approve: true })).status, 400);
});

test('101: with FS_CONFIRM_REVIEW=0 five confirmations share the link at once; FS_CONFIRM_MIN can raise the bar but never go below 5', async () => {
  const solo = makeEnv({ ...offline, FOODSCAN_PRICES_DB: database(), FS_CONFIRM_REVIEW: '0' });
  assert.equal((await fiveVotes(solo)).body.status, 'shared');
  const low = makeEnv({ ...offline, FOODSCAN_PRICES_DB: database(), FS_CONFIRM_MIN: '2' });
  assert.equal((await vote(low, PK, 1, NET(1))).body.needed, 5, 'a configured 2 is raised to 5');
  const high = makeEnv({ ...offline, FOODSCAN_PRICES_DB: database(), FS_CONFIRM_MIN: '7' });
  assert.equal((await vote(high, PK, 1, NET(1))).body.needed, 7);
});

test('disputes switch a shared link off; a product FoodScan did not offer, or another pack size, is refused', async () => {
  const env = makeEnv({ ...offline, FOODSCAN_PRICES_DB: database(), FOODSCAN_PRICES_ADMIN_TOKEN: TOKEN });
  await fiveVotes(env); await review(env, 'POST', { barcode: CODE, approve: true });
  assert.equal((await compare(CODE, { market: 'GR', env })).body.community?.id, PK, 'shared after the approval');
  await vote(env, PK, -1, NET(11)); await vote(env, PK, -1, NET(12));
  assert.equal((await compare(CODE, { market: 'GR', env })).body.community?.id, PK, 'two disputes against five confirmations: still under half');
  await vote(env, PK, -1, NET(13));
  assert.equal((await compare(CODE, { market: 'GR', env })).body.community, null, 'three disputes against five confirmations stop it (disputes must stay under half)');
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
