/* FoodScan 100 · Daily check-in on Home (real portions against the WHO limits, the last 7 days, a swap list), a data check on every product page (with where the grade
 * comes from and the shopper's own label numbers), My Lens, a 3-product compare tray and a local backup.
 * Local-first: everything stays in this browser's localStorage, no tracking, no network. English and Greek.
 * Logic (and what was checked) lives in daily-v98-core.mjs; this file only draws it.
 * Uses the same engine module as the app (domain-v106.mjs), so grades match and the app's own translated messages are reused. */
import { assessGrade, dataQuality } from './assets/domain-v106.mjs';
import { MAX_COMPARE, LENSES, num, r1, auditProduct, lensVerdict, computeStreak, parseBackup, BACKUP_KEY, gtin14, presetsFor, logEntry, dayIntake, LIMITS, progress, parseAmount, rememberPortion, AMOUNT_MIN, AMOUNT_MAX, labelCode, mergeLabel, provenance, weekPulse, listAdd, listRemove, gradeGain, listSummary, gtinCheckOk, weekReady } from './daily-v98-core.mjs';
import { detectMarket, setMarket, marketName, marketFlag, marketsSorted, dismissSuggestion } from './prices/market-v83.mjs';

const LENS_KEY = 'foodscan:lens:v98';
const DAILY_KEY = 'foodscan:daily:v98';
const COMPARE_KEY = 'foodscan:compare:v98';
const PORTION_KEY = 'foodscan:portion:v99';   // the last amount of each food, by GTIN-14
const LIST_KEY = 'foodscan:list:v100';        // the swap list: healthier products to buy instead

