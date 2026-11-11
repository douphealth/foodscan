#!/usr/bin/env node
/** One-off, read-only probe (FoodScan 90): do the big Greek chains' own PRODUCT PAGES show a barcode next to the price?
 * If they do, the observatory (posokanei.gov.gr, ~10k products, no barcodes) can be linked to barcodes the way Bazaar already is: the chain's page price
 * equals the observatory's same-chain price to the cent. Per site: robots.txt first, then its sitemap(s) to find product pages, then at most 3 product pages
 * that robots.txt allows. At most 12 requests per site, 1.5 s apart, one site at a time. Nothing is stored; it prints what it found.
 * Bazaar is the control (its listing pages are known to print barcodes). */
import zlib from 'node:zlib';

const UA = 'FoodScanProbe/90 (+https://food-scan.gearuptofit.com/how/; one-off read-only check, 1 request per 1.5 s)';
const SITES = [
  ['sklavenitis', 'https://www.sklavenitis.gr'], ['ab', 'https://www.ab.gr'], ['mymarket', 'https://www.mymarket.gr'],
  ['masoutis', 'https://www.masoutis.gr'], ['kritikos', 'https://kritikos-sm.gr'], ['galaxias', 'https://www.galaxias.shop'], ['bazaar (control)', 'https://www.bazaar-online.gr'],
];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const gtinOK = s => { if (!/^\d{8}$|^\d{12,14}$/.test(s)) return false; const d = [...s].map(Number), c = d.pop(); let sum = 0; d.reverse().forEach((x, i) => { sum += x * (i % 2 ? 1 : 3); }); return (10 - (sum % 10)) % 10 === c; };

