/* FoodScan 98.1 · logic of the Daily check-in (daily-v98.js): no DOM here, so qa/daily98.test.mjs runs it in Node.
 *
 * What changed from the 98.0.0 draft, each measured or checked against the app's own data model:
 *  - a food's lens verdict follows the EU nutrition-claim thresholds (Regulation 1924/2006), including the stricter drinks limit;
 *  - the energy check uses the EU labelling factors (carbs 4, protein 4, fat 9, fibre 2 kcal/g) and is informational: the app's own
 *    dataQuality() stays the only judge of "needs checking" (on the 9,270 catalogue products with all four numbers the draft's 4-4-9 rule called 41
 *    correct labels wrong, 17 sugar-alcohol and 24 high-fibre foods, and missed 54 that do not add up);
 *  - ingredients are a string in the product model (the draft looked for an array, so every product "lacked" them);
 *  - 98.1: averages were shown per 100 g of the foods logged, never as a share of a daily limit, because a one-tap check-in had no portion size.
 *  - 99.0: a check-in now carries an amount (the product's own serving, its pack, a cup, a can, 30 g, or a typed number), so the day shows what was
 *    actually eaten against the WHO limits. Entries without an amount (written by 98.1) are listed but never counted: no amount is ever guessed.
 *  - 99.0: every barcode is keyed as GTIN-14 (EAN-8, UPC-A, EAN-13 and GTIN-14 of one product are one record). */

export const MAX_COMPARE = 3;

export const num = v => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);
export const r1 = n => Math.round(n * 10) / 10;

/** The numbers of a product record, as the product model names them (src/domain/model.js: kcal, protein, carbohydrates, sugars, fat, saturatedFat, fiber, salt). */
export function numbers(p) {
  const n = p?.nutrition || {};
  return { kcal: num(n.kcal), carbs: num(n.carbohydrates), sugars: num(n.sugars), fat: num(n.fat), sat: num(n.saturatedFat), protein: num(n.protein), fiber: num(n.fiber), salt: num(n.salt) };
}

const fold = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const ALCOHOL = /alcoholic|\bbeers?\b|\bwines?\b|\bspirits?\b|liqueur|vodka|whisk|brandy|\brum\b|\bgin\b|cider|ouzo|tsipouro|μπυρα|κρασι|οινοπνευμ|αλκοολουχ/;
const NO_ALCOHOL = /non[- ]?alcoholic|alcohol[- ]?free|\bsans alcool|χωρις αλκοολ|μη αλκοολουχ|αναλκοολ/;   // "en:non-alcoholic-beverages" is a soft drink, not a beer
export const isAlcoholic = p => { const ctx = fold(`${(p?.categories || []).join(' ')} ${p?.name || ''}`); return !NO_ALCOHOL.test(ctx) && ALCOHOL.test(ctx); };
const POLYOLS = /polyol|sorbitol|maltitol|xylitol|erythritol|isomalt|mannitol|lactitol|sugar alcohol|πολυολ|σορβιτολ|μαλτιτολ|ξυλιτολ|ερυθριτολ|ισομαλτ|μαννιτολ|λακτιτολ/;

/** Energy against the macros with the EU labelling factors. Returns null when a number is missing; { skip } when the macros cannot explain the energy
 *  (alcoholic drinks, sugar alcohols); else { rep, est, ok, dir }. Tolerance: 20 % or 25 kcal, whichever is larger (rounding on a label). */
export function energyCheck(p) {
  const n = numbers(p);
  if ([n.kcal, n.carbs, n.fat, n.protein].some(v => v == null)) return null;
  if (isAlcoholic(p)) return { skip: 'alcohol' };
  if (POLYOLS.test(fold(p.ingredients || ''))) return { skip: 'polyols' };
  const est = n.carbs * 4 + n.protein * 4 + n.fat * 9 + (n.fiber ?? 0) * 2;
  const ok = Math.abs(n.kcal - est) <= Math.max(25, est * 0.2);
  return { rep: n.kcal, est, ok, dir: n.kcal > est ? 'high' : 'low' };
}

