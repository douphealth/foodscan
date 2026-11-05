/* FoodScan 88: "Healthier swaps" on the product page.
 * Finds products of the same kind with a BETTER grade in the whole bundled Greek catalogue (prices/swaps-v88.mjs) and shows them with photo, grade and why they count as
 * the same shelf. Shown above the app's own comparison card; that card is folded away when it found nothing (it keeps its buttons when it did find something).
 * Never a drink for a food. A swap's grade is either published by Open Food Facts or calculated by FoodScan from the swap's own complete numbers, and says which. */
import { esc, pageLang } from './price-core-v83.mjs';
import { SWAP_RELIABILITY } from './swaps-v88.mjs';

const INDEX_URL = '/assets/swaps-off-csv-2026-10-30.json';
const T = {
  en: {
    eyebrow: 'Healthier swaps', title: 'Better Nutri-Score, same shelf',
    better: g => `Products like this one with a better Nutri-Score than its ${g}.`, betterEst: g => `Products like this one, each graded better than the best letter its estimate allows (${g}).`,
    best: 'This product has no grade on record, so nothing can be compared with it. These are the best-graded products on the same shelf.',
    inferred: 'This record has no category: the shelf was taken from products with similar names. Check that a swap is the same kind of product.',
    already: 'Nothing on this shelf has a better grade: this product is already graded A.', none: g => `No product with a better grade than ${g} was found on this shelf in the Greek catalogue.`,
    published: 'published grade', calculated: 'calculated by FoodScan', gain: n => (n === 1 ? '1 grade better' : `${n} grades better`), sameShelf: 'same shelf', sameAisle: 'same aisle', named: 'similar name',
    howTitle: 'How swaps are chosen', how: n => `From ${n.toLocaleString('en')} products of the Greek Open Food Facts catalogue that have a published Nutri-Score, or one FoodScan calculated from their own complete numbers. A swap must use the same Nutri-Score table (a drink is never offered for a food), share the product's category tags or, without them, its name and product family, and have a strictly better grade.`,
    rel: (a, s, ai, si, n) => `Measured on ${n.toLocaleString('en')} graded Greek products: the swaps shown were in the same aisle in about ${a} % of cases (on the same narrow shelf in ${s} %). When the product had no category and the shelf had to be inferred: ${ai} % (${si} %).`,
    check: 'Grades compare nutrition per 100 g or 100 ml. Check the pack, ingredients and allergens before switching.', source: 'Open Food Facts (ODbL), Greek catalogue, 30 Oct 2026',
  },
  el: {
    eyebrow: 'Πιο υγιεινές επιλογές', title: 'Καλύτερο Nutri-Score, ίδιο ράφι',
    better: g => `Προϊόντα σαν αυτό με καλύτερο Nutri-Score από το ${g} του.`, betterEst: g => `Προϊόντα σαν αυτό, το καθένα με καλύτερο βαθμό από το καλύτερο γράμμα που επιτρέπει η εκτίμησή του (${g}).`,
    best: 'Αυτό το προϊόν δεν έχει καταγεγραμμένο βαθμό, οπότε δεν μπορεί να συγκριθεί. Αυτά είναι τα προϊόντα με τον καλύτερο βαθμό στο ίδιο ράφι.',
    inferred: 'Η εγγραφή δεν έχει κατηγορία: το ράφι προέκυψε από προϊόντα με παρόμοιο όνομα. Ελέγξτε ότι η επιλογή είναι το ίδιο είδος προϊόντος.',
    already: 'Τίποτα σε αυτό το ράφι δεν έχει καλύτερο βαθμό: το προϊόν έχει ήδη A.', none: g => `Δεν βρέθηκε προϊόν με καλύτερο βαθμό από ${g} σε αυτό το ράφι του ελληνικού καταλόγου.`,
    published: 'δημοσιευμένος βαθμός', calculated: 'υπολογισμός FoodScan', gain: n => (n === 1 ? '1 βαθμίδα καλύτερο' : `${n} βαθμίδες καλύτερο`), sameShelf: 'ίδιο ράφι', sameAisle: 'ίδιος διάδρομος', named: 'παρόμοιο όνομα',
    howTitle: 'Πώς επιλέγονται', how: n => `Από ${n.toLocaleString('el')} προϊόντα του ελληνικού καταλόγου του Open Food Facts με δημοσιευμένο Nutri-Score ή με βαθμό που υπολόγισε το FoodScan από τους δικούς τους πλήρεις αριθμούς. Μια επιλογή πρέπει να έχει τον ίδιο πίνακα Nutri-Score (ποτέ ρόφημα αντί για τρόφιμο), να μοιράζεται τις κατηγορίες του προϊόντος ή, χωρίς αυτές, το όνομα και την οικογένειά του, και να έχει αυστηρά καλύτερο βαθμό.`,
    rel: (a, s, ai, si, n) => `Μετρήθηκε σε ${n.toLocaleString('el')} ελληνικά προϊόντα με βαθμό: οι επιλογές που εμφανίστηκαν ήταν στον ίδιο διάδρομο σε περίπου ${a} % των περιπτώσεων (στο ίδιο στενό ράφι σε ${s} %). Όταν το προϊόν δεν είχε κατηγορία και το ράφι συμπεράνθηκε: ${ai} % (${si} %).`,
    check: 'Οι βαθμοί συγκρίνουν τη διατροφή ανά 100 g ή 100 ml. Ελέγξτε τη συσκευασία, τα συστατικά και τα αλλεργιογόνα πριν αλλάξετε.', source: 'Open Food Facts (ODbL), ελληνικός κατάλογος, 30 Οκτ 2026',
  },
};
const lang = () => (pageLang() === 'el' ? 'el' : 'en');
const tx = (k, ...a) => { const v = T[lang()][k]; return typeof v === 'function' ? v(...a) : v; };
const route = () => (location.hash.startsWith('#/') ? location.hash.slice(1) : location.pathname);
const productCode = () => route().match(/^\/p\/(\d{8}|\d{12,14})(?:[/?]|$)/)?.[1] || null;

