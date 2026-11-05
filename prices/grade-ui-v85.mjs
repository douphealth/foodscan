/* FoodScan 85: how a calculated grade is shown. One component for the quick estimate and for the exact grade from a label photo, so that both say the same things in the same
 * order: the letter, how sure we are, what the algorithm used, every number it used and the points each one earned, what was not reported and what could change the letter,
 * where the numbers come from, and how well this kind of estimate has agreed with published grades. Pure HTML builder (no DOM access), English and Greek.
 * The numbers in RELIABILITY are floors of what tools/quick-grade-validate.mjs measures; qa/quick-grade.test.mjs fails if they ever exceed it. */
import { esc } from './price-core-v83.mjs';

/** Percent of graded Greek products (categories hidden) for which the published letter was inside the shown band, and for which the "most likely" letter equalled it. */
export const RELIABILITY = { inside: { high: 96, medium: 93, low: 76 }, likely: { high: 94, medium: 89, low: 63 }, sample: 4103 };

const T = {
  en: {
    quick: 'Quick grade', estimate: 'Estimate', fromLabel: 'From your label', calc: 'Calculated', method: 'Nutri-Score 2023',
    likely: g => `Most likely ${g}`, between: (a, b) => `Between ${a} and ${b}`, one: g => `Grade ${g}`, exactTitle: g => `Nutri-Score ${g}`,
    words: { A: 'Excellent nutrient profile', B: 'Good nutrient profile', C: 'Fair nutrient profile', D: 'Poor nutrient profile', E: 'Very poor nutrient profile' },
    proof: 'Calculated by FoodScan with the official Nutri-Score 2023 algorithm, from this product’s nutritional facts as recorded in Open Food Facts.',
    proofLabel: 'Calculated by FoodScan with the official Nutri-Score 2023 algorithm, from the numbers you confirmed against the label.',
    notOfficial: 'This is FoodScan’s own calculation, not a grade printed on the pack or published by the producer. If the pack shows a Nutri-Score, trust the pack.',
    notOfficialLabel: 'This is FoodScan’s own calculation from your numbers, not a grade printed on the pack or published by the producer.',
    scaleLabel: (likely, band) => `Scale from A to E. ${likely ? `Most likely ${likely}. ` : ''}Possible: ${band}.`, likelyTag: 'likely', possibleTag: 'possible',
    gaugeTitle: 'Nutri-Score points (lower is better)', gaugeMark: s => `${s} points`,
    couldBe: 'What could change it', reasonsTitle: 'Why this is an estimate', factsTitle: 'Nutritional facts used', factsSub: u => `per 100 ${u}`, pointsTitle: 'How the points add up',
    against: 'Points against (unfavourable)', infavour: 'Points in favour', scoreIs: 'Score = points against − points in favour', ladderTitle: 'Letter ranges for this table',
    reported: 'On record', notReported: 'Not reported', notScored: 'not scored', counted: 'counted', notCounted: n => `not counted: ${n} or more points against it`, upTo: n => `up to ${n} points`,
    fields: { energy: 'Energy', sugars: 'Sugars', saturated_fat: 'Saturated fat', salt: 'Salt', sweeteners: 'Sweeteners', fiber: 'Fibre', proteins: 'Protein', fruits_vegetables_legumes: 'Fruit, vegetables, legumes and nuts',
      energy_from_saturated_fat: 'Energy from saturated fat', saturated_fat_ratio: 'Saturated fat as share of fat', fat: 'Fat', carbs: 'Carbohydrate', kcal: 'Energy' },
    against1: 'unfavourable', favour1: 'favourable',
    kinds: { general: 'General foods', beverage: 'Drinks', water: 'Water', cheese: 'Cheese', fat: 'Fats, oils, nuts and seeds' },
    tableLine: k => `Table used: ${k}.`,
    why: {
      table: k => `The record has no confirmed category, so FoodScan chose the table (${k}) from the product’s name, its unit and its figures. If that is wrong the letter can move.`,
      tableCat: k => `The table (${k}) follows the category on record.`,
      unreported: l => `Not reported on record: ${l}. These can only lower the points, so the most likely letter assumes they are zero and the band shows how good it could be.`,
      bound: (label, how, max) => how === 'cap' ? `${label} is not on record. It was assumed to be at most ${max} g per 100 g (true for 96 % of graded products), so a band is shown instead of one letter.`
        : `${label} is not on record. It can be at most ${max} g per 100 g because of the ${how === 'carbohydrate' ? 'carbohydrate' : how === 'fat' ? 'fat' : 'energy'} on record, so a band is shown instead of one letter.`,
      basis: 'The record does not say whether the numbers are per 100 g or per serving. Per 100 g was assumed.',
      sweeteners: 'For drinks, sweeteners add 4 points. The record does not list ingredients, so none were assumed.',
      low: 'Drinks, and cheeses recognised only by their figures, are the least certain: the table and sweeteners can move the letter.',
      meat: 'The product may contain red meat, which limits the protein points. Both cases were checked.',
    },
    moves: { fibre: (v, g) => `fibre is ${v} g or more`, protein: (v, g) => `protein is ${v} g or more`, fvl: (v, g) => `more than ${v - 1} % of it is fruit, vegetables, legumes or nuts` },
    moveLine: (cond, g) => `It would be ${g} if ${cond}. The record does not say.`,
    source: 'Source', sourceLine: (code, when, snap) => `Open Food Facts, barcode ${code}${when ? `, record updated ${when}` : ''}${snap ? ', saved catalogue copy' : ''}.`,
    reliability: 'How reliable is this kind of estimate?',
    reliabilityLine: (inside, likelyP, n) => `We tested the method on ${n.toLocaleString('en')} Greek products that have a published grade, with their categories hidden. The published letter was inside bands like this one in about ${inside} % of cases${likelyP ? `, and the “most likely” letter was exactly the published one in about ${likelyP} %` : ''}.`,
    reliabilityNote: 'Open Food Facts’ own letter is not a perfect reference, so some differences are its errors.',
    userNumbers: 'Numbers you confirmed against the label photo.', check: 'Check it against the label photo', again: 'Edit the numbers', remove: 'Remove', closeAll: 'Show less',
    assumed0: 'assumed 0 points', assumedAtMost: n => `assumed at most ${n} g`, pts: 'pts', alsoOnRecord: 'Also on record',
    gaugeLetters: 'Where the letters start', partialNote: 'The totals are incomplete because one number is missing; the band covers every value it could take.',
  },
  el: {
    quick: 'Γρήγορος βαθμός', estimate: 'Εκτίμηση', fromLabel: 'Από την ετικέτα σας', calc: 'Υπολογισμένος', method: 'Nutri-Score 2023',
    likely: g => `Πιθανότερα ${g}`, between: (a, b) => `Από ${a} έως ${b}`, one: g => `Βαθμός ${g}`, exactTitle: g => `Nutri-Score ${g}`,
    words: { A: 'Εξαιρετικό διατροφικό προφίλ', B: 'Καλό διατροφικό προφίλ', C: 'Μέτριο διατροφικό προφίλ', D: 'Φτωχό διατροφικό προφίλ', E: 'Πολύ φτωχό διατροφικό προφίλ' },
    proof: 'Υπολογίστηκε από το FoodScan με τον επίσημο αλγόριθμο Nutri-Score 2023, από τα διατροφικά στοιχεία του προϊόντος όπως είναι καταγεγραμμένα στο Open Food Facts.',
    proofLabel: 'Υπολογίστηκε από το FoodScan με τον επίσημο αλγόριθμο Nutri-Score 2023, από τους αριθμούς που επιβεβαιώσατε με την ετικέτα.',
    notOfficial: 'Είναι δικός μας υπολογισμός του FoodScan, όχι βαθμός τυπωμένος στη συσκευασία ή δημοσιευμένος από τον παραγωγό. Αν η συσκευασία έχει Nutri-Score, εμπιστευθείτε τη συσκευασία.',
    notOfficialLabel: 'Είναι δικός μας υπολογισμός του FoodScan από τους αριθμούς σας, όχι βαθμός τυπωμένος στη συσκευασία ή δημοσιευμένος από τον παραγωγό.',
    scaleLabel: (likely, band) => `Κλίμακα από A έως E. ${likely ? `Πιθανότερα ${likely}. ` : ''}Πιθανά: ${band}.`, likelyTag: 'πιθανότερο', possibleTag: 'πιθανό',
    gaugeTitle: 'Βαθμοί Nutri-Score (χαμηλότερα = καλύτερα)', gaugeMark: s => `${s} βαθμοί`,
    couldBe: 'Τι μπορεί να το αλλάξει', reasonsTitle: 'Γιατί είναι εκτίμηση', factsTitle: 'Διατροφικά στοιχεία που χρησιμοποιήθηκαν', factsSub: u => `ανά 100 ${u}`, pointsTitle: 'Πώς προκύπτουν οι βαθμοί',
    against: 'Βαθμοί εναντίον (δυσμενείς)', infavour: 'Βαθμοί υπέρ', scoreIs: 'Σκορ = βαθμοί εναντίον − βαθμοί υπέρ', ladderTitle: 'Εύρη γραμμάτων σε αυτόν τον πίνακα',
    reported: 'Καταγεγραμμένο', notReported: 'Δεν αναγράφεται', notScored: 'δεν βαθμολογείται', counted: 'μετράει', notCounted: n => `δεν μετράει: ${n} ή περισσότεροι βαθμοί εναντίον`, upTo: n => `έως ${n} βαθμούς`,
    fields: { energy: 'Ενέργεια', sugars: 'Σάκχαρα', saturated_fat: 'Κορεσμένα λιπαρά', salt: 'Αλάτι', sweeteners: 'Γλυκαντικά', fiber: 'Φυτικές ίνες', proteins: 'Πρωτεΐνες', fruits_vegetables_legumes: 'Φρούτα, λαχανικά, όσπρια και ξηροί καρποί',
      energy_from_saturated_fat: 'Ενέργεια από κορεσμένα λιπαρά', saturated_fat_ratio: 'Κορεσμένα ως ποσοστό των λιπαρών', fat: 'Λιπαρά', carbs: 'Υδατάνθρακες', kcal: 'Ενέργεια' },
    against1: 'δυσμενές', favour1: 'ευνοϊκό',
    kinds: { general: 'Γενικά τρόφιμα', beverage: 'Ροφήματα', water: 'Νερό', cheese: 'Τυρί', fat: 'Λιπαρά, λάδια, ξηροί καρποί και σπόροι' },
    tableLine: k => `Πίνακας που εφαρμόστηκε: ${k}.`,
    why: {
      table: k => `Η εγγραφή δεν έχει επιβεβαιωμένη κατηγορία, γι' αυτό το FoodScan επέλεξε τον πίνακα (${k}) από το όνομα, τη μονάδα και τα στοιχεία του προϊόντος. Αν αυτό είναι λάθος, το γράμμα μπορεί να αλλάξει.`,
      tableCat: k => `Ο πίνακας (${k}) ακολουθεί την κατηγορία της εγγραφής.`,
      unreported: l => `Δεν αναγράφονται στην εγγραφή: ${l}. Μπορούν μόνο να μειώσουν τους βαθμούς, οπότε το πιθανότερο γράμμα τα θεωρεί μηδέν και η ζώνη δείχνει πόσο καλό θα μπορούσε να είναι.`,
      bound: (label, how, max) => how === 'cap' ? `Το στοιχείο «${label}» δεν υπάρχει στην εγγραφή. Θεωρήθηκε το πολύ ${max} g ανά 100 g (ισχύει στο 96 % των προϊόντων με βαθμό), γι' αυτό δείχνουμε ζώνη αντί για ένα γράμμα.`
        : `Το στοιχείο «${label}» δεν υπάρχει στην εγγραφή. Δεν μπορεί να ξεπερνά τα ${max} g ανά 100 g λόγω ${how === 'carbohydrate' ? 'των υδατανθράκων' : how === 'fat' ? 'των λιπαρών' : 'της ενέργειας'} που υπάρχουν στην εγγραφή, γι' αυτό δείχνουμε ζώνη αντί για ένα γράμμα.`,
      basis: 'Η εγγραφή δεν λέει αν οι αριθμοί αφορούν 100 g ή μερίδα. Θεωρήθηκαν 100 g.',
      sweeteners: 'Στα ροφήματα τα γλυκαντικά προσθέτουν 4 βαθμούς. Η εγγραφή δεν έχει συστατικά, οπότε δεν θεωρήθηκαν γλυκαντικά.',
      low: 'Τα ροφήματα και τα τυριά που αναγνωρίζονται μόνο από τα στοιχεία τους είναι τα λιγότερο βέβαια: ο πίνακας και τα γλυκαντικά μπορούν να αλλάξουν το γράμμα.',
      meat: 'Το προϊόν μπορεί να περιέχει κόκκινο κρέας, που περιορίζει τους βαθμούς πρωτεΐνης. Ελέγχθηκαν και οι δύο περιπτώσεις.',
    },
    moves: { fibre: (v, g) => `οι φυτικές ίνες είναι ${v} g ή περισσότερες`, protein: (v, g) => `η πρωτεΐνη είναι ${v} g ή περισσότερη`, fvl: (v, g) => `περισσότερο από ${v - 1} % είναι φρούτα, λαχανικά, όσπρια ή ξηροί καρποί` },
    moveLine: (cond, g) => `Θα ήταν ${g} αν ${cond}. Η εγγραφή δεν το αναφέρει.`,
    source: 'Πηγή', sourceLine: (code, when, snap) => `Open Food Facts, barcode ${code}${when ? `, εγγραφή ενημερωμένη ${when}` : ''}${snap ? ', αποθηκευμένο αντίγραφο καταλόγου' : ''}.`,
    reliability: 'Πόσο αξιόπιστη είναι αυτή η εκτίμηση;',
    reliabilityLine: (inside, likelyP, n) => `Δοκιμάσαμε τη μέθοδο σε ${n.toLocaleString('el')} ελληνικά προϊόντα που έχουν δημοσιευμένο βαθμό, με κρυμμένες τις κατηγορίες τους. Το δημοσιευμένο γράμμα βρισκόταν μέσα σε ζώνες σαν αυτή σε περίπου ${inside} % των περιπτώσεων${likelyP ? ` και το «πιθανότερο» γράμμα ήταν ακριβώς το δημοσιευμένο σε περίπου ${likelyP} %` : ''}.`,
    reliabilityNote: 'Το γράμμα του Open Food Facts δεν είναι τέλειο σημείο αναφοράς, οπότε μερικές διαφορές είναι λάθη του.',
    userNumbers: 'Αριθμοί που επιβεβαιώσατε με τη φωτογραφία της ετικέτας.', check: 'Έλεγχος με φωτογραφία της ετικέτας', again: 'Επεξεργασία αριθμών', remove: 'Αφαίρεση', closeAll: 'Λιγότερα',
    assumed0: 'θεωρήθηκε 0 βαθμοί', assumedAtMost: n => `θεωρήθηκε το πολύ ${n} g`, pts: 'βαθμ.', alsoOnRecord: 'Επίσης καταγεγραμμένα',
    gaugeLetters: 'Πού ξεκινά κάθε γράμμα', partialNote: 'Τα σύνολα είναι ελλιπή επειδή λείπει ένας αριθμός· η ζώνη καλύπτει κάθε τιμή που θα μπορούσε να έχει.',
  },
};
const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const fmt = (v, L) => (v == null ? '' : new Intl.NumberFormat(L === 'el' ? 'el-GR' : 'en-GB', { maximumFractionDigits: v < 10 ? 2 : 1 }).format(v));
const idx = g => LETTERS.indexOf(g);

