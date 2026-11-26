/** Service worker in real Chromium: installs, precaches the whole shell under this release's cache name, and the app reopens offline. */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { ROOT, APP } from './helpers.mjs';

const PORT = 8813, BASE = `http://localhost:${PORT}`;
const CHROME = [process.env.CHROME_PATH, '/usr/bin/google-chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
let server, browser;
before(async () => {
  server = spawn(process.execPath, [join(ROOT, 'tools', 'serve.mjs'), '--dir', APP, '--port', String(PORT), '--offline'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => { const t = setTimeout(() => reject(new Error('no server')), 20000); server.stdout.on('data', d => { if (String(d).includes('emulator')) { clearTimeout(t); resolve(); } }); });
  browser = await chromium.launch({ executablePath: CHROME, headless: true });
});
after(async () => { await browser?.close(); server?.kill(); });

test('the service worker installs, precaches this release, and the app reopens offline', async () => {
  const sw = readFileSync(join(APP, 'sw.js'), 'utf8'), cache = sw.match(/const CACHE = '([^']+)'/)[1];
  const precache = JSON.parse(sw.match(/const PRECACHE = (\[.*?\]);/s)[1].replace(/'/g, '"'));
  const ctx = await browser.newContext({ locale: 'el-GR' }), page = await ctx.newPage();
  await page.route(/openfoodfacts\.org/, r => r.abort());
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(async name => (await caches.keys()).includes(name) && (await (await caches.open(name)).keys()).length > 40, cache, { timeout: 40000 });
  const cached = await page.evaluate(async name => (await (await caches.open(name)).keys()).map(r => new URL(r.url).pathname), cache);
  for (const p of precache.map(p => p.split('?')[0])) assert.ok(cached.includes(p), `not precached: ${p}`);
  assert.ok((await page.evaluate(() => caches.keys())).every(k => !k.startsWith('foodscan-') || k === cache), 'only this release\'s cache remains');
  await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(1500);
  await ctx.setOffline(true);
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' }); await page.waitForSelector('.stg-phone, .hero21', { timeout: 15000 });
  assert.ok(await page.locator('.hero21').count() > 0, 'the app shell opens with no network');
  await ctx.close();
});

test('updates wait for the shopper and saved data survives a service worker install', async () => {
  const ctx = await browser.newContext(), page = await ctx.newPage();
  await page.route(/openfoodfacts\.org/, r => r.abort());
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.evaluate(() => { localStorage.setItem('fs13:probe', '{"keep":true}'); });
  await page.evaluate(() => navigator.serviceWorker.ready);
  const kept = await page.evaluate(() => localStorage.getItem('fs13:probe'));
  assert.equal(kept, '{"keep":true}');
  const sw = readFileSync(join(APP, 'sw.js'), 'utf8');
  assert.match(sw, /SKIP_WAITING/, 'updates wait for the shopper (no reload mid-scan)');
  assert.doesNotMatch(sw, /skipWaiting\(\);\s*\}\);\s*self\.addEventListener\('install'/);
  await ctx.close();
});
