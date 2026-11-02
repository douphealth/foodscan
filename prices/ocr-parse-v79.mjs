/* FoodScan 73: reads a price, a date and a supermarket out of OCR text from a shopper's own photo.
 * Suggestions only. Every value is shown in an editable form and nothing is saved or shared until the shopper confirms.
 * Nothing here invents a price: a number is suggested only if it is printed in the photo. */
const STRIP = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
// Chain names as printed on receipts and shelf labels (accents removed, upper case; OCR confuses Latin/Greek look-alikes).
export const OCR_CHAINS = [
  ['ab', /\bAB\s*(VASS|VAS|ΒΑΣ)|ΒΑΣΙΛΟΠΟΥΛ|VASSILOPOUL|ΑΛΦΑ\s*ΒΗΤΑ|ALFA\s*BETA/],
  ['sklavenitis', /ΣΚΛΑΒΕΝΙΤ|SKLAVENIT/], ['lidl', /\bL[I1]DL\b|ΛΙΝΤΛ/], ['mymarket', /MY\s*MARKET|MYMARKET|ΜΕΤΡΟ\s*Α\.?Ε/],
  ['masoutis', /ΜΑΣΟΥΤ|MASOUT/], ['kritikos', /ΚΡΗΤΙΚΟΣ|KRITIKOS/], ['galaxias', /ΓΑΛΑΞΙΑΣ|GALAXIAS/], ['marketin', /MARKET\s*IN\b|ΜΑΡΚΕΤ\s*ΙΝ/],
  ['synka', /\bSYNKA\b|ΣΥΝ\.?ΚΑ\b|ΣΥΝΚΑ/], ['chalkiadakis', /ΧΑΛΚΙΑΔΑΚ|CHALKIADAK/], ['bazaar', /BAZAAR|ΜΠΑΖΑΑΡ|ΜΠΑΖΑΡ/],
];
const UNIT = /(ΤΙΜΗ\s*(ΜΟΝΑΔ|ΑΝΑ|ΚΙΛ|ΛΙΤ)|ΑΝΑ\s*(ΚΙΛ|ΛΙΤ|KG|LT)|PER\s*(KG|L)|\/\s*(KG|ΚΙΛ|LT|ΛΙΤ))[^\d]*$/;
const RECEIPT = /ΣΥΝΟΛΟ|ΑΠΟΔΕΙΞΗ|Α\.?Φ\.?Μ|ΜΕΤΡΗΤΑ|ΚΑΡΤΑ\s*ΠΛΗΡ|ΦΠΑ|TOTAL/;
const iso = (y, m, d) => { const t = Date.UTC(y, m - 1, d); const x = new Date(t); return x.getUTCFullYear() === y && x.getUTCMonth() === m - 1 && x.getUTCDate() === d ? x.toISOString().slice(0, 10) : null; };

/** Prices printed in the text: "1,99", "1.99 €", "€ 12,40". Unit prices (per kg / per litre) and percentages are marked. */
export function priceCandidates(text, words = []) {
  const out = [], lines = String(text || '').split(/\n+/);
  const heightOf = v => { let best = 0; for (const w of words) { const t = String(w.text || '').replace(/[^\d,.]/g, ''); if (t && (t === v || t.includes(v) || v.includes(t) && t.length >= 2)) best = Math.max(best, (w.bbox?.y1 ?? 0) - (w.bbox?.y0 ?? 0)); } return best; };
  for (const raw of lines) {
    const line = STRIP(raw);
    const re = /(?<![\d.,])(\d{1,4})\s?[,.]\s?(\d{2})(?![\d%])(?!\s*%)/g; let m;
    while ((m = re.exec(line))) {
      const value = Number(m[1] + '.' + m[2]); if (!(value >= 0.05 && value < 1000)) continue;
      const after = line.slice(m.index + m[0].length, m.index + m[0].length + 14), before = line.slice(Math.max(0, m.index - 14), m.index);
      if (/^\s*[\/.\-]\s*\d/.test(after) || /\d\s*[\/.-]\s*$/.test(before)) continue; // a date such as 12.05.2026 or 12,05/26
      const unit = /^\s*(€|EUR)?\s*(\/|ΑΝΑ\s)/.test(after) || UNIT.test(line.slice(Math.max(0, m.index - 25), m.index).split(/\d[,.]\d\d/).pop());
      out.push({value, text:m[1] + ',' + m[2], unit, euro:/€|EUR/.test(before + after), total:/ΣΥΝΟΛΟ|TOTAL|ΠΛΗΡΩΤΕΟ|ΜΕΤΡΗΤΑ|ΡΕΣΤΑ/.test(line), height:heightOf(m[1] + ',' + m[2]) || heightOf(m[1] + '.' + m[2]), line:raw.trim().slice(0, 80)});
    }
  }
  // Same value twice counts once (keep the largest print).
  const seen = new Map(); for (const c of out) { const k = c.value + '|' + c.unit, old = seen.get(k); if (!old || c.height > old.height) seen.set(k, c); }
  return [...seen.values()];
}

