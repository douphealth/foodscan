/* FoodScan label reader 85: a photo of the nutrition table -> the nutrient values -> the official Nutri-Score 2023 for that product, with no database involved.
 *
 * Why it can be trusted:
 *  1. Nothing is guessed. Every number comes from the shopper's own photo and is shown next to it for confirmation before a grade is calculated.
 *  2. OCR digit errors are repaired with the physics of a nutrition label, not with luck: energy must equal 9 x fat + 4 x (carbohydrate + protein) + 2 x fibre,
 *     saturates cannot exceed fat, sugars cannot exceed carbohydrate, kJ = 4.184 x kcal, and the table adds up to at most 100 g. The reading that needs the fewest
 *     repairs and satisfies all of that wins. A reading that cannot be made consistent is flagged and never shown as verified.
 *  3. The grade is the same function (ns23Score) that verifies the grades of the whole app, with the table the shopper chose (general food, drink, cheese, fat/oil/nuts/seeds).
 *     What the label does not print (fibre, protein, fruit/vegetable share) is never assumed: if it can change the letter, a range is returned instead of a letter.
 * Pure functions, no DOM: tested on real Tesseract output (qa/label-reader.test.mjs, tools/label-accuracy.cjs). */
import { ns23Score } from '../assets/domain-v8500.mjs';

const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ς/g, 'σ');

/** Row labels. One pattern per nutrient; OCR drops accents, so everything is matched folded.
 *  Latin-script labels (English, French, German, Italian, Spanish, Portuguese, Dutch, Polish, Czech, Swedish) and Greek. */
const WORDS = [
  ['sat', String.raw`(?:acides?\s+gras\s+)?saturated(?:\s+fat)?|saturates?|satures?|saturi|saturadas?|saturados?|gesattigte?(?:\s+fettsauren)?|gesaettigte?|verzadigde?(?:\s+vetzuren)?|nasycone|nasycenych|mattade|κορεσμεν\p{L}*`],
  ['sugars', String.raw`sugars?|sucres?|zucker|zuccheri|azucares?|acucares?|suikers?|cukry|cukrow|socker|σακχαρ\p{L}*`],
  ['fibre', String.raw`(?:dietary\s+)?fib(?:re|er|ers|res|ra|ras)|fibres?\s+alimentaires?|ballaststoffe?|vezels?|blonnik|vlaknina|fibrer|φυτικ\p{L}*\s+ιν\p{L}*|ινεσ|ινων`],
  ['carbs', String.raw`carbohydrates?|carbs|glucides?|kohlenhydrate?|carboidrati|hidratos?\s+de\s+carbono|hidratos|koolhydraten|weglowodany|sacharidy|kolhydrater|υδατανθρακ\p{L}*`],
  ['protein', String.raw`proteins?|proteines?|proteinas?|eiweiss|eiweiß|eiwit(?:ten)?|bialko|bilkoviny|πρωτει\p{L}*`],
  ['sodium', String.raw`sodium|natrium|sodio|νατριο\p{L}*`],
  ['salt', String.raw`salt|sel|salz|sale|sal|zout|sol|αλατ\p{L}*`],
  ['fat', String.raw`total\s+fat|fats?|lipids?|lipides|lipidi|grasas?|gorduras?|fett|fette|matieres?\s+grasses?|grassi|vetten|vet|tluszcz|tuky|λιπαρ\p{L}*|λιποσ`],
  ['energy', String.raw`energy|energie|energia|energi|brennwert|calories?|kalorien|kalorie|valor\s+energetico|ενεργει\p{L}*`],
];
const KEYWORD = new RegExp(WORDS.map(([k, w]) => `(?<${k}>(?<![\\p{L}])(?:${w})(?![\\p{L}]))`).join('|'), 'giu');
const CONNECT = /(?:of\s+which|dont|davon|di\s+cui|de\s+los\s+cuales|waarvan|εκ\s+των\s+οποιων|εκ\s+των\s+οποι\p{L}*)/giu;
const SERVING = /per\s+serving|per\s+portion|par\s+portion|pro\s+portion|por\s+porcion|serving\s+size|ανα\s+μεριδα|μεριδα|portie/u;

