/* FoodScan 89: fills what lists and pictures leave empty, from data computed ahead of time and checked by tests.
 *   Grades in lists: a search, category or swap row whose product has no published grade showed "–", even when its product page shows an estimate. The row now
 *   shows the letter the product page shows (assets/estimates-<rev>.json, built with the page's own steps by tools/build-estimates.mjs), as the app's estimate chip
 *   (dashed ring) with an aria-label and tooltip that say it is FoodScan's estimate, not a published grade.
 *   Photos: a product whose record has no front image showed an illustration. Where Open Food Facts holds another real photo of it (a front image of another
 *   language, or an uploaded photo nobody selected), that photo is shown (assets/photos-<rev>.json, tools/build-photos.mjs). No photo is invented.
 * 106, photos:
 *   - The photo index only knows the catalogue as it was read. On a product page that still shows the drawing, the browser now asks Open Food Facts once
 *     for that product's photo list (one small request, remembered for the visit) and shows the best real photo it holds.
 *   - When Open Food Facts confirms it holds no photo at all, the page says so and links to the product's edit page there: adding one is the only real fix,
 *     and it then shows in every app that uses the database. A failed or offline lookup shows nothing (unknown is not "no photo").
 *   - Tapping the product photo opens it large (the 400 px file; the full-size file on sharp screens for a photo chosen as the front), with its credit. */
import { pageLang } from './price-core-v83.mjs';
import { photoSet, bestPhotoFile } from '../assets/domain-v106.mjs';

const REV = 'off-csv-2026-10-30', EST_URL = `/assets/estimates-${REV}.json?v=106`, /* 103: rebuilt under the same name; /assets/ is cached for a year, so the address changes */ PHOTO_URL = `/assets/photos-${REV}.json?v=106`; // 106: four photos added; same name, so the address changes
const TXT = {
  en: { est: (g, band) => `Estimated Nutri-Score ${g}${band ? ` (${band})` : ''}: FoodScan's estimate, not a published grade`, nr: 'Not rated: the Nutri-Score method does not cover this product', photo: 'Photo from Open Food Facts', zoom: 'Enlarge the photo', close: 'Close', credit: 'Photo: Open Food Facts contributors (CC BY-SA)', none: 'Open Food Facts has no photo of this product yet.', add: 'Add one there' },
  el: { est: (g, band) => `Εκτιμώμενο Nutri-Score ${g}${band ? ` (${band})` : ''}: εκτίμηση του FoodScan, όχι δημοσιευμένος βαθμός`, nr: 'Χωρίς βαθμό: η μέθοδος Nutri-Score δεν καλύπτει αυτό το προϊόν', photo: 'Φωτογραφία από το Open Food Facts', zoom: 'Μεγέθυνση φωτογραφίας', close: 'Κλείσιμο', credit: 'Φωτογραφία: συνεισφέροντες του Open Food Facts (CC BY-SA)', none: 'Το Open Food Facts δεν έχει ακόμη φωτογραφία αυτού του προϊόντος.', add: 'Πρόσθεσε μία εκεί' },
};
// 101 (fix 14): French, German, Spanish, Italian: machine-translated plain strings (needs native review); sentences built by functions stay English.
for (const [l, d] of Object.entries({"fr":{"nr":"Non noté: la méthode Nutri-Score ne couvre pas ce produit","photo":"Photo de Open Food Facts"},"de":{"nr":"Nicht bewertet: Die Nutri-Score-Methode deckt dieses Produkt nicht ab","photo":"Foto von Open Food Facts"},"es":{"nr":"No calificado: el método Nutri-Score no cubre este producto","photo":"Foto de Open Food Facts"},"it":{"nr":"Non valutato: il metodo Nutri-Score non copre questo prodotto","photo":"Foto di Open Food Facts"}})) TXT[l] = Object.setPrototypeOf(d, TXT.en);
for (const [l, d] of Object.entries({"fr":{"zoom":"Agrandir la photo","close":"Fermer","credit":"Photo : contributeurs d’Open Food Facts (CC BY-SA)","none":"Open Food Facts n’a pas encore de photo de ce produit.","add":"En ajouter une là-bas"},"de":{"zoom":"Foto vergrößern","close":"Schließen","credit":"Foto: Mitwirkende von Open Food Facts (CC BY-SA)","none":"Open Food Facts hat noch kein Foto dieses Produkts.","add":"Dort eines hinzufügen"},"es":{"zoom":"Ampliar la foto","close":"Cerrar","credit":"Foto: colaboradores de Open Food Facts (CC BY-SA)","none":"Open Food Facts aún no tiene foto de este producto.","add":"Añadir una allí"},"it":{"zoom":"Ingrandisci la foto","close":"Chiudi","credit":"Foto: contributori di Open Food Facts (CC BY-SA)","none":"Open Food Facts non ha ancora una foto di questo prodotto.","add":"Aggiungine una lì"}})) Object.assign(TXT[l], d); // 106: same caveat (needs native review)
const t = () => TXT[TXT[pageLang()] ? pageLang() : 'en'];
const route = () => (location.hash.startsWith('#/') ? location.hash.slice(1) : location.pathname);
const routeCode = () => route().match(/^\/p\/(\d{8}|\d{12,14})(?:[/?]|$)/)?.[1] || null;

