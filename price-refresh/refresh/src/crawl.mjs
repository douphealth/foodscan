/* FoodScan 74 · incremental, polite web-shop crawl with its cursor in D1 (table foodscan_crawl_state).
 *
 * Each hourly cron run reads one slice of one retailer's public pages and stops at whichever comes first: the page budget,
 * the time budget, or the end of the cycle. The next run continues at the stored position; at the end a new cycle starts
 * with a fresh target list. Rules, all enforced here:
 *  - robots.txt is read at the start of every slice; a path it disallows is never fetched. robots.txt that cannot be read
 *    (5xx / network) stops the slice (RFC 9309: assume disallow).
 *  - one request at a time with a fixed pause between requests; an identifying User-Agent.
 *  - HTTP 401/403/429/503, a redirect to another host, or a challenge page = "blocked": the slice stops, nothing is retried
 *    in another way, the position stays put, and the status is logged. Nothing is ever bypassed.
 *  - a page that cannot be parsed is counted and skipped; a price is written only when the retailer's page itself pairs it
 *    with a valid barcode (sources/*.mjs). Nothing is estimated or carried over.
 */
import { parseRobots, allowed, sha1 } from './robots.mjs';
import { rowFor, writeRowsTracked } from './d1.mjs';

export const UA = 'Mozilla/5.0 (compatible; FoodScan-prices/74; +https://food-scan.gearuptofit.com/how/)';
const CHALLENGE = /(_Incapsula_Resource|cf-chl-|challenge-platform|g-recaptcha|hcaptcha|Access Denied|Request unsuccessful)/i;

export async function loadState(db, id) {
  const r = await db.prepare('SELECT * FROM foodscan_crawl_state WHERE source_id=?').bind(id).first();
  return r ? { ...r, targets: JSON.parse(r.targets || '[]') } : { source_id: id, targets: [], position: 0, cycle: 0, cycle_started_at: null, last_cycle_done_at: null, robots_sha1: null, last_ok_at: null, pages_ok: 0, pages_failed: 0, consecutive_failures: 0 };
}
async function saveState(db, s) {
  await db.prepare(`INSERT INTO foodscan_crawl_state (source_id,targets,position,cycle,cycle_started_at,last_cycle_done_at,robots_sha1,last_run_at,last_ok_at,last_status,pages_ok,pages_failed,consecutive_failures,detail)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(source_id) DO UPDATE SET targets=excluded.targets,position=excluded.position,cycle=excluded.cycle,cycle_started_at=excluded.cycle_started_at,
    last_cycle_done_at=excluded.last_cycle_done_at,robots_sha1=excluded.robots_sha1,last_run_at=excluded.last_run_at,last_ok_at=excluded.last_ok_at,last_status=excluded.last_status,
    pages_ok=excluded.pages_ok,pages_failed=excluded.pages_failed,consecutive_failures=excluded.consecutive_failures,detail=excluded.detail`)
    .bind(s.source_id, JSON.stringify(s.targets), s.position, s.cycle, s.cycle_started_at, s.last_cycle_done_at, s.robots_sha1, s.last_run_at, s.last_ok_at, s.last_status, s.pages_ok, s.pages_failed, s.consecutive_failures, String(s.detail || '').slice(0, 1500)).run();
}
export async function logRun(db, source, status, rows = 0, snapshot = null, detail = '', nowISO = new Date().toISOString()) {
  try { await db.prepare('INSERT OR REPLACE INTO foodscan_price_ingest_runs (run_at,source_id,snapshot_date,status,rows,detail) VALUES (?,?,?,?,?,?)')
    .bind(nowISO, source, snapshot, status, rows, String(detail).slice(0, 1500)).run(); } catch {}
}
const pathOf = u => { const x = new URL(u); return x.pathname + x.search; };
const isoAthensDate = ms => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Europe/Athens' });   // YYYY-MM-DD in Greece

/** Item from a source parser -> D1 row (online / web-shop price with its own fetch time). */
export function itemRow(it, S, nowISO, observedDate) {
  return rowFor({ barcode: it.ean, retailer_id: S.retailer_id, retailer: S.retailer, store_scope: S.store_scope, store_id: S.store_id, store_name: S.store_name,
    price: it.price, regular_price: it.regular, basis: 'item', observed_at: observedDate, discount_type: it.regular ? 'SALE' : '', key_discount: '',
    valid_until: it.valid_until, source_url: it.url }, S, nowISO);
}

/**
 * One slice. opts: fetchImpl, now() (ms), sleep(ms), maxPages, budgetMs, delayMs.
 * Returns {status, pages, rows, changes, position, of, cycle}.
 */
