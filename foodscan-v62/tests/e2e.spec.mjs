/** Real Chromium against the built tree, served exactly as Cloudflare Pages would (tools/serve.mjs: real _worker.js, _routes.json, _headers/CSP).
 * The upstream food API is unreachable for the whole run (worker --offline, browser requests aborted), so everything below is what a shopper
 * gets from the bundled catalogue during an outage.  Run: node --test tests/e2e.spec.mjs */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { ROOT } from './helpers.mjs';

const PORT = 8811, BASE = `http://localhost:${PORT}`;
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
let server, browser;
const bases = JSON.parse(readFileSync(join(ROOT, 'tests', 'fixtures', 'rec-bases.json'), 'utf8'));

before(async () => {
  server = spawn(process.execPath, [join(ROOT, 'tools', 'serve.mjs'), '--port', String(PORT), '--offline'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => { const t = setTimeout(() => reject(new Error('server did not start')), 20000); server.stdout.on('data', d => { if (String(d).includes('emulator')) { clearTimeout(t); resolve(); } }); server.on('exit', c => reject(new Error('server exited ' + c))); });
  browser = await chromium.launch({ executablePath: CHROME, headless: true });
});
after(async () => { await browser?.close(); server?.kill(); });

async function open(path, { width = 390, height = 844, locale = 'en-GB', wait = 3500 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale, timezoneId: locale === 'el-GR' ? 'Europe/Athens' : 'Europe/London' });
  const page = await ctx.newPage(), errors = [];
  await page.route(/openfoodfacts\.org/, r => r.abort());
  page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  await page.goto(BASE + path, { waitUntil: 'load' });
  await page.waitForSelector('#app *', { timeout: 15000 });
  await page.waitForTimeout(wait);
  return { ctx, page, errors };
}

test('landing page: phone illustration and the five-grade scale are present, visible, and nothing overflows', async () => {
  for (const width of [360, 390, 768, 1280]) {
    const { ctx, page, errors } = await open('/', { width });
    const phone = await page.locator('.stg-phone').first().boundingBox();
    assert.ok(phone && phone.width > 120 && phone.height > 200, `phone illustration ${JSON.stringify(phone)} at ${width}px`);
    const tabs = await page.locator('.scale59__tab').allTextContents();
    assert.equal(tabs.length, 5); assert.deepEqual(tabs.map(t => t.trim().charAt(0)).sort(), ['A', 'B', 'C', 'D', 'E']);
    assert.equal(await page.locator('.scale59__panel').count(), 5);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `horizontal overflow ${overflow}px at ${width}px`);
    assert.deepEqual(errors, [], `console errors at ${width}px`);
    await ctx.close();
  }
});

test('percentage bars fill exactly the percentage printed next to them', async () => {
  const { ctx, page } = await open('/p/5201673006909');
  const rows = await page.locator('.nutri-radar__row').evaluateAll(els => els.map(row => {
    const label = row.querySelector('b').textContent.trim(), track = row.querySelector('.nutri-radar__track'), fill = track.querySelector('i');
    return { label, now: Number(track.getAttribute('aria-valuenow')), css: fill.style.getPropertyValue('--w'), ratio: fill.getBoundingClientRect().width / track.getBoundingClientRect().width };
  }));
  assert.equal(rows.length, 5);
  for (const r of rows) {
    const printed = Number(r.label.replace('%', ''));
    assert.equal(r.now, printed, `meter value ${JSON.stringify(r)}`);
    assert.ok(Math.abs(parseFloat(r.css) - printed) < 0.51, `--w ${r.css} vs ${printed}%`);
    assert.ok(Math.abs(r.ratio * 100 - printed) < 1.2, `rendered ${Math.round(r.ratio * 1000) / 10}% vs printed ${printed}%`);
  }
  const macro = await page.locator('.macro-split__seg').evaluateAll(els => els.map(e => parseFloat(e.style.getPropertyValue('--w'))));
  assert.ok(Math.abs(macro.reduce((a, b) => a + b, 0) - 100) < 1.5, `macro split sums to ${macro}`);
  await ctx.close();
});

