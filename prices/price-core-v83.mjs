/* FoodScan price core 83 (from 78/80): worldwide. A price keeps the currency and country it was recorded in; the shopper's market decides which ones can rank.
 * (78, from 72/75): shared by the scan view, Better choices, Compare and the Prices page.
 * Evidence only. A price is shown only when it is a real observation with a source, a store and a date.
 * Nothing here can create a price: every function filters, sorts or formats prices it was given. */
export const PRICE_VERSION = 83; // answers from older price engines are refused (v78 and before did not carry the estimate field and used a 30-day window)
export const CURRENT_DAYS = 7, OLDER_DAYS = 90; // 80: a recorded price is 'current' for 7 days; older ones stay visible as the last recorded price, with their age
const DAY = 86400000;
import { money } from './market-v83.mjs';
/** The market this answer is for (set by checkPayload / fromOpenPrices): 'GR' keeps the Greek rules (Athens calendar, Greek chains). */
let HOME = 'GR', CURRENCY = 'EUR';
export const marketContext = () => ({home:HOME, currency:CURRENCY});
export const setMarketContext = (home, currency) => { HOME = /^[A-Z]{2}$/.test(String(home || '')) ? home : 'GR'; CURRENCY = /^[A-Z]{3}$/.test(String(currency || '')) ? currency : 'EUR'; };
/** Currencies whose everyday prices are big numbers (same list as the worker). */
const HIGH = new Set(['JPY','KRW','IDR','VND','CLP','COP','PYG','UGX','TZS','KHR','LAK','MMK','IQD','IRR','LBP','SYP','UZS','MNT','XOF','XAF','RWF','MGA','HUF','ISK','PKR','NGN','KZT','AMD','HTG','CRC','ARS','XPF']);
const RESTRICTED = new Set(['LOYALTY_PROGRAM', 'QUANTITY', 'PICK_IT_YOURSELF', 'EXPIRES_SOON', 'SECOND_HAND']);
const EUROZONE = new Set('AD AT AX BE BG BL CY DE EE ES FI FR GF GP GR HR IE IT LT LU LV MC ME MF MQ MT NL PM PT RE SI SK SM VA XK YT'.split(' '));
const KINDS = new Set(['community', 'licensed', 'official', 'retailer', 'personal']);

export const isoDate = s => {
  if (typeof s !== 'string') return null;
  const d = s.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const ms = Date.parse(d + 'T00:00:00Z');
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === d ? d : null;
};
/** Today in Greece (Europe/Athens) as YYYY-MM-DD: observation dates are Greek calendar days. */
export const todayAthens = (now = Date.now()) => { try { return new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Athens', year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date(now)); } catch { return new Date(now + 2 * 3600000).toISOString().slice(0, 10); } };
/** 78: signed age in days, never clamped. A future date is negative and checkOffer drops it. */
/** 83: outside Greece the reference day is UTC and a price dated exactly one day ahead (a shop east of UTC) counts as today; two or more days ahead stays negative and is rejected. */
export const todayFor = (market = HOME, now = Date.now()) => market === 'GR' ? todayAthens(now) : new Date(now).toISOString().slice(0, 10);
export const ageDays = (date, now = Date.now(), market = HOME) => { const d = isoDate(date); if (!d) return null;
  const age = Math.round((Date.parse(todayFor(market, now) + 'T00:00:00Z') - Date.parse(d + 'T00:00:00Z')) / DAY); return market !== 'GR' && age === -1 ? 0 : age; };
export const freshnessOf = age => age === null ? null : age <= CURRENT_DAYS ? 'current' : age <= OLDER_DAYS ? 'older' : 'historical';
export const validBarcode = s => {
  s = String(s || '');
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(s) || /^0+$/.test(s)) return false;
  let t = 0; for (let i = s.length - 2, w = 3; i >= 0; i--, w = 4 - w) t += Number(s[i]) * w;
  return (10 - t % 10) % 10 === Number(s.at(-1));
};
const text = (v, n = 120) => typeof v === 'string' ? v.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, n) : '';
const num = v => typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && /^\d+(?:[.,]\d+)?$/.test(v.trim()) ? Number(v.trim().replace(',', '.')) : null;
const httpsURL = v => { try { const u = new URL(v); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; } };
const key14 = c => String(c).padStart(14, '0');

