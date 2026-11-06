/* FoodScan 85: "Read the label". A product with no grade gets the means to get one: photograph the nutrition table, FoodScan reads it on the phone (Tesseract, no upload),
 * the shopper checks every number against the photo, and the official Nutri-Score 2023 is calculated from those numbers with the table that fits the product.
 * The result is shown as the shopper's own calculation, never as the manufacturer's or the database's grade, and is kept on the device only.
 * Overlay: it watches the product page like the price strip does and adds one card under the grade card when the grade is missing. */
import { esc, pageLang } from './price-core-v83.mjs';

const T = {
  en: {
    eyebrow: 'Read the label', title: 'No grade on record. Get it from the label.',
    sub: 'Photograph the nutrition table. FoodScan reads it on your phone, you check the numbers against the photo, and it calculates the official Nutri-Score 2023. The photo never leaves your device.',
    photo: 'Photograph the nutrition table', type: 'Type the numbers instead', reading: 'Reading the label on your device…', again: 'Trying other image settings…', loadOcr: 'Loading the reader (once)…',
    ocrFail: 'Text recognition is not available on this device. Type the numbers from the label.', nothing: 'No nutrition table was recognised. Type the numbers from the label, or take another photo, close and straight on.',
    review: 'Check these numbers against the label', hint: { repaired: 'Corrected from what was read. Check it.', missing: 'Not read. Type it, or leave it empty if the label does not list it.', inferred: 'Placed by its row position. Check it.', unusual: 'Unusually high. Check it against the label.', check: 'The numbers do not add up. Check it.' },
    kind: 'What is it?', kinds: { general: 'Food', beverage: 'Drink', water: 'Plain water', cheese: 'Cheese', fat: 'Oil, butter, nuts or seeds' },
    fvl: 'Fruit, vegetables, legumes and nuts in it', fvls: { le40: 'Up to 40 %', b40: '40–60 %', b60: '60–80 %', gt80: 'More than 80 %', unknown: 'I do not know' },
    sweet: 'Contains sweeteners', basisServing: 'This label is per serving. Enter the serving size so FoodScan can convert to 100 g.', serving: 'Serving size (g or ml)',
    fields: { kj: 'Energy (kJ)', fat: 'Fat (g)', sat: 'Saturated fat (g)', carbs: 'Carbohydrate (g)', sugars: 'Sugars (g)', fibre: 'Fibre (g)', protein: 'Protein (g)', salt: 'Salt (g)' },
    confirm: 'I checked these numbers against the label.', save: 'Calculate and save', cancel: 'Cancel', edit: 'Edit', remove: 'Remove', retake: 'Take another photo',
    live: 'Result now', needs: l => `To calculate a grade the label must also give: ${l}.`, range: (a, b) => `Between ${a} and ${b}`,
    rangeWhy: l => `The label does not give ${l}, and it could change the letter. Add it to get one letter.`, unknownList: { fibre: 'fibre', protein: 'protein', fvl: 'the share of fruit, vegetables and nuts' },
    grade: g => `Nutri-Score ${g}`, fromLabel: 'from your label', points: (n, p) => `${n} points against it${p ? `, ${p} in its favour` : ''}`,
    basis: k => `Calculated by FoodScan from the numbers you confirmed, with the Nutri-Score 2023 table for “${k}”. Saved on this device only. It is not the manufacturer's or the database's grade.`,
    water: 'Plain water is A in Nutri-Score 2023.', photoAlt: 'Your photo of the label',
    q: {
      none: 'FoodScan has no nutrition values on record for this product.', noneSome: l => `The record lacks: ${l}.`, loading: 'Estimating a grade from the values on record…',
    },
  },
  el: {
    eyebrow: 'Ανάγνωση ετικέτας', title: 'Δεν υπάρχει βαθμός. Υπολογίστε τον από την ετικέτα.',
    sub: 'Φωτογραφίστε τον πίνακα διατροφικής αξίας. Το FoodScan τον διαβάζει στο κινητό σας, ελέγχετε τους αριθμούς με τη φωτογραφία και υπολογίζεται το επίσημο Nutri-Score 2023. Η φωτογραφία δεν φεύγει από τη συσκευή σας.',
    photo: 'Φωτογραφία του πίνακα διατροφικής αξίας', type: 'Πληκτρολόγηση των αριθμών', reading: 'Ανάγνωση της ετικέτας στη συσκευή σας…', again: 'Δοκιμή άλλων ρυθμίσεων εικόνας…', loadOcr: 'Φόρτωση του αναγνώστη (μία φορά)…',
    ocrFail: 'Η αναγνώριση κειμένου δεν είναι διαθέσιμη σε αυτή τη συσκευή. Πληκτρολογήστε τους αριθμούς από την ετικέτα.', nothing: 'Δεν αναγνωρίστηκε πίνακας διατροφικής αξίας. Πληκτρολογήστε τους αριθμούς ή τραβήξτε νέα φωτογραφία, από κοντά και ευθεία.',
    review: 'Ελέγξτε τους αριθμούς με την ετικέτα', hint: { repaired: 'Διορθώθηκε από το αναγνωσμένο. Ελέγξτε το.', missing: 'Δεν διαβάστηκε. Πληκτρολογήστε το ή αφήστε το κενό αν η ετικέτα δεν το αναγράφει.', inferred: 'Τοποθετήθηκε βάσει της θέσης της γραμμής. Ελέγξτε το.', unusual: 'Ασυνήθιστα υψηλή τιμή. Ελέγξτε την με την ετικέτα.', check: 'Οι αριθμοί δεν συμφωνούν μεταξύ τους. Ελέγξτε το.' },
    kind: 'Τι είναι;', kinds: { general: 'Τρόφιμο', beverage: 'Ρόφημα', water: 'Σκέτο νερό', cheese: 'Τυρί', fat: 'Λάδι, βούτυρο, ξηροί καρποί ή σπόροι' },
    fvl: 'Φρούτα, λαχανικά, όσπρια και ξηροί καρποί σε αυτό', fvls: { le40: 'Έως 40 %', b40: '40–60 %', b60: '60–80 %', gt80: 'Πάνω από 80 %', unknown: 'Δεν γνωρίζω' },
    sweet: 'Περιέχει γλυκαντικά', basisServing: 'Η ετικέτα αναφέρεται ανά μερίδα. Συμπληρώστε το μέγεθος μερίδας για μετατροπή σε 100 g.', serving: 'Μέγεθος μερίδας (g ή ml)',
    fields: { kj: 'Ενέργεια (kJ)', fat: 'Λιπαρά (g)', sat: 'Κορεσμένα λιπαρά (g)', carbs: 'Υδατάνθρακες (g)', sugars: 'Σάκχαρα (g)', fibre: 'Φυτικές ίνες (g)', protein: 'Πρωτεΐνες (g)', salt: 'Αλάτι (g)' },
    confirm: 'Έλεγξα τους αριθμούς με την ετικέτα.', save: 'Υπολογισμός και αποθήκευση', cancel: 'Ακύρωση', edit: 'Επεξεργασία', remove: 'Αφαίρεση', retake: 'Νέα φωτογραφία',
    live: 'Αποτέλεσμα τώρα', needs: l => `Για τον υπολογισμό πρέπει η ετικέτα να αναγράφει επίσης: ${l}.`, range: (a, b) => `Από ${a} έως ${b}`,
    rangeWhy: l => `Η ετικέτα δεν αναγράφει ${l} και μπορεί να αλλάξει το γράμμα. Προσθέστε το για ένα γράμμα.`, unknownList: { fibre: 'φυτικές ίνες', protein: 'πρωτεΐνες', fvl: 'το ποσοστό φρούτων, λαχανικών και ξηρών καρπών' },
    grade: g => `Nutri-Score ${g}`, fromLabel: 'από την ετικέτα σας', points: (n, p) => `${n} βαθμοί εναντίον${p ? `, ${p} υπέρ` : ''}`,
    basis: k => `Υπολογίστηκε από το FoodScan με τους αριθμούς που επιβεβαιώσατε, με τον πίνακα Nutri-Score 2023 για «${k}». Αποθηκεύεται μόνο σε αυτή τη συσκευή. Δεν είναι ο βαθμός του κατασκευαστή ούτε της βάσης δεδομένων.`,
    water: 'Το σκέτο νερό είναι A στο Nutri-Score 2023.', photoAlt: 'Η φωτογραφία σας της ετικέτας',
    q: {
      none: 'Το FoodScan δεν έχει καταγεγραμμένες διατροφικές τιμές για αυτό το προϊόν.', noneSome: l => `Στην εγγραφή λείπουν: ${l}.`, loading: 'Εκτίμηση βαθμού από τις καταγεγραμμένες τιμές…',
    },
  },
};
const lang = () => pageLang();
const tx = (k, ...a) => { const v = (T[lang()] || T.en)[k]; return typeof v === 'function' ? v(...a) : v; };
const KEY = c => `fs85:label:${c}`;
const route = () => (location.hash.startsWith('#/') ? location.hash.slice(1) : location.pathname);
const productCode = () => route().match(/^\/p\/(\d{8}|\d{12,14})(?:[/?]|$)/)?.[1] || null;
const store = {
  get(c) { try { const v = JSON.parse(localStorage.getItem(KEY(c)) || 'null'); return v && v.v === 2 && v.model ? v : null; } catch { return null; } },
  set(c, v) { try { localStorage.setItem(KEY(c), JSON.stringify(v)); return true; } catch { return false; } },
  del(c) { try { localStorage.removeItem(KEY(c)); } catch {} },
};
const FIELDS = ['kj', 'fat', 'sat', 'carbs', 'sugars', 'fibre', 'protein', 'salt'];
const state = new Map(); // code -> { phase, file, url, values, flags, kind, fvl, sweet, serving, basis, confirmed, busy, status }
let mods = null;
const load = async () => mods || (mods = Promise.all([import('./label-reader-v85.mjs'), import('./label-ocr-v85.mjs'), import('./quick-grade-v85.mjs')]).then(([reader, ocr, quickG]) => ({ reader, ocr, quickG })));
let G = null, gLoading = false; // the grade card builder, loaded when a grade is first shown
function needGrade() { if (!G && !gLoading) { gLoading = true; import('./grade-ui-v85.mjs').then(m => { G = m; schedule(); }).catch(() => { gLoading = false; }); } return G; }
const num = s => { const n = Number(String(s ?? '').trim().replace(',', '.')); return String(s ?? '').trim() === '' || !Number.isFinite(n) || n < 0 ? null : n; };
const show = n => (n == null ? '' : String(n));

