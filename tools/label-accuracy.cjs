#!/usr/bin/env node
/** Measures what the label reader really delivers, with the real OCR engine FoodScan ships.
 *   node tools/label-accuracy.cjs [count=40] [seed=1] [--verbose]
 * Draws random but physically consistent nutrition tables (English, Greek, French, German, Italian, Spanish; one, two or three value columns; comma or point decimals;
 * different fonts; rotation, blur, uneven light and noise), runs the exact browser pipeline (prices/label-ocr-v85.mjs: adaptive threshold + Tesseract + parser + repair)
 * in Chromium, and compares the result with the numbers the table was drawn from. Reports per-field accuracy and, what matters, the grade: how often the
 * letter is right, how often the reader says "not sure" (a range or a missing field), and how often it is confidently wrong.
 * Needs Playwright with Chromium (require('playwright')). */
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2).filter(a => !a.startsWith('--')), verbose = process.argv.includes('--verbose');
const COUNT = Number(args[0] || 40), SEED = Number(args[1] || 1);
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.wasm': 'application/wasm', '.json': 'application/json', '.css': 'text/css', '.gz': 'application/octet-stream' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)); const f = fs.existsSync(p) && fs.statSync(p).isDirectory() ? path.join(p, 'index.html') : p;
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});

const rng = (a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; })(SEED);
const pick = a => a[Math.floor(rng() * a.length)], between = (lo, hi) => lo + rng() * (hi - lo), round1 = v => Math.round(v * 10) / 10;
const LANG = {
  en: { head: ['Nutrition facts', 'Typical values', 'per 100 g', 'per serving'], rows: ['Energy', 'Fat', 'of which saturates', 'Carbohydrate', 'of which sugars', 'Fibre', 'Protein', 'Salt'], comma: false },
  el: { head: ['Διατροφικές πληροφορίες', 'Μέσες τιμές', 'ανά 100 g', 'ανά μερίδα'], rows: ['Ενέργεια', 'Λιπαρά', 'εκ των οποίων κορεσμένα', 'Υδατάνθρακες', 'εκ των οποίων σάκχαρα', 'Φυτικές ίνες', 'Πρωτεΐνες', 'Αλάτι'], comma: true },
  fr: { head: ['Valeurs nutritionnelles', 'Moyennes', 'pour 100 g', 'par portion'], rows: ['Énergie', 'Matières grasses', 'dont acides gras saturés', 'Glucides', 'dont sucres', 'Fibres alimentaires', 'Protéines', 'Sel'], comma: true },
  de: { head: ['Nährwerte', 'Durchschnittswerte', 'pro 100 g', 'pro Portion'], rows: ['Brennwert', 'Fett', 'davon gesättigte Fettsäuren', 'Kohlenhydrate', 'davon Zucker', 'Ballaststoffe', 'Eiweiß', 'Salz'], comma: true },
  it: { head: ['Valori nutrizionali', 'Valori medi', 'per 100 g', 'per porzione'], rows: ['Energia', 'Grassi', 'di cui acidi grassi saturi', 'Carboidrati', 'di cui zuccheri', 'Fibre', 'Proteine', 'Sale'], comma: true },
  es: { head: ['Información nutricional', 'Valores medios', 'por 100 g', 'por ración'], rows: ['Valor energético', 'Grasas', 'de las cuales saturadas', 'Hidratos de carbono', 'de los cuales azúcares', 'Fibra alimentaria', 'Proteínas', 'Sal'], comma: true },
};
function spec(i) {
  const lang = pick(Object.keys(LANG)), kind = pick(['snack', 'dairy', 'bread', 'sauce', 'cereal', 'meat', 'sweet', 'veg']);
  const P = { snack: [[18, 38], [40, 65], [4, 10], [0.8, 2.2]], dairy: [[1, 20], [3, 15], [3, 9], [0.1, 1.2]], bread: [[1, 8], [40, 60], [6, 12], [0.8, 1.5]], sauce: [[2, 20], [5, 20], [0.6, 3], [1.0, 3]], cereal: [[2, 15], [60, 80], [6, 14], [0.01, 0.9]], meat: [[3, 25], [0, 4], [14, 26], [0.8, 2.5]], sweet: [[8, 32], [45, 70], [2, 8], [0.05, 0.5]], veg: [[0.2, 3], [3, 12], [0.8, 3], [0.01, 0.5]] }[kind];
  let fat = between(...P[0]), carbs = between(...P[1]), protein = between(...P[2]), salt = between(...P[3]);
  const sat = fat * between(0.12, 0.7), sugars = carbs * between(0.02, kind === 'sweet' ? 0.85 : 0.5), fibre = kind === 'sweet' || kind === 'meat' ? between(0, 2) : between(0.5, 9);
  const mass = fat + carbs + protein + fibre + salt; if (mass > 97) { const k = 97 / mass; fat *= k; carbs *= k; protein *= k; }
  const f = v => v >= 10 ? Math.round(v) : round1(v);
  const v = { fat: f(fat), carbs: f(carbs), protein: f(protein), fibre: f(fibre), salt: Math.round(salt * 100) / 100 };
  v.sat = Math.min(f(sat), v.fat); v.sugars = Math.min(f(sugars), v.carbs);
  v.kj = Math.round(37 * v.fat + 17 * (v.carbs + v.protein) + 8 * v.fibre); v.kcal = Math.round(v.kj / 4.184);
  const omitFibre = rng() < 0.12; if (omitFibre) v.fibre = null;
  return { lang, kind, v, columns: pick([1, 1, 2, 3]), font: pick(['Arial', 'Helvetica', 'DejaVu Sans', 'Liberation Sans', 'Times New Roman', 'Verdana']), size: Math.round(between(22, 30)), rot: between(-3, 3), blur: between(0, 1.1), noise: between(0, 26), shade: rng() < 0.5, dark: rng() < 0.12, noiseSeed: Math.floor(rng() * 1e9), dec: LANG[lang].comma };
}