/** Greek chains, as in the worker (FS_PRICE_CHAINS). Used to group stores and fill the chain grid. */
export const CHAINS = [
  ['ab', 'AB Βασιλόπουλος', /(?:^|\b)(?:ab vassilopoulos|ab vasilopoulos|ab basilopoulos|abvassilopoulos|alfa beta|alpha beta|αβ)(?:\b|$)|(?:αβ\s*βασιλ|αλφα\s*βητα|άλφα\s*βήτα|βασιλοπουλ|βασιλόπουλ)/i],
  ['sklavenitis', 'Σκλαβενίτης', /sklavenit|σκλαβενιτ|σκλαβενίτ/i], ['lidl', 'Lidl', /\blidl\b|λιντλ|λίντλ/i], ['mymarket', 'My market', /my\s*market|my\s*μάρκετ|mymarket/i],
  ['masoutis', 'Μασούτης', /masout|μασουτ|μασούτ/i], ['kritikos', 'Κρητικός', /kritikos|κρητικο[σς]|κρητικό[σς]/i], ['galaxias', 'Γαλαξίας', /galaxias|γαλαξια|γαλαξία/i],
  ['marketin', 'Market In', /market\s*in|μαρκετ\s*ιν/i], ['synka', 'ΣΥΝΚΑ', /\bsynka\b|συνκα|σύνκα/i], ['chalkiadakis', 'Χαλκιαδάκης', /chalkiad|xalkiad|χαλκιαδακ|χαλκιαδάκ/i],
  ['bazaar', 'Bazaar', /\bbazaar\b|μπαζαρ|μπαζάρ/i], ['discount-markt', 'Discount Markt', /discount\s*markt/i],
];
export const retailerOf = name => { for (const [id, label, re] of CHAINS) if (re.test(name)) return {id, label}; return {id:'other', label:name}; };


/** "450 g" -> {amount:.45, unit:'kg'}; "6 x 330 ml" -> {amount:1.98, unit:'l'}; null if unclear. */
export function packFromQuantity(quantity, amount, unit) {
  const conv = (v, u) => { u = String(u || '').toLowerCase(); const n = Number(String(v).replace(',', '.')); if (!(n > 0)) return null;
    return u === 'kg' ? {amount:n, unit:'kg'} : u === 'g' || u === 'gr' ? {amount:n / 1000, unit:'kg'} : u === 'l' || u === 'lt' ? {amount:n, unit:'l'} :
      u === 'ml' ? {amount:n / 1000, unit:'l'} : u === 'cl' ? {amount:n / 100, unit:'l'} : null; };
  const q = text(quantity, 60);
  const multi = q.match(/(\d{1,3})\s*[x×*]\s*(\d+(?:[.,]\d+)?)\s*(kg|gr|g|ml|cl|lt|l)\b/i);
  let out = multi ? conv(multi[2], multi[3]) : null;
  if (out) out = {amount:out.amount * Number(multi[1]), unit:out.unit};
  if (!out) { const one = q.match(/(\d+(?:[.,]\d+)?)\s*(kg|gr|g|ml|cl|lt|l)\b/i); if (one) out = conv(one[1], one[2]); }
  if (!out && amount != null) out = conv(amount, unit);
  if (!out || out.amount < 0.005 || out.amount > 50) return null;
  return {amount:Math.round(out.amount * 10000) / 10000, unit:out.unit};
}
export function unitPriceOf(offer, pack) {
  if (offer.basis === 'kg' || offer.basis === 'l') return {unitPrice:offer.price, unitBasis:offer.basis};
  if (offer.basis === 'item' && pack && pack.amount > 0) return {unitPrice:Math.round(offer.price / pack.amount * 100) / 100, unitBasis:pack.unit};
  return {unitPrice:null, unitBasis:null};
}