let mods = null, prepP = null;
const load = () => mods || (mods = Promise.all([import('../assets/domain-v8500.mjs'), import('./quick-grade-v85.mjs'), import('./swaps-v88.mjs')]).then(([D, Q, W]) => ({ D, Q, W })));
const index = W => prepP || (prepP = fetch(INDEX_URL).then(r => (r.ok ? r.json() : null)).then(j => (j ? W.prepare(j) : null)).catch(() => null));
const results = new Map(); // code -> { state, res, target }

async function compute(code) {
  results.set(code, { state: 'loading' });
  try {
    const { D, Q, W } = await load(), prep = await index(W);
    const res0 = await fetch(`/api/product/${encodeURIComponent(code)}`, { headers: { accept: 'application/json' } });
    if (!prep || !res0.ok) throw new Error('unavailable');
    const body = await res0.json(), raw = body?.product || {}, p = D.parseProduct(body, code), a = D.assessGrade(p);
    const kinds = D.ns23Kinds(p), grade = a.grade && /^[A-E]$/.test(a.grade) ? a.grade : null;
    // no grade: use the grade card's own result (prices/reader-v85.js), so the table and the estimate are the same ones the shopper sees
    let est = null;
    if (!grade) {
      for (let i = 0; i < 60; i++) { const qk = globalThis.__fs85quick?.get(code); if (qk && qk.state !== 'loading') { est = qk; break; } await new Promise(r => setTimeout(r, 150)); }
      if (est?.kind === 'exempt' || kinds.exempt) { results.set(code, { state: 'ready', res: { ok: false, reason: 'exempt' } }); return schedule(); }
    }
    const e = est?.kind === 'quick' ? { letters: est.q.letters, kind: est.q.kind || est.q.kinds?.[0] } : est?.kind === 'similar' ? { letters: est.sim.letters, kind: est.sim.kind } : null;
    const kind = kinds.kinds?.length ? kinds.kinds[0] : e?.kind || Q.inferKinds(p).kinds[0];
    const estimate = e ? e.letters[0] : null; // against an estimate, the bar is its BEST letter: every swap beats every letter the estimate allows
    const target = { code, name: p.name, brand: (raw.brands || '').split(',')[0], categories: raw.categories_tags || [], pnns: raw.pnns_groups_2 || '', family: body?.catalogueSnapshot?.family || '', kind, grade, estimate };
    results.set(code, { state: 'ready', res: W.findSwaps(target, prep), target, n: prep.rows.length, W });
  } catch { results.set(code, { state: 'ready', res: { ok: false, reason: 'unavailable' } }); }
  schedule();
}

const ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>';
const LEAF = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19c3-4 6-6 10-8"/></svg>';
function html(entry) {
  const { res, target, n, W } = entry, R = SWAP_RELIABILITY;
  const lead = res.mode === 'best' ? tx('best') : target?.grade ? tx('better', target.grade) : tx('betterEst', res.against);
  const empty = !res.ok ? `<p class="fs88__empty">${esc(res.reason === 'already-best' ? tx('already') : tx('none', res.against || ''))}</p>` : '';
  const items = res.ok ? res.swaps.map(({ row, tier }) => {
    const img = W.imageOf(row), gain = res.against ? W.RANK[res.against] - W.RANK[row.grade] : 0;
    return `<li><a class="fs88__item" href="#/p/${esc(row.code)}">
      <span class="fs88__ph">${img ? `<img src="${esc(img)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : ''}<i aria-hidden="true">${LEAF}</i></span>
      <span class="fs88__txt"><b>${esc(row.name)}</b><small>${esc([row.brand, row.how === 'p' ? tx('published') : tx('calculated')].filter(Boolean).join(' · '))}</small>${gain > 0 || tier !== 'inferred' ? `<em>${esc([gain > 0 ? tx('gain', gain) : '', tier === 'shelf' ? tx('sameShelf') : tier === 'aisle' ? tx('sameAisle') : ''].filter(Boolean).join(' · '))}</em>` : ''}</span>
      <span class="fs88__grade g-${esc(row.grade)}" aria-label="Nutri-Score ${esc(row.grade)}">${esc(row.grade)}</span></a></li>`;
  }).join('') : '';
  return `<header class="fs88__head"><span class="fs88__eyebrow">${LEAF}${esc(tx('eyebrow'))}</span><h2>${esc(tx('title'))}</h2><p>${esc(lead)}</p>${res.inferredShelf ? `<p class="fs88__warn">${esc(tx('inferred'))}</p>` : ''}</header>
    ${items ? `<ol class="fs88__list">${items}</ol>` : empty}
    <details class="fs88__how"><summary>${esc(tx('howTitle'))}</summary><p>${esc(tx('how', n || 0))}</p><p>${esc(tx('rel', R.aisle, R.shelf, R.aisleInferred, R.shelfInferred, R.sample))}</p><p>${esc(tx('check'))}</p><p class="fs88__src">${esc(tx('source'))}</p></details>`;
}

function ensure() {
  const code = productCode(), view = document.querySelector('#view');
  document.querySelectorAll('.fs88').forEach(n => { if (n.dataset.code !== code) n.remove(); });
  if (!code || !view) return;
  const anchor = view.querySelector('.card--swap'); if (!anchor) return; // the product page has rendered its comparison area
  if (!results.has(code)) { compute(code); return; }
  const entry = results.get(code); if (entry.state !== 'ready' || !entry.res || entry.res.reason === 'exempt' || entry.res.reason === 'unavailable' || entry.res.reason === 'nothing-to-match') return;
  let sec = view.querySelector(`.fs88[data-code="${code}"]`);
  const key = [lang(), entry.res.ok ? entry.res.swaps.length : entry.res.reason].join(':');
  if (!sec) { sec = document.createElement('section'); sec.className = 'card fs88'; sec.dataset.code = code; }
  if (anchor.previousElementSibling !== sec) anchor.before(sec);
  if (sec.dataset.key !== key) {
    sec.dataset.key = key; sec.innerHTML = html(entry); sec.setAttribute('aria-label', tx('eyebrow'));
    // a photo that does not load leaves the leaf icon (inline onerror handlers are blocked by the page's security policy)
    sec.querySelectorAll('.fs88__ph img').forEach(img => { const drop = () => img.remove(); if (img.complete && !img.naturalWidth) drop(); else img.addEventListener('error', drop, { once: true }); });
  }
  // the app's own card: folded away when it found nothing and we found something; kept when it lists products of its own
  const appFound = anchor.querySelector('a[href^="#/p/"]');
  anchor.toggleAttribute('data-fs88-hidden', Boolean(entry.res.ok && !appFound));
}
let timer = 0;
function schedule() { if (!timer) timer = setTimeout(() => { timer = 0; ensure(); }, 80); }
function start() {
  const host = document.getElementById('app');
  if (host) new MutationObserver(schedule).observe(host, { childList: true, subtree: true });
  addEventListener('hashchange', schedule); addEventListener('popstate', schedule); schedule();
}
if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start(); }