test('a suggested higher grade opens as exactly that grade (no A -> C), for every suggestion on 10 real products', async () => {
  let checked = 0;
  for (const base of bases) {
    const { ctx, page } = await open(`/p/${base.code}`, { locale: 'el-GR', wait: 3000 });
    const cards = await page.locator('.card--swap a[href^="#/p/"]').evaluateAll(links => links.map(a => ({ href: a.getAttribute('href'), grade: [...a.querySelectorAll('.gmove .gchip')].at(-1)?.textContent.trim() || null })));
    const suggestions = cards.filter(c => c.grade);
    assert.ok(suggestions.length >= 1, `${base.name}: no suggestion rendered (${JSON.stringify(cards)})`);
    const seen = new Set();
    for (const s of suggestions) {
      if (seen.has(s.href)) continue; seen.add(s.href);
      const baseGrade = await page.locator('article.report').first().getAttribute('class');
      assert.match(baseGrade, /g-[A-E]/);
      const rank = g => 'ABCDE'.indexOf(g), shownBase = baseGrade.match(/g-([A-E])/)[1];
      assert.ok(rank(s.grade) < rank(shownBase), `${base.name}: "${s.grade}" is not higher than the opened report's ${shownBase}`);
      const target = await ctx.newPage(); await target.route(/openfoodfacts\.org/, r => r.abort());
      await target.goto(BASE + '/' + s.href); await target.waitForSelector('article.report', { timeout: 15000 });
      const cls = await target.locator('article.report').first().getAttribute('class');
      assert.equal(cls.match(/g-([A-E])/)?.[1], s.grade, `${base.name}: suggestion ${s.href} showed ${s.grade} but opened as ${cls}`);
      await target.close(); checked++;
    }
    await ctx.close();
  }
  assert.ok(checked >= 15, `only ${checked} suggestions verified`);
});

test('during an outage the catalogue still answers: report, Greek search, no "try again" dead end', async () => {
  const { ctx, page } = await open('/p/5201673006909', { locale: 'el-GR' });
  assert.match(await page.title(), /(Grade|Βαθμός) C/); assert.equal(await page.getByText(/Food database unavailable|unavailable/i).count(), 0);
  await page.goto(BASE + '/#/s/' + encodeURIComponent('γιαούρτι')); await page.waitForTimeout(3500);
  assert.ok(await page.locator('a[href^="#/p/"]').count() >= 5, 'Greek search returned results from the catalogue');
  await page.goto(BASE + '/#/s/galaktos'); await page.waitForTimeout(3500);
  assert.ok(await page.locator('a[href^="#/p/"]').count() >= 5, 'Greeklish search returned results');
  await ctx.close();
});

test('accessibility: no serious or critical axe violations on the landing page and a report', async () => {
  const axe = readFileSync(join(ROOT, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');
  for (const path of ['/', '/p/5201673006909']) {
    for (const scheme of ['light', 'dark']) {
      const { ctx, page } = await open(path, { wait: 3000 });
      await page.emulateMedia({ colorScheme: scheme }); await page.waitForTimeout(500);
      await page.evaluate(axe);
      const result = await page.evaluate(() => axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] }));
      const bad = result.violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => `${v.id}: ${v.nodes.length} nodes e.g. ${v.nodes[0].target.join(' ')}`);
      assert.deepEqual(bad, [], `${path} ${scheme}`);
      await ctx.close();
    }
  }
});

test('Greek interface: grade explanations are Greek', async () => {
  const { ctx, page } = await open('/p/5201673006909', { locale: 'el-GR' });
  const text = await page.locator('main, #app').first().innerText();
  assert.match(text, /Επιλογές|βαθμ|Βαθμ/);
  assert.doesNotMatch(text, /The source did not identify|independently reproduced/);
  await ctx.close();
});
