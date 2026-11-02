/* FoodScan 74 · automatic barcode -> observatory links inside the ingest Worker (pure, no I/O).
 *
 * The retailer web shops (Bazaar, Lidl) print barcode + name + price. When a barcode is not linked yet, it is linked to an
 * observatory product only if ALL of these hold (stricter than the offline match.mjs, because nobody reviews these first):
 *  1. valid GTIN, not a GS1 restricted in-store code, not rejected or dropped in a human review;
 *  2. matchOne() finds exactly one observatory product of the same brand and pack size containing every descriptive word,
 *     with the same unit count and no extra specific/variant word (src/matcher.mjs, measured 0 wrong on the hand-checked gold);
 *  3. every source naming the barcode agrees on that product;
 *  4. PRICE PROOF: the shop's own regular (not sale) price equals, to the cent, the observatory price of the SAME chain for that
 *     product, both observed within 3 days; and no same-brand, same-size sibling also matches the price (else it is ambiguous);
 *  5. the product is not linked to another barcode already (bundled file or earlier Worker link), and no other new barcode claims it.
 * Anything else stays unlinked; the shop's own price for that barcode is still shown (it comes from the shop page itself).
 */
import { indexCatalogue, matchOne } from './matcher.mjs';
import { gtinOK, restricted } from './sources/common.mjs';

export const REVIEW_DROP = new Set(['5201261000036', '5201008424170']);   // same list as scripts/match.mjs
const PK_CHAIN = { bazaar: 'bazaar', lidl: 'lidl' };                      // shop source -> observatory retailer id
const DAY = 86400000;
const strip = e => String(e).replace(/^0+(?=\d{8,})/, '');

/**
 * products: slim observatory products (posokanei.readSnapshot). snapshotDate: YYYY-MM-DD.
 * candidates: [{barcode, source_id, name, brand, price_cents, regular_cents, updated_at}] (foodscan_barcode_names).
 * linked: {eans:Set, ids:Set, rejected:Set} = barcodes and observatory ids already linked, barcodes rejected in review.
 */
export function autoLinks({ products, snapshotDate, candidates, linked, nowISO = new Date().toISOString(), idx = null }) {
  idx ||= indexCatalogue(products);
  const byId = new Map(idx.list.map(e => [e.id, e]));
  const prices = new Map(products.map(p => [p.id, p.retailer_prices || []]));
  const snapMs = Date.parse(snapshotDate + 'T00:00:00Z');
  const priceAt = (id, chain) => { const r = (prices.get(id) || []).find(x => x.retailer === chain && typeof x.price === 'number'); if (!r) return null;
    const d = Date.parse(String(r.last_updated || '').slice(0, 10) + 'T00:00:00Z'); return { price: r.price, date: d, sale: r.is_discount === true }; };
  const refused = [], byEan = new Map();
  for (const c of candidates) {
    const e = strip(c.barcode);
    if (!gtinOK(e) || restricted(e)) { refused.push({ ean: e, why: 'invalid_or_restricted' }); continue; }
    if (linked.eans.has(e)) continue;
    if (linked.rejected.has(e) || REVIEW_DROP.has(e)) { refused.push({ ean: e, why: 'rejected_in_review' }); continue; }
    if (!byEan.has(e)) byEan.set(e, []); byEan.get(e).push(c);
  }
  const pick = new Map();
  for (const [e, recs] of byEan) {
    const hits = recs.map(r => ({ r, m: matchOne(idx, { name: r.name, brand: r.brand || null }) }));
    const ids = new Set(hits.filter(h => h.m.id).map(h => h.m.id));
    if (ids.size !== 1) { refused.push({ ean: e, why: ids.size ? 'sources_disagree' : (hits[0].m.reason || 'no_match') }); continue; }
    const id = [...ids][0];
    if (hits.some(h => !h.m.id)) { refused.push({ ean: e, why: 'not_every_source_matches' }); continue; }
    // price proof at the same chain, same few days
    let proof = null, bad = null;
    for (const { r } of hits) {
      const chain = PK_CHAIN[r.source_id]; if (!chain || r.regular_cents || !(r.price_cents > 0)) continue;   // sale prices are not used as proof
      const at = priceAt(id, chain); if (!at || at.sale) continue;
      if (Math.abs(Date.parse(String(r.updated_at).slice(0, 10) + 'T00:00:00Z') - at.date) > 3 * DAY || Math.abs(snapMs - at.date) > 3 * DAY) continue;
      if (Math.round(at.price * 100) !== r.price_cents) { bad = { chain, shop: r.price_cents, observatory: Math.round(at.price * 100) }; break; }
      proof = { chain, cents: r.price_cents, observatory_date: new Date(at.date).toISOString().slice(0, 10) };
    }
    if (bad) { refused.push({ ean: e, why: 'price_differs', ...bad }); continue; }
    if (!proof) { refused.push({ ean: e, why: 'no_same_chain_price_proof' }); continue; }
    const c = byId.get(id);
    const sibs = (idx.bySize.get(c.size.unit + ':' + Math.round(c.size.amount * 1000)) || []).filter(x => x.id !== id && String(x.bsk) === String(c.bsk));
    if (sibs.some(x => { const a = priceAt(x.id, proof.chain); return a && Math.round(a.price * 100) === proof.cents; })) { refused.push({ ean: e, why: 'sibling_same_price' }); continue; }
    if (linked.ids.has(id)) { refused.push({ ean: e, why: 'product_already_linked' }); continue; }
    if (!pick.has(id)) pick.set(id, []);
    pick.get(id).push({ e, hits, proof });
  }
  const links = [];
  for (const [id, list] of pick) {
    if (list.length > 1) { for (const x of list) refused.push({ ean: x.e, why: 'two_barcodes_one_product' }); continue; }
    const { e, hits, proof } = list[0];
    links.push({ ean: e, pk_id: id, pk_name: hits[0].m.name, method: 'auto-worker', created_at: nowISO,
      evidence: { sources: [...new Set(hits.map(h => h.r.source_id))], names: [...new Set(hits.map(h => h.r.name))].slice(0, 3), extra_words: hits[0].m.extras, price_proof: proof, snapshot: snapshotDate } });
  }
  return { links, refused };
}

/** Bundled link file + Worker links -> one schema-2 document, one-to-one (bundled links win). */
export function mergeLinks(doc, extra) {
  const eans = new Set(doc.links.map(l => l.ean)), ids = new Set(doc.links.map(l => l.pk_id));
  const add = extra.filter(l => !eans.has(l.ean) && !ids.has(l.pk_id) && (eans.add(l.ean), ids.add(l.pk_id), true));
  return { ...doc, schema: 2, links: [...doc.links.map(l => ({ ...l, method: l.method || 'hand' })), ...add] };
}
