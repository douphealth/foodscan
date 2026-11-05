/* FoodScan service worker. Offline shell + fast repeat visits. Product data is never cached here: the app keeps
 * its own validated saved copies, and the server caches API answers.
 *
 * Updates (75): a new version installs in the background and takes over at once (skipWaiting + clients.claim), so a
 * phone never stays on an old build. The page (prices/native-v83.js) reloads itself when idle, or shows a small refresh
 * bar while the shopper is scanning or typing. A file that fails to precache no longer blocks the update: it is fetched
 * from the network when first needed. (78: superseded price-file generations were removed; a page left open on an old release reloads into 78 on its next visit.)
 *
 * (82, 3 Nov: price-row layout fix in prices/native-v80.css; this comment changes the file so phones with this worker installed re-fetch the shell)
 * (88.0, 5 Nov: the Prices page in the app's design system (prices/prices-app-v88.css, dock), healthier swaps on the product page (prices/swaps-ui-v88.js, swaps-v88.mjs, swaps-v88.css).)
 * (87.2, 5 Nov: prices/similar-v86.mjs, grade-ui-v85.mjs and reader-v85.js changed: maker code, product family and Greek/Greeklish spellings find similar products.)
 * (87.1, 5 Nov: prices/reader-v85.js and prices/grade-ui-v85.mjs changed: one missing number is borrowed from similar products.)
 * (87.0, 5 Nov: Open Prices daily snapshot + live delta in the worker; no shell file changed, this line renames the cache.)
 * (86.0, 5 Nov: grades estimated from similar products (prices/similar-v86.mjs, assets/peers-off-csv-2026-10-30.json) and the "not rated" card for salt, spices, alcohol, supplements and baby food.)
 * (85.0, 5 Nov: "Read the label": prices/reader-v85.js, label-reader-v85.mjs, label-ocr-v85.mjs and assets/domain-v8500.mjs are new.)
 * (84.0, 5 Nov: Nutri-Score 2023 protein rule corrected (assets/*-v8400.*); web price search; the price modules changed in place, which this release name picks up.)
 * (83.2, 4 Nov: one market on every page; "Check live prices online" is the plain barcode search.)
 * (83.1, 4 Nov: product records that the saved catalogue cannot grade are read live first (assets/*-v8400.js).)
 * (83, 4 Nov: worldwide prices. The price modules are now prices/*-v83.*; a phone on 82 reloads into 83 on its next visit.)
 *
 * Pages are fetched with a per-minute query added (?_fs=…). A CDN rule that caches HTML for hours (the live zone had one,
 * serving week-old pages) cannot then hold a controlled phone on an old release: the page comes from the origin. */
const CACHE = 'foodscan-88.0.0';
const PRECACHE = ['/prices/','/prices/prices-v83.js','/prices/prices-v83.css','/prices/prices-base-v80.css','/prices/native-v83.js','/prices/native-v83.css','/prices/reader-v85.js','/prices/reader-v85.css','/prices/swaps-ui-v88.js','/prices/swaps-v88.css','/prices/prices-app-v88.css','/prices/price-core-v83.mjs','/prices/price-client-v83.mjs','/prices/market-v83.mjs','/prices/add-price-v80.mjs','/prices/ocr-parse-v80.mjs','/market-hint-v71.js','/ui-v80.css','/assets/app-V52SOTA1-v8400.js','/assets/chunk-CFDGV521-v8400.js','/assets/match-policy-v7540.mjs', '/assets/profile-evidence-v7540.mjs', '/assets/comparison-guards-v7540.mjs', '/assets/greece-r20261030/index.json', '/assets/market-catalogue-v8400.mjs','/assets/nutrition-choices-v7540.mjs','/assets/domain-v8400.mjs','/assets/recommendations-core-v8400.mjs','/assets/balance-view-v7540.mjs',"/growth-ui.css?v=75","/growth-ui.js?v=75","/fridge-core.mjs?v=75","/challenge/challenge.css?v=75","/challenge/challenge.js?v=75","/","/demo/","/how/","/challenge/","/challenge/challenge.js","/challenge/challenge.css","/growth-ui.js","/growth-ui.css","/fridge-core.mjs","/challenge/og-challenge.png","/public-catalog.css","/public-catalog.js","/battle-ui.js","/manifest.webmanifest","/icon.svg","/icon-192.png","/assets/app-V52SOTA1-v7540.css","/assets/chunk-2H3CV521-v8400.js","/assets/chunk-2OB4V521-v8400.js","/assets/chunk-4O7IN74N-v8400.js","/assets/chunk-4SO6OQI3-v8400.js","/assets/chunk-4U25V521-v8400.js","/assets/chunk-57E5ZLYU-v8400.js","/assets/chunk-5DGYLCD6-v8400.js","/assets/chunk-6K2A3QNO-v8400.js","/assets/chunk-6K6QREZY-v8400.js","/assets/chunk-AHTU2MHF-v8400.js","/assets/chunk-AMKGV521-v8400.js","/assets/chunk-BIWX2LG4-v8400.js","/assets/chunk-BQAK4GGD-v8400.js","/assets/chunk-BQKWV521-v8400.js","/assets/chunk-CMYEZZXL-v8400.js","/assets/chunk-EUIXRGK6-v8400.js","/assets/chunk-FKD7WWRO-v8400.js","/assets/chunk-GA22IG5W-v8400.js","/assets/chunk-I3TRV521-v8400.js","/assets/chunk-IO4NLMGT-v7540.js","/assets/chunk-JLYH5AFS-v8400.js","/assets/chunk-JOUXBJOG-v8400.js","/assets/chunk-LGF5RK5L-v8400.js","/assets/chunk-NAM4V521-v8400.js","/assets/chunk-OJJENOAQ-v7540.js","/assets/chunk-OR7WUKMJ-v8400.js","/assets/chunk-QKBAEP6B-v7540.js","/assets/chunk-QWAD3TTI-v8400.js","/assets/chunk-R4QLF4YV-v8400.js","/assets/chunk-SN3WV521-v8400.js","/assets/chunk-TM35ZLZG-v8400.js","/assets/chunk-TTXUOT36-v8400.js","/assets/chunk-VOAOOBMT-v8400.js","/assets/chunk-XKEZNCT7-v8400.js"];
const DOCS = ['/', '/demo/', '/how/', '/challenge/', '/prices/'];
const fresh = url => { const u = new URL(url, location.origin); u.searchParams.set('_fs', String(Math.floor(Date.now() / 60000))); return u.href; };

