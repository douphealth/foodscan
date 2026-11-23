/* 98.1: a pause of the third-party observatory archive must not stop the whole daily price refresh. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { ROOT, read } from './helpers.mjs';

const { newestSnapshotDay, MAX_BACK_DAYS, STALE_AFTER_DAYS } = await import(pathToFileURL(path.join(ROOT, 'price-refresh/refresh/src/snapshot-day.mjs')).href);
const NOW = Date.parse('2026-11-23T10:00:00Z');
const only = days => async day => days.includes(day);

test("today's snapshot is used and is not stale", async () => {
  assert.deepEqual(await newestSnapshotDay(only(['2026-11-23']), { now: NOW }), { day: '2026-11-23', ageDays: 0, stale: false });
});

test('the real case of 23 Nov 2026: the archive stopped on 18 Nov, the newest snapshot is used with its true date and marked stale', async () => {
  const tried = [];
  const pick = await newestSnapshotDay(async day => { tried.push(day); return day <= '2026-11-18'; }, { now: NOW });
  assert.deepEqual(pick, { day: '2026-11-18', ageDays: 5, stale: true });
  assert.equal(tried.length, 6, 'it stops at the first snapshot that exists');
});

test('a snapshot up to 3 days old is still normal; the 4th day is stale', async () => {
  assert.equal((await newestSnapshotDay(only(['2026-11-20']), { now: NOW })).stale, false);
  assert.equal((await newestSnapshotDay(only(['2026-11-19']), { now: NOW })).stale, true);
  assert.equal(STALE_AFTER_DAYS, 3);
});

test('before 98.1 anything older than 6 days stopped the refresh; now 45 days are covered, and only a longer pause is an error', async () => {
  assert.equal((await newestSnapshotDay(only(['2026-10-20']), { now: NOW })).ageDays, 34);
  assert.equal(await newestSnapshotDay(only([]), { now: NOW }), null);
  assert.equal(await newestSnapshotDay(only(['2026-10-01']), { now: NOW }), null, '53 days old is beyond the window');
  assert.equal(MAX_BACK_DAYS, 45);
});

test('the refresh script uses it, keeps shop crawls independent, and records the observatory age in the manifest', () => {
  const src = read('price-refresh/refresh/scripts/refresh-prices.mjs');
  assert.match(src, /newestSnapshotDay/);
  assert.doesNotMatch(src, /d < 6 && !pkDate/, 'the 6-day limit is gone');
  assert.match(src, /::warning title=Observatory snapshot/);
  assert.match(src, /ageDays: pkPick\.ageDays, stale: pkPick\.stale/);
});

const { feedPublishedSince } = await import(pathToFileURL(path.join(ROOT, 'price-refresh/refresh/src/snapshot-day.mjs')).href);
test('the frozen ministry file is noticed the day it changes, and a missing or odd header never raises a false alarm', () => {
  assert.equal(feedPublishedSince('Tue, 16 Jun 2026 07:19:47 GMT', '2026-06-16'), null, 'unchanged since the stored snapshot');
  assert.equal(feedPublishedSince('Mon, 23 Nov 2026 06:00:00 GMT', '2026-06-16'), '2026-11-23');
  assert.equal(feedPublishedSince(null, '2026-06-16'), null);
  assert.equal(feedPublishedSince('not a date', '2026-06-16'), null);
});