const toNum = t => { const n = Number(String(t).replace(',', '.').replace('/', '.')); return Number.isFinite(n) ? n : null; };
/** OCR reads letters for digits in a numeric position: O for 0, l/I/| for 1. */
const LOOKALIKE_O = 'oOοΟ', LOOKALIKE_1 = 'lI|ιΙ';
const numericClean = s => s.replace(new RegExp(String.raw`(?<![\p{L}\d])([\d${LOOKALIKE_O}${LOOKALIKE_1}]*[.,][\d${LOOKALIKE_O}${LOOKALIKE_1}]+|[\d${LOOKALIKE_O}${LOOKALIKE_1}]*\d[\d${LOOKALIKE_O}${LOOKALIKE_1}]*)(?=\s*(?:kj|κι|kcal|mg|ml|g)?(?![\p{L}\d]))`, 'giu'), m => m.replace(new RegExp(`[${LOOKALIKE_1}]`, 'gu'), '1').replace(new RegExp(`[${LOOKALIKE_O}]`, 'gu'), '0'));
/** The energy unit as the OCR writes it: kJ, kj, k], KI (Greek capitals), kcal, kcaB, kca1. */
const unitOf = u => { const x = u.toLowerCase(); if (/^(?:kj|k\]|κι|ki|kl)$/.test(x)) return 'kj'; if (/^k[cε]a[l1ibo]?$|^kcal$|^kcol$/.test(x)) return 'kcal'; return x.replace('µ', 'u').replace('μ', 'u'); };
/** Numbers with the unit written next to them. Percent values (reference intakes) are dropped. */
function tokens(segment) {
  const out = [];
  for (const m of numericClean(segment).matchAll(/(<)?\s*(\d{1,5}(?:[.,\/]\d{1,3})?)\s*(kj|k\]|κι|ki|kl|kcal|kcol|kca[l1ibo]|kεal|mg|ml|μg|µg|ug|mcg|g)?\s*(%)?/giu)) {
    if (m[4]) continue;
    const raw = m[2], v = toNum(raw); if (v === null) continue;
    out.push({ raw, value: m[1] ? v / 2 : v, unit: m[3] ? unitOf(m[3]) : '', sep: /[.,\/]/.test(raw), slash: raw.includes('/'), decimals: /[.,]\d+$/.test(raw) ? raw.split(/[.,]/).pop().length : 0, lessThan: Boolean(m[1]) });
  }
  return out;
}

