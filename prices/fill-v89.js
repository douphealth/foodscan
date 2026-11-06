/* FoodScan 89: fills what lists and pictures leave empty, from data computed ahead of time and checked by tests.
 *   Grades in lists: a search, category or swap row whose product has no published grade showed "–", even when its product page shows an estimate. The row now
 *   shows the letter the product page shows (assets/estimates-<rev>.json, built with the page's own steps by tools/build-estimates.mjs), as the app's estimate chip
 *   (dashed ring) with an aria-label and tooltip that say it is FoodScan's estimate, not a published grade.
 *   Photos: a product whose record has no front image showed an illustration. Where Open Food Facts holds another real photo of it (a front image of another
 *   language, or an uploaded photo nobody selected), that photo is shown (assets/photos-<rev>.json, tools/build-photos.mjs). No photo is invented. */
import { pageLang } from './price-core-v83.mjs';

const REV = 'off-csv-2026-10-30', EST_URL = `/assets/estimates-${REV}.json`, PHOTO_URL = `/assets/photos-${REV}.json`;
const TXT = {
  en: { est: (g, band) => `Estimated Nutri-Score ${g}${band ? ` (${band})` : ''}: FoodScan's estimate, not a published grade`, nr: 'Not rated: the Nutri-Score method does not cover this product', photo: 'Photo from Open Food Facts' },
  el: { est: (g, band) => `Εκτιμώμενο Nutri-Score ${g}${band ? ` (${band})` : ''}: εκτίμηση του FoodScan, όχι δημοσιευμένος βαθμός`, nr: 'Χωρίς βαθμό: η μέθοδος Nutri-Score δεν καλύπτει αυτό το προϊόν', photo: 'Φωτογραφία από το Open Food Facts' },
};
const t = () => TXT[pageLang() === 'el' ? 'el' : 'en'];
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
  const letter = likely || letters[0]; if (!/^[A-E]$/.test(letter || '')) return null;
  return { tier, letter, band: letters.length > 1 ? `${letters[0]}–${letters.at(-1)}` : '' };
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
function fillPhoto(box, code) {
  if (box.dataset.fs89 === code) return;
  const file = data.photos[code]; if (!file) return;
  const art = box.querySelector('svg.art'); if (!art && box.querySelector('img')) return;
  box.dataset.fs89 = code;
  const img = new Image(); img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.referrerPolicy = 'no-referrer'; img.title = t().photo; img.src = photoURL(code, file);
  img.addEventListener('error', () => { img.remove(); if (art) box.append(art); }, { once: true }); // keep the illustration when the photo does not load
  if (art) art.remove(); box.append(img);
}
function ensure() {
  if (!data) { if (document.querySelector('a[href*="#/p/"], .hero__img')) load(); return; }
  for (const a of document.querySelectorAll('a[href*="#/p/"]')) {
    const code = codeOf(a); if (!code) continue;
    const chip = a.querySelector('.gchip--none'); if (chip) fillChip(chip, code);
    const box = a.querySelector('.pimg:has(svg.art)') || a.querySelector('.fs88__ph:not(:has(img))'); if (box) fillPhoto(box, code);
  }
  const code = routeCode();
  if (code) { const hero = document.querySelector('#view .hero__img .pimg:has(svg.art)'); if (hero) fillPhoto(hero, code); }
}
let timer = 0;
function schedule() { if (!timer) timer = setTimeout(() => { timer = 0; ensure(); }, 120); }
if (typeof document !== 'undefined') {
  const start = () => { new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true }); addEventListener('hashchange', schedule); schedule(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
}
