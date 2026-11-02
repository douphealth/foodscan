/* Browser checks (real Chrome via playwright-core): every price state, in Greek and English, at phone / tablet / desktop widths.
 * Starts its own Pages emulator (hermetic: Open Prices stubbed, Open Food Facts product reads answer "not found").
 * Run: node --test tests/ui.spec.mjs   (FS_APP=<dir> tests an extracted zip) */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { ROOT, allEstimates, seed, gtinOK, key14 } from './helpers.mjs';

const require = createRequire(path.join(ROOT, '..', 'v62-src', 'package.json'));
const { chromium } = require('playwright-core');
const PORT = 8836, BASE = `http://localhost:${PORT}`;
const est = allEstimates(), ek = seed('ekatanalotis-latest.json'), bz = seed('bazaar-eshop-latest.json'), pk = seed('posokanei-latest.json');
const CUR = '5201004023360';                               // observatory + Bazaar prices, in the bundled catalogue
const EST = '7613033511424';                               // estimate only, in the bundled catalogue
const OLD = Object.keys(ek.products).find(k => !bz.products[k] && !pk.products[k] && !est[k] && gtinOK(k) && k.startsWith('052')).replace(/^0+/, ''); // old basket price only, unknown to Open Food Facts
const NONE = (() => { for (let n = 4001234560000; ; n++) { const s = String(n).slice(0, 12); let t = 0; for (let i = 0; i < 12; i++) t += Number(s[i]) * (i % 2 === 0 ? 1 : 3); const c = s + String((10 - t % 10) % 10); if (!est[key14(c)] && !pk.products[key14(c)] && !bz.products[key14(c)] && !ek.products[key14(c)]) return c; } })();
let server, browser, ipSeq = 0;

before(async () => {
  server = spawn(process.execPath, [path.join(ROOT, 'tools/serve.mjs'), '--dir', process.env.FS_APP || 'app', '--port', String(PORT), '--replay', path.join(ROOT, 'scratch', 'no-off-fixtures'), '--stub-prices'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 40; i++) { try { if ((await fetch(BASE + '/version.json')).ok) break; } catch {} await new Promise(r => setTimeout(r, 250)); }
  browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
});
after(async () => { await browser?.close(); server?.kill(); });

async function open(url, { locale = 'el-GR', width = 390, height = 844 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, locale, timezoneId: 'Europe/Athens', serviceWorkers: 'block', extraHTTPHeaders: { 'Accept-Language': locale, 'CF-Connecting-IP': '198.51.100.' + (++ipSeq % 250 + 1) } });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.route(/prices\.openfoodfacts\.org/, route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"items":[],"total":0}' }));
  await page.route(/openfoodfacts\.org\/(api|cgi)\//, route => /prices\.openfoodfacts/.test(route.request().url()) ? route.fallback()
    : route.request().url().includes(NONE) || route.request().url().includes(OLD) ? route.fulfill({ status: 404, contentType: 'application/json', body: '{"status":0,"status_verbose":"product not found"}' }) : route.abort());
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  return { page, ctx, errors };
}
const STRIP = '.fp75:not(.fp75--wait)';
const settle = async page => { const w = () => page.waitForSelector(`${STRIP}`, { timeout: 20000 }); try { await w(); } catch { await page.reload({ waitUntil: 'domcontentloaded' }); await w(); } await page.waitForTimeout(500); };
const noOverflow = async page => { const o = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, v: innerWidth })); assert.ok(o.w <= o.v + 1, `page overflows horizontally: ${JSON.stringify(o)}`); };
const cardText = page => page.locator('.fp75').first().innerText();

for (const [locale, lang] of [['el-GR', 'el'], ['en-GB', 'en']]) for (const width of [320, 390, 1280]) {
  const tag = `${lang} ${width}px`;
  test(`current price strip: ${tag}`, async () => {
    const { page, ctx, errors } = await open(`${BASE}/?lang=${lang}#/p/${CUR}`, { locale, width }); await settle(page);
    const t = await cardText(page); assert.match(t, /\d+,\d\d\s?€|€\d+\.\d\d/); assert.match(t, lang === 'el' ? /Τρέχουσα/ : /Current/); assert.doesNotMatch(t, /Not available|Μη διαθέσιμη/);
    await noOverflow(page); assert.deepEqual(errors, []); await ctx.close();
  });
  test(`estimate strip is labelled and never looks like a recorded price: ${tag}`, async () => {
    const { page, ctx, errors } = await open(`${BASE}/?lang=${lang}#/p/${EST}`, { locale, width }); await settle(page);
    const card = page.locator('.fp75').first(), t = await card.innerText();
    assert.match(t, lang === 'el' ? /Εκτίμηση|Πρόχειρη/ : /Estimate|Rough/); assert.match(t, lang === 'el' ? /Όχι καταγεγραμμένη τιμή/ : /Not a recorded price/); assert.equal((t.match(/€/g) || []).length >= 2, true, 'a range shows two amounts');
    assert.doesNotMatch(t, lang === 'el' ? /Τρέχουσα|Φθηνότερη/ : /Current|Cheapest/); assert.ok(await card.evaluate(el => el.classList.contains('fp80-is-est'))); assert.ok(await card.locator('details.fp80-why').count());
    await noOverflow(page); assert.deepEqual(errors, []); await ctx.close();
  });
  test(`a barcode with no price information says so plainly and invents no amount: ${tag}`, async () => {
    const { page, ctx } = await open(`${BASE}/?lang=${lang}#/p/${NONE}`, { locale, width }); await settle(page);
    const t = await cardText(page); assert.match(t, lang === 'el' ? /Δεν βρέθηκε επαληθευμένη τιμή/ : /No verified price for this barcode/); assert.doesNotMatch(t, /\d\s?€|€\s?\d/); await noOverflow(page); await ctx.close();
  });
}