/** What the card shows for one record. `dq` is the app's dataQuality(p); it alone decides "low". */
export function auditProduct(p, dq) {
  const n = numbers(p);
  const energy = energyCheck(p);
  const fields = [
    ['kcal', n.kcal != null], ['sugars', n.sugars != null], ['sat. fat', n.sat != null], ['salt', n.salt != null],
    ['protein', n.protein != null], ['fibre', n.fiber != null],
    ['ingredients', typeof p?.ingredients === 'string' ? p.ingredients.trim().length > 2 : Array.isArray(p?.ingredients) && p.ingredients.length > 0],
    ['NOVA', [1, 2, 3, 4].includes(Number(p?.nova))]
  ];
  const have = fields.filter(f => f[1]).length, missing = fields.filter(f => !f[1]).map(f => f[0]);
  const state = dq?.state || 'usable';
  const energyWarn = !!(energy && energy.ok === false);
  const tier = state === 'blocked' ? 'low' : (state === 'limited' || state === 'local' || have < 6 || energyWarn) ? 'med' : 'high';
  return { tier, energy, have, total: fields.length, missing, reasons: state === 'blocked' ? (dq.reasons || []) : [], n };
}

/* ---- My Lens: EU nutrition-claim thresholds ------------------------------------------------------------ */
const per = p => (p?.basis === 'ml' ? 'ml' : 'g');
export const LENSES = [
  { id: 'lowSugar', en: 'Low sugar', el: 'Χαμηλή ζάχαρη',
    ruleEn: 'EU “low sugars”: at most 5 g per 100 g, or 2.5 g per 100 ml', ruleEl: 'ΕΕ «χαμηλή ζάχαρη»: έως 5 g ανά 100 g ή 2,5 g ανά 100 ml',
    test: (n, p) => (n.sugars == null ? null : n.sugars <= (per(p) === 'ml' ? 2.5 : 5)) },
  { id: 'highProt', en: 'High protein', el: 'Υψηλή πρωτεΐνη',
    ruleEn: 'EU “high protein”: protein gives at least 20 % of the energy', ruleEl: 'ΕΕ «υψηλή πρωτεΐνη»: η πρωτεΐνη δίνει τουλάχιστον το 20% της ενέργειας',
    test: n => (n.protein == null || n.kcal == null || n.kcal <= 0 ? null : (n.protein * 4) / n.kcal >= 0.2) },
  { id: 'lowSalt', en: 'Low salt', el: 'Χαμηλό αλάτι',
    ruleEn: 'EU “low salt”: at most 0.3 g salt (0.12 g sodium) per 100 g or 100 ml', ruleEl: 'ΕΕ «χαμηλό αλάτι»: έως 0,3 g αλάτι (0,12 g νάτριο) ανά 100 g ή 100 ml',
    test: n => (n.salt == null ? null : n.salt <= 0.3) },
  { id: 'highFiber', en: 'High fibre', el: 'Πλούσιο σε φυτικές ίνες',
    ruleEn: 'EU “high fibre”: at least 6 g per 100 g', ruleEl: 'ΕΕ «υψηλή περιεκτικότητα σε φυτικές ίνες»: τουλάχιστον 6 g ανά 100 g',
    test: n => (n.fiber == null ? null : n.fiber >= 6) },
  { id: 'lessProc', en: 'Not ultra-processed', el: 'Όχι υπερεπεξεργασμένο',
    ruleEn: 'NOVA group 1 to 3 (not group 4, ultra-processed)', ruleEl: 'Ομάδα NOVA 1 έως 3 (όχι η 4, υπερεπεξεργασμένα)',
    test: (n, p) => ([1, 2, 3, 4].includes(Number(p?.nova)) ? Number(p.nova) <= 3 : null) }
];
/** true / false / null (unknown) for one lens id on a product-like record: { nutrition... } or the flat compare record. */
export function lensVerdict(id, rec) {
  const def = LENSES.find(l => l.id === id);
  if (!def || !rec) return null;
  const flat = rec.nutrition ? numbers(rec) : { kcal: num(rec.kcal), sugars: num(rec.sugars), protein: num(rec.protein), fiber: num(rec.fiber), salt: num(rec.salt) };
  return def.test(flat, rec);
}

