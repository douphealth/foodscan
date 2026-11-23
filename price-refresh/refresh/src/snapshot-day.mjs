/** 98.1 · which observatory snapshot the daily refresh uses.
 *
 *  The observatory archive (github.com/spyrosavl/posokanei) is published by a third party and can pause for days. Before 98.1 the refresh
 *  looked back 6 days and then failed, which also stopped the Bazaar, Lidl and Open Prices updates. Now it takes the newest snapshot of the
 *  last `maxBack` days, keeps its true date (nothing is re-dated), and reports how old it is. The app already shows a price older than
 *  7 days as "last recorded price" with its age, so a stale observatory is shown honestly, not hidden. */
export const MAX_BACK_DAYS = 45;
export const STALE_AFTER_DAYS = 3;

const dayOf = (now, back) => new Date(now - back * 86400000).toISOString().slice(0, 10);

/** `tryDay(day)` resolves true when it fetched that day's snapshot. Returns { day, ageDays, stale } or null when nothing is found. */
export async function newestSnapshotDay(tryDay, { now = Date.now(), maxBack = MAX_BACK_DAYS, staleAfter = STALE_AFTER_DAYS } = {}) {
  for (let back = 0; back <= maxBack; back++) {
    const day = dayOf(now, back);
    if (await tryDay(day)) return { day, ageDays: back, stale: back > staleAfter };
  }
  return null;
}

/** The e-katanalotis ministry file carries one date for the whole file (its Last-Modified). It has not changed since 16 Jun 2026, so the refresh
 *  carries it forward; this says when the ministry has started publishing again so that someone imports it instead of it staying frozen unseen.
 *  `lastModified` is the HTTP header value, `snapshotDay` the date of the stored seed (YYYY-MM-DD). Returns the new day or null. */
export function feedPublishedSince(lastModified, snapshotDay) {
  const t = Date.parse(lastModified || ''); if (!Number.isFinite(t)) return null;
  const day = new Date(t).toISOString().slice(0, 10);
  return day > String(snapshotDay || '') ? day : null;
}
