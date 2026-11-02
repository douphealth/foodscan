#!/usr/bin/env node
/** Opens the running site in Greek and lists the English strings the app asked to translate and did not find (globalThis.__fsMissing),
 *  plus visible text nodes that are English-only in the Greek UI.
 *    node tools/i18n-missing.mjs http://localhost:8810 [--locale el-GR] */
import { createRequire } from 'node:module';
const require = createRequire('D:/Claude/FoodScan/v62-src/package.json');
const { chromium } = require('playwright-core');
const base = process.argv[2] || 'http://localhost:8810';
const locale = process.argv.includes('--locale') ? process.argv[process.argv.indexOf('--locale') + 1] : 'el-GR';
const routes = (process.argv.find(a => a.startsWith('--routes='))?.slice(9).split(',')) || ['/', '/#/scan', '/#/search', '/#/foods', '/#/me', '/#/p/3017620422003', '/#/p/5201004023360', '/#/p/5201054015360', '/#/p/5201037712576', '/#/compare/3017620422003/5201004023360', '/#/p/5449000214911', '/#/p/8076809523547'];
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale, serviceWorkers: 'block', extraHTTPHeaders: { 'Accept-Language': locale } });
const missing = new Map(), latin = new Map();
for (const r of routes) {
  const page = await ctx.newPage();
  await page.goto(base + (r.includes('?') ? r : (r.startsWith('/#') ? '/?lang=el' + r.slice(1) : r)), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5500);
  const got = await page.evaluate(() => {
    const out = { missing: [...(globalThis.__fsMissing || [])], latin: [] };
    const walker = document.createTreeWalker(document.querySelector('#app') || document.body, NodeFilter.SHOW_TEXT);
    let n; while ((n = walker.nextNode())) {
      const t = n.nodeValue.replace(/\s+/g, ' ').trim(); if (t.length < 4) continue;
      const p = n.parentElement; if (!p || ['SCRIPT', 'STYLE', 'OPTION'].includes(p.tagName) && false) continue;
      if (/[A-Za-z]{3,}/.test(t) && !/[\u0370-\u03ff]/.test(t) && !/^[\w\s.,:;%()\/&+\-·'’"!?€|#×x0-9]+$/.test(t) === false) out.latin.push(t.slice(0, 160));
    }
    return out;
  });
  for (const s of got.missing) missing.set(s, (missing.get(s) || new Set()).add(r));
  for (const s of got.latin) latin.set(s, (latin.get(s) || new Set()).add(r));
  await page.close();
}
console.log('=== missing (asked to translate, not in dictionary):', missing.size);
for (const [s, rs] of missing) console.log(JSON.stringify(s), [...rs].map(x => x.replace('/#', '#')).join(' '));
console.log('=== visible Latin-only text in the Greek UI:', latin.size);
for (const [s, rs] of latin) if (!missing.has(s)) console.log(JSON.stringify(s), [...rs].map(x => x.replace('/#', '#')).join(' '));
await browser.close();