/* ---- Daily check-in -------------------------------------------------------------------------------------- */
const dayMs = 86400000;
const toUtc = day => Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10));
const fromUtc = ms => new Date(ms).toISOString().slice(0, 10);

/** Consecutive days with a check-in, ending today (or yesterday, so the streak is not lost before today's first check-in). Day strings are local calendar dates. */
export function computeStreak(days, today) {
  const set = new Set([...days].filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)));
  if (!set.size) return 0;
  let ms = toUtc(today);
  if (!set.has(fromUtc(ms))) ms -= dayMs;
  let streak = 0;
  while (set.has(fromUtc(ms))) { streak++; ms -= dayMs; }
  return streak;
}

/** Averages over the foods logged today: per 100 g (or ml) of those foods, NOT the amount eaten. null when no logged food has the number. */
export function dayStats(rows) {
  const avg = key => { const v = rows.map(r => r[key]).filter(x => x != null); return v.length ? r1(v.reduce((a, b) => a + b, 0) / v.length) : null; };
  return { count: rows.length, sugars: avg('sugars'), salt: avg('salt') };
}

/* ---- Backup ----------------------------------------------------------------------------------------------- */
export const BACKUP_KEY = /^(?:fs13:|foodscan[:.])/;
export const BACKUP_MAX_CHARS = 3_000_000;
/** Validates a backup file's text and returns [key, value] pairs to restore. Throws on anything that is not a FoodScan backup. */
export function parseBackup(text) {
  if (typeof text !== 'string' || text.length > BACKUP_MAX_CHARS) throw new Error('too_large');
  const doc = JSON.parse(text);
  if (!doc || doc.app !== 'FoodScan' || typeof doc.data !== 'object' || !doc.data || Array.isArray(doc.data)) throw new Error('invalid_backup');
  const out = [];
  for (const [k, v] of Object.entries(doc.data)) if (BACKUP_KEY.test(k) && typeof v === 'string') out.push([k, v]);
  if (!out.length) throw new Error('empty_backup');
  return out;
}

/* ---- 99.0: one key per product (GTIN-14) --------------------------------------------------------------------- */
/** The GTIN-14 key of a barcode: digits only, 8 (EAN-8), 12 (UPC-A), 13 (EAN-13) or 14 digits, padded with zeros on the left. The same product
 *  scanned as UPC-A, EAN-13 or GTIN-14 is therefore one record, not three. null for anything else (a typo, a QR code, text). */
export function gtin14(code) {
  const s = String(code ?? '').trim();
  return /^\d+$/.test(s) && [8, 12, 13, 14].includes(s.length) ? s.padStart(14, '0') : null;
}
/** GS1 mod-10 check digit. A code that fails it was probably mis-scanned; it still gets a key (it must never hide), the caller may warn. */
export function gtinCheckOk(code) {
  const k = gtin14(code);
  if (!k) return false;
  let sum = 0;
  for (let i = 0; i < 13; i++) sum += Number(k[i]) * (i % 2 === 0 ? 3 : 1);
  return (10 - (sum % 10)) % 10 === Number(k[13]);
}