/** Runs in the page: draws one table and reads it back through the shipped pipeline. */
async function drawAndRead([s, L]) {
  let seed = s.noiseSeed; const rand = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const fmt = (v, d) => (d ? String(v).replace('.', ',') : String(v));
  const rows = L.rows, V = s.v, dec = s.dec;
  const val = (key, g) => key === 'kcal' ? `${V.kj} kJ / ${V.kcal} kcal` : (V[key] == null ? null : `${fmt(V[key], dec)} g`);
  const body = [[rows[0], 'kcal'], [rows[1], 'fat'], [rows[2], 'sat'], [rows[3], 'carbs'], [rows[4], 'sugars'], [rows[5], 'fibre'], [rows[6], 'protein'], [rows[7], 'salt']].filter(r => r[1] === 'kcal' || V[r[1]] != null || r[1] !== 'fibre');
  const rowH = Math.round(s.size * 1.9), cols = s.columns, width = cols === 1 ? 640 : cols === 2 ? 860 : 1000, height = 110 + body.length * rowH;
  const c = document.createElement('canvas'); c.width = width; c.height = height; const g = c.getContext('2d');
  g.fillStyle = s.dark ? '#1b1b1b' : '#f6f3ea'; g.fillRect(0, 0, width, height); const ink = s.dark ? '#f1f1f1' : '#111'; g.fillStyle = ink; g.strokeStyle = ink;
  g.font = `bold ${s.size + 2}px ${s.font}`; g.fillText(L.head[0], 22, 38); g.font = `${s.size - 3}px ${s.font}`; g.fillText(L.head[1], 22, 66);
  const x1 = cols === 1 ? 380 : 360, x2 = 560, x3 = 740;
  g.font = `bold ${s.size - 3}px ${s.font}`; g.fillText(L.head[2], x1, 92); if (cols >= 2) g.fillText(L.head[3], x2, 92); if (cols >= 3) g.fillText('%RI*', x3, 92);
  const scale = 0.3;
  body.forEach(([label, key], i) => {
    const y = 130 + i * rowH; g.font = `${s.size}px ${s.font}`; g.fillText(label, 22, y);
    const per100 = val(key); if (per100) g.fillText(per100, x1, y);
    if (cols >= 2) { const sv = key === 'kcal' ? `${Math.round(V.kj * scale)} kJ / ${Math.round(V.kcal * scale)} kcal` : V[key] == null ? null : `${fmt(Math.round(V[key] * scale * 10) / 10, dec)} g`; if (sv) g.fillText(sv, x2, y); }
    if (cols >= 3) g.fillText(`${Math.round(5 + rand() * 40)}%`, x3, y);
    g.lineWidth = 1; g.beginPath(); g.moveTo(16, y + 14); g.lineTo(width - 16, y + 14); g.stroke();
  });
  const o = document.createElement('canvas'); o.width = width + 80; o.height = height + 80; const h = o.getContext('2d'); h.fillStyle = '#b9b2a0'; h.fillRect(0, 0, o.width, o.height);
  h.save(); h.translate(o.width / 2, o.height / 2); h.rotate(s.rot * Math.PI / 180); h.filter = `blur(${s.blur.toFixed(2)}px) contrast(0.88)`; h.drawImage(c, -width / 2, -height / 2); h.restore();
  const id = h.getImageData(0, 0, o.width, o.height), a = id.data;
  for (let y = 0; y < o.height; y++) for (let x = 0; x < o.width; x++) { const i = (y * o.width + x) * 4, n = (rand() - .5) * s.noise, sh = s.shade ? -70 * (x / o.width) * (y / o.height + .3) : 0; a[i] += n + sh; a[i + 1] += n + sh; a[i + 2] += n + sh; }
  h.putImageData(id, 0, 0);
  const blob = await new Promise(ok => o.toBlob(ok, 'image/png'));
  const t0 = performance.now(), mod = await import('/prices/label-ocr-v85.mjs'), r = await mod.readLabelPhoto(blob);
  const use = r.combined || r.best.reading; return { ms: Math.round(performance.now() - t0), best: { text: r.best.text, psm: r.best.psm + '/' + r.best.how, reading: use }, passes: r.passes.length, source: use.source || 'single' };
}