/* ---------- OCR reads "azúcares" as "azticares" and "Eiweiß" as "Eiweit": label words are repaired against the known wording, one or two letters at most ---------- */
const CANON = {
  sat: 'saturates saturated saturees satures saturi saturadas saturados gesattigte gesaettigte verzadigde nasycone mattade κορεσμενα κορεσμενων',
  sugars: 'sugars sugar sucres sucre zucker zuccheri azucares acucares suikers cukry socker σακχαρα σακχαρων',
  fibre: 'fibre fibres fiber fibers fibra fibras ballaststoffe vezels blonnik vlaknina fibrer φυτικεσ',
  carbs: 'carbohydrate carbohydrates glucides kohlenhydrate carboidrati hidratos koolhydraten weglowodany sacharidy kolhydrater υδατανθρακεσ υδατανθρακων',
  protein: 'protein proteins proteine proteines proteinas proteinen eiweiss eiweiß eiwit bialko bilkoviny πρωτεινεσ πρωτεινων',
  sodium: 'sodium natrium sodio νατριο',
  salt: 'salt salz sale zout αλατι αλατοσ',
  fat: 'fats lipides lipidi grasas gorduras matieres grasses grassi vetten tluszcz tuky λιπαρα',
  energy: 'energy energie energia brennwert calories kalorien ενεργεια',
};
const CANON_WORDS = [...new Set(Object.values(CANON).join(' ').split(' '))].filter(w => w.length >= 5);
const CANON_SET = new Set([...CANON_WORDS, 'fat', 'fett', 'salt', 'sel', 'sal', 'sol', 'vet', 'sugar', 'energi']);
const ALIAS = { eiweit: 'eiweiss', eiweif: 'eiweiss', eiwei: 'eiweiss', eiwelt: 'eiweiss' };
function distance(a, b, limit) {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) { const cur = [i]; let low = i; for (let j = 1; j <= b.length; j++) { const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); cur[j] = v; if (v < low) low = v; } if (low > limit) return limit + 1; prev = cur; }
  return prev[b.length];
}
function repairWords(text) {
  return text.replace(/[\p{L}]{5,}/gu, w => {
    if (CANON_SET.has(w)) return w;
    if (ALIAS[w]) return ALIAS[w];
    const limit = w.length >= 9 ? 2 : w.length >= 5 ? 1 : 0; let best = null, bd = limit + 1;
    for (const c of CANON_WORDS) { const d = distance(w, c, limit); if (d < bd) { bd = d; best = c; } }
    return best && bd <= limit ? best : w;
  });
}

/** A number whose last character the engine hesitated over: "9.19" where the second-best reading of the last glyph is "g" is "9.1 g". The printed unit g
 *  is read as 9, 6, 0 or 8 more often than any other error on a nutrition table; Tesseract's character alternatives (lstm_choice_mode) say when that happened. */
function unitFromGlyph(word) {
  const text = String(word.text || '').trim(), syms = word.symbols;
  if (!syms?.length || !/^[<>]?\d[\d.,\/]*\d$/.test(text) || /^[0-9]+$/.test(text) && text.length < 2) return text;
  const last = syms.at(-1), top = Number(last?.choices?.[0]?.confidence ?? last?.confidence ?? 0);
  const g = (last?.choices || []).find(c => /^[gqQyY9]$/.test(c.text) && c.text !== last.text && /^[gqQ]$/.test(c.text));
  if (g && /\d/.test(last.text) && Number(g.confidence) >= 0.3 * Math.max(top, 1)) return text.slice(0, -1) + ' g';
  return text;
}

/** Rebuilds the table's rows from word boxes (x0, y0, x1, y1): every word whose centre lies on the same line belongs to one row, read left to right.
 *  Tesseract sometimes reads a table as a column of labels and then a column of numbers; this puts each label back next to its number. */
export function rowsFromWords(words) {
  const ws = (words || []).filter(w => w && String(w.text || '').trim() && w.bbox && w.bbox.y1 > w.bbox.y0).map(w => ({ text: unitFromGlyph(w), x0: w.bbox.x0, x1: w.bbox.x1, cy: (w.bbox.y0 + w.bbox.y1) / 2, h: w.bbox.y1 - w.bbox.y0 }));
  if (ws.length < 6) return '';
  const hs = ws.map(w => w.h).sort((a, b) => a - b), h = hs[Math.floor(hs.length / 2)];
  ws.sort((a, b) => a.cy - b.cy);
  const rows = [];
  for (const w of ws) { const last = rows.at(-1); if (last && Math.abs(w.cy - last.cy) <= 0.55 * h) { last.words.push(w); last.cy = last.words.reduce((s, x) => s + x.cy, 0) / last.words.length; } else rows.push({ cy: w.cy, words: [w] }); }
  return rows.map(r => r.words.sort((a, b) => a.x0 - b.x0).map(w => w.text).join(' ')).join('\n');
}

