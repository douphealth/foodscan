/* FoodScan 78 native prices (from 72/75). One scan, one screen: the Nutri-Score and the real shelf price together.
 * - Product view: the cheapest CURRENT Greek price (store, per kg/L, date, freshness) sits under the grade card.
 * - Higher-grade choices and Compare: the cheapest current price only, with the per-kg/L difference.
 * - Prices · Τιμές: every store, opened straight from the product (no second scan).
 * The price request starts the moment the route changes, alongside the app's own product lookup, and never delays
 * the grade: the grade renders first, the price fills in. Only real, dated observations appear (price-core-v80).
 * 78: results expire after 10 minutes; a new scan of a barcode always asks the sources again; a partial answer (a source
 * down, nothing in the others) says so instead of "no price"; Higher-grade choices and Compare claim a saving only when
 * both prices are per kg or both per litre. */
import { getPrices, peekPrices, forgetPrices, TTL } from './price-client-v80.mjs';
import { esc, euro, unitText, whenText, dateText, unitDelta, pageLang, t } from './price-core-v80.mjs';

const icon = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>';
const chev = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
const T = {
  en:{eyebrow:'Supermarket price', facts:'Compare label facts', hideFacts:'Hide label facts', moreOpts:n => `Show ${n} more`, show:'Show', hide:'Hide', navPrices:'Prices', update:'A new version of FoodScan is ready.', reload:'Refresh', cheapest:'Cheapest current price', condTitle:k => `Current ${k.toLowerCase()}`, offer:'offer', checking:'Checking supermarket prices…', na:'Not available', allStores:'All stores', seeAll:n => n > 1 ? `See all ${n} prices` : 'See all prices', addShort:'Add a price',
    noData:'No supermarket price recorded for this barcode yet.', addOwn:'Add a price you saw', lastSeen:'Last seen', notCurrent:'Not a current price',
    elsewhere:c => `Only seen outside Greece (${c})`, down:'Prices could not be checked right now. The grade above is unaffected.', retry:'Try again',
    of:(n, m) => n > 1 ? `Lowest of ${n} prices${m > 1 ? ` · ${m} chains` : ''}` : 'Only current price on record', upTo:x => `others up to +${x}`,
    observed:'Observed', alsoCheaper:'Also cheaper', perKgMore:x => `+${x}`, noPrice:'Price not available', vsThis:'vs this', row:'Cheapest price', fresh:'Current', older:'Older', historical:'Historical', expired:'Expired',
    receipt:'receipt', photo:'shelf photo', feed:'retailer feed', observatory:'official chain price', web:'chain web-shop price', online:'Online price', auto:'automatic exact match', shopper:'reported by a shopper', basket:'e-katanalotis', chains:'Chain prices', national:'National chain price', moreChains:n => `+${n} more`, card:'Card price', multi:'Multi-buy price', cond:'With conditions',
    condSub:(k, reg) => `${reg ? `Regular price ${reg} · ` : ''}No current price without conditions on record`,
    partial:'Some price sources did not answer, and the others have no price for this barcode.', notComparable:'Different units · no saving claimed', unitNote:'Not comparable per kg/L',
    last:'Last recorded price', agePill:a => `Recorded ${a}`, stale:a => `Recorded ${a}: it may have changed. Check the shelf.`, estBadge:'Estimate', estRough:'Rough estimate', est:'Estimated shelf price', notRecorded:'Not a recorded price', estNone:'No price is on record for this exact barcode.',
    estBasis:n => `Based on ${n} similar products with recorded Greek prices`, estBasisType:n => `Based on ${n} products of the same type with recorded Greek prices`, estPer:(u, b) => `about ${u}${b}`, perPack:'for this pack', how:'How is this estimated?',
    howBody:'The name, brand and pack size are compared with products that have a recorded Greek price (Ministry of Development price observatory and chain web shops). The range comes from the measured error of this method on products whose price is known.',
    valid:(m, n) => `On ${n} products with known prices the typical error was ${m}%.`, kinds:{close:'Very similar products', similar:'Similar products', broad:'Broadly similar products', rough:'Rough estimate: few close matches', typical:'Rough estimate: typical for this kind of product'}, sim:'match',
    none:'No verified price for this barcode', noneSub:'No supermarket price is on record for it yet, and no comparable priced products were found. That does not mean it is not sold.', elseLine:(c, p, s, d) => `Seen in ${c}: ${p} · ${s} · ${d}`},
  el:{eyebrow:'Τιμή σούπερ μάρκετ', facts:'Σύγκριση στοιχείων ετικέτας', hideFacts:'Απόκρυψη στοιχείων', moreOpts:n => `Εμφάνιση ${n} ακόμη`, show:'Εμφάνιση', hide:'Απόκρυψη', navPrices:'Τιμές', update:'Νέα έκδοση FoodScan διαθέσιμη.', reload:'Ανανέωση', cheapest:'Φθηνότερη τρέχουσα τιμή', condTitle:k => `Τρέχουσα ${k.toLowerCase()}`, offer:'προσφορά', checking:'Έλεγχος τιμών σούπερ μάρκετ…', na:'Δεν υπάρχει διαθέσιμη τιμή', allStores:'Όλα τα καταστήματα', seeAll:n => n > 1 ? `Δείτε όλες τις τιμές (${n})` : 'Δείτε όλες τις τιμές', addShort:'Προσθήκη τιμής',
    noData:'Δεν έχει καταγραφεί ακόμη τιμή για αυτό το barcode.', addOwn:'Προσθέστε μια τιμή που είδατε', lastSeen:'Τελευταία καταγραφή', notCurrent:'Όχι τρέχουσα τιμή',
    elsewhere:c => `Καταγραφή μόνο εκτός Ελλάδας (${c})`, down:'Οι τιμές δεν ελέγχθηκαν τώρα. Η βαθμολογία δεν επηρεάζεται.', retry:'Δοκιμάστε ξανά',
    of:(n, m) => n > 1 ? `Η χαμηλότερη από ${n} τιμές${m > 1 ? ` · ${m} αλυσίδες` : ''}` : 'Η μόνη τρέχουσα τιμή', upTo:x => `οι άλλες έως +${x}`,
    observed:'Καταγραφή', alsoCheaper:'Και φθηνότερο', perKgMore:x => `+${x}`, noPrice:'Τιμή μη διαθέσιμη', vsThis:'από αυτό', row:'Φθηνότερη τιμή', fresh:'Τρέχουσα', older:'Παλαιότερη', historical:'Ιστορική', expired:'Έληξε',
    receipt:'απόδειξη', photo:'φωτογραφία ραφιού', feed:'δεδομένα λιανοπωλητή', observatory:'επίσημη τιμή αλυσίδας', web:'τιμή e-shop αλυσίδας', online:'Τιμή e-shop', auto:'αυτόματη ακριβής αντιστοίχιση', shopper:'αναφορά καταναλωτή', basket:'e-katanalotis', chains:'Τιμές ανά αλυσίδα', national:'Πανελλαδική τιμή αλυσίδας', moreChains:n => `+${n} ακόμη`, card:'Τιμή με κάρτα', multi:'Τιμή πολυσυσκευασίας', cond:'Με όρους',
    condSub:(k, reg) => `${reg ? `Κανονική τιμή ${reg} · ` : ''}Δεν υπάρχει τρέχουσα τιμή χωρίς όρους`,
    partial:'Κάποιες πηγές τιμών δεν απάντησαν και οι υπόλοιπες δεν έχουν τιμή για αυτό το barcode.', notComparable:'Άλλη μονάδα · χωρίς σύγκριση', unitNote:'Μη συγκρίσιμο ανά κιλό/λίτρο',
    last:'Τελευταία καταγεγραμμένη τιμή', agePill:a => `Καταγράφηκε ${a}`, stale:a => `Καταγράφηκε ${a} και ίσως έχει αλλάξει. Ελέγξτε στο ράφι.`, estBadge:'Εκτίμηση', estRough:'Πρόχειρη εκτίμηση', est:'Εκτιμώμενη τιμή ραφιού', notRecorded:'Όχι καταγεγραμμένη τιμή', estNone:'Δεν υπάρχει καταγεγραμμένη τιμή για αυτό ακριβώς το barcode.',
    estBasis:n => `Βάσει ${n} παρόμοιων προϊόντων με καταγεγραμμένη τιμή στην Ελλάδα`, estBasisType:n => `Βάσει ${n} προϊόντων του ίδιου είδους με καταγεγραμμένη τιμή στην Ελλάδα`, estPer:(u, b) => `περίπου ${u}${b}`, perPack:'για αυτή τη συσκευασία', how:'Πώς γίνεται η εκτίμηση;',
    howBody:'Συγκρίνουμε το όνομα, τη μάρκα και τη συσκευασία με προϊόντα που έχουν καταγεγραμμένη ελληνική τιμή (Παρατηρητήριο Τιμών του Υπουργείου Ανάπτυξης και e-shop αλυσίδων). Το εύρος προκύπτει από το μετρημένο σφάλμα της μεθόδου σε προϊόντα με γνωστή τιμή.',
    valid:(m, n) => `Σε ${n} προϊόντα με γνωστή τιμή το τυπικό σφάλμα ήταν ${m}%.`, kinds:{close:'Πολύ παρόμοια προϊόντα', similar:'Παρόμοια προϊόντα', broad:'Σχετικά παρόμοια προϊόντα', rough:'Πρόχειρη εκτίμηση: λίγα κοντινά προϊόντα', typical:'Πρόχειρη εκτίμηση: τυπική τιμή για αυτό το είδος προϊόντος'}, sim:'ομοιότητα',
    none:'Δεν βρέθηκε επαληθευμένη τιμή', noneSub:'Δεν υπάρχει ακόμη καταγεγραμμένη τιμή σούπερ μάρκετ για αυτό το barcode και δεν βρέθηκαν συγκρίσιμα προϊόντα με τιμή. Δεν σημαίνει ότι το προϊόν δεν πωλείται.', elseLine:(c, p, s, d) => `Καταγραφή σε ${c}: ${p} · ${s} · ${d}`},
};
const lang = () => pageLang();
const tx = (k, ...a) => { const v = (T[lang()] || T.en)[k]; return typeof v === 'function' ? v(...a) : v; };
const pricesURL = code => '/prices/?barcode=' + encodeURIComponent(code);
const route = () => (location.hash.startsWith('#/') ? location.hash.slice(1) : location.pathname);
const productCode = () => route().match(/^\/p\/(\d{8}|\d{12,14})(?:[/?]|$)/)?.[1] || null;
const compareCodes = () => { const m = route().match(/^\/compare\/(\d{8,14})\/(\d{8,14})/); return m ? [m[1], m[2]] : null; };
// 78: every result carries the time it was read and expires with the device cache (10 min); v77 kept them for the whole session.
const results = new Map(), asked = new Set();
const keep = (code, r) => { results.set(code, {...r, readAt:Date.now()}); };
const want = (code, {fresh:force = false} = {}) => { if (!code) return null;
  const have = results.get(code);
  // A partial or failed answer is re-asked after one minute (not on every repaint); a complete one after 10 minutes.
  const life = have && (have.status === 'temporarily_unavailable' || have.status === 'incomplete') ? 60000 : TTL;
  if (have && !force && Date.now() - have.readAt < life) return have;
  if (have && !force && asked.has(code)) return have; // a request is already on its way
  if (!force) { const hit = peekPrices(code); if (hit) { keep(code, hit); return results.get(code); } }
  if (force) { forgetPrices(code); results.delete(code); }
  asked.add(code);
  getPrices(code, {fresh:force}).then(r => { keep(code, r); asked.delete(code); schedule(); }).catch(() => asked.delete(code)); return force ? null : have || null; };
