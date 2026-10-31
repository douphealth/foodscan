#!/usr/bin/env node
/** Screenshot + console QA of a running Pages emulator (tools/serve.mjs).
 *   node tools/qa-shots.mjs --base http://localhost:8801 --out <dir> [--paths /,/p/5201673006909] [--scheme light|dark]
 * Produces mobile (390x844) and desktop (1280x900) PNGs and prints console errors / failed requests per page. */
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const base = arg('--base', 'http://localhost:8801');
const out = arg('--out', 'shots');
const paths = arg('--paths', '/').split(',');
const scheme = arg('--scheme', 'light');
const wait = Number(arg('--wait', 2500));
mkdirSync(out, { recursive: true });
const chrome = [process.env.CHROME_PATH, '/usr/bin/google-chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const browser = await chromium.launch({ executablePath: chrome, headless: true });
for (const [label, viewport, mobile] of [['mobile', { width: 390, height: 844 }, true], ['desktop', { width: 1280, height: 900 }, false]]) {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 2, colorScheme: scheme, serviceWorkers: 'block' });
  for (const p of paths) {
    const page = await ctx.newPage(); const errors = [], failed = [];
    page.on('console', m => { if (['error', 'warning'].includes(m.type())) errors.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
    page.on('pageerror', e => errors.push(`pageerror: ${String(e).slice(0, 300)}`));
    page.on('requestfailed', r => failed.push(`${r.failure()?.errorText} ${r.url().slice(0, 120)}`));
    page.on('response', r => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url().slice(0, 120)}`); });
    const t0 = Date.now();
    await page.goto(base + p, { waitUntil: 'load' }).catch(e => errors.push('goto ' + e.message));
    await page.waitForTimeout(wait);
    const name = `${label}-${scheme}-${p.replace(/[^a-z0-9]+/gi, '_') || 'home'}.png`;
    // Tall pages are cut into readable sections (--sections N, default 3) instead of one unreadable strip.
    const total = await page.evaluate(() => document.documentElement.scrollHeight).catch(() => viewport.height);
    const sectionH = label === 'mobile' ? 1100 : 900, count = Math.min(Number(arg('--sections', 3)), Math.max(1, Math.ceil(total / sectionH)));
    for (let i = 0; i < count; i++) {
      await page.screenshot({ path: path.join(out, name.replace('.png', `-s${i + 1}.png`)), fullPage: true, clip: { x: 0, y: i * sectionH, width: viewport.width, height: Math.min(sectionH, total - i * sectionH) } }).catch(() => {});
    }
    const hscroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth).catch(() => null);
    console.log(`${label} ${p}: ${Date.now() - t0} ms, hscroll=${hscroll}, console=${errors.length}, failed=${failed.length} -> ${name}`);
    for (const e of errors.slice(0, 6)) console.log('   ', e);
    for (const f of failed.slice(0, 6)) console.log('    FAIL', f);
    await page.close();
  }
  await ctx.close();
}
await browser.close();
