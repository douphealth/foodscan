/* FoodScan 98.1 · Daily check-in on Home, a data check on every product page, My Lens, a 3-product compare tray and a local backup.
 * Local-first: everything stays in this browser's localStorage, no tracking, no network. English and Greek.
 * Logic (and what was checked) lives in daily-v98-core.mjs; this file only draws it.
 * Uses the same engine module as the app (domain-v8400.mjs), so grades match and the app's own translated messages are reused. */
import { assessGrade, dataQuality } from './assets/domain-v8400.mjs';
import { MAX_COMPARE, LENSES, num, r1, auditProduct, lensVerdict, computeStreak, dayStats, parseBackup, BACKUP_KEY } from './daily-v98-core.mjs';

const LENS_KEY = 'foodscan:lens:v98';
const DAILY_KEY = 'foodscan:daily:v98';
const COMPARE_KEY = 'foodscan:compare:v98';

const TX = {
  en: {
    hubEye: 'Daily check-in · Private on this device',
    hubTitle: 'Your everyday kitchen hub',
    hubSub: 'Log what you had in one tap, keep a streak, and see your own priorities on every product.',
    todayItems: 'Logged today', sugarAvg: 'Sugar in foods logged', saltAvg: 'Salt in foods logged',
    per100: v => `${v} g / 100 g`, tsp: v => `≈ ${v} tsp per 100 g · not your intake`, whoSalt: 'WHO: under 5 g salt a day',
    streak: 'Streak', streakDays: n => (n === 1 ? '1 day' : `${n} days`),
    pantry: 'Saved foods', pantrySub: ab => `${ab} graded A or B`,
    quickLogLabel: 'One-tap check-in from your recent foods:',
    quickLogEmpty: 'Open or save a food to unlock one-tap check-ins.',
    loggedMsg: name => `Logged “${name}” for today.`,
    more: 'My Lens and backup',
    lensLabel: 'My Lens: show what matters to you on every product (EU nutrition-claim thresholds):',
    backupExport: 'Export backup', backupImport: 'Restore backup',
    backupDone: 'Backup file downloaded. It holds only this device’s data.',
    restoreDone: n => `Restored ${n} items. Reloading…`,
    restoreBad: 'That file is not a valid FoodScan backup.',
    trustEye: 'Data check',
    confHigh: 'Numbers add up', confMed: 'Check the details', confLow: 'Needs checking',
    confHighDesc: 'The label numbers do not contradict each other. They come from a community database and are not laboratory-verified.',
    confMedDesc: 'Nothing is proven wrong, but something limits how far you can rely on this record. Check the pack.',
    confLowDesc: 'This record contradicts itself. Trust the pack over this record.',
    energyOk: (r, e) => `Energy fits the macros (${r} kcal reported, about ${e} kcal from carbs, protein, fat and fibre).`,
    energyHigh: (r, e) => `Reported energy (${r} kcal) is higher than carbs, protein and fat explain (about ${e} kcal). A value may be missing or wrong. Check the pack.`,
    energyLow: (r, e) => `Reported energy (${r} kcal) is lower than the macros suggest (about ${e} kcal). Rounding or a wrong value can cause this. Check the pack.`,
    skipAlcohol: 'Energy is not checked for alcoholic drinks: alcohol adds energy the macros do not show.',
    skipPolyols: 'Energy is not checked because sugar alcohols (polyols) are listed.',
    compLabel: (h, t) => `Label completeness: ${h} of ${t} key fields`,
    fields: { kcal: 'energy', sugars: 'sugars', 'sat. fat': 'saturated fat', salt: 'salt', protein: 'protein', fibre: 'fibre', ingredients: 'ingredients', NOVA: 'NOVA group' },
    missingList: list => `Missing: ${list.join(', ')}.`,
    ctxSugar: (g, tsp, u) => `${g} g sugars in 100 ${u}, about ${tsp} tsp`,
    ctxSalt: (g, pct, u) => `${g} g salt in 100 ${u}: ${pct}% of the WHO limit of 5 g a day`,
    ctxNova: n => `Processing: NOVA ${n} (${['', 'unprocessed or minimally processed', 'culinary ingredient', 'processed', 'ultra-processed'][n] || ''})`,
    hadToday: '+ Had today', hadTodayDone: 'Logged today ✓',
    pinCompare: 'Pin to compare', pinnedCompare: 'Pinned ✓',
    trayCount: n => `Compare (${n}/${MAX_COMPARE})`, trayOpen: 'Compare now', trayClear: 'Clear',
    cmpTitle: 'Side-by-side compare',
    cmpSub: 'Values per 100 g or 100 ml from your records; a drink and a food are not on the same basis. Always check allergens on the pack.',
    cmpClose: 'Close', cmpRemove: 'Remove', colMetric: 'Metric',
    mGrade: 'Grade', mNova: 'NOVA', mKcal: 'Energy (kcal)', mSugar: 'Sugars g (tsp)', mProt: 'Protein (g)', mFiber: 'Fibre (g)', mSalt: 'Salt (g)', mLens: 'My Lens',
    allergyNote: 'Ingredient checks are never medical allergy clearance: always read the pack.'
  },
  el: {
    hubEye: 'Καθημερινό τσεκάρισμα · Ιδιωτικό στη συσκευή σου',
    hubTitle: 'Το καθημερινό σου κέντρο κουζίνας',
    hubSub: 'Κατέγραψε τι έφαγες με ένα πάτημα, κράτα σερί ημερών και δες τις δικές σου προτεραιότητες σε κάθε προϊόν.',
    todayItems: 'Καταγράφηκαν σήμερα', sugarAvg: 'Ζάχαρη στις καταγραφές', saltAvg: 'Αλάτι στις καταγραφές',
    per100: v => `${String(v).replace('.', ',')} g / 100 g`, tsp: v => `≈ ${String(v).replace('.', ',')} κ.γ. ανά 100 g · όχι η πρόσληψή σου`, whoSalt: 'ΠΟΥ: κάτω από 5 g αλάτι την ημέρα',
    streak: 'Σερί', streakDays: n => (n === 1 ? '1 ημέρα' : `${n} ημέρες`),
    pantry: 'Αποθηκευμένα τρόφιμα', pantrySub: ab => `${ab} με βαθμό A ή B`,
    quickLogLabel: 'Καταγραφή με ένα πάτημα από τα πρόσφατα τρόφιμά σου:',
    quickLogEmpty: 'Άνοιξε ή αποθήκευσε ένα τρόφιμο για να ξεκλειδώσεις την καταγραφή με ένα πάτημα.',
    loggedMsg: name => `Καταγράφηκε το «${name}» για σήμερα.`,
    more: 'Ο Φακός μου και αντίγραφο',
    lensLabel: 'Ο Φακός μου: δες ό,τι σε νοιάζει σε κάθε προϊόν (όρια της ΕΕ για τους ισχυρισμούς διατροφής):',
    backupExport: 'Εξαγωγή αντιγράφου', backupImport: 'Επαναφορά αντιγράφου',
    backupDone: 'Το αντίγραφο κατέβηκε. Περιέχει μόνο τα δεδομένα αυτής της συσκευής.',
    restoreDone: n => `Επαναφέρθηκαν ${n} στοιχεία. Επαναφόρτωση…`,
    restoreBad: 'Το αρχείο δεν είναι έγκυρο αντίγραφο FoodScan.',
    trustEye: 'Έλεγχος δεδομένων',
    confHigh: 'Τα νούμερα βγαίνουν', confMed: 'Δες τις λεπτομέρειες', confLow: 'Χρειάζεται έλεγχο',
    confHighDesc: 'Τα νούμερα της ετικέτας δεν αντιφάσκουν μεταξύ τους. Προέρχονται από κοινοτική βάση δεδομένων και δεν έχουν επαληθευτεί σε εργαστήριο.',
    confMedDesc: 'Δεν αποδεικνύεται κάτι λάθος, αλλά κάτι περιορίζει την αξιοπιστία της εγγραφής. Έλεγξε τη συσκευασία.',
    confLowDesc: 'Η εγγραφή αντιφάσκει με τον εαυτό της. Εμπιστεύσου τη συσκευασία.',
    energyOk: (r, e) => `Η ενέργεια ταιριάζει με τα μακροθρεπτικά (${r} kcal στην πηγή, περίπου ${e} kcal από υδατάνθρακες, πρωτεΐνη, λιπαρά και ίνες).`,
    energyHigh: (r, e) => `Η αναφερόμενη ενέργεια (${r} kcal) είναι υψηλότερη από όσο εξηγούν οι υδατάνθρακες, η πρωτεΐνη και τα λιπαρά (περίπου ${e} kcal). Μπορεί να λείπει ή να είναι λάθος κάποια τιμή. Έλεγξε τη συσκευασία.`,
    energyLow: (r, e) => `Η αναφερόμενη ενέργεια (${r} kcal) είναι χαμηλότερη από ό,τι δείχνουν τα μακροθρεπτικά (περίπου ${e} kcal). Η στρογγυλοποίηση ή μια λάθος τιμή μπορεί να το εξηγεί. Έλεγξε τη συσκευασία.`,
    skipAlcohol: 'Η ενέργεια δεν ελέγχεται στα αλκοολούχα ποτά: το αλκοόλ προσθέτει ενέργεια που δεν φαίνεται στα μακροθρεπτικά.',
    skipPolyols: 'Η ενέργεια δεν ελέγχεται επειδή αναφέρονται πολυόλες (αλκοόλες ζάχαρης).',
    compLabel: (h, t) => `Πληρότητα ετικέτας: ${h} από ${t} βασικά πεδία`,
    fields: { kcal: 'ενέργεια', sugars: 'σάκχαρα', 'sat. fat': 'κορεσμένα λιπαρά', salt: 'αλάτι', protein: 'πρωτεΐνη', fibre: 'φυτικές ίνες', ingredients: 'συστατικά', NOVA: 'ομάδα NOVA' },
    missingList: list => `Λείπουν: ${list.join(', ')}.`,
    ctxSugar: (g, tsp, u) => `${String(g).replace('.', ',')} g σάκχαρα στα 100 ${u}, περίπου ${String(tsp).replace('.', ',')} κ.γ.`,
    ctxSalt: (g, pct, u) => `${String(g).replace('.', ',')} g αλάτι στα 100 ${u}: ${pct}% του ορίου του ΠΟΥ των 5 g ημερησίως`,
    ctxNova: n => `Επεξεργασία: NOVA ${n} (${['', 'ανεπεξέργαστο ή ελάχιστα επεξεργασμένο', 'μαγειρικό συστατικό', 'επεξεργασμένο', 'υπερεπεξεργασμένο'][n] || ''})`,
    hadToday: '+ Έφαγα σήμερα', hadTodayDone: 'Καταγράφηκε σήμερα ✓',
    pinCompare: 'Καρφίτσωμα για σύγκριση', pinnedCompare: 'Στη σύγκριση ✓',
    trayCount: n => `Σύγκριση (${n}/${MAX_COMPARE})`, trayOpen: 'Σύγκρινε τώρα', trayClear: 'Καθαρισμός',
    cmpTitle: 'Σύγκριση δίπλα-δίπλα',
    cmpSub: 'Τιμές ανά 100 g ή 100 ml από τις εγγραφές σου· ένα ρόφημα και ένα στερεό δεν έχουν την ίδια βάση. Έλεγχε πάντα τα αλλεργιογόνα στη συσκευασία.',
    cmpClose: 'Κλείσιμο', cmpRemove: 'Αφαίρεση', colMetric: 'Κριτήριο',
    mGrade: 'Βαθμός', mNova: 'NOVA', mKcal: 'Ενέργεια (kcal)', mSugar: 'Σάκχαρα g (κ.γ.)', mProt: 'Πρωτεΐνη (g)', mFiber: 'Φυτικές ίνες (g)', mSalt: 'Αλάτι (g)', mLens: 'Ο Φακός μου',
    allergyNote: 'Ο έλεγχος συστατικών δεν αποτελεί ιατρική βεβαίωση για αλλεργίες: διάβαζε πάντα τη συσκευασία.'
  }
};