/* ---- 99.0: portions ------------------------------------------------------------------------------------------ */
export const AMOUNT_MIN = 1, AMOUNT_MAX = 2000;   // g or ml of one check-in: 1 to 2,000
export const PACK_ONE_TAP_MAX = 600;              // 100.0: a pack or unit becomes a one-tap amount only up to 600 g or ml (cans, tubs, bars, single-serve bottles)
/** A typed amount ("250", "250 ml", "1,5") -> a number between AMOUNT_MIN and AMOUNT_MAX, else null. */
export function parseAmount(v) {
  const m = String(v ?? '').trim().replace(',', '.').match(/^(\d+(?:\.\d+)?)\s*(?:g|gr|ml|γρ)?$/i);
  if (!m) return null;
  const n = Math.round(Number(m[1]) * 10) / 10;
  return n >= AMOUNT_MIN && n <= AMOUNT_MAX ? n : null;
}
/** The pack size of a record's quantity text: "500 g", "1,5 L", "6 x 330 ml" -> { amount (one unit), unit: 'g'|'ml', count }. null when there is none. */
export function packOf(p) {
  const q = String(p?.quantity ?? '').toLowerCase().replace(',', '.');
  const m = q.match(/(?:(\d{1,2})\s*[x×]\s*)?(\d+(?:\.\d+)?)\s*(kg|g|mg|l|dl|cl|ml)\b/);
  if (!m) return null;
  const scale = { kg: 1000, g: 1, mg: 0.001, l: 1000, dl: 100, cl: 10, ml: 1 }[m[3]];
  const amount = Math.round(Number(m[2]) * scale * 10) / 10, unit = ['kg', 'g', 'mg'].includes(m[3]) ? 'g' : 'ml';
  return amount >= 5 && amount <= 1500 ? { amount, unit, count: m[1] ? Number(m[1]) : 1 } : null;
}
const GENERIC = {
  g: [{ kind: 'g', amount: 30 }, { kind: 'g', amount: 50 }, { kind: 'g', amount: 100 }, { kind: 'g', amount: 150 }],
  ml: [{ kind: 'glass', amount: 200 }, { kind: 'cup', amount: 250 }, { kind: 'can', amount: 330 }, { kind: 'bottle', amount: 500 }]
};
/** One-tap portions for a product, in the unit of its nutrition basis (g or ml): the product's own serving, one unit or the whole pack, then
 *  common sizes (30, 50, 100, 150 g, or a glass, cup, can, bottle). Same amount twice is shown once; at most 6. Each is { kind, amount, unit }. */
export function presetsFor(p) {
  const unit = p?.basis === 'ml' ? 'ml' : 'g', out = [], seen = new Set();
  const add = (kind, amount) => { const a = Math.round(amount * 10) / 10; if (a >= AMOUNT_MIN && a <= AMOUNT_MAX && !seen.has(a)) { seen.add(a); out.push({ kind, amount: a, unit }); } };
  const sa = num(p?.servingAmount);
  if (sa && (p.servingUnit || unit) === unit) add('serving', sa);
  const pk = packOf(p);
  if (pk && pk.unit === unit && pk.amount <= PACK_ONE_TAP_MAX) add(pk.count > 1 ? 'unit' : 'pack', pk.amount);   // a 1.5 L bottle is never one accidental tap (typing it still works)
  for (const g of GENERIC[unit]) add(g.kind, g.amount);
  return out.slice(0, 6);
}

/* ---- 99.0: what was eaten ------------------------------------------------------------------------------------ */
/** The stored check-in: the food's per-100 g (or per-100 ml) numbers and the amount eaten. null when the amount is not a valid number. */
export function logEntry(prod, amount, kind, { day, at, grade = null } = {}) {
  const a = num(amount), key = gtin14(prod?.barcode);
  if (a == null || a < AMOUNT_MIN || a > AMOUNT_MAX || !key) return null;
  const n = numbers(prod);
  return {
    day, at, barcode: String(prod.barcode), gtin: key, name: String(prod.name || prod.barcode).slice(0, 80), grade,
    basis: prod.basis === 'ml' ? 'ml' : 'g', grams: Math.round(a * 10) / 10, portion: String(kind || 'custom').slice(0, 12),
    kcal: n.kcal, sugars: n.sugars, salt: n.salt, sat: n.sat, protein: n.protein
  };
}
/** What one check-in contributed: the per-100 numbers times amount / 100. A number the food does not report stays null (never zero). */
export function entryIntake(e) {
  const g = num(e?.grams);
  if (!g) return null;
  const mul = v => (num(v) == null ? null : (num(v) * g) / 100);
  return { kcal: mul(e.kcal), sugars: mul(e.sugars), salt: mul(e.salt), sat: mul(e.sat), protein: mul(e.protein) };
}
const KEYS = ['kcal', 'sugars', 'salt', 'sat', 'protein'];
/** The day so far. `totals` adds only the check-ins that have an amount AND the number; `missing[k]` is how many counted check-ins lack that number (so a
 *  total can be a lower bound and the screen says so); `uncounted` is the check-ins without an amount (written by 98.1). A total is null when nothing contributed. */