/** Re-checks one offer from the server (or a cache) against today's date. Anything without evidence is dropped. */
export function checkOffer(o, pack, now = Date.now()) {
  if (!o || typeof o !== 'object') return null;
  if (o.estimated || o.synthetic || o.benchmark || o.modelled) return null;
  const id = text(o.id, 200);
  if (!/^(?:op|lf|pk|ek|bz|li|ws|note):/.test(id)) return null;
  const kind = o.sourceKind || (id.startsWith('op:') ? 'community' : id.startsWith('lf:') ? 'licensed' : /^(?:pk|ek):/.test(id) ? 'official' : /^(?:bz|li|ws):/.test(id) ? 'retailer' : 'personal');
  if ((kind === 'official') !== /^(?:pk|ek):/.test(id)) return null; // an official label only on an official-source id
  if ((kind === 'retailer') !== /^(?:bz|li|ws):/.test(id)) return null;   // a web-shop label only on a web-shop id (73; li: = lidl.gr, 74)
  if (!KINDS.has(kind)) return null;
  const price = num(o.price);
  const currency = /^[A-Z]{3}$/.test(String(o.currency || '')) ? String(o.currency) : (o.currency ? null : CURRENCY); // 83: any ISO 4217 currency, kept as recorded
  if (!currency || !(price > 0 && price < (HIGH.has(currency) ? 1e7 : 10000))) return null;
  const date = isoDate(o.date); if (!date) return null;
  const store = text(o.storeName || o.retailer, 120), source = text(o.source, 80);
  if (!store || !source) return null;
  const countryCode0 = text(o.countryCode, 10).toUpperCase() || 'UNKNOWN';
  const age = ageDays(date, now, countryCode0 === 'UNKNOWN' ? HOME : countryCode0); if (age < 0) return null; // 78: future-dated observations are rejected
  const expired = Boolean(o.validUntil && isoDate(o.validUntil) && isoDate(o.validUntil) < todayFor(countryCode0 === 'UNKNOWN' ? HOME : countryCode0, now)) || o.freshness === 'expired';
  const freshness = expired ? 'expired' : freshnessOf(age);
  const countryCode = text(o.countryCode, 10).toUpperCase() || 'UNKNOWN';
  const basis = ['item', 'kg', 'l'].includes(o.basis) ? o.basis : 'item';
  const conditional = RESTRICTED.has(String(o.discountType || '').toUpperCase());
  const out = {
    ...o, id, price:Math.round(price * 100) / 100, currency, basis, date, ageDays:age, freshness, countryCode, sourceKind:kind,
    storeName:store, retailer:text(o.retailer, 100) || store, source, city:text(o.city, 60),
    match:['reviewed', 'auto-exact', 'barcode', 'user-confirmed', 'community-confirmed'].includes(o.match) ? o.match : null,
    sourceURL:httpsURL(o.sourceURL), proofURL:httpsURL(o.proofURL) || null, evidenceURL:httpsURL(o.evidenceURL) || null,
    // 78: personal notes never rank; community (Open Prices) prices rank only with a proof; a suspect observatory link never ranks.
    rankingEligible:o.rankingEligible !== false && kind !== 'personal' && !id.startsWith('note:') && countryCode === HOME && currency === CURRENCY && !o.suspect && !o.otherCurrency && freshness === 'current' && basis === 'item' && !conditional
      && (kind !== 'community' || Boolean(o.proofType)) && !o.packMismatch,
  };
  // 82: a price for another pack size gets its unit price from the pack actually observed, never from this barcode's label
  const seen = o.packMismatch && o.observedPack && ['kg', 'l'].includes(o.observedPack.unit) && num(o.observedPack.amount) > 0 ? {unit:o.observedPack.unit, amount:num(o.observedPack.amount)} : null;
  return {...out, ...unitPriceOf(out, seen || pack)};
}
const order = (a, b) => Number(b.rankingEligible) - Number(a.rankingEligible) || (a.rankingEligible ? a.price - b.price : 0) || b.date.localeCompare(a.date) || a.price - b.price;