/* The app keeps the language in the profile and mirrors it on <html lang>. */
function lang() {
  try { const p = JSON.parse(localStorage.getItem('fs13:profile') || 'null'); if (p?.language === 'el' || p?.language === 'en') return p.language; } catch {}
  return String(document.documentElement.lang || navigator.language || 'en').toLowerCase().startsWith('el') ? 'el' : 'en';
}
const isEl = () => lang() === 'el';
const dec = v => (isEl() ? String(v).replace('.', ',') : String(v));   // Greek decimal comma
const tr = () => TX[lang()];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

const readRaw = key => { try { return localStorage.getItem(key) || ''; } catch { return ''; } };
const readJSON = (key, fallback) => { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; } };
const writeJSON = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };

const getLenses = () => { const a = readJSON(LENS_KEY, []); return Array.isArray(a) ? a.filter(id => LENSES.some(l => l.id === id)) : []; };
const toggleLens = id => { const s = new Set(getLenses()); s.has(id) ? s.delete(id) : s.add(id); writeJSON(LENS_KEY, [...s]); };

const getDailyLog = () => { const a = readJSON(DAILY_KEY, []); return Array.isArray(a) ? a : []; };
function safeGrade(p) {
  if (!p) return null;
  try { const v = assessGrade(p); if (v && ['reported', 'estimated'].includes(v.status) && /^[A-E]$/.test(String(v.grade || ''))) return v.grade; } catch {}
  return null;
}
function addDailyLog(prod) {
  if (!prod?.barcode) return false;
  const log = getDailyLog(), n = prod.nutrition || {};
  log.push({ day: todayKey(), at: Date.now(), barcode: String(prod.barcode), name: String(prod.name || prod.barcode).slice(0, 80), grade: safeGrade(prod), sugars: num(n.sugars), salt: num(n.salt), protein: num(n.protein) });
  return writeJSON(DAILY_KEY, log.slice(-240));
}