const fresh = o => tx(o.freshness === 'current' ? 'fresh' : o.freshness);
const proof = o => o.id?.startsWith('pk:') ? tx('observatory') + (o.match === 'auto-exact' ? ' · ' + tx('auto') : '') : /^(?:bz|li):/.test(o.id || '') ? tx('web') : o.id?.startsWith('ek:') ? tx('basket') : o.sourceKind === 'licensed' ? tx('feed') : o.proofType === 'RECEIPT' || o.proofType === 'PRICE_TAG' ? tx('shopper') + ' · ' + tx(o.proofType === 'RECEIPT' ? 'receipt' : 'photo') : '';
const condLabel = o => o.conditional === 'LOYALTY_PROGRAM' ? tx('card') : o.conditional === 'QUANTITY' ? tx('multi') : tx('cond');
const where = o => esc(o.retailer) + (o.city ? ` · ${esc(o.city)}` : '');
/** One badge per chain: its cheapest current price (any source), cheapest first. Real offers only; a chain with no current
 *  price simply has no badge. */
function chainBadges(r) {
  const L = lang(), per = new Map();
  for (const o of r.offers) if (o.rankingEligible && o.retailerId && o.retailerId !== 'other') { const old = per.get(o.retailerId); if (!old || o.price < old.price) per.set(o.retailerId, o); }
  const list = [...per.values()].sort((a, b) => a.price - b.price);
  if (list.length < 2) return '';
  const shown = list.slice(0, 8), more = list.length - shown.length;
  return `<div class="fp72-chains" role="list" aria-label="${esc(tx('chains'))}">` + shown.map((o, i) => `<span role="listitem" class="fp72-chip${i === 0 ? ' is-best' : ''}" title="${esc(o.source)} · ${esc(dateText(o.date, L))}"><b>${esc(o.retailer)}</b>${esc(euro(o.price, L))}${o.discounted ? '<i>%</i>' : ''}</span>`).join('') + (more > 0 ? `<span class="fp72-chip fp72-chip--more">${esc(tx('moreChains', more))}</span>` : '') + '</div>';
}

