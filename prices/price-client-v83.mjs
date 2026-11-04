/* FoodScan price client 83 (from 78/80): the shopper's market (country) travels with every request and with every cached answer.
 * (80, from 78): one request per barcode, shared by every view, cached on the device for 10 minutes.
 * Order: FoodScan's price service (edge-cached 10 min) -> Open Prices directly -> "temporarily unavailable".
 * {fresh:true} (a rescan or "Try again") skips the device copy AND the edge copy (?fresh=1).
 * Partial answers (a source down) are never kept, so the next look asks again.
 * Never blocks the Nutri-Score: callers render the grade first and fill prices in when this resolves. */
import { checkPayload, fromOpenPrices, validBarcode } from './price-core-v83.mjs';
import { detectMarket, marketCurrency } from './market-v83.mjs';
export const TTL = 10 * 60 * 1000; const KEY = 'foodscan:prices:v83:';
const memory = new Map(), inflight = new Map();
const PATHS = ['/prices/service/compare', '/api/prices/compare'];
const store = (() => { try { return globalThis.sessionStorage; } catch { return null; } })();
/* 82: "This is my product". A barcode with no recorded price may be confirmed, on THIS device, as one of the observatory products the
 * service suggests (same brand, unlinked). The choice is sent with every price request for that barcode (?pk=) and can be undone. */
const CONFIRM_KEY = 'foodscan:confirmed:v82';
const device = (() => { try { return globalThis.localStorage; } catch { return null; } })();
const readConfirmed = () => { try { const m = JSON.parse(device?.getItem(CONFIRM_KEY) || '{}'); return m && typeof m === 'object' ? m : {}; } catch { return {}; } };
export function confirmedFor(code) { const v = readConfirmed()[String(code || '')]; return v && /^[0-9a-f]{32}$/.test(String(v.id || '')) ? {id:String(v.id), name:String(v.name || '').slice(0, 120)} : null; }
export function setConfirmed(code, choice) {
  code = String(code || ''); if (!validBarcode(code)) return;
  const m = readConfirmed();
  if (choice && /^[0-9a-f]{32}$/.test(String(choice.id || ''))) m[code] = {id:String(choice.id), name:String(choice.name || '').slice(0, 120), at:new Date().toISOString().slice(0, 10)};
  else delete m[code];
  try { device?.setItem(CONFIRM_KEY, JSON.stringify(m)); } catch {}
  forgetPrices(code);
}

function remember(code, result) {
  if (result.status === 'temporarily_unavailable' || result.status === 'incomplete' || result.raw?.kind === 'open') return;
  const entry = {at:Date.now(), raw:result.raw};
  memory.set(code, entry);
  try { store?.setItem(KEY + code, JSON.stringify(entry)); } catch {}
}
function recall(code) {
  let e = memory.get(code);
  if (!e) { try { e = JSON.parse(store?.getItem(KEY + code) || 'null'); } catch { e = null; } }
  if (!e || Date.now() - e.at > TTL) return null;
  const r = e.raw?.kind === 'open' ? fromOpenPrices(e.raw.items, code.split(/[~@#]/)[0], Date.now(), e.raw.quantity, e.raw.market || '', marketCurrency(e.raw.market || '')) : checkPayload(e.raw);
  return r ? {...r, raw:e.raw, cached:true} : null;
}
const timeout = (ms, outer) => { const c = new AbortController(); const id = setTimeout(() => c.abort(), ms); outer?.addEventListener?.('abort', () => c.abort()); return {signal:c.signal, done:() => clearTimeout(id)}; };

async function viaService(code, signal, near, fresh, market) {
  const pk = market && market !== 'GR' ? null : confirmedFor(code);
  const q = (market ? `&market=${market}` : '') + (near ? `&lat=${near.lat}&lon=${near.lon}&radius_km=25` : '') + (fresh ? '&fresh=1' : '') + (pk ? `&pk=${pk.id}` : '');
  for (const path of PATHS) {
    const t = timeout(7000, signal);
    try {
      const res = await fetch(`${path}?barcode=${encodeURIComponent(code)}${q}`, {headers:{Accept:'application/json'}, credentials:'same-origin', signal:t.signal});
      if (res.status === 404) continue;
      if (!res.ok) return null;
      const raw = await res.json();
      const r = checkPayload(raw);
      if (r) return {...r, raw};
    } catch { if (signal?.aborted) throw new DOMException('aborted', 'AbortError'); }
    finally { t.done(); }
  }
  return null;
}
async function viaOpenPrices(code, signal, quantity, market) {
  const t = timeout(7000, signal);
  try {
    // the shopper's country first (a popular product has thousands of observations from everywhere), the plain newest 100 if that is not understood
    const base = `https://prices.openfoodfacts.org/api/v1/prices?product_code=${encodeURIComponent(code)}&size=100&order_by=-date`;
    let res = market ? await fetch(`${base}&location__osm_address_country_code=${market}`, {headers:{Accept:'application/json'}, signal:t.signal}).catch(() => null) : null;
    if (!res || !res.ok) res = await fetch(base, {headers:{Accept:'application/json'}, signal:t.signal});
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data?.items)) return null;
    const raw = {kind:'open', items:data.items, quantity};
    return {...fromOpenPrices(data.items, code, Date.now(), quantity, market, marketCurrency(market)), raw:{...raw, market}};
  } catch { return null; } finally { t.done(); }
}
/** @returns {Promise<object>} a checked result; status is observations_available, no_data, incomplete or temporarily_unavailable. */
export function getPrices(code, {signal, quantity = '', fresh = false, near = null, market = detectMarket().code} = {}) {
  code = String(code || '').trim();
  if (!validBarcode(code)) return Promise.resolve({barcode:code, status:'invalid', offers:[], elsewhere:[], best:null, latest:null});
  const pk = market && market !== 'GR' ? null : confirmedFor(code);
  const id = code + (market ? `~${market}` : '') + (near ? `@${near.lat},${near.lon}` : '') + (pk ? `#${pk.id}` : '');
  if (!fresh) { const hit = recall(id); if (hit) return Promise.resolve(hit); }
  if (!fresh && inflight.has(id)) return inflight.get(id);
  const job = (async () => {
    let r = await viaService(code, signal, near, fresh, market);
    // Nearby answers need the server's distance filter: no direct fallback for them.
    if (!near && (!r || r.status === 'temporarily_unavailable')) r = (await viaOpenPrices(code, signal, quantity, market)) || r;
    if (!r) r = {barcode:code, status:'temporarily_unavailable', offers:[], elsewhere:[], best:null, latest:null, raw:null};
    if (r.raw) remember(id, r);
    return r;
  })().finally(() => inflight.delete(id));
  inflight.set(id, job);
  return job;
}
export const peekPrices = (code, market = detectMarket().code) => { code = String(code || ''); const pk = market && market !== 'GR' ? null : confirmedFor(code); return recall(code + (market ? `~${market}` : '') + (pk ? `#${pk.id}` : '')); };
/** Forget the device copy of one barcode (used before a forced refresh). */
export const forgetPrices = code => { code = String(code || ''); for (const k of [...memory.keys()]) if (k === code || /^[0-9]+/.test(k) && k.replace(/[~@#].*$/, '') === code) memory.delete(k);
  try { for (let i = (store?.length || 0) - 1; i >= 0; i--) { const k = store.key(i); if (k && k.startsWith(KEY) && k.slice(KEY.length).replace(/[~@#].*$/, '') === code) store.removeItem(k); } } catch {} };