const TX = {
  en: {
    hubEye: 'Daily check-in · Private on this device',
    hubTitle: 'Your everyday kitchen hub',
    hubSub: 'Log what you had and how much, keep a streak, and see today against the WHO limits.',
    todayItems: 'Logged today',
    streak: 'Streak', streakDays: n => (n === 1 ? '1 day' : `${n} days`),
    pantry: 'Saved foods', pantrySub: ab => `${ab} graded A or B`,
    ring: { sugars: 'Sugars', salt: 'Salt', kcal: 'Energy', sat: 'Saturated fat' }, ofMax: (lim, u) => `of ${lim} ${u}`,
    summary: (n, saved, ab) => `${n} logged today` + (saved ? ` · ${saved} saved, ${ab} graded A or B` : ''),
    quickLogLabel: 'Tap a recent food, then how much you had:',
    aboutLimits: 'About these limits', intakeTitle: 'Today against the limits', intakeNone: 'Nothing logged with an amount yet today. Tap a food below, then an amount.',
    sugarsToday: 'Sugars today', saltToday: 'Salt today', kcalToday: 'Energy today', satToday: 'Saturated fat today',
    ofLimit: (v, lim, u) => `${v} ${u} of ${lim} ${u}`, ofKcal: (v, lim) => `${v.toLocaleString('en')} of ${lim.toLocaleString('en')} kcal`,
    whoSugars: 'WHO: free sugars under 10 % of energy (about 50 g a day; under 25 g is better). The label counts all sugars, milk and fruit sugar too, so this is an upper estimate.',
    whoSalt: 'WHO: under 5 g salt a day.', refKcal: 'The EU label reference is 2,000 kcal a day. Your own need differs.', whoSat: 'WHO: saturated fat under 10 % of energy (about 22 g on 2,000 kcal).',
    state: { ok: 'within the limit', near: 'close to the limit', over: 'over the limit' }, nut: { sugars: 'sugars', salt: 'salt', kcal: 'energy', sat: 'saturated fat' },
    lowerBound: (k, n) => `At least this much: ${n} food${n === 1 ? '' : 's'} you logged do${n === 1 ? 'es' : ''} not report ${k}.`,
    uncounted: n => `${n} earlier check-in${n === 1 ? ' has' : 's have'} no amount and ${n === 1 ? 'is' : 'are'} not counted.`,
    todayList: 'Logged today', removeItem: name => `Remove “${name}”`, removedMsg: name => `Removed “${name}”.`, noAmount: 'no amount',
    pickTitle: name => `How much of “${name}”?`, sameAsLast: label => `Same as last time · ${label}`,
    customLabel: u => `Other amount (${u})`, customHint: `from ${AMOUNT_MIN} to ${AMOUNT_MAX.toLocaleString('en')}`, logIt: 'Log', cancel: 'Cancel',
    badAmount: `Enter an amount from ${AMOUNT_MIN} to ${AMOUNT_MAX.toLocaleString('en')}.`,
    loggedAmount: (name, label) => `Logged ${label} of “${name}” for today.`,
    portion: { serving: (a, u) => `1 serving (${a} ${u})`, pack: (a, u) => `Whole pack (${a} ${u})`, unit: (a, u) => `1 unit (${a} ${u})`, g: (a, u) => `${a} ${u}`, glass: a => `1 glass (${a} ml)`, cup: a => `1 cup (${a} ml)`, can: a => `1 can (${a} ml)`, bottle: a => `1 bottle (${a} ml)`, custom: (a, u) => `${a} ${u}` },
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
    hadToday: '+ Had today', hadTodayDone: 'Logged today ✓ · add more',
    pinCompare: 'Pin to compare', pinnedCompare: 'Pinned ✓',
    trayCount: n => `Compare (${n}/${MAX_COMPARE})`, trayOpen: 'Compare now', trayClear: 'Clear',
    cmpTitle: 'Side-by-side compare',
    cmpSub: 'Values per 100 g or 100 ml from your records; a drink and a food are not on the same basis. Always check allergens on the pack.',
    cmpClose: 'Close', cmpRemove: 'Remove', colMetric: 'Metric',
    mGrade: 'Grade', mNova: 'NOVA', mKcal: 'Energy (kcal)', mSugar: 'Sugars g (tsp)', mProt: 'Protein (g)', mFiber: 'Fibre (g)', mSalt: 'Salt (g)', mLens: 'My Lens',
    allergyNote: 'Ingredient checks are never medical allergy clearance: always read the pack.',
    welcomeSub: 'Scan or open a food to start your check-in. New phone? Restore your backup and set My Lens below.',
    perBasis: { g: 'per 100 g', ml: 'per 100 ml' },
    mixedBasis: 'These products are not on the same basis (per 100 g and per 100 ml), so no column is marked best.',
    srcLabel: 'Grade source',
    src: { published: 'Published Nutri-Score', calculated: 'Calculated from the record', similar: 'Estimated from similar products', label: 'Your label photo', none: 'No grade on record' },
    srcTip: {
      published: 'The grade published with the record (Open Food Facts). FoodScan checks it against the numbers.',
      calculated: 'The record has no usable published grade, so FoodScan calculated it with the Nutri-Score 2023 rules from the record’s own numbers.',
      similar: 'The record has no numbers of its own: this is the range of similar products, not a calculation for this one.',
      label: 'Calculated from the label numbers you entered or confirmed on this device.',
      none: 'Neither a published grade nor enough numbers to calculate one.'
    },
    labelNote: 'Numbers you entered from the label replace the database values here, in your check-in and in the compare tray.',
    confHighLabel: 'The label numbers do not contradict each other. Where you gave a number from your own label, it replaces the database value; the rest comes from a community database.',
    weekTitle: 'Last 7 days', weekLogged: n => `${n} of 7 days logged`, weekAvgSugar: v => `average sugars ${v} g a day`, weekAvgSalt: v => `average salt ${v} g a day`,
    weekOver: n => `${n} day${n === 1 ? '' : 's'} over a limit`,
    weekOnly: 'Averages use only days with amounts, and a food that does not report a nutrient adds nothing to it, so they can be low. One heavy day is a bar, not a failure.',
    weekBars: 'bars show sugars against the 50 g WHO limit', weekAbout: 'About these averages',
    listBest: (name, a, b) => `Biggest swap win: ${name} (${a} → ${b})`,
    listTitle: 'Swap list', listSub: 'Healthier products to buy next time, with the lowest current recorded price (daily data). Nothing is estimated.',
    listAdd: '+ Swap list', listOn: 'On swap list ✓', listAddedMsg: n => `Added “${n}” to your swap list.`, listRemovedMsg: n => `Removed “${n}” from your swap list.`, listRemove: n => `Remove “${n}” from the swap list`,
    listInstead: (n, g) => `instead of ${n}${g ? ` (${g})` : ''}`, listMore: n => `and ${n} more`,
    listCount: n => `${n} swap${n === 1 ? '' : 's'}`, listGain: (i, n, g) => `${i} of ${n} graded swaps improve the grade (+${g} steps in total)`,
    listTotal: (v, k, n) => `${v} at current recorded prices for ${k} of ${n}`, listCheaper: n => `cheaper per kg or litre than what you scanned: ${n}`, listDearer: n => `dearer per kg or litre: ${n}`,
    listNoPrice: 'no recorded price', listOlder: 'older price',
    locLabel: 'Prices and portions for', locChange: 'Change country', locAuto: 'Automatic (follow my location)', locPick: 'Choose a country…',
    locSrc: { choice: 'your choice', profile: 'your choice', network: 'from your connection', device: "from your phone's clock", language: 'a guess from your language' },
    locUnknownTitle: 'Where are you shopping?',
    locUnknownSub: 'FoodScan could not tell which country you are in, so it shows no prices. Choose your country for local, dated prices and the drink sizes people use there.',
    locSuggest: (to, from) => `Your phone's clock says you are in ${to}, but your connection says ${from}. Which should FoodScan use?`,
    locUse: n => `Use ${n}`, locKeep: n => `Keep ${n}`, locSaved: n => `Now showing prices and portions for ${n}.`
  },
  el: {
    hubEye: 'Καθημερινό τσεκάρισμα · Ιδιωτικό στη συσκευή σου',
    hubTitle: 'Το καθημερινό σου κέντρο κουζίνας',
    hubSub: 'Κατέγραψε τι έφαγες και πόσο, κράτα σερί ημερών και δες τη σημερινή σου πρόσληψη απέναντι στα όρια του ΠΟΥ.',
    todayItems: 'Καταγράφηκαν σήμερα',
    streak: 'Σερί', streakDays: n => (n === 1 ? '1 ημέρα' : `${n} ημέρες`),
    pantry: 'Αποθηκευμένα τρόφιμα', pantrySub: ab => `${ab} με βαθμό A ή B`,
    ring: { sugars: 'Σάκχαρα', salt: 'Αλάτι', kcal: 'Ενέργεια', sat: 'Κορεσμένα λιπαρά' }, ofMax: (lim, u) => `από ${lim} ${u}`,
    summary: (n, saved, ab) => `${n === 1 ? '1 καταγραφή' : `${n} καταγραφές`} σήμερα` + (saved ? ` · ${saved} αποθηκευμένα, ${ab} με βαθμό A ή B` : ''),
    quickLogLabel: 'Πάτα ένα πρόσφατο τρόφιμο και μετά πόσο έφαγες:',
    aboutLimits: 'Για αυτά τα όρια', intakeTitle: 'Σήμερα απέναντι στα όρια', intakeNone: 'Δεν έχει καταγραφεί ακόμη τίποτα με ποσότητα σήμερα. Πάτα ένα τρόφιμο και μετά μια ποσότητα.',
    sugarsToday: 'Σάκχαρα σήμερα', saltToday: 'Αλάτι σήμερα', kcalToday: 'Ενέργεια σήμερα', satToday: 'Κορεσμένα λιπαρά σήμερα',
    ofLimit: (v, lim, u) => `${String(v).replace('.', ',')} ${u} από ${lim} ${u}`, ofKcal: (v, lim) => `${v.toLocaleString('el')} από ${lim.toLocaleString('el')} kcal`,
    whoSugars: 'ΠΟΥ: ελεύθερα σάκχαρα κάτω από 10 % της ενέργειας (περίπου 50 g την ημέρα· κάτω από 25 g είναι καλύτερα). Η ετικέτα μετρά όλα τα σάκχαρα, και του γάλακτος και των φρούτων, οπότε το νούμερο είναι ανώτερη εκτίμηση.',
    whoSalt: 'ΠΟΥ: κάτω από 5 g αλάτι την ημέρα.', refKcal: 'Η τιμή αναφοράς των ετικετών της ΕΕ είναι 2.000 kcal την ημέρα. Οι δικές σου ανάγκες διαφέρουν.', whoSat: 'ΠΟΥ: κορεσμένα λιπαρά κάτω από 10 % της ενέργειας (περίπου 22 g στις 2.000 kcal).',
    state: { ok: 'μέσα στο όριο', near: 'κοντά στο όριο', over: 'πάνω από το όριο' }, nut: { sugars: 'σάκχαρα', salt: 'αλάτι', kcal: 'ενέργεια', sat: 'κορεσμένα λιπαρά' },
    lowerBound: (k, n) => `Τουλάχιστον τόσο: ${n} ${n === 1 ? 'τρόφιμο που κατέγραψες δεν δηλώνει' : 'τρόφιμα που κατέγραψες δεν δηλώνουν'} ${k}.`,
    uncounted: n => `${n} ${n === 1 ? 'παλαιότερη καταγραφή δεν έχει' : 'παλαιότερες καταγραφές δεν έχουν'} ποσότητα και δεν ${n === 1 ? 'υπολογίζεται' : 'υπολογίζονται'}.`,
    todayList: 'Καταγράφηκαν σήμερα', removeItem: name => `Αφαίρεση «${name}»`, removedMsg: name => `Αφαιρέθηκε το «${name}».`, noAmount: 'χωρίς ποσότητα',
    pickTitle: name => `Πόσο από «${name}»;`, sameAsLast: label => `Όπως την τελευταία φορά · ${label}`,
    customLabel: u => `Άλλη ποσότητα (${u})`, customHint: `από ${AMOUNT_MIN} έως ${AMOUNT_MAX.toLocaleString('el')}`, logIt: 'Καταγραφή', cancel: 'Άκυρο',
    badAmount: `Γράψε μια ποσότητα από ${AMOUNT_MIN} έως ${AMOUNT_MAX.toLocaleString('el')}.`,
    loggedAmount: (name, label) => `Καταγράφηκε ${label} από «${name}» για σήμερα.`,
    portion: { serving: (a, u) => `1 μερίδα (${a} ${u})`, pack: (a, u) => `Όλη η συσκευασία (${a} ${u})`, unit: (a, u) => `1 τεμάχιο (${a} ${u})`, g: (a, u) => `${a} ${u}`, glass: a => `1 ποτήρι (${a} ml)`, cup: a => `1 φλιτζάνι (${a} ml)`, can: a => `1 κουτάκι (${a} ml)`, bottle: a => `1 μπουκάλι (${a} ml)`, custom: (a, u) => `${a} ${u}` },
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
    hadToday: '+ Έφαγα σήμερα', hadTodayDone: 'Καταγράφηκε σήμερα ✓ · πρόσθεσε κι άλλο',
    pinCompare: 'Καρφίτσωμα για σύγκριση', pinnedCompare: 'Στη σύγκριση ✓',
    trayCount: n => `Σύγκριση (${n}/${MAX_COMPARE})`, trayOpen: 'Σύγκρινε τώρα', trayClear: 'Καθαρισμός',
    cmpTitle: 'Σύγκριση δίπλα-δίπλα',
    cmpSub: 'Τιμές ανά 100 g ή 100 ml από τις εγγραφές σου· ένα ρόφημα και ένα στερεό δεν έχουν την ίδια βάση. Έλεγχε πάντα τα αλλεργιογόνα στη συσκευασία.',
    cmpClose: 'Κλείσιμο', cmpRemove: 'Αφαίρεση', colMetric: 'Κριτήριο',
    mGrade: 'Βαθμός', mNova: 'NOVA', mKcal: 'Ενέργεια (kcal)', mSugar: 'Σάκχαρα g (κ.γ.)', mProt: 'Πρωτεΐνη (g)', mFiber: 'Φυτικές ίνες (g)', mSalt: 'Αλάτι (g)', mLens: 'Ο Φακός μου',
    allergyNote: 'Ο έλεγχος συστατικών δεν αποτελεί ιατρική βεβαίωση για αλλεργίες: διάβαζε πάντα τη συσκευασία.',
    welcomeSub: 'Σκάναρε ή άνοιξε ένα τρόφιμο για να ξεκινήσεις. Νέο κινητό; Επανάφερε το αντίγραφό σου και ρύθμισε τον Φακό σου παρακάτω.',
    perBasis: { g: 'ανά 100 g', ml: 'ανά 100 ml' },
    mixedBasis: 'Αυτά τα προϊόντα δεν έχουν την ίδια βάση (ανά 100 g και ανά 100 ml), οπότε καμία στήλη δεν σημειώνεται ως καλύτερη.',
    srcLabel: 'Πηγή βαθμού',
    src: { published: 'Δημοσιευμένο Nutri-Score', calculated: 'Υπολογισμός από την εγγραφή', similar: 'Εκτίμηση από παρόμοια προϊόντα', label: 'Η φωτογραφία της ετικέτας σου', none: 'Χωρίς βαθμό στην εγγραφή' },
    srcTip: {
      published: 'Ο βαθμός που δημοσιεύεται με την εγγραφή (Open Food Facts). Το FoodScan τον ελέγχει με τους αριθμούς.',
      calculated: 'Η εγγραφή δεν έχει χρησιμοποιήσιμο δημοσιευμένο βαθμό, οπότε το FoodScan τον υπολόγισε με τους κανόνες Nutri-Score 2023 από τους δικούς της αριθμούς.',
      similar: 'Η εγγραφή δεν έχει δικούς της αριθμούς: αυτό είναι το εύρος παρόμοιων προϊόντων, όχι υπολογισμός για αυτό το προϊόν.',
      label: 'Υπολογισμένος από τους αριθμούς της ετικέτας που έγραψες ή επιβεβαίωσες σε αυτή τη συσκευή.',
      none: 'Ούτε δημοσιευμένος βαθμός ούτε αρκετοί αριθμοί για υπολογισμό.'
    },
    labelNote: 'Οι αριθμοί που έγραψες από την ετικέτα αντικαθιστούν εδώ τις τιμές της βάσης, στο καθημερινό τσεκάρισμα και στη σύγκριση.',
    confHighLabel: 'Τα νούμερα της ετικέτας δεν αντιφάσκουν μεταξύ τους. Όπου έδωσες αριθμό από τη δική σου ετικέτα, αντικαθιστά την τιμή της βάσης· τα υπόλοιπα προέρχονται από κοινοτική βάση δεδομένων.',
    weekTitle: 'Τελευταίες 7 ημέρες', weekLogged: n => `${n} από 7 ημέρες με καταγραφή`, weekAvgSugar: v => `μέσος όρος σακχάρων ${String(v).replace('.', ',')} g την ημέρα`, weekAvgSalt: v => `μέσος όρος αλατιού ${String(v).replace('.', ',')} g την ημέρα`,
    weekOver: n => `${n} ${n === 1 ? 'ημέρα' : 'ημέρες'} πάνω από όριο`,
    weekOnly: 'Οι μέσοι όροι χρησιμοποιούν μόνο ημέρες με ποσότητες, και ένα τρόφιμο που δεν δηλώνει ένα θρεπτικό συστατικό δεν προσθέτει τίποτα σε αυτό, οπότε μπορεί να βγαίνουν χαμηλοί. Μία βαριά ημέρα είναι μια μπάρα, όχι αποτυχία.',
    weekBars: 'οι μπάρες δείχνουν σάκχαρα σε σχέση με το όριο του ΠΟΥ των 50 g', weekAbout: 'Για αυτούς τους μέσους όρους',
    listBest: (name, a, b) => `Μεγαλύτερη βελτίωση: ${name} (${a} → ${b})`,
    listTitle: 'Λίστα αλλαγών', listSub: 'Πιο υγιεινά προϊόντα για την επόμενη φορά, με τη χαμηλότερη τρέχουσα καταγεγραμμένη τιμή (ημερήσια δεδομένα). Τίποτα δεν εκτιμάται.',
    listAdd: '+ Λίστα αλλαγών', listOn: 'Στη λίστα ✓', listAddedMsg: n => `Προστέθηκε το «${n}» στη λίστα αλλαγών.`, listRemovedMsg: n => `Αφαιρέθηκε το «${n}» από τη λίστα αλλαγών.`, listRemove: n => `Αφαίρεση «${n}» από τη λίστα αλλαγών`,
    listInstead: (n, g) => `αντί για ${n}${g ? ` (${g})` : ''}`, listMore: n => `και ${n} ακόμη`,
    listCount: n => `${n} ${n === 1 ? 'αλλαγή' : 'αλλαγές'}`, listGain: (i, n, g) => `${i} από ${n} αλλαγές με βαθμό βελτιώνουν τον βαθμό (+${g} βαθμίδες συνολικά)`,
    listTotal: (v, k, n) => `${v} με τρέχουσες καταγεγραμμένες τιμές για ${k} από ${n}`, listCheaper: n => `φθηνότερες ανά kg ή λίτρο από όσα σκάναρες: ${n}`, listDearer: n => `ακριβότερες ανά kg ή λίτρο: ${n}`,
    listNoPrice: 'χωρίς καταγεγραμμένη τιμή', listOlder: 'παλαιότερη τιμή',
    locLabel: 'Τιμές και μερίδες για', locChange: 'Αλλαγή χώρας', locAuto: 'Αυτόματα (ακολούθησε την τοποθεσία μου)', locPick: 'Διάλεξε χώρα…',
    locSrc: { choice: 'δική σου επιλογή', profile: 'δική σου επιλογή', network: 'από τη σύνδεσή σου', device: 'από το ρολόι του κινητού σου', language: 'εκτίμηση από τη γλώσσα σου' },
    locUnknownTitle: 'Πού ψωνίζεις;',
    locUnknownSub: 'Το FoodScan δεν μπόρεσε να καταλάβει σε ποια χώρα βρίσκεσαι και γι’ αυτό δεν δείχνει τιμές. Διάλεξε τη χώρα σου για τοπικές, χρονολογημένες τιμές και για τα μεγέθη ποτών που χρησιμοποιούνται εκεί.',
    locSuggest: (to, from) => `Το ρολόι του κινητού σου δείχνει ότι βρίσκεσαι σε: ${to}, ενώ η σύνδεσή σου δείχνει: ${from}. Ποια να χρησιμοποιήσει το FoodScan;`,
    locUse: n => `Χρήση: ${n}`, locKeep: n => `Να μείνει: ${n}`, locSaved: n => `Εμφανίζονται τώρα τιμές και μερίδες για: ${n}.`
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
/* 100: a change signature of a big stored string in constant time (length, first and last 48 characters): the app writes new rows at the front and drops them from
 * the back, so every add, delete and reorder changes it, and no megabyte string is built on each page mutation. */
const sig = s => (s ? `${s.length}:${s.slice(0, 48)}:${s.slice(-48)}` : '0');
const readSig = key => sig(readRaw(key));
const readJSON = (key, fallback) => { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; } };
const writeJSON = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };

const getLenses = () => { const a = readJSON(LENS_KEY, []); return Array.isArray(a) ? a.filter(id => LENSES.some(l => l.id === id)) : []; };
const toggleLens = id => { const s = new Set(getLenses()); s.has(id) ? s.delete(id) : s.add(id); writeJSON(LENS_KEY, [...s]); };

const getDailyLog = () => { const a = readJSON(DAILY_KEY, []); return Array.isArray(a) ? a : []; };
function safeGrade(p) {
  if (!p) return null;
  try { const v = assessGrade(p); if (v && ['reported', 'estimated'].includes(v.status) && /^[A-E]$/.test(String(v.grade || ''))) return v.grade; } catch {}
  return /^[A-E]$/.test(String(p.labelGrade || '')) ? p.labelGrade : null;   // the shopper's own label calculation, when the database has no grade
}
const getList = () => { const a = readJSON(LIST_KEY, []); return Array.isArray(a) ? a.filter(x => x && /^\d{14}$/.test(x.gtin)) : []; };

/* ---- 100: prices for the swap list: the same line the swap rows show (lowest current recorded price, else the last recorded one, marked older), from
 * GET /api/prices/peek (the daily data), five barcodes a request, two requests at a time. A product with no recorded price simply has none: nothing is estimated. */