/* ---------- product view: a compact price strip INSIDE the grade card ----------
 * 75: the strip is mounted inside article.gradecard, right under the grade, points and A–E scale, for every layout the app
 * renders (graded hero, grade on hold, no grade, catalogue snapshot, demo samples, live). 72 skipped demo samples
 * (?demo=1) and mounted after the card, so the price sat below a tall card or was missing. */
const fmtShort = (d, L) => new Intl.DateTimeFormat(L === 'el' ? 'el-GR' : 'en-GB', {day:'numeric', month:'short', timeZone:'UTC'}).format(new Date(d + 'T00:00:00Z'));
function chainRow(r, best) {
  const L = lang(), per = new Map();
  for (const o of r.offers) if (o.rankingEligible && o.retailerId && o.retailerId !== 'other') { const old = per.get(o.retailerId); if (!old || o.price < old.price) per.set(o.retailerId, o); }
  const list = [...per.values()].sort((a, b) => a.price - b.price);
  if (list.length < 2) return '';
  const shown = list.slice(0, 6), more = list.length - shown.length;
  return `<div class="fp75__chains" role="list" aria-label="${esc(tx('chains'))}">` + shown.map(o => `<span role="listitem" class="fp75__chip${o.retailerId === best.retailerId ? ' is-best' : ''}" title="${esc(o.source)} · ${esc(dateText(o.date, L))}"><b>${esc(o.retailer)}</b> ${esc(euro(o.price, L))}${o.discounted ? '<i>%</i>' : ''}</span>`).join('') + (more > 0 ? `<span role="listitem" class="fp75__chip fp75__chip--more">${esc(tx('moreChains', more))}</span>` : '') + '</div>';
}
const rangeText = (e, L) => e.pack ? `${euro(e.pack[0], L)} – ${euro(e.pack[2], L)}` : `${euro(e.unitLow, L)} – ${euro(e.unitHigh, L)}${t(L, e.unit)}`;
const elseLine = (r, L) => { const e = r.elsewhere?.[0]; return e ? `<p class="fp80-else">${esc(tx('elseLine', e.countryCode, euro(e.price, L), e.retailer, dateText(e.date, L)))}</p>` : ''; };
/** Estimate state of the strip: labelled, dashed, and worded so it can never be read as a recorded price. */
function estimateStrip(code, r, head, link) {
  const L = lang(), e = r.estimate;
  const per = `<em>${esc(tx('estPer', euro(e.unitMid, L), t(L, e.unit)))}${e.pack ? ' · ' + esc(tx('perPack')) : ''}</em>`;
  const ex = e.examples.map(x => `<li><span>${esc(x.name)}</span><b>${esc(euro(x.price, L))}</b><small>${esc(dateText(x.date, L))} · ${esc(tx('sim'))} ${x.similarity}%</small></li>`).join('');
  const v = e.validation && e.validation.medianErrorPct != null && e.validation.tested ? `<p class="fp80-valid">${esc(tx('valid', Math.round(e.validation.medianErrorPct), e.validation.tested))}</p>` : '';
  return `${head(`<span class="fp75__pill fp80-pill-est">${esc(tx(e.cls === 'D' || e.cls === 'E' ? 'estRough' : 'estBadge'))}</span>`)}
    <div class="fp75__main fp80-estmain"><div class="fp75__price fp80-est"><small>${esc(tx('est'))}</small><strong>${esc(rangeText(e, L))}</strong>${per}</div>
      <div class="fp75__store"><b>${esc(tx('notRecorded'))}</b><span>${esc(tx('estNone'))}</span><span>${esc(e.cls === 'E' ? tx('estBasisType', e.n) : tx('estBasis', e.n))}</span></div></div>
    <p class="fp80-kind">${esc(tx('kinds')[e.kind] || '')}</p>
    <details class="fp80-why"><summary>${esc(tx('how'))}${chev}</summary><p>${esc(tx('howBody'))}</p>${ex ? `<ul class="fp80-ex">${ex}</ul>` : ''}${v}</details>
    ${elseLine(r, L)}<footer class="fp75__foot">${link(tx('addOwn'))}</footer>`;
}
function stripHTML(code, r) {
  const L = lang();
  const head = pill => `<header class="fp75__head"><span class="fp75__eyebrow">${icon}${esc(tx('eyebrow'))}</span>${pill || ''}</header>`;
  const link = (label, cta) => `<a class="fp75__all${cta ? ' fp75__all--cta' : ''}" href="${pricesURL(code)}">${esc(label)}${chev}</a>`;
  if (!r) return `${head('')}<div class="fp75__skel" aria-hidden="true"><i class="fp75__sk fp75__sk--price"></i><span><i class="fp75__sk"></i><i class="fp75__sk fp75__sk--short"></i></span></div><p class="fp75__sr">${esc(tx('checking'))}</p>`;
  if (r.status === 'temporarily_unavailable') return `${head('')}<div class="fp75__none"><div><b>${esc(tx('na'))}</b><span>${esc(tx('down'))}</span></div><button type="button" class="fp75__all" data-fp71-retry="${esc(code)}">${esc(tx('retry'))}</button></div>`;
  if (r.status === 'incomplete' && !r.best && !r.latest) return `${head('')}<div class="fp75__none"><div><b>${esc(tx('na'))}</b><span>${esc(tx('partial'))}</span></div><button type="button" class="fp75__all" data-fp71-retry="${esc(code)}">${esc(tx('retry'))}</button></div>`;
  const b = r.best;
  if (b) {
    const total = r.offers.length + r.elsewhere.length;
    const sub = b.conditional ? esc(tx('condSub', condLabel(b), b.regularPrice ? euro(b.regularPrice, L) : '')) : esc(tx('of', r.currentCount, r.retailerCount)) + (r.spread > 0 ? ` · ${esc(tx('upTo', euro(r.spread, L)))}` : '');
    const scope = b.storeScope === 'national' ? tx('national') : b.storeScope === 'online' ? tx('online') : '';
    return `${head(`<span class="fp75__pill">${esc(fresh(b))}</span>`)}
      <div class="fp75__main"><div class="fp75__price"><strong>${esc(euro(b.price, L))}</strong>${b.unitPrice != null ? `<em>${esc(unitText(b, L))}</em>` : ''}</div>
        <div class="fp75__store"><b>${where(b)}</b><span>${esc(fmtShort(b.date, L))} · ${esc(whenText(b, L))}${b.discounted && !b.conditional ? ' · ' + esc(tx('offer')) : ''}</span><span class="fp75__src">${esc(scope || b.source)}</span></div></div>
      ${chainRow(r, b)}
      <footer class="fp75__foot"><span>${sub}</span>${link(tx('seeAll', total), true)}</footer>`;
  }
  // 80: no current price. Lead with the last recorded price (shown with its age), else a labelled estimate, else an explicit "no verified price".
  const last = r.latest;
  if (last) return `${head(`<span class="fp75__pill fp75__pill--stale">${esc(tx('agePill', whenText(last, L)))}</span>`)}
      <div class="fp75__main"><div class="fp75__price"><small class="fp80-lead">${esc(tx('last'))}</small><strong>${esc(euro(last.price, L))}</strong>${last.unitPrice != null ? `<em>${esc(unitText(last, L))}</em>` : ''}</div>
        <div class="fp75__store"><b>${where(last)}</b><span>${esc(fmtShort(last.date, L))} · ${esc(whenText(last, L))}</span><span class="fp75__src">${esc(last.storeScope === 'national' ? tx('national') : last.storeScope === 'online' ? tx('online') : last.source)}</span></div></div>
      <p class="fp80-stale">${esc(tx('stale', whenText(last, L)))}</p>${elseLine(r, L)}<footer class="fp75__foot">${link(tx('allStores'))}</footer>`;
  if (r.estimate) return estimateStrip(code, r, head, link);
  if (r.elsewhere?.length) return `${head('')}<div class="fp75__none"><div><b>${esc(tx('none'))}</b><span>${esc(tx('noneSub'))}</span></div></div>${elseLine(r, L)}<footer class="fp75__foot">${link(tx('addOwn'))}</footer>`;
  return `${head('')}<div class="fp75__none"><div><b>${esc(tx('none'))}</b><span>${esc(tx('noneSub'))}</span></div>${link(tx('addShort'))}</div>`;
}
/** Where the strip goes: inside the grade card, under the A–E scale (else the points row, else the verdict), so it is the
 *  next thing read after the grade. Falls back to under the product name when a layout has no grade card. */
