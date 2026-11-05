#!/usr/bin/env node
/** One-off compatibility check (read-only, polite): which Greek supermarket web shops answer a search by barcode in a way FoodScan could read per scan?
 *  For each shop: robots.txt (the paths this check requests must be allowed), the home page, its search form or OpenSearch description, then ONE search for each of
 *  a few barcodes. It prints facts only (status, whether the barcode or a schema.org Product with a price is in the answer); it stores nothing and sends nothing else.
 *  At most ~12 requests per shop, 1.5 s apart, identified in the User-Agent. Run by .github/workflows/probe-shops.yml on push to this folder. */
const UA = 'FoodScanProbe/1.0 (+https://food-scan.gearuptofit.com/how/; one-off compatibility check, read-only)';
const EANS = [['5449000000996', 'Coca-Cola 330 ml'], ['3017620422003', 'Nutella 400 g'], ['5201010011986', 'Misko spaghettini']];
const SHOPS = ['www.ab.gr', 'www.sklavenitis.gr', 'www.mymarket.gr', 'www.masoutis.gr', 'www.kritikos-sm.gr', 'www.marketin.gr', 'www.galaxias.shop', 'www.thanopoulos.gr', 'www.bazaar-online.gr'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url, { timeout = 15000 } = {}) {
  await sleep(1500);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,application/json;q=0.9,*/*;q=0.5', 'Accept-Language': 'el,en;q=0.8' }, redirect: 'follow', signal: AbortSignal.timeout(timeout) });
    const text = (await res.text()).slice(0, 600000);
    return { ok: res.ok, status: res.status, url: res.url, type: res.headers.get('content-type') || '', text };
  } catch (e) { return { ok: false, status: 0, url, type: '', text: '', error: String(e.cause?.code || e.message).slice(0, 80) }; }
}
function robots(text) {
  const rules = []; let applies = false;
  for (const raw of text.split(/\r?\n/)) { const line = raw.replace(/#.*/, '').trim(); const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i); if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === 'user-agent') applies = v === '*'; else if (applies && (k === 'disallow' || k === 'allow')) rules.push([k, v]); }
  return rules;
}
const allowed = (rules, p) => { let best = null; for (const [k, v] of rules) if (v && p.startsWith(v.replace(/\*$/, '')) && (!best || v.length >= best[1].length)) best = [k, v]; return !best || best[0] === 'allow'; };
const jsonLd = html => { const out = []; for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) { try { out.push(JSON.parse(m[1])); } catch {} } return out; };
const flat = o => (Array.isArray(o) ? o.flatMap(flat) : o && typeof o === 'object' ? [o, ...(o['@graph'] ? flat(o['@graph']) : []), ...(o.itemListElement ? flat(o.itemListElement) : []), ...(o.item ? flat(o.item) : [])] : []);
const products = html => flat(jsonLd(html)).filter(o => /Product/.test(String(o['@type'] || '')));

for (const host of SHOPS) {
  const base = 'https://' + host, line = [];
  const rb = await get(base + '/robots.txt'); const rules = rb.ok ? robots(rb.text) : [];
  const home = await get(base + '/');
  console.log(`\n=== ${host}: robots ${rb.status}${rb.error ? ' ' + rb.error : ''} (${rules.length} rules for *), home ${home.status}${home.error ? ' ' + home.error : ''}, ${home.text.length} bytes, ${/<script[^>]+src=[^>]*(?:next|nuxt|react|vue|angular)/i.test(home.text) ? 'JS framework' : 'server-rendered?'}`);
  if (!home.ok) continue;
  const sm = (rb.text.match(/^sitemap:\s*(\S+)/gim) || []).slice(0, 3).map(s => s.replace(/^sitemap:\s*/i, '')); if (sm.length) console.log('  sitemaps:', sm.join(' '));
  // search endpoints: OpenSearch link, or a form with a search-like input
  const endpoints = [];
  const os = home.text.match(/<link[^>]+type=["']application\/opensearchdescription\+xml["'][^>]*href=["']([^"']+)["']/i)?.[1] || home.text.match(/<link[^>]+href=["']([^"']+)["'][^>]+opensearch/i)?.[1];
  if (os) { const d = await get(new URL(os, base).href); const t = d.text.match(/<Url[^>]+template=["']([^"']+)["']/i)?.[1]; if (t) endpoints.push({ how: 'opensearch', tpl: t.replace('{searchTerms}', '{q}').replace(/&amp;/g, '&') }); }
  for (const f of home.text.matchAll(/<form[^>]*action=["']([^"']*)["'][^>]*>([\s\S]*?)<\/form>/gi)) {
    const inp = f[2].match(/<input[^>]+name=["']([^"']+)["'][^>]*>/gi) || [], s = inp.map(i => i.match(/name=["']([^"']+)["']/i)[1]).find(n => /^(q|query|search|s|searchquery|text|keyword|term|searchterm|key)$/i.test(n)) || null;
    const typeSearch = /type=["']search["']/i.test(f[2]); if (!s && !typeSearch) continue;
    const name = s || inp.map(i => i.match(/name=["']([^"']+)["']/i)[1])[0]; if (!name) continue;
    try { endpoints.push({ how: 'form', tpl: new URL(f[1] || '/', home.url).href.split('#')[0] + (f[1].includes('?') ? '&' : '?') + encodeURIComponent(name) + '={q}' }); } catch {}
    if (endpoints.length >= 2) break;
  }
  if (!endpoints.length) { console.log('  no search form or OpenSearch description found in the home page (likely rendered by JavaScript)'); continue; }
  for (const ep of endpoints.slice(0, 2)) for (const [ean, label] of EANS) {
    const url = ep.tpl.replace('{q}', ean), path = new URL(url, base).pathname + new URL(url, base).search;
    if (!allowed(rules, path)) { console.log(`  ${ep.how} ${label}: SKIPPED, robots.txt disallows ${path.slice(0, 60)}`); continue; }
    const r = await get(url), pr = products(r.text), withPrice = pr.filter(p => p.offers).length;
    const hasEan = r.text.includes(ean), hasGtin = /gtin\d*["']?\s*[:=]/i.test(r.text);
    console.log(`  ${ep.how} ${label}: HTTP ${r.status}${r.error ? ' ' + r.error : ''}, ${r.type.split(';')[0]}, ${r.text.length} bytes, barcode in answer: ${hasEan}, gtin field: ${hasGtin}, schema.org Products: ${pr.length} (with price ${withPrice}), url ${r.url.slice(0, 110)}`);
    if (pr[0]) { const p = pr[0], o = [].concat(p.offers || [])[0] || {}; console.log(`    first: ${String(p.name).slice(0, 60)} | gtin ${p.gtin13 || p.gtin || p.gtin14 || p.gtin8 || '-'} | sku ${p.sku || '-'} | price ${o.price ?? o.lowPrice ?? '-'} ${o.priceCurrency || ''}`); }
  }
}
console.log('\nDone.');