/** Dates printed in the text (dd/mm/yyyy, dd-mm-yy, dd.mm.yyyy), only if they are within the last year and not in the future. */
export function dateCandidates(text, today) {
  const out = [], re = /(?<!\d)(\d{1,2})\s?[\/.\-]\s?(\d{1,2})\s?[\/.\-]\s?(\d{4}|\d{2})(?!\d)/g; let m;
  const min = new Date(Date.parse(today + 'T00:00:00Z') - 365 * 864e5).toISOString().slice(0, 10);
  while ((m = re.exec(String(text || '')))) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]), d = iso(y, Number(m[2]), Number(m[1]));
    if (d && d <= today && d >= min && !out.includes(d)) out.push(d);
  }
  return out;
}

export function storeOf(text) { const t = STRIP(text); for (const [id, re] of OCR_CHAINS) if (re.test(t)) return id; return ''; }

/** Suggestions for the form. kind: 'PRICE_TAG' (shelf label) or 'RECEIPT'. price is null when the photo does not make it clear. */
export function readLabel({text = '', words = []} = {}, {today}) {
  const t = STRIP(text), kind = RECEIPT.test(t) ? 'RECEIPT' : 'PRICE_TAG';
  const all = priceCandidates(text, words), item = all.filter(c => !c.unit && !c.total);
  let price = null;
  if (kind === 'PRICE_TAG') {
    // On a shelf label the selling price is the largest print. With no sizes, only a single item price is suggested.
    const sized = item.filter(c => c.height > 0).sort((a, b) => b.height - a.height);
    if (sized.length && (sized.length === 1 || sized[0].height >= sized[1].height * 1.25)) price = sized[0].value;
    else if (item.length === 1) price = item[0].value;
  } else if (item.length === 1) price = item[0].value; // a receipt with one line; otherwise the shopper picks the line
  const dates = dateCandidates(text, today);
  return {kind, price, candidates:item.map(c => c.value), unitPrices:all.filter(c => c.unit).map(c => c.value), date:dates[0] || null, dates, store:storeOf(text)};
}

/** The confirmed form, checked before anything is saved or sent. Returns {ok, errors[], value}. */
export function checkReport(f, {today, stores}) {
  const errors = [], price = Number(String(f.price ?? '').replace(',', '.')), was = f.regularPrice === '' || f.regularPrice == null ? null : Number(String(f.regularPrice).replace(',', '.'));
  const code = String(f.barcode || '');
  if (!/^(?:\d{8}|\d{12,14})$/.test(code)) errors.push('barcode');
  if (!(price >= 0.01 && price < 10000) || !/^\d+(?:[.,]\d{1,2})?$/.test(String(f.price ?? '').trim())) errors.push('price');
  if (was !== null && !(was > price && was < 10000)) errors.push('regularPrice');
  const min = new Date(Date.parse(today + 'T00:00:00Z') - 365 * 864e5).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date || '') || f.date > today || f.date < min) errors.push('date');
  if (!Object.hasOwn(stores, f.store || '')) errors.push('store');
  if (!['PRICE_TAG', 'RECEIPT'].includes(f.kind)) errors.push('kind');
  if (f.confirmed !== true) errors.push('confirmed');
  return {ok:!errors.length, errors, value:{barcode:code, price:Math.round(price * 100) / 100, regularPrice:was, date:f.date, store:f.store, kind:f.kind}};
}

/** Open Prices request bodies for a confirmed report. Used only after the shopper presses "Share" (never automatically). */
export function openPricesBodies(v, location) {
  const proof = {type:v.kind, date:v.date, currency:'EUR', location_id:location.id, location_osm_id:location.osm_id, location_osm_type:location.osm_type};
  const price = {type:'PRODUCT', product_code:v.barcode, price:v.price, currency:'EUR', date:v.date, location_id:location.id,
    location_osm_id:location.osm_id, location_osm_type:location.osm_type, price_is_discounted:v.regularPrice != null,
    ...(v.regularPrice != null ? {price_without_discount:v.regularPrice} : {})};
  return {proof, price};
}