/** A price answer the UI can trust. Older engines (v70 and before, which invented prices) are refused outright. */
export function checkPayload(p, now = Date.now()) {
  if (!p || typeof p !== 'object' || !(Number.parseInt(p.version, 10) >= PRICE_VERSION)) return null;
  const barcode = String(p.barcode || '');
  if (!validBarcode(barcode)) return null;
  // 83: the answer says which market (country) and currency it is for; offers of that market can rank, the rest are "elsewhere".
  setMarketContext(/^[A-Z]{2}$/.test(String(p.country || '')) ? p.country : 'GR', p.currency);
  const home = HOME;
  const product = p.product && typeof p.product === 'object' ? {name:text(p.product.name), brand:text(p.product.brand, 60), quantity:text(p.product.quantity, 40), image:httpsURL(p.product.image)} : null;
  const pack = p.pack && p.pack.amount > 0 && ['kg', 'l'].includes(p.pack.unit) ? {amount:Number(p.pack.amount), unit:p.pack.unit} : packFromQuantity(product?.quantity);
  const offers = (Array.isArray(p.offers) ? p.offers : []).map(o => checkOffer(o, pack, now)).filter(o => o && o.countryCode === home).sort(order);
  const elsewhere = (Array.isArray(p.elsewhere) ? p.elsewhere : []).map(o => checkOffer(o, pack, now)).filter(o => o && o.countryCode !== home && o.freshness !== 'historical')
    .map(o => ({...o, rankingEligible:false})).sort((a, b) => b.date.localeCompare(a.date));
  // 'incomplete' (78): some sources did not answer and the others had nothing. Never shown as a definite "no price".
  const status = ['observations_available', 'estimate_only', 'no_data', 'incomplete', 'temporarily_unavailable'].includes(p.status) ? p.status : 'no_data';
  // 81: no estimated price is ever shown, whatever an older or remote engine sends. Close products with their OWN recorded prices may be listed.
  const estimate = null;
  const related = (Array.isArray(p.related) ? p.related : []).slice(0, 20).map(x => ({name:text(x?.name, 90), price:num(x?.price), source:text(x?.source, 30), date:isoDate(x?.date), similarity:Math.min(100, Math.max(0, Math.round(num(x?.similarity) || 0)))}))
    .filter(x => x.name && x.price > 0 && x.price < 5000 && x.date && x.similarity >= 55).slice(0, 3);
  // 82: same-brand observatory products the shopper may confirm as this one, and the confirmation the answer was built with.
  const packOf = q => q && ['kg', 'l', 'pcs'].includes(q.unit) && num(q.amount) > 0 ? {unit:q.unit, amount:num(q.amount)} : null;
  const candidates = (Array.isArray(p.candidates) ? p.candidates : []).slice(0, 4).map(x => ({id:/^[0-9a-f]{32}$/.test(String(x?.id || '')) ? String(x.id) : '', name:text(x?.name, 90), chains:Math.max(0, Math.round(num(x?.chains) || 0)), date:isoDate(x?.date), similarity:Math.min(100, Math.max(0, Math.round(num(x?.similarity) || 0))), pack:packOf(x?.pack)}))
    .filter(x => x.id && x.name);
  const c = p.confirmed && typeof p.confirmed === 'object' && /^[0-9a-f]{32}$/.test(String(p.confirmed.id || '')) ? p.confirmed : null;
  const confirmed = c ? {id:String(c.id), name:text(c.name, 120), offers:Math.max(0, Math.round(num(c.offers) || 0)), status:['ok', 'no_prices', 'not_found', 'unavailable'].includes(c.status) ? c.status : 'unavailable'} : null;
  // 91: a link shared by shoppers (2+ independent confirmations)
  const cm = p.community && typeof p.community === 'object' && /^[0-9a-f]{32}$/.test(String(p.community.id || '')) ? p.community : null;
  const community = cm ? {id:String(cm.id), name:text(cm.name, 120), confirmations:Math.max(0, Math.min(999, Math.round(num(cm.confirmations) || 0))), offers:Math.max(0, Math.round(num(cm.offers) || 0))} : null;
  // 83: the typical price of this barcode in this market (median of at least 3 stores' unconditional prices, last 90 days), re-checked here.
  const ty = p.summary?.typical, typical = ty && num(ty.price) > 0 && num(ty.low) > 0 && num(ty.high) >= num(ty.low) && Math.round(num(ty.n) || 0) >= 3 && /^[A-Z]{3}$/.test(String(ty.currency || ''))
    ? {price:num(ty.price), low:num(ty.low), high:num(ty.high), n:Math.round(num(ty.n)), retailers:Math.round(num(ty.retailers) || 0), windowDays:Math.round(num(ty.windowDays) || 90), currency:ty.currency, newest:isoDate(ty.newest)} : null;
  const market = {code:home, currency:CURRENCY, source:['choice', 'network', 'default'].includes(p.market?.source) ? p.market.source : 'default'};
  return summarize({barcode, home, currency:CURRENCY, market, typical, product, productName:text(p.productName, 200), pack, offers, elsewhere, estimate, related, candidates, confirmed, community, providers:p.providers || {}, data:p.data && typeof p.data === 'object' ? p.data : null,
    status:offers.length || elsewhere.length ? 'observations_available' : estimate ? 'estimate_only' : status === 'observations_available' || status === 'estimate_only' ? 'no_data' : status,
    checkedAt:text(p.checkedAt, 40), transport:text(p.transport, 40)});
}
export function summarize(r) {
  const current = r.offers.filter(o => o.rankingEligible);
  let best = current.slice().sort((a, b) => a.price - b.price || b.date.localeCompare(a.date))[0] || null;
  // No unconditional current price: show the cheapest current loyalty-card / multi-buy price, clearly marked as conditional.
  if (!best) {
    const cond = r.offers.filter(o => o.countryCode === (r.home || HOME) && !o.suspect && !o.otherCurrency && o.freshness === 'current' && o.basis === 'item' && o.sourceKind !== 'personal' && RESTRICTED.has(String(o.discountType || '').toUpperCase()))
      .sort((a, b) => a.price - b.price || b.date.localeCompare(a.date))[0];
    if (cond) best = {...cond, conditional:String(cond.discountType).toUpperCase()};
  }
  // The most recent recorded Greek price of THIS barcode, any age. A price the worker tied to another pack size (or could not tie to this pack) is not "the price of this product".
  const sameProduct = o => !o.suspect && !o.otherCurrency && !o.packMismatch && !o.packUnconfirmed && o.tier !== 'otherSize' && o.tier !== 'packUnconfirmed' && o.sourceKind !== 'personal' && o.basis === 'item' && o.freshness !== 'expired';
  const latest = r.offers.filter(sameProduct).sort((a, b) => b.date.localeCompare(a.date) || a.price - b.price)[0] || null;
  const latestAny = r.offers.slice().sort((a, b) => b.date.localeCompare(a.date))[0] || null;
  const retailers = new Set(current.map(o => o.retailer.toLowerCase()));
  const spread = current.length > 1 && best && !best.conditional ? Math.round((Math.max(...current.map(o => o.price)) - best.price) * 100) / 100 : 0;
  // What the price card leads with, in order of evidence: a current price, the last recorded price (with its age), a labelled estimate, nothing.
  const lead = best ? {kind:'current', offer:best} : latest ? {kind:latest.freshness === 'older' ? 'older' : 'historical', offer:latest} : r.estimate ? {kind:'estimate', estimate:r.estimate} : {kind:'none'};
  return {...r, best, latest, latestAny, lead, currentCount:current.length, retailerCount:retailers.size, spread};
}

