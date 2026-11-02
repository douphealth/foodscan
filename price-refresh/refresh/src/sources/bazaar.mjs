/* FoodScan 74 · Bazaar web shop (bazaar-online.gr). Same method as ingest/scripts/bazaar_crawl.py + bazaar.py:
 * only public category listing pages that robots.txt allows; each product card prints the shop's own barcode
 * ("knns-model-value") next to the price, so the price is tied to the barcode by the shop itself (no name matching).
 * Price scope: online price of the web shop (Attica delivery); shelf prices in stores may differ. */
import { gtinOK, restricted, money, key14, unescapeHTML } from './common.mjs';

export const SOURCE = Object.freeze({
  id: 'bazaar', label: 'bazaar-online.gr · online τιμή e-shop', home: 'https://www.bazaar-online.gr/', robots: 'https://www.bazaar-online.gr/robots.txt',
  license: 'Public web-shop listing pages read politely (robots.txt allowed, 1 request at a time); facts only (price + barcode), linked to the product page.',
  retailer_id: 'bazaar', retailer: 'Bazaar', store_scope: 'online', store_id: 'eshop', store_name: 'Bazaar e-shop (Αττική)',
});
const BAD = ['account', 'checkout', 'cart', 'wishlist', 'login', 'search', 'compare', 'index.php', 'information', 'blog', 'image', 'catalog'];

/** Home page -> leaf category URLs (a category that has sub-categories is skipped: its products are on the leaves). */
export function categoriesFrom(html) {
  const links = [...new Set([...String(html).matchAll(/href="(https:\/\/www\.bazaar-online\.gr\/[a-z0-9-]+(?:\/[a-z0-9-]+)+)"/g)].map(m => m[1]).filter(l => !BAD.some(b => l.includes(b))))].sort();
  return links.filter(l => !links.some(o => o !== l && o.startsWith(l + '/')));
}

/** One listing page -> {items, lastPage}. A sale card shows price-new and price-old. Cards without a valid barcode or price are skipped. */
export function parseListing(html, fetchedISO) {
  const items = [], skipped = { bad_barcode: 0, restricted_code: 0, no_price: 0, bad_url: 0 };
  for (const blk of String(html).split('<div class="image">').slice(1)) {
    const m = blk.match(/knns-model-value">\s*(\d{8,14})\s*</); if (!m) continue;
    const ean = m[1];
    if (!gtinOK(ean)) { skipped.bad_barcode++; continue; }
    if (restricted(ean)) { skipped.restricted_code++; continue; }
    const n = blk.match(/<h4><a href="([^"]+)">([^<]+)<\/a>/);
    const w = (blk.match(/price_wrapper">([\s\S]*?)<\/div>/) || [])[1] || '';
    const pNew = w.match(/price-new">\s*([\d.,]+)\s*€/), pOld = w.match(/price-old">\s*([\d.,]+)\s*€/);
    const plain = w.replace(/<[^>]+>/g, ' ').match(/^\s*([\d.,]+)\s*€/);
    const price = money((pNew || plain || [])[1]);
    if (!(price >= 0.01 && price <= 10000)) { skipped.no_price++; continue; }
    const u = n && n[1].match(/^https:\/\/www\.bazaar-online\.gr(\/[a-z0-9\-/,.]+)$/);
    if (!u) { skipped.bad_url++; continue; }
    const old = money(pOld?.[1]);
    const br = blk.match(/manufacturer_link">\s*<a [^>]*>([^<]*)</);
    items.push({ ean: key14(ean), name: unescapeHTML(n[2]).slice(0, 160), brand: br ? unescapeHTML(br[1]) : null, url: 'https://www.bazaar-online.gr' + u[1],
      price: Math.round(price * 100) / 100, regular: old && old > price ? Math.round(old * 100) / 100 : null, fetched_at: fetchedISO });
  }
  const mp = String(html).match(/\((\d+) Σελ\.\)/);
  return { items, skipped, lastPage: mp ? Math.min(+mp[1], 60) : 1 };
}

/** Crawl adapter used by crawl.mjs. */
export const adapter = {
  source: SOURCE,
  async targets(fetchText) { return categoriesFrom(await fetchText(SOURCE.home)); },
  parse(url, html, fetchedISO) {
    const r = parseListing(html, fetchedISO);
    const more = !/[?&]page=/.test(url) && r.lastPage > 1 ? Array.from({ length: r.lastPage - 1 }, (_, i) => `${url}?page=${i + 2}`) : [];
    return { items: r.items, skipped: r.skipped, more };
  },
};
