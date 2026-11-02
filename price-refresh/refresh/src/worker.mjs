/* FoodScan 74 · automatic price ingestion (Cloudflare cron Worker). Separate from the Pages site; writes only to the
 * FOODSCAN_PRICES_DB D1 database that the site reads live (foodscan_price_offers).
 *
 * Daily ("20 18 * * *", retry "40 3 * * *"):
 *   1. posokanei.gov.gr observatory: newest daily archive snapshot (today, else up to 3 days back), read once. New barcodes seen in
 *      the retailer web shops are linked automatically only with an exact same-chain price proof (src/automatch.mjs); then every
 *      linked product's chain prices are written with their own dates. Price changes are recorded.
 *   2. e-katanalotis: checked by ETag; written only when 30 days old or newer.
 *   3. housekeeping: rows older than 120 days are removed; the run log keeps 90 days.
 * Hourly ("7 * * * *"): one polite slice of each retailer web shop (Bazaar, Lidl) continues from its cursor in D1 (src/crawl.mjs).
 * Every step logs to foodscan_price_ingest_runs; /health shows the last successful run per source. One failing source never
 * stops the others. Nothing is estimated: a failed source writes nothing and its older rows keep their real dates. */
import linkDoc from '../data/ean-posokanei-map-v2.json' with { type: 'json' };
import { readSnapshot, ingestProducts, archiveURL, SOURCE as PK } from './posokanei.mjs';
import { parseFeed, FEED_URL, MERCHANTS, SOURCE as EK } from './ekatanalotis.mjs';
import { SCHEMA, rowFor, writeRowsTracked } from './d1.mjs';
import { autoLinks, mergeLinks } from './automatch.mjs';
import { runSlice, logRun } from './crawl.mjs';
import { adapter as bazaar } from './sources/bazaar.mjs';
import { adapter as lidl } from './sources/lidl.mjs';

export const VERSION = '74.0.0';
export const CRAWLERS = { bazaar, lidl };
export const CRON = { daily: ['20 18 * * *', '40 3 * * *'], hourly: '7 * * * *' };
const UA = { 'User-Agent': 'FoodScan-ingest/74 (+https://food-scan.gearuptofit.com/how/)' };
const DAY = 86400000;
const label = id => Object.values(MERCHANTS).find(m => m[0] === id)?.[1] || id;
const log = (db, source, status, rows = 0, snapshot = null, detail = '') => logRun(db, source, status, rows, snapshot, detail);

export async function ensureSchema(db) { for (const q of SCHEMA.split(';').map(x => x.trim()).filter(Boolean)) await db.prepare(q).run(); }

export async function runPosokanei(env, { now = Date.now(), fetchImpl = fetch, bundled = linkDoc, minProducts = 1000 } = {}) {
  const db = env.FOODSCAN_PRICES_DB;
  for (let back = 0; back <= 3; back++) {
    const day = new Date(now - back * DAY).toISOString().slice(0, 10), url = archiveURL(day);
    const res = await fetchImpl(url, { headers: UA, cf: { cacheTtl: 600 } });
    if (!res.ok) { await res.body?.cancel(); continue; }
    const snap = await readSnapshot(res.body);
    if (!snap.meta.date || (snap.meta.scanned || 0) < minProducts) { await log(db, PK.id, 'snapshot_incomplete', 0, snap.meta.date || null, JSON.stringify({ url, scanned: snap.meta.scanned || 0 })); return { rows: 0, error: 'snapshot_incomplete' }; }
    // automatic links for barcodes the web shops showed in the last 3 days
    const prior = (await db.prepare('SELECT ean, pk_id, pk_name, method, evidence, created_at FROM foodscan_pk_links').all()).results || [];
    const linkedEans = new Set([...bundled.links.map(l => l.ean), ...prior.map(l => l.ean)]);
    const cutoff = new Date(now - 3 * DAY).toISOString();
    const cands = ((await db.prepare('SELECT barcode, source_id, name, brand, price_cents, regular_cents, updated_at FROM foodscan_barcode_names WHERE updated_at >= ?').bind(cutoff).all()).results || [])
      .filter(c => !linkedEans.has(String(c.barcode).replace(/^0+(?=\d{8,})/, '')));
    const auto = autoLinks({ products: snap.products, snapshotDate: snap.meta.date, candidates: cands, nowISO: new Date(now).toISOString(),
      linked: { eans: linkedEans, ids: new Set([...bundled.links.map(l => l.pk_id), ...prior.map(l => l.pk_id)]), rejected: new Set([...(bundled.rejected_in_review || []), ...(bundled.auto_refused || [])].map(x => x.ean)) } });
    for (let i = 0; i < auto.links.length; i += 50) await db.batch(auto.links.slice(i, i + 50).map(l => db.prepare('INSERT OR IGNORE INTO foodscan_pk_links (ean,pk_id,pk_name,method,evidence,created_at) VALUES (?,?,?,?,?,?)')
      .bind(l.ean, l.pk_id, l.pk_name, l.method, JSON.stringify(l.evidence), l.created_at)));
    const merged = mergeLinks(bundled, [...prior.map(l => ({ ...l, evidence: undefined })), ...auto.links]);
    const pk = ingestProducts(snap.products, merged, snap.meta, { archive: url, now, minProducts });
    const nowISO = new Date(now).toISOString();
    const w = await writeRowsTracked(db, pk.records.map(r => rowFor(r, PK, nowISO)), nowISO);
    await log(db, PK.id, 'ok', w.rows, pk.meta.date, JSON.stringify({ linked: pk.stats.linked, found: pk.stats.found, new_auto_links: auto.links.length, changes: w.changes, renamed: pk.stats.renamed.length, chains: pk.stats.chains }));
    return { snapshot: pk.meta.date, rows: w.rows, changes: w.changes, new_links: auto.links.length, renamed: pk.stats.renamed.length };
  }
  await log(db, PK.id, 'no_snapshot', 0, null, 'no archive file for the last 4 days');
  return { snapshot: null, rows: 0 };
}