export function dayIntake(entries) {
  const totals = Object.fromEntries(KEYS.map(k => [k, null])), missing = Object.fromEntries(KEYS.map(k => [k, 0]));
  let counted = 0, uncounted = 0;
  for (const e of entries) {
    const it = entryIntake(e);
    if (!it) { uncounted++; continue; }
    counted++;
    for (const k of KEYS) { if (it[k] == null) missing[k]++; else totals[k] = (totals[k] ?? 0) + it[k]; }
  }
  for (const k of KEYS) if (totals[k] != null) totals[k] = k === 'kcal' ? Math.round(totals[k]) : k === 'salt' ? Math.round(totals[k] * 100) / 100 : r1(totals[k]);   // salt to 0.01 g: a spoonful holds 0.02 g
  return { entries: entries.length, counted, uncounted, totals, missing };
}
/** Daily reference values. Sugars: WHO, free sugars under 10 % of energy (about 50 g on 2,000 kcal), under 5 % (25 g) is better. Salt: WHO, under 5 g.
 *  Saturated fat: WHO, under 10 % of energy (22 g on 2,000 kcal). Energy: the EU reference intake of 2,000 kcal (a label's reference, not advice for one person).
 *  FoodScan counts all sugars on the label (milk and fruit sugar too), so its sugar total is an upper estimate of free sugars. */
export const LIMITS = { sugars: 50, sugarsBetter: 25, salt: 5, sat: 22, kcal: 2000 };
/** A total against a limit: percent (rounded, as shown), a bar width capped at 100, and 'ok' (shown under 75 %), 'near' (75 % up to the limit) or 'over'
 *  (the exact total is above the limit: 50.1 g of 50 g shows "100 %" and is over). null when there is no total. */
export function progress(value, limit) {
  if (value == null || !(limit > 0)) return null;
  const ratio = value / limit, pct = Math.round(ratio * 100);
  return { pct, bar: Math.min(100, pct), state: ratio > 1 ? 'over' : pct >= 75 ? 'near' : 'ok' };
}
/** The last amount chosen for each food (by GTIN-14), newest 200 kept: the next check-in of the same food is one tap. */
export function rememberPortion(map, key, amount, kind, at, keep = 200) {
  const next = { ...(map && typeof map === 'object' && !Array.isArray(map) ? map : {}) };
  if (key && num(amount) != null) next[key] = { amount: num(amount), kind: String(kind || 'custom').slice(0, 12), at };
  const rows = Object.entries(next).filter(([k, v]) => /^\d{14}$/.test(k) && num(v?.amount) != null).sort((a, b) => (b[1].at || 0) - (a[1].at || 0)).slice(0, keep);
  return Object.fromEntries(rows);
}

/* ---- 100.0: the shopper's own label numbers ----------------------------------------------------------------------
 * The label reader (prices/reader-v85.js) keeps what the shopper typed or confirmed from a photo of the nutrition table under fs85:label:<code>. Those numbers
 * replace the database's, field by field, wherever the shopper gave one, so the data check, the compare tray and the check-in use them. */
