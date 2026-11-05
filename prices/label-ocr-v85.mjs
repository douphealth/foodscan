/* FoodScan 85: reads a nutrition table out of a photo, on the device. Tesseract.js (English + Greek) is served by FoodScan itself; the photo never leaves the phone.
 * Two readings of the same photo, because tables fail in different ways: an adaptively thresholded copy (uneven light, shadows, glossy packs) read as one block of
 * rows, and a plain grey copy read as a column. Each reading is parsed and repaired by label-reader-v85.mjs; the one whose numbers fit the physics of a label best wins. */
import { readLabel, rowsFromWords, consensus } from './label-reader-v85.mjs';

let worker = null, loading = null;
async function engine(onStatus) {
  if (worker) return worker;
  if (loading) return loading;
  loading = (async () => {
    if (!globalThis.Tesseract) {
      onStatus?.('load');
      await new Promise((ok, fail) => { const s = document.createElement('script'); s.src = '/prices/ocr/tesseract.min.js'; s.onload = ok; s.onerror = fail; document.head.append(s); });
    }
    worker = await globalThis.Tesseract.createWorker(['eng', 'ell'], 1, { workerPath: '/prices/ocr/worker.min.js', corePath: '/prices/ocr/core', langPath: '/prices/ocr/lang', workerBlobURL: false, gzip: true, cacheMethod: 'write' }, { lstm_choice_mode: '2', lstm_choice_iterations: '5' });
    return worker;
  })();
  try { return await loading; } finally { loading = null; }
}

/** Grey, contrast-stretched, and a locally thresholded copy (each pixel against the mean of its neighbourhood, via an integral image). `scale` multiplies the working size. */
async function images(file, scale = 1) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(2, 2200 / Math.max(bmp.width, bmp.height)) * scale, w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
  const grey = document.createElement('canvas'); grey.width = w; grey.height = h;
  const g = grey.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h), a = d.data, lum = new Uint8ClampedArray(w * h);
  let lo = 255, hi = 0; const hist = new Uint32Array(256);
  for (let i = 0, p = 0; p < lum.length; i += 4, p++) { const v = (a[i] * 299 + a[i + 1] * 587 + a[i + 2] * 114) / 1000 | 0; lum[p] = v; hist[v]++; }
  let acc = 0; for (let v = 0; v < 256; v++) { acc += hist[v]; if (lo === 255 && acc > lum.length * 0.01) lo = v; if (acc > lum.length * 0.99) { hi = v; break; } }
  const span = Math.max(40, hi - lo);
  const stretched = new Uint8ClampedArray(lum.length); for (let p = 0; p < lum.length; p++) stretched[p] = Math.max(0, Math.min(255, (lum[p] - lo) * 255 / span));
  const paint = px => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'), o = x.createImageData(w, h); for (let p = 0, i = 0; p < px.length; p++, i += 4) { o.data[i] = o.data[i + 1] = o.data[i + 2] = px[p]; o.data[i + 3] = 255; } x.putImageData(o, 0, 0); return c; };
  const W = w + 1, sum = new Float64Array(W * (h + 1));
  for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += stretched[y * w + x]; sum[(y + 1) * W + x + 1] = sum[y * W + x + 1] + row; } }
  const r = Math.max(12, Math.round(Math.min(w, h) / 24)), bin = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1), n = (x1 - x0) * (y1 - y0);
      const mean = (sum[y1 * W + x1] - sum[y0 * W + x1] - sum[y1 * W + x0] + sum[y0 * W + x0]) / n;
      bin[y * w + x] = stretched[y * w + x] < mean * 0.86 ? 0 : 255;
    }
  }
  return { binary: paint(bin), grey: paint(stretched) };
}

/** How well a reading fits: rows found, the four nutrients the grade needs, and whether the numbers fit each other. Higher is better. */
export function readingScore(r) {
  const v = r.values, need = ['kj', 'sugars', 'sat', 'salt'].filter(k => v[k] != null).length, more = ['fat', 'carbs', 'fibre', 'protein'].filter(k => v[k] != null).length;
  return need * 3 + more * 2 + (r.consistent ? 12 : 0) - r.corrections.length * 0.7;
}

const enough = r => r.reading.consistent && ['kj', 'sugars', 'sat', 'salt'].every(k => r.reading.values[k] != null);

/** Read the nutrition table from a photo. Passes run one after another and stop as soon as a reading is complete and its numbers fit together; otherwise
 *  further passes (other scales, other layouts) are added and the readings vote. Returns the combined reading, the single best one and every pass. */
export async function readLabelPhoto(file, { onStatus } = {}) {
  const w = await engine(onStatus);
  onStatus?.('read');
  const out = [];
  const run = async (img, psm, tag) => {
    await w.setParameters({ tessedit_pageseg_mode: psm, preserve_interword_spaces: '1' });
    const { data } = await w.recognize(img);
    // the text as Tesseract ordered it, and the rows rebuilt from the word boxes (a column of labels followed by a column of numbers becomes rows again)
    for (const [how, text] of [['text', data.text || ''], ['rows', rowsFromWords(data.words)]]) {
      if (!text) continue;
      const reading = readLabel(text); out.push({ text, psm, how: how + '@' + tag, reading, score: readingScore(reading) });
    }
  };
  const first = await images(file, 1);
  await run(first.binary, '6', '1'); await run(first.grey, '4', '1');
  const top = () => [...out].sort((a, b) => b.score - a.score)[0];
  if (!enough(top())) {
    onStatus?.('again');
    const small = await images(file, 0.7), large = await images(file, 1.35);
    await run(small.binary, '6', '0.7'); await run(large.binary, '6', '1.35'); await run(large.grey, '4', '1.35');
  }
  out.sort((a, b) => b.score - a.score);
  const merged = consensus(out.filter(r => r.score > 0).map(r => ({ ...r.reading, weight: Math.max(1, r.score) ** 2 })));
  return { best: out[0], combined: merged, passes: out };
}
export async function closeLabelOcr() { if (worker) { try { await worker.terminate(); } catch {} worker = null; } }