/** Position (0..1) of a score on the gauge: five equal segments, one per letter; inside a segment the score is placed by its place in the letter's range. */
export function gaugePosition(score, ladder) {
  for (let i = 0; i < 5; i++) {
    const [lo, hi] = ladder[LETTERS[i]] || [null, null];
    const a = lo === null ? (hi ?? 0) - 8 : lo, b = hi === null ? a + 10 : hi;
    if ((lo === null || score >= lo) && (hi === null || score <= hi)) return (i + Math.min(1, Math.max(0, (score - a + 0.5) / (b - a + 1)))) / 5;
  }
  return score < 0 ? 0.02 : 0.98;
}

/** The whole card. `m` is the model of prices/quick-grade-v85.mjs; `o`: { lang, kind: 'estimate' | 'label', code, modified (ms), snapshot, actions: bool }. */
export function gradeHTML(m, o = {}) {
  const L = o.lang === 'el' ? 'el' : 'en', t = T[L], label = o.kind === 'label', letters = m.letters, band = letters.length > 1, likely = m.likely, head = likely || (letters.length === 1 ? letters[0] : null);
  const seal = head || letters[Math.floor(letters.length / 2)], first = letters[0], last = letters.at(-1);
  const title = band ? (likely ? t.likely(likely) : t.between(first, last)) : label ? t.exactTitle(head) : t.one(head);
  const word = head ? t.words[head] : t.between(first, last);
  const kindName = t.kinds[m.kind || m.kinds?.[0]] || '';
  // scale
  const pills = LETTERS.map(g => { const inB = letters.includes(g), isL = g === head && (likely || letters.length === 1); return `<li class="fg85__pill g-${g} ${isL ? 'is-likely' : inB ? 'is-possible' : 'is-out'}"><b>${g}</b>${isL && letters.length > 1 ? `<small>${esc(t.likelyTag)}</small>` : ''}</li>`; }).join('');
  // gauge
  const pos = m.score != null && m.ladder ? gaugePosition(m.score, m.ladder) : null, from = idx(first) / 5, to = (idx(last) + 1) / 5;
  const ticks = m.ladder ? LETTERS.slice(1).map((g, i) => { const lo = m.ladder[g]?.[0]; return lo == null ? '' : `<span style="left:${((i + 1) / 5) * 100}%">${lo}</span>`; }).join('') : '';
  const gauge = m.ladder ? `<div class="fg85__gauge" aria-hidden="true"><div class="fg85__track">${LETTERS.map(g => `<i class="g-${g} ${letters.includes(g) ? '' : 'is-out'}"></i>`).join('')}${band ? `<span class="fg85__band" style="left:${from * 100}%;width:${(to - from) * 100}%"></span>` : ''}${pos != null ? `<span class="fg85__mark${pos < 0.16 ? ' is-l' : pos > 0.84 ? ' is-r' : ''}" style="left:${pos * 100}%"><em>${esc(t.gaugeMark(m.score))}</em></span>` : ''}</div><div class="fg85__ticks">${ticks}</div></div>` : '';
  // what could change it
  const moveLines = (m.movers || []).map(x => t.moveLine(t.moves[x.key](x.value, x.becomes), x.becomes));
  // reasons
  const reasons = [];
  if (label) { const unr = (m.missing || []).filter(x => x !== 'sweeteners'); if (unr.length) reasons.push(t.why.unreported(unr.map(x => (x === 'fruit, vegetables and legumes' ? t.fields.fruits_vegetables_legumes.toLowerCase() : x === 'fibre' ? t.fields.fiber.toLowerCase() : x === 'protein' ? t.fields.proteins.toLowerCase() : x)).join(', '))); }
  if (!label) {
    reasons.push(m.inferredKind ? t.why.table(kindName.toLowerCase()) : t.why.tableCat(kindName.toLowerCase()));
    const unr = (m.missing || []).filter(x => x !== 'sweeteners'); if (unr.length) reasons.push(t.why.unreported(unr.map(x => (x === 'fruit, vegetables and legumes' ? t.fields.fruits_vegetables_legumes.toLowerCase() : x === 'fibre' ? t.fields.fiber.toLowerCase() : x === 'protein' ? t.fields.proteins.toLowerCase() : x)).join(', ')));
    if (m.bound) reasons.push(t.why.bound(t.fields[m.bound.key === 'saturatedFat' ? 'saturated_fat' : m.bound.key], m.bound.how, fmt(m.bound.max, L)));
    if (m.basisAssumed) reasons.push(t.why.basis);
    if (m.sweetenersUnknown) reasons.push(t.why.sweeteners);
    if (m.confidence === 'low') reasons.push(t.why.low);
  }
  // facts table
  const d = m.data, inp = m.inputs || {}, unitOf = m.kind === 'beverage' || m.kind === 'water' ? 'ml' : 'g';
  const reportedKey = { fiber: inp.fibre != null, proteins: inp.protein != null, fruits_vegetables_legumes: inp.fvl != null };
  const tile = (part, side) => {
    const isBound = Boolean(m.bound && ((m.bound.key === 'salt' && part.id === 'salt') || (m.bound.key === 'sugars' && part.id === 'sugars') || (m.bound.key === 'saturatedFat' && part.id === 'saturated_fat')));
    const unr = reportedKey[part.id] === false || isBound;
    const frac = part.max ? Math.min(1, part.points / part.max) : 0, val = unr ? t.notReported : part.id === 'fruits_vegetables_legumes' && inp.fvlText ? inp.fvlText : `${fmt(part.value, L)} ${part.unit}`;
    const counted = part.id === 'proteins' && d && !d.countProteins && m.kind !== 'cheese' && m.kind !== 'beverage' && m.kind !== 'water' ? t.notCounted(11) : '';
    const bar = unr ? '<span class="fg85__bar is-unknown" aria-hidden="true"></span>' : `<span class="fg85__bar ${side}" style="--f:${frac}" aria-hidden="true"><i></i></span>`;
    return `<li class="fg85__tile ${side}${unr ? ' is-unreported' : ''}${part.id === 'fruits_vegetables_legumes' ? ' is-wide' : ''}"><span class="fg85__tl">${esc(t.fields[part.id] || part.id)}</span><b class="fg85__tv">${esc(val)}</b>${bar}<span class="fg85__tp">${unr ? esc(isBound ? t.assumedAtMost(fmt(m.bound.max, L)) : t.assumed0) : `${part.points}<small> / ${part.max} ${esc(t.pts)}</small>`}</span>${counted ? `<small class="fg85__note">${esc(counted)}</small>` : ''}</li>`;
  };
  const negRows = d ? d.negative.map(p => tile(p, 'neg')).join('') : '', posRows = d ? d.positive.map(p => tile(p, 'pos')).join('') : '';
  const extraLine = [['kcal', inp.kcal, 'kcal'], ['fat', inp.fat, 'g'], ['carbs', inp.carbs, 'g']].filter(x => x[1] != null).map(([k, v, u]) => `${t.fields[k]} ${fmt(v, L)} ${u}`).join(' · ');
  const lad = m.ladder ? LETTERS.filter(g => m.ladder[g]).map(g => { const [lo, hi] = m.ladder[g]; return `<li class="g-${g}"><b>${g}</b><span>${lo == null ? `≤ ${hi}` : hi == null ? `≥ ${lo}` : lo === hi ? lo : `${lo} – ${hi}`}</span></li>`; }).join('') : '';
  const rel = !label && RELIABILITY.inside[m.confidence];
  const when = o.modified ? new Intl.DateTimeFormat(L === 'el' ? 'el-GR' : 'en-GB', { dateStyle: 'medium' }).format(new Date(o.modified)) : '';
  const prim = `${d ? `${d.negativePoints} − ${d.positivePoints} = ${m.score}` : ''}`;
  return `<section class="fg85 fg85--${label ? 'label' : 'est'}" data-g="${seal}" aria-label="${esc(title)}">
    <header class="fg85__top"><span class="fg85__tag">${esc(label ? t.fromLabel : t.quick)}</span><span class="fg85__chipmini ${label ? 'is-label' : 'is-est'}">${esc(label ? t.calc : t.estimate)}</span><span class="fg85__method">${esc(t.method)}</span></header>
    <div class="fg85__hero">
      <div class="fg85__seal g-${seal}" role="img" aria-label="${esc(title)}"><span class="fg85__ring" aria-hidden="true"></span><b${band && !likely && !label ? ' class="is-range"' : ''}>${band && !likely && !label ? `${esc(first)}–${esc(last)}` : esc(seal)}</b>${label ? '' : `<small>${esc(t.estimate)}</small>`}</div>
      <div class="fg85__verdict"><strong>${esc(title)}</strong><span>${esc(band && !head ? '' : word)}</span>${band && head ? `<em>${esc(t.between(first, last))}</em>` : ''}</div>
    </div>
    <ol class="fg85__scale" aria-label="${esc(t.scaleLabel(head && band ? head : '', letters.join(', ')))}">${pills}</ol>
    ${gauge}
    <p class="fg85__proof"><svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M10 1.8 3.2 4.4v5c0 4 2.7 7.1 6.8 8.8 4.1-1.7 6.8-4.8 6.8-8.8v-5L10 1.8Zm-1 11.4-3-3 1.1-1.1L9 11l3.9-3.9L14 8.2l-5 5Z" fill="currentColor"/></svg><span>${esc(label ? t.proofLabel : t.proof)}</span></p>
    ${reasons.length || moveLines.length ? `<div class="fg85__block fg85__block--why"><h2>${esc(label ? t.couldBe : t.reasonsTitle)}</h2><ul class="fg85__list">${[...moveLines, ...reasons].map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>` : ''}
    ${d ? `<div class="fg85__facts-open"><h2 class="fg85__h">${esc(t.factsTitle)} <small>${esc(t.factsSub(unitOf))}</small></h2>
      <p class="fg85__group">${esc(t.against)} <b>${d.negativePoints}${m.partialData ? '+' : ''}</b></p><ul class="fg85__tiles">${negRows}</ul>
      <p class="fg85__group is-pos">${esc(t.infavour)} <b>${d.positivePoints}</b></p><ul class="fg85__tiles">${posRows}</ul>
      ${extraLine ? `<p class="fg85__small fg85__extra">${esc(t.alsoOnRecord)}: ${esc(extraLine)} (${esc(t.notScored)})</p>` : ''}
      ${m.partialData ? `<p class="fg85__small">${esc(t.partialNote)}</p>` : `<p class="fg85__sum"><span>${esc(t.scoreIs)}</span><b>${esc(prim)}</b></p>`}</div>
    <details class="fg85__facts"><summary>${esc(t.pointsTitle)}</summary><p class="fg85__small">${esc(t.tableLine(kindName))}</p><p class="fg85__small">${esc(t.ladderTitle)}:</p><ul class="fg85__ladder">${lad}</ul></details>` : ''}
    ${rel ? `<details class="fg85__facts"><summary>${esc(t.reliability)}</summary><p class="fg85__small">${esc(t.reliabilityLine(rel, m.likely ? RELIABILITY.likely[m.confidence] : 0, RELIABILITY.sample))}</p><p class="fg85__small">${esc(t.reliabilityNote)}</p></details>` : ''}
    <footer class="fg85__foot"><p>${esc(label ? t.userNumbers : t.sourceLine(o.code || '', when, o.snapshot))}</p><p>${esc(label ? t.notOfficialLabel : t.notOfficial)}</p>
      ${o.actions ? `<div class="fg85__acts">${label ? `<button type="button" class="fg85__btn" data-fr="edit">${esc(t.again)}</button><button type="button" class="fg85__btn fg85__btn--ghost" data-fr="remove">${esc(t.remove)}</button>` : `<label class="fg85__btn"><span>📷 ${esc(t.check)}</span><input type="file" accept="image/*" capture="environment" data-fr="file" hidden></label>`}</div>` : ''}</footer>
  </section>`;
}
