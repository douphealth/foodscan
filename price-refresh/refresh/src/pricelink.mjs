/* FoodScan 81 · price-anchored barcode -> observatory links (pure, no I/O).
 *
 * Why: the observatory (posokanei.gov.gr) publishes daily chain prices for ~10k products but no barcodes. The word-for-word
 * matcher (matcher.mjs / automatch.mjs) links only when the shop's name contains every word of the observatory name, and shops
 * word things differently ("Amstel Μπύρα 500ml" vs "ΑΜΣΤΕΛ Μπύρα Lager 500ml"), so ~2,000 observatory products that Bazaar sells
 * stayed unlinked and their barcodes showed one shop's price instead of eight chains'.
 *
 * Rule: a barcode is linked to an observatory product only if ALL of these hold.
 *  1. ANCHOR: the shop (Bazaar or Lidl web shop) prints the barcode next to a regular (not sale) price, and the observatory reports
 *     the SAME chain's regular price for the product, equal TO THE CENT, both observed within `maxDays` days.
 *  2. same brand (Greek/Latin skeleton), same pack size (0.5 %), same number of units in the pack, no promo/bundle pack;
 *  3. every number (fat %, No 2, 0 %) agrees both ways, and every variant word (light, zero, a flavour, bio, ...) on either side is
 *     on the other side too;
 *  4. at least half of the shop name's descriptive words are in the observatory name, and a word only one side has is generic
 *     (common in the catalogue or part of the category), except at most one rare word on ONE side;
 *  5. UNIQUE BOTH WAYS: exactly one observatory product passes 1-4 for the barcode, and exactly one barcode passes 1-4 for the product
 *     (a sibling at the same price, e.g. two flavours at 1,53 EUR, makes both unlinkable);
 *  6. neither side is linked already, and the barcode was not rejected in a human review.
 * Precision is measured on the hand-reviewed and exact links (see evalAgainstGold): the rule must reproduce them, never contradict them. */
import { canon, skel, tokens, brandSk, findBrand, packSize, packCount, sameSize, isVariant, isPromoPack } from './matcher.mjs';
import { gtinOK, restricted } from './sources/common.mjs';

const DAY = 86400000;
export const strip = e => String(e).replace(/^0+(?=\d{8,})/, '');
const dayMs = s => Date.parse(String(s || '').slice(0, 10) + 'T00:00:00Z');
const PK_CHAIN = { bazaar: 'bazaar', lidl: 'lidl' };

const tokEq = (a, b) => {
  if (a.num || b.num) return a.num && b.num && a.sk === b.sk;
  if (a.sk === b.sk) return true;
  const [s, l] = a.sk.length <= b.sk.length ? [a.sk, b.sk] : [b.sk, a.sk];
  return s.length >= 3 && l.startsWith(s);
};
const descr = (toks, pos) => toks.filter((t, i) => !(pos && i >= pos[0] && i < pos[1]) && !t.init && !t.slash);

/** A word only one side has must be generic: common in the observatory catalogue (>= GENERIC_DF products) or part of the
 *  product's category. A rare word ("Hydrocare", "Protect", "Νάξου") names a product line; at most ONE such word is tolerated
 *  per side, and none when the two sides each have one (two different line names = two different products). */
export const GENERIC_DF = 40;
const generic = (t, obs, df) => !isVariant(t.sk) && ((df?.get(t.sk) || 0) >= GENERIC_DF || [...(obs.cat || [])].some(c => c === t.sk || (c.length >= 4 && t.sk.length >= 4 && (c.startsWith(t.sk) || t.sk.startsWith(c)))));

/** Compares a shop record with an observatory entry already known to share the price. Returns null or {score}. */
export function sameProduct(shop, obs, df = null) {
  if (!sameSize(shop.size, obs.size) || shop.count !== obs.count) return null;
  const bPos = findBrand(shop.toks, obs.bsk); if (!bPos) return null;
  const s = descr(shop.toks, bPos), o = descr(obs.toks, findBrand(obs.toks, obs.bsk));
  const sn = new Set(s.filter(t => t.num).map(t => t.sk)), on = new Set(o.filter(t => t.num).map(t => t.sk));
  if (sn.size !== on.size || [...sn].some(n => !on.has(n))) return null;
  const sw = s.filter(t => !t.num), ow = o.filter(t => !t.num);
  for (const t of sw) if (isVariant(t.sk) && !ow.some(x => tokEq(t, x))) return null;
  for (const t of ow) if (isVariant(t.sk) && !sw.some(x => tokEq(t, x))) return null;
  const hit = sw.filter(t => ow.some(x => tokEq(t, x))).length;
  if (sw.length && hit / sw.length < 0.5) return null;
  if (df) {
    const rareS = sw.filter(t => !ow.some(x => tokEq(t, x)) && !generic(t, obs, df)).length;
    const rareO = ow.filter(t => !sw.some(x => tokEq(t, x)) && !generic(t, obs, df)).length;
    if (rareS > 1 || rareO > 1 || (rareS && rareO)) return null;
  }
  if (!sw.length && ow.length > 2) return null;
  return { score: hit / Math.max(1, sw.length) };
}

