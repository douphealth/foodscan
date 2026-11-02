/* FoodScan 72 · adapter: Greek Ministry of Development price observatory (posokanei.gov.gr), via the public daily archive
 * https://github.com/spyrosavl/posokanei (MIT; one JSON snapshot per day of api.posokanei.gov.gr).
 *
 * Evidence only. Every record this file produces is one chain price exactly as the observatory published it, with its own
 * date. Nothing is estimated, averaged or carried across products. The observatory publishes no barcodes, so a price is
 * attached to a barcode only through the reviewed EAN link file (data/ean-posokanei-map-v1.json); every other product is
 * ignored. A linked product whose observatory name has changed since the review is skipped, not guessed.
 *
 * Runs unchanged in a Cloudflare Worker (cron) and in Node 18+ (scripts/import.mjs). Memory stays small: the ~30 MB daily
 * file is read as a stream and only the linked products are parsed. */

export const ARCHIVE_BASE = 'https://raw.githubusercontent.com/spyrosavl/posokanei/main/data';
export const archiveURL = date => `${ARCHIVE_BASE}/${date.slice(0, 4)}/posokanei-${date}.json`;
export const SOURCE = Object.freeze({
  id: 'posokanei',
  label: 'Παρατηρητήριο Τιμών · posokanei.gov.gr',
  labelEn: 'Price observatory · posokanei.gov.gr',
  url: 'https://posokanei.gov.gr/',
  license: 'posokanei.gov.gr public-sector data (Law 4727/2020) via github.com/spyrosavl/posokanei (MIT)',
});
/** Observatory chain id -> FoodScan chain id (FS_PRICE_CHAINS) and display name. Only Greek chains. */
export const CHAIN_MAP = Object.freeze({
  sklavenitis: ['sklavenitis', 'Σκλαβενίτης'], ab_vasilopoulos: ['ab', 'AB Βασιλόπουλος'], mymarket: ['mymarket', 'My market'],
  masoutis: ['masoutis', 'Μασούτης'], lidl: ['lidl', 'Lidl'], kritikos: ['kritikos', 'Κρητικός'], galaxias: ['galaxias', 'Γαλαξίας'],
  market_in: ['marketin', 'Market In'], synka: ['synka', 'ΣΥΝΚΑ'], halkiadakis: ['chalkiadakis', 'Χαλκιαδάκης'], bazaar: ['bazaar', 'Bazaar'],
});

const DAY = 86400000;
export const isoDay = s => { const d = typeof s === 'string' ? s.slice(0, 10) : ''; return /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d + 'T00:00:00Z')) ? d : null; };
export const fold = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}%]+/gu, ' ').trim();
export const key14 = c => String(c).padStart(14, '0');

/** The links: Map<pk_id, link>. Schema 1 = reviewed by hand; schema 2 adds link.method ('hand' | 'auto-exact'). */
export function loadLinks(doc) {
  if (!doc || ![1, 2].includes(doc.schema) || !Array.isArray(doc.links)) throw new Error('link_file_invalid');
  if (doc.schema === 2 && doc.links.some(l => !['hand', 'auto-exact', 'auto-worker', 'auto-price'].includes(l.method))) throw new Error('link_file_invalid');
  const byId = new Map(), seen = new Set();
  for (const l of doc.links) {
    if (!/^\d{8,14}$/.test(l.ean) || !l.pk_id || seen.has(l.ean) || byId.has(l.pk_id)) throw new Error('link_file_not_one_to_one');
    seen.add(l.ean); byId.set(l.pk_id, l);
  }
  return byId;
}

/** Streams the snapshot and yields only the products whose id is wanted. Also fills meta.date / meta.fetched_at / meta.source.
 *  A small state machine over the JSON text: strings, nesting depth, and the top-level "products" array. */
