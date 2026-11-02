/* FoodScan 73: "Add a price" from a photo of a shelf label or a receipt.
 *  1. The shopper takes or picks a photo. It stays in the browser.
 *  2. Text is read on the device (Tesseract.js, Greek + English, served by FoodScan itself) and suggests price, date, store.
 *  3. The shopper checks and corrects every field and ticks "I confirm". Nothing is saved before that.
 *  4. "Save on this phone" keeps it as a private note. "Share on Open Prices" (optional) sends the photo and price to Open
 *     Prices with the shopper's own Open Food Facts account, directly from the browser; the password and token never reach
 *     FoodScan. Nothing is ever sent automatically. */
import { readLabel, checkReport, openPricesBodies } from './ocr-parse-v79.mjs';

const OP = 'https://prices.openfoodfacts.org/api/v1';
const TOKEN_KEY = 'foodscan:op-token:v73';
const W = {
  el:{title:'Προσθήκη τιμής από φωτογραφία', intro:'Φωτογραφίστε την ετικέτα στο ράφι ή την απόδειξη. Η ανάγνωση γίνεται στη συσκευή σας· τίποτα δεν αποθηκεύεται ή αποστέλλεται χωρίς την επιβεβαίωσή σας.',
    photo:'Φωτογραφία ετικέτας ή απόδειξης', reading:'Ανάγνωση κειμένου στη συσκευή…', loadingOcr:'Φόρτωση αναγνώρισης κειμένου (μία φορά, ~5 MB)…', read:'Διαβάστηκε από τη φωτογραφία — ελέγξτε κάθε πεδίο.',
    noRead:'Δεν διαβάστηκε καθαρή τιμή. Συμπληρώστε τα πεδία από την ετικέτα.', ocrFail:'Η ανάγνωση κειμένου δεν είναι διαθέσιμη σε αυτή τη συσκευή. Συμπληρώστε τα πεδία χειροκίνητα.',
    found:'Τιμές στη φωτογραφία (πατήστε τη σωστή):', unitSeen:'Τιμές μονάδας (αγνοούνται):', price:'Τιμή (€)', was:'Αρχική τιμή, αν είναι προσφορά (€)', date:'Ημερομηνία', store:'Σούπερ μάρκετ', pick:'Επιλέξτε',
    kind:'Τι φωτογραφίσατε', tag:'Ετικέτα ραφιού', receipt:'Απόδειξη', confirm:'Επιβεβαιώνω ότι η τιμή, το κατάστημα και η ημερομηνία είναι σωστά για αυτό το προϊόν.',
    save:'Αποθήκευση στη συσκευή', saved:'Αποθηκεύτηκε στη συσκευή σας.', share:'Κοινοποίηση στο Open Prices', shareIntro:'Προαιρετικό: η φωτογραφία και η τιμή δημοσιεύονται στο Open Prices (Open Food Facts, ODbL) με τον δικό σας λογαριασμό, ώστε να τη βλέπουν όλοι ως «Αναφέρθηκε από καταναλωτή».',
    user:'Όνομα χρήστη Open Food Facts', pass:'Κωδικός', login:'Σύνδεση', loggedIn:'Συνδεδεμένος στο Open Prices', logout:'Αποσύνδεση', signup:'Δημιουργία λογαριασμού ↗',
    near:'Βρείτε το κατάστημα κοντά σας', nearHelp:'Χρησιμοποιεί την τοποθεσία σας μία φορά για να δείξει καταστήματα από το OpenStreetMap.', noNear:'Δεν βρέθηκαν καταστήματα της αλυσίδας κοντά σας.', pickLoc:'Κατάστημα',
    send:'Αποστολή στο Open Prices', sending:'Αποστολή…', sent:'Δημοσιεύτηκε στο Open Prices.', view:'Προβολή ↗', fix:'Ελέγξτε: ', fields:{barcode:'barcode', price:'τιμή', regularPrice:'αρχική τιμή', date:'ημερομηνία', store:'κατάστημα', kind:'είδος φωτογραφίας', confirmed:'επιβεβαίωση'},
    loginFail:'Η σύνδεση απέτυχε. Ελέγξτε όνομα χρήστη και κωδικό.', sendFail:'Η αποστολή απέτυχε', geoFail:'Η τοποθεσία δεν είναι διαθέσιμη.', product:'Προϊόν', close:'Κλείσιμο'},
  en:{title:'Add a price from a photo', intro:'Photograph the shelf label or the receipt. Text is read on your device; nothing is saved or sent until you confirm.',
    photo:'Photo of the shelf label or receipt', reading:'Reading the text on your device…', loadingOcr:'Loading text recognition (once, ~5 MB)…', read:'Read from the photo — check every field.',
    noRead:'No clear price was read. Fill in the fields from the label.', ocrFail:'Text recognition is not available on this device. Fill in the fields by hand.',
    found:'Prices in the photo (tap the right one):', unitSeen:'Unit prices (ignored):', price:'Price (€)', was:'Regular price, if on offer (€)', date:'Date', store:'Supermarket', pick:'Choose',
    kind:'What you photographed', tag:'Shelf label', receipt:'Receipt', confirm:'I confirm the price, store and date are right for this product.',
    save:'Save on this device', saved:'Saved on your device.', share:'Share on Open Prices', shareIntro:'Optional: the photo and price are published on Open Prices (Open Food Facts, ODbL) with your own account, so everyone sees it as "Reported by a shopper".',
    user:'Open Food Facts username', pass:'Password', login:'Sign in', loggedIn:'Signed in to Open Prices', logout:'Sign out', signup:'Create an account ↗',
    near:'Find the store near you', nearHelp:'Uses your location once to list stores from OpenStreetMap.', noNear:'No stores of this chain were found near you.', pickLoc:'Store',
    send:'Send to Open Prices', sending:'Sending…', sent:'Published on Open Prices.', view:'View ↗', fix:'Check: ', fields:{barcode:'barcode', price:'price', regularPrice:'regular price', date:'date', store:'store', kind:'photo type', confirmed:'confirmation'},
    loginFail:'Sign-in failed. Check username and password.', sendFail:'Sending failed', geoFail:'Location is not available.', product:'Product', close:'Close'},
};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const todayISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
let ocrWorker = null;
async function ocr(file, onStatus, t) {
  if (!globalThis.Tesseract) {
    onStatus(t.loadingOcr);
    await new Promise((ok, fail) => { const s = document.createElement('script'); s.src = '/prices/ocr/tesseract.min.js'; s.onload = ok; s.onerror = fail; document.head.append(s); });
  }
  if (!ocrWorker) ocrWorker = await globalThis.Tesseract.createWorker(['ell', 'eng'], 1, {
    workerPath:'/prices/ocr/worker.min.js', corePath:'/prices/ocr/core', langPath:'/prices/ocr/lang', workerBlobURL:false, gzip:true, cacheMethod:'write',
  });
  onStatus(t.reading);
  // Two passes on the same scale (so print heights compare): a clean black-and-white copy, where red prices turn black and
  // light text on a dark band (the chain name on many labels) is flipped, read as sparse text; then the plain photo, read as a page.
  const passes = await ocrImages(file), text = [], words = [];
  for (const [img, psm] of passes) {
    await ocrWorker.setParameters({tessedit_pageseg_mode:psm});
    const { data } = await ocrWorker.recognize(img);
    text.push(data.text || ''); for (const w of data.words || []) words.push({text:w.text, bbox:w.bbox, confidence:w.confidence});
  }
  return {text:text.join('\n\n'), words};
}
async function ocrImages(file) {
  let bmp; try { bmp = await createImageBitmap(file); } catch { return [[file, '3']]; }
  const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height)), w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
  const draw = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', {willReadFrequently:true}); g.drawImage(bmp, 0, 0, w, h); return [c, g]; };
  const [plain] = draw(), [bw, g] = draw(), d = g.getImageData(0, 0, w, h), a = d.data, row = w * 4;
  for (let i = 0; i < a.length; i += 4) a[i] = a[i + 1] = a[i + 2] = Math.min(a[i], a[i + 1], a[i + 2]) < 128 ? 0 : 255;
  for (let y = 0; y < h; y++) { let sum = 0; for (let x = 0; x < row; x += 4) sum += a[y * row + x];
    if (sum / w < 110) for (let x = 0; x < row; x += 4) { const v = 255 - a[y * row + x]; a[y * row + x] = a[y * row + x + 1] = a[y * row + x + 2] = v; } }
  g.putImageData(d, 0, 0);
  return [[bw, '11'], [plain, '3']];
}
/** A smaller JPEG for upload: at most 1800 px, and no EXIF (so no GPS position or camera data leaves the phone). */
async function shrink(file) {
  try {
    const bmp = await createImageBitmap(file), k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise(ok => c.toBlob(b => ok(b || file), 'image/jpeg', 0.85));
  } catch { return file; }
}
const sameChain = (loc, label) => { const a = (s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()); const n = a(loc.osm_brand) + ' ' + a(loc.osm_name);
  return a(label).split(/\s+/).filter(w => w.length > 2).some(w => n.includes(w)); };