/** The first adjacent pair "kJ kcal" whose ratio is 4.184: it names the first value column whatever the OCR did to the units. */
function energyPair(toks, column) {
  const nums = toks.filter(t => !t.sep || t.unit === 'kj' || t.unit === 'kcal');
  const pairs = [];
  for (let i = 0; i + 1 < nums.length; i++) { const a = nums[i].value, b = nums[i + 1].value; if (b > 0 && a / b > 3.95 && a / b < 4.45 && a >= 20) { pairs.push([a, b]); i++; } }
  const use = pairs[column] || pairs[0] || null, other = pairs.length > 1 ? pairs[pairs[column] ? 1 - column : 1] : null;
  return use ? { pair: use, other } : null;
}
const ORDER = ['energy', 'fat', 'sat', 'carbs', 'sugars', 'fibre', 'protein', 'salt'];

/** OCR text -> what each row says, exactly as read. The first value column is per 100 g on nearly every label; when the header names the serving first, the second is used. */
export function parseLabelText(text) {
  const whole = repairWords(fold(text)).replace(CONNECT, ' ');
  const hundred = whole.search(/\b100\s*(?:g|ml)\b|\b100(?:g|ml)\b|(?:per|pour|pro|por|ανα|για)\s*100\b/u), serving = whole.search(SERVING);
  const per100 = hundred >= 0, perServing = serving >= 0;
  const basis = per100 ? (/100\s*ml/u.test(whole) && !/100\s*g\b/u.test(whole) ? '100ml' : '100g') : (perServing ? 'serving' : null);
  const column = per100 && perServing && serving < hundred ? 1 : 0;
  const lineOf = pos => (whole.slice(0, pos).match(/\n/g) || []).length;
  const hits = [...whole.matchAll(KEYWORD)].map(m => ({ key: Object.keys(m.groups).find(k => m.groups[k] !== undefined), end: m.index + m[0].length, start: m.index }));
  const found = {}, line = {}; let rows = 0;
  hits.forEach((h, i) => {
    const seg = whole.slice(h.end, i + 1 < hits.length ? hits[i + 1].start : whole.length), toks = tokens(seg);
    if (!toks.length || found[h.key]) return; // the first row with this label wins
    if (h.key === 'energy') {
      const ep = energyPair(toks, column);
      if (ep) { found.energy = { kj: ep.pair[0], kcal: ep.pair[1], ratio: ep.other ? ep.other[0] / ep.pair[0] : null }; rows++; line.energy = lineOf(h.start); return; }
      const kj = toks.filter(t => t.unit === 'kj'), kcal = toks.filter(t => t.unit === 'kcal');
      const a = kj[column]?.value ?? kj[0]?.value ?? null, b = kcal[column]?.value ?? kcal[0]?.value ?? null;
      if (a !== null || b !== null) { found.energy = { kj: a, kcal: b }; rows++; line.energy = lineOf(h.start); }
      else { const big = toks.find(t => !t.sep && !t.unit && t.value > 900); if (big) { found.energy = { kj: big.value, kcal: null }; rows++; line.energy = lineOf(h.start); } }
      return;
    }
    const gramy = toks.filter(t => t.unit === 'g' || t.unit === 'mg' || !t.unit), t = gramy[column] || gramy[0] || toks[0], other = gramy.length > 1 ? gramy[gramy[column] ? 1 - column : 1] : null;
    found[h.key] = { raw: t.raw, value: t.value, unit: t.unit, sep: t.sep, slash: t.slash, decimals: t.decimals, lessThan: t.lessThan, other }; rows++; line[h.key] = lineOf(h.start);
  });
  // One row whose label the OCR destroyed, sitting between two recognised rows with exactly one nutrient missing between them: it is that nutrient (EU order).
  // The reading is marked inferred so the shopper checks it against the photo.
  const inferred = [];
  const lines = whole.split('\n'), used = new Set(Object.values(line));
  for (let n = 0; n < lines.length; n++) {
    if (used.has(n)) continue;
    const toks = tokens(lines[n]).filter(t => t.unit === 'g' || !t.unit); if (!toks.length || /\p{L}{4,}/u.test(lines[n].replace(/\b(?:g|kj|kcal|mg|ml)\b/giu, ''))) continue;
    const before = ORDER.map((k, i) => [k, i]).filter(([k]) => line[k] !== undefined && line[k] < n).map(([, i]) => i), after = ORDER.map((k, i) => [k, i]).filter(([k]) => line[k] !== undefined && line[k] > n).map(([, i]) => i);
    if (!before.length || !after.length) continue;
    const lo = Math.max(...before), hi = Math.min(...after);
    if (hi - lo === 2 && !found[ORDER[lo + 1]] && ORDER[lo + 1] !== 'energy') {
      const t = toks[column] || toks[0], key = ORDER[lo + 1];
      found[key] = { raw: t.raw, value: t.value, unit: t.unit, sep: t.sep, slash: t.slash, decimals: t.decimals, lessThan: t.lessThan, inferred: true }; line[key] = n; inferred.push(key); rows++;
    }
  }
  return { basis, rows, found, inferred };
}