const getCompareList = () => { const a = readJSON(COMPARE_KEY, []); return Array.isArray(a) ? a.slice(0, MAX_COMPARE) : []; };
function toggleCompare(prod) {
  if (!prod?.barcode) return false;
  const list = getCompareList(), idx = list.findIndex(x => String(x.barcode) === String(prod.barcode)), n = prod.nutrition || {};
  if (idx >= 0) { list.splice(idx, 1); writeJSON(COMPARE_KEY, list); return false; }
  if (list.length >= MAX_COMPARE) list.shift();
  list.push({ barcode: String(prod.barcode), name: String(prod.name || prod.barcode).slice(0, 72), brand: String(prod.brand || '').slice(0, 48), basis: prod.basis === 'ml' ? 'ml' : 'g', grade: safeGrade(prod), nova: prod.nova ?? null, kcal: num(n.kcal), sugars: num(n.sugars), protein: num(n.protein), fiber: num(n.fiber), salt: num(n.salt) });
  writeJSON(COMPARE_KEY, list);
  return true;
}

/* The app keeps opened and saved products as { product, at } rows. */
function readAllRecords() {
  const map = new Map();
  for (const key of ['fs13:saved', 'fs13:history']) {
    const rows = readJSON(key, []);
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const p = row?.product || row, code = String(p?.barcode || row?.barcode || '').trim();
      if (!/^\d{8,14}$/.test(code) || map.has(code)) continue;
      map.set(code, { product: p, saved: key === 'fs13:saved', at: row?.at || 0 });
    }
  }
  return map;
}