/** Observatory products -> entries with a regular same-chain price. */
export function indexByChainPrice(products, chain, { snapshotDate, maxDays = 3 } = {}) {
  const snap = dayMs(snapshotDate), byCents = new Map();
  for (const p of products) {
    const r = (p.retailer_prices || []).find(x => x.retailer === chain && (x.country == null || x.country === 'GR'));
    if (!r || typeof r.price !== 'number' || r.is_discount === true) continue;
    const d = dayMs(r.last_updated); if (!(Math.abs(snap - d) <= maxDays * DAY)) continue;
    const u = String(p.unit || '').toLowerCase(), q = Number(p.unit_quantity);
    const fromField = q > 0 && ['kg', 'l', 'pcs'].includes(u) ? { unit: u, amount: q } : null, fromName = packSize(p.name);
    const size = fromField || fromName; if (!size) continue;
    if (fromField && fromName && fromField.unit === fromName.unit && !sameSize(fromField, fromName)) continue; // inconsistent observatory size
    const toks = tokens(p.name), bsk = brandSk(p.brand, p.name); if (!bsk.length) continue;
    const cat = new Set(tokens([p.category, p.subcategory].filter(Boolean).join(' ')).filter(t => !t.num).map(t => t.sk));
    const e = { id: p.id, name: p.name, size, count: packCount(p.name), toks, bsk, cat, cents: Math.round(r.price * 100), date: d };
    if (!byCents.has(e.cents)) byCents.set(e.cents, []); byCents.get(e.cents).push(e);
  }
  return byCents;
}

/** In how many Greek observatory products each word skeleton occurs. */
export function wordFrequency(products) {
  const df = new Map();
  for (const p of products) { if (!(p.available_countries || []).includes('GR') && !(p.retailer_prices || []).some(r => r.country === 'GR')) continue;
    for (const sk of new Set(tokens(p.name).filter(t => !t.num).map(t => t.sk))) df.set(sk, (df.get(sk) || 0) + 1); }
  return df;
}

/**
 * products: observatory products (raw or slimProduct). shops: {bazaar: seedDoc, lidl: seedDoc} (seed format: products{ean:{n,p,o,d}}).
 * linked: {eans:Set, ids:Set, rejected:Set}. Returns {links, refused, stats}.
 */
export function priceLinks({ products, snapshotDate, shops, linked = { eans: new Set(), ids: new Set(), rejected: new Set() }, maxDays = 3, nowISO = new Date().toISOString() }) {
  const pairs = [], refused = [], stats = {}; let df = null;
  for (const [src, doc] of Object.entries(shops)) {
    const chain = PK_CHAIN[src]; if (!chain || !doc?.products) continue;
    const byCents = indexByChainPrice(products, chain, { snapshotDate, maxDays });
    df ||= wordFrequency(products);
    const st = stats[src] = { shop: 0, considered: 0, candidates: 0 };
    for (const [k, v] of Object.entries(doc.products)) {
      st.shop++;
      const e = strip(k);
      if (!gtinOK(e) || restricted(e) || v.o || !(v.p > 0)) continue;              // sale prices are not used as proof
      if (linked.eans.has(e) || linked.rejected.has(e)) continue;
      if (isPromoPack(v.n)) continue;
      const size = packSize(v.n); if (!size) continue;
      const obsList = byCents.get(Math.round(v.p * 100)); if (!obsList) continue;
      if (!(Math.abs(dayMs(v.d) - dayMs(snapshotDate)) <= maxDays * DAY)) continue;
      st.considered++;
      const shop = { size, count: packCount(v.n), toks: tokens(v.n) };
      for (const o of obsList) { const m = sameProduct(shop, o, df); if (m) { pairs.push({ ean: e, src, name: v.n, cents: Math.round(v.p * 100), shopDate: v.d, o, score: m.score }); st.candidates++; } }
    }
  }
  // uniqueness both ways (across both shops: a barcode seen by Bazaar and Lidl must point at the same product)
  const byEan = new Map(), byId = new Map();
  for (const p of pairs) { (byEan.get(p.ean) || byEan.set(p.ean, []).get(p.ean)).push(p); (byId.get(p.o.id) || byId.set(p.o.id, []).get(p.o.id)).push(p); }
  const links = [];
  for (const [ean, list] of byEan) {
    const ids = new Set(list.map(p => p.o.id));
    if (ids.size !== 1) { refused.push({ ean, why: 'several_products_same_price', options: [...ids].length }); continue; }
    const id = [...ids][0];
    if (linked.ids.has(id)) { refused.push({ ean, why: 'product_already_linked' }); continue; }
    const eans = new Set(byId.get(id).map(p => p.ean));
    if (eans.size !== 1) { refused.push({ ean, why: 'several_barcodes_same_product' }); continue; }
    const p = list[0];
    links.push({ ean, pk_id: id, pk_name: p.o.name, method: 'auto-price', created_at: nowISO,
      evidence: { sources: [...new Set(list.map(x => x.src))], names: [...new Set(list.map(x => x.name))].slice(0, 3), word_overlap: Math.round(Math.min(...list.map(x => x.score)) * 100) / 100,
        price_proof: list.map(x => ({ chain: PK_CHAIN[x.src], cents: x.cents, shop_date: x.shopDate, observatory_date: new Date(x.o.date).toISOString().slice(0, 10) })), snapshot: snapshotDate } });
  }
  return { links, refused, stats };
}

/** Precision check: run the rule with NOTHING linked and compare with reviewed links. agree = same product, conflict = different product. */
export function evalAgainstGold({ products, snapshotDate, shops, gold, rejected = new Set() }) {
  const { links } = priceLinks({ products, snapshotDate, shops, linked: { eans: new Set(), ids: new Set(), rejected } });
  const gByEan = new Map(gold.map(g => [strip(g.ean), g.pk_id])), gById = new Map(gold.map(g => [g.pk_id, strip(g.ean)]));
  let agree = 0; const conflicts = [];
  for (const l of links) {
    const ge = gByEan.get(l.ean), gi = gById.get(l.pk_id);
    if (ge === undefined && gi === undefined) continue;
    if (ge === l.pk_id) agree++; else conflicts.push({ ean: l.ean, shop: l.evidence.names[0], linked_to: l.pk_name, gold_product: ge, gold_ean_for_product: gi });
  }
  return { agree, conflicts, total: links.length };
}