function gradeNow(st, reader) {
  let v = { ...st.values };
  if (st.basis === 'serving') v = reader.perHundred(v, num(st.serving));
  if (st.basis === 'serving' && !(num(st.serving) > 0)) return { ok: false, missing: [tx('serving')] };
  return reader.gradeFromLabel(v, { kind: st.kind, fvlBand: st.fvl, sweeteners: st.sweet });
}
const chip = g => `<span class="fr85__chip g-${esc(g)}" aria-hidden="true">${esc(g)}</span>`;
function resultHTML(r) {
  if (!r) return '';
  if (!r.ok) return `<p class="fr85__need">${esc(tx('needs', r.missing.join(', ')))}</p>`;
  if (r.kind === 'water') return `<div class="fr85__res">${chip('A')}<div><b>${esc(tx('grade', 'A'))}</b><span>${esc(tx('water'))}</span></div></div>`;
  if (r.grade) return `<div class="fr85__res">${chip(r.grade)}<div><b>${esc(tx('grade', r.grade))}</b><span>${r.detail ? esc(tx('points', r.detail.negative.total, r.detail.positive.total)) : ''}</span></div></div>`;
  const list = Object.entries(r.unknown).filter(([, x]) => x).map(([k]) => tx('unknownList')[k]).join(', ');
  return `<div class="fr85__res fr85__res--range">${chip(r.range[0])}<i aria-hidden="true">–</i>${chip(r.range[1])}<div><b>${esc(tx('range', r.range[0], r.range[1]))}</b><span>${esc(tx('rangeWhy', list))}</span></div></div>`;
}