function routeInfo() {
  const h = location.hash.startsWith('#/') ? location.hash.slice(1).split('?')[0] : location.pathname;
  const m = h.match(/^\/p\/(\d{8,14})\/?$/);
  if (m) return { page: 'product', code: m[1] };
  if (h === '/' || h === '' || h === '/index.html') return { page: 'home', code: '' };
  return { page: 'other', code: '' };
}

/* Re-drawing is skipped when nothing the card shows has changed: the app mutates the page often, and a card that rebuilds itself on every mutation
 * flickers and replaces the button under the finger (the 98.0.0 draft rebuilt the hub 11 times a second while idle). */
const lastHtml = new WeakMap();
function paint(el, html, after) {
  if (lastHtml.get(el) === html) return false;
  lastHtml.set(el, html); el.innerHTML = html; after?.(el);
  return true;
}

function renderHub(view) {
  const records = readAllRecords(), log = getDailyLog();
  if (!records.size && !log.length) { view.querySelectorAll('.fs98-hub').forEach(n => n.remove()); return; }   // a first-time visitor sees the app's own scan screen, not a page of zeros
  const t = tr(), el = isEl();
  const savedRows = [...records.values()].filter(r => r.saved);
  const recentRows = [...records.values()].sort((a, b) => b.at - a.at).slice(0, 6);
  const abCount = savedRows.filter(r => ['A', 'B'].includes(safeGrade(r.product))).length;
  const td = todayKey(), todayRows = log.filter(x => x.day === td), st = dayStats(todayRows);
  const streak = computeStreak(log.map(x => x.day), td), active = new Set(getLenses());

  let hub = view.querySelector('.fs98-hub');
  if (!hub) { hub = document.createElement('section'); hub.className = 'fs98-hub'; view.prepend(hub); }
  hub.setAttribute('aria-label', t.hubTitle);
  const open = hub.querySelector('details.fs98-more')?.open ? ' open' : '';

  const chips = recentRows.length
    ? recentRows.map(r => { const p = r.product, g = safeGrade(p), label = p.name || p.barcode;
        return `<button type="button" class="fs98-chip fs98-chip--log" data-fs98-log="${esc(p.barcode)}" title="${esc(label)}">${g ? `<span class="fs98-grade fs98-grade--${esc(g)}">${esc(g)}</span>` : ''}<span class="fs98-chip__txt">+ ${esc(label)}</span></button>`; }).join('')
    : `<span class="fs98-sub">${esc(t.quickLogEmpty)}</span>`;
  const lensChips = LENSES.map(l => `<button type="button" class="fs98-chip" data-fs98-lens="${esc(l.id)}" aria-pressed="${active.has(l.id)}" title="${esc(el ? l.ruleEl : l.ruleEn)}">${esc(el ? l.el : l.en)}</button>`).join('');
  const dash = '—';

  paint(hub, `
    <div class="fs98-head">
      <div><p class="fs98-eyebrow">${esc(t.hubEye)}</p><h2 class="fs98-title">${esc(t.hubTitle)}</h2><p class="fs98-sub">${esc(t.hubSub)}</p></div>
      <span class="fs98-badge fs98-badge--good">${esc(t.streak)}: ${esc(t.streakDays(streak))}</span>
    </div>
    <div class="fs98-stats">
      <div class="fs98-stat"><span class="fs98-stat__k">${esc(t.todayItems)}</span><span class="fs98-stat__v">${st.count}</span><span class="fs98-stat__s">${esc(td)}</span></div>
      <div class="fs98-stat"><span class="fs98-stat__k">${esc(t.sugarAvg)}</span><span class="fs98-stat__v">${st.sugars == null ? dash : esc(t.per100(st.sugars))}</span><span class="fs98-stat__s">${st.sugars == null ? '' : esc(t.tsp(r1(st.sugars / 4)))}</span></div>
      <div class="fs98-stat"><span class="fs98-stat__k">${esc(t.saltAvg)}</span><span class="fs98-stat__v">${st.salt == null ? dash : esc(t.per100(st.salt))}</span><span class="fs98-stat__s">${esc(t.whoSalt)}</span></div>
      <div class="fs98-stat"><span class="fs98-stat__k">${esc(t.pantry)}</span><span class="fs98-stat__v">${savedRows.length}</span><span class="fs98-stat__s">${esc(t.pantrySub(abCount))}</span></div>
    </div>
    <div class="fs98-sec"><p class="fs98-sec__label">${esc(t.quickLogLabel)}</p><div class="fs98-chips">${chips}</div><p class="fs98-status" id="fs98-hub-status" role="status" aria-live="polite"></p></div>
    <details class="fs98-more"${open}><summary>${esc(t.more)}</summary>
      <div class="fs98-sec"><p class="fs98-sec__label">${esc(t.lensLabel)}</p><div class="fs98-chips">${lensChips}</div></div>
      <div class="fs98-foot"><span>${esc(t.allergyNote)}</span>
        <div class="fs98-chips">
          <button type="button" class="fs98-btn fs98-btn--sm" data-fs98-export>${esc(t.backupExport)}</button>
          <button type="button" class="fs98-btn fs98-btn--sm" data-fs98-import>${esc(t.backupImport)}</button>
          <input type="file" accept="application/json,.json" hidden id="fs98-import-input">
        </div>
      </div>
    </details>`, h => {
    const say = text => { const s = h.querySelector('#fs98-hub-status'); if (s) s.textContent = text; };
    h.querySelectorAll('[data-fs98-lens]').forEach(b => b.addEventListener('click', () => { toggleLens(b.dataset.fs98Lens); renderHub(view); }));
    h.querySelectorAll('[data-fs98-log]').forEach(b => b.addEventListener('click', () => {
      const rec = records.get(b.dataset.fs98Log);
      if (rec?.product && addDailyLog(rec.product)) { renderHub(view); const s = view.querySelector('#fs98-hub-status'); if (s) s.textContent = t.loggedMsg(rec.product.name || rec.product.barcode); }
    }));
    h.querySelector('[data-fs98-export]')?.addEventListener('click', () => { exportBackup(); say(t.backupDone); });
    const fileIn = h.querySelector('#fs98-import-input');
    h.querySelector('[data-fs98-import]')?.addEventListener('click', () => fileIn?.click());
    fileIn?.addEventListener('change', async () => {
      const file = fileIn.files?.[0]; if (!file) return;
      try { const n = importBackup(await file.text()); say(t.restoreDone(n)); setTimeout(() => location.reload(), 900); } catch { say(t.restoreBad); }
    });
  });
}