export const CLASS_NAME = {A:'close', B:'similar', C:'broad', D:'rough', E:'typical'};
/** An estimate is accepted only if its numbers are consistent. It is never an offer. */
export function checkEstimate(e) {
  if (!e || typeof e !== 'object') return null;
  const unit = ['kg', 'l', 'pcs'].includes(e.unit) ? e.unit : null;
  const lo = num(e.unitLow), mid = num(e.unitMid), hi = num(e.unitHigh);
  if (!unit || !(lo > 0 && mid >= lo && hi >= mid) || hi > 2000) return null;
  const cls = ['A', 'B', 'C', 'D', 'E'].includes(e.cls) ? e.cls : null; if (!cls) return null;
  const n = Math.round(num(e.n) || 0); if (n < 2 || n > 5000) return null;
  const pack = Array.isArray(e.pack) && e.pack.length === 3 ? e.pack.map(num) : null;
  const packOK = pack && pack.every(v => v > 0 && v < 5000) && pack[0] <= pack[1] && pack[1] <= pack[2] ? pack.map(v => Math.round(v * 100) / 100) : null;
  const examples = (Array.isArray(e.examples) ? e.examples : []).slice(0, 3).map(x => ({name:text(x?.name, 90), price:num(x?.price), source:text(x?.source, 30), date:isoDate(x?.date), similarity:Math.min(100, Math.max(0, Math.round(num(x?.similarity) || 0)))}))
    .filter(x => x.name && x.price > 0 && x.date);
  return {unit, unitLow:Math.round(lo * 100) / 100, unitMid:Math.round(mid * 100) / 100, unitHigh:Math.round(hi * 100) / 100, pack:packOK, n, cls, kind:CLASS_NAME[cls], category:text(e.category, 60), examples,
    validation:e.validation && typeof e.validation === 'object' ? {medianErrorPct:num(e.validation.medianErrorPct), coverage80:num(e.validation.coverage80), tested:num(e.validation.tested)} : null, builtAt:isoDate(e.builtAt)};
}