function gradeView(model, o) { const g = needGrade(); return g && model ? g.gradeHTML(model, { lang: lang(), ...o }) : `<div class="fr85__wait" role="status"><i class="fr85__spin" aria-hidden="true"></i><span>${esc(tx('q').loading)}</span></div>`; }
const savedHTML = (code, saved) => gradeView(saved.model, { kind: 'label', code, actions: true });
function idleNote(st) {
  const q = quick.get(st.code)?.q, k = T[lang()]?.q || T.en.q;
  if (!q || q.ok || q.reason !== 'inputs-missing') return '';
  return `<p class="fr85__sub">${esc(q.have ? k.noneSome(q.missing.join(', ')) : k.none)}</p>`;
}
function idleHTML(st) {
  return `<div class="fr85__head"><span class="fr85__eyebrow">${esc(tx('eyebrow'))}</span></div>
    <h2 class="fr85__title">${esc(tx('title'))}</h2>${idleNote(st)}<p class="fr85__sub">${esc(tx('sub'))}</p>
    <div class="fr85__row"><label class="fr85__btn fr85__btn--main"><span>📷 ${esc(tx('photo'))}</span><input type="file" accept="image/*" capture="environment" data-fr="file" hidden></label>
    <button type="button" class="fr85__btn" data-fr="manual">${esc(tx('type'))}</button></div><p class="fr85__status" role="status" aria-live="polite">${esc(st.status || '')}</p>`;
}
function formHTML(code, st) {
  const f = tx('fields'), hint = tx('hint');
  const row = k => { const fl = st.flags?.[k]; return `<label class="fr85__f${fl ? ' fr85__f--flag' : ''}"><span>${esc(f[k])}</span><input inputmode="decimal" autocomplete="off" data-fr-field="${k}" value="${esc(show(st.values[k]))}" aria-describedby="${fl ? `fr85-h-${k}` : ''}">${fl ? `<small id="fr85-h-${k}">${esc(hint[fl] || '')}</small>` : ''}</label>`; };
  const opts = (map, cur) => Object.entries(map).map(([k, l]) => `<option value="${k}"${k === cur ? ' selected' : ''}>${esc(l)}</option>`).join('');
  const drink = st.kind === 'beverage';
  return `<div class="fr85__head"><span class="fr85__eyebrow">${esc(tx('eyebrow'))}</span></div><h2 class="fr85__title">${esc(tx('review'))}</h2>
    ${st.url ? `<div class="fr85__photo"><img src="${esc(st.url)}" alt="${esc(tx('photoAlt'))}"></div>` : ''}
    <p class="fr85__status" role="status" aria-live="polite">${esc(st.status || '')}</p>
    <label class="fr85__f"><span>${esc(tx('kind'))}</span><select data-fr-opt="kind">${opts(tx('kinds'), st.kind)}</select></label>
    ${st.kind === 'water' ? '' : `<div class="fr85__grid">${FIELDS.map(row).join('')}</div>`}
    ${st.basis === 'serving' && st.kind !== 'water' ? `<label class="fr85__f fr85__f--flag"><span>${esc(tx('serving'))}</span><input inputmode="decimal" data-fr-opt="serving" value="${esc(show(st.serving))}"><small>${esc(tx('basisServing'))}</small></label>` : ''}
    ${st.kind === 'general' || st.kind === 'cheese' || st.kind === 'beverage' ? `<label class="fr85__f"><span>${esc(tx('fvl'))}</span><select data-fr-opt="fvl">${opts(tx('fvls'), st.fvl)}</select></label>` : ''}
    ${drink ? `<label class="fr85__check"><input type="checkbox" data-fr-opt="sweet"${st.sweet ? ' checked' : ''}> <span>${esc(tx('sweet'))}</span></label>` : ''}
    <div class="fr85__live" aria-live="polite"><span class="fr85__livehead">${esc(tx('live'))}</span><div data-fr="live"></div></div>
    <label class="fr85__check"><input type="checkbox" data-fr-opt="confirm"${st.confirmed ? ' checked' : ''}> <span>${esc(tx('confirm'))}</span></label>
    <div class="fr85__row"><button type="button" class="fr85__btn fr85__btn--main" data-fr="save" disabled>${esc(tx('save'))}</button><label class="fr85__btn"><span>${esc(tx('retake'))}</span><input type="file" accept="image/*" capture="environment" data-fr="file" hidden></label><button type="button" class="fr85__btn fr85__btn--ghost" data-fr="cancel">${esc(tx('cancel'))}</button></div>`;
}