test('a barcode missing from Open Food Facts still shows its last recorded price (Greek), with its age', async () => {
  const { page, ctx } = await open(`${BASE}/?lang=el#/p/${OLD}`); await page.waitForSelector('#instant-calc', { timeout: 25000 }); await settle(page);
  const t = await cardText(page); assert.match(t, /Τελευταία καταγεγραμμένη τιμή/); assert.match(t, /Καταγράφηκε πριν/); assert.match(t, /\d,\d\d\s?€/); assert.ok(await page.locator('.fp80-standalone').count());
  await noOverflow(page); await ctx.close();
});

test('the action bar of the product view fits a phone in Greek (v79 pushed the save button off screen)', async () => {
  for (const width of [320, 390]) {
    const { page, ctx } = await open(`${BASE}/?lang=el#/p/${CUR}`, { width }); await page.waitForSelector('.report__bar', { timeout: 25000 });
    const boxes = await page.locator('.report__bar > *').evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return { right: Math.round(r.right), width: Math.round(r.width), shown: getComputedStyle(e).display !== 'none' }; }).filter(b => b.shown));
    for (const b of boxes) assert.ok(b.right <= width, `a control ends at ${b.right}px on a ${width}px screen`);
    await ctx.close();
  }
});

test('Better choices show a price figure for every alternative (recorded, last recorded or labelled estimate)', async () => {
  const { page, ctx } = await open(`${BASE}/?lang=el#/p/${CUR}`); await page.waitForSelector('.card--swap', { timeout: 30000 }); await page.waitForTimeout(6000);
  const chips = await page.locator('.card--swap .fp71-slot .fp71c').evaluateAll(els => els.map(e => ({ cls: e.className, text: e.textContent.trim() })));
  assert.ok(chips.length >= 1, 'chips: ' + chips.length); for (const c of chips.filter(c => !/wait/.test(c.cls))) assert.ok(/\d/.test(c.text) || /fp71c--na/.test(c.cls), JSON.stringify(c));
  for (const c of chips.filter(c => /fp71c--est/.test(c.cls))) assert.match(c.text, /Εκτίμηση|Πρόχειρη/);
  await ctx.close();
});

test('compare: an estimate never wins the "cheaper" mark', async () => {
  const { page, ctx } = await open(`${BASE}/?lang=en#/compare/${CUR}/${EST}`, { locale: 'en-GB' }); await page.waitForSelector('.cmpn__table', { timeout: 30000 }); await page.waitForSelector('.fp71-row .fp71-cell', { timeout: 30000 }); await page.waitForTimeout(3000);
  assert.equal(await page.locator('.fp71-row .is-win').count(), 0); assert.ok(await page.locator('.fp71-cell--est').count() >= 1); await ctx.close();
});

for (const [locale, lang] of [['el-GR', 'el'], ['en-GB', 'en']]) test(`prices page: tiles only for chains with a price, estimate shown, nothing overflows (${lang})`, async () => {
  for (const [code, kind] of [[CUR, 'current'], [EST, 'estimate'], [NONE, 'none']]) for (const width of [320, 1280]) {
    const { page, ctx, errors } = await open(`${BASE}/prices/?barcode=${code}&lang=${lang}`, { locale, width }); await page.waitForSelector('#fpResult .fp71, #fpResult .fp-empty', { timeout: 25000 }); await page.waitForTimeout(500);
    const tiles = await page.locator('.fp-network__store').count(); assert.equal(await page.locator('.fp-network__missing').count(), 0, 'no wall of "Not available" tiles');
    if (kind === 'current') assert.ok(tiles >= 3, 'tiles: ' + tiles);
    if (kind === 'estimate') { assert.equal(tiles, 0); assert.ok(await page.locator('.fp71.fp80-is-est').count()); }
    if (kind === 'none') { assert.equal(tiles, 0); assert.ok(await page.locator('.fp80-is-none').count()); }
    await noOverflow(page); assert.deepEqual(errors, []); await ctx.close();
  }
});