function anchorOf(hero) {
  const card = hero.querySelector('article.gradecard, .gradecard');
  if (card) { const a = card.querySelector(':scope > .snip__scale') || card.querySelector(':scope > .snip__score') || card.querySelector(':scope > .snip__core');
    if (a) return {parent: card, after: a};
    const foot = card.querySelector(':scope > .snip__foot'); return {parent: card, before: foot || null}; }
  const prod = hero.querySelector('.hero__prod'); return prod ? {parent: hero, after: prod} : {parent: hero, before: null};
}
/** The barcode is not in Open Food Facts, so no grade card exists: the price (or estimate) is still the most useful thing to show. */
function paintStandalone(code, view) {
  const page = view.querySelector('#instant-calc')?.closest('.page'); if (!page) return;
  let box = page.querySelector(':scope > .fp75.fp80-standalone');
  if (box && box.dataset.code !== code) { box.remove(); box = null; }
  const r = results.get(code) || null, state = lang() + ':' + (r ? (r.status + ':' + (r.best?.id || r.latest?.id || '') + ':' + r.offers.length + ':' + (r.estimate ? r.estimate.cls + r.estimate.unitMid : '')) : 'wait');
  if (!box) { box = document.createElement('section'); box.className = 'fp75 fp80-standalone'; box.dataset.code = code; box.setAttribute('aria-live', 'polite'); page.prepend(box); }
  if (box.dataset.state === state) return;
  box.dataset.state = state; box.setAttribute('aria-label', tx('eyebrow')); box.setAttribute('aria-busy', r ? 'false' : 'true');
  box.classList.toggle('fp80-is-est', r?.lead?.kind === 'estimate'); box.classList.toggle('fp80-is-none', r?.lead?.kind === 'none');
  const name = r?.productName || r?.product?.name || '';
  box.innerHTML = (name ? `<p class="fp80-prod">${esc(name)}</p>` : '') + stripHTML(code, r);
}
function paintProduct() {
  const code = productCode();
  const view = document.querySelector('#view');
  // Remove strips left from another product, from the 72 layout, or duplicates.
  document.querySelectorAll('#view .fp71, #view .fp-price-bridge').forEach(n => n.remove());
  if (!code || !view) { view?.querySelectorAll('.fp75').forEach(n => n.remove()); return; }
  const hero = view.querySelector('article.hero');
  if (!hero) { paintStandalone(code, view); return; }
  view.querySelectorAll('.fp80-standalone').forEach(n => n.remove());
  if (!hero.textContent.includes(code)) return; // the old product is still on screen; the new one paints on the next mutation
  const at = anchorOf(hero);
  const all = [...view.querySelectorAll('.fp75')];
  let box = all.find(n => n.parentElement === at.parent && n.dataset.code === code) || null;
  all.forEach(n => { if (n !== box) n.remove(); });
  const r = results.get(code) || null, state = lang() + ':' + (r ? (r.status + ':' + (r.best?.id || r.latest?.id || '') + ':' + r.offers.length + ':' + (r.estimate ? r.estimate.cls + r.estimate.unitMid : '')) : 'wait');
  if (!box) { box = document.createElement('section'); box.className = 'fp75'; box.dataset.code = code; box.setAttribute('aria-live', 'polite'); }
  const placed = at.after ? at.after.nextElementSibling === box : (at.before ? at.before.previousElementSibling === box : at.parent.lastElementChild === box);
  if (!placed) { if (at.after) at.after.after(box); else at.parent.insertBefore(box, at.before); }
  if (box.dataset.state === state) return;
  box.dataset.state = state;
  box.setAttribute('aria-label', tx('eyebrow'));
  box.setAttribute('aria-busy', r ? 'false' : 'true');
  box.classList.toggle('fp75--has', Boolean(r?.best));
  box.classList.toggle('fp80-is-est', r?.lead?.kind === 'estimate');
  box.classList.toggle('fp80-is-none', r?.lead?.kind === 'none');
  box.classList.toggle('fp75--wait', !r);
  box.innerHTML = stripHTML(code, r);
}