/** Which view the card shows: a saved exact grade, the quick estimate, or the reading/review/ask panels. */
function viewOf(code) {
  const st = state.get(code) || { phase: 'idle' };
  if (st.phase !== 'idle') return { view: st.phase, st };
  const saved = store.get(code);
  if (saved) return { view: 'saved', st, saved };
  if (!quick.has(code)) loadQuick(code);
  const qk = quick.get(code);
  return qk?.state === 'ready' && qk.kind !== 'none' ? { view: 'quick', st, qk } : { view: 'idle', st, qk };
}
const isGradeView = v => v === 'saved' || v === 'quick';
function paint(sec, code, w) {
  const { view, st, saved, qk } = w, key = [view, lang(), st.rev || 0, qk?.state || '', G ? 1 : 0].join(':');
  if (sec.dataset.view === key) return;
  sec.dataset.view = key; sec.setAttribute('aria-label', isGradeView(view) ? tx('eyebrow') : tx('eyebrow')); sec.setAttribute('aria-busy', view === 'reading' ? 'true' : 'false');
  if (view === 'saved') sec.innerHTML = savedHTML(code, saved);
  else if (view === 'quick') sec.innerHTML = quickHTML(code, qk);
  else if (view === 'reading') sec.innerHTML = `<div class="fr85__head"><span class="fr85__eyebrow">${esc(tx('eyebrow'))}</span></div><div class="fr85__wait" role="status"><i class="fr85__spin" aria-hidden="true"></i><span>${esc(st.status || tx('reading'))}</span></div>`;
  else if (view === 'review') { sec.innerHTML = formHTML(code, st); refreshLive(sec, code); }
  else sec.innerHTML = idleHTML({ ...st, code });
}
async function refreshLive(sec, code) {
  const st = state.get(code); if (!st || st.phase !== 'review') return;
  const { reader } = await load(), r = gradeNow(st, reader), box = sec.querySelector('[data-fr="live"]'), save = sec.querySelector('[data-fr="save"]');
  if (box) box.innerHTML = st.kind === 'water' ? resultHTML({ ok: true, kind: 'water' }) : resultHTML(r);
  if (save) save.disabled = !(r.ok && st.confirmed);
  st.result = r;
}
const bump = st => { st.rev = (st.rev || 0) + 1; };