/** Direct Open Prices fallback (same rules as the worker), used only when FoodScan's own price service cannot answer. */
export function fromOpenPrices(items, barcode, now = Date.now(), quantityHint = '', market = '', currencyHint = '') {
  const home = /^[A-Z]{2}$/.test(String(market || '')) ? market : 'GR';
  const currency = /^[A-Z]{3}$/.test(String(currencyHint || '')) ? currencyHint : (home === 'GR' || EUROZONE.has(home) ? 'EUR' : '');
  setMarketContext(home, currency || 'EUR');
  const rows = [], seen = new Set();
  let sample = null;
  for (const i of Array.isArray(items) ? items : []) {
    if (!i || seen.has(i.id) || (i.type && i.type !== 'PRODUCT') || !/^[A-Z]{3}$/.test(String(i.currency || '')) || i.duplicate_of != null || i.proof?.draft === true) continue;
    seen.add(i.id);
    const code = i.product_code ?? i.product?.code;
    if (!code || key14(code) !== key14(barcode) || !(Number(i.id) > 0)) continue;
    const l = i.location || {};
    const name = text(l.osm_brand || l.osm_name || '', 100);
    if (!name) continue;
    const cc = text(l.osm_address_country_code || '', 4).toUpperCase();
    const country = l.type === 'ONLINE' ? 'UNKNOWN' : cc === 'EL' ? 'GR' : /^[A-Z]{2}$/.test(cc) ? cc : 'UNKNOWN';
    const dt = String(i.discount_type || '').toUpperCase();
    const file = String(i.proof?.file_path || '');
    sample = sample || i.product;
    rows.push({
      id:'op:' + Number(i.id), barcode, price:num(i.price), currency:i.currency, date:i.date, validUntil:null,
      basis:i.price_per === 'KILOGRAM' ? 'kg' : i.price_per === 'LITER' ? 'l' : 'item',
      regularPrice:num(i.price_without_discount), discounted:i.price_is_discounted === true || Boolean(dt), discountType:dt,
      offerConditions:RESTRICTED.has(dt) ? dt : '', countryCode:country, retailer:home === 'GR' ? retailerOf(name).label : name, retailerId:home === 'GR' ? retailerOf(name).id : (name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'other'), storeName:text(l.osm_name || name),
      storeId:Number(l.id ?? i.location_id) > 0 ? 'op-location:' + Number(l.id ?? i.location_id) : 'op-price:' + Number(i.id), city:text(l.osm_address_city || '', 60),
      proofType:/^[A-Z_]{3,30}$/.test(String(i.proof?.type || '')) ? i.proof.type : null,
      source:'Open Prices', sourceKind:'community', sourceLicense:'ODbL (Open Prices, Open Food Facts)', sourceURL:`https://prices.openfoodfacts.org/prices/${Number(i.id)}`,
      proofURL:/^(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:jpe?g|png|webp)$/i.test(file) ? `https://prices.openfoodfacts.org/img/${file}` : null,
      latitude:num(l.osm_lat), longitude:num(l.osm_lon),
    });
  }
  const pack = packFromQuantity(quantityHint || sample?.quantity, sample?.product_quantity, sample?.product_quantity_unit);
  const dedupe = list => { const m = new Map(); for (const o of list) { const k = o.storeId + '|' + o.basis, old = m.get(k); if (!old || o.date > old.date) m.set(k, o); } return [...m.values()]; };
  const checked = rows.map(o => checkOffer(o, pack, now)).filter(Boolean);
  const offers = dedupe(checked.filter(o => o.countryCode === home)).sort(order);
  const elsewhere = dedupe(checked.filter(o => o.countryCode !== home && o.freshness !== 'historical')).map(o => ({...o, rankingEligible:false})).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
  return summarize({barcode, home, currency:CURRENCY, market:{code:home, currency:CURRENCY, source:'choice'}, typical:null, product:sample?.product_name ? {name:text(sample.product_name), brand:text(sample.brands || '', 60), quantity:text(sample.quantity || '', 40), image:''} : null,
    productName:text(sample?.product_name || ''), pack, offers, elsewhere, estimate:null, providers:{openPrices:{status:offers.length || elsewhere.length ? 'ok_with_data' : 'ok_empty', inspected:rows.length}},
    // Only Open Prices was asked (FoodScan's own service did not answer): an empty answer is incomplete, not "no data".
    status:offers.length || elsewhere.length ? 'observations_available' : 'incomplete', checkedAt:new Date(now).toISOString(), transport:'browser_open_prices'});
}