function renderProductTrust(view, code) {
  const anchor = view.querySelector('.report__main') || view.querySelector('.report');
  if (!anchor) return;
  const rec = readAllRecords().get(code);
  if (!rec?.product) return;
  const p = rec.product, t = tr(), el = isEl(), unit = p.basis === 'ml' ? 'ml' : 'g';
  let dq = null; try { dq = dataQuality(p); } catch {}
  const aud = auditProduct(p, dq), pct = Math.round((aud.have / aud.total) * 100);
  const badge = aud.tier === 'high' ? 'good' : aud.tier === 'med' ? 'warn' : 'bad';
  const label = aud.tier === 'high' ? t.confHigh : aud.tier === 'med' ? t.confMed : t.confLow;
  const desc = aud.tier === 'high' ? t.confHighDesc : aud.tier === 'med' ? t.confMedDesc : t.confLowDesc;

  const checks = [];
  aud.reasons.forEach(text => checks.push({ tone: 'bad', text }));                       // the app's own (translated) reasons
  const e = aud.energy;
  if (e?.skip) checks.push({ tone: 'soft', text: e.skip === 'alcohol' ? t.skipAlcohol : t.skipPolyols });
  else if (e) checks.push({ tone: e.ok ? 'good' : 'warn', text: e.ok ? t.energyOk(Math.round(e.rep), Math.round(e.est)) : (e.dir === 'high' ? t.energyHigh : t.energyLow)(Math.round(e.rep), Math.round(e.est)) });
  if (aud.n.sugars != null) checks.push({ tone: aud.n.sugars > (unit === 'ml' ? 5 : 12) ? 'warn' : 'good', text: t.ctxSugar(r1(aud.n.sugars), r1(aud.n.sugars / 4), unit) });
  if (aud.n.salt != null) checks.push({ tone: aud.n.salt > 1.5 ? 'warn' : 'good', text: t.ctxSalt(r1(aud.n.salt), Math.round((aud.n.salt / 5) * 100), unit) });
  if ([1, 2, 3, 4].includes(Number(p.nova))) checks.push({ tone: Number(p.nova) === 4 ? 'warn' : 'good', text: t.ctxNova(Number(p.nova)) });

  const lensBadges = getLenses().map(id => {
    const def = LENSES.find(l => l.id === id); if (!def) return '';
    const v = lensVerdict(id, p);
    return `<span class="fs98-badge ${v === true ? 'fs98-badge--good' : v === false ? 'fs98-badge--warn' : 'fs98-badge--soft'}" title="${esc(el ? def.ruleEl : def.ruleEn)}">${v === true ? '✓' : v === false ? '×' : '?'} ${esc(el ? def.el : def.en)}</span>`;
  }).join('');
  const pinned = getCompareList().some(x => String(x.barcode) === code);
  const logged = getDailyLog().some(x => x.day === todayKey() && String(x.barcode) === code);

  let card = view.querySelector(`.fs98-trust[data-code="${code}"]`);
  if (!card) {
    view.querySelectorAll('.fs98-trust').forEach(n => n.remove());
    card = document.createElement('section'); card.className = 'fs98-trust'; card.dataset.code = code;
    const hero = anchor.querySelector('.hero'); if (hero) hero.after(card); else anchor.prepend(card);
  }
  card.setAttribute('aria-label', t.trustEye);
  paint(card, `
    <div class="fs98-head">
      <div><p class="fs98-eyebrow">${esc(t.trustEye)}</p><p class="fs98-sub">${esc(desc)}</p></div>
      <span class="fs98-badge fs98-badge--${badge}">${esc(label)}</span>
    </div>
    <div><span class="fs98-stat__k">${esc(t.compLabel(aud.have, aud.total))}${aud.missing.length ? ' · ' + esc(t.missingList(aud.missing.map(k => t.fields[k] || k))) : ''}</span><div class="fs98-meter" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div></div>
    <ul class="fs98-checks">${checks.map(c => `<li><span class="fs98-dot ${c.tone === 'warn' ? 'fs98-dot--warn' : c.tone === 'bad' ? 'fs98-dot--bad' : c.tone === 'soft' ? 'fs98-dot--soft' : ''}"></span><span>${esc(c.text)}</span></li>`).join('')}</ul>
    ${lensBadges ? `<div class="fs98-sec"><div class="fs98-chips">${lensBadges}</div></div>` : ''}
    <div class="fs98-foot">
      <div class="fs98-chips">
        <button type="button" class="fs98-btn fs98-btn--sm" data-fs98-had aria-pressed="${logged}">${esc(logged ? t.hadTodayDone : t.hadToday)}</button>
        <button type="button" class="fs98-btn fs98-btn--sm" data-fs98-pin aria-pressed="${pinned}">${esc(pinned ? t.pinnedCompare : t.pinCompare)}</button>
      </div>
      <span>${esc(t.allergyNote)}</span>
    </div>`, c => {
    c.querySelector('[data-fs98-had]')?.addEventListener('click', () => { addDailyLog(p); renderProductTrust(view, code); });
    c.querySelector('[data-fs98-pin]')?.addEventListener('click', () => { toggleCompare(p); renderProductTrust(view, code); renderTray(); });
  });
}