/* ---------- the quick grade: no photo, no typing ---------- */
const quick = new Map(); // code -> { state: 'loading' | 'ready' | 'none', q }
globalThis.__fs85quick = quick; // read by prices/swaps-ui-v88.js, so the swaps use the same table and estimate as the grade card (88)
const PEERS_URL = '/assets/peers-off-csv-2026-10-30.json';
let peersPromise = null; // the similar-products index, fetched only when a product needs it
const peers = S => peersPromise || (peersPromise = fetch(PEERS_URL).then(r => (r.ok ? r.json() : null)).then(j => (j ? S.prepare(j) : null)).catch(() => null));
// 89: the last step before "no grade": products that share the record's Open Food Facts categories (prices/swaps-v88.mjs categoryGrade)
let swapsPromise = null;
const swapsIndex = W => swapsPromise || (swapsPromise = fetch('/assets/swaps-off-csv-2026-10-30.json').then(r => (r.ok ? r.json() : null)).then(j => (j ? W.prepare(j) : null)).catch(() => null));
async function categoryEstimate(D, Q, p, body) {
  const cats = body?.product?.categories_tags || []; if (!cats.length) return null;
  const W = await import('./swaps-v88.mjs'), prep = await swapsIndex(W); if (!prep) return null;
  const k = D.ns23Kinds(p), kind = k.kinds?.length ? k.kinds[0] : Q.inferKinds(p).kinds[0];
  const r = W.categoryGrade({ code: p.barcode, name: p.name, brand: (body?.product?.brands || '').split(',')[0], categories: cats, kind }, prep);
  return r.ok ? r : null;
}
const inputsOf = p => { const n = p?.nutrition || {}; return { kj: n.kj ?? (n.kcal != null ? Math.round(n.kcal * 4.184) : null), sugars: n.sugars ?? null, saturatedFat: n.saturatedFat ?? null, salt: n.salt ?? null, fibre: n.fiber ?? null, protein: n.protein ?? null, fat: n.fat ?? null, carbs: n.carbohydrates ?? null }; };
async function loadQuick(code) {
  quick.set(code, { state: 'loading' });
  try {
    const [D, Q, S] = await Promise.all([import('../assets/domain-v8500.mjs'), import('./quick-grade-v85.mjs'), import('./similar-v86.mjs'), needGrade() || Promise.resolve()]);
    const res = await fetch(`/api/product/${encodeURIComponent(code)}`, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error('http ' + res.status);
    const body = await res.json(), p = D.parseProduct(body, code), a = D.assessGrade(p), alcohol = body?.product?.nutriments?.alcohol_100g;
    p.family = body?.catalogueSnapshot?.family || ''; // the catalogue's product family, used to find similar products (87.2)
    const modified = Number(body?.product?.last_modified_t) > 0 ? Number(body.product.last_modified_t) * 1000 : null, meta = { modified, snapshot: Boolean(body?.catalogueSnapshot) };
    // the app's own verdict always wins: a grade, or a grade held back for review, is never replaced by an estimate
    if (a.grade || a.status === 'withheld') { quick.set(code, { state: 'ready', ...meta, kind: 'none', q: { ok: false, reason: 'app-has-grade' } }); schedule(); return; }
    let q = Q.quickGrade(p, { alcohol }), entry = { state: 'ready', ...meta, kind: q.ok ? 'quick' : 'none', q };
    if (!q.ok && (q.reason === 'exempt' || q.reason === 'excluded')) entry = { ...entry, kind: 'exempt', exempt: { why: q.why || 'other', inputs: inputsOf(p) } };
    else if (!q.ok && ['inputs-missing', 'too-uncertain', 'no-table'].includes(q.reason)) {
      const prep = await peers(S);
      if (prep) {
        // too uncertain: first the table from similar products; if that does not settle it, the missing number is borrowed from them (87.1: this step was skipped)
        const pk = q.reason === 'too-uncertain' ? S.peerKind(p, prep) : null, q2 = pk ? Q.quickGrade(p, { alcohol, kindsOverride: [pk.kind] }) : null;
        if (q2?.ok) entry = { ...entry, kind: 'quick', q: q2 };
        else { const sm = S.similarGrade(p, prep); if (sm.ok) entry = { ...entry, kind: 'similar', sim: { ...sm, inputs: inputsOf(p) } }; }
      }
      if (entry.kind === 'none') { const cg = await categoryEstimate(D, Q, p, body); if (cg) entry = { ...entry, kind: 'similar', sim: { ...cg, inputs: inputsOf(p) } }; }
    }
    quick.set(code, entry);
  } catch { quick.set(code, { state: 'none', kind: 'none', q: { ok: false, reason: 'unavailable' } }); }
  schedule();
}
const quickHTML = (code, qk) => {
  const g = needGrade(), o = { lang: lang(), code, modified: qk.modified, snapshot: qk.snapshot, actions: true };
  if (!g) return gradeView(null, o);
  return qk.kind === 'similar' ? g.similarHTML(qk.sim, o) : qk.kind === 'exempt' ? g.exemptHTML(qk.exempt, o) : g.gradeHTML(qk.q, { ...o, kind: 'estimate' });
};

async function startFromFile(code, file) {
  const st = state.get(code) || {}; if (st.url) URL.revokeObjectURL(st.url);
  Object.assign(st, { phase: 'reading', file, url: URL.createObjectURL(file), status: tx('loadOcr'), confirmed: false, kind: st.kind || 'general', fvl: st.fvl || 'le40', sweet: false, values: {}, flags: {}, basis: null }); bump(st); state.set(code, st); schedule();
  try {
    const { ocr } = await load();
    const res = await ocr.readLabelPhoto(file, { onStatus: s => { st.status = s === 'again' ? tx('again') : s === 'read' ? tx('reading') : tx('loadOcr'); const el = document.querySelector(`.fr85[data-code="${code}"] .fr85__wait span`); if (el) el.textContent = st.status; } });
    const use = res.combined || res.best.reading, v = use.values || {};
    const got = FIELDS.filter(k => v[k] != null).length;
    st.values = { kj: v.kj ?? null, kcal: v.kcal ?? null, fat: v.fat ?? null, sat: v.sat ?? null, carbs: v.carbs ?? null, sugars: v.sugars ?? null, fibre: v.fibre ?? null, protein: v.protein ?? null, salt: v.salt ?? null };
    st.flags = { ...(use.flags || {}) }; for (const k of use.disagree || []) st.flags[k] ||= 'check';
    for (const k of FIELDS) if (k !== 'kj' && st.values[k] == null && !st.flags[k]) st.flags[k] = 'missing';
    st.basis = use.basis === 'serving' ? 'serving' : null; st.kind = use.basis === '100ml' ? 'beverage' : st.kind;
    st.status = got >= 3 ? '' : tx('nothing'); st.phase = 'review';
  } catch { st.status = tx('ocrFail'); st.phase = 'review'; st.values = {}; }
  bump(st); schedule();
}
function startManual(code) { const st = state.get(code) || {}; Object.assign(st, { phase: 'review', url: '', values: {}, flags: {}, kind: 'general', fvl: 'le40', sweet: false, basis: null, confirmed: false, status: '' }); bump(st); state.set(code, st); schedule(); }
async function save(code) {
  const st = state.get(code); if (!st?.result?.ok || !st.confirmed) return;
  const { reader, quickG } = await load();
  let v = { ...st.values }; if (st.basis === 'serving') v = reader.perHundred(v, num(st.serving));
  const band = reader.FVL_BANDS[st.fvl], fvlText = tx('fvls')[st.fvl];
  const model = quickG.labelGrade(v, { kind: st.kind, fvl: st.fvl === 'unknown' ? null : band ?? 0, fvlText: st.fvl === 'unknown' ? null : fvlText, sweeteners: Boolean(st.sweet) });
  if (!model.ok) return;
  store.set(code, { v: 2, at: Date.now(), kind: st.kind, fvl: st.fvl, sweet: Boolean(st.sweet), serving: num(st.serving), basis: st.basis, values: st.values, model });
  if (st.url) URL.revokeObjectURL(st.url);
  state.delete(code); schedule();
}

document.addEventListener('change', e => {
  const code = productCode(); if (!code) return;
  const t = e.target;
  if (t.matches?.('input[data-fr="file"]') && t.files?.[0]) { startFromFile(code, t.files[0]); t.value = ''; return; }
  const opt = t.dataset?.frOpt, st = state.get(code); if (!opt || !st) return;
  st[opt === 'confirm' ? 'confirmed' : opt] = t.type === 'checkbox' ? t.checked : t.value;
  if (opt === 'kind') { bump(st); schedule(); return; }
  refreshLive(t.closest('.fr85'), code);
});
document.addEventListener('input', e => {
  const code = productCode(), st = code && state.get(code), t = e.target, field = t.dataset?.frField;
  if (!st) return;
  if (field) { st.values[field] = num(t.value); if (field === 'kj') st.values.kcal = null; refreshLive(t.closest('.fr85'), code); }
  else if (t.dataset?.frOpt === 'serving') { st.serving = t.value; refreshLive(t.closest('.fr85'), code); }
});
document.addEventListener('click', e => {
  const b = e.target.closest?.('[data-fr]'); const code = productCode(); if (!b || !code) return;
  const a = b.dataset.fr;
  if (a === 'manual') startManual(code);
  else if (a === 'save') save(code);
  else if (a === 'cancel') { const st = state.get(code); if (st?.url) URL.revokeObjectURL(st.url); state.delete(code); schedule(); }
  else if (a === 'remove') { store.del(code); state.delete(code); schedule(); }
  else if (a === 'edit') { const s = store.get(code); if (!s) return; state.set(code, { phase: 'review', url: '', values: { ...s.values }, flags: {}, kind: s.kind, fvl: s.fvl, sweet: s.sweet, basis: s.basis, serving: s.serving, confirmed: false, status: '', rev: 1 }); schedule(); }
});

/* ---------- placement ---------- */
const hasNoGrade = hero => { const gc = hero.querySelector('.gradecard'); return !gc || gc.dataset.grade === 'none' || gc.classList.contains('g-none'); };
function ensure() {
  timer = 0;
  const view = document.querySelector('#view'), code = productCode();
  const clean = () => { document.querySelectorAll('.fr85').forEach(n => n.remove()); document.querySelectorAll('.gradecard[data-fg85]').forEach(n => n.removeAttribute('data-fg85')); };
  document.querySelectorAll('.fr85').forEach(n => { if (!code || n.dataset.code !== code || !n.isConnected) n.remove(); });
  if (!view || !code) return clean();
  const hero = view.querySelector('article.hero');
  let gc = null, page = null;
  if (hero) { if (!hero.textContent.includes(code) || !hasNoGrade(hero)) return clean(); gc = hero.querySelector(':scope > .gradecard'); }
  else { page = view.querySelector('#instant-calc')?.closest('.page'); if (!page) return; }
  const w = viewOf(code), inCard = Boolean(gc) && isGradeView(w.view);
  let sec = view.querySelector(`.fr85[data-code="${code}"]`);
  if (!sec) { sec = document.createElement('section'); sec.className = 'fr85'; sec.dataset.code = code; }
  sec.classList.toggle('fr85--grade', isGradeView(w.view));
  // a grade replaces the "No grade" header of the card it sits in; any other panel goes right under that card
  if (gc) {
    if (inCard) { if (gc.firstElementChild !== sec) gc.prepend(sec); gc.setAttribute('data-fg85', '1'); }
    else { gc.removeAttribute('data-fg85'); if (gc.nextElementSibling !== sec) gc.after(sec); }
  } else {
    const lead = page.querySelector(':scope > .fp80-standalone');
    if (lead ? lead.nextElementSibling !== sec : page.firstElementChild !== sec) { if (lead) lead.after(sec); else page.prepend(sec); }
  }
  paint(sec, code, w);
}
let timer = 0;
function schedule() { if (!timer) timer = setTimeout(ensure, 70); }
function start() {
  const host = document.getElementById('app');
  if (host) new MutationObserver(schedule).observe(host, { childList: true, subtree: true });
  addEventListener('hashchange', schedule); addEventListener('popstate', schedule); schedule();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
