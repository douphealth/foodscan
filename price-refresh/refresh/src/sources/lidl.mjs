/* FoodScan 74 · Lidl Hellas (lidl.gr). Product list: the product sitemap that robots.txt advertises. Only /p/ product pages
 * (allowed by robots.txt) are read, one at a time. Each page carries schema.org Product JSON-LD with gtin13 and the offer price
 * set by Lidl itself, so the price is tied to the barcode by the retailer (no name matching). A page with no barcode or with
 * more than one distinct EUR price is skipped (never guessed).
 * Price scope: the in-store price lidl.gr shows for its default region; Lidl prices can differ by region and offers are
 * time-limited (valid_until is stored when the page states it). */
import { gtinOK, restricted, key14, unescapeHTML } from './common.mjs';

export const SOURCE = Object.freeze({
  id: 'lidl', label: 'lidl.gr · τιμή καταστήματος (προεπιλεγμένη περιοχή)', home: 'https://www.lidl.gr/', robots: 'https://www.lidl.gr/robots.txt',
  license: 'Public product pages read politely (robots.txt allowed, 1 request at a time); facts only (price + barcode), linked to the product page.',
  retailer_id: 'lidl', retailer: 'Lidl', store_scope: 'national', store_id: 'lidl-gr-web', store_name: 'Lidl (τιμή lidl.gr)',
});

/** Sitemap XML (plain text) -> {products: [url], sitemaps: [url]} */
export function sitemapLinks(xml) {
  const locs = [...String(xml).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => unescapeHTML(m[1]));
  return { products: locs.filter(u => /^https:\/\/www\.lidl\.gr\/p\/[^?#]+\/p\d+$/.test(u)), sitemaps: locs.filter(u => /\.xml(\.gz)?$/.test(u)) };
}

export function parseProduct(html, url, fetchedISO) {
  for (const m of String(html).matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let d; try { d = JSON.parse(m[1]); } catch { continue; }
    if (!d || typeof d !== 'object' || d['@type'] !== 'Product') continue;
    const g = [].concat(d.gtin13 || []).map(String).filter(x => /^\d{8,14}$/.test(x) && gtinOK(x) && !restricted(x));
    const offers = [].concat(d.offers || []).filter(o => o && typeof o === 'object');
    const prices = [...new Set(offers.filter(o => o.priceCurrency === 'EUR').map(o => Number(o.price)).filter(p => p >= 0.01 && p <= 10000))];
    if (!g.length) return { skip: 'no_barcode' };
    if (prices.length !== 1) return { skip: prices.length ? 'ambiguous_price' : 'no_price' };
    const valid = offers.map(o => o.priceValidUntil).find(v => /^\d{4}-\d{2}-\d{2}/.test(String(v || '')));
    return { items: [...new Set(g)].map(e => ({ ean: key14(e), name: unescapeHTML(d.name || '').slice(0, 160), brand: d.brand?.name || null,
      url: /^https:\/\/www\.lidl\.gr\/p\//.test(d.url || '') ? d.url : url, price: Math.round(prices[0] * 100) / 100, regular: null,
      availability: String(offers[0]?.availability || '').replace(/^https?:\/\/schema\.org\//, '') || null, valid_until: valid ? String(valid).slice(0, 10) : null, fetched_at: fetchedISO })) };
  }
  return { skip: 'no_product_jsonld' };
}

async function gunzipText(res) {
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf[0] === 0x1f && buf[1] === 0x8b) return await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  return new TextDecoder().decode(buf);
}

export const adapter = {
  source: SOURCE,
  /** robots.txt Sitemap lines -> sitemap index -> product sitemaps -> product URLs (at most 3 levels, 10 files). */
  async targets(_fetchText, robots, fetchRes) {
    const queue = [...new Set([...robots.sitemaps, 'https://www.lidl-hellas.gr/static/sitemap.xml'])], seen = new Set(), products = new Set();
    while (queue.length && seen.size < 10) {
      const u = queue.shift(); if (seen.has(u)) continue; seen.add(u);
      const res = await fetchRes(u); if (!res.ok) { await res.body?.cancel(); continue; }
      const l = sitemapLinks(await gunzipText(res));
      l.products.forEach(p => products.add(p));
      for (const s of l.sitemaps) if (/product/i.test(s)) queue.push(s);   // the store-finder and page sitemaps hold no prices
    }
    return [...products].sort();
  },
  parse(url, html, fetchedISO) {
    const r = parseProduct(html, url, fetchedISO);
    return { items: r.items || [], skipped: r.skip ? { [r.skip]: 1 } : {}, more: [] };
  },
};
