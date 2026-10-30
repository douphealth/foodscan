#!/usr/bin/env node
/** Lab load metrics in real Chromium with CPU and network throttling (CDP): FCP, LCP, CLS, total blocking time, requests and bytes.
 *   node tools/vitals.mjs --base http://localhost:8802 --paths /,/p/5201673006909 [--runs 5] [--cpu 4] [--down 1.6] [--rtt 150]
 * Medians of N cold-cache runs. Lab numbers on this machine; they compare two builds, they are not field data. */
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const base = arg('--base'), paths = arg('--paths', '/').split(','), runs = Number(arg('--runs', 5)), cpu = Number(arg('--cpu', 4)), down = Number(arg('--down', 1.6)), rtt = Number(arg('--rtt', 150));
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
const median = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const browser = await chromium.launch({ executablePath: chrome, headless: true });
const out = {};
for (const path of paths) {
  const samples = [];
  for (let i = 0; i < runs; i++) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', locale: 'el-GR', deviceScaleFactor: 2, isMobile: true });
    const page = await ctx.newPage(), cdp = await ctx.newCDPSession(page);
    await page.route(/openfoodfacts\.org/, r => r.abort());
    await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: rtt, downloadThroughput: down * 125000, uploadThroughput: down * 125000 / 4 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
    await page.addInitScript(() => {
      window.__m = { lcp: 0, cls: 0, fcp: 0, tbt: 0 };
      new PerformanceObserver(l => { for (const e of l.getEntries()) window.__m.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__m.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver(l => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') window.__m.fcp = e.startTime; }).observe({ type: 'paint', buffered: true });
      new PerformanceObserver(l => { for (const e of l.getEntries()) window.__m.tbt += Math.max(0, e.duration - 50); }).observe({ type: 'longtask', buffered: true });
    });
    let requests = 0, bytes = 0, js = 0;
    cdp.on('Network.loadingFinished', e => { requests++; bytes += e.encodedDataLength; });
    cdp.on('Network.responseReceived', e => { if (/javascript/.test(e.response.mimeType)) js++; });
    await page.goto(base + path, { waitUntil: 'networkidle', timeout: 90000 }); await page.waitForTimeout(1200);
    const m = await page.evaluate(() => window.__m);
    samples.push({ ...m, requests, kb: Math.round(bytes / 1024), js });
    await ctx.close();
  }
  out[path] = Object.fromEntries(['fcp', 'lcp', 'cls', 'tbt', 'requests', 'kb', 'js'].map(k => [k, Math.round(median(samples.map(s => s[k])) * 1000) / 1000]));
}
console.log(JSON.stringify({ base, throttle: { cpu, downMbps: down, rttMs: rtt }, runs, medians: out }, null, 1));
await browser.close();
