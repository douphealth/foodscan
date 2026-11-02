/* FoodScan 73 · verified name -> observatory product matcher.
 *
 * posokanei.gov.gr publishes ~10k products with daily chain prices but no barcodes. This module links a barcode to an
 * observatory product ONLY when a barcode-carrying record (e-katanalotis, a chain e-shop page, Open Food Facts) names the
 * same product exactly:
 *   1. same brand (phonetic Greek/Latin skeleton, e.g. "ΜΕΒΓΑΛ" = "MEVGAL"),
 *   2. same pack size (parsed exactly; multipacks as totals; within 0.5 %),
 *   3. every descriptive word of the barcode record is found in the observatory name (abbreviations allowed: "ΣΤΟΜ." = "Στοματικό"),
 *   4. no conflicting variant: every number (fat %, No 2, 0 %) must be on both sides, and a variant word on the observatory
 *      side (light, zero, decaf, a flavour, lactose free, ...) must also be on the barcode side,
 *   5. the result is unique: exactly one observatory product passes, and (in buildLinks) no other barcode claims it.
 * Anything else is "no match". It never guesses: a missing link is safe, a wrong link is not.
 * Pure functions, no I/O: runs in Node and in a Worker. */

const GREEK_FROM_LATIN = { A: 'Α', B: 'Β', E: 'Ε', H: 'Η', I: 'Ι', K: 'Κ', M: 'Μ', N: 'Ν', O: 'Ο', P: 'Ρ', T: 'Τ', X: 'Χ', Y: 'Υ', Z: 'Ζ' };
const LATIN_FROM_GREEK = Object.fromEntries(Object.entries(GREEK_FROM_LATIN).map(([l, g]) => [g, l]));
const G2L = { Α: 'a', Β: 'v', Γ: 'g', Δ: 'd', Ε: 'e', Ζ: 'z', Η: 'i', Θ: 'th', Ι: 'i', Κ: 'k', Λ: 'l', Μ: 'm', Ν: 'n', Ξ: 'ks', Ο: 'o', Π: 'p', Ρ: 'r', Σ: 's', Τ: 't', Υ: 'y', Φ: 'f', Χ: 'h', Ψ: 'ps', Ω: 'o' };
const isGreek = c => c >= 'Α' && c <= 'Ω';
const isLatin = c => c >= 'A' && c <= 'Z';

