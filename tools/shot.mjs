#!/usr/bin/env node
// Screenshot helper: node tools/shot.mjs <url> <out.png> [--w 390] [--h 844] [--locale el-GR] [--full] [--wait 3500] [--dark] [--text]
import { createRequire } from 'node:module';
const require = createRequire('D:/Claude/FoodScan/v62-src/package.json');
const { chromium } = require('playwright-core');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const url = process.argv[2], out = process.argv[3];
const w = Number(arg('--w', 390)), h = Number(arg('--h', 844));
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await browser.newContext({
  viewport: { width: w, height: h }, deviceScaleFactor: 2, locale: arg('--locale', 'el-GR'), timezoneId: 'Europe/Athens',
  colorScheme: process.argv.includes('--dark') ? 'dark' : 'light', serviceWorkers: 'block',
  extraHTTPHeaders: { 'Accept-Language': arg('--locale', 'el-GR') + ',en;q=0.8' },
});
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.type() + ': ' + m.text().slice(0, 300)); });
page.on('pageerror', e => logs.push('pageerror: ' + String(e).slice(0, 300)));
page.on('requestfailed', r => logs.push('reqfail: ' + r.url().slice(0, 140) + ' ' + (r.failure()?.errorText || '')));
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(Number(arg('--wait', 3500)));
const scroll = Number(arg('--scroll', 0));
if (scroll) await page.evaluate(y => { const v = document.querySelector('#view'); (v && v.scrollHeight > v.clientHeight ? v : document.scrollingElement).scrollTo(0, y); }, scroll), await page.waitForTimeout(400);
if (process.argv.includes('--text')) console.log(await page.evaluate(() => document.querySelector('#view')?.innerText || document.body.innerText));
await page.screenshot({ path: out, fullPage: process.argv.includes('--full') });
if (logs.length) console.log(logs.join('\n'));
await browser.close();