const lineOf = v => { if (!v) return null; const o = v.best || v.latest; return o && o.price > 0 ? { price: o.price, currency: o.currency || v.currency || 'EUR', retailer: o.retailer || '', older: !v.best, date: o.date, unitPrice: o.unitPrice, unitBasis: o.unitBasis } : null; };
const PRICE_TTL = 10 * 60 * 1000;
const priceBook = new Map();   // GTIN-14 -> { at, line }
let priceBusy = false, priceVersion = 0;
function wantPrices(list) {
  if (priceBusy) return;
  const codes = [], seen = new Set();
  for (const it of list) for (const c of [it.code, it.forCode]) {
    const k = gtin14(c), e = k && priceBook.get(k);
    if (k && gtinCheckOk(c) && !seen.has(k) && !(e && Date.now() - e.at < PRICE_TTL)) { seen.add(k); codes.push(String(c)); }   // a code with a bad check digit has no price and would fail the whole batch
  }
  if (!codes.length) return;
  priceBusy = true;
  let m = ''; try { m = detectMarket().code || ''; } catch {}
  const batches = []; for (let i = 0; i < codes.length; i += 5) batches.push(codes.slice(i, i + 5));
  const retrySoon = Date.now() - PRICE_TTL + 60000;   // a failed batch is asked again in a minute
  const worker = async () => {
    while (batches.length) {
      const b = batches.shift();
      try {
        const r = await fetch(`/api/prices/peek?codes=${b.join(',')}${m ? `&market=${m}` : ''}`, { headers: { accept: 'application/json' } }), j = r.ok ? await r.json() : null;
        const by = new Map((j?.items || []).map(i => [gtin14(i.code), i]));
        for (const c of b) priceBook.set(gtin14(c), { at: j ? Date.now() : retrySoon, line: lineOf(by.get(gtin14(c))), failed: !j });
      } catch { for (const c of b) priceBook.set(gtin14(c), { at: retrySoon, line: null, failed: true }); }
    }
  };
  Promise.all([worker(), worker()]).finally(() => { priceBusy = false; priceVersion++; schedule(); });
}
/* 99: a check-in is a food AND an amount. The amount is remembered per food, so the next time is one tap. */
const getPortions = () => { const m = readJSON(PORTION_KEY, {}); return m && typeof m === 'object' && !Array.isArray(m) ? m : {}; };
function addDailyLog(prod, amount, kind) {
  const entry = logEntry(prod, amount, kind, { day: todayKey(), at: Date.now(), grade: safeGrade(prod) });
  if (!entry) return null;
  const ok = writeJSON(DAILY_KEY, [...getDailyLog(), entry].slice(-240));
  if (ok) writeJSON(PORTION_KEY, rememberPortion(getPortions(), entry.gtin, entry.grams, entry.portion, entry.at));
  return ok ? entry : null;
}
const entryKey = x => x.gtin || gtin14(x.barcode) || String(x.barcode);
function removeDailyLog(at, key) {
  const log = getDailyLog(), next = log.filter(x => !(x.at === at && entryKey(x) === key));
  return next.length !== log.length && writeJSON(DAILY_KEY, next);
}
const sameFood = (a, b) => { const x = gtin14(a), y = gtin14(b); return x && y ? x === y : String(a) === String(b); };

const getCompareList = () => { const a = readJSON(COMPARE_KEY, []); return Array.isArray(a) ? a.slice(0, MAX_COMPARE) : []; };
function toggleCompare(prod) {
  if (!prod?.barcode) return false;
  const list = getCompareList(), idx = list.findIndex(x => sameFood(x.barcode, prod.barcode)), n = prod.nutrition || {};
  if (idx >= 0) { list.splice(idx, 1); writeJSON(COMPARE_KEY, list); return false; }
  if (list.length >= MAX_COMPARE) list.shift();
  list.push({ barcode: String(prod.barcode), name: String(prod.name || prod.barcode).slice(0, 72), brand: String(prod.brand || '').slice(0, 48), basis: prod.basis === 'ml' ? 'ml' : 'g', grade: safeGrade(prod), nova: prod.nova ?? null, kcal: num(n.kcal), sugars: num(n.sugars), protein: num(n.protein), fiber: num(n.fiber), salt: num(n.salt) });
  writeJSON(COMPARE_KEY, list);
  return true;
}

/* The app keeps opened and saved products as { product, at } rows. 99: keyed by GTIN-14, so a UPC-A, an EAN-13 and a GTIN-14 of one product are one chip
 * (the first row found wins; the app lists saved foods first, then history, newest first). */
const recordKey = code => gtin14(code) || (/^\d{8,14}$/.test(code) ? code : null);
/* 100: the label numbers a shopper typed or confirmed (prices/reader-v85.js keeps them under fs85:label:<code>) are laid over the database record, and the whole map is
 * rebuilt only when the saved list, the history or a label changed (before, every call parsed up to a megabyte of JSON). */