export async function* streamProducts(stream, wanted, meta = {}) {
  const decoder = new TextDecoder();
  let depth = 0, inStr = false, esc = false, strStart = -1, lastKey = null, expectValue = false, inProducts = false;
  let objStart = -1, carry = '', resume = 0, topKey = '', scanned = 0;
  const reader = stream.getReader ? stream.getReader() : null;
  const chunks = reader ? { async next() { return reader.read(); } } : stream[Symbol.asyncIterator]();
  for (;;) {
    const { value, done } = await chunks.next();
    const text = done ? decoder.decode() : decoder.decode(value, { stream: true });
    if (!text && done) break;
    const buf = carry + text; const base = resume; carry = ''; resume = 0;
    for (let i = base; i < buf.length; i++) {
      const c = buf.charCodeAt(i);
      if (inStr) {
        if (esc) esc = false; else if (c === 92) esc = true; else if (c === 34) {
          inStr = false;
          if (depth === 1 && strStart >= 0) {
            const s = buf.slice(strStart, i);
            if (expectValue) { if (['date', 'fetched_at', 'source'].includes(topKey)) meta[topKey] = s; expectValue = false; } else lastKey = s;
          }
          strStart = -1;
        }
        continue;
      }
      if (c === 34) { inStr = true; strStart = depth === 1 ? i + 1 : -1; continue; }
      if (c === 58 && depth === 1) { topKey = lastKey; expectValue = true; continue; }
      if (c === 44 && depth === 1) { expectValue = false; continue; }
      if (c === 123 || c === 91) {
        if (depth === 1 && c === 91 && topKey === 'products') inProducts = true;
        if (inProducts && depth === 2 && c === 123) objStart = i;
        depth++; if (depth === 2) expectValue = false; continue;
      }
      if (c === 125 || c === 93) {
        depth--;
        if (inProducts && depth === 2 && c === 125 && objStart >= 0) {
          const raw = buf.slice(objStart, i + 1); objStart = -1; scanned++;
          let hit = false; for (const m of raw.matchAll(/"id"\s*:\s*"([^"]{6,64})"/g)) if (wanted.has(m[1])) { hit = true; break; }
          if (hit) { try { const p = JSON.parse(raw); if (wanted.has(p.id)) yield p; } catch { /* malformed product: skipped */ } }
        }
        if (inProducts && depth === 1) inProducts = false;
      }
    }
    if (objStart >= 0) { carry = buf.slice(objStart); resume = carry.length; objStart = 0; }
    else if (inStr && strStart >= 0) { carry = buf.slice(strStart - 1); resume = 0; inStr = false; esc = false; strStart = -1; }
    if (done) break;
  }
  meta.scanned = scanned;
}

/** One observatory product -> FoodScan price records (one per Greek chain). Prices are copied, never computed. */
export function recordsFor(product, link, { snapshotDate, archive, now = Date.now(), maxAgeDays = 30 } = {}) {
  const out = [], skipped = [];
  if (!product || product.id !== link.pk_id) return { out, skipped: ['wrong_product'] };
  if (!sameProductName(product.name, link.pk_name)) return { out, skipped: ['renamed_since_review'] };
  const pack = packOf(product);
  for (const r of Array.isArray(product.retailer_prices) ? product.retailer_prices : []) {
    if (r?.country !== 'GR') continue;
    const chain = CHAIN_MAP[r.retailer]; if (!chain) { skipped.push('unknown_chain:' + r.retailer); continue; }
    const price = typeof r.price === 'number' && Number.isFinite(r.price) ? Math.round(r.price * 100) / 100 : null;
    if (!(price >= 0.01 && price <= 10000)) { skipped.push('bad_price'); continue; }
    const date = isoDay(r.last_updated) || null;
    if (!date) { skipped.push('no_date'); continue; }
    const age = Math.floor((now - Date.parse(date + 'T00:00:00Z')) / DAY);
    if (age < -1 || age > maxAgeDays) { skipped.push('too_old'); continue; }
    const unitPrice = pack && pack.unit !== 'pcs' ? Math.round(price / pack.amount * 100) / 100 : null;
    out.push({
      barcode: link.ean, retailer_id: chain[0], retailer: chain[1], store_scope: 'national', store_id: 'posokanei-national',
      store_name: chain[1], price, basis: 'item', observed_at: date, discount_type: r.is_discount === true ? 'SALE' : '',
      discount_percentage: typeof r.discount_percentage === 'number' ? r.discount_percentage : null,
      unit_price: unitPrice, unit: pack?.unit || null, pack_amount: pack?.amount ?? null,
      source_url: SOURCE.url, evidence_url: archive || (snapshotDate ? archiveURL(snapshotDate) : SOURCE.url), pk_id: product.id, pk_name: product.name,
    });
  }
  return { out, skipped };
}
/** The observatory id is stable, but a reused id must never move a price onto another product. Accepted: the same name,
 *  or the same words reordered or with a brand word added or dropped (at most 2 words), and exactly the same numbers
 *  (size, percentage, count). Anything else waits for a new review. */
export function sameProductName(now, was) {
  const a = fold(now), b = fold(was); if (a === b) return true;
  const ta = new Set(a.split(' ')), tb = new Set(b.split(' '));
  const nums = t => [...t].filter(w => /\d/.test(w)).sort().join('|');
  if (nums(ta) !== nums(tb)) return false;
  const [small, big] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  for (const w of small) if (!big.has(w)) return false;
  return big.size - small.size <= 2 && small.size >= 2;
}
/** Real pack size as the observatory states it (unit + unit_quantity): kg, l or pcs. */
export function packOf(p) {
  const u = String(p?.unit || '').toLowerCase(), q = Number(p?.unit_quantity);
  if (!(q > 0) || q > 100) return null;
  if (u === 'kg') return { amount: q, unit: 'kg' };
  if (u === 'l') return { amount: q, unit: 'l' };
  if (u === 'pcs') return { amount: q, unit: 'pcs' };
  return null;
}