/** Candidate readings of one number the OCR may have damaged. Each carries a cost (how unlikely the damage is), so the search prefers the fewest repairs:
 *  as read; the unit "g" read as a trailing digit ("13 g" -> "139"); a lost decimal point ("7.5" -> "75"); both ("7.5 g" -> "759").
 *  Labels print grams of macronutrients with one decimal and salt with two, so a longer number ending in a digit that stands in for "g" is probably a unit. */
const GLYPH = /[9680]$/;
function candidates(t, { max = 100, salt = false } = {}) {
  if (!t) return [{ value: null, cost: 0, how: 'missing' }];
  const out = new Map(), add = (value, cost, how) => { if (value === null || !(value >= 0) || value > max) return; const k = String(value); if (!out.has(k) || out.get(k).cost > cost) out.set(k, { value, cost, how }); };
  const digits = String(t.raw).replace(/[.,\/]/g, '.'), explicit = t.unit === 'g' || t.unit === 'mg', mg = t.unit === 'mg' ? 1 / 1000 : 1;
  const allowed = salt ? 2 : 1, tooLong = t.decimals > allowed || (!salt && t.decimals === 2 && GLYPH.test(digits));
  add(t.value * mg, explicit ? 0 : t.slash ? 1.5 : tooLong ? 1.5 : 0.3, 'read');
  if (explicit && !t.sep && digits.length >= 2 && mg === 1) add(toNum(digits.slice(0, -1) + '.' + digits.slice(-1)), 1.6, 'decimal lost');
  if (!explicit && !t.lessThan) {
    const drop = digits.slice(0, -1), dropCost = GLYPH.test(digits) ? 1 : 1.6, plain = digits.replace('.', '');
    if (plain.length >= 2 && drop && drop !== '.') {
      const stem = drop.replace(/\.$/, ''); add(toNum(stem), dropCost, 'unit read as a digit');
      if (!stem.includes('.') && stem.length >= 2) add(toNum(stem.slice(0, -1) + '.' + stem.slice(-1)), dropCost + 1, 'unit read as a digit, decimal lost');
      if (salt && !stem.includes('.') && stem.length >= 3) add(toNum(stem.slice(0, -2) + '.' + stem.slice(-2)), dropCost + 1, 'unit read as a digit, decimal lost');
    }
    if (!digits.includes('.') && digits.length >= 2) add(toNum(digits.slice(0, -1) + '.' + digits.slice(-1)), 1.3, 'decimal lost');
  }
  const list = [...out.values()];
  if (!list.length) return [{ value: null, cost: 2, how: 'missing' }];
  if (salt) for (const c of list) { if (c.value > 6) c.cost += 1.5; if (c.value > 20) c.cost += 3; }
  return list;
}
const closeTo = (a, b, rel) => Math.abs(a - b) <= Math.max(1e-9, rel * Math.max(a, b));
/** Energy in kJ from the grams, with the conversion factors of EU Regulation 1169/2011 (fat 37, carbohydrate and protein 17, fibre 8 kJ/g). */
const euKj = v => 37 * v.fat + 17 * (v.carbs + v.protein) + 8 * (v.fibre || 0);