/** Cheapest current price per chain, keeping each chain's best branch (storeId) and how many observations it has. */
export function cheapestPerChain(offers) {
  const per = new Map();
  for (const o of offers || []) { if (!o.rankingEligible || !o.retailerId || o.retailerId === 'other') continue;
    const c = per.get(o.retailerId); if (!c) per.set(o.retailerId, {...o, observations:1}); else { c.observations++; if (o.price < c.price) per.set(o.retailerId, {...o, observations:c.observations}); } }
  return [...per.values()].sort((a, b) => a.price - b.price);
}
/** Two products' cheapest current Greek prices, compared per kg or litre. Null unless both are comparable
 *  (both have a unit price on the same basis, and neither or both are conditional offers). No saving is claimed otherwise. */
export function unitDelta(mine, theirs) {
  const a = mine?.best, b = theirs?.best;
  if (!a || !b || a.unitPrice == null || b.unitPrice == null || a.unitBasis !== b.unitBasis || Boolean(a.conditional) !== Boolean(b.conditional)) return null;
  const diff = Math.round((b.unitPrice - a.unitPrice) * 100) / 100;
  return {diff, basis:a.unitBasis, cheaper:diff < 0, same:Math.abs(diff) < 0.005};
}

const L = {
  el:{current:'Τρέχουσα', older:'Παλαιότερη', historical:'Ιστορική', expired:'Έληξε', today:'σήμερα', yesterday:'χθες', days:n => n < 60 ? `πριν ${n} ημέρες` : n < 700 ? `πριν ${Math.round(n / 30)} μήνες` : `πριν ${Math.round(n / 365)} έτη`,
    na:'Δεν υπάρχει διαθέσιμη τιμή', kg:'/κιλό', l:'/λίτρο', pcs:'/τεμάχιο'},
  en:{current:'Current', older:'Older', historical:'Historical', expired:'Expired', today:'today', yesterday:'yesterday', days:n => n < 60 ? `${n} days ago` : n < 700 ? `${Math.round(n / 30)} months ago` : `${Math.round(n / 365)} years ago`,
    na:'Not available', kg:'/kg', l:'/L', pcs:'/item'},
};
export const pageLang = () => (globalThis.document?.documentElement?.lang || globalThis.navigator?.language || 'en').toLowerCase().startsWith('el') ? 'el' : 'en';
export const t = (lang, k, ...a) => { const v = (L[lang] || L.en)[k]; return typeof v === 'function' ? v(...a) : v ?? k; };
/** 83: money(n, lang, currency): the offer's own currency. euro(n, lang) formats in the current market's currency (every call site that has no offer at hand). */
export { money };
export const euro = (n, lang = 'en', currency = CURRENCY) => money(n, lang, currency, HOME);
export const unitText = (o, lang = 'en') => o && o.unitPrice != null ? money(o.unitPrice, lang, o.currency || CURRENCY, HOME) + t(lang, o.unitBasis) : '';
export const whenText = (o, lang = 'en') => o.ageDays === 0 ? t(lang, 'today') : o.ageDays === 1 ? t(lang, 'yesterday') : t(lang, 'days', o.ageDays);
export const dateText = (d, lang = 'en') => new Intl.DateTimeFormat(lang === 'el' ? 'el-GR' : 'en-GB', {day:'numeric', month:'short', year:'numeric', timeZone:'UTC'}).format(new Date(d + 'T00:00:00Z'));
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