/** Only what the matcher and the price records need (keeps a full snapshot in a few MB inside the Worker). */
export const slimProduct = p => ({ id: p.id, name: p.name, brand: p.brand, unit: p.unit, unit_quantity: p.unit_quantity, category: p.category, subcategory: p.subcategory,
  private_label: p.private_label, available_countries: p.available_countries,
  retailer_prices: (Array.isArray(p.retailer_prices) ? p.retailer_prices : []).filter(r => r?.country === 'GR').map(r => ({ country: 'GR', retailer: r.retailer, price: r.price, last_updated: r.last_updated, is_discount: r.is_discount, discount_percentage: r.discount_percentage })) });

/** 81: one chain far below every other chain for the same product is almost always a data error at that chain (a different pack,
 *  a per-unit "1+1" price, a typo): Market In 0,99 EUR while eight chains say 1,80. Shown as "the lowest price" it makes the whole
 *  card wrong. A price below OUTLIER_RATIO x the median of at least two OTHER chains (same snapshot) is left out of the seed and
 *  logged in stats.quarantined (published as quarantine.json). Prices above the median are never dropped: a chain may be dearer. */
export const OUTLIER_RATIO = 0.6;
export function quarantineOutliers(rows) {
  if (rows.length < 3) return { keep: rows, dropped: [] };
  const keep = [], dropped = [];
  for (const r of rows) {
    const others = rows.filter(x => x !== r && x.retailer_id !== r.retailer_id).map(x => x.price).sort((a, b) => a - b);
    if (others.length < 2) { keep.push(r); continue; }
    const m = others.length % 2 ? others[(others.length - 1) / 2] : (others[others.length / 2 - 1] + others[others.length / 2]) / 2;
    if (r.price < m * OUTLIER_RATIO) dropped.push({ chain: r.retailer_id, price: r.price, median_other_chains: Math.round(m * 100) / 100, discount: !!r.discount_type, date: r.observed_at });
    else keep.push(r);
  }
  return { keep, dropped };
}

/** Linked products -> records. products: iterable of observatory products (only linked ones are used). */
export function ingestProducts(products, linkDoc, meta, { archive = '', now = Date.now(), maxAgeDays = 30, minProducts = 1000 } = {}) {
  const links = loadLinks(linkDoc), records = [], out_products = {}, stats = { linked: links.size, found: 0, renamed: [], chains: {}, skipped: {} };
  for (const p of products) {
    const link = links.get(p.id); if (!link) continue; stats.found++;
    const { out, skipped } = recordsFor(p, link, { snapshotDate: meta.date, archive, now, maxAgeDays });
    for (const s of skipped) stats.skipped[s] = (stats.skipped[s] || 0) + 1;
    if (skipped.includes('renamed_since_review')) { stats.renamed.push({ ean: link.ean, was: link.pk_name, now: p.name }); continue; }
    const pack = packOf(p);
    const { keep, dropped } = quarantineOutliers(out);
    for (const d of dropped) (stats.quarantined ||= []).push({ ean: link.ean, name: p.name, ...d });
    out_products[key14(link.ean)] = { n: p.name, id: p.id, m: link.method === 'hand' || !link.method ? 'h' : 'a', ...(link.method && !['hand', 'auto-exact'].includes(link.method) ? { lm: link.method } : {}),
      u: pack?.unit || null, q: pack?.amount ?? null, p: keep.map(r => [r.retailer_id, r.price, r.observed_at, r.discount_type ? 1 : 0]) };
    for (const r of keep) { records.push(r); stats.chains[r.retailer_id] = (stats.chains[r.retailer_id] || 0) + 1; }
  }
  stats.scanned = meta.scanned || 0;
  if (!meta.date || stats.scanned < minProducts) throw new Error('snapshot_incomplete');
  return { meta: { date: isoDay(meta.date), fetched_at: meta.fetched_at || null, source: meta.source || null, archive }, records, products: out_products, stats };
}

/** Reads one snapshot and returns everything the seed, the SQL and D1 need (only the linked products are parsed). */
export async function ingestSnapshot(stream, linkDoc, opts = {}) {
  const links = loadLinks(linkDoc), meta = {}, found = [];
  for await (const p of streamProducts(stream, links, meta)) found.push(p);
  return ingestProducts(found, linkDoc, meta, opts);
}

/** Reads the whole snapshot once (slimmed): for the Worker, which matches new barcodes and then ingests in one pass. */
export async function readSnapshot(stream) {
  const meta = {}, all = [];
  for await (const p of streamProducts(stream, { has: () => true }, meta)) all.push(slimProduct(p));
  return { meta, products: all };
}
