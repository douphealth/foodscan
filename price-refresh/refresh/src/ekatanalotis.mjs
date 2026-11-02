/* FoodScan 72 · adapter: e-katanalotis basket prices (Ministry of Development app, data file published by its operator
 * Warply on a public S3 address). The only official Greek price list that carries barcodes. Each product has one price per
 * chain and one date for the whole file. Prices are copied as published; nothing is computed.
 *
 * At the time of writing the file has not changed since 16 Jun 2026 (Last-Modified header), so its prices are history,
 * shown as such and never used to rank chains. The cron Worker checks the file daily (ETag) and, if the ministry starts
 * refreshing it again, the same code turns it into current prices with no other change. */

export const FEED_URL = 'https://warply.s3.amazonaws.com/applications/ed840ad545884deeb6c6b699176797ed/basket-retailers/prices.json';
export const SOURCE = Object.freeze({
  id: 'ekatanalotis', label: 'e-katanalotis · Υπουργείο Ανάπτυξης', labelEn: 'e-katanalotis · Ministry of Development',
  url: 'https://e-katanalotis.gov.gr/', license: 'e-katanalotis public-sector data (Law 4727/2020), Ministry of Development',
});
/** merchant name in the file -> FoodScan chain id. efresh is an online-only shop outside FoodScan's chain list: ignored. */
export const MERCHANTS = Object.freeze({ ab: ['ab', 'AB Βασιλόπουλος'], masoutis: ['masoutis', 'Μασούτης'], kritikos: ['kritikos', 'Κρητικός'], marketin: ['marketin', 'Market In'], mymarket: ['mymarket', 'My market'], bazaar: ['bazaar', 'Bazaar'] });

export function validEAN(code) {
  const c = String(code || ''); if (!/^(\d{8}|\d{12,14})$/.test(c)) return false;
  const d = c.padStart(14, '0').split('').map(Number); let s = 0;
  for (let i = 0; i < 13; i++) s += d[i] * (i % 2 === 0 ? 3 : 1);
  return (10 - (s % 10)) % 10 === d[13];
}
/** "16-06-2026" -> "2026-06-16" */
export function feedDate(extra) {
  let x = extra; if (typeof x === 'string') { try { x = JSON.parse(x); } catch { return null; } }
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(x?.date || '')); if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`; return Number.isNaN(Date.parse(iso + 'T00:00:00Z')) ? null : iso;
}

/** Whole feed -> { date, products: { ean14: { n, p:[[chain, price, date, monimi]] } }, stats }. Only valid EANs. */
export function parseFeed(doc) {
  const r = doc?.context?.MAPP_PRODUCTS?.result; if (!r || !Array.isArray(r.products) || !Array.isArray(r.merchants)) throw new Error('feed_invalid');
  const byUuid = new Map(r.merchants.map(m => [Number(m.merchant_uuid), MERCHANTS[m.name]]));
  const products = {}, stats = { products: r.products.length, validEAN: 0, prices: 0, skipped: {} , dates: {} };
  for (const p of r.products) {
    if (!validEAN(p.barcode)) { stats.skipped.invalid_ean = (stats.skipped.invalid_ean || 0) + 1; continue; }
    const date = feedDate(p.extra_fields); if (!date) { stats.skipped.no_date = (stats.skipped.no_date || 0) + 1; continue; }
    const prices = [];
    for (const x of Array.isArray(p.prices) ? p.prices : []) {
      const chain = byUuid.get(Number(x.merchant_uuid)); if (!chain) continue;
      const price = typeof x.price === 'number' && Number.isFinite(x.price) ? Math.round(x.price * 100) / 100 : null;
      if (!(price >= 0.01 && price <= 10000)) continue;
      prices.push([chain[0], price, date, p.monimi_meiosi === true ? 1 : 0]);
    }
    if (!prices.length) continue;
    const k = String(p.barcode).padStart(14, '0');
    if (products[k]) { stats.skipped.duplicate_ean = (stats.skipped.duplicate_ean || 0) + 1; continue; }
    products[k] = { n: String(p.name || '').slice(0, 140), p: prices };
    stats.validEAN++; stats.prices += prices.length; stats.dates[date] = (stats.dates[date] || 0) + 1;
  }
  const date = Object.entries(stats.dates).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  return { date, products, stats };
}