/** Choose the readings that make the label physically consistent with the fewest repairs. */
export function repairLabel(parsed) {
  const f = parsed.found || {}, notes = [], tol = 0.10;
  const kj = f.energy?.kj ?? null, kcal = f.energy?.kcal ?? null;
  let energyAgrees = null;
  if (kj !== null && kcal !== null) { energyAgrees = closeTo(kj, kcal * 4.184, 0.04); if (!energyAgrees) notes.push('kJ and kcal do not agree'); }
  const energyOptions = kj !== null && kcal !== null && !energyAgrees ? [kj, kcal * 4.184] : [kj ?? (kcal !== null ? kcal * 4.184 : null)];
  // A second value column is an independent copy of every number, scaled by the serving size (known from the two energy values): a candidate whose scaled value
  // matches the serving column is more likely right; one that does not, less likely.
  const ratio = f.energy?.ratio > 0 && f.energy.ratio !== 1 ? f.energy.ratio : null;
  const cands = (key, opts) => {
    const list = candidates(f[key], opts), other = f[key]?.other;
    if (!ratio || !other) return list;
    const alt = candidates(other, { ...opts, max: 100 }).filter(c => c.value != null);
    return list.map(c => {
      if (c.value == null) return c;
      const want = c.value * ratio, hit = alt.some(a => Math.abs(a.value - want) <= 0.08 * Math.max(a.value, want) + 0.12);
      return { ...c, cost: Math.max(0, c.cost + (hit ? -0.4 : 1.0)) };
    });
  };
  const fat = cands('fat'), sat = cands('sat'), carbs = cands('carbs'), sugars = cands('sugars'), fibre = cands('fibre'), protein = cands('protein');
  const salts = cands('salt', { salt: true }), sodiums = candidates(f.sodium, { max: 40 });
  let best = null;
  for (const F of fat) for (const S of sat) for (const C of carbs) for (const Su of sugars) for (const Fi of fibre) for (const P of protein) for (const Sa of salts) for (const E of energyOptions) {
    let cost = F.cost + S.cost + C.cost + Su.cost + Fi.cost + P.cost + Sa.cost, hard = 0;
    const v = { fat: F.value, sat: S.value, carbs: C.value, sugars: Su.value, fibre: Fi.value, protein: P.value, salt: Sa.value };
    if (v.sat !== null && v.fat !== null && v.sat > v.fat + 0.05) hard += 40;
    if (v.sugars !== null && v.carbs !== null && v.sugars > v.carbs + 0.05) hard += 40;
    if ((v.fat || 0) + (v.carbs || 0) + (v.protein || 0) + (v.fibre || 0) + (v.salt || 0) > 100.6) hard += 40;
    if (E !== null && v.fat !== null && v.carbs !== null && v.protein !== null) { // a few percent is rounding; polyols, alcohol and organic acids can add more
      const diff = Math.abs(euKj(v) - E) / Math.max(E, 80);
      cost += diff <= 0.04 ? diff * 3 : 0.12 + Math.min(60, (diff - 0.04) * 40);
    }
    const total = cost + hard;
    if (!best || total < best.total) best = { total, hard, v, E, picks: { fat: F, sat: S, carbs: C, sugars: Su, fibre: Fi, protein: P, salt: Sa } };
  }
  const v = best.v, sodium = sodiums[0]?.value ?? null;
  const salt = v.salt ?? (sodium !== null ? Math.round(sodium * 2.5 * 100) / 100 : null);
  const corrections = [];
  for (const [k, p] of Object.entries(best.picks)) if (p.how !== 'read' && p.how !== 'missing') corrections.push({ field: k, read: f[k]?.raw, used: p.value, why: p.how });
  const kjFinal = best.E !== null ? Math.round(best.E) : null;
  const kcalFinal = kcal !== null && kj !== null && energyAgrees ? kcal : (kjFinal !== null ? Math.round(kjFinal / 4.184) : null);
  const checkable = best.E !== null && v.fat !== null && v.carbs !== null && v.protein !== null;
  const physics = checkable ? Math.abs(euKj(v) - best.E) / Math.max(best.E, 80) <= tol : false;
  const consistent = best.hard === 0 && physics;
  if (!checkable) notes.push('too few rows to check the numbers against each other'); else if (!consistent) notes.push('the numbers do not add up');
  const flags = {};
  for (const c of corrections) flags[c.field] = 'repaired';
  for (const k of parsed.inferred || []) flags[k] ||= 'inferred';
  for (const k of ['fat', 'sat', 'carbs', 'sugars', 'fibre', 'protein', 'salt']) if (!flags[k] && v[k] == null) flags[k] = 'missing';
  if (!consistent) for (const k of Object.keys(f)) flags[k === 'energy' ? 'kj' : k] ||= 'check';
  // values that few foods have are more often a misread than a fact: the shopper is asked to look at them again
  const usual = { salt: 4, protein: 35, fibre: 14, fat: 60, sat: 30, sugars: 70 };
  for (const [k, max] of Object.entries(usual)) if (v[k] != null && v[k] > max) flags[k] ||= 'unusual';
  return { flags, values: { kj: kjFinal, kcal: kcalFinal, fat: v.fat ?? null, sat: v.sat ?? null, carbs: v.carbs ?? null, sugars: v.sugars ?? null, fibre: v.fibre ?? null, protein: v.protein ?? null, salt }, corrections, consistent, checkable, notes, basis: parsed.basis, rows: parsed.rows };
}
export const readLabel = text => repairLabel(parseLabelText(text));