export async function runSlice(db, adapter, opts = {}) {
  const S = adapter.source, f = opts.fetchImpl || fetch, now = opts.now || Date.now, sleep = opts.sleep || (ms => new Promise(r => setTimeout(r, ms)));
  const maxPages = opts.maxPages ?? 120, budgetMs = opts.budgetMs ?? 9 * 60000, delayMs = opts.delayMs ?? 1500;
  const t0 = now(), st = await loadState(db, S.id), runISO = new Date(t0).toISOString();
  const get = (url, extra = {}) => f(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'el-GR,el;q=0.9' }, redirect: 'follow', ...extra });
  const finish = async (status, out, detail) => {
    st.last_run_at = runISO; st.last_status = status;
    if (status === 'ok' || status === 'cycle_done') { st.last_ok_at = runISO; st.consecutive_failures = 0; } else st.consecutive_failures = (st.consecutive_failures || 0) + 1;
    st.detail = JSON.stringify(detail || {});
    await saveState(db, st);
    await logRun(db, S.id, status, out.rows || 0, isoAthensDate(t0), JSON.stringify({ cycle: st.cycle, position: st.position, of: st.targets.length, ...out, ...detail }), runISO);
    return { status, ...out, position: st.position, of: st.targets.length, cycle: st.cycle };
  };

  // 1. robots.txt (every slice)
  let robotsText = '';
  try {
    const r = await get(S.robots);
    if (r.status >= 500) { await r.body?.cancel(); return finish('robots_unavailable', { pages: 0, rows: 0 }, { http: r.status }); }
    robotsText = r.ok ? await r.text() : (await r.body?.cancel(), '');           // 4xx: no robots file = no restriction (RFC 9309)
  } catch (e) { return finish('robots_unavailable', { pages: 0, rows: 0 }, { error: String(e?.message || e) }); }
  const robots = parseRobots(robotsText);
  st.robots_sha1 = await sha1(robotsText);

  // 2. new cycle when the list is empty or finished
  let requests = 1;
  if (!st.targets.length || st.position >= st.targets.length) {
    if (st.targets.length && st.position >= st.targets.length) st.last_cycle_done_at = runISO;
    let list = [];
    try {
      const fetchRes = async u => { requests++; if (!allowed(robots, pathOf(u))) return new Response('', { status: 403 }); return get(u); };
      const fetchText = async u => { const r = await fetchRes(u); if (!r.ok) throw new Error('http_' + r.status + ' ' + u); return r.text(); };
      list = await adapter.targets(fetchText, robots, fetchRes);
    } catch (e) { return finish('targets_failed', { pages: 0, rows: 0 }, { error: String(e?.message || e).slice(0, 300) }); }
    list = [...new Set(list)].filter(u => allowed(robots, pathOf(u)));
    if (!list.length) return finish('no_targets', { pages: 0, rows: 0 }, {});
    st.targets = list; st.position = 0; st.cycle = (st.cycle || 0) + 1; st.cycle_started_at = runISO; st.pages_ok = 0; st.pages_failed = 0;
  }

  // 3. the slice
  let pages = 0, failed = 0, rows = 0, changes = 0, status = 'ok', blockedInfo = null; const skipped = {}, buf = [], names = [];
  const flush = async () => {
    if (buf.length) { const w = await writeRowsTracked(db, buf.splice(0), runISO); rows += w.rows; changes += w.changes; }
    if (names.length) {
      const part = names.splice(0);
      for (let i = 0; i < part.length; i += 50) await db.batch(part.slice(i, i + 50).map(n => db.prepare(`INSERT INTO foodscan_barcode_names (barcode,source_id,name,brand,price_cents,regular_cents,url,updated_at) VALUES (?,?,?,?,?,?,?,?)
        ON CONFLICT(barcode,source_id) DO UPDATE SET name=excluded.name,brand=excluded.brand,price_cents=excluded.price_cents,regular_cents=excluded.regular_cents,url=excluded.url,updated_at=excluded.updated_at`)
        .bind(n.ean, S.id, n.name, n.brand, Math.round(n.price * 100), n.regular ? Math.round(n.regular * 100) : null, n.url, runISO)));
    }
  };
  while (st.position < st.targets.length && pages + failed < maxPages && now() - t0 < budgetMs) {
    const url = st.targets[st.position];
    if (!allowed(robots, pathOf(url))) { skipped.robots = (skipped.robots || 0) + 1; st.position++; continue; }
    if (requests > 0) await sleep(delayMs);
    requests++;
    let res;
    try { res = await get(url); } catch (e) { failed++; st.pages_failed++; st.position++; skipped.network = (skipped.network || 0) + 1; continue; }
    const host = new URL(res.url || url).host;
    if ([401, 403, 429, 503].includes(res.status) || host !== new URL(url).host) { await res.body?.cancel(); status = 'blocked'; blockedInfo = { http: res.status, url, final_host: host }; break; }
    if (!res.ok) { await res.body?.cancel(); failed++; st.pages_failed++; st.position++; skipped['http_' + res.status] = (skipped['http_' + res.status] || 0) + 1; continue; }
    const html = await res.text();
    if (CHALLENGE.test(html.slice(0, 20000)) && !/knns-model-value|application\/ld\+json/.test(html)) { status = 'blocked'; blockedInfo = { challenge: true, url }; break; }
    const fetchedISO = new Date(now()).toISOString();
    let p;
    try { p = adapter.parse(url, html, fetchedISO); } catch (e) { p = { items: [], skipped: { parse_error: 1 }, more: [] }; }
    for (const [k, v] of Object.entries(p.skipped || {})) skipped[k] = (skipped[k] || 0) + v;
    const observed = isoAthensDate(Date.parse(fetchedISO));
    for (const it of p.items) { buf.push(itemRow(it, S, fetchedISO, observed)); names.push(it); }
    if (p.more?.length) { const have = new Set(st.targets); const add = p.more.filter(u => !have.has(u) && allowed(robots, pathOf(u))); st.targets.splice(st.position + 1, 0, ...add); }
    st.position++; pages++; st.pages_ok++;
    if (buf.length >= 400) await flush();
  }
  await flush();   // rows already read are kept even when the slice ended blocked
  const done = st.position >= st.targets.length;
  if (done && status === 'ok') st.last_cycle_done_at = runISO;
  return finish(status === 'ok' && done ? 'cycle_done' : status, { pages, failed, rows, changes }, { skipped, ...(blockedInfo ? { blocked: blockedInfo } : {}) });
}