export async function runEkatanalotis(env, { now = Date.now(), fetchImpl = fetch } = {}) {
  const db = env.FOODSCAN_PRICES_DB;
  const last = await db.prepare("SELECT detail FROM foodscan_price_ingest_runs WHERE source_id='ekatanalotis' AND status IN ('ok','unchanged','stale') ORDER BY run_at DESC LIMIT 1").first().catch(() => null);
  const head = await fetchImpl(FEED_URL, { method: 'HEAD', headers: UA });
  const etag = head.headers.get('ETag') || '', modified = head.headers.get('Last-Modified') || '';
  if (last?.detail && etag && last.detail.includes(etag)) { await log(db, EK.id, 'unchanged', 0, null, JSON.stringify({ etag, modified })); return { unchanged: true }; }
  const res = await fetchImpl(FEED_URL, { headers: UA });
  if (!res.ok) { await log(db, EK.id, 'http_' + res.status); return { rows: 0 }; }
  const feed = parseFeed(await res.json());
  if (!feed.date || (now - Date.parse(feed.date + 'T00:00:00Z')) / DAY > 30) { await log(db, EK.id, 'stale', 0, feed.date, JSON.stringify({ etag, modified, note: 'older than 30 days: kept out of the database (the site shows it as history from its seed)' })); return { stale: feed.date }; }
  const nowISO = new Date(now).toISOString(), rows = [];
  for (const [k, p] of Object.entries(feed.products)) for (const [chain, price, date] of p.p)
    rows.push(rowFor({ barcode: k, retailer_id: chain, retailer: label(chain), store_scope: 'national', store_id: 'ekatanalotis', store_name: label(chain), price, basis: 'item', observed_at: date, discount_type: '', source_url: EK.url }, EK, nowISO));
  const w = await writeRowsTracked(db, rows, nowISO);
  await log(db, EK.id, 'ok', w.rows, feed.date, JSON.stringify({ etag, modified, changes: w.changes }));
  return { snapshot: feed.date, rows: w.rows, changes: w.changes };
}

export async function housekeeping(db, now = Date.now()) {
  const d = n => new Date(now - n * DAY).toISOString();
  await db.batch([
    db.prepare("DELETE FROM foodscan_price_offers WHERE source_id IN ('posokanei','ekatanalotis','bazaar','lidl') AND observed_at < ?").bind(d(120).slice(0, 10)),
    db.prepare('DELETE FROM foodscan_price_ingest_runs WHERE run_at < ?').bind(d(90)),
    db.prepare('DELETE FROM foodscan_price_changes WHERE detected_at < ?').bind(d(400)),
    db.prepare('DELETE FROM foodscan_barcode_names WHERE updated_at < ?').bind(d(120)),
  ]);
}