self.addEventListener('install', event => {
  // Six downloads at a time, each retried once (42.0): a phone on a weak signal no longer starts 40 requests at once and fails the install.
  // Hashed assets come from the HTTP cache when the page already loaded them: no second download. Pages always come fresh.
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    let next = 0, docFailed = false;
    const worker = async () => {
      while (next < PRECACHE.length) {
        const path = PRECACHE[next++], doc = DOCS.includes(path), get = () => fetch(doc ? fresh(path) : path, { cache: doc ? 'no-store' : 'reload' });
        try { let res; try { res = await get(); if (!res.ok) throw new Error(String(res.status)); } catch { res = await get(); }
          if (res.ok) await cache.put(path, res); else throw new Error(String(res.status)); } catch { if (doc) docFailed = true; /* other files: fetched on first use */ }
      }
    };
    await Promise.all(Array.from({ length: Math.min(6, PRECACHE.length) }, worker));
    if (docFailed) throw new Error('precache pages failed'); // offline now: keep the current version and its offline copy
    await self.skipWaiting();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'GET_BUILD') event.ports?.[0]?.postMessage({ build: CACHE });
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('foodscan-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
/** Where an offline navigation lands: the same page if it was opened before, else its section, else the app. */
const offlinePage = async url => (await caches.match(url.pathname)) || (await caches.match(url.pathname.startsWith('/demo') ? '/demo/' : url.pathname.startsWith('/how') ? '/how/' : url.pathname.startsWith('/challenge') ? '/challenge/' : url.pathname.startsWith('/prices') ? '/prices/' : '/'));
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/prices/service/') || url.pathname.startsWith('/products/') || url.pathname.startsWith('/scorecards/') || url.pathname.startsWith('/battles/') || url.pathname.startsWith('/battle-cards/') || url.pathname.startsWith('/sitemap-catalog') || request.headers.has('Range')) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('slow')), 3500));
        let res = await Promise.race([fetch(fresh(request.url), { cache: 'no-store', credentials: 'same-origin', redirect: 'manual' }), timeout]);
        // A redirect (/demo -> /demo/) is left to the browser, with the address it asked for, not the cache-busting one.
        if (res.type === 'opaqueredirect') res = await Promise.race([fetch(request), timeout]);
        // Each page is kept under its own path: /how/ never stands in for the app (31.0 stored every page as "/").
        else if (res.ok) { const copy = res.clone(); event.waitUntil(caches.open(CACHE).then(c => c.put(url.pathname, copy)).catch(() => {})); }
        return res;
      } catch {
        return (await offlinePage(url)) || Response.error();
      }
    })());
    return;
  }
  if (url.pathname.startsWith('/assets/')) {
    // Content-hashed and immutable: cache first.
    event.respondWith(caches.match(request).then(hit => hit || fetch(request).then(res => { if (res.ok) { const copy = res.clone(); event.waitUntil(caches.open(CACHE).then(c => c.put(request, copy)).catch(() => {})); } return res; })));
    return;
  }
  event.respondWith(caches.match(request).then(hit => { const refresh = fetch(request).then(res => { if (res.ok) { const copy = res.clone(); event.waitUntil(caches.open(CACHE).then(c => c.put(request, copy)).catch(() => {})); } return res; }).catch(() => hit); return hit || refresh; }));
});