function renderTray() {
  const list = getCompareList(), t = tr();
  let tray = document.getElementById('fs98-tray');
  if (!tray && !list.length) return;
  if (!tray) { tray = document.createElement('div'); tray.id = 'fs98-tray'; tray.className = 'fs98-tray'; tray.setAttribute('role', 'region'); document.body.append(tray); }
  tray.hidden = list.length === 0;
  if (!list.length) return;
  tray.setAttribute('aria-label', t.cmpTitle);
  paint(tray, `<span class="fs98-tray__label">${esc(t.trayCount(list.length))}</span><button type="button" class="fs98-tray__go" data-fs98-open-cmp>${esc(t.trayOpen)}</button><button type="button" class="fs98-tray__clear" data-fs98-clear-cmp>${esc(t.trayClear)}</button>`, h => {
    h.querySelector('[data-fs98-open-cmp]')?.addEventListener('click', openCompareModal);
    h.querySelector('[data-fs98-clear-cmp]')?.addEventListener('click', () => { writeJSON(COMPARE_KEY, []); closeModal(); renderTray(); schedule(); });
  });
}

let opener = null;
function closeModal() {
  const modal = document.getElementById('fs98-modal');
  if (modal && !modal.hidden) { modal.hidden = true; opener?.focus?.(); opener = null; }
}
function openCompareModal() {
  const list = getCompareList(); if (!list.length) return;
  const t = tr(), el = isEl(), active = getLenses();
  let modal = document.getElementById('fs98-modal');
  const wasClosed = !modal || modal.hidden;
  if (!modal) {
    modal = document.createElement('div'); modal.id = 'fs98-modal'; modal.className = 'fs98-modal';
    modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true');
    document.body.append(modal);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
    modal.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); closeModal(); return; }
      if (e.key !== 'Tab') return;                                                             // keep the focus inside the dialog
      const f = [...modal.querySelectorAll('button, a[href]')]; if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }
  if (wasClosed) opener = document.activeElement;
  modal.hidden = false;
  modal.setAttribute('aria-label', t.cmpTitle);
  const best = (k, f) => { const v = list.map(x => x[k]).filter(n => n != null); return v.length > 1 ? f(...v) : null; };
  const minSugar = best('sugars', Math.min), minSalt = best('salt', Math.min), minKcal = best('kcal', Math.min), maxProt = best('protein', Math.max), maxFiber = best('fiber', Math.max);
  const win = (v, b) => (b != null && v === b ? 'fs98-win' : '');
  const row = (head, cell) => `<tr><th>${esc(head)}</th>${list.map(x => `<td class="${cell(x)[0]}">${cell(x)[1]}</td>`).join('')}</tr>`;

  modal.innerHTML = `
    <div class="fs98-modal__box">
      <div class="fs98-head"><div><h2 class="fs98-title">${esc(t.cmpTitle)}</h2><p class="fs98-sub">${esc(t.cmpSub)}</p></div><button type="button" class="fs98-btn fs98-btn--sm" data-fs98-close-cmp>${esc(t.cmpClose)}</button></div>
      <div class="fs98-table-wrap"><table class="fs98-table">
        <thead><tr><th>${esc(t.colMetric)}</th>${list.map(x => `<th><a href="#/p/${esc(x.barcode)}">${esc(x.name)}</a>${x.brand ? `<br><small>${esc(x.brand)}</small>` : ''}<br><button type="button" class="fs98-btn fs98-btn--sm" data-fs98-rm="${esc(x.barcode)}">${esc(t.cmpRemove)}</button></th>`).join('')}</tr></thead>
        <tbody>
          ${row(t.mGrade, x => ['', `<span class="fs98-grade fs98-grade--${esc(x.grade || 'U')}">${esc(x.grade || '—')}</span>`])}
          ${row(t.mNova, x => ['', x.nova != null ? `NOVA ${esc(x.nova)}` : '—'])}
          ${row(t.mKcal, x => [win(x.kcal, minKcal), x.kcal != null ? Math.round(x.kcal) : '—'])}
          ${row(t.mSugar, x => [win(x.sugars, minSugar), x.sugars != null ? `${dec(r1(x.sugars))} (${dec(r1(x.sugars / 4))})` : '—'])}
          ${row(t.mProt, x => [win(x.protein, maxProt), x.protein != null ? dec(r1(x.protein)) : '—'])}
          ${row(t.mFiber, x => [win(x.fiber, maxFiber), x.fiber != null ? dec(r1(x.fiber)) : '—'])}
          ${row(t.mSalt, x => [win(x.salt, minSalt), x.salt != null ? dec(r1(x.salt)) : '—'])}
          ${active.length ? row(t.mLens, x => ['', `${active.filter(id => lensVerdict(id, x) === true).length}/${active.length}`]) : ''}
        </tbody>
      </table></div>
    </div>`;
  modal.querySelector('[data-fs98-close-cmp]')?.addEventListener('click', closeModal);
  modal.querySelectorAll('[data-fs98-rm]').forEach(b => b.addEventListener('click', () => {
    const next = getCompareList().filter(x => String(x.barcode) !== b.dataset.fs98Rm);
    writeJSON(COMPARE_KEY, next); renderTray();
    if (next.length) openCompareModal(); else closeModal();
    schedule();
  }));
  (modal.querySelector('[data-fs98-close-cmp]'))?.focus();
}