/** Runs the named steps; each one is isolated, so one failure is logged and the rest still run. */
export async function run(env, steps = ['posokanei', 'ekatanalotis', 'housekeeping'], opts = {}) {
  const db = env.FOODSCAN_PRICES_DB;
  if (!db) throw new Error('FOODSCAN_PRICES_DB binding missing');
  await ensureSchema(db);
  const job = {
    posokanei: () => runPosokanei(env, opts), ekatanalotis: () => runEkatanalotis(env, opts), housekeeping: () => housekeeping(db, opts.now).then(() => ({ ok: true })),
    ...Object.fromEntries(Object.entries(CRAWLERS).map(([id, a]) => [id, () => runSlice(db, a, { ...(opts.crawl || {}), fetchImpl: opts.fetchImpl, now: opts.clock })])),
  };
  const ids = steps.filter(s => job[s]);
  // crawlers read different hosts: they run side by side (each still one request at a time); the rest in order
  const parallel = ids.filter(s => CRAWLERS[s]), serial = ids.filter(s => !CRAWLERS[s]);
  const out = {};
  const guard = async s => { try { out[s] = await job[s](); } catch (e) { out[s] = { error: String(e?.message || e).slice(0, 500) }; await log(db, s, 'error', 0, null, out[s].error); } };
  await Promise.all([(async () => { for (const s of serial) await guard(s); })(), ...parallel.map(guard)]);
  return out;
}

export async function health(db, now = Date.now()) {
  const runs = (await db.prepare(`SELECT r.source_id, r.run_at, r.snapshot_date, r.status, r.rows FROM foodscan_price_ingest_runs r
    JOIN (SELECT source_id, MAX(run_at) m FROM foodscan_price_ingest_runs GROUP BY source_id) x ON x.source_id=r.source_id AND x.m=r.run_at`).all()).results || [];
  const ok = (await db.prepare(`SELECT source_id, MAX(run_at) last_ok FROM foodscan_price_ingest_runs WHERE status IN ('ok','cycle_done','unchanged') GROUP BY source_id`).all()).results || [];
  const counts = (await db.prepare('SELECT source_id, COUNT(*) offers, COUNT(DISTINCT barcode) barcodes, MAX(observed_at) newest FROM foodscan_price_offers GROUP BY source_id').all()).results || [];
  const crawl = (await db.prepare('SELECT source_id, cycle, position, json_array_length(targets) targets, cycle_started_at, last_cycle_done_at, last_status, last_ok_at, consecutive_failures FROM foodscan_crawl_state').all()).results || [];
  const changes = await db.prepare('SELECT COUNT(*) n FROM foodscan_price_changes WHERE detected_at >= ?').bind(new Date(now - 7 * DAY).toISOString()).first().catch(() => ({ n: null }));
  const links = await db.prepare('SELECT COUNT(*) n FROM foodscan_pk_links').first().catch(() => ({ n: null }));
  return { version: VERSION, runs, last_ok: ok, counts, crawl, changes_7d: changes?.n ?? null, worker_links: links?.n ?? null };
}

export default {
  async scheduled(event, env, ctx) {
    const steps = event.cron === CRON.hourly ? Object.keys(CRAWLERS) : ['posokanei', 'ekatanalotis', 'housekeeping'];
    ctx.waitUntil(run(env, steps, { crawl: { maxPages: 250, budgetMs: 11 * 60000, delayMs: 1500 } }));
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') {   // read-only, no secrets
      if (!env.FOODSCAN_PRICES_DB) return Response.json({ error: 'no_database' }, { status: 503 });
      await ensureSchema(env.FOODSCAN_PRICES_DB);
      return Response.json(await health(env.FOODSCAN_PRICES_DB), { headers: { 'Cache-Control': 'no-store' } });
    }
    if (request.method !== 'POST' || url.pathname !== '/run') return new Response('Not found', { status: 404 });
    // Manual run for the operator only: POST with the same admin token as the site's import endpoint.
    const token = env.FOODSCAN_PRICES_ADMIN_TOKEN, given = (request.headers.get('Authorization') || '').replace(/^Bearer /, '');
    if (!token || token.length < 32 || given !== token) return new Response('Unauthorized', { status: 401 });
    const src = url.searchParams.get('source') || 'daily';
    const steps = src === 'daily' ? ['posokanei', 'ekatanalotis', 'housekeeping'] : src === 'crawl' ? Object.keys(CRAWLERS) : src.split(',');
    return Response.json(await run(env, steps, { crawl: { maxPages: 60, budgetMs: 4 * 60000, delayMs: 1500 } }));
  },
};