/** Upper-case, accent-free, NFKC; Latin look-alike letters inside Greek words become Greek ("ΓΙAOYΡ" -> "ΓΙΑΟΥΡ"). */
export function canon(s) {
  let t = String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/ς/g, 'Σ').replace(/Σ/g, 'Σ');
  t = t.replace(/[’'`´]/g, '').replace(/([\p{L}.])(\d{1,3}\s*\/\s*\d)/gu, '$1 $2').replace(/(\d)\s*[,.]\s*(\d)/g, '$1.$2')
    .replace(/\([^()]*-\s*\d[^()]*(\)|$)/g, ' ')                 // promo notes: "(-0.70", "(2Τ-0.7)"
    .replace(/(^|[^\p{L}])(NO|NR|N|ΝΟ|Ν)\s*[.:]?\s*(?=\d)/gu, '$1N');  // "N. 6", "No 2" -> "N6"/"N2"
  return t.replace(/[\p{L}\p{N}]+/gu, w => {
    let g = 0, l = 0; for (const c of w) { if (isGreek(c)) g++; else if (isLatin(c)) l++; }
    if (g && l) return [...w].map(c => GREEK_FROM_LATIN[c] || c).join('');
    return w;
  });
}
/** Phonetic skeleton shared by Greek and Latin spellings. */
export function skel(word) {
  let s = [...String(word)].map(c => G2L[c] ?? c.toLowerCase()).join('');
  s = s.replace(/ph/g, 'f').replace(/ck/g, 'k').replace(/c(?=[eiy])/g, 's').replace(/c/g, 'k').replace(/q/g, 'k').replace(/w/g, 'v').replace(/j/g, 'i')
    .replace(/kh|ch/g, 'h').replace(/mp/g, 'b').replace(/nt/g, 'd').replace(/gk|gg/g, 'g').replace(/ou|oy/g, 'u')
    .replace(/ai/g, 'e').replace(/ei|oi|yi|y/g, 'i').replace(/v/g, 'b').replace(/x/g, 'ks').replace(/o/g, 'o')
    .replace(/(.)\1+/g, '$1');
  return s;
}

const UNIT = [
  [/^(KG|ΚΓ|KGR|ΚΙΛ|ΚΙΛΟ|ΚΙΛΑ|ΚΙΛΩΝ|KILO)$/, 'kg', 1], [/^(G|GR|GRS|ΓΡ|ΓΡΑΜ|ΓΡΑΜΜΑΡΙΑ|GRAM|Γ)$/, 'kg', 0.001],
  [/^(L|LT|LTR|LTS|ΛΙΤ|ΛΙΤΡΟ|ΛΙΤΡΑ|ΛΤ|Λ|LITRE|LITER)$/, 'l', 1], [/^(ML|ΜΛ|MLT)$/, 'l', 0.001], [/^(CL|ΕΚ)$/, 'l', 0.01],
  [/^(ΤΕΜ|TEM|ΤΜΧ|PCS|PC|ΤΕΜΑΧΙΑ|ΤΕΜΑΧΙΟ|ΤΕΜΑΧ|Τ|ΦΑΚ|ΦΑΚΕΛΑΚΙΑ|ΚΑΨΟΥΛΕΣ|ΚΑΨ|CAPS|ΜΕΖΟΥΡΕΣ|ΜΕΖ|ΠΛΥΣΕΙΣ|ΠΛ|ΜΠΟΥΚΑΛΙΑ)$/, 'pcs', 1],
];
const unitOf = u => { const x = String(u).replace(/[Μ]/g, 'M').replace(/[Κ](?=G)/g, 'K'); for (const [re, unit, f] of UNIT) if (re.test(u) || re.test(x)) return [unit, f]; return null; };

/** Every size mention in a name, as {unit, amount, raw, at, end}. "2X200G" -> 0.4 kg; "12/370G" (case count) -> 0.37 kg. */
export function sizes(name) {
  const t = canon(name).replace(/(\d)\s*[XΧ×*]\s*(?=\d)/g, '$1X').replace(/\(\s*(\d)/g, ' $1');
  const out = [];
  const re = /(?:^|[^\p{L}\p{N}.])(?:(\d{1,3})\s*\/\s*)?(?:(\d{1,3})\s*X\s*)?(\d+(?:\.\d+)?)\s*([\p{L}]{1,10})(?![\p{L}])/gu;
  for (const m of t.matchAll(re)) {
    const u = unitOf(m[4]); if (!u) continue;
    const n = Number(m[3]); if (!(n > 0)) continue;
    const mult = m[2] ? Number(m[2]) : 1;
    if (u[0] === 'pcs' && m[1] && !m[2]) { /* "2/48TEM": 2 = case count */ }
    out.push({ unit: u[0], amount: Math.round(n * u[1] * mult * 1e6) / 1e6, raw: m[0].trim(), at: m.index, end: m.index + m[0].length, multi: mult > 1 });
  }
  return out;
}
/** The one pack size a record states, or null if none or if two different sizes conflict. Pieces only if no weight/volume. */
export function packSize(name, quantityField) {
  let s = sizes(name);
  if (!s.length && quantityField) s = sizes(String(quantityField));
  const wv = s.filter(x => x.unit !== 'pcs'), use = wv.length ? wv : s;
  if (!use.length) return null;
  const multi = use.filter(x => x.multi), cand = multi.length ? multi : use;
  const first = cand[cand.length - 1];
  for (const x of cand) if (x.unit !== first.unit || Math.abs(x.amount - first.amount) > first.amount * 0.005) return null;
  return { unit: first.unit, amount: first.amount };
}
/** How many units a pack holds: "4x250ml" -> 4, "1.5 L (6ΤΕΜ)" -> 6, "1lt" -> 1. A case count ("12/500G") is not a pack. */
export function packCount(name, quantityField) {
  let s = sizes(name);
  if (!s.some(x => x.unit !== 'pcs') && quantityField) s = s.concat(sizes(String(quantityField)));
  const wv = s.filter(x => x.unit !== 'pcs');
  if (!wv.length) return 1;
  const multi = wv.find(x => x.multi);
  if (multi) { const m = /(\d{1,3})\s*X\s*\d/.exec(multi.raw.replace(/^\d{1,3}\s*\/\s*/, '')); return m ? Number(m[1]) : 1; }
  const pcs = s.find(x => x.unit === 'pcs' && x.amount > 1 && x.amount <= 48);
  return pcs ? pcs.amount : 1;
}
export const sameSize = (a, b) => !!a && !!b && a.unit === b.unit && Math.abs(a.amount - b.amount) <= Math.max(a.amount, b.amount) * 0.005;

const STOP = new Set(['και', 'με', 'του', 'της', 'των', 'για', 'σε', 'απο', 'το', 'τα', 'η', 'ο', 'οι', 'στο', 'στη', 'στην', 'and', 'with', 'the', 'of', 'de', 'di', 'la', 'le', 'el', 'en', 'a', 'kai', 'me',
  'συσκευασια', 'σκευασια', 'κουτι', 'φιαλη', 'φιαλες', 'πλαστικη', 'γυαλινη', 'μπουκαλι', 'βαζο', 'pet', 'κ/τ', 'kt', 'κτ', 'ελλην', 'ελληνικο', 'ελληνικη', 'ελληνικα', 'ελληνικος', 'ελληνικοσ',
  'gluten', 'free', 'νεο', 'new', 'προσφορα', 'δωρο', 'εκπτωση', 'τιμη', 'τιμ', 'πακετο', 'pack', 'ενα', 'τεμ', 'τεμαχια', 'τεμαχιο']);
const STOP_SK = new Set([...STOP].map(w => skel(canon(w))));
/** Variant words: if the observatory name has one of these, the barcode record must have it too (a missing one is a different product). */
const VARIANT = ['light', 'λαιτ', 'ελαφρυ', 'ελαφρια', 'zero', 'ζερο', 'μηδεν', 'χωρισ', 'χωρις', 'without', 'free', 'decaf', 'ντεκαφ', 'αποκαφεινωμενοσ', 'αποκαφεινωμενος', 'bio', 'βιο', 'βιολογικο', 'βιολογικη', 'βιολογικοσ', 'βιολογικος', 'organic',
  'λακτοζη', 'λακτοζησ', 'lactose', 'πληρεσ', 'πληρες', 'πληρη', 'αποβουτυρωμενο', 'ημιαποβουτυρωμενο', 'μαυρη', 'λευκη', 'γαλακτοσ', 'γαλακτος', 'υγειασ', 'bitter', 'ολικησ', 'ολικης', 'integrale', 'whole', 'σικαλησ', 'σικαλης', 'πολυσπορο', 'πολυσπορα',
  'φραουλα', 'φραουλασ', 'βανιλια', 'βανιλιασ', 'σοκολατα', 'σοκολατασ', 'κακαο', 'μελι', 'λεμονι', 'λεμονιου', 'πορτοκαλι', 'πορτοκαλιου', 'μηλο', 'μηλου', 'ροδακινο', 'βερικοκο', 'κερασι', 'βυσσινο', 'μπανανα', 'καρυδα', 'φουντουκι', 'φουντουκιου', 'αμυγδαλο', 'αμυγδαλου', 'φιστικι', 'καραμελα', 'καφε', 'κανελα', 'μεντα', 'δυοσμοσ', 'τζιντζερ', 'ντοματα', 'πιπερι', 'ριγανη', 'σκορδο', 'κρεμμυδι', 'τυρι', 'μπεικον', 'barbeque', 'bbq', 'αλατι', 'αλατισμενο', 'ανάλατο', 'αναλατο', 'πικαντικο', 'καυτερο', 'γλυκο', 'γλυκια', 'ξινο',
  'strawberry', 'vanilla', 'chocolate', 'cocoa', 'honey', 'lemon', 'orange', 'apple', 'peach', 'cherry', 'banana', 'coconut', 'hazelnut', 'almond', 'caramel', 'coffee', 'cinnamon', 'mint', 'menta', 'spearmint', 'peppermint', 'ginger', 'tomato', 'pepper', 'garlic', 'onion', 'cheese', 'bacon', 'salt', 'salted', 'unsalted', 'spicy', 'hot', 'sweet', 'sour', 'lime', 'mango', 'berries', 'berry', 'raspberry', 'blueberry', 'forest', 'tropical', 'pineapple', 'grapefruit', 'watermelon', 'melon', 'kiwi', 'passion', 'pistachio', 'cookies', 'cream', 'κρεμα', 'white', 'black', 'dark', 'milk', 'red', 'green', 'blue', 'yellow', 'pink', 'gold', 'silver',
  'κοτοπουλο', 'μοσχαρι', 'χοιρινο', 'γαλοπουλα', 'ψαρι', 'τονοσ', 'σολομοσ', 'sensitive', 'whitening', 'kids', 'παιδικο', 'baby', 'βρεφικο', 'men', 'women', 'normal', 'κανονικο', 'mini', 'μινι', 'maxi', 'μαξι', 'super', 'ultra', 'extra', 'plus', 'max', 'intense', 'classic', 'κλασικο', 'original', 'fresh', 'φρεσκο', 'φρεσκια', 'φρεσκοσ', 'μακρασ', 'μακρας', 'διαρκειασ', 'υψηλησ', 'παστεριωσησ', 'στραγγιστο', 'αγελαδοσ', 'αγελαδινο', 'προβειο', 'κατσικισιο', 'αιγοσ', 'αιγοπροβειο'];
const VARIANT_SK = new Set(VARIANT.map(w => skel(canon(w))));
export const isVariant = sk => VARIANT_SK.has(sk) || [...VARIANT_SK].some(v => v.length >= 5 && sk.length >= 5 && (sk.startsWith(v) || v.startsWith(sk)) && Math.abs(sk.length - v.length) <= 3);

/** Name -> descriptive tokens: {w (canonical), sk (skeleton), num (true for number-bearing tokens)}; size mentions removed. */
export function tokens(name) {
  let t = canon(name);
  // drop size mentions and case counts ("12/", "24/") so only descriptive words and variant numbers stay
  t = t.replace(/(\d)\s*[XΧ×*]\s*(?=\d)/g, '$1X');
  for (const s of sizes(name).sort((a, b) => b.raw.length - a.raw.length)) t = t.split(canon(s.raw).replace(/(\d)\s*[XΧ×*]\s*(?=\d)/g, '$1X')).join(' ');
  t = t.replace(/(^|\s)\d{1,3}\s*\/(?=\s|\d|$)/g, ' ').replace(/(\d)\s*%/g, '$1%');
  const out = [];
  // "ΑΝΤ/ΚΟ", "ΟΔ/ΜΑ": a word written as first letters / last letters; it stands for any word with that start and end
  t = t.replace(/(^|[^\p{L}])(\p{L}{1,6})\/(\p{L}{1,4})(?![\p{L}])/gu, (m, a, x, y) => { out.push({ w: x + '/' + y, sk: skel(x) + '/' + skel(y), num: false, slash: [skel(x), skel(y)] }); return a + ' '; });
  for (const raw of t.split(/[^\p{L}\p{N}%.+]+/u)) {
    for (const w0 of raw.split(/\.(?!\d)/)) {
      const w = w0.replace(/^[.+]+|[.+]+$/g, ''); if (!w) continue;
      const num = /\d/.test(w);
      const sk = num ? w.replace(/^(NO|N|ΝΟ|Ν|NR|ΝΡ)(?=\d)/, '').replace(/[^\d.%+]+$/, '').replace(/^0+(?=\d)/, '').replace(/\.0+(?=%|\+|$)/, '') : skel(w);
      if (!num && (sk.length < 1 || STOP_SK.has(sk))) continue;
      if (!num && w.length === 1) { out.push({ w, sk, num, init: true }); continue; } // initial ("Γ." = "Γάλακτος"): never required, may confirm a variant
      out.push({ w, sk, num });
    }
  }
  return out;
}
const tokMatch = (a, b) => {
  if (a.num || b.num) return a.num && b.num && a.sk === b.sk;
  if (a.sk === b.sk) return true;
  if (a.slash || b.slash) {
    const [sl, o] = a.slash ? [a, b] : [b, a]; if (o.slash) return false;
    return o.sk.length >= sl.slash[0].length + sl.slash[1].length && o.sk.startsWith(sl.slash[0]) && o.sk.endsWith(sl.slash[1]);
  }
  const [s, l] = a.sk.length <= b.sk.length ? [a.sk, b.sk] : [b.sk, a.sk];
  return s.length >= 3 && l.startsWith(s);
};

/** Brand of an observatory product as skeleton tokens (brand field, else first word of the name). */
export function brandSk(brand, name) {
  const b = tokens(brand || '').filter(t => !t.num).map(t => t.sk);
  if (b.length) return b;
  const n = tokens(name || ''); return n.length ? [n[0].sk] : [];
}
const joinSk = a => a.join('');
/** Where a brand (skeleton tokens) occurs inside a token list (exact skeleton; spacing-insensitive: "COCA COLA" = "COCACOLA"). Returns [start, end) or null. */
export function findBrand(toks, bsk) {
  const want = joinSk(bsk); if (!want) return null;
  for (let i = 0; i < toks.length; i++) {
    let acc = '';
    for (let j = i; j < toks.length && acc.length < want.length; j++) {
      if (toks[j].num) break;
      acc += toks[j].sk; if (acc === want) return [i, j + 1];
    }
  }
  return null;
}

/** Prepares the observatory catalogue: one entry per product with size, brand and tokens, indexed by size. */
export function indexCatalogue(products, { countries = ['GR'] } = {}) {
  const bySize = new Map(), list = [], df = new Map();
  for (const p of products) {
    if (!p || !p.id || !p.name) continue;
    if (!(p.retailer_prices || []).some(r => countries.includes(r.country)) && !(p.available_countries || []).some(c => countries.includes(c))) continue;
    const u = String(p.unit || '').toLowerCase(), q = Number(p.unit_quantity);
    const fromField = q > 0 && ['kg', 'l', 'pcs'].includes(u) ? { unit: u, amount: q } : null;
    const fromName = packSize(p.name);
    const size = fromField || fromName; if (!size) continue;
    // the stated size must not contradict the size written in the name
    const bad = !!(fromField && fromName && fromName.unit === fromField.unit && !sameSize(fromField, fromName));
    const e = { bad, count: packCount(p.name), id: p.id, name: p.name, brand: p.brand || '', private_label: !!p.private_label, size, bsk: brandSk(p.brand, p.name), toks: tokens(p.name),
      cat: new Set(tokens([p.category, p.subcategory].filter(Boolean).join(' ')).map(t => t.sk)) };
    for (const sk of new Set(e.toks.filter(t => !t.num).map(t => t.sk))) df.set(sk, (df.get(sk) || 0) + 1);
    e.bpos = findBrand(e.toks, e.bsk);
    list.push(e);
    for (const sz of bad ? [fromField, fromName] : [size]) {
      const k = sz.unit + ':' + Math.round(sz.amount * 1000);
      if (!bySize.has(k)) bySize.set(k, []); bySize.get(k).push(e);
    }
  }
  return { list, bySize, df };
}
/** An observatory word the barcode record does not mention is tolerated only if it is a generic word: part of the product's
 *  own category, or common across the catalogue (>= GENERIC_DF products), and never a variant word. A rare word ("Ricco",
 *  "Intenso", "Με Ρόδι") names a product line, so the match is refused. */
export const GENERIC_DF = 40;
const isGeneric = (idx, cand, t) => !isVariant(t.sk) && (cand.cat.has(t.sk) || [...cand.cat].some(c => c.length >= 4 && (c.startsWith(t.sk) || t.sk.startsWith(c))) || (idx.df.get(t.sk) || 0) >= GENERIC_DF);
function sizeCandidates(idx, size) {
  const out = [], base = Math.round(size.amount * 1000);
  for (const d of [-1, 0, 1]) for (const e of idx.bySize.get(size.unit + ':' + (base + d)) || []) if (!out.includes(e) && (sameSize(e.size, size) || e.bad)) out.push(e);
  return out;
}

/** Compares one barcode record with one observatory product of the same size. Returns null (no) or {extras, matched}. */
export function compare(src, cand, srcBrandSk) {
  // 1. brand
  const bPos = findBrand(src.toks, cand.bsk);
  const brandOK = bPos || (srcBrandSk && srcBrandSk.length && joinSk(srcBrandSk) === joinSk(cand.bsk));
  if (!brandOK) return null;
  const sTok = src.toks.filter((t, i) => !(bPos && i >= bPos[0] && i < bPos[1]) && !(srcBrandSk && t.sk === joinSk(srcBrandSk)));
  const cTok = cand.toks.filter((t, i) => !(cand.bpos && i >= cand.bpos[0] && i < cand.bpos[1]) && !t.init);
  // 2. numbers must agree both ways
  const sn = new Set(sTok.filter(t => t.num).map(t => t.sk)), cn = new Set(cTok.filter(t => t.num).map(t => t.sk));
  for (const n of sn) if (!cn.has(n)) return null;
  for (const n of cn) if (!sn.has(n)) return null;
  // 3. every descriptive word of the barcode record must be in the observatory name (abbreviation / inflection allowed)
  const used = new Set();
  for (const s of sTok) {
    if (s.num || s.init) continue;
    let hit = -1;
    for (let j = 0; j < cTok.length; j++) if (!cTok[j].num && tokMatch(s, cTok[j])) { hit = j; break; }
    if (hit < 0) {
      // "COCACOLA" vs "COCA COLA", "ΟΔ/ΜΑ" style splits: try two adjacent observatory words
      for (let j = 0; j + 1 < cTok.length && hit < 0; j++) if (s.sk === cTok[j].sk + cTok[j + 1].sk) { hit = j; used.add(j + 1); }
    }
    if (hit < 0) return null;
    used.add(hit);
  }
  // 4. a variant word on the observatory side must be on the barcode side too
  // an initial ("Χ." "Ζ" in "ΜΠΙΣΚ. Χ. Ζ") must stand for an unused observatory word with that first letter
  let extras = cTok.filter((t, j) => !t.num && !used.has(j));
  for (const s of sTok.filter(s => s.init)) {
    const k = extras.findIndex(t => t.sk[0] === s.sk[0]); if (k < 0) return null; extras = extras.filter((_, i) => i !== k);
  }
  const matched = sTok.filter(t => !t.num && !t.init).length;
  return { extras, matched };
}

/** Best observatory product for one barcode record, or a reason why none. */
const plain = s => String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
export const isPromoPack = name => /\(\s*(\d+\s*[ΤT]\.?\s*)?-\s*\d|\+\s*\d+\s*(%|ΔΩΡΟ|ΔΩΡΕΑΝ|FREE)|(?<![\d.])\d\s*\+\s*\d(?![\d.]*\s*(KG|G|ΚΙΛ))|ΔΩΡΟ|ΔΩΡΕΑΝ|(?<![\p{L}])(ΣΕΤ|SET|PROMO)(?![\p{L}])/iu.test(plain(name));
export function matchOne(idx, rec, { minWords = 1 } = {}) {
  // price-marked or bundle packs ("(-0.70)", "1+1 ΔΩΡΟ", "+20%") have their own barcode and their own shelf price
  if (isPromoPack(rec.name)) return { reason: 'promo_pack' };
  const size = rec.size || packSize(rec.name, rec.quantity);
  if (!size) return { reason: 'no_size' };
  const src = { toks: tokens(rec.name) };
  const srcBrandSk = rec.brand ? brandSk(rec.brand, '') : null;
  // every observatory product of that size and brand that contains all the record's words "covers" it
  const covers = [];
  for (const c of sizeCandidates(idx, size)) {
    const r = compare(src, c, srcBrandSk);
    if (r && r.matched >= minWords) covers.push({ c, ...r });
  }
  if (!covers.length) return { reason: 'no_candidate' };
  // under-specified: the record fits two products (e.g. "ΓΑΛΑ 1L" fits "Γάλα 1L" and "Γάλα Light 1L") -> refuse
  if (covers.length > 1) return { reason: 'ambiguous', options: covers.map(h => h.c.name) };
  const h = covers[0];
  // "1lt" is not "4x250ml", and "1.5 L (6ΤΕΜ)" is not one 1,5 lt bottle: the number of units in the pack must agree
  const count = packCount(rec.name, rec.quantity);
  if (count !== h.c.count) return { reason: 'pack_count_differs', got: h.c.name, gotId: h.c.id, counts: [count, h.c.count], extras: h.extras.map(t => t.w), matched: h.matched, size };
  if (h.c.bad) return { reason: 'observatory_size_inconsistent', got: h.c.name };
  const bad = h.extras.filter(t => !isGeneric(idx, h.c, t));
  if (bad.length) return { reason: 'extra_specific_words', got: h.c.name, words: bad.map(t => t.w) };
  return { id: h.c.id, name: h.c.name, extras: h.extras.map(t => t.w), matched: h.matched, size };
}