let data = null, loading = null;
const load = () => loading || (loading = Promise.all([EST_URL, PHOTO_URL].map(u => fetch(u).then(r => (r.ok ? r.json() : null)).catch(() => null))).then(([e, p]) => { data = { est: e?.e || {}, photos: p?.photos || {} }; schedule(); }));
/** Open Food Facts image URL from a barcode and the file part ("front_fr.3.400", "1.400"); short codes are padded to 13 digits, as Open Food Facts stores them. */
export function photoURL(code, file) {
  const c = String(code), d = c.length <= 13 ? c.padStart(13, '0') : c, p = d.length > 8 ? `${d.slice(0, 3)}/${d.slice(3, 6)}/${d.slice(6, 9)}/${d.slice(9)}` : d;
  return `https://images.openfoodfacts.org/images/products/${p}/${file}.jpg`;
}
/** "BC|C|i" -> { letter, band, tier } (the letter a row shows: the most likely one, else the first of the band) */
export function chipOf(v) {
  if (!v) return null; const [letters, likely, tier] = String(v).split('|');
  if (tier === 'x') return { tier, letter: '', band: '' };
  const letter = (/^[A-E]$/.test(likely || '') ? likely : (letters || '')[0]); if (!/^[A-E]$/.test(letter || '')) return null;
  return { tier, letter, band: letters && letters.length > 1 ? `${letters[0]}–${letters.at(-1)}` : '' };
}
const codeOf = a => (a.getAttribute('href') || '').match(/#\/p\/(\d{8,14})/)?.[1] || null;

function fillChip(chip, code) {
  if (chip.dataset.fs89 === code) return;
  const c = chipOf(data.est[code]); if (!c) return;
  chip.dataset.fs89 = code;
  if (c.tier === 'x') { chip.title = t().nr; chip.setAttribute('aria-label', t().nr); return; }
  chip.classList.remove('gchip--none'); chip.classList.add('gchip--est', `g-${c.letter}`, 'fs89-est');
  chip.textContent = c.letter; chip.title = t().est(c.letter, c.band); chip.setAttribute('role', 'img'); chip.setAttribute('aria-label', t().est(c.letter, c.band)); chip.removeAttribute('aria-hidden');
}
function fillPhoto(box, code, file = data.photos[code]) {
  if (box.dataset.fs89 === code) return;
  if (!file) return;
  const art = box.querySelector('svg.art'); if (!art && box.querySelector('img')) return;
  box.dataset.fs89 = code;
  const ps = photoSet(photoURL(code, file)), hero = Boolean(box.closest('.hero__img'));
  const img = new Image(); img.alt = ''; img.decoding = 'async'; img.referrerPolicy = 'no-referrer'; img.title = t().photo;
  if (!hero) img.loading = 'lazy';
  if (ps.srcset) { img.sizes = hero ? '88px' : '56px'; img.srcset = ps.srcset; } // 106: the 400 px file only where the box needs it
  img.src = ps.src || photoURL(code, file);
  img.addEventListener('error', () => { img.remove(); if (art) box.append(art); }, { once: true }); // keep the illustration when the photo does not load
  if (art) art.remove(); box.append(img);
}
/* 106: a photo box is white, so a slow photo looked like a missing one. The box now shows a faint package mark until its photo has arrived. */
const arrived = img => { if (img.naturalWidth) img.dataset.fs106ok = '1'; };
function ensure() {
  for (const img of document.querySelectorAll('.pimg img:not([data-fs106ok])')) if (img.complete) arrived(img);
  if (!data) { if (document.querySelector('a[href*="#/p/"], .hero__img')) load(); return; }
  for (const a of document.querySelectorAll('a[href*="#/p/"]')) {
    const code = codeOf(a); if (!code) continue;
    const chip = a.querySelector('.gchip--none'); if (chip) fillChip(chip, code);
    const box = a.querySelector('.pimg:has(svg.art)') || a.querySelector('.fs88__ph:not(:has(img))'); if (box) fillPhoto(box, code);
  }
  const code = routeCode();
  if (code) {
    const hero = document.querySelector('#view .hero__img .pimg:has(svg.art)');
    if (hero) { if (data.photos[code]) fillPhoto(hero, code); else heroFallback(hero, code); }
    const shown = document.querySelector('#view .hero__img .pimg:has(img)');
    if (shown) { document.querySelector('#view .fs106-add')?.remove(); if (!shown.dataset.fs106zoom) { shown.dataset.fs106zoom = '1'; shown.tabIndex = 0; shown.setAttribute('role', 'button'); shown.setAttribute('aria-label', t().zoom); } }
  }
}
/* ---- 106: one live look at Open Food Facts for a product page that still shows the drawing ---- */
const live = new Map(); // barcode -> Promise of the file part ("front_fr.3", "2"), "" (confirmed: no photo on record) or null (could not ask)
export function livePhoto(code, fetcher = (...a) => fetch(...a)) {
  if (live.has(code)) return live.get(code);
  let memo = null; try { memo = sessionStorage.getItem('fs106:photo:' + code); } catch { /* storage may be blocked */ }
  const job = memo !== null ? Promise.resolve(memo) : (async () => {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 6000);
    try {
      const res = await fetcher(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=lang,images`, { signal: ctl.signal });
      if (!res.ok) return null;
      const j = await res.json(); if (!j || !j.product || typeof j.product !== 'object') return null; // "not found" is not "no photo"
      const file = bestPhotoFile(j.product.images, String(j.product.lang || ''));
      try { sessionStorage.setItem('fs106:photo:' + code, file); } catch { /* fine */ }
      return file;
    } catch { return null; } finally { clearTimeout(timer); }
  })();
  live.set(code, job); job.then(v => { if (v === null) live.delete(code); });
  return job;
}
export const editURL = code => `https://world.openfoodfacts.org/cgi/product.pl?type=edit&code=${encodeURIComponent(code)}`;
function heroFallback(hero, code) {
  if (hero.dataset.fs106 === code) return; hero.dataset.fs106 = code;
  livePhoto(code).then(file => {
    if (routeCode() !== code || file === null) return;
    const box = document.querySelector('#view .hero__img .pimg:has(svg.art)'); if (!box) return;
    if (file) { fillPhoto(box, code, /^\d+$/.test(file) ? file + '.400' : file + '.200'); schedule(); return; }
    const name = document.querySelector('#view .hero__name'); if (!name || name.querySelector('.fs106-add')) return;
    const p = document.createElement('p'); p.className = 'fs106-add'; p.append(t().none + ' ');
    const a = document.createElement('a'); a.href = editURL(code); a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = t().add + ' ↗'; p.append(a); name.append(p);
  });
}
/* ---- 106: the product photo, large ---- */
function openZoom(img) {
  const ps = photoSet(img.currentSrc || img.src), large = ps.large || img.currentSrc || img.src; if (!large) return;
  document.querySelector('dialog.fs106-zoom')?.remove();
  const d = document.createElement('dialog'); d.className = 'fs106-zoom'; d.setAttribute('aria-label', t().zoom);
  const big = new Image(); big.alt = document.querySelector('#product-title')?.textContent || ''; big.referrerPolicy = 'no-referrer'; big.decoding = 'async';
  // a photo chosen as the front is a crop of modest weight, so sharp screens may take its full-size file; an unselected upload can weigh megabytes and stays at 400 px
  if (ps.selected) { big.sizes = '(min-width: 480px) 420px, 92vw'; big.srcset = `${large} 400w, ${large.replace(/\.400\.jpg$/, '.full.jpg')} 1200w`; }
  big.src = large;
  const cap = document.createElement('p'); cap.textContent = t().credit;
  const x = document.createElement('button'); x.type = 'button'; x.className = 'fs106-zoom__x'; x.setAttribute('aria-label', t().close); x.textContent = '×';
  d.append(x, big, cap); document.body.append(d);
  const close = () => { try { d.close(); } catch { /* already closed */ } d.remove(); }; // removed here as well: the close event is not delivered everywhere (seen in an embedded browser)
  x.addEventListener('click', close); d.addEventListener('click', e => { if (e.target === d) close(); }); d.addEventListener('close', () => d.remove());
  if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
}
function zoomFrom(e) {
  const box = e.target instanceof Element ? e.target.closest('#view .hero__img .pimg[data-fs106zoom]') : null; if (!box) return;
  if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
  const img = box.querySelector('img'); if (!img || !img.naturalWidth) return;
  e.preventDefault(); openZoom(img);
}
let timer = 0;
function schedule() { if (!timer) timer = setTimeout(() => { timer = 0; ensure(); }, 120); }
if (typeof document !== 'undefined') {
  const start = () => { new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true }); addEventListener('hashchange', () => { document.querySelector('dialog.fs106-zoom')?.remove(); schedule(); }); document.addEventListener('load', e => { if (e.target instanceof HTMLImageElement && e.target.closest('.pimg')) arrived(e.target); }, true); document.addEventListener('click', zoomFrom); document.addEventListener('keydown', zoomFrom); schedule(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
}