(async () => {
  await new Promise(ok => server.listen(0, ok)); const port = server.address().port;
  const { gradeFromLabel } = await import(path.join(root, 'prices/label-reader-v85.mjs'));
  const browser = await chromium.launch(), ctx = await browser.newContext({ viewport: { width: 1000, height: 800 }, serviceWorkers: 'block' }), page = await ctx.newPage();
  page.on('pageerror', e => console.error('page error', e.message));
  await page.goto(`http://localhost:${port}/how/`, { waitUntil: 'domcontentloaded' });
  const fields = ['kj', 'fat', 'sat', 'carbs', 'sugars', 'fibre', 'protein', 'salt'], ok = Object.fromEntries(fields.map(k => [k, 0])), seen = Object.fromEntries(fields.map(k => [k, 0]));
  const tally = { silent: 0, wrongFields: 0, flaggedWrong: 0, silentGrade: 0, n: 0, core: 0, allCore: 0, gradeRight: 0, gradeRange: 0, gradeNeeds: 0, wrongConfident: 0, wrongRange: 0, consistent: 0, consistentWrong: 0, ms: 0 }, bad = [];
  for (let i = 0; i < COUNT; i++) {
    const s = spec(i), r = await page.evaluate(drawAndRead, [s, LANG[s.lang]]).catch(e => ({ error: e.message })) ;
    if (r.error) { console.log(`#${i} error ${r.error}`); continue; }
    tally.n++; tally.ms += r.ms; const got = r.best.reading.values, want = s.v;
    const same = (k) => got[k] != null && Math.abs(got[k] - (k === 'kj' ? want.kj : want[k])) <= (k === 'kj' ? 5 : k === 'salt' ? 0.011 : 0.051);
    for (const k of fields) if (want[k] != null) { seen[k]++; if (same(k)) ok[k]++; }
    const flags = r.best.reading.flags || {}, dis = r.best.reading.disagree || [], flagged = k => Boolean(flags[k] || flags[k === 'kcal' ? 'kj' : k] || dis.includes(k)) || !r.best.reading.consistent;
    let silentHere = 0; for (const k of fields) if (want[k] != null && !same(k)) { tally.wrongFields++; if (flagged(k)) tally.flaggedWrong++; else { tally.silent++; silentHere++; } }
    const core = ['kj', 'sugars', 'sat', 'salt'].every(same); if (core) tally.core++;
    const all = fields.every(k => want[k] == null ? true : same(k)); if (all) tally.allCore++;
    if (r.best.reading.consistent) tally.consistent++;
    // what the shopper gets with no editing at all
    const truth = gradeFromLabel({ kj: want.kj, kcal: want.kcal, sugars: want.sugars, sat: want.sat, salt: want.salt, fibre: want.fibre, protein: want.protein, fat: want.fat }, { kind: 'general' });
    const mine = gradeFromLabel(got, { kind: 'general' });
    if (!mine.ok) tally.gradeNeeds++;
    else if (mine.grade && truth.grade !== mine.grade && silentHere) tally.silentGrade++;
    else if (mine.grade) { if (truth.grade === mine.grade) tally.gradeRight++; else { tally.wrongConfident++; if (r.best.reading.consistent) tally.consistentWrong++; } }
    else if (truth.grade && mine.range[0] <= truth.grade && truth.grade <= mine.range[1]) tally.gradeRange++; else tally.wrongRange++;
    if (!all || verbose) bad.push({ i, s: `${s.lang}/${s.kind}/${s.columns}col/${s.font}${s.size}`, want: JSON.stringify(want), got: JSON.stringify(got), fix: JSON.stringify(r.best.reading.corrections), consistent: r.best.reading.consistent, grade: `${truth.grade || truth.range?.join('-')} vs ${mine.ok ? (mine.grade || mine.range.join('-')) : 'needs ' + mine.missing}`, text: verbose ? r.best.text : '' });
  }
  console.log(`\nLabel reader accuracy, ${tally.n} synthetic labels, seed ${SEED}, mean ${Math.round(tally.ms / tally.n)} ms per photo`);
  for (const k of fields) console.log(`  ${k.padEnd(8)} ${ok[k]}/${seen[k]}  ${(100 * ok[k] / Math.max(1, seen[k])).toFixed(0)}%`);
  console.log(`  core four (kJ, sugars, saturates, salt) all right: ${tally.core}/${tally.n}; every printed row right: ${tally.allCore}/${tally.n}; numbers fit each other: ${tally.consistent}/${tally.n}`);
  console.log(`  grade, no editing: right ${tally.gradeRight}, inside the range shown ${tally.gradeRange}, asks for a missing row ${tally.gradeNeeds}, WRONG letter stated ${tally.wrongConfident} (of which marked consistent: ${tally.consistentWrong}), wrong range ${tally.wrongRange}`);
  console.log(`  wrong fields ${tally.wrongFields}: flagged for review ${tally.flaggedWrong}, silent ${tally.silent}; wrong grade letters that nothing warned about: ${tally.silentGrade}`);
  if (bad.length) { console.log('\nNot fully right:'); for (const b of bad.slice(0, 25)) console.log(`  #${b.i} ${b.s}\n     want ${b.want}\n     got  ${b.got}\n     fix  ${b.fix} consistent=${b.consistent} grade ${b.grade}${b.text ? '\n' + b.text.split('\n').map(l => '       | ' + l).join('\n') : ''}`); }
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
