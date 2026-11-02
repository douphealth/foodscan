/* FoodScan price client 80 (from 78): one request per barcode, shared by every view, cached on the device for 10 minutes.
 * Order: FoodScan's price service (edge-cached 10 min) -> Open Prices directly -> "temporarily unavailable".
 * {fresh:true} (a rescan or "Try again") skips the device copy AND the edge copy (?fresh=1).
 * Partial answers (a source down) are never kept, so the next look asks again.
 * Never blocks the Nutri-Score: callers render the grade first and fill prices in when this resolves. */
import { checkPayload, fromOpenPrices, validBarcode } from './price-core-v80.mjs';
export const TTL = 10 * 60 * 1000; const KEY = 'foodscan:prices:v80:';
const memory = new Map(), inflight = new Map();
const PATHS = ['/prices/service/compare', '/api/prices/compare'];
const store = (() => { try { return globalThis.sessionStorage; } catch { return null; } })();

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
  const r = e.raw?.kind === 'open' ? fromOpenPrices(e.raw.items, code.split('@')[0], Date.now(), e.raw.quantity) : checkPayload(e.raw);
  return r ? {...r, raw:e.raw, cached:true} : null;
}
const timeout = (ms, outer) => { const c = new AbortController(); const id = setTimeout(() => c.abort(), ms); outer?.addEventListener?.('abort', () => c.abort()); return {signal:c.signal, done:() => clearTimeout(id)}; };

async function viaService(code, signal, near, fresh) {
  const q = (near ? `&lat=${near.lat}&lon=${near.lon}&radius_km=25` : '') + (fresh ? '&fresh=1' : '');
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
async function viaOpenPrices(code, signal, quantity) {
  const t = timeout(7000, signal);
  try {
    const res = await fetch(`https://prices.openfoodfacts.org/api/v1/prices?product_code=${encodeURIComponent(code)}&size=100&order_by=-date`, {headers:{Accept:'application/json'}, signal:t.signal});
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data?.items)) return null;
    const raw = {kind:'open', items:data.items, quantity};
    return {...fromOpenPrices(data.items, code, Date.now(), quantity), raw};
  } catch { return null; } finally { t.done(); }
}
/** @returns {Promise<object>} a checked result; status is observations_available, no_data, incomplete or temporarily_unavailable. */
export function getPrices(code, {signal, quantity = '', fresh = false, near = null} = {}) {
  code = String(code || '').trim();
  if (!validBarcode(code)) return Promise.resolve({barcode:code, status:'invalid', offers:[], elsewhere:[], best:null, latest:null});
  const id = near ? `${code}@${near.lat},${near.lon}` : code;
  if (!fresh) { const hit = recall(id); if (hit) return Promise.resolve(hit); }
  if (!fresh && inflight.has(id)) return inflight.get(id);
  const job = (async () => {
    let r = await viaService(code, signal, near, fresh);
    // Nearby answers need the server's distance filter: no direct fallback for them.
    if (!near && (!r || r.status === 'temporarily_unavailable')) r = (await viaOpenPrices(code, signal, quantity)) || r;
    if (!r) r = {barcode:code, status:'temporarily_unavailable', offers:[], elsewhere:[], best:null, latest:null, raw:null};
    if (r.raw) remember(id, r);
    return r;
  })().finally(() => inflight.delete(id));
  inflight.set(id, job);
  return job;
}
export const peekPrices = code => recall(String(code || ''));
/** Forget the device copy of one barcode (used before a forced refresh). */
export const forgetPrices = code => { code = String(code || ''); memory.delete(code); try { store?.removeItem(KEY + code); } catch {} };
