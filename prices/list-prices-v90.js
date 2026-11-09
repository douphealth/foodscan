/* FoodScan 90: prices in lists. Search and category rows and healthier-swap rows show the product's lowest current recorded price (or its last recorded price,
 * marked as older), from GET /api/prices/peek: the daily data, checked by the same rules as the product page (which re-checks live). Only rows on screen are
 * asked, five barcodes per request. A swap also says whether it is cheaper or dearer per kg or litre than the product on the page, when both have a unit price
 * on the same basis; nothing is compared otherwise. No price is ever estimated. */
import { pageLang } from './price-core-v83.mjs';
import { detectMarket } from './market-v83.mjs';

const MAX = 5, PARALLEL = 2, TTL = 10 * 60 * 1000;
const T = {
  en: { older: d => `older · ${d}`, cheaper: v => `${v} cheaper per`, dearer: v => `${v} dearer per`, same: 'same unit price', title: 'Lowest current recorded price (daily data). Open the product for every store, date and source.', healthierCheaper: 'healthier and cheaper' },
  el: { older: d => `παλαιότερη · ${d}`, cheaper: v => `${v} φθηνότερο ανά`, dearer: v => `${v} ακριβότερο ανά`, same: 'ίδια τιμή μονάδας', title: 'Χαμηλότερη τρέχουσα καταγεγραμμένη τιμή (ημερήσια δεδομένα). Ανοίξτε το προϊόν για κάθε κατάστημα, ημερομηνία και πηγή.', healthierCheaper: 'πιο υγιεινό και φθηνότερο' },
};
const L = () => (pageLang() === 'el' ? 'el' : 'en'), t = () => T[L()];
const money = (v, cur = 'EUR') => { try { return new Intl.NumberFormat(L() === 'el' ? 'el-GR' : 'en-GB', { style: 'currency', currency: cur }).format(v); } catch { return `${v.toFixed(2)} ${cur}`; } };
const day = d => { try { return new Intl.DateTimeFormat(L() === 'el' ? 'el-GR' : 'en-GB', { day: 'numeric', month: 'short' }).format(new Date(d + 'T12:00:00')); } catch { return d; } };
const route = () => (location.hash.startsWith('#/') ? location.hash.slice(1) : location.pathname);
const routeCode = () => route().match(/^\/p\/(\d{8}|\d{12,14})(?:[/?]|$)/)?.[1] || null;
const codeOf = a => (a.getAttribute('href') || '').match(/#\/p\/(\d{8,14})/)?.[1] || null;

const known = new Map(); // code -> { at, v } (v: the peek item, or null when there is none)
const queue = new Set(); let running = 0;
const market = () => { try { return detectMarket().code || ''; } catch { return ''; } };
let gather = 0; const inflight = new Set();
function want(code) {
  const k = known.get(code);
  if (k && k.v !== undefined && Date.now() - k.at < TTL) return; // fresh answer on hand
  if (queue.has(code) || inflight.has(code)) return;
  queue.add(code); clearTimeout(gather); gather = setTimeout(pump, 60); // rows that appear together go out together
}
async function pump() {
  while (running < PARALLEL && queue.size) {
    const batch = [...queue].slice(0, MAX); batch.forEach(c => { queue.delete(c); inflight.add(c); }); running++;
    const m = market();
    fetch(`/api/prices/peek?codes=${batch.join(',')}${m ? `&market=${m}` : ''}`, { headers: { accept: 'application/json' } })
      .then(r => (r.ok ? r.json() : null)).then(j => { const by = new Map((j?.items || []).map(i => [i.code, i])); for (const c of batch) known.set(c, { at: Date.now(), v: by.get(c) || null }); })
      .catch(() => { for (const c of batch) known.set(c, { at: Date.now() - TTL + 60000, v: null }); }) // try again in a minute
      .finally(() => { running--; batch.forEach(c => inflight.delete(c)); schedule(); pump(); });
  }
}
/** The row line: the lowest current price, else the last recorded one (marked older), else nothing. */
export function lineOf(v) {
  if (!v) return null;
  const o = v.best || v.latest; if (!o || !(o.price > 0)) return null;
  return { price: o.price, currency: o.currency || v.currency || 'EUR', retailer: o.retailer || '', older: !v.best, date: o.date, unitPrice: o.unitPrice, unitBasis: o.unitBasis };
}
/** Unit-price difference of a swap against the product on the page: only on the same basis (kg or l), both current. */
export function compareUnit(swap, here) {
  if (!swap || !here || swap.older || here.older || !(swap.unitPrice > 0) || !(here.unitPrice > 0) || swap.unitBasis !== here.unitBasis) return null;
  const d = Math.round((swap.unitPrice - here.unitPrice) * 100) / 100;
  return { diff: d, basis: swap.unitBasis, cheaper: d < 0, same: Math.abs(d) < 0.01 };
}
const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) { io.unobserve(e.target); const c = codeOf(e.target); if (c) want(c); } }, { rootMargin: '300px 0px' }) : null;

function paint(a, code) {
  const k = known.get(code); if (!k || k.v === undefined) return;
  const host = a.querySelector('.prow__text') || a.querySelector('.fs88__txt'); if (!host) return;
  const line = lineOf(k.v), key = line ? `${L()}|${line.price}|${line.retailer}|${line.older}` : 'none';
  let el = host.querySelector(':scope > .fs90-price');
  if (!line) { el?.remove(); return; }
  let cmp = null;
  if (a.classList.contains('fs88__item')) { const here = routeCode() && known.get(routeCode()); cmp = here?.v !== undefined ? compareUnit(line, lineOf(here.v)) : null; if (routeCode()) want(routeCode()); }
  const full = key + '|' + (cmp ? cmp.diff : '');
  if (el?.dataset.k === full) return;
  if (!el) { el = document.createElement('span'); el.className = 'fs90-price'; host.append(el); }
  el.dataset.k = full; el.title = t().title; el.classList.toggle('is-older', line.older);
  const unit = line.unitPrice > 0 && line.unitBasis ? ` · ${money(line.unitPrice, line.currency)}/${line.unitBasis}` : '';
  el.innerHTML = '';
  const b = document.createElement('b'); b.textContent = money(line.price, line.currency); el.append(b);
  const s = document.createElement('small'); s.textContent = [line.retailer, line.older ? t().older(day(line.date)) : ''].filter(Boolean).join(' · ') + unit; el.append(s);
  if (cmp && !cmp.same) { const c = document.createElement('i'); c.className = cmp.cheaper ? 'is-cheaper' : 'is-dearer'; c.textContent = `${(cmp.cheaper ? t().cheaper : t().dearer)(money(Math.abs(cmp.diff), line.currency))} ${cmp.basis}`; el.append(c); }
  if (cmp?.cheaper) a.classList.add('fs90-win'); else a.classList.remove('fs90-win');
}
function ensure() {
  for (const a of document.querySelectorAll('a.prow__link[href*="#/p/"], a.fs88__item[href*="#/p/"]')) {
    const code = codeOf(a); if (!code) continue;
    if (!a.dataset.fs90) { a.dataset.fs90 = '1'; if (io) io.observe(a); else want(code); }
    paint(a, code);
  }
}
let timer = 0;
function schedule() { if (!timer) timer = setTimeout(() => { timer = 0; ensure(); }, 120); }
if (typeof document !== 'undefined') {
  const start = () => { new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true }); addEventListener('hashchange', schedule); schedule(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
}