function labelKeys() {
  const idx = new Map();
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i), g = k && labelCode(k); if (g) idx.set(g, k); } } catch {}
  return idx;
}
let recCache = { key: null, map: null };
const recordsKey = labels => [readSig('fs13:saved'), readSig('fs13:history'), ...[...labels].map(([g, k]) => g + readSig(k))].join('|');
function readAllRecords() {
  const labels = labelKeys(), key = recordsKey(labels);
  if (recCache.key === key) return recCache.map;
  const map = new Map();
  for (const store of ['fs13:saved', 'fs13:history']) {
    const rows = readJSON(store, []);
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const p = row?.product || row, code = String(p?.barcode || row?.barcode || '').trim(), k = recordKey(code);
      if (!k) continue;
      const prev = map.get(k), at = row?.at || 0;
      if (prev) { if (store === 'fs13:saved') prev.saved = true; prev.at = Math.max(prev.at, at); continue; }   // the same product again: one record, saved if any copy is, newest time
      const lk = labels.get(k);
      map.set(k, { key: k, product: lk ? mergeLabel(p, readJSON(lk, null)) : p, saved: store === 'fs13:saved', at });
    }
  }
  recCache = { key, map };
  return map;
}
/* A product page opened from a shared link has no history row until the app has written one; the app's own snapshot list (fs591:source-snapshots) can already hold it. */
function snapshotRecord(code) {
  const k = recordKey(code), rows = readJSON('fs591:source-snapshots', []);
  if (!k || !Array.isArray(rows)) return null;
  const p = rows.find(x => x && x.nutrition && typeof x.nutrition === 'object' && recordKey(String(x.barcode || '')) === k);
  if (!p) return null;
  const lk = labelKeys().get(k);
  return { key: k, product: lk ? mergeLabel(p, readJSON(lk, null)) : p, saved: false, at: 0 };
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

/* ---- 99: "how much?" -----------------------------------------------------------------------------------------
 * A tap on a food opens one row of amounts: the product's own serving, its pack or one unit, a glass/cup/can/bottle or 30/50/100/150 g, the amount
 * of last time (one tap), or a typed number. Nothing is logged without an amount, and no amount is ever guessed. */
let picker = null;   // { gtin, where: 'hub' | 'product', focus }: the food whose amounts are open
const unitOf = p => (p?.basis === 'ml' ? 'ml' : 'g');
const portionLabel = (t, kind, amount, unit) => (t.portion[kind] || t.portion.custom)(dec(amount), unit);
function pickerHtml(p) {
  const t = tr(), unit = unitOf(p), key = gtin14(p.barcode) || String(p.barcode), last = getPortions()[key], name = p.name || p.barcode;
  const lastOk = last && num(last.amount) != null && last.amount >= AMOUNT_MIN && last.amount <= AMOUNT_MAX;
  const presets = presetsFor(p, marketNow().code).filter(x => !(lastOk && x.amount === last.amount));
  return `<div class="fs99-pick" role="group" aria-label="${esc(t.pickTitle(name))}">
    <p class="fs98-sec__label">${esc(t.pickTitle(name))}</p>
    <div class="fs98-chips">${lastOk ? `<button type="button" class="fs98-btn fs98-btn--sm fs98-btn--primary" data-fs99-amt="${last.amount}" data-fs99-kind="${esc(last.kind)}">${esc(t.sameAsLast(portionLabel(t, last.kind, last.amount, unit)))}</button>` : ''}${presets.map(x => `<button type="button" class="fs98-chip" data-fs99-amt="${x.amount}" data-fs99-kind="${esc(x.kind)}">${esc(portionLabel(t, x.kind, x.amount, unit))}</button>`).join('')}</div>
    <form class="fs99-custom" data-fs99-custom novalidate>
      <label class="fs99-custom__l"><span>${esc(t.customLabel(unit))}</span><input type="text" inputmode="decimal" autocomplete="off" maxlength="7" placeholder="${esc(t.customHint)}" data-fs99-input></label>
      <button type="submit" class="fs98-btn fs98-btn--sm fs98-btn--primary">${esc(t.logIt)}</button>
      <button type="button" class="fs98-btn fs98-btn--sm" data-fs99-cancel>${esc(t.cancel)}</button>
    </form>
    <p class="fs98-status fs99-err" role="alert" data-fs99-err></p></div>`;
}
/** Hooks up the amounts row inside `root`. `done(message)` redraws the card and says what happened. */
function wirePicker(root, p, done) {
  if (!root) return;
  const t = tr(), unit = unitOf(p), name = p.name || p.barcode;
  const fail = () => { const e = root.querySelector('[data-fs99-err]'); if (e) e.textContent = t.badAmount; };
  const commit = (amount, kind) => {
    const entry = addDailyLog(p, amount, kind);
    if (!entry) return fail();
    picker = null; done(t.loggedAmount(name, portionLabel(t, kind, entry.grams, unit)));
  };
  root.querySelectorAll('[data-fs99-amt]').forEach(b => b.addEventListener('click', () => commit(Number(b.dataset.fs99Amt), b.dataset.fs99Kind)));
  const form = root.querySelector('[data-fs99-custom]');
  form?.addEventListener('submit', ev => { ev.preventDefault(); const a = parseAmount(form.querySelector('[data-fs99-input]')?.value); if (a == null) return fail(); commit(a, 'custom'); });
  root.querySelector('[data-fs99-cancel]')?.addEventListener('click', () => { picker = null; done(''); });
  root.addEventListener('keydown', ev => { if (ev.key === 'Escape') { ev.stopPropagation(); picker = null; done(''); } });
  if (picker?.focus) { picker.focus = false; root.querySelector('[data-fs99-amt], [data-fs99-input]')?.focus(); }
}

/** Today against the WHO limits: what was actually eaten (amount x the food's numbers), never an average per 100 g. */
function intakeHtml(t, di, aboutOpen) {
  const el = isEl(), cells = [
    ['sugars', t.sugarsToday, LIMITS.sugars, 'g', v => t.ofLimit(dec(v), LIMITS.sugars, 'g')],
    ['salt', t.saltToday, LIMITS.salt, 'g', v => t.ofLimit(dec(v), LIMITS.salt, 'g')],
    ['kcal', t.kcalToday, LIMITS.kcal, 'kcal', v => t.ofKcal(v, LIMITS.kcal)],
    ['sat', t.satToday, LIMITS.sat, 'g', v => t.ofLimit(dec(v), LIMITS.sat, 'g')]
  ];
  /* 104: one dial per limit, always on screen (empty until an amount is logged) so Home opens on the day at a glance. The ring is the progress bar; "≥" marks a
   * total that is a lower bound because a logged food does not report that nutrient, and the sentence under the dials says which. */
  const lows = [];
  const rows = cells.map(([k, label, lim, unit, text]) => {
    const v = di.counted ? di.totals[k] : null, pr = progress(v, lim), name = t.ring[k], max = t.ofMax(k === 'kcal' ? lim.toLocaleString(el ? 'el' : 'en') : lim, unit);
    if (!pr) return `<div class="fs99-row fs104-tile fs104-tile--none"><span class="fs104-ring" aria-hidden="true"><b>—</b></span><span class="fs98-stat__k">${esc(name)}</span><span class="fs99-val">${esc(max)}</span></div>`;
    const low = di.missing[k] > 0; if (low) lows.push(t.lowerBound(t.nut[k], di.missing[k]));
    return `<div class="fs99-row fs104-tile fs99-row--${pr.state}" style="--p:${pr.bar}"><span class="fs104-ring fs99-meter" role="progressbar" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(pr.pct, 100)}" aria-valuetext="${esc(`${text(v)} · ${pr.pct} % · ${t.state[pr.state]}`)}"><b>${pr.pct}<small>%</small></b></span><span class="fs98-stat__k">${esc(name)}</span><span class="fs99-val">${low ? '≥ ' : ''}${esc(`${k === 'kcal' ? Math.round(v).toLocaleString(el ? 'el' : 'en') : dec(v)} / ${k === 'kcal' ? lim.toLocaleString(el ? 'el' : 'en') : lim} ${unit}`)}</span></div>`;
  }).join('');
  return `<div class="fs98-sec fs99-intake fs100-wide"><p class="fs98-sec__label">${esc(t.intakeTitle)}</p>
    <div class="fs99-rows fs104-dials">${rows}</div>
    ${di.counted ? lows.map(x => `<p class="fs99-low fs104-lowline">${esc(x)}</p>`).join('') : `<p class="fs98-sub">${esc(t.intakeNone)}</p>`}
    ${di.uncounted ? `<p class="fs98-sub fs99-low">${esc(t.uncounted(di.uncounted))}</p>` : ''}
    <details class="fs99-about"${aboutOpen ? ' open' : ''}><summary>${esc(t.aboutLimits)}</summary><ul class="fs99-notes"><li>${esc(t.whoSugars)}</li><li>${esc(t.whoSalt)}</li><li>${esc(t.whoSat)}</li><li>${esc(t.refKcal)}</li></ul></details></div>`;
}
function todayListHtml(t, rows) {
  if (!rows.length) return '';
  const items = rows.slice().reverse().slice(0, 8).map(x => {
    const amt = num(x.grams) ? `${dec(x.grams)} ${x.basis === 'ml' ? 'ml' : 'g'}` : t.noAmount;
    return `<li><span class="fs99-li__n">${esc(x.name)}</span><span class="fs99-li__a">${esc(amt)}</span><button type="button" class="fs99-x" data-fs99-rm="${esc(x.at)}" data-fs99-key="${esc(entryKey(x))}" data-fs99-name="${esc(x.name)}" aria-label="${esc(t.removeItem(x.name))}">✕</button></li>`;
  }).join('');
  return `<div class="fs98-sec"><p class="fs98-sec__label">${esc(t.todayList)}</p><ul class="fs99-list">${items}</ul></div>`;
}

const money = (v, cur = 'EUR') => { try { return new Intl.NumberFormat(isEl() ? 'el-GR' : 'en-GB', { style: 'currency', currency: cur }).format(v); } catch { return `${v.toFixed(2)} ${cur}`; } };

/* My Lens and the backup live in one folded block. 100: it is also what a first-time visitor on a new phone sees, so "Restore backup" is never hidden. */
function moreHtml(t, el, open) {
  const active = new Set(getLenses());
  const lensChips = LENSES.map(l => `<button type="button" class="fs98-chip" data-fs98-lens="${esc(l.id)}" aria-pressed="${active.has(l.id)}" title="${esc(el ? l.ruleEl : l.ruleEn)}">${esc(el ? l.el : l.en)}</button>`).join('');
  return `<details class="fs98-more"${open}><summary>${esc(t.more)}</summary>
      <div class="fs98-sec"><p class="fs98-sec__label">${esc(t.lensLabel)}</p><div class="fs98-chips">${lensChips}</div></div>
      <div class="fs98-foot"><span>${esc(t.allergyNote)}</span>
        <div class="fs98-chips">
          <button type="button" class="fs98-btn fs98-btn--sm" data-fs98-export>${esc(t.backupExport)}</button>
          <button type="button" class="fs98-btn fs98-btn--sm" data-fs98-import>${esc(t.backupImport)}</button>
          <input type="file" accept="application/json,.json" hidden id="fs98-import-input">
        </div>
      </div>
    </details>`;
}
/* 102: where is this shopper? One answer, shared with the price card, the Prices page and the swaps (prices/market-v83.mjs): the shopper's choice, else the network's
 * country, else the phone's clock, else the browser language (a guess), else nothing (the app asks, and shows no prices). It is on Home because the country decides
 * which shops' prices appear and which drink sizes the one-tap amounts offer; a new phone sees it first. */
const marketNow = () => { try { return detectMarket(); } catch { return { code: '', source: 'unknown' }; } };
let countryOpts = { lang: '', html: '' };
function countryOptionsHtml(language) {
  if (countryOpts.lang !== language) countryOpts = { lang: language, html: marketsSorted(language).map(c => `<option value="${esc(c.code)}">${marketFlag(c.code) ? `${marketFlag(c.code)} ` : ''}${esc(c.name)}</option>`).join('') };
  return countryOpts.html;
}
function locHtml(t, language) {
  const m = marketNow(), code = m.code, opts = countryOptionsHtml(language);
  if (!code) {
    return `<div class="fs98-sec fs100-wide fs102-loc fs102-loc--ask"><p class="fs98-sec__label">${esc(t.locUnknownTitle)}</p><p class="fs98-sub">${esc(t.locUnknownSub)}</p>
      <select class="fs102-loc__sel" data-fs102-country aria-label="${esc(t.locPick)}"><option value="" disabled selected>${esc(t.locPick)}</option>${opts}</select></div>`;
  }
  const name = marketName(code, language), flag = marketFlag(code);
  const sug = m.suggest ? `<div class="fs102-loc__sug" role="group" aria-label="${esc(t.locChange)}"><p class="fs98-sub">${esc(t.locSuggest(marketName(m.suggest, language), name))}</p>
      <div class="fs98-chips"><button type="button" class="fs98-btn fs98-btn--sm" data-fs102-use="${esc(m.suggest)}">${esc(t.locUse(marketName(m.suggest, language)))}</button>
      <button type="button" class="fs98-btn fs98-btn--sm" data-fs102-keep data-fs102-from="${esc(code)}" data-fs102-to="${esc(m.suggest)}">${esc(t.locKeep(name))}</button></div></div>` : '';
  return `<div class="fs98-sec fs100-wide fs102-loc"><div class="fs102-loc__row"><span class="fs102-loc__txt">${esc(t.locLabel)} <b>${flag ? `${esc(flag)} ` : ''}${esc(name)}</b> <span class="fs100-hint">· ${esc(t.locSrc[m.source] || '')}</span></span>
      <select class="fs102-loc__sel" data-fs102-country aria-label="${esc(t.locChange)}"><option value="" disabled selected>${esc(t.locChange)}</option><option value="auto">${esc(t.locAuto)}</option>${opts}</select></div>${sug}</div>`;
}
function wireLoc(h, view, t) {
  const language = lang();
  const done = () => {
    priceBook.clear(); priceVersion++; lastKey = '';   // every price line was for the old country
    renderHub(view);
    const s = view.querySelector('#fs98-hub-status'), c = marketNow().code; if (s && c) s.textContent = t.locSaved(marketName(c, language));
  };
  h.querySelector('[data-fs102-country]')?.addEventListener('change', ev => { const v = ev.target.value; if (!v) return; setMarket(v === 'auto' ? '' : v); done(); });
  h.querySelector('[data-fs102-use]')?.addEventListener('click', ev => { setMarket(ev.currentTarget.dataset.fs102Use); done(); });
  h.querySelector('[data-fs102-keep]')?.addEventListener('click', ev => { const b = ev.currentTarget; dismissSuggestion(b.dataset.fs102From, b.dataset.fs102To); done(); });
}
function wireMore(h, view, t) {
  const say = text => { const s = h.querySelector('#fs98-hub-status'); if (s) s.textContent = text; };
  h.querySelectorAll('[data-fs98-lens]').forEach(b => b.addEventListener('click', () => { toggleLens(b.dataset.fs98Lens); renderHub(view); }));
  h.querySelector('[data-fs98-export]')?.addEventListener('click', () => { exportBackup(); say(t.backupDone); });
  const fileIn = h.querySelector('#fs98-import-input');
  h.querySelector('[data-fs98-import]')?.addEventListener('click', () => fileIn?.click());
  fileIn?.addEventListener('change', async () => {
    const file = fileIn.files?.[0]; if (!file) return;
    try { const n = importBackup(await file.text()); say(t.restoreDone(n)); setTimeout(() => location.reload(), 900); } catch { say(t.restoreBad); }
  });
}

/** The last 7 days: one bar per day (sugars against the WHO limit), days logged, averages over the days that have amounts, days over a limit.
 *  A heavy day is a taller bar, never a failure. Drawn only from two days with an amount (see weekReady). */
function weekHtml(t, log) {
  const wp = weekPulse(log, todayKey());
  if (!weekReady(wp)) return '';
  const loc = isEl() ? 'el' : 'en', narrow = new Intl.DateTimeFormat(loc, { weekday: 'narrow' }), long = new Intl.DateTimeFormat(loc, { weekday: 'long', day: 'numeric', month: 'short' });
  const days = wp.rows.map(r => {
    const d = new Date(`${r.day}T12:00:00`), pr = progress(r.sugars, LIMITS.sugars);
    const label = pr ? `${long.format(d)}: ${t.nut.sugars} ${dec(r.sugars)} g · ${pr.pct} %` : r.entries ? `${long.format(d)}: ${t.noAmount}` : long.format(d);
    return `<li class="fs100-day${pr ? ` fs100-day--${pr.state}` : r.entries ? ' fs100-day--na' : ''}" role="img" aria-label="${esc(label)}" title="${esc(label)}"><i style="height:${pr ? Math.max(8, pr.bar) : 0}%"></i><span aria-hidden="true">${esc(narrow.format(d))}</span></li>`;
  }).join('');
  const over = wp.rows.filter(r => (r.sugars != null && r.sugars > LIMITS.sugars) || (r.salt != null && r.salt > LIMITS.salt)).length;
  const bits = [t.weekLogged(wp.daysLogged)];
  if (wp.avgSugars != null) bits.push(t.weekAvgSugar(dec(wp.avgSugars)));
  if (wp.avgSalt != null) bits.push(t.weekAvgSalt(dec(wp.avgSalt)));
  if (over) bits.push(t.weekOver(over));
  return `<div class="fs98-sec fs100-week"><p class="fs98-sec__label">${esc(t.weekTitle)} <span class="fs100-hint">· ${esc(t.weekBars)}</span></p>
    <ul class="fs100-days">${days}</ul>
    <p class="fs98-sub fs100-bits">${esc(bits.join(' · '))}</p>
    <details class="fs99-about"><summary>${esc(t.weekAbout)}</summary><ul class="fs99-notes"><li>${esc(t.weekOnly)}</li></ul></details></div>`;
}

/** The swap list: healthier products to buy next time, each with the product it replaces and its lowest current recorded price (nothing estimated). */
function listHtml(t, list, sum) {
  if (!list.length) return '';
  const rows = list.slice(0, 8).map(it => {
    const e = priceBook.get(it.gtin), line = e?.line;
    const unit = line?.unitPrice > 0 && line.unitBasis ? ` · ${money(line.unitPrice, line.currency)}/${line.unitBasis}` : '';
    const price = line ? ` · ${money(line.price, line.currency)}${line.retailer ? ` · ${line.retailer}` : ''}${line.older ? ` · ${t.listOlder}` : ''}${unit}` : e && !e.failed ? ` · ${t.listNoPrice}` : '';
    const note = ((it.forName ? t.listInstead(it.forName, it.forGrade) : '') + price).replace(/^ · /, '');
    return `<li class="fs100-item"><span class="fs98-grade fs98-grade--${esc(it.grade || 'U')}">${esc(it.grade || '—')}</span><span class="fs100-item__t"><a class="fs99-li__n" href="#/p/${esc(it.code)}">${esc(it.name)}</a><small>${esc(note)}</small></span><button type="button" class="fs99-x" data-fs100-rm="${esc(it.gtin)}" data-fs100-name="${esc(it.name)}" aria-label="${esc(t.listRemove(it.name))}">✕</button></li>`;
  }).join('');
  const lines = [t.listCount(sum.count)];
  if (sum.graded) lines.push(t.listGain(sum.improved, sum.graded, sum.gain));
  if (sum.total != null && sum.current) lines.push(t.listTotal(money(sum.total, sum.currency), sum.current, sum.count));
  if (sum.cheaper) lines.push(t.listCheaper(sum.cheaper));
  if (sum.dearer) lines.push(t.listDearer(sum.dearer));
  return `<div class="fs98-sec fs100-list"><p class="fs98-sec__label">${esc(t.listTitle)}</p><p class="fs98-sub">${esc(lines.join(' · '))}</p>
    ${sum.best?.forGrade ? `<p class="fs98-sub fs100-win">${esc(t.listBest(sum.best.name, sum.best.forGrade, sum.best.grade))}</p>` : ''}
    <ul class="fs99-list fs100-swaps">${rows}</ul>${list.length > 8 ? `<p class="fs99-low">${esc(t.listMore(list.length - 8))}</p>` : ''}<p class="fs99-low">${esc(t.listSub)}</p></div>`;
}

function renderHub(view) {
  const records = readAllRecords(), log = getDailyLog(), list = getList(), t = tr(), el = isEl();
  const welcome = !records.size && !log.length && !list.length;
  let hub = view.querySelector('.fs98-hub');
  if (!hub) { hub = document.createElement('section'); hub.className = 'fs98-hub'; view.prepend(hub); }
  hub.setAttribute('aria-label', t.hubTitle);
  hub.classList.toggle('fs100-welcome', welcome);
  document.documentElement.toggleAttribute('data-fs104-returning', records.size > 0);   // 104: Home opens on their own foods (see daily-v98.css)
  if (!hub.dataset.fs104) { hub.dataset.fs104 = '1'; hub.classList.add('fs104-in'); setTimeout(() => hub.classList.remove('fs104-in'), 1400); }   // the dials fill once, on arrival
  const open = hub.querySelector('details.fs98-more')?.open ? ' open' : '';

  // 100: a new phone or cleared storage: a compact welcome that still offers My Lens and Restore backup (before, the whole hub was removed and both were unreachable)
  if (welcome) {
    paint(hub, `<div class="fs98-head"><div><p class="fs98-eyebrow">${esc(t.hubEye)}</p><h2 class="fs98-title">${esc(t.hubTitle)}</h2><p class="fs98-sub">${esc(t.welcomeSub)}</p></div></div>
      ${locHtml(t, lang())}${moreHtml(t, el, open)}<p class="fs98-status" id="fs98-hub-status" role="status" aria-live="polite"></p>`, h => { wireMore(h, view, t); wireLoc(h, view, t); });
    return;
  }

  const savedRows = [...records.values()].filter(r => r.saved);
  const recentRows = [...records.values()].sort((a, b) => b.at - a.at).slice(0, 6);
  const abCount = savedRows.filter(r => ['A', 'B'].includes(safeGrade(r.product))).length;
  const td = todayKey(), todayRows = log.filter(x => x.day === td), di = dayIntake(todayRows);
  const streak = computeStreak(log.map(x => x.day), td), aboutOpen = !!hub.querySelector('details.fs99-about')?.open;
  const priceMap = new Map(); for (const [k, v] of priceBook) if (v.line) priceMap.set(k, v.line);
  if (list.length) wantPrices(list);
  const sum = listSummary(list, priceMap);

  const chips = recentRows.length
    ? recentRows.map(r => { const p = r.product, g = safeGrade(p), label = p.name || p.barcode;
        return `<button type="button" class="fs98-chip fs98-chip--log" data-fs98-log="${esc(r.key)}" title="${esc(label)}">${g ? `<span class="fs98-grade fs98-grade--${esc(g)}">${esc(g)}</span>` : ''}<span class="fs98-chip__txt">+ ${esc(label)}</span></button>`; }).join('')
    : `<span class="fs98-sub">${esc(t.quickLogEmpty)}</span>`;
  const pickRec = picker?.where === 'hub' ? records.get(picker.gtin) : null;
  if (picker?.where === 'hub' && !pickRec) picker = null;

  /* 104: the hub opens on the day itself: the date in words, the four dials, then the foods to tap. The two boxes of counts (often "0" and "0") became one line,
   * a streak is shown once there is one, and the country row moved under the lists: it is a setting. It stays on top only while it asks a question
   * (no country known, or the phone's clock and the connection disagree). */
  const mk = marketNow(), locTop = !mk.code || !!mk.suggest;
  const dateWords = new Intl.DateTimeFormat(el ? 'el' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  paint(hub, `
    <div class="fs98-head">
      <div><p class="fs98-eyebrow">${esc(t.hubEye)}</p><h2 class="fs98-title">${esc(t.hubTitle)}</h2><p class="fs98-sub">${esc(t.hubSub)}</p></div>
      ${streak > 0 ? `<span class="fs98-badge fs98-badge--good fs104-streak">${esc(t.streak)}: ${esc(t.streakDays(streak))}</span>` : ''}
    </div>
    <p class="fs104-meta"><time datetime="${esc(td)}">${esc(dateWords)}</time><span>${esc(t.summary(di.entries, savedRows.length, abCount))}</span></p>
    ${locTop ? locHtml(t, lang()) : ''}
    ${intakeHtml(t, di, aboutOpen)}
    <div class="fs98-sec fs100-wide fs104-quick"><p class="fs98-sec__label">${esc(t.quickLogLabel)}</p><div class="fs98-chips fs104-scroller">${chips}</div>${pickRec ? pickerHtml(pickRec.product) : ''}<p class="fs98-status" id="fs98-hub-status" role="status" aria-live="polite"></p></div>
    ${todayListHtml(t, todayRows)}
    ${weekHtml(t, log)}
    ${listHtml(t, list, sum)}
    ${locTop ? '' : locHtml(t, lang())}
    ${moreHtml(t, el, open)}`, h => {
    wireMore(h, view, t); wireLoc(h, view, t);
    const after = msg => { renderHub(view); const s = view.querySelector('#fs98-hub-status'); if (s) s.textContent = msg; };
    h.querySelectorAll('[data-fs98-log]').forEach(b => b.addEventListener('click', () => {
      const key = b.dataset.fs98Log;
      if (!records.get(key)?.product) return;
      picker = picker?.where === 'hub' && picker.gtin === key ? null : { gtin: key, where: 'hub', focus: true };   // a second tap on the same food closes the amounts
      renderHub(view);
    }));
    wirePicker(h.querySelector('.fs99-pick'), pickRec?.product, after);
    h.querySelectorAll('[data-fs99-rm]').forEach(b => b.addEventListener('click', () => { if (removeDailyLog(Number(b.dataset.fs99Rm), b.dataset.fs99Key)) after(t.removedMsg(b.dataset.fs99Name)); }));
    h.querySelectorAll('[data-fs100-rm]').forEach(b => b.addEventListener('click', () => { writeJSON(LIST_KEY, listRemove(getList(), b.dataset.fs100Rm)); after(t.listRemovedMsg(b.dataset.fs100Name)); }));
  });
}

let trustRetry = 0;
function renderProductTrust(view, code) {
  const anchor = view.querySelector('.report__main') || view.querySelector('.report');
  if (!anchor) return;
  // 100: a shared link has no history row yet: fall back to the app's own snapshot of the record, and look again for a few seconds while the app writes it
  const rec = readAllRecords().get(recordKey(code)) || snapshotRecord(code);
  if (!rec?.product) {
    view.querySelectorAll(`.fs98-trust:not([data-code="${code}"])`).forEach(n => n.remove());
    if (trustRetry++ < 10) setTimeout(schedule, 500);
    return;
  }
  trustRetry = 0;
  const p = rec.product, t = tr(), el = isEl(), unit = p.basis === 'ml' ? 'ml' : 'g';
  let dq = null; try { dq = dataQuality(p); } catch {}
  const aud = auditProduct(p, dq), pct = Math.round((aud.have / aud.total) * 100);
  const badge = aud.tier === 'high' ? 'good' : aud.tier === 'med' ? 'warn' : 'bad';
  const label = aud.tier === 'high' ? t.confHigh : aud.tier === 'med' ? t.confMed : t.confLow;
  const desc = aud.tier === 'high' ? (p.labelPhoto ? t.confHighLabel : t.confHighDesc) : aud.tier === 'med' ? t.confMedDesc : t.confLowDesc;
  // where the grade comes from, in one word: published, calculated from the record, estimated from similar products, or your own label photo
  let src = 'none';
  try { const a = assessGrade(p), qk = globalThis.__fs85quick?.get(code); src = provenance({ status: a?.status, grade: a?.grade, quick: qk && qk.state !== 'loading' ? qk.kind : null, label: !!p.labelGrade }); } catch {}

  const checks = [];
  if (p.labelPhoto) checks.push({ tone: 'good', text: t.labelNote });
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
  const pinned = getCompareList().some(x => sameFood(x.barcode, code));
  const logged = getDailyLog().some(x => x.day === todayKey() && sameFood(x.barcode, code));
  const openPick = picker?.where === 'product' && picker.gtin === recordKey(code);

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
    <p class="fs100-srcline"><span class="fs98-stat__k">${esc(t.srcLabel)}</span><span class="fs98-badge fs100-src fs100-src--${esc(src)}" title="${esc(t.srcTip[src])}">${esc(t.src[src])}</span></p>
    <div><span class="fs98-stat__k">${esc(t.compLabel(aud.have, aud.total))}${aud.missing.length ? ' · ' + esc(t.missingList(aud.missing.map(k => t.fields[k] || k))) : ''}</span><div class="fs98-meter" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div></div>
    <ul class="fs98-checks">${checks.map(c => `<li><span class="fs98-dot ${c.tone === 'warn' ? 'fs98-dot--warn' : c.tone === 'bad' ? 'fs98-dot--bad' : c.tone === 'soft' ? 'fs98-dot--soft' : ''}"></span><span>${esc(c.text)}</span></li>`).join('')}</ul>
    ${lensBadges ? `<div class="fs98-sec"><div class="fs98-chips">${lensBadges}</div></div>` : ''}
    <div class="fs98-foot">
      <div class="fs98-chips">
        <button type="button" class="fs98-btn fs98-btn--sm" data-fs98-had aria-pressed="${logged}" aria-expanded="${openPick}">${esc(logged ? t.hadTodayDone : t.hadToday)}</button>
        <button type="button" class="fs98-btn fs98-btn--sm" data-fs98-pin aria-pressed="${pinned}">${esc(pinned ? t.pinnedCompare : t.pinCompare)}</button>
      </div>
      <span>${esc(t.allergyNote)}</span>
    </div>
    ${openPick ? pickerHtml(p) : ''}
    <p class="fs98-status" id="fs99-prod-status" role="status" aria-live="polite"></p>`, c => {
    const after = msg => { renderProductTrust(view, code); const s = view.querySelector('#fs99-prod-status'); if (s) s.textContent = msg; };
    c.querySelector('[data-fs98-had]')?.addEventListener('click', () => { picker = openPick ? null : { gtin: recordKey(code), where: 'product', focus: true }; renderProductTrust(view, code); });
    wirePicker(c.querySelector('.fs99-pick'), p, after);
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
  const mixed = new Set(list.map(x => x.basis)).size > 1;   // a food (per 100 g) beside a drink (per 100 ml): no column is "best"
  const win = (v, b) => (!mixed && b != null && v === b ? 'fs98-win' : '');
  const row = (head, cell) => `<tr><th>${esc(head)}</th>${list.map(x => `<td class="${cell(x)[0]}">${cell(x)[1]}</td>`).join('')}</tr>`;

  modal.innerHTML = `
    <div class="fs98-modal__box">
      <div class="fs98-head"><div><h2 class="fs98-title">${esc(t.cmpTitle)}</h2><p class="fs98-sub">${esc(t.cmpSub)}</p></div><button type="button" class="fs98-btn fs98-btn--sm" data-fs98-close-cmp>${esc(t.cmpClose)}</button></div>
      ${mixed ? `<p class="fs98-sub fs100-mixed" role="note">${esc(t.mixedBasis)}</p>` : ''}
      <div class="fs98-table-wrap"><table class="fs98-table">
        <thead><tr><th>${esc(t.colMetric)}</th>${list.map(x => `<th><a href="#/p/${esc(x.barcode)}">${esc(x.name)}</a>${x.brand ? `<br><small>${esc(x.brand)}</small>` : ''}<br><small class="fs100-basis">${esc(t.perBasis[x.basis === 'ml' ? 'ml' : 'g'])}</small><br><button type="button" class="fs98-btn fs98-btn--sm" data-fs98-rm="${esc(x.barcode)}">${esc(t.cmpRemove)}</button></th>`).join('')}</tr></thead>
        <tbody>
          ${row(t.mGrade, x => ['', `<span class="fs98-grade fs98-grade--${esc(x.grade || 'U')}">${esc(x.grade || '—')}</span>`])}
          ${row(t.mNova, x => ['', x.nova != null ? `NOVA ${esc(x.nova)}` : '—'])}
          ${row(t.mKcal, x => [win(x.kcal, minKcal), x.kcal != null ? Math.round(x.kcal).toLocaleString(el ? 'el' : 'en') : '—'])}
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
  const blob = new Blob([JSON.stringify({ app: 'FoodScan', version: '106.0.0', exportedAt: new Date().toISOString(), data }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `foodscan-backup-${todayKey()}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}
function importBackup(text) {
  const pairs = parseBackup(text);
  for (const [k, v] of pairs) localStorage.setItem(k, v);
  return pairs.length;
}

/* Which page, which cards. The home hub needs the language, the saved/history/log data and the lens set: when none of them changed, nothing is redone. */
let lastKey = '', lastWhere = '';

/* ---- 100: "Swap list" buttons on the product page's healthier-swap rows (prices/swaps-ui-v88.js draws the rows; this adds one button under each) ---------------- */
function toggleSwap(b) {
  const a = b.closest('li')?.querySelector('a.fs88__item'), gk = gtin14(b.dataset.code), page = routeInfo().code;
  if (!a || !gk) return;
  const cur = getList();
  if (cur.some(x => x.gtin === gk)) writeJSON(LIST_KEY, listRemove(cur, gk));
  else {
    const rec = readAllRecords().get(recordKey(page)) || snapshotRecord(page);
    writeJSON(LIST_KEY, listAdd(cur, {
      code: b.dataset.code, name: a.querySelector('.fs88__name')?.textContent || '', brand: a.querySelector('.fs88__brand')?.textContent || '', grade: a.querySelector('.fs88__grade b')?.textContent || '',
      forCode: page, forName: rec?.product?.name || '', forGrade: rec ? safeGrade(rec.product) : null
    }, Date.now()));
  }
  ensureSwapButtons(document.getElementById('view'), page);
}
function ensureSwapButtons(view, code) {
  if (!view) return;
  const t = tr(), list = getList();
  for (const a of view.querySelectorAll('a.fs88__item[href*="#/p/"]')) {
    const li = a.closest('li'), to = (a.getAttribute('href').match(/#\/p\/(\d{8,14})/) || [])[1], gk = gtin14(to);
    if (!li || !gk || gk === gtin14(code)) continue;
    const on = list.some(x => x.gtin === gk);
    let b = li.querySelector(':scope > .fs100-add');
    if (!b) { b = document.createElement('button'); b.type = 'button'; b.className = 'fs98-btn fs98-btn--sm fs100-add'; li.append(b); b.addEventListener('click', () => toggleSwap(b)); }
    b.dataset.code = to;
    const text = on ? t.listOn : t.listAdd;
    if (b.textContent !== text) b.textContent = text;
    b.setAttribute('aria-pressed', String(on));
  }
}

function sync() {
  const view = document.getElementById('view');
  if (!view) return;
  const r = routeInfo(), where = `${r.page}:${r.code}`;
  if (where !== lastWhere) { lastWhere = where; picker = null; trustRetry = 0; closeModal(); }   // the amounts row and the compare dialog belong to one page: leaving it closes them
  if (r.page === 'product') ensureSwapButtons(view, r.code);
  // 100: signatures (length, first and last 48 characters) of the big stored lists, not the lists themselves: no megabyte string is built on each page change
  const qk = r.page === 'product' ? globalThis.__fs85quick?.get(r.code) : null;
  const mk = marketNow(), key = [r.page, r.code, lang(), `${mk.code}:${mk.source}:${mk.suggest || ''}`, readSig(PORTION_KEY), recordsKey(labelKeys()), readSig(DAILY_KEY), readSig(LENS_KEY), readSig(COMPARE_KEY), readSig(LIST_KEY), priceVersion, qk ? `${qk.kind}:${qk.state}` : '', todayKey()].join('\u0001');
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
const ours = n => { const e = n?.nodeType === 1 ? n : n?.parentElement; return !!e?.closest?.('.fs98-hub, .fs98-trust, .fs98-tray, .fs98-modal, .fs100-add'); };
function start() {
  const host = document.getElementById('app');
  if (host) new MutationObserver(muts => { if (muts.some(m => !ours(m.target))) schedule(); }).observe(host, { childList: true, subtree: true });
  addEventListener('hashchange', schedule); addEventListener('popstate', schedule); addEventListener('storage', schedule); addEventListener('fs:language', schedule);
  addEventListener('foodscan:market', () => { priceBook.clear(); priceVersion++; schedule(); });   // 102: the country was changed on another page (Prices, a product card): the hub follows
  schedule();
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}