function exportBackup() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && BACKUP_KEY.test(k)) data[k] = localStorage.getItem(k); }
  const blob = new Blob([JSON.stringify({ app: 'FoodScan', version: '98.1.0', exportedAt: new Date().toISOString(), data }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `foodscan-backup-${todayKey()}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}
function importBackup(text) {
  const pairs = parseBackup(text);
  for (const [k, v] of pairs) localStorage.setItem(k, v);
  return pairs.length;
}

/* Which page, which cards. The home hub needs the language, the saved/history/log data and the lens set: when none of them changed, nothing is redone. */
let lastKey = '';
function sync() {
  const view = document.getElementById('view');
  if (!view) return;
  const r = routeInfo();
  const key = [r.page, r.code, lang(), readRaw('fs13:saved'), readRaw('fs13:history'), readRaw(DAILY_KEY), readRaw(LENS_KEY), readRaw(COMPARE_KEY), todayKey()].join('\u0001');
  const present = r.page === 'home' ? !!view.querySelector('.fs98-hub') : r.page === 'product' ? !!view.querySelector('.fs98-trust') : true;
  if (key === lastKey && present) return;
  lastKey = key;
  if (r.page === 'home') { view.querySelectorAll('.fs98-trust').forEach(n => n.remove()); renderHub(view); }
  else if (r.page === 'product' && r.code) { view.querySelectorAll('.fs98-hub').forEach(n => n.remove()); renderProductTrust(view, r.code); }
  else view.querySelectorAll('.fs98-hub, .fs98-trust').forEach(n => n.remove());
  renderTray();
}

let timer = 0;
function schedule() { if (!timer) timer = setTimeout(() => { timer = 0; sync(); }, 90); }
const ours = n => { const e = n?.nodeType === 1 ? n : n?.parentElement; return !!e?.closest?.('.fs98-hub, .fs98-trust, .fs98-tray, .fs98-modal'); };
function start() {
  const host = document.getElementById('app');
  if (host) new MutationObserver(muts => { if (muts.some(m => !ours(m.target))) schedule(); }).observe(host, { childList: true, subtree: true });
  addEventListener('hashchange', schedule); addEventListener('popstate', schedule); addEventListener('storage', schedule); addEventListener('fs:language', schedule);
  schedule();
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}