/** How well finished numbers fit together (the same checks the repair uses): hard rules and the energy balance. */
export function fitness(v) {
  const hard = (v.sat != null && v.fat != null && v.sat > v.fat + 0.05) || (v.sugars != null && v.carbs != null && v.sugars > v.carbs + 0.05) || ((v.fat || 0) + (v.carbs || 0) + (v.protein || 0) + (v.fibre || 0) + (v.salt || 0) > 100.6);
  const E = v.kj ?? (v.kcal != null ? v.kcal * 4.184 : null), checkable = E !== null && v.fat != null && v.carbs != null && v.protein != null;
  const diff = checkable ? Math.abs(euKj({ fat: v.fat, carbs: v.carbs, protein: v.protein, fibre: v.fibre }) - E) / Math.max(E, 80) : null;
  return { consistent: !hard && checkable && diff <= 0.10, hard, checkable, diff };
}

/** Several independent readings of the same photo (other scales, other page layouts) -> one. Each number is the value most readings agree on (weighted by how well
 *  each reading fits together); a number the readings disagree about is flagged for the shopper. Used only if the combination fits together at least as well as the best single reading. */
export function consensus(readings) {
  const list = readings.filter(Boolean); if (!list.length) return null;
  const best = list.reduce((a, b) => (b.weight > a.weight ? b : a));
  const keys = ['kj', 'kcal', 'fat', 'sat', 'carbs', 'sugars', 'fibre', 'protein', 'salt'], values = {}, flags = { ...best.flags }, disagree = [];
  for (const k of keys) {
    const tally = new Map();
    for (const r of list) { const x = r.values[k]; if (x == null) continue; tally.set(x, (tally.get(x) || 0) + r.weight); }
    if (!tally.size) { values[k] = null; continue; }
    const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1]); values[k] = ranked[0][0];
    if (ranked.length > 1 && ranked[1][1] >= ranked[0][1] * 0.5) { disagree.push(k); flags[k === 'kcal' ? 'kj' : k] ||= 'check'; }
  }
  const fit = fitness(values), bestFit = fitness(best.values);
  if (bestFit.consistent && !fit.consistent) return { ...best, source: 'single', disagree: [] };
  return { values, flags, consistent: fit.consistent, checkable: fit.checkable, corrections: best.corrections, notes: best.notes, basis: best.basis, rows: best.rows, disagree, source: 'consensus' };
}