const LABEL_KEY = /^fs85:label:(\d{8,14})$/;
/** The GTIN-14 of a label storage key (fs85:label:<code>), or null. */
export function labelCode(storageKey) { const m = LABEL_KEY.exec(String(storageKey || '')); return m ? gtin14(m[1]) : null; }
/** Per-100 numbers in the product model's names from a saved label ({ v: 2, values, basis, serving, kind, model }); a label printed per serving is scaled with
 *  the serving size the shopper entered (null without one). null when the record is not usable. */
export function labelNutrition(saved) {
  if (!saved || saved.v !== 2 || !saved.values || typeof saved.values !== 'object') return null;
  let v = saved.values;
  if (saved.basis === 'serving') {
    const s = num(saved.serving);
    if (!s || s <= 0) return null;
    const k = 100 / s;
    v = Object.fromEntries(Object.entries(v).map(([key, x]) => [key, num(x) == null ? null : key === 'kj' || key === 'kcal' ? Math.round(x * k) : Math.round(x * k * 100) / 100]));
  }
  const kcal = num(v.kcal) ?? (num(v.kj) != null ? Math.round(v.kj / 4.184) : null);
  const nutrition = { kcal, carbohydrates: num(v.carbs), sugars: num(v.sugars), fat: num(v.fat), saturatedFat: num(v.sat), protein: num(v.protein), fiber: num(v.fibre), salt: num(v.salt) };
  if (Object.values(nutrition).every(x => x == null)) return null;
  const kind = String(saved.kind || 'general'), grade = /^[A-E]$/.test(String(saved.model?.grade || '')) ? saved.model.grade : null;
  return { nutrition, basis: kind === 'beverage' || kind === 'water' ? 'ml' : null, grade, kind };
}
/** A product record with the shopper's label numbers on top (fields the label does not give keep the database value). Marks it labelPhoto, and labelGrade when
 *  the reader calculated an exact letter. The record is returned unchanged when there is no usable label. */
export function mergeLabel(p, saved) {
  const L = labelNutrition(saved);
  if (!L || !p) return p;
  const nutrition = { ...(p.nutrition || {}) };
  for (const [k, x] of Object.entries(L.nutrition)) if (x != null) nutrition[k] = x;
  return { ...p, nutrition, basis: L.basis || p.basis, labelPhoto: true, labelGrade: L.grade };
}

/* ---- 100.0: where a grade comes from -------------------------------------------------------------------------------- */
/** One answer to "where does this grade come from": 'published' (the source's own Nutri-Score, Open Food Facts), 'calculated' (FoodScan's calculation from the
 *  record's own numbers), 'similar' (an explained estimate from similar products), 'label' (the shopper's own label numbers) or 'none'.
 *  status/grade: the app's assessGrade(); quick: the kind of the estimate the grade card made ('quick', 'similar' or 'none'); label: a usable saved label. */
export function provenance({ status, grade, quick, label } = {}) {
  const letter = /^[A-E]$/.test(String(grade || ''));
  if (letter && status === 'reported') return 'published';
  if (label) return 'label';
  if (letter && status === 'estimated') return 'calculated';
  if (quick === 'similar') return 'similar';
  if (quick === 'quick') return 'calculated';
  return 'none';
}

/* ---- 100.0: the last 7 days ------------------------------------------------------------------------------------------ */
/** Seven days ending today: per day the check-ins and (from check-ins with an amount) sugars and salt; days logged; averages over the days that have amounts
 *  only (a day with only old no-amount entries is not averaged); days over the sugar and salt limits. */