function robotsRules(txt) {
  const rules = [], maps = []; let mine = false, inGroup = false;
  for (const raw of String(txt).split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim(); if (!line) continue;
    const [k, ...v] = line.split(':'), key = k.trim().toLowerCase(), val = v.join(':').trim();
    if (key === 'sitemap') { maps.push(val); continue; }
    if (key === 'user-agent') { if (!inGroup) mine = false; inGroup = true; if (val === '*') mine = true; continue; }
    inGroup = false;
    if (mine && (key === 'allow' || key === 'disallow')) rules.push({ allow: key === 'allow', path: val });
  }
  return { rules, maps };
}
function allowed(rules, path) {
  let best = null;
  for (const r of rules) { if (!r.path) continue; const re = new RegExp('^' + r.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$')); if (re.test(path) && (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow))) best = r; }
  return !best || best.allow;
}
async function get(url, budget) {
  if (budget.n <= 0) return { status: 'budget' }; budget.n--;
  await sleep(1500);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xml,application/json;q=0.9,*/*;q=0.8', 'Accept-Language': 'el-GR,el;q=0.9,en;q=0.5' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
    let buf = Buffer.from(await res.arrayBuffer()); if (buf[0] === 0x1f && buf[1] === 0x8b) { try { buf = zlib.gunzipSync(buf); } catch {} }
    return { status: res.status, url: res.url, type: res.headers.get('content-type') || '', server: res.headers.get('server') || '', text: buf.toString('utf8') };
  } catch (e) { return { status: 'error', error: String(e.message || e).slice(0, 120) }; }
}
function inspect(html) {
  const challenge = /just a moment|cf-chl|challenge-platform|captcha|attention required|access denied|perimeterx|datadome|incapsula/i.test(html);
  const ld = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map(m => { try { return JSON.parse(m[1].trim()); } catch { return null; } }).filter(Boolean);
  const flat = JSON.stringify(ld), ldTypes = [...new Set([...flat.matchAll(/"@type"\s*:\s*"([^"]+)"/g)].map(m => m[1]))].slice(0, 8);
  const ldGtin = [...flat.matchAll(/"gtin(?:8|12|13|14)?"\s*:\s*"?(\d{8,14})/g)].map(m => m[1]).filter(gtinOK);
  const ldPrice = [...flat.matchAll(/"price"\s*:\s*"?([\d.,]+)/g)].map(m => m[1]).slice(0, 3);
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const labelled = [...text.matchAll(/(barcode|ean|gtin|κωδικ[όο]ς\s*(?:προϊόντος|barcode|ean)?)[\s:#.]{0,12}(\d{8,14})/gi)].map(m => m[2]).filter(gtinOK);
  const anyGreekEan = [...new Set([...html.matchAll(/(?<!\d)(520\d{10})(?!\d)/g)].map(m => m[1]).filter(gtinOK))].slice(0, 3);
  const euros = [...text.matchAll(/(\d{1,3}[.,]\d{2})\s*€|€\s*(\d{1,3}[.,]\d{2})/g)].length;
  return { bytes: html.length, challenge, ldTypes, ldGtin: [...new Set(ldGtin)].slice(0, 3), ldPrice, labelledBarcode: [...new Set(labelled)].slice(0, 3), greekEanInHtml: anyGreekEan, euroAmountsInText: euros, title: (html.match(/<title[^>]*>([^<]{0,90})/i) || [])[1] || '' };
}
const productish = u => /\/p\/|\/product|\/proion|\/προϊόν|-\d{5,}|\/\d{5,}|\.html$/i.test(u) && !/category|kathgoria|katigoria|brand|tag|blog|recipe|syntag/i.test(u);

for (const [name, base] of SITES) {
  const budget = { n: 12 }, out = { site: name, base };
  const robots = await get(base + '/robots.txt', budget);
  out.robots = robots.status;
  const { rules, maps } = robotsRules(robots.status === 200 ? robots.text : '');
  out.sitemapsListed = maps.slice(0, 5);
  const queue = maps.length ? [...maps] : [base + '/sitemap.xml'], urls = [];
  for (let i = 0; i < 4 && queue.length && urls.length < 60; i++) {
    const sm = queue.shift(); const r = await get(sm, budget); if (r.status !== 200) { (out.sitemapErrors ||= []).push(`${sm} ${r.status}`); continue; }
    const locs = [...r.text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => m[1].replace(/&amp;/g, '&'));
    const childMaps = locs.filter(l => /\.xml(\.gz)?(\?|$)/i.test(l));
    if (childMaps.length) queue.unshift(...childMaps.filter(l => /product|proion|item|catalog/i.test(l)).concat(childMaps).slice(0, 3));
    urls.push(...locs.filter(l => !/\.xml(\.gz)?(\?|$)/i.test(l)));
  }
  const products = urls.filter(productish);
  out.urlsInSitemaps = urls.length; out.productLikeUrls = products.length;
  const picks = [products[0], products[Math.floor(products.length / 2)], products[products.length - 1]].filter(Boolean).filter((u, i, a) => a.indexOf(u) === i);
  out.pages = [];
  for (const u of picks) {
    let path = '/'; try { path = new URL(u).pathname; } catch {}
    if (!allowed(rules, path)) { out.pages.push({ url: u, skipped: 'robots.txt disallows' }); continue; }
    const r = await get(u, budget);
    out.pages.push({ url: u.slice(0, 140), status: r.status, server: r.server, ...(r.text ? inspect(r.text) : { error: r.error }) });
  }
  const seen = out.pages.filter(p => p.status === 200);
  out.verdict = !seen.length ? 'no product page read (see robots/sitemaps/status)' : seen.some(p => p.challenge) ? 'bot protection on product pages' :
    seen.some(p => p.ldGtin.length || p.labelledBarcode.length) ? 'BARCODE ON THE PRODUCT PAGE (server-rendered)' : seen.some(p => p.greekEanInHtml.length) ? 'a valid 520… barcode appears in the HTML (unlabelled: check)' : 'no barcode in the served HTML';
  console.log(JSON.stringify(out, null, 1));
  console.log(`VERDICT ${name}: ${out.verdict}`);
}