/** Values printed per serving, scaled to 100 g from the serving size the shopper enters. */
export function perHundred(values, servingGrams) {
  if (!(servingGrams > 0)) return values;
  const k = 100 / servingGrams, out = { ...values };
  for (const key of ['kj', 'kcal']) if (out[key] != null) out[key] = Math.round(out[key] * k);
  for (const key of ['fat', 'sat', 'carbs', 'sugars', 'fibre', 'protein', 'salt']) if (out[key] != null) out[key] = Math.round(out[key] * k * 100) / 100;
  return out;
}

/* ---------- the grade ---------- */
export const KINDS = ['general', 'beverage', 'water', 'cheese', 'fat'];
/** Share of fruit, vegetables, legumes (and for the general table nuts) in the product, as a band. The value is a point inside the band; unknown is evaluated over all of them. */
export const FVL_BANDS = { le40: 0, b40: 50, b60: 70, gt80: 90 };
const FIBRE_PROBES = [0, 3.1, 4.2, 5.3, 6.4, 7.5], PROTEIN_PROBES = [0, 2.5, 4.9, 7.3, 9.7, 12.1, 14.1, 17.1], FVL_PROBES = [0, 50, 70, 90];

/** Official Nutri-Score 2023 from label values. Fibre, protein or fruit/vegetable share that the label does not give are not assumed: if they could change the letter, a range is returned. */
export function gradeFromLabel(v, { kind = 'general', fvlBand = 'le40', sweeteners = false, redMeat = false } = {}) {
  const kj = v.kj ?? (v.kcal != null ? v.kcal * 4.184 : null), salt = v.salt;
  if (kind === 'water') return { ok: true, grade: 'A', score: null, range: ['A', 'A'], exact: true, kind, detail: null, unknown: {} };
  const missing = [kj === null && 'energy', v.sugars == null && 'sugars', v.sat == null && 'saturated fat', salt == null && 'salt', kind === 'fat' && v.fat == null && 'fat'].filter(Boolean);
  if (missing.length) return { ok: false, missing };
  const fibres = v.fibre != null ? [v.fibre] : FIBRE_PROBES, proteins = v.protein != null ? [v.protein] : PROTEIN_PROBES;
  const fvls = fvlBand === 'unknown' ? FVL_PROBES : [FVL_BANDS[fvlBand] ?? 0];
  const grades = new Set(), scores = new Set(); let sample = null;
  for (const fibre of fibres) for (const protein of proteins) for (const fvl of fvls) {
    const r = ns23Score({ kj, sugars: v.sugars, saturatedFat: v.sat, fat: v.fat ?? null, salt, fibre, protein, fvl, sweeteners: sweeteners ? 1 : 0, redMeat }, kind);
    grades.add(r.grade); scores.add(r.score); sample ||= r;
  }
  const letters = [...grades].sort(), exact = fibres.length === 1 && proteins.length === 1 && fvls.length === 1;
  return { ok: true, grade: letters.length === 1 ? letters[0] : null, score: exact || scores.size === 1 ? sample.score : null, range: [letters[0], letters.at(-1)], exact, kind, detail: exact ? { negative: sample.negative, positive: sample.positive } : null, unknown: { fibre: v.fibre == null, protein: v.protein == null, fvl: fvlBand === 'unknown' } };
}