/* ---------- Better choices ---------- */
function chipHTML(r, base) {
  const L = lang();
  if (!r) return `<span class="fp71c fp71c--wait">${icon}…</span>`;
  const b = r.best;
  if (!b && r.latest) { const o = r.latest; return `<span class="fp71c fp71c--old" title="${esc(o.retailer)} · ${esc(dateText(o.date, L))} · ${esc(o.source)}">${icon}<b>${esc(euro(o.price, L))}</b>${o.unitPrice != null ? `<small>${esc(unitText(o, L))}</small>` : ''}<small>${esc(tx('agePill', whenText(o, L)))}</small></span>`; }
  if (!b && r.estimate) return `<span class="fp71c fp71c--est" title="${esc(tx('notRecorded'))}">${icon}<b>≈ ${esc(rangeText(r.estimate, L))}</b><small>${esc(tx(r.estimate.cls === 'D' || r.estimate.cls === 'E' ? 'estRough' : 'estBadge'))}</small></span>`;
  if (!b) return `<span class="fp71c fp71c--na">${icon}${esc(tx('noPrice'))}</span>`;
  const d = unitDelta(base, r);
  // 78: a saving is claimed only when both prices are per kg or both per litre (unitDelta returns null otherwise).
  const nc = !d && base?.best && b ? `<span class="fp71c__d fp71c__d--nc">${esc(tx('notComparable'))}</span>` : '';
  const delta = d && !d.same ? (d.cheaper ? `<span class="fp71c__d fp71c__d--down">${esc(tx('alsoCheaper'))} · −${esc(euro(-d.diff, L))}${esc(t(L, d.basis))}</span>`
    : `<span class="fp71c__d fp71c__d--up">${esc(tx('perKgMore', euro(d.diff, L)))}${esc(t(L, d.basis))} ${esc(tx('vsThis'))}</span>`) : '';
  return `<span class="fp71c" title="${esc(b.retailer)} · ${esc(dateText(b.date, L))} · ${esc(b.source)}">${icon}<b>${esc(euro(b.price, L))}</b>${b.unitPrice != null ? `<small>${esc(unitText(b, L))}</small>` : ''}<small>${esc(b.retailer)}</small>${b.conditional ? `<small>${esc(condLabel(b))}</small>` : ''}</span>${delta}${nc}`;
}
function paintChoices() {
  const code = productCode(); if (!code) return;
  const base = results.get(code) || null;
  const cards = [...document.querySelectorAll('#view .card--swap .swap, #view .card--swap li.prow, #view .card--swap article.nutrition-option')].slice(0, 10);
  for (const card of cards) {
    const a = card.querySelector('a[href^="#/p/"]'); const alt = a?.getAttribute('href').match(/#\/p\/(\d{8,14})/)?.[1];
    if (!alt || alt === code) continue;
    const r = want(alt);
    const state = (r ? r.status + ':' + (r.best?.id || r.latest?.id || '') + ':' + (r.estimate ? r.estimate.cls + r.estimate.unitMid : '') : 'wait') + '|' + (base?.best?.id || '');
    let slot = card.querySelector('.fp71-slot');
    if (slot && slot.dataset.state === state) continue;
    if (!slot) {
      slot = document.createElement('span'); slot.className = 'fp71-slot';
      const host = card.querySelector('.swap__chips') || card.querySelector('.prow__text') || card.querySelector('a');
      if (card.matches('.nutrition-option')) (card.querySelector('.row-actions') || card.lastElementChild)?.before(slot); // "Compare nutrition" cards: the price sits above the buttons
      else host.append(slot);
    }
    slot.dataset.state = state; slot.innerHTML = chipHTML(r, base);
  }
}

/* ---------- Compare ---------- */
function paintCompare() {
  const codes = compareCodes(); if (!codes) return;
  const rs = codes.map(c => want(c));
  const L = lang();
  const heads = [...document.querySelectorAll('#view .vs2__head')];
  heads.forEach((h, i) => {
    const c = h.getAttribute('href')?.match(/#\/p\/(\d{8,14})/)?.[1]; const k = codes.indexOf(c); if (k < 0) return;
    const r = rs[k], other = rs[1 - k];
    const state = r ? r.status + ':' + (r.best?.id || r.latest?.id || '') + ':' + (r.estimate ? r.estimate.cls + r.estimate.unitMid : '') + '|' + (other?.best?.id || '') : 'wait';
    let s = h.querySelector('.fp71-slot');
    if (s && s.dataset.state === state) return;
    if (!s) { s = document.createElement('span'); s.className = 'fp71-slot fp71-slot--vs'; h.append(s); }
    s.dataset.state = state; s.innerHTML = chipHTML(r, null);
  });
  const table = document.querySelector('#view .cmpn__table'); if (!table) return;
  const order = [...table.querySelectorAll('thead th a[href^="#/p/"]')].map(a => a.getAttribute('href').match(/#\/p\/(\d{8,14})/)?.[1]);
  const state = rs.map(r => r ? r.status + ':' + (r.best?.id || r.latest?.id || '') + ':' + (r.estimate ? r.estimate.cls + r.estimate.unitMid : '') : 'wait').join('|');
  let row = table.querySelector('tr.fp71-row');
  if (row && row.dataset.state === state) return;
  if (!row) { row = document.createElement('tr'); row.className = 'fp71-row'; const first = table.querySelector('tbody tr'); first ? first.after(row) : table.querySelector('tbody')?.append(row); }
  const bests = order.map(c => rs[codes.indexOf(c)]?.best || null);
  const comparable = bests.every(b => b && b.unitPrice != null) && bests[0].unitBasis === bests[1].unitBasis && Boolean(bests[0].conditional) === Boolean(bests[1].conditional);
  const win = comparable ? (bests[0].unitPrice < bests[1].unitPrice ? 0 : bests[1].unitPrice < bests[0].unitPrice ? 1 : -1) : -1;
  row.dataset.state = state;
  const bothPriced = bests.every(Boolean);
  row.innerHTML = `<th scope="row">${esc(tx('row'))}${bothPriced && !comparable ? `<small class="fp71-nc">${esc(tx('unitNote'))}</small>` : ''}</th>` + order.map((c, i) => {
    const r = rs[codes.indexOf(c)], b = r?.best;
    if (!r) return '<td class="fp71-cell">…</td>';
    if (!b && r.latest) { const o = r.latest; return `<td class="fp71-cell fp71-cell--old"><a href="${pricesURL(c)}"><b>${esc(euro(o.price, L))}</b>${o.unitPrice != null ? `<small>${esc(unitText(o, L))}</small>` : ''}<small>${esc(o.retailer)} · ${esc(dateText(o.date, L))}</small></a></td>`; }
    if (!b && r.estimate) return `<td class="fp71-cell fp71-cell--est"><a href="${pricesURL(c)}"><b>≈ ${esc(rangeText(r.estimate, L))}</b><small>${esc(tx('estBadge'))}</small></a></td>`;
    if (!b) return `<td class="fp71-cell fp71-cell--na"><a href="${pricesURL(c)}">${esc(tx('na'))}</a></td>`;
    return `<td class="fp71-cell${i === win ? ' is-win' : ''}"><a href="${pricesURL(c)}"><b>${esc(euro(b.price, L))}</b>${b.unitPrice != null ? `<small>${esc(unitText(b, L))}</small>` : ''}<small>${esc(b.retailer)} · ${esc(dateText(b.date, L))}</small>${b.conditional ? `<small>${esc(condLabel(b))}</small>` : ''}</a></td>`;
  }).join('');
}

/* ---------- navigation (kept from 65) ---------- */
function addPricesLink() {
  const nav = document.querySelector('.top__nav');
  if (nav && !nav.querySelector('.fp-prices-link')) { const a = document.createElement('a'); a.className = 'fp-prices-link'; a.href = '/prices/'; a.textContent = tx('navPrices'); nav.insertBefore(a, nav.querySelector('[data-nav="demo"]') || null); }
  const dock = document.querySelector('.dock');
  if (dock && !dock.querySelector('.fp-dock-prices')) { const a = document.createElement('a'); a.className = 'fp-dock-prices'; a.href = '/prices/'; a.innerHTML = icon + `<span>${esc(tx('navPrices'))}</span>`; dock.insertBefore(a, dock.querySelector('[data-nav="me"]') || null); dock.classList.add('fp-dock-expanded'); }
  const code = productCode();
  for (const a of document.querySelectorAll('.fp-prices-link, .fp-dock-prices')) { a.href = code ? pricesURL(code) : '/prices/'; const l = tx('navPrices'), s = a.matches('.fp-dock-prices') ? a.querySelector('span') : a; if (s && s.textContent !== l) s.textContent = l; }
}


/* ---------- calmer product page (75) ----------
 * Secondary sections (how the grade was worked out, portions, sources, guides) start folded behind their heading;
 * comparison options show the product, kind and actions, with the full label table one tap away, and only the first
 * three options until "show more". Nothing is removed or moved: classes only, so the app's own re-renders stay intact. */
const FOLD = new Set(['why-title', 'portion-title', 'trust-title', 'gutf-comp-title']);
const openKey = id => 'fp75:open:' + id;
const isOpen = id => { try { return sessionStorage.getItem(openKey(id)) === '1'; } catch { return false; } };
const chevDown = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
function tidy() {
  if (!productCode()) return;
  for (const sec of document.querySelectorAll('#view section.card[aria-labelledby]')) {
    const id = sec.getAttribute('aria-labelledby'); if (!FOLD.has(id)) continue;
    const head = sec.querySelector(':scope > header.card__head'); if (!head) continue;
    let btn = head.querySelector(':scope > .fp75-fold__btn');
    if (!btn) { btn = document.createElement('button'); btn.type = 'button'; btn.className = 'fp75-fold__btn'; btn.innerHTML = chevDown; btn.setAttribute('aria-controls', id); head.append(btn);
      sec.classList.add('fp75-fold'); sec.classList.toggle('is-folded', !isOpen(id)); }
    const folded = sec.classList.contains('is-folded'), label = (folded ? tx('show') : tx('hide')) + ': ' + (document.getElementById(id)?.textContent.trim() || '');
    if (btn.getAttribute('aria-label') !== label) { btn.setAttribute('aria-label', label); btn.setAttribute('aria-expanded', String(!folded)); }
  }
  for (const list of document.querySelectorAll('#view .nutrition-options')) {
    const opts = [...list.querySelectorAll(':scope > .nutrition-option')];
    opts.forEach((o, i) => {
      if (!o.querySelector(':scope > .fp75-facts')) {
        const table = o.querySelector(':scope > table'); if (!table) return;
        o.classList.add('fp75-tight');
        const b = document.createElement('button'); b.type = 'button'; b.className = 'fp75-facts'; b.setAttribute('aria-expanded', 'false');
        b.innerHTML = `<span>${esc(tx('facts'))}</span>${chevDown}`; table.before(b);
      }
      if (!list.dataset.fp75All) o.classList.toggle('fp75-later', i >= 3);
    });
    let more = list.querySelector(':scope > .fp75-more');
    const hidden = list.dataset.fp75All ? 0 : Math.max(0, opts.length - 3);
    if (hidden && !more) { more = document.createElement('button'); more.type = 'button'; more.className = 'fp75-more'; list.append(more); }
    if (more) { if (!hidden) more.remove(); else { const l = tx('moreOpts', hidden); if (more.textContent !== l) more.textContent = l; } }
  }
}
document.addEventListener('click', e => {
  const head = e.target.closest?.('.fp75-fold > header.card__head');
  if (head && !e.target.closest('a, button:not(.fp75-fold__btn), input, select, summary')) {
    const sec = head.parentElement, id = sec.getAttribute('aria-labelledby'); const folded = !sec.classList.toggle('is-folded') ? false : true;
    try { sessionStorage.setItem(openKey(id), folded ? '0' : '1'); } catch {}
    tidy(); return;
  }
  const f = e.target.closest?.('.fp75-facts');
  if (f) { const o = f.closest('.nutrition-option'); const open = o.classList.toggle('is-open'); f.setAttribute('aria-expanded', String(open)); f.querySelector('span').textContent = open ? tx('hideFacts') : tx('facts'); return; }
  const m = e.target.closest?.('.fp75-more');
  if (m) { const list = m.parentElement; list.dataset.fp75All = '1'; list.querySelectorAll('.fp75-later').forEach(o => o.classList.remove('fp75-later')); m.remove(); }
});

/* The grade word ("Εξαιρετικό") is one long word in Greek: shrink it to its column instead of letting it run under the seal. */
function fitVerdict() {
  for (const el of document.querySelectorAll('#view .snip__verdict > strong')) {
    const box = el.parentElement.clientWidth; if (!box) continue;
    const cur = parseFloat(getComputedStyle(el).fontSize), base = Number(el.dataset.fp75Fs) || cur;
    if (!el.dataset.fp75Fs) el.dataset.fp75Fs = String(cur);
    const r = document.createRange(); r.selectNodeContents(el); const w = r.getBoundingClientRect().width; if (!w) continue;
    const natural = w * base / cur, target = Math.max(18, Math.min(base, base * box / natural * 0.97));
    if (Math.abs(target - cur) > 0.5) el.style.fontSize = target >= base ? '' : target.toFixed(1) + 'px';
  }
}
addEventListener('resize', () => { try { fitVerdict(); } catch {} });
document.fonts?.ready?.then(() => { try { fitVerdict(); } catch {} });

let timer = 0;
/** A long product name is clamped to three lines and a smaller size, so it stays inside the grade card. */
function longNames() { document.querySelectorAll('#view .hero__name h1').forEach(h => { const long = h.textContent.trim().length > 26; if (h.classList.contains('fs80-long') !== long) { h.classList.toggle('fs80-long', long); if (long) h.title = h.textContent.trim(); } }); }
function paint() { timer = 0; addPricesLink(); want(productCode()); compareCodes()?.forEach(c => want(c)); paintProduct(); paintChoices(); paintCompare(); try { tidy(); fitVerdict(); longNames(); } catch {} }
function schedule() { if (!timer) timer = setTimeout(paint, 60); }
// 78: arriving at a product straight from the scanner is a rescan: ask every source again (device and edge copies skipped).
let lastRoute = route();
function onRoute() {
  const now = route(), fromScan = /^\/(?:scan|s)(?:[/?]|$)/.test(lastRoute) && now !== lastRoute; lastRoute = now;
  want(productCode(), {fresh:fromScan && Boolean(productCode())}); compareCodes()?.forEach(c => want(c)); schedule();
}
document.addEventListener('click', e => {
  const b = e.target.closest?.('[data-fp71-retry]'); if (!b) return;
  want(b.dataset.fp71Retry, {fresh:true}); schedule();
});
function start() {
  const host = document.getElementById('app');
  if (host) new MutationObserver(schedule).observe(host, {childList:true, subtree:true});
  addEventListener('hashchange', onRoute); addEventListener('popstate', onRoute);
  onRoute();
}
onRoute(); // the request leaves now, in parallel with the app's own product lookup
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true}); else start();

/* ---------- updates (75): a stale service worker must never keep an old build on a phone ----------
 * sw.js now activates new builds immediately (skipWaiting + clients.claim). When the controlling worker changes to a
 * different build, the page reloads itself if it is in the background or idle on a non-input route; otherwise it shows a
 * small refresh bar so a scan or typing is never interrupted. */
export const BUILD = 'foodscan-80.0.0';
function updateBar() {
  if (document.querySelector('.fp75-update')) return;
  const bar = document.createElement('div'); bar.className = 'fp75-update'; bar.setAttribute('role', 'status');
  bar.innerHTML = `<span>${esc(tx('update'))}</span><button type="button">${esc(tx('reload'))}</button>`;
  bar.querySelector('button').addEventListener('click', () => location.reload());
  document.body.append(bar);
}
function onNewBuild() {
  const busy = /^\/(?:scan|s)(?:[/?]|$)/.test(route()) || document.activeElement?.matches?.('input, textarea, select');
  if (document.visibilityState === 'hidden' || !busy) location.reload(); else updateBar();
}
if ('serviceWorker' in navigator) {
  const sw = navigator.serviceWorker; let handled = false;
  const ask = w => new Promise(res => { if (!w) return res(null); const ch = new MessageChannel(); const to = setTimeout(() => res(null), 1500);
    ch.port1.onmessage = e => { clearTimeout(to); res(e.data?.build || null); }; try { w.postMessage({type:'GET_BUILD'}, [ch.port2]); } catch { res(null); } });
  sw.addEventListener('controllerchange', async () => {
    if (handled) return; const b = await ask(sw.controller);
    if (b && b.startsWith(BUILD)) return; // this page already runs the new build
    handled = true; onNewBuild();
  });
  // Check for a newer build when the app comes back to the foreground.
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sw.getRegistration().then(r => r?.update()).catch(() => {}); });
}