/** Opens the flow in `root`. ctx: {code, name, lang, stores:{id:label}, saveLocal(note) -> boolean, toast(msg), fetch?} */
export function openAddPrice(root, ctx) {
  const t = W[ctx.lang === 'el' ? 'el' : 'en'], f = ctx.fetch || globalThis.fetch.bind(globalThis);
  const st = {file:null, read:null, token:sessionStorage.getItem(TOKEN_KEY) || '', locations:[], busy:false};
  root.hidden = false;
  root.innerHTML = `<div class="fa"><div class="fa__head"><h3>${esc(t.title)}</h3><button type="button" class="fa__x" data-fa="close" aria-label="${esc(t.close)}">×</button></div>
    <p class="fa__muted">${esc(t.intro)}</p><p class="fa__product"><b>${esc(t.product)}:</b> ${esc(ctx.name || '')} · <code>${esc(ctx.code)}</code></p>
    <label class="fa__photo"><span>📷 ${esc(t.photo)}</span><input type="file" accept="image/*" capture="environment" data-fa="file"></label>
    <div class="fa__preview" hidden><img alt=""></div><p class="fa__status" role="status" aria-live="polite"></p><div class="fa__chips"></div>
    <form class="fa__form" novalidate>
      <label>${esc(t.price)}<input name="price" inputmode="decimal" autocomplete="off" required></label>
      <label>${esc(t.was)}<input name="regularPrice" inputmode="decimal" autocomplete="off"></label>
      <label>${esc(t.date)}<input name="date" type="date" max="${todayISO()}" value="${todayISO()}" required></label>
      <label>${esc(t.store)}<select name="store" required><option value="">${esc(t.pick)}</option>${Object.entries(ctx.stores).map(([id, l]) => `<option value="${esc(id)}">${esc(l)}</option>`).join('')}</select></label>
      <label>${esc(t.kind)}<select name="kind"><option value="PRICE_TAG">${esc(t.tag)}</option><option value="RECEIPT">${esc(t.receipt)}</option></select></label>
      <label class="fa__check"><input type="checkbox" name="confirmed"> <span>${esc(t.confirm)}</span></label>
      <p class="fa__err" role="alert"></p>
      <div class="fa__row"><button type="submit" class="fp-btn fp-btn--primary fp-btn--sm" data-fa="save">${esc(t.save)}</button></div>
    </form>
    <details class="fa__share"><summary>${esc(t.share)}</summary><p class="fa__muted">${esc(t.shareIntro)}</p><div class="fa__op"></div></details></div>`;
  const $ = s => root.querySelector(s), form = $('.fa__form'), status = $('.fa__status');
  const value = () => { const d = new FormData(form); return {barcode:ctx.code, price:String(d.get('price') || '').trim(), regularPrice:String(d.get('regularPrice') || '').trim(), date:String(d.get('date') || ''), store:String(d.get('store') || ''), kind:String(d.get('kind') || ''), confirmed:form.elements.confirmed.checked}; };
  const check = () => { const r = checkReport(value(), {today:todayISO(), stores:ctx.stores}); $('.fa__err').textContent = r.ok ? '' : t.fix + r.errors.map(e => t.fields[e] || e).join(', '); return r; };
  const renderOP = () => {
    const box = $('.fa__op');
    if (!st.token) { box.innerHTML = `<form class="fa__login"><label>${esc(t.user)}<input name="u" autocomplete="username" required></label><label>${esc(t.pass)}<input name="p" type="password" autocomplete="current-password" required></label><div class="fa__row"><button class="fp-btn fp-btn--outline fp-btn--sm" type="submit">${esc(t.login)}</button><a href="https://world.openfoodfacts.org/cgi/user.pl" target="_blank" rel="noopener noreferrer">${esc(t.signup)}</a></div></form>`; return; }
    box.innerHTML = `<p class="fa__ok">✓ ${esc(t.loggedIn)} · <button type="button" class="fa__link" data-fa="logout">${esc(t.logout)}</button></p>
      <div class="fa__row"><button type="button" class="fp-btn fp-btn--outline fp-btn--sm" data-fa="near">📍 ${esc(t.near)}</button></div><p class="fa__muted">${esc(t.nearHelp)}</p>
      <label class="fa__loc" ${st.locations.length ? '' : 'hidden'}>${esc(t.pickLoc)}<select name="loc">${st.locations.map((l, i) => `<option value="${i}">${esc(l.osm_name || l.osm_brand || '')} · ${esc([l.osm_address_city, (Math.round(l.distance_km * 10) / 10) + ' km'].filter(Boolean).join(' · '))}</option>`).join('')}</select></label>
      <div class="fa__row"><button type="button" class="fp-btn fp-btn--primary fp-btn--sm" data-fa="send" ${st.locations.length && st.file ? '' : 'disabled'}>${esc(t.send)}</button></div><p class="fa__opmsg" role="status"></p>`;
  };
  renderOP();
  root.addEventListener('change', async e => {
    if (e.target.dataset.fa !== 'file' || !e.target.files?.[0]) return;
    st.file = e.target.files[0]; $('.fa__preview').hidden = false; const img = $('.fa__preview img'); img.src = URL.createObjectURL(st.file);
    try {
      const r = readLabel(await ocr(st.file, s => { status.textContent = s; }, t), {today:todayISO()}); st.read = r;
      // Prefill only what was read; the shopper can change everything. The confirm box is never ticked for them.
      if (r.price != null) form.elements.price.value = r.price.toFixed(2).replace('.', ctx.lang === 'el' ? ',' : '.');
      if (r.date) form.elements.date.value = r.date; if (r.store && !form.elements.store.value) form.elements.store.value = r.store; form.elements.kind.value = r.kind;
      status.textContent = r.price != null || r.candidates.length ? t.read : t.noRead;
      $('.fa__chips').innerHTML = (r.candidates.length > 1 || (r.price == null && r.candidates.length) ? `<span>${esc(t.found)}</span>` + r.candidates.slice(0, 8).map(v => `<button type="button" class="fa__chip" data-price="${v.toFixed(2)}">${esc(v.toFixed(2).replace('.', ','))} €</button>`).join('') : '') +
        (r.unitPrices.length ? `<small>${esc(t.unitSeen)} ${r.unitPrices.map(v => v.toFixed(2).replace('.', ',')).join(' · ')}</small>` : '');
    } catch { status.textContent = t.ocrFail; }
    renderOP();
  });
  root.addEventListener('click', async e => {
    const el = e.target.closest('[data-fa],[data-price]'); if (!el) return;
    if (el.dataset.price) { form.elements.price.value = el.dataset.price.replace('.', ctx.lang === 'el' ? ',' : '.'); return; }
    const a = el.dataset.fa;
    if (a === 'close') { root.hidden = true; root.innerHTML = ''; }
    if (a === 'logout') { st.token = ''; sessionStorage.removeItem(TOKEN_KEY); renderOP(); }
    if (a === 'near') {
      const r = check(); const label = ctx.stores[value().store]; if (!label) return;
      try {
        const pos = await new Promise((ok, fail) => navigator.geolocation.getCurrentPosition(ok, fail, {timeout:15000, maximumAge:300000}));
        const u = `${OP}/locations/nearby?lat=${pos.coords.latitude.toFixed(5)}&lon=${pos.coords.longitude.toFixed(5)}&radius_km=5&size=100`;
        const j = await (await f(u, {headers:{accept:'application/json'}})).json();
        st.locations = (j.items || j || []).filter(l => l && l.id && sameChain(l, label)).sort((x, y) => x.distance_km - y.distance_km).slice(0, 20);
        renderOP(); if (!st.locations.length) $('.fa__opmsg').textContent = t.noNear;
      } catch { renderOP(); $('.fa__opmsg').textContent = t.geoFail; }
    }
    if (a === 'send' && !st.busy) {
      const r = check(); if (!r.ok || !st.file) return;
      const loc = st.locations[Number(root.querySelector('[name=loc]')?.value)]; if (!loc) return;
      const msg = $('.fa__opmsg'); st.busy = true; el.disabled = true; msg.textContent = t.sending;
      try {
        const bodies = openPricesBodies(r.value, loc), fd = new FormData();
        fd.append('file', await shrink(st.file), 'proof.jpg'); for (const [k, v] of Object.entries(bodies.proof)) if (v != null) fd.append(k, String(v));
        const auth = {authorization:'Bearer ' + st.token};
        const pr = await f(`${OP}/proofs/upload`, {method:'POST', headers:auth, body:fd}); if (!pr.ok) throw new Error('proof ' + pr.status);
        const proof = await pr.json(); if (!Number.isInteger(proof.id)) throw new Error('proof id');
        const res = await f(`${OP}/prices`, {method:'POST', headers:{...auth, 'content-type':'application/json'}, body:JSON.stringify({...bodies.price, proof_id:proof.id})});
        if (!res.ok) throw new Error('price ' + res.status); const price = await res.json();
        ctx.saveLocal({...r.value, opPriceId:price.id, opProofId:proof.id, source:'photo'});
        msg.innerHTML = `✓ ${esc(t.sent)} <a href="https://prices.openfoodfacts.org/prices/${encodeURIComponent(price.id)}" target="_blank" rel="noopener noreferrer">${esc(t.view)}</a>`;
      } catch (err) { msg.textContent = `${t.sendFail} (${String(err.message || err).slice(0, 60)}).`; el.disabled = false; }
      st.busy = false;
    }
  });
  root.addEventListener('submit', async e => {
    e.preventDefault();
    if (e.target.classList.contains('fa__login')) {
      const d = new FormData(e.target), body = new URLSearchParams({username:String(d.get('u') || ''), password:String(d.get('p') || '')});
      try { const r = await f(`${OP}/auth`, {method:'POST', body}); const j = r.ok ? await r.json() : null; if (!j?.access_token) throw 0;
        st.token = j.access_token; sessionStorage.setItem(TOKEN_KEY, st.token); renderOP(); } catch { ctx.toast(t.loginFail); }
      return;
    }
    const r = check(); if (!r.ok) return;
    if (ctx.saveLocal({...r.value, source:st.file ? 'photo' : 'manual'})) { ctx.toast(t.saved); $('.fa__share').open = true; }
  });
  form.addEventListener('input', () => { if ($('.fa__err').textContent) check(); });
}