export function weekPulse(entries, today) {
  const t0 = toUtc(today), days = [];
  for (let i = 6; i >= 0; i--) days.push(fromUtc(t0 - i * dayMs));
  const byDay = new Map(days.map(d => [d, []]));
  for (const e of entries || []) if (byDay.has(e?.day)) byDay.get(e.day).push(e);
  const rows = days.map(day => { const d = dayIntake(byDay.get(day)); return { day, entries: d.entries, counted: d.counted, sugars: d.totals.sugars, salt: d.totals.salt }; });
  const withAmounts = rows.filter(r => r.counted > 0);
  const avg = (k, dp) => { const v = withAmounts.map(r => r[k]).filter(x => x != null); return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * dp) / dp : null; };
  return {
    rows, daysLogged: rows.filter(r => r.entries > 0).length, daysCounted: withAmounts.length,
    avgSugars: avg('sugars', 10), avgSalt: avg('salt', 100),
    daysOverSugar: rows.filter(r => r.sugars != null && r.sugars > LIMITS.sugars).length, daysOverSalt: rows.filter(r => r.salt != null && r.salt > LIMITS.salt).length
  };
}
/** 100.1: the week card is drawn only when it has something to say: at least two days with an amount (one day is not a week, and check-ins written before amounts
 *  existed cannot be charted: a card of blank bars about them is clutter). */
export const WEEK_MIN_DAYS = 2;
export const weekReady = pulse => Number(pulse?.daysCounted) >= WEEK_MIN_DAYS;

/* ---- 100.0: swap list ("Swap and save") ------------------------------------------------------------------------------ */
export const LIST_MAX = 30;
const RANK = { A: 0, B: 1, C: 2, D: 3, E: 4 };
const letterOf = g => (/^[A-E]$/.test(String(g || '')) ? String(g) : null);
/** Adds a healthier product to the list (newest first, one row per product, at most LIST_MAX). item: { code, name, brand, grade, forCode, forName, forGrade }. */
export function listAdd(list, item, at) {
  const base = Array.isArray(list) ? list : [], key = gtin14(item?.code);
  if (!key || !String(item?.name || '').trim()) return base;
  const row = { gtin: key, code: String(item.code), name: String(item.name).trim().slice(0, 80), brand: String(item.brand || '').trim().slice(0, 48), grade: letterOf(item.grade),
    forGtin: gtin14(item.forCode), forCode: gtin14(item.forCode) ? String(item.forCode) : null, forName: String(item.forName || '').trim().slice(0, 80), forGrade: letterOf(item.forGrade), at };
  return [row, ...base.filter(x => x?.gtin !== key)].slice(0, LIST_MAX);
}
export const listRemove = (list, key) => (Array.isArray(list) ? list : []).filter(x => x?.gtin !== key);
/** Grade steps a swap gains over the product it replaces (E to A is 4); null when either grade is unknown. */
export function gradeGain(item) { const a = RANK[item?.grade], b = RANK[item?.forGrade]; return a == null || b == null ? null : b - a; }
/** The list in numbers. prices: Map or object, GTIN-14 -> { price, currency, older, unitPrice, unitBasis } (the line the price rows show). Totals add CURRENT prices only
 *  (not an older recorded one) and only in one currency; the unit-price comparison uses the same rule as the swap rows (both current, same basis); nothing is estimated. */
export function listSummary(list, prices) {
  const get = k => (prices instanceof Map ? prices.get(k) : prices?.[k]) || null, rows = Array.isArray(list) ? list : [];
  let graded = 0, improved = 0, gain = 0, priced = 0, current = 0, total = 0, cheaper = 0, dearer = 0, best = null;
  const cur = new Set();
  for (const it of rows) {
    const g = gradeGain(it);
    if (g != null) { graded++; if (g > 0) { improved++; gain += g; if (!best || g > gradeGain(best)) best = it; } }
    const line = get(it.gtin);
    if (line && line.price > 0) { priced++; if (!line.older) { current++; total += line.price; cur.add(line.currency || 'EUR'); } }
    const here = it.forGtin ? get(it.forGtin) : null;
    if (line && here && !line.older && !here.older && line.unitPrice > 0 && here.unitPrice > 0 && line.unitBasis === here.unitBasis) {
      const d = line.unitPrice - here.unitPrice;
      if (Math.abs(d) >= 0.01) { if (d < 0) cheaper++; else dearer++; }
    }
  }
  return { count: rows.length, graded, improved, gain, priced, current, total: cur.size === 1 ? Math.round(total * 100) / 100 : null, currency: cur.size === 1 ? [...cur][0] : null, cheaper, dearer, best };
}
