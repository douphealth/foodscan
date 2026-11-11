#!/usr/bin/env node
/** Is the price system actually live? Read-only checks of a deployed site (no credentials, no writes).
 *    node tools/verify-deploy.mjs https://food-scan.gearuptofit.com [expectedVersion]
 *  Exit code 0 only when the site serves the expected release AND its price API answers with sources, dates and an estimate contract. */
const base = (process.argv[2] || 'https://food-scan.gearuptofit.com').replace(/\/+$/, '');
const want = process.argv[3] || '92.0.0';
const UA = { 'User-Agent': 'FoodScan-verify/80' };
let bad = 0; const ok = (c, msg) => { console.log((c ? '  ok   ' : '  FAIL ') + msg); if (!c) bad++; };
const get = async (p, init) => { try { const r = await fetch(base + p + (p.includes('?') ? '&' : '?') + 'r=' + Math.random(), { headers: UA, ...init, signal: AbortSignal.timeout(30000) }); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {} return { status: r.status, text: t, json: j }; } catch (e) { return { status: 0, text: String(e), json: null }; } };
console.log('Checking', base, 'for release', want);
const h = await get('/api/health'); ok(h.json?.version === want, `/api/health reports ${h.json?.version ?? 'nothing'} (need ${want})`);
const home = await get('/'); ok(new RegExp('data-foodscan-version="' + want.replace(/\./g, '\.') + '"').test(home.text), 'the home page carries release ' + want);
const ph = await get('/api/prices/health'); ok(ph.status === 200 && ph.json?.version === want, `/api/prices/health ${ph.status === 200 ? 'answers' : 'is missing (HTTP ' + ph.status + '): the deployed release has no price service'}`);
if (ph.json) { ok(ph.json.sources && Object.keys(ph.json.sources).length >= 3, 'health lists the price sources'); ok(ph.json.estimator?.estimates > 5000, `estimator available (${ph.json.estimator?.estimates ?? 0} estimates)`); console.log('  info  remote data:', ph.json.remote?.url, '| estimator origin:', ph.json.estimator?.origin); for (const [id, s] of Object.entries(ph.json.sources || {})) console.log('  info ', id.padEnd(13), s.state, s.seed?.snapshot || '', 'age', s.seed?.ageDays + ' d'); }
for (const [code, label] of [['5201004023360', 'recorded prices'], ['5203735000320', 'no recorded price (no estimate since 81)'], ['5449000214911', 'recorded prices (Coca-Cola)']]) {
  const r = await get(`/api/prices/compare?barcode=${code}`, { method: 'POST' });
  const j = r.json; ok(r.status === 200 && j?.version === want, `price lookup ${code} (${label}): HTTP ${r.status}, release ${j?.version ?? '?'}`);
  if (j && Array.isArray(j.offers)) { const sourced = j.offers.every(o => o.source && o.date && o.price > 0); ok(sourced, `${code}: ${j.offers.length} offers, each with source, date and price`); console.log(`  info  ${code} status=${j.status} lowestCurrent=${j.summary?.lowestCurrentPrice} estimate=${j.estimate ? j.estimate.cls + ' ' + j.estimate.unitLow + '-' + j.estimate.unitHigh : 'none'}`); }
}
// 83: worldwide. The same barcode asked for other markets must answer for THAT market and currency (no Greek assumptions leaking through).
for (const [market, currency] of [['FR', 'EUR'], ['US', 'USD'], ['GB', 'GBP'], ['JP', 'JPY']]) {
  const r = await get(`/api/prices/compare?barcode=5449000214911&market=${market}`, { method: 'POST' }); const j = r.json;
  ok(r.status === 200 && j?.country === market && j?.currency === currency, `market ${market}: answers for ${j?.country ?? '?'} in ${j?.currency ?? '?'} (need ${market} in ${currency})`);
  if (j && Array.isArray(j.offers)) ok(j.offers.every(o => o.countryCode === market && o.currency && o.source && o.date && o.price > 0 && (!o.rankingEligible || o.currency === currency)), `market ${market}: ${j.offers.length} offers, each in its own country and currency, ranked only in ${currency}`);
  if (j) ok(!Object.keys(j.providers || {}).some(k => ['observatory', 'ekatanalotis', 'bazaar', 'lidl'].includes(k)), `market ${market}: no Greek source is consulted`);
}
// 84: the web price search reports whether it is switched on; when it is, no web price may rank without a link, a date and a shop of the shopper's country.
{ const r = await get('/api/prices/compare?barcode=5449000214911&market=FR', { method: 'POST' }); const w = r.json?.providers?.webSearch;
  ok(Boolean(w) && ['disabled', 'ok_with_data', 'ok_empty', 'unavailable'].includes(w.status), `web price search: ${w ? w.status + (w.reason ? ' (' + w.reason + ')' : '') : 'missing from the answer'}`);
  const web = (r.json?.offers || []).filter(o => String(o.id).startsWith('ws:'));
  ok(web.every(o => o.sourceURL?.startsWith('https://') && o.date && o.countryCode === 'FR' && o.currency === 'EUR'), `web price search: ${web.length} web offers, each with link, date, country and currency`); }
console.log(bad ? `\n${bad} check(s) failed: this deployment does NOT serve the price system.` : '\nAll checks passed.'); process.exit(bad ? 1 : 0);
