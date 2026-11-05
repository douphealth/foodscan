var worker_default = {
  async fetch(request, env = {}, ctx) {
    const url = new URL(request.url);
    try {
      // v55: preserve v52 scanner, with isolated opt-in catalog and growth routes.
      const growthResponse = await fs54Route(request, env, ctx);
      if (growthResponse) return growthResponse;
      const catalogResponse = await fscPublicRoute(request, env, ctx);
      if (catalogResponse) return catalogResponse;
      if (url.href.length > 4096) return error("request_too_long", "The request URL is too long.", 414);
      // Handle both paths before the non-/api static asset branch.
      // Older custom-domain Workers may still intercept /api/*; /prices/service/*
      // is served by this Pages Worker on the same origin, without browser CORS.
      if (url.pathname === '/ingest' || url.pathname.startsWith('/ingest/')) return new Response('Not found', {status:404, headers:{'Content-Type':'text/plain','Cache-Control':'no-store'}});
      const priceResponse = await fsPricesRoute(request, env, ctx);
      if (priceResponse) return priceResponse;
      const page = url.pathname.match(/^\/p\/(\d{8,14})\/?$/);
      if (page) {
        if (!["GET", "HEAD"].includes(request.method)) return error("method_not_allowed", "Use GET or HEAD.", 405, {}, { Allow: "GET, HEAD" });
        if (!validBarcode2(page[1])) return Response.redirect(`${url.origin}/`, 302);
        const canon = canonicalCode(page[1]);
        if (canon) return Response.redirect(`${url.origin}/p/${canon}${url.search}`, 301);
        if (request.method === "HEAD") return new Response(null, { headers: pageHeaders(url, { "X-Robots-Tag": "noindex, follow" }) });
        return await productPage(request, env, ctx, page[1]);
      }
      const pair = url.pathname.match(/^\/compare\/(\d{8,14})\/(\d{8,14})\/?$/);
      if (pair) {
        if (!["GET", "HEAD"].includes(request.method)) return error("method_not_allowed", "Use GET or HEAD.", 405, {}, { Allow: "GET, HEAD" });
        if (!validBarcode2(pair[1]) || !validBarcode2(pair[2])) return Response.redirect(`${url.origin}/`, 302);
        const [a, b] = [canonicalCode(pair[1]) || pair[1], canonicalCode(pair[2]) || pair[2]];
        if (`/compare/${a}/${b}` !== url.pathname) return Response.redirect(`${url.origin}/compare/${a}/${b}${url.search}`, 301);
        if (request.method === "HEAD") return new Response(null, { headers: pageHeaders(url, { "X-Robots-Tag": "noindex, follow" }) });
        return await comparePage(request, env, ctx, a, b);
      }
      if (!url.pathname.startsWith("/api/")) {
        if (!["GET", "HEAD"].includes(request.method)) return error("method_not_allowed", "Use GET or HEAD.", 405, {}, { Allow: "GET, HEAD" });
        const docs = /* @__PURE__ */ new Set(["/", "/index.html", "/demo/", "/how/", "/demo/index.html", "/how/index.html", "/robots.txt", "/sitemap.xml", "/sitemap-pages.xml", "/sitemap-products.xml", "/llms.txt", "/manifest.webmanifest"]);
        if (["/demo", "/how"].includes(url.pathname)) return Response.redirect(`${url.origin}${url.pathname}/${url.search}`, 308);
        if (["/index.html", "/demo/index.html", "/how/index.html"].includes(url.pathname)) return Response.redirect(`${url.origin}${url.pathname.replace("index.html", "")}${url.search}`, 308);
        const out = docs.has(url.pathname) ? await siteDocument(request, env) : await env.ASSETS.fetch(request);
        return request.method === "HEAD" ? new Response(null, { status: out.status, headers: out.headers }) : out;
      }
      if (request.headers.get("Sec-Fetch-Site") === "cross-site" || request.headers.get("Origin") && request.headers.get("Origin") !== url.origin) return error("origin_not_allowed", "Use this API from the FoodScan site.", 403);
      
      if (url.pathname === "/api/sync") return await fs63Sync(request, env);

      if (url.pathname === "/api/events") return await collectEvent(request, env);
      if (!["GET", "HEAD"].includes(request.method)) return error("method_not_allowed", "Only GET requests are supported.", 405, {}, { Allow: "GET, HEAD" });
      if (request.method === "HEAD") return new Response(null, { status: 200, headers: { "Cache-Control": "no-store", "X-FoodScan-Version": VERSION, "Content-Type": "application/json; charset=utf-8" } });
      if (url.pathname === "/api/health") {
        let catalogue=null;try{const m=await fs60Manifest(request,env);catalogue={status:"ready",country:"greece",products:m.productCount,exportedAt:m.exportedAt,source:m.source,coverage:m.coverage,routingSchema:2,categoryFiles:Object.keys(m.shards).length,sourceAgeDays:Math.floor((Date.now()-m.exportedAt)/86400000)};}catch{catalogue={status:"unavailable"};}
        const deep = url.searchParams.get("deep") === "1" ? await deepHealth(request, env) : null;
        const d1 = idxEnabled(env);
        return json({
          app: "FoodScan",
          catalogue,
          version: VERSION,
          build: BUILD,
          backend: "ready",
          upstream: deep ? deep.status : "not-checked",
          checks: deep?.checks,
          checkedAt: deep?.checkedAt,
          index: deep?.index || { bound: Boolean(env.FOOD_DB), enabled: d1, mode: d1 ? "index-first" : "legacy" },
          contactConfigured: Boolean(env.CONTACT_EMAIL),
          analyticsConfigured: Boolean(env.ANALYTICS),
          publicCatalog: { enabled: FSC_ENABLED(env), bound: Boolean(env.FOODSCAN_PUBLIC_DB), autoIngest: FSC_AUTO_ENABLED(env), queueBound: Boolean(env.FOODSCAN_INGEST_QUEUE), votingReady: Boolean(env.FOODSCAN_TURNSTILE_SECRET&&env.FOODSCAN_TURNSTILE_SITE_KEY), publication: 'manual_approval_required' },
          country: request.cf?.country || null,
          prices: { version: FS_PRICE_VERSION, openPrices: "public-api", licensedFeed: Boolean(env.FOODSCAN_PRICES_DB), adminImportConfigured: Boolean(env.FOODSCAN_PRICES_DB && env.FOODSCAN_PRICES_ADMIN_TOKEN) },
          source: ORIGIN,
          search: d1 ? "d1-fts5+live-fallback" : "index+off-search",
          recovery: d1 ? "edge-cache+d1-snapshots+saved-records+browser-read" : "edge-stale-and-saved-records+browser-read",
          serverDeadlineMs: DEADLINE_MS,
          features: ["isolated-catalogue-file-recovery", "compact-catalogue-routing", "missing-category-recovery", "same-use-comparison-guards", "complete-batch-record-reuse", "bounded-preview-enrichment", "shared-grade-decision-v59", "verified-alternatives-before-render", "country-filtered-paginated-discovery", "accurate-percentage-bars", ...FSC_ENABLED(env) ? ['approved-public-products', 'branded-social-png', 'privacy-first-battles', 'seven-discovery-challenge', 'catalog-sitemap-v2', 'queue-producer'] : [], "share-funnel-v2", "compare-pages", "server-rendered-reports", "product-sitemap", "durable-index-v5", "conflicting-grade-withholding", "negative-nutrition-guard", "verified-2023-points", "localized-ingredient-evidence", "confirmed-missing-backoff", "shared-upstream-cooldown", "price-comparison-evidence-v67", "licensed-price-feed-import-optional", "browser-product-fallback", "catalogue-live-fallback", "stale-catalogue-refresh", "cheap-head"],
          requestBudgets: { scope: d1 ? "D1-atomic" : "worker-instance", productPerMinute: d1 ? 10 : PRODUCT_MINUTE, searchPerMinute: d1 ? 7 : SEARCH_MINUTE, searchIndexPerMinute: d1 ? 7 : INDEX_MINUTE, globallyCoordinated: d1, overflow: "browser reads the product directly from Open Food Facts" },
          notes: [d1 ? "Index-first mode: the catalogue answers first; empty answers fall back to the live search unless FOODSCAN_REQUIRE_INDEX=1." : "The bundled Greek catalogue works without D1. Live lookup is used only when needed or explicitly requested.", "Open Food Facts records are community-reported and may be incomplete.", ...!env.CONTACT_EMAIL ? ["Set CONTACT_EMAIL to identify this app to Open Food Facts."] : []]
        });
      }
      if (url.pathname === "/api/alternatives") return await fs60LocalAlternatives(request,env) || await idxAlternatives(request, env, ctx);
      if (url.pathname === "/api/search") return await idxSearch(request, env, ctx);
      const match = url.pathname.match(/^\/api\/product\/(\d+)$/);
      if (!match) return error("route_not_found", "Unknown API route.", 404);
      if (!validBarcode2(match[1])) return error("invalid_barcode", "The barcode length or check digit is invalid.", 400);
      const productResult = (url.searchParams.get("refresh")!=="1" ? await fs60LocalProduct(request,env,match[1]) : null) || await productResponse(request, env, ctx, match[1]);
      if (FSC_AUTO_ENABLED(env) && productResult.status === 200 && typeof ctx?.waitUntil === 'function')
        ctx.waitUntil(fscIngestFromScan(productResult.clone(),env));
      return productResult;
    } catch (e) {
      console.error(JSON.stringify({ app: "FoodScan", version: VERSION, error: "worker_failure", message: String(e?.message || "").slice(0, 120) }));
      return error("server_error", "The request could not be completed. Saved foods still work.", 503, {}, { "Retry-After": "30" });
    }
  }
};
async function productResponse(request, env, ctx, code) {
  const required = idxRequiredError(env);
  if (required) return required;
  const url = new URL(request.url), cache = globalThis.caches?.default;
  const country = request.cf?.country || "", canonicalCode2 = code.length === 12 ? `0${code}` : code;
  const key = new Request(`${url.origin}/api/cache/${CACHE_SCHEMA}/product/${code.padStart(14, "0")}`), staleKey = new Request(`${url.origin}/api/cache/${CACHE_SCHEMA}/stale/product/${code.padStart(14, "0")}`);
  const cronMode = ctx?.foodscanCronRefresh === true && env?.FOODSCAN_CRON_EXECUTION === "1";
  if (cache && !cronMode) {
    try {
      const hit2 = await cache.match(key);
      if (hit2?.status === 200) return withCache(hit2, "HIT", { "X-FoodScan-Country": country });
    } catch {
    }
  }
  const pending = inflight.get(key.url);
  if (pending && !cronMode) {
    const out = (await pending).clone();
    return withCache(out, out.headers.get("X-FoodScan-Cache") === "STALE" ? "STALE" : "COALESCED", { "X-FoodScan-Country": country });
  }
  if (inflight.size >= MAX_PENDING) return error("local_rate_limited", "Too many lookups are in progress.", 429, { retryAfter: 10 }, { "Retry-After": "10" });
  const later = (work) => ctx?.waitUntil ? ctx.waitUntil(work) : work;
  const job = (async () => {
    const indexed = await idxGetProduct(env, code);
    if (indexed?.error && idxRequired(env)) return await staleCopy(cache, staleKey) || error("index_unavailable", "The indexed catalogue is temporarily unavailable. Saved foods still work.", 503, {}, { "Retry-After": "30" });
    if (indexed && !indexed.error && !indexed.stale) {
      idxRefreshStale(request, env, ctx, code, indexed.verifiedAt);
      if (!cronMode) await later(remember(cache, ctx, key, staleKey, indexed.response, 180));
      return indexed.response;
    }
    if (!indexed && await idxIsNegative(env, code)) return error("not_found", "The indexed source does not have this barcode yet.", 404);
    const result = await fetchProduct(request, env, canonicalCode2);
    if (result.status === 200) {
      if (idxEnabled(env)) await later(idxSaveProduct(env, result, code));
      await remember(cache, ctx, key, staleKey, result, idxEnabled(env) ? 180 : FRESH.product);
    } else if (result.status === 404 && idxEnabled(env)) {
      try {
        const detail = await result.clone().json();
        if (detail?.error?.code === "not_found") await later(idxMarkNegative(env, code));
      } catch {
      }
    } else if (![400, 403, 404].includes(result.status)) {
      if (indexed?.response) return indexed.response;
      const stale = await staleCopy(cache, staleKey);
      if (stale) return stale;
    }
    return withCache(result, "MISS");
  })();
  if (!cronMode) inflight.set(key.url, job);
  try {
    const out = (await job).clone();
    return withCache(out, out.headers.get("X-FoodScan-Cache") || "MISS", { "X-FoodScan-Country": country });
  } finally {
    if (!cronMode) inflight.delete(key.url);
  }
}
var CSP = "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data: blob: https://images.openfoodfacts.org https://static.openfoodfacts.org; media-src 'self' blob:; connect-src 'self' https://world.openfoodfacts.org; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'".startsWith("__") ? "default-src 'self'" : "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data: blob: https://images.openfoodfacts.org https://static.openfoodfacts.org; media-src 'self' blob:; connect-src 'self' https://world.openfoodfacts.org; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
var escapeHTML = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var plain = (v, n = 140) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
function pageHeaders(url, extra = {}) {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": CSP,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Permissions-Policy": "camera=(self), microphone=(), geolocation=(), payment=()",
    "Cache-Control": "no-cache, must-revalidate",
    "CDN-Cache-Control": "no-store",
    "X-FoodScan-Version": VERSION,
    ...extra
  };
}
var GUIDES = '<p class="boot__more"><a href="https://gearuptofit.com/nutrition/free-food-scanner-app/">Free Food Scanner App Guide</a> · <a href="https://gearuptofit.com/nutrition/is-nutella-healthy/">Is Nutella Healthy?</a> · <a href="https://gearuptofit.com/">GearUpToFit.com</a></p>';
var num = (v) => new Intl.NumberFormat("en-GB", { maximumFractionDigits: v < 1 ? 2 : 1 }).format(v);
var parsed = (raw, code) => raw ? parseProduct({ status: 1, product: raw, fetchedAt: Date.now() }, code) : null;
var per = (p) => p?.basis === "ml" ? "100 ml" : "100 g";
var ROWS = [["kcal", "Energy", "kcal"], ["fat", "Fat", "g"], ["saturatedFat", "Saturated fat", "g"], ["carbohydrates", "Carbohydrate", "g"], ["sugars", "Sugars", "g"], ["fiber", "Fibre", "g"], ["protein", "Protein", "g"], ["salt", "Salt", "g"]];
function gradeSentence(p, a) {
  if (a.status === "withheld") return `Grade on hold: the record contradicts itself (${a.reasons.join(" ").replace(/\.$/, "")}). FoodScan does not repeat a grade built on impossible values.`;
  if (a.status === "estimated" && a.reproducedSourceGrade) return `FoodScan independently reproduced Nutri-Score ${a.grade} using the 2023 calculation from the source values. The source grade did not identify its version. This is a calculated estimate, not a physical-package verification.`;
  if (a.status === "estimated") return `No grade is published for this record. FoodScan calculated Nutri-Score ${a.grade} from the label values with the official 2023 method; this is an estimate, labelled as such in the app.`;
  if (a.grade) return `Nutri-Score ${a.grade}, as reported by Open Food Facts${a.method === "2023" ? " (2023 calculation, points checked)" : " (the record does not show which method produced it)"}${Number.isFinite(a.score) ? `, with ${a.score} source-reported points (lower is better)` : ""}.`;
  return "No Nutri-Score is reported for this record, and FoodScan does not guess one.";
}
function describe(p, a) {
  const n = p.nutrition, vals = [["sugars", "sugars"], ["saturatedFat", "saturated fat"], ["salt", "salt"]].filter(([k]) => n[k] !== null).map(([k, w]) => `${num(n[k])} g ${w}`);
  const cubes = n.sugars !== null && n.sugars >= 4 ? ` (~${Math.round(n.sugars / 4)} sugar cubes)` : "";
  const pts = Number.isFinite(a.score) ? ` (${a.score} pts)` : "";
  const nova = p.nova ? ` · NOVA ${p.nova}` : "";
  const grade = a.status === "reported" ? `source-reported Nutri-Score ${a.grade}${pts}` : a.status === "estimated" ? `calculated Nutri-Score ${a.grade}${pts}` : a.status === "withheld" ? "grade on hold (the record contradicts itself)" : "no published Nutri-Score";
  return plain(`${p.name}${p.brand ? ` by ${String(p.brand).split(",")[0]}` : ""}: ${grade}${cubes}${nova}${vals.length ? `; per ${per(p)}: ${vals.join(", ")}` : ""}. Ingredients and allergen cross-check, with the method and its limits.`, 300);
}
function factsTable(p) {
  const rows = ROWS.filter(([k]) => p.nutrition[k] !== null).map(([k, label, unit]) => `<tr><th scope="row">${label}</th><td>${escapeHTML(k === "kcal" ? Math.round(p.nutrition[k]) : num(p.nutrition[k]))} ${unit}</td></tr>`).join("");
  return rows ? `<h2>Nutrition per ${per(p)}${p.basisSource === "assumed" ? " (unit assumed)" : ""}</h2><table><tbody>${rows}</tbody></table>` : "";
}
function allergenLines(p) {
  const r = reconcileAllergens(p), list2 = (keys) => keys.map((k) => escapeHTML(r.label(k))).join(", ");
  const lines = [r.declared.length ? `<li>Listed by the source: ${list2(r.declared)}</li>` : "", r.gaps.length ? `<li>Found in the ingredient text but not listed: ${list2(r.gaps)}</li>` : "", r.traces.length ? `<li>May contain traces: ${list2(r.traces)}</li>` : ""].join("");
  if (r.unknown) return "<h2>Allergens</h2><p>This record has no ingredient list, so allergens are unknown, not absent. Always read the pack.</p>";
  return `<h2>Allergens</h2>${lines ? `<ul>${lines}</ul>` : "<p>None listed and none found in the ingredient text. That is not a guarantee: always read the pack.</p>"}`;
}
function related(p, code) {
  const fam = p ? productFamily(p) : "", others = INDEXABLE.filter((x) => x.code.padStart(14, "0") !== String(code).padStart(14, "0"));
  const pick2 = [...others.filter((x) => fam && x.family === fam), ...others.filter((x) => !fam || x.family !== fam)].slice(0, 6);
  return pick2.length ? `<h2>More products explained</h2><ul>${pick2.map((x) => `<li><a href="/p/${x.code}">${escapeHTML(x.name)}${x.brand ? ` (${escapeHTML(x.brand)})` : ""}</a></li>`).join("")}</ul>` : "";
}
function retag(shell, { origin, path, title, description, image, robots, ld }) {
  const page = `${origin}${path}`;
  shell = shell.replaceAll("https://food-scan.gearuptofit.com", origin).replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${escapeHTML(page)}">`).replace(/<title>[^<]*<\/title>/, `<title>${escapeHTML(title)}</title>`).replace(/<meta name="robots" content="[^"]*">/, `<meta name="robots" content="${robots}">`);
  for (const key of ["description", "twitter:description", "og:description"]) shell = shell.replace(new RegExp(`<meta (?:name|property)="${key}" content="[^"]*">`), `<meta ${key.startsWith("og:") ? "property" : "name"}="${key}" content="${escapeHTML(description)}">`);
  for (const key of ["twitter:title", "og:title"]) shell = shell.replace(new RegExp(`<meta (?:name|property)="${key}" content="[^"]*">`), `<meta ${key.startsWith("og:") ? "property" : "name"}="${key}" content="${escapeHTML(title)}">`);
  shell = shell.replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${escapeHTML(page)}">`);
  if (image) shell = shell.replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${escapeHTML(image)}">`).replace(/<meta name="twitter:image" content="[^"]*">/, `<meta name="twitter:image" content="${escapeHTML(image)}">`).replace(/<meta property="og:image:(?:width|height)"[^>]*>\s*/g, "");
  return shell.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`);
}
var photo = (raw, origin) => /^https:\/\/(?:images|static)\.openfoodfacts\.org\//.test(raw?.image_front_url || "") ? raw.image_front_url : `${origin}/og.png`;
function productDocument(shell, raw, { origin, code, indexable }) {
  const path = `/p/${code}`, p = parsed(raw, code);
  if (!p) {
    const title2 = `Product ${code} | FoodScan`;
    return retag(shell, { origin, path, title: title2, description: "This food record could not be loaded. Search or scan again in FoodScan.", image: `${origin}/og.png`, robots: "noindex, follow", ld: { "@context": "https://schema.org", "@type": "WebPage", name: title2, url: origin + path } }).replace(/<!--boot-->[\s\S]*?<!--\/boot-->/, `<!--boot--><div class="boot"><h1>Product ${escapeHTML(code)}</h1><p>This food record could not be loaded right now. Your saved foods still open in the app.</p><p><a href="/#/scan">Scan a barcode</a> · <a href="/how/">Method and limitations</a></p><p class="boot__load">Loading FoodScan…</p></div><!--/boot-->`);
  }
  const a = assessGrade(p), published = a.status === "reported" ? a.grade : null, image = photo(raw, origin);
  const title = `${p.name}${published ? `: source-reported Nutri-Score ${published}` : ""} | FoodScan`, description = describe(p, a);
  const brand = String(p.brand || "").split(",")[0].trim(), q = dataQuality(p), ing = excerpt(p.ingredients, 2e3);
  const ld = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    [gtinKey(code)]: code,
    image,
    description,
    url: origin + path,
    ...brand ? { brand: { "@type": "Brand", name: plain(brand, 80) } } : {},
    ...published ? { additionalProperty: [{ "@type": "PropertyValue", name: a.method === "2023" ? "Nutri-Score (source-reported, 2023 method)" : "Nutri-Score (source-reported, method not stated)", value: published }, ...Number.isFinite(a.score) ? [{ "@type": "PropertyValue", name: "Nutri-Score points", value: a.score }] : []] } : {}
  };
  const why = (a.anatomy?.why || []).filter((w) => w.tone !== "note").slice(0, 3).map((w) => `<li>${escapeHTML(w.text)}</li>`).join("");
  const body = `<div class="boot"><p class="eyebrow">${brand ? `${escapeHTML(brand)} · ` : ""}Barcode ${escapeHTML(code)}${p.quantity ? ` · ${escapeHTML(p.quantity)}` : ""}</p><h1>${escapeHTML(p.name)}</h1>
<p>${escapeHTML(gradeSentence(p, a))}</p>${why ? `<ul>${why}</ul>` : ""}
${factsTable(p)}${p.nova ? `<p>Processing: NOVA group ${p.nova} of 4, as reported.</p>` : ""}
${allergenLines(p)}
${ing.text ? `<h2>Ingredients as recorded</h2><p>${escapeHTML(ing.text)}</p>${ing.cut ? "<p>The ingredient list is longer than shown here; the full text is in the app and on the source record.</p>" : ""}` : "<h2>Ingredients</h2><p>No ingredient list in this record.</p>"}
<h2>Source and checks</h2><p>Data: Open Food Facts contributors (Open Database Licence), not laboratory-verified. Record last edited: ${p.sourceModified ? new Date(p.sourceModified).toISOString().slice(0, 10) : "unknown"}. ${fieldCount(p)} of 8 label values reported. Data check: ${escapeHTML(q.short)}.</p>
<p><a href="${ORIGIN}/product/${code}" rel="noopener noreferrer">View the source record</a> · <a href="/how/">Method and limitations</a> · <a href="/#/scan">Scan your own food</a></p>
${related(p, code)}${GUIDES}<p class="boot__load">Loading the interactive report…</p></div>`;
  return retag(shell, { origin, path, title, description, image, robots: indexable ? "index, follow, max-image-preview:large" : "noindex, follow", ld }).replace(/<!--boot-->[\s\S]*?<!--\/boot-->/, `<!--boot-->${body}<!--/boot-->`);
}
async function recordFor(request, env, ctx, code) {
  let out;
  try {
    const result = await productResponse(request, env, ctx, code), cache = result.headers.get("X-FoodScan-Cache") || "";
    out = { status: result.status === 404 ? 404 : result.status === 200 ? 200 : 503, raw: result.ok ? (await result.json()).product : null, cache };
  } catch {
    out = { status: 503, raw: null, cache: "" };
  }
  // 62.0: when the upstream food database is busy, a shared link still opens with the bundled, dated catalogue record (never indexed).
  if (out.status === 503) {
    try {
      const local = await fs60LocalProduct(request, env, code);
      const product = local?.ok ? (await local.json())?.product : null;
      if (product) return { status: 200, raw: product, cache: "DATED-CATALOGUE" };
    } catch { /* keep the 503 */ }
  }
  return out;
}
var shellFor = async (env, url) => (await env.ASSETS.fetch(new Request(`${url.origin}/`, { headers: { Accept: "text/html" } }))).text();
async function productPage(request, env, ctx, code) {
  const url = new URL(request.url), origin = siteOrigin(url, env);
  const [shell, rec] = await Promise.all([shellFor(env, url), recordFor(request, env, ctx, code)]);
  const p = parsed(rec.raw, code), indexable = rec.status === 200 && env.INDEX_PRODUCT_PAGES !== "0" && !preview(url, env) && rec.cache !== "STALE" && rec.cache !== "DATED-CATALOGUE" && indexWorthy(p).index;
  let html = productDocument(shell, rec.raw, { origin, code, indexable });
  // Preserve legacy /p/ share links while consolidating an already-approved public catalog page.
  if (indexable && FSC_ENABLED(env)) {
    try {
      const publicCode = fscCanon(code), catalogRow = publicCode ? await fscGetRow(env,publicCode) : null;
      if (catalogRow) {
        const primary = `${origin}/products/${publicCode}`;
        html = html.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${escapeHTML(primary)}">`);
        html = html.replace(`"url":"${origin}/p/${code}"`, `"url":"${primary}"`);
      }
    } catch (e) { console.warn('public canonical lookup:',String(e?.message||'').slice(0,80)); }
  }
  return secureHtml(html, url, env, rec.status, { "Cache-Control": "no-store", ...rec.cache ? { "X-FoodScan-Cache": rec.cache } : {}, ...!indexable ? { "X-Robots-Tag": "noindex, follow" } : {}, ...rec.status === 503 ? { "Retry-After": "60" } : {} }, request.cf?.country);
}
function compareDocument(shell, rawA, rawB, { origin, a, b }) {
  const path = `/compare/${a}/${b}`, pa = parsed(rawA, a), pb = parsed(rawB, b);
  if (!pa || !pb) {
    const title2 = "Product comparison | FoodScan";
    return retag(shell, { origin, path, title: title2, description: "Two food products side by side in FoodScan.", image: `${origin}/og.png`, robots: "noindex, follow", ld: { "@context": "https://schema.org", "@type": "WebPage", name: title2, url: origin + path } }).replace(/<!--boot-->[\s\S]*?<!--\/boot-->/, `<!--boot--><div class="boot"><h1>Product comparison</h1><p>One of these records could not be loaded right now.</p><p><a href="/p/${a}">Product ${a}</a> · <a href="/p/${b}">Product ${b}</a></p><p class="boot__load">Loading FoodScan…</p></div><!--/boot-->`);
  }
  const v = versus(pa, pb), line = versusLine(v, t), shown = (c) => c.status === "reported" ? c.grade : null;
  const title = `${pa.name} vs ${pb.name}${shown(v.left) && shown(v.right) ? `: Nutri-Score ${v.left.grade} vs ${v.right.grade}` : ""} | FoodScan`;
  const adv = (c, list2) => list2.map((d) => `${d.key === "fiber" || d.key === "protein" ? "more" : "less"} ${d.key === "saturatedFat" ? "saturated fat" : d.key === "fiber" ? "fibre" : d.key} (${num(d.mine)} g vs ${num(d.other)} g per ${d.unit})`).join(", ");
  const parts = [v.better.a.length ? `${pa.name}: ${adv(v.left, v.better.a)}` : "", v.better.b.length ? `${pb.name}: ${adv(v.right, v.better.b)}` : ""].filter(Boolean);
  const description = plain(`${line} ${parts.length ? `Measured differences: ${parts.join("; ")}.` : ""}`, 300);
  const col = (p, c) => `<li><a href="/p/${p.barcode}">${escapeHTML(p.name)}</a>: ${escapeHTML(gradeSentence(p, assessGrade(p)))}</li>`;
  const body = `<div class="boot"><p class="eyebrow">Side by side</p><h1>${escapeHTML(pa.name)} vs ${escapeHTML(pb.name)}</h1><p>${escapeHTML(line)}</p><ul>${col(pa, v.left)}${col(pb, v.right)}</ul>
${parts.length ? `<h2>Measured differences</h2><ul>${parts.map((x) => `<li>${escapeHTML(x)}</li>`).join("")}</ul>` : ""}${!v.sameUnit ? "<p>The two records use different units (per 100 g and per 100 ml), so no nutrient is compared.</p>" : ""}
<p><a href="/#/scan">Scan and compare your own</a> · <a href="/how/">Method and limitations</a></p><p class="boot__load">Loading the comparison…</p></div>`;
  return retag(shell, { origin, path, title, description, image: photo(rawA, origin), robots: "noindex, follow", ld: { "@context": "https://schema.org", "@type": "WebPage", name: title, url: origin + path, description, about: [pa, pb].map((p) => ({ "@type": "Product", name: p.name, [gtinKey(p.barcode)]: p.barcode, url: `${origin}/p/${p.barcode}` })) } }).replace(/<!--boot-->[\s\S]*?<!--\/boot-->/, `<!--boot-->${body}<!--/boot-->`);
}
async function comparePage(request, env, ctx, a, b) {
  const url = new URL(request.url), origin = siteOrigin(url, env);
  const [shell, ra, rb] = await Promise.all([shellFor(env, url), recordFor(request, env, ctx, a), recordFor(request, env, ctx, b)]);
  const status = ra.status === 404 || rb.status === 404 ? 404 : ra.status === 200 && rb.status === 200 ? 200 : 503;
  return secureHtml(compareDocument(shell, ra.raw, rb.raw, { origin, a, b }), url, env, status, { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, follow", ...status === 503 ? { "Retry-After": "60" } : {} }, request.cf?.country);
}
var budget = { product: [], search: [], index: [] };
var fairness = /* @__PURE__ */ new Map();
var MAX_PENDING = 64;
var PRODUCT_MINUTE = 12;
var SEARCH_MINUTE = 8;
var INDEX_MINUTE = 60;
var deepPending = null;
async function boundedRequest(request, maximum) {
  if (Number(request.headers.get("Content-Length")) > maximum) throw new Error("size");
  const reader = request.body?.getReader();
  if (!reader) return "";
  let size = 0, text2 = "", decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) {
        await reader.cancel();
        throw new Error("size");
      }
      text2 += decoder.decode(value, { stream: true });
    }
    return text2 + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
function siteOrigin(url, env) {
  try {
    const u = new URL(env.PUBLIC_ORIGIN);
    if (u.protocol === "https:" && !u.username && !u.password && !u.port && u.pathname === "/" && !u.search && !u.hash) return u.origin;
  } catch {
  }
  return SITE || url.origin;
}
function preview(url, env) {
  return env.NOINDEX === "1" || url.hostname.endsWith(".pages.dev") || env.PUBLIC_ORIGIN && siteOrigin(url, env) !== url.origin;
}
async function secureHtml(html, url, env, status = 200, extra = {}, country = "") {
  const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  const hashes = await Promise.all(scripts.map(async (m) => {
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(m[1])));
    return `'sha256-${btoa(String.fromCharCode(...digest))}'`;
  }));
  const csp = CSP.replace("script-src 'self'", `script-src 'self'${hashes.length ? " " + hashes.join(" ") : ""}`);
  if (preview(url, env)) html = html.replace(/<meta name="robots" content="[^"]*">/, '<meta name="robots" content="noindex, follow">');
  const where = String(country || "").toUpperCase();
  if (/^[A-Z]{2}$/.test(where)) html = html.replace("</head>", `<meta name="fs-country" content="${where}">
</head>`);
  return new Response(html, { status, headers: pageHeaders(url, { "Content-Security-Policy": csp, ...(where?{"Cache-Control":"private, no-cache, must-revalidate"}:{}), ...preview(url, env) ? { "X-Robots-Tag": "noindex, follow" } : {}, ...extra }) });
}
async function siteDocument(request, env) {
  const url = new URL(request.url), origin = siteOrigin(url, env);
  let asset = await env.ASSETS.fetch(new Request(url.href, { method: "GET", headers: { Accept: "text/html" } }));
  let text2 = await asset.text();
  text2 = text2.replaceAll("https://food-scan.gearuptofit.com", origin);
  if (url.pathname === '/sitemap.xml' && FSC_ENABLED(env) && !preview(url,env))
    text2 = text2.replace('</sitemapindex>', `<sitemap><loc>${origin}/sitemap-catalog.xml</loc></sitemap></sitemapindex>`);
  const type = asset.headers.get("Content-Type") || "";
  if (type.includes("text/html") || /(?:\/|\.html)$/.test(url.pathname)) return secureHtml(text2, url, env, asset.status, {}, request.cf?.country);
  if (url.pathname === "/robots.txt") text2 = `${preview(url, env) ? "User-agent: *\nDisallow: /\n" : "User-agent: *\nAllow: /\nDisallow: /api/\n"}Sitemap: ${origin}/sitemap.xml
`;
  const headers = new Headers(asset.headers);
  headers.set("X-FoodScan-Version", VERSION);
  headers.set("Cache-Control", "public, max-age=300, must-revalidate");
  if (preview(url, env)) headers.set("X-Robots-Tag", "noindex, follow");
  return new Response(text2, { status: asset.status, headers });
}
var FS_NUTRIENTS = /* @__PURE__ */ new Set([
  "energy-kcal",
  "energy-kj",
  "energy",
  "fat",
  "saturated-fat",
  "carbohydrates",
  "sugars",
  "proteins",
  "fiber",
  "salt",
  "sodium",
  "added-sugars",
  "fruits-vegetables-legumes-estimate-from-ingredients",
  "fruits-vegetables-legumes"
]);
var FS_TAG_LIMITS = Object.freeze({
  categories_tags: 40,
  countries_tags: 32,
  allergens_tags: 100,
  traces_tags: 100,
  labels_tags: 100,
  ingredients_analysis_tags: 100,
  additives_tags: 60,
  data_quality_errors_tags: 100
});
function fsCompactNutrients(n) {
  if (!n || typeof n !== "object" || Array.isArray(n)) return {};
  const out = {};
  for (const [key, value] of Object.entries(n)) {
    const suffix = key.endsWith("_100g") ? "_100g" : key.endsWith("_serving") ? "_serving" : null;
    if (!suffix || !FS_NUTRIENTS.has(key.slice(0, -suffix.length))) continue;
    if (typeof value === "number" && Number.isFinite(value) || typeof value === "string" && value.length <= 60) out[key] = value;
    else if (typeof value === "number") out[key] = "NaN";
  }
  return out;
}
function fsCompactNutriscore(value) {
  const current = value?.["2023"];
  if (!current || typeof current !== "object") return void 0;
  const d = current.data || {};
  const part = (list2) => (Array.isArray(list2) ? list2 : []).slice(0, 15).map((x) => ({
    id: String(x?.id || "").slice(0, 50),
    points: typeof x?.points === "number" && Number.isFinite(x.points) ? x.points : null,
    points_max: typeof (x?.points_max ?? x?.max) === "number" && Number.isFinite(x.points_max ?? x.max) ? x.points_max ?? x.max : null,
    value: typeof x?.value === "number" && Number.isFinite(x.value) ? x.value : null,
    unit: String(x?.unit || "").slice(0, 10)
  })).filter((x) => x.id && x.points !== null && x.points_max !== null);
  return { "2023": {
    grade: String(current.grade || "").slice(0, 1),
    score: typeof current.score === "number" && Number.isFinite(current.score) ? current.score : null,
    category_available: current.category_available === 1 ? 1 : 0,
    data: {
      negative: part(d.negative ?? d.components?.negative),
      positive: part(d.positive ?? d.components?.positive),
      negative_points: typeof d.negative_points === "number" && Number.isFinite(d.negative_points) ? d.negative_points : null,
      positive_points: typeof d.positive_points === "number" && Number.isFinite(d.positive_points) ? d.positive_points : null,
      count_proteins: d.count_proteins === 1 ? 1 : 0,
      count_proteins_reason: String(d.count_proteins_reason || "").slice(0, 80),
      is_beverage: d.is_beverage === 1 ? 1 : 0,
      is_cheese: d.is_cheese === 1 ? 1 : 0,
      is_fat_oil_nuts_seeds: d.is_fat_oil_nuts_seeds === 1 ? 1 : 0,
      is_red_meat_product: d.is_red_meat_product === 1 ? 1 : 0,
      is_water: d.is_water === 1 ? 1 : 0
    }
  } };
}
function compactFoodRecord(raw) {
  const p = { ...raw };
  const localeFields = ["fr", "el", "de", "it", "es", "pt", "nl"].map((lang) => `ingredients_text_${lang}`);
  if (!String(p.ingredients_text || p.ingredients_text_en || "").trim()) {
    const pref = /^[a-z]{2}$/.test(String(p.lang || "")) ? `ingredients_text_${p.lang}` : null;
    const fallback = [pref, ...localeFields].filter(Boolean).find((key) => typeof p[key] === "string" && p[key].trim().length > 1);
    if (fallback) p.ingredients_text = p[fallback].trim().slice(0, 14e3);
  }
  for (const key of localeFields) delete p[key];
  p.nutriments = fsCompactNutrients(raw.nutriments);
  if (raw.nutriscore) {
    p.nutriscore = fsCompactNutriscore(raw.nutriscore);
    if (!p.nutriscore) delete p.nutriscore;
  }
  for (const [key, max] of Object.entries(FS_TAG_LIMITS)) if (Array.isArray(p[key])) {
    const valid = p[key].filter((x) => typeof x === "string" && x.length <= 160);
    const severe = key === "data_quality_errors_tags" ? valid.filter((x) => /nutrition.*(energy-value-in-kcal-does-not-match-value-in-kj|energy-value-in-kj-does-not-match-value-in-kcal|100g-.*greater-than-100|values-are-all-identical)/i.test(x)).slice(0, 20) : [];
    p[key] = [.../* @__PURE__ */ new Set([...severe, ...valid.slice(0, max)])].slice(0, max);
  }
  for (const name of ["ingredients_text", "ingredients_text_en"]) if (typeof p[name] === "string" && p[name].length > 14e3) p[name] = p[name].slice(0, 14e3);
  for (const key of Object.keys(p)) if (/^product_name|^generic_name|^abbreviated_product_name/.test(key) && typeof p[key] === "string" && p[key].length > 240) p[key] = p[key].slice(0, 240);
  return p;
}
function hasIngredientEvidence(value) {
  if (typeof value !== "string") return false;
  const text2 = value.trim();
  if (text2.length < 2 || !/[\p{L}]/u.test(text2)) return false;
  if (/^(?:unknown|n\/?a|not (?:available|provided|specified|listed|known)|none|unspecified|no ingredients? (?:data|listed|available)|inconnu|indisponible|nicht angegeben|desconocido|no disponible)[.!\s]*$/iu.test(text2)) return false;
  return true;
}
var IDX_STALE_MS = 86400000; // Older snapshots remain offline-readable, not current recommendation evidence.
var IDX_REFRESH_AFTER_MS = 20 * 3600000;
var IDX_REFRESH_RETRY_MS = 6 * 3600 * 1e3;
var IDX_CATEGORY_SIZE = 64;
var IDX_CATEGORY_RANK_POOL = 160;
var IDX_ALTERNATIVES_LIMIT = 36;
var IDX_SEARCH_LIMIT = 20;
var IDX_ALTERNATIVES_MAX_BYTES = 36e4;
var IDX_SEARCH_MAX_BYTES = 24e4;
var IDX_CATEGORY_READ_BUDGET = 6e5;
var IDX_SEARCH_READ_BUDGET = 48e4;
var idxReplicaBackoff = /* @__PURE__ */ new WeakMap();
var idxReadDB = (env) => env?.FOODSCAN_D1_READ_REPLICAS === "1" && env?.FOODSCAN_D1_DISCOVERY_REPLICAS === "1" && typeof env?.FOOD_DB?.withSession === "function" && (idxReplicaBackoff.get(env.FOOD_DB) || 0) <= Date.now() ? env.FOOD_DB.withSession("first-unconstrained") : env.FOOD_DB;
var IDX_SOURCE = "Open Food Facts";
var idxEnabled = (env) => Boolean(env?.FOOD_DB && env?.FOODSCAN_INDEX_READS !== "0");
var idxRequired = (env) => env?.FOODSCAN_REQUIRE_INDEX === "1";
var idxLiveFallback = (env) => !idxRequired(env) && env?.FOODSCAN_ALLOW_LIVE_SEARCH !== "0";
var idxGTIN = (code) => String(code || "").padStart(14, "0");
var idxLog = (kind, err) => console.warn(JSON.stringify({ app: "FoodScan", version: VERSION, component: "index", kind, error: String(err?.message || err || "unknown").slice(0, 110) }));
var idxRequiredError = (env) => idxRequired(env) && !idxEnabled(env) ? error("index_unavailable", "Product catalogue is temporarily unavailable. Saved products remain accessible offline.", 503, {}, { "Retry-After": "30" }) : null;
function idxFromRow(row) {
  if (!row || typeof row.raw_json !== "string") return null;
  try {
    const raw = JSON.parse(row.raw_json);
    const parsed2 = parseProduct({ status: 1, product: raw, fetchedAt: Number(row.verified_at) || Date.now() }, String(row.barcode));
    if (!parsed2 || !equivalent(parsed2.barcode, row.barcode)) return null;
    return { raw, parsed: parsed2, fetchedAt: Number(row.verified_at) || 0 };
  } catch {
    return null;
  }
}
function idxResponse(record) {
  const stale = !record.fetchedAt || Date.now() - record.fetchedAt > IDX_STALE_MS;
  return withCache(
    json({
      status: "success",
      product: record.raw,
      fetchedAt: record.fetchedAt,
      source: IDX_SOURCE,
      version: 2,
      connection: { version: VERSION, endpoint: "foodscan-d1" }
    }),
    stale ? "STALE" : "INDEX",
    { "X-FoodScan-Provider": "D1", "X-FoodScan-Data-Age": stale ? "stale" : "indexed" }
  );
}
async function idxReadWithPrimary(env, reader, { retryEmpty = false } = {}) {
  const replica = idxReadDB(env), primary = env.FOOD_DB;
  if (replica === primary) return await reader(primary);
  try {
    const result = await reader(replica);
    if (!retryEmpty || (Array.isArray(result) ? result.length > 0 : Boolean(result))) return result;
  } catch (e) {
    idxReplicaBackoff.set(primary, Date.now() + 3e4);
    idxLog("replica_read_fallback", e);
  }
  return await reader(primary);
}
async function idxGetProduct(env, code) {
  if (!idxEnabled(env)) return null;
  try {
    const query = "SELECT barcode,raw_json,verified_at FROM products WHERE gtin14=?";
    const read = async (db) => {
      const row2 = await db.prepare(query).bind(idxGTIN(code)).first();
      if (row2 && !idxFromRow(row2)) throw Error("invalid_index_row");
      return row2;
    };
    const row = await read(env.FOOD_DB);
    const record = idxFromRow(row);
    return record ? { response: idxResponse(record), verifiedAt: record.fetchedAt, stale: !record.fetchedAt || Date.now() - record.fetchedAt > IDX_STALE_MS } : null;
  } catch (e) {
    idxLog("product_read", e);
    return { error: true };
  }
}
async function idxIsNegative(env, code) {
  if (!idxEnabled(env)) return false;
  try {
    return !!await env.FOOD_DB.prepare("SELECT 1 AS hit FROM negative_lookups WHERE gtin14=? AND expires_at>?").bind(idxGTIN(code), Date.now()).first();
  } catch (e) {
    idxLog("negative_read", e);
    return false;
  }
}
async function idxMarkNegative(env, code) {
  if (!idxEnabled(env)) return;
  try {
    await env.FOOD_DB.prepare("INSERT INTO negative_lookups(gtin14,expires_at,reason) VALUES(?,?,'not_found') ON CONFLICT(gtin14) DO UPDATE SET expires_at=excluded.expires_at").bind(idxGTIN(code), Date.now() + 6 * 3600 * 1e3).run();
  } catch (e) {
    idxLog("negative_write", e);
  }
}
async function idxReserveUpstream(env, kind) {
  if (!idxEnabled(env)) return null;
  const now = Date.now(), gap = kind === "product" ? 5500 : 8e3;
  try {
    const allowed = await env.FOOD_DB.prepare("UPDATE upstream_budget SET next_allowed_ms=? WHERE kind=? AND next_allowed_ms<=? RETURNING next_allowed_ms").bind(now + gap, kind, now).first();
    if (allowed) return null;
    let next = await env.FOOD_DB.prepare("SELECT next_allowed_ms FROM upstream_budget WHERE kind=?").bind(kind).first();
    if (!next) {
      const seeded = await env.FOOD_DB.prepare("INSERT INTO upstream_budget(kind,next_allowed_ms) VALUES(?,?) ON CONFLICT(kind) DO NOTHING RETURNING next_allowed_ms").bind(kind, now + gap).first();
      if (seeded) return null;
      next = await env.FOOD_DB.prepare("SELECT next_allowed_ms FROM upstream_budget WHERE kind=?").bind(kind).first();
    }
    return { code: "local_rate_limited", wait: next ? Math.min(60, Math.max(1, Math.ceil((Number(next.next_allowed_ms) - now) / 1e3))) : 30 };
  } catch (e) {
    idxLog("upstream_budget", e);
    return { code: "local_rate_limited", wait: 30 };
  }
}
async function idxApplyUpstreamCooldown(env, kind, seconds) {
  if (!idxEnabled(env)) return;
  const delay = Math.min(86400, Math.max(10, Math.ceil(Number(seconds) || 60)));
  try {
    await env.FOOD_DB.prepare("UPDATE upstream_budget SET next_allowed_ms=MAX(next_allowed_ms,?) WHERE kind=?").bind(Date.now() + delay * 1e3, kind).run();
  } catch (e) {
    idxLog("upstream_cooldown", e);
  }
}
function idxFields(raw, code) {
  const product = Object.fromEntries(FIELDS.split(",").filter((k) => Object.hasOwn(raw, k)).map((k) => [k, raw[k]]));
  product.code = code;
  const tags2 = (x, max) => Array.isArray(x) ? [...new Set(x.filter((t2) => typeof t2 === "string" && /^[a-z]{2}:[a-z0-9-]{2,106}$/.test(t2)).slice(0, max))] : [];
  product.categories_tags = tags2(product.categories_tags, 40);
  product.countries_tags = tags2(product.countries_tags, 32);
  return compactFoodRecord(product);
}
async function idxDigest(value) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return [...bytes].map((x) => x.toString(16).padStart(2, "0")).join("");
}
async function idxSaveProduct(env, response, code) {
  if (!idxEnabled(env) || response.status !== 200) return;
  try {
    const payload = await response.clone().json(), raw = payload?.product;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
    const product = idxFields(raw, code), verifiedAt = Date.now();
    const parsed2 = parseProduct({ status: 1, product, fetchedAt: verifiedAt }, code);
    if (!parsed2 || !equivalent(parsed2.barcode, code)) return;
    const gradeResult = assessGrade(parsed2, { estimate: false });
    const sourceGrade = String(product.nutriscore_grade || product.nutrition_grades || "").trim().toUpperCase();
    const currentGrade = String(product.nutriscore?.["2023"]?.grade || "").trim().toUpperCase();
    const conflictingGrade = /^[A-E]$/.test(sourceGrade) && /^[A-E]$/.test(currentGrade) && sourceGrade !== currentGrade;
    const grade = !conflictingGrade && gradeResult.status === "reported" ? gradeResult.grade : null;
    const nutrients = fieldCount(parsed2), nameMissing = parsed2.nameMissing;
    const qualityOk = Number(!!(grade && !nameMissing && nutrients >= 6 && hasIngredientEvidence(parsed2.ingredients) && parsed2.categories.length && dataQuality(parsed2).state === "usable"));
    const score = Math.min(100, nutrients * 8 + (nameMissing ? 0 : 12) + (grade ? 10 : 0) + (hasIngredientEvidence(parsed2.ingredients) ? 10 : 0) + (parsed2.categories.length ? 4 : 0));
    const sourceModified = Math.max(0, Math.floor((parsed2.sourceModified || 0) / 1e3));
    const jsonText = JSON.stringify(product), rawBytes = new TextEncoder().encode(jsonText).length;
    if (rawBytes > 55e3) return;
    const name = String(product.product_name || product.product_name_en || product.product_name_el || parsed2.name || "").slice(0, 240);
    const normalize = (s) => String(s).normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, " ").replace(/\s+/g, " ").trim().slice(0, 240);
    const brand = String(product.brands || "").slice(0, 200);
    const digest = await idxDigest(jsonText);
    await env.FOOD_DB.prepare(`INSERT INTO products(gtin14,barcode,name,name_norm,brand_norm,raw_json,grade,grade_rank,quality_ok,quality_score,source_modified_at,verified_at,digest,raw_bytes)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(gtin14) DO UPDATE SET
      barcode=excluded.barcode,name=excluded.name,name_norm=excluded.name_norm,brand_norm=excluded.brand_norm,raw_json=excluded.raw_json,
      grade=excluded.grade,grade_rank=excluded.grade_rank,quality_ok=excluded.quality_ok,quality_score=excluded.quality_score,
      source_modified_at=excluded.source_modified_at,verified_at=excluded.verified_at,digest=excluded.digest,raw_bytes=excluded.raw_bytes
      WHERE COALESCE(excluded.source_modified_at,0)>COALESCE(products.source_modified_at,0)
        OR (COALESCE(excluded.source_modified_at,0)=COALESCE(products.source_modified_at,0)
            AND (excluded.digest!=products.digest OR products.verified_at<excluded.verified_at-3600000))`).bind(
      idxGTIN(code),
      code,
      name,
      normalize(name),
      normalize(brand),
      jsonText,
      grade,
      grade ? "ABCDE".indexOf(grade) : 5,
      qualityOk,
      score,
      sourceModified,
      verifiedAt,
      digest,
      rawBytes
    ).run();
  } catch (e) {
    idxLog("write_through", e);
  }
}
function idxRefreshStale(request, env, ctx, code, verifiedAt) {
  if (!idxEnabled(env) || env.FOODSCAN_BACKGROUND_REFRESH !== "1" || !ctx?.waitUntil || !verifiedAt || Date.now() - verifiedAt < IDX_REFRESH_AFTER_MS) return;
  ctx.waitUntil((async () => {
    try {
      const now = Date.now();
      const claim = await env.FOOD_DB.prepare(`INSERT INTO refresh_claims(gtin14,claimed_at,next_retry_ms)
         VALUES(?,?,?) ON CONFLICT(gtin14) DO UPDATE SET claimed_at=excluded.claimed_at,next_retry_ms=excluded.next_retry_ms
         WHERE refresh_claims.next_retry_ms<=excluded.claimed_at RETURNING gtin14`).bind(idxGTIN(code), now, now + IDX_REFRESH_RETRY_MS).first();
      if (!claim) return;
      const result = await fetchProduct(request, env, code.length === 12 ? "0" + code : code);
      if (result.status === 200) await idxSaveProduct(env, result, code);
      else if (result.status === 429 || result.status === 502 || result.status === 503 || result.status === 504) {
        const retry = Number(result.headers.get("Retry-After"));
        const seconds = result.status === 429 ? Math.min(86400, Math.max(35, Number.isFinite(retry) && retry > 0 ? retry + 5 : 65)) : Math.min(86400, Math.max(900, Number.isFinite(retry) && retry > 0 ? retry + 5 : 900));
        await env.FOOD_DB.prepare("UPDATE refresh_claims SET next_retry_ms=? WHERE gtin14=? AND claimed_at=?").bind(Date.now() + seconds * 1e3, idxGTIN(code), now).run();
      } else if (result.status === 404) {
        const detail = await result.clone().json().catch(() => null);
        if (["not_found", "not_food"].includes(detail?.error?.code)) {
          await env.FOOD_DB.prepare("UPDATE refresh_claims SET next_retry_ms=? WHERE gtin14=? AND claimed_at=?").bind(Date.now() + 7 * 86400 * 1e3, idxGTIN(code), now).run();
        }
      }
    } catch (e) {
      idxLog("background_refresh", e);
    }
  })());
}
function idxTextQuery(value) {
  const terms = isoName(value).split(/\s+/).filter((x) => /^[\p{L}\p{N}]{2,}$/u.test(x)).slice(0, 5);
  return terms.length ? terms.map((x) => '"' + x + '"*').join(" AND ") : "";
}
function idxCollect(rows, limit, { allowIncomplete = false, diversifyBrands = false, maxBytes = 3e5, maxAgeMs = Infinity } = {}) {
  const products = [], unique = /* @__PURE__ */ new Set(), times = [], brands = /* @__PURE__ */ new Map();
  let responseBytes = 0, skippedForSize = 0, skippedForAge = 0;
  for (const row of rows) {
    if (!row || typeof row.raw_json !== "string") continue;
    const length = new TextEncoder().encode(row.raw_json).byteLength;
    if (length > maxBytes || responseBytes + length > maxBytes) {
      skippedForSize++;
      continue;
    }
    const item = idxFromRow(row);
    if (!item) continue;
    const key = idxGTIN(item.parsed.barcode);
    if (unique.has(key)) continue;
    if (Number.isFinite(maxAgeMs) && (!item.fetchedAt || Date.now() - item.fetchedAt > maxAgeMs)) {
      skippedForAge++;
      continue;
    }
    const quality = dataQuality(item.parsed);
    if (quality.state === "blocked" || item.parsed.nameMissing) continue;
    if (!allowIncomplete) {
      if (quality.state !== "usable") continue;
      if (assessGrade(item.parsed, { estimate: false }).status !== "reported") continue;
    }
    const brand = String(row.brand_norm || "").trim();
    if (diversifyBrands && brand && (brands.get(brand) || 0) >= 4) continue;
    if (brand) brands.set(brand, (brands.get(brand) || 0) + 1);
    responseBytes += length;
    unique.add(key);
    products.push(item.raw);
    times.push(item.fetchedAt);
    if (products.length >= limit) break;
  }
  return {
    products,
    fetchedAt: times.length ? Math.min(...times) : Date.now(),
    sampled: true,
    responseBytes,
    skippedForSize,
    skippedForAge
  };
}
function idxListResponse(out, metadata, coverage) {
  return withCache(
    json({
      ...metadata,
      products: out.products,
      checked: out.products.length,
      partial: metadata.partial === false ? false : true,
      sampled: true,
      selection: { returned: out.products.length, skippedForSize: out.skippedForSize, skippedForAge: out.skippedForAge },
      provider: "foodscan-d1",
      source: IDX_SOURCE,
      fetchedAt: out.fetchedAt,
      coverage,
      version: VERSION
    }),
    "INDEX",
    { "X-FoodScan-Provider": "D1" }
  );
}
async function idxCachedList(request, ctx, kind, keyPart, ttlSeconds, runner) {
  const url = new URL(request.url);
  const key = new Request(`${url.origin}/api/cache/${CACHE_SCHEMA}/idx/${kind}/${encodeURIComponent(keyPart)}`);
  const cache = globalThis.caches?.default;
  if (cache) {
    try {
      const hit2 = await cache.match(key);
      if (hit2?.ok) return withCache(hit2, "HIT", { "X-FoodScan-Provider": "D1" });
    } catch {
    }
  }
  const pending = inflight.get(key.url);
  if (pending) return (await pending).clone();
  if (inflight.size >= MAX_PENDING) return error(
    "local_rate_limited",
    "Search capacity is temporarily busy. Please try again shortly.",
    429,
    { retryAfter: 5 },
    { "Retry-After": "5" }
  );
  const work = (async () => {
    const result = await runner();
    if (cache && result.status === 200) {
      const headers = new Headers(result.headers);
      headers.set("Cache-Control", `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}`);
      const write = cache.put(key, new Response(result.clone().body, { status: result.status, headers })).catch(() => {
      });
      if (ctx?.waitUntil) ctx.waitUntil(write);
      else await write;
    }
    return result;
  })();
  inflight.set(key.url, work);
  try {
    return (await work).clone();
  } finally {
    inflight.delete(key.url);
  }
}
function idxShortlist(rows, maxCount, maxBytes, { diversifyBrands = false } = {}) {
  const selected = [], brands = /* @__PURE__ */ new Map();
  let bytes = 0;
  for (const row of rows) {
    if (!/^[0-9]{14}$/.test(String(row?.gtin14 || ""))) continue;
    const size = Number(row.raw_bytes) || 55e3;
    if (!Number.isFinite(size) || size < 0 || size > 55e3) continue;
    const brand = String(row.brand_norm || "").trim();
    if (diversifyBrands && brand && (brands.get(brand) || 0) >= 4) continue;
    if (bytes + size > maxBytes) continue;
    selected.push(row.gtin14);
    bytes += size;
    if (brand) brands.set(brand, (brands.get(brand) || 0) + 1);
    if (selected.length >= maxCount) break;
  }
  return selected;
}
async function idxAlternatives(request, env, ctx) {
  const mandatory = idxRequiredError(env);
  if (mandatory) return mandatory;
  if (!idxEnabled(env)) return categorySearch(request, env, ctx);
  const url = new URL(request.url), category = url.searchParams.get("category") || "", country = marketCountry(request), page = marketPage(request);
  if (!/^[a-z]{2}:[a-z0-9][a-z0-9-]{1,100}$/.test(category)) return error("invalid_category", "Choose a category returned by the source record.", 400);
  if (!page) return error("invalid_page", "Page must be from 1 to 50.", 400);
  if (country && !/^[a-z][a-z-]{2,40}$/.test(country)) return error("invalid_country", "Use a source-listed country name.", 400);
  return idxCachedList(request, ctx, "alternatives", category + "|" + country + "|" + page, 180, async () => {
    try {
      const sql = `SELECT c.gtin14,p.brand_norm,COALESCE(NULLIF(p.raw_bytes,0),LENGTH(CAST(p.raw_json AS BLOB))) AS raw_bytes
      FROM product_categories c JOIN products p ON p.gtin14=c.gtin14
      WHERE c.category=? AND c.eligible=1 ${country ? "AND EXISTS (SELECT 1 FROM product_countries ct WHERE ct.gtin14=c.gtin14 AND ct.country=?)" : ""}
      ORDER BY c.grade_rank ASC,c.quality_score DESC,c.gtin14 ASC LIMIT 24 OFFSET ${(page-1)*24}`;
      const args = country ? [category, "en:" + country] : [category];
      let pageHasMore=false;
      const load = async (db) => {
        const ranked = (await db.prepare(sql).bind(...args).all()).results || [];
        pageHasMore=ranked.length===24;
        const selection = idxShortlist(ranked, 24, IDX_CATEGORY_READ_BUDGET, { diversifyBrands: false });
        if (!selection.length) return [];
        const placeholders = selection.map(() => "?").join(",");
        const found = (await db.prepare(`SELECT gtin14,barcode,raw_json,verified_at,brand_norm FROM products WHERE gtin14 IN (${placeholders})`).bind(...selection).all()).results || [];
        const byId = new Map(found.map((r) => [r.gtin14, r]));
        return selection.map((id) => byId.get(id)).filter(Boolean);
      };
      const rows = await load(env.FOOD_DB);
      const out = idxCollect(rows, IDX_ALTERNATIVES_LIMIT, { diversifyBrands: false, maxBytes: IDX_ALTERNATIVES_MAX_BYTES, maxAgeMs: Infinity });
      if (!out.products.length && idxLiveFallback(env)) return categorySearch(request, env, ctx);
      const coverage = out.products.length ? "Country-filtered discovery snapshots. Bulk and older records are hints only; every displayed alternative requires a fresh exact-product check. Not supermarket stock or a complete inventory." : "No eligible indexed discovery hints on this page for this category and country. This does not mean that no better product exists.";
      return idxListResponse(out, { category, country: country || null, page, hasMore: page<50 && pageHasMore }, coverage);
    } catch (e) {
      idxLog("alternatives", e);
      if (idxLiveFallback(env)) return categorySearch(request, env, ctx);
      return error("index_unavailable", "Alternative lookup is temporarily unavailable. Saved products still work.", 503);
    }
  });
}
async function idxSearch(request, env, ctx) {
  const mandatory = idxRequiredError(env);
  if (mandatory) return mandatory;
  if (!idxEnabled(env)) return textSearch(request, env, ctx);
  const query = isoName(new URL(request.url).searchParams.get("q") || "");
  if (query.length < 2) return error("invalid_query", "Type at least 2 letters or digits to search.", 400);
  const possibleBarcode = query.replace(/[\s-]/g, "");
  if (validBarcode2(possibleBarcode)) {
    const found = await productResponse(request, env, ctx, possibleBarcode);
    if (found.status === 200) {
      const payload = await found.json();
      return idxListResponse(
        {
          products: [payload.product],
          fetchedAt: Number.isFinite(payload.fetchedAt) ? payload.fetchedAt : 0,
          skippedForSize: 0,
          skippedForAge: 0
        },
        { query, partial: found.headers.get("X-FoodScan-Cache")==="STALE" },
        "Exact barcode match. Source-reported information is not allergy clearance."
      );
    }
    if (found.status === 404) return idxListResponse(
      {
        products: [],
        fetchedAt: Date.now(),
        skippedForSize: 0,
        skippedForAge: 0
      },
      { query },
      "No product found with that barcode in the available catalogue."
    );
    return found;
  }
  const match = idxTextQuery(query);
  if (!match) return idxListResponse({ products: [], fetchedAt: Date.now(), skippedForSize: 0, skippedForAge: 0 }, { query }, "Try a different product name.");
  return idxCachedList(request, ctx, "search", query, 120, async () => {
    try {
      const load = async (db) => {
        const hits = (await db.prepare(`SELECT p.gtin14,p.brand_norm,COALESCE(NULLIF(p.raw_bytes,0),LENGTH(CAST(p.raw_json AS BLOB))) AS raw_bytes
        FROM product_fts f JOIN products p ON p.rowid=f.rowid WHERE product_fts MATCH ?
        ORDER BY bm25(product_fts),p.quality_ok DESC,p.quality_score DESC LIMIT 48`).bind(match).all()).results || [];
        const selection = idxShortlist(hits, 36, IDX_SEARCH_READ_BUDGET);
        if (!selection.length) return [];
        const found = (await db.prepare(`SELECT gtin14,barcode,raw_json,verified_at,brand_norm FROM products WHERE gtin14 IN (${selection.map(() => "?").join(",")})`).bind(...selection).all()).results || [];
        const byId = new Map(found.map((row) => [row.gtin14, row]));
        return selection.map((id) => byId.get(id)).filter(Boolean);
      };
      const rows = await idxReadWithPrimary(env, load, { retryEmpty: true });
      const out = idxCollect(rows, IDX_SEARCH_LIMIT, { allowIncomplete: true, maxBytes: IDX_SEARCH_MAX_BYTES });
      if (!out.products.length && idxLiveFallback(env)) return textSearch(request, env, ctx);
      return idxListResponse(out, { query }, "Results may include incomplete records. A search match is not evidence of a healthy choice.");
    } catch (e) {
      idxLog("search", e);
      if (idxLiveFallback(env)) return textSearch(request, env, ctx);
      return error("index_unavailable", "Product search is temporarily unavailable. Try a barcode or a saved product.", 503);
    }
  });
}
async function idxDiagnostic(env) {
  if (!idxEnabled(env)) return { bound: Boolean(env?.FOOD_DB), enabled: false, mode: "legacy", seeded: false };
  try {
    const sample = await env.FOOD_DB.prepare("SELECT raw_bytes AS payload_size FROM products LIMIT 1").bind().first();
    const eligible = sample ? await env.FOOD_DB.prepare("SELECT 1 AS present FROM products WHERE quality_ok=1 LIMIT 1").bind().first() : null;
    const ready = !!(sample && eligible);
    return {
      bound: true,
      enabled: true,
      mode: !sample ? "index-empty" : ready ? "index-first" : "index-incomplete",
      seeded: !!sample,
      hasRecommendationCandidates: !!eligible,
      ready,
      schemaVersion: 4,
      globalUpstreamPacing: true,
      replicaSessionsEnabled: env?.FOODSCAN_D1_READ_REPLICAS === "1" && env?.FOODSCAN_D1_DISCOVERY_REPLICAS === "1" && typeof env.FOOD_DB.withSession === "function",
      strongGradeReads: true
    };
  } catch (e) {
    idxLog("diagnostic", e);
    return { bound: true, enabled: true, mode: "index-unavailable", seeded: false, error: "schema_or_database_unavailable" };
  }
}

/* END worker-base.js */

