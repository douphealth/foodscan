// worker/_worker.js
/* FoodScan 79.0.0: ONE release number for the HTML, /api/health, /api/prices/health, the price files, the service worker and the release notes. */
var VERSION = "93.0.0";
var BUILD = "9300-web-prices-ahead";
var CACHE_SCHEMA = "p23-greece-catalogue";
var SITE = "https://food-scan.gearuptofit.com".startsWith("__") ? "" : "https://food-scan.gearuptofit.com";
var VIRAL_EVENTS = /* @__PURE__ */ new Set(["product_share_started", "product_share_handoff", "product_link_copied", "shared_product_opened", "shared_scan_cta_clicked", "shared_scan_completed", "shared_product_reshared", "public_shared_open", "public_shared_scan_cta", "public_shared_report_open", "public_challenge_open", "public_challenge_referral_scan_cta"]);
var EVENT_NAMES = /* @__PURE__ */ new Set(["visit", "scan", "lookup", "alternative", "search", "action", "vitals", "public_product_view", "public_product_share", "public_scorecard_download", "public_scan_cta", "public_battle_view", "public_battle_share", "public_battle_vote", "public_challenge_share", "public_challenge_scan_cta", "public_challenge_saved", ...VIRAL_EVENTS]);
var EVENT_COLUMNS = ["source", "route", "lang", "returning", "method", "outcome", "cache", "via", "kind", "standalone", "referral", "parent"];
var LABEL3 = /^[a-z][a-z0-9_-]{0,23}$/;
var SHARE_TOKEN = /^f[a-z0-9]{11}$/;
var EVENT_ID = /^f[a-z0-9]{15}$/;
var eventBudget = /* @__PURE__ */ new Map();
var seenEvents = /* @__PURE__ */ new Map();
var ORIGIN = "https://world.openfoodfacts.org";
var INDEX_ORIGIN = "https://search.openfoodfacts.org/search";
var FIELDS = "code,product_name,product_name_en,product_name_el,product_name_de,product_name_fr,product_name_it,product_name_es,generic_name,generic_name_en,generic_name_el,abbreviated_product_name,brands,image_front_small_url,image_front_url,image_url,quantity,product_quantity,product_quantity_unit,serving_size,serving_quantity,serving_quantity_unit,nutriments,nutrition_data_per,nutrition_data_prepared_per,nutriscore_grade,nutriscore_score,nutriscore,nutrition_grades,nova_group,ingredients_text,ingredients_text_en,ingredients_text_fr,ingredients_text_el,ingredients_text_de,ingredients_text_it,ingredients_text_es,ingredients_text_pt,ingredients_text_nl,lang,allergens_tags,traces_tags,last_modified_t,labels_tags,ingredients_analysis_tags,categories_tags,countries_tags,additives_n,additives_tags,pnns_groups_1,pnns_groups_2,data_quality_errors_tags,product_type,obsolete";
var INDEX_FIELDS = "nutriscore,nutrition_grades,nutrition_data_per,product_quantity_unit,serving_quantity_unit,ingredients_text_el,lang,data_quality_errors_tags,product_type,obsolete,code,product_name,product_name_en,product_name_el,generic_name,brands,image_front_small_url,image_front_url,quantity,nutriments,nutriscore_grade,nutriscore_score,nova_group,ingredients_text,ingredients_text_en,additives_n,additives_tags,allergens_tags,traces_tags,labels_tags,ingredients_analysis_tags,categories_tags,countries_tags,last_modified_t,unique_scans_n";
var SEARCH_LANGS = "en,fr,de,es,it,el,pt,nl";
var MAX_BODY = 6e5;
var DEADLINE_MS = 8500;
var STALE_SECONDS = 30 * 86400;
var FRESH = { product: 43200, category: 7200, search: 3600 };
var inflight = /* @__PURE__ */ new Map();
var cooldown = { off: 0, index: 0 };
var providerCooldown = 0;
function validBarcode2(code) {
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(code) || /^0+$/.test(code)) return false;
  let sum = 0;
  for (let i = code.length - 2, w = 3; i >= 0; i--, w = 4 - w) sum += Number(code[i]) * w;
  return (10 - sum % 10) % 10 === Number(code.at(-1));
}
var equivalent = (a, b) => validBarcode2(a) && validBarcode2(b) && a.padStart(14, "0") === b.padStart(14, "0");
var json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: {
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-FoodScan-Version": VERSION,
  ...headers
} });
var error = (code, message, status, details = {}, headers = {}) => json({ error: { code, message, ...details }, version: VERSION }, status, headers);
function withCache(response, state, extraHeaders = {}) {
  const headers = new Headers(response.headers);
  headers.set("X-FoodScan-Cache", state);
  headers.set("X-FoodScan-Version", VERSION);
  headers.set("Cache-Control", response.status === 200 && state !== "STALE" ? "public, max-age=60, must-revalidate" : "no-store");
  if (state === "STALE") headers.set("X-FoodScan-Data-Age", "stale");
  headers.delete("Age");
  for (const [key, value] of Object.entries(extraHeaders)) {
    if (value) headers.set(key, value);
    else headers.delete(key);
  }
  return new Response(response.body, { status: response.status, headers });
}
function retrySeconds(value) {
  const seconds = /^\d+$/.test(value || "") ? Number(value) : (Date.parse(value || "") - Date.now()) / 1e3;
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(86400, Math.ceil(seconds)) : 60;
}
function slimNutriscore(raw) {
  const current = raw?.["2023"];
  if (!current || typeof current !== "object") return void 0;
  const d = current.data || {};
  const part = (list2) => (Array.isArray(list2) ? list2 : []).slice(0, 10).map((x) => ({ id: String(x?.id || "").slice(0, 40), points: Number(x?.points), max: Number(x?.points_max ?? x?.max), value: typeof x?.value === "number" ? x.value : null, unit: String(x?.unit || "").slice(0, 8) })).filter((x) => x.id && Number.isFinite(x.points) && Number.isFinite(x.max));
  return { "2023": {
    grade: String(current.grade || "").slice(0, 1),
    score: Number.isFinite(current.score) ? current.score : null,
    category_available: current.category_available === 1 ? 1 : 0,
    data: {
      negative: part(d.negative ?? d.components?.negative),
      positive: part(d.positive ?? d.components?.positive),
      negative_points: Number.isFinite(d.negative_points) ? d.negative_points : null,
      positive_points: Number.isFinite(d.positive_points) ? d.positive_points : null,
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
var contactFor = (env, origin) => typeof env?.CONTACT_EMAIL === "string" && /^[^\s<>()[\]@]+@[^\s<>()[\]@]+\.[^\s<>()[\]@]+$/.test(env.CONTACT_EMAIL) ? env.CONTACT_EMAIL.slice(0, 200) : `${origin}/how/`;
async function remember(cache, ctx, key, staleKey, response, freshSeconds) {
  if (!cache || response.status !== 200) return;
  const copy = (seconds) => {
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", `public, max-age=${seconds}, s-maxage=${seconds}`);
    return new Response(response.clone().body, { status: 200, headers });
  };
  const stale = cache.put(staleKey, copy(STALE_SECONDS)).catch(() => {
  });
  const fresh = cache.put(key, copy(freshSeconds)).catch(() => {
  });
  if (ctx?.waitUntil) {
    ctx.waitUntil(fresh);
    await stale;
  } else await Promise.all([stale, fresh]);
}
async function staleCopy(cache, staleKey) {
  if (!cache) return null;
  try {
    const hit2 = await cache.match(staleKey);
    if (hit2?.status !== 200) return null;
    const headers = new Headers(hit2.headers);
    headers.set("Cache-Control", "no-store");
    headers.set("X-FoodScan-Cache", "STALE");
    return new Response(hit2.body, { status: 200, headers });
  } catch {
    return null;
  }
}
async function reserveRead(ip, env, kind = "product") {
  if (idxEnabled(env)) return await idxReserveUpstream(env, kind);
  const now = Date.now(), list2 = budget[kind];
  while (list2.length && list2[0] <= now - 6e4) list2.shift();
  if (kind === "product" && providerCooldown > now) return { code: "rate_limited", wait: Math.ceil((providerCooldown - now) / 1e3) };
  const maximum = kind === "product" ? PRODUCT_MINUTE : kind === "index" ? INDEX_MINUTE : SEARCH_MINUTE;
  if (list2.length >= maximum) return { code: "local_rate_limited", wait: Math.max(1, Math.ceil((list2[0] + 6e4 - now) / 1e3)) };
  const userKey = `${kind}:${ip}`, entry = fairness.get(userKey) || [];
  const hits = entry.filter((t2) => t2 > now - 6e4);
  if (hits.length >= (kind === "product" ? 60 : 45)) return { code: "local_rate_limited", wait: Math.max(1, Math.ceil((hits[0] + 6e4 - now) / 1e3)) };
  if (fairness.size > 2048) {
    for (const [key, times] of fairness) if (!times.length || times.at(-1) <= now - 6e4) fairness.delete(key);
  }
  if (fairness.size > 4096 && !fairness.has(userKey)) return { code: "local_rate_limited", wait: 30 };
  hits.push(now);
  fairness.set(userKey, hits);
  list2.push(now);
  if (env?.UPSTREAM_RATE_LIMITER?.limit) {
    try {
      const out = await env.UPSTREAM_RATE_LIMITER.limit({ key: `open-food-facts:${kind}` });
      if (!out.success) return { code: "local_rate_limited", wait: 60 };
    } catch {
      return { code: "local_rate_limited", wait: 60 };
    }
  }
  return null;
}
function approvedURL(value, base, code) {
  try {
    const u = new URL(value, base);
    if (u.protocol !== "https:" || u.username || u.password || u.port) return null;
    if (!/^(?:world(?:-[a-z]{2})?|[a-z]{2}(?:-[a-z]{2})?|(?:ssl-)?api)\.openfoodfacts\.org$/.test(u.hostname)) return null;
    const match = u.pathname.match(/^\/api\/v(?:2|3(?:\.\d+)?)\/product\/(\d+)(?:\.json)?$/);
    if (!match || !equivalent(match[1], code)) return null;
    u.hash = "";
    return u;
  } catch {
    return null;
  }
}
async function limitedText(response, maximum = MAX_BODY) {
  if (Number(response.headers.get("Content-Length")) > maximum) throw new Error("response_size");
  if (!response.body?.getReader) {
    const text3 = await response.text();
    if (text3.length > maximum) throw new Error("response_size");
    return text3;
  }
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let size = 0, text2 = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) {
        await reader.cancel();
        throw new Error("response_size");
      }
      text2 += decoder.decode(value, { stream: true });
    }
    return text2 + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
function completeSourceProduct(raw, code) {
  const product = Object.fromEntries(FIELDS.split(",").filter((key) => Object.hasOwn(raw, key)).map((key) => [key, raw[key]]));
  product.code = code;
  if(raw.partial===true)product.partial=true;
  if (product.nutriscore) product.nutriscore = slimNutriscore(product.nutriscore);
  for (const [k, v] of Object.entries(raw)) {
    if (!product.product_name && /^(?:product_name|generic_name|abbreviated_product_name)/i.test(k) && typeof v === "string" && v.trim()) {
      product.product_name = v.trim();
    }
  }
  if (!String(product.ingredients_text || product.ingredients_text_en || "").trim()) {
    const local = ingredientText(product);
    if (local) product.ingredients_text = local.slice(0, 14e3);
  }
  return product;
}
async function fetchProduct(request, env, code) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), DEADLINE_MS);
  const site = new URL(request.url).origin, contact = contactFor(env, site);
  const requestId = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const attempts = [], ip = request.headers.get("CF-Connecting-IP") || "unknown";
  let redirects = 0, compatibility = false, paddedTried = false;
  let url = new URL(`${ORIGIN}/api/v3/product/${code}`);
  url.searchParams.set("fields", FIELDS);
  const fail = (type, message, status, extra = {}, headers = {}) => error(type, message, status, { requestId, attempts, ...extra }, headers);
  try {
    for (let hop = 0; hop < 5; hop++) {
      const limit = await reserveRead(ip, env);
      if (limit) return fail(
        limit.code,
        limit.code === "rate_limited" ? "Open Food Facts asked us to pause requests. Please wait before trying again." : "This FoodScan server has reached its temporary request budget. Please wait before trying again.",
        429,
        { retryAfter: limit.wait },
        { "Retry-After": String(limit.wait) }
      );
      const started = Date.now(), attempt = { endpoint: url.origin + url.pathname, httpStatus: null, elapsedMs: 0 };
      attempts.push(attempt);
      const response = await fetch(url.href, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": `FoodScan/${VERSION} (${contact})`, "Accept": "application/json" }
      });
      attempt.httpStatus = response.status;
      attempt.elapsedMs = Date.now() - started;
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const next = approvedURL(response.headers.get("Location"), url, code);
        try {
          await response.body?.cancel();
        } catch {
        }
        if (!next || ++redirects > 2) return fail("upstream_redirect", "The database redirected this request outside the allowed food API route.", 502);
        url = next;
        continue;
      }
      if (response.status === 429) {
        const wait = retrySeconds(response.headers.get("Retry-After"));
        providerCooldown = Date.now() + wait * 1e3;
        try {
          await response.body?.cancel();
        } catch {
        }
        await idxApplyUpstreamCooldown(env, "product", wait);
        return fail(
          "rate_limited",
          "Open Food Facts is limiting requests. Your saved foods still work.",
          429,
          { upstreamStatus: 429, retryAfter: wait },
          { "Retry-After": String(wait) }
        );
      }
      if ([401, 403].includes(response.status)) {
        providerCooldown = Date.now() + 3e5;
        try {
          await response.body?.cancel();
        } catch {
        }
        await idxApplyUpstreamCooldown(env, "product", 300);
        return fail("upstream_blocked", "Open Food Facts refused this server request. The site operator should check API identification and access.", 502, { upstreamStatus: response.status });
      }
      if (response.status === 503) {
        const wait = retrySeconds(response.headers.get("Retry-After"));
        providerCooldown = Date.now() + wait * 1e3;
        try {
          await response.body?.cancel();
        } catch {
        }
        await idxApplyUpstreamCooldown(env, "product", wait);
        return fail(
          "upstream_busy",
          "The food database is busy or unavailable. Please wait before retrying.",
          503,
          { upstreamStatus: 503, retryAfter: wait },
          { "Retry-After": String(wait) }
        );
      }
      const isJSON = /(?:application\/json|\+json)/i.test(response.headers.get("Content-Type") || "");
      let body = null;
      if (!isJSON) {
        try {
          await response.body?.cancel();
        } catch {
        }
      }
      if (isJSON) {
        const raw = await limitedText(response);
        try {
          body = JSON.parse(raw);
        } catch {
          return fail("upstream_format", "The database returned unreadable JSON.", 502);
        }
      }
      const nonFood = /different product type/i.test(body?.status_verbose || "") || (body?.result?.id || "").includes("different_product_type");
      if (nonFood) return fail("not_food", "This barcode belongs to a different product type, not a food record.", 404);
      const missing2 = body?.result?.id === "product_not_found" || body?.status === 0 && /product not found/i.test(body?.status_verbose || "");
      if (missing2) {
        if (code.length === 12 && !paddedTried) {
          paddedTried = true;
          url = new URL(`${ORIGIN}/api/v3/product/0${code}`);
          url.searchParams.set("fields", FIELDS);
          continue;
        }
        return fail("not_found", "Open Food Facts does not have a record for this exact barcode.", 404, { upstreamStatus: response.status });
      }
      if (!isJSON && (response.status === 404 || response.status >= 500) || [405, 501].includes(response.status)) {
        if (!compatibility) {
          compatibility = true;
          url = new URL(`${ORIGIN}/api/v2/product/${code}.json`);
          url.searchParams.set("fields", FIELDS);
          continue;
        }
        return fail("upstream_endpoint", "The requested food API endpoint did not return product data.", 502, { upstreamStatus: response.status });
      }
      if (!response.ok) return fail("upstream_http", "The food database returned a server error.", 502, { upstreamStatus: response.status });
      if (!isJSON) return fail("upstream_format", "The food API returned a web page instead of JSON. No product data was accepted.", 502);
      if (!body || typeof body !== "object" || body.status === "failure" || body.status === 0)
        return fail("upstream_failure", "The database could not complete this request. This is not a confirmed product miss.", 502);
      if (!body.product || typeof body.product !== "object" || Array.isArray(body.product))
        return fail("upstream_format", "The food API returned no product object.", 502);
      const returned = String(body.product.code || body.code || "");
      if (body.product.code && !usable(body.product)) return fail("not_food", "This is not a current food record.", 404);
      if (!equivalent(returned, code)) return fail("upstream_mismatch", "The returned barcode did not match the package. No substitute product was displayed.", 502);
      const product = completeSourceProduct(body.product, code);
      return json(
        {
          status: "success",
          product,
          fetchedAt: Date.now(),
          source: "Open Food Facts",
          version: 2,
          connection: { version: VERSION, requestId, endpoint: url.origin + url.pathname, attempts, compatibility }
        },
        200,
        { "Cache-Control": "public, max-age=60, must-revalidate" }
      );
    }
    return fail("upstream_redirect", "The food API exceeded the safe redirect limit.", 502);
  } catch (exception) {
    const last = attempts.at(-1);
    if (last) last.failure = controller.signal.aborted ? "timeout" : exception.message === "response_size" ? "response_size" : "network_error";
    if (exception.message === "response_size") return fail("upstream_size", "The product response exceeded the safe size limit.", 502);
    const type = controller.signal.aborted ? "upstream_timeout" : "upstream_network";
    console.warn(JSON.stringify({ app: "FoodScan", version: VERSION, requestId, error: type, attempts }));
    return fail(type, controller.signal.aborted ? "The server connection to Open Food Facts timed out." : "This server could not connect to Open Food Facts.", controller.signal.aborted ? 504 : 502);
  } finally {
    clearTimeout(timer);
  }
}
var SearchFailure = class extends Error {
  constructor(code, status, wait = 0) {
    super(code);
    this.code = code;
    this.status = status;
    this.wait = wait;
  }
};
function searchRedirect(value, base) {
  try {
    const u = new URL(value || "", base);
    if (u.protocol !== "https:" || u.username || u.password || u.port) return null;
    return /^(?:world(?:-[a-z]{2})?|search)\.openfoodfacts\.org$/.test(u.hostname) ? u.href : null;
  } catch {
    return null;
  }
}
async function upstreamJSON(href, env, origin, which, ip = "unknown") {
  if (cooldown[which] > Date.now()) throw new SearchFailure("rate_limited", 429, Math.ceil((cooldown[which] - Date.now()) / 1e3));
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), DEADLINE_MS);
  try {
    const headers = { Accept: "application/json", "User-Agent": `FoodScan/${VERSION} (${contactFor(env, origin)})` };
    let target = href, response;
    for (let hop = 0; ; hop++) {
      const limit = await reserveRead(ip, env, which === "index" ? "index" : "search");
      if (limit) throw new SearchFailure(limit.code, 429, limit.wait);
      response = await fetch(target, { method: "GET", signal: controller.signal, redirect: "manual", headers });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const next = searchRedirect(response.headers.get("Location"), target);
      try {
        await response.body?.cancel();
      } catch {
      }
      if (!next || hop >= 1) throw new SearchFailure("upstream_redirect", 502);
      target = next;
    }
    if ([429, 503].includes(response.status)) {
      const wait = retrySeconds(response.headers.get("Retry-After"));
      cooldown[which] = Date.now() + wait * 1e3;
      try {
        await response.body?.cancel();
      } catch {
      }
      await idxApplyUpstreamCooldown(env, "search", wait);
      throw new SearchFailure(response.status === 429 ? "rate_limited" : "upstream_busy", response.status, wait);
    }
    if ([401, 403].includes(response.status)) {
      cooldown[which] = Date.now() + 3e5;
      try {
        await response.body?.cancel();
      } catch {
      }
      await idxApplyUpstreamCooldown(env, "search", 300);
      throw new SearchFailure("upstream_blocked", 502, 300);
    }
    if (!response.ok) {
      try {
        await response.body?.cancel();
      } catch {
      }
      throw new SearchFailure("upstream_http", 502);
    }
    if (!/json/i.test(response.headers.get("Content-Type") || "")) {
      try {
        await response.body?.cancel();
      } catch {
      }
      throw new SearchFailure("upstream_format", 502);
    }
    try {
      return JSON.parse(await limitedText(response, 2000000));
    } catch (e) {
      throw new SearchFailure(e.message === "response_size" ? "upstream_size" : "upstream_format", 502);
    }
  } catch (e) {
    if (e instanceof SearchFailure) throw e;
    throw new SearchFailure(controller.signal.aborted ? "upstream_timeout" : "upstream_network", controller.signal.aborted ? 504 : 502);
  } finally {
    clearTimeout(timer);
  }
}
var usable = (p) => p && validBarcode2(String(p.code || "")) && !["beauty", "petfood", "product"].includes(p.product_type) && p.obsolete !== "on" && String(p.obsolete) !== "1";
var pick = (p, fields) => Object.fromEntries(fields.split(",").filter((k) => Object.hasOwn(p, k)).map((k) => [k, p[k]]));
function fromIndex(hit2) {
  const record = pick(hit2, INDEX_FIELDS);
  record.code = String(hit2.code);
  record.brands = Array.isArray(hit2.brands) ? hit2.brands.join(", ") : String(hit2.brands || "");
  record.partial = true; // Search projections are never authoritative product records.
  return record;
}
var isoName = (text2) => String(text2).normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, " ").replace(/\s+/g, " ").trim().slice(0, 80);
async function indexSearch(env, origin, query, sort, size, ip = "unknown", page = 1) {
  const u = new URL(INDEX_ORIGIN);
  u.searchParams.set("q", query);
  u.searchParams.set("langs", SEARCH_LANGS);
  u.searchParams.set("page_size", String(size));
  u.searchParams.set("page", String(page));
  u.searchParams.set("fields", INDEX_FIELDS);
  if (sort) u.searchParams.set("sort_by", sort);
  const raw = await upstreamJSON(u.href, env, origin, "index", ip);
  if (!Array.isArray(raw.hits)) throw new SearchFailure("upstream_format", 502);
  return { products: raw.hits.filter(usable).map(fromIndex), checked: raw.hits.length, source: "search-index", partial: true, page, total: Number.isFinite(raw.count)?raw.count:null, hasMore: Number.isFinite(raw.count)?page*size<raw.count:raw.hits.length===size };
}
async function offSearch(env, origin, params, size, text2, ip = "unknown", page = 1) {
  const u = new URL(text2 ? `${ORIGIN}/cgi/search.pl` : `${ORIGIN}/api/v2/search`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set("page_size", String(size));
  u.searchParams.set("page", String(page));
  u.searchParams.set("fields", FIELDS);
  const raw = await upstreamJSON(u.href, env, origin, "off", ip);
  if (!Array.isArray(raw.products)) throw new SearchFailure("upstream_format", 502);
  return { products: raw.products.filter(usable).map(p => completeSourceProduct(p, String(p.code))),
    checked: raw.products.length, source: "off-search", partial: false,
    recordMode: "complete-source-record-v1", page, total: Number.isFinite(raw.count)?raw.count:null,
    hasMore: Number.isFinite(raw.count)?page*size<raw.count:raw.products.length===size };
}
async function firstWorking(providers) {
  let last, empty;
  for (const run of providers) {
    try {
      const value = await run();
      if (value.products?.length) return value;
      empty = value;
    } catch (e) {
      last = e;
      if (["local_rate_limited","rate_limited","upstream_busy"].includes(e.code)) break;
    }
  }
  if (empty) return empty;
  throw last || new SearchFailure("upstream_network", 502);
}
function searchError(exception) {
  const code = exception?.code || "upstream_network";
  if (["rate_limited", "local_rate_limited", "upstream_busy"].includes(code)) {
    const wait = exception.wait || 60;
    return error(code, "Search is temporarily paused. Saved products still work. Wait before trying again.", code === "upstream_busy" ? 503 : 429, { retryAfter: wait }, { "Retry-After": String(wait) });
  }
  return error(code, code === "upstream_blocked" ? "The food database refused this search." : "Live search is unavailable. Saved records may still be available; no alternative is guaranteed.", 503);
}
async function cacheCompleteBatch(request, ctx, batch, checkedAt) {
  const cache=globalThis.caches?.default;
  if(!cache||batch.recordMode!=="complete-source-record-v1"||batch.source!=="off-search"||batch.partial!==false)return;
  const origin=new URL(request.url).origin;
  // Bounded edge writes, not 24 extra upstream lookups. More recent exact records win.
  const work=(async()=>{
    let writes=0;
    for(const raw of batch.products||[]) {
      if(writes>=8)break;
      const code=String(raw.code||'');if(!usable(raw))continue;
      const product=parseProduct({product:raw,fetchedAt:checkedAt},code);
      if(!product||product.partial||dataQuality(product).state==='blocked')continue;
      const key=new Request(`${origin}/api/cache/${CACHE_SCHEMA}/product/${code.padStart(14,'0')}`);
      const staleKey=new Request(`${origin}/api/cache/${CACHE_SCHEMA}/stale/product/${code.padStart(14,'0')}`);
      if(inflight.has(key.url))continue;
      try {
        const existing=await cache.match(key);
        if(existing?.ok){const previous=await existing.json();if(Number(previous.product?.last_modified_t)>Number(raw.last_modified_t||0)||previous.fetchedAt>checkedAt)continue;}
        const response=json({status:'success',product:raw,fetchedAt:checkedAt,source:'Open Food Facts',version:2,
          connection:{version:VERSION,endpoint:ORIGIN+'/api/v2/search',recordMode:'complete-source-record-v1'}});
        // Age is not reset by serving a cached result. Retain a short shared snapshot.
        await remember(cache,null,key,staleKey,response,Math.min(FRESH.category,FRESH.product));writes++;
      }catch{}
    }
  })();
  if(ctx?.waitUntil)ctx.waitUntil(work);else await work;
}
async function cachedSearch(request, ctx, kind, keyPart, run) {
  const url = new URL(request.url), cache = globalThis.caches?.default;
  const key = new Request(`${url.origin}/api/cache/${CACHE_SCHEMA}/${kind}/${keyPart}`), staleKey = new Request(`${url.origin}/api/cache/${CACHE_SCHEMA}/stale/${kind}/${keyPart}`);
  if (cache) {
    try {
      const hit2 = await cache.match(key);
      if (hit2?.status === 200) return withCache(hit2, "HIT");
    } catch {
    }
  }
  const pending = inflight.get(key.url);
  if (pending) return (await pending).clone();
  if (inflight.size >= MAX_PENDING) return error("local_rate_limited", "Too many lookups are in progress.", 429, { retryAfter: 10 }, { "Retry-After": "10" });
  const job = (async () => {
    try {
      const result = await run(), checkedAt=Date.now();
      await cacheCompleteBatch(request,ctx,result,checkedAt);
      const response = json({ ...result, provider: result.source, fetchedAt: checkedAt, source: "Open Food Facts", version: VERSION });
      await remember(cache, ctx, key, staleKey, response, result.products?.length ? FRESH[kind === "search" ? "search" : "category"] : 300);
      return withCache(response, "MISS");
    } catch (e) {
      return await staleCopy(cache, staleKey) || searchError(e);
    }
  })();
  inflight.set(key.url, job);
  try {
    return (await job).clone();
  } finally {
    inflight.delete(key.url);
  }
}
function marketCountry(request) {
 const query=new URL(request.url).searchParams;
 const selected=query.get("country");
 if(selected === "any")return "";
 if(selected)return selected;
 return COUNTRY_BY_REGION[String(request.cf?.country||"").toUpperCase()]||"";
}
function marketPage(request) {
 const raw=new URL(request.url).searchParams.get("page")||"1";
 return /^\d{1,2}$/.test(raw)&&Number(raw)>=1&&Number(raw)<=50?Number(raw):null;
}
function categorySearch(request,env,ctx) {
 const url=new URL(request.url),category=url.searchParams.get("category")||"",country=marketCountry(request),page=marketPage(request);
 const full=url.searchParams.get("detail")!=="fast",ip=request.headers.get("CF-Connecting-IP")||"unknown";
 if(!/^[a-z]{2}:[a-z0-9][a-z0-9-]{1,100}$/.test(category))return error("invalid_category","Choose a source-listed food category.",400);
 if(country&&!/^[a-z][a-z-]{2,40}$/.test(country))return error("invalid_country","Choose a source-listed country.",400);
 if(!page)return error("invalid_page","Page must be from 1 to 50.",400);
 const query=`categories_tags:"${category}"${country?` AND countries_tags:"en:${country}"`:""}`;
 const viaIndex=()=>indexSearch(env,url.origin,query,"-unique_scans_n",24,ip,page);
 const viaOff=()=>offSearch(env,url.origin,{categories_tags:category,sort_by:"nutriscore_score",...(country?{countries_tags:`en:${country}`}:{})},24,false,ip,page);
 return cachedSearch(request,ctx,"category",`${encodeURIComponent(category)}/${country||"any"}/${full?"full":"fast"}/${page}`,async()=>{
   const batch=await firstWorking(full?[viaOff,viaIndex]:[viaIndex,viaOff]);
   const products=batch.products.filter(p=>!country||(p.countries_tags||[]).includes(`en:${country}`));
   return {...batch,products,category,country:country||null,page,
    coverage:"Country-filtered paginated source records, including imports. Not all supermarket products, retailer availability, stock or price. Complete primary-source records are checked with the same grading kernel as product reports; partial index hints require enrichment."};
 });
}
function textSearch(request, env, ctx) {
  const url = new URL(request.url), query = isoName(url.searchParams.get("q") || ""), full = url.searchParams.get("detail") === "full", ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (query.length < 2) return error("invalid_query", "Type at least 2 letters or digits to search.", 400);
  const viaIndex = () => indexSearch(env, url.origin, query, "", 12, ip);
  const viaOff = () => offSearch(env, url.origin, { search_terms: query, search_simple: "1", action: "process", json: "1", sort_by: "unique_scans_n" }, 12, true, ip);
  return cachedSearch(request, ctx, "search", `${full ? "full" : "fast"}/${encodeURIComponent(query)}`, async () => ({ ...await firstWorking(full ? [viaOff, viaIndex] : [viaIndex, viaOff]), query }));
}
var healthMemo = null;
async function deepHealth(request, env) {
  if (healthMemo && Date.now() - healthMemo.at < 3e5) return healthMemo.value;
  if (deepPending) return deepPending;
  deepPending = (async () => {
    const probe = async (run) => {
      const t2 = Date.now();
      try {
        await run();
        return { ok: true, ms: Date.now() - t2 };
      } catch (e) {
        return { ok: false, ms: Date.now() - t2, error: e?.code || "failed" };
      }
    };
    const [product, index] = await Promise.all([
      probe(async () => {
        const r = await productResponse(request, env, null, "3017624010701");
        if (!r.ok) throw new SearchFailure(r.status === 429 ? "rate_limited" : "upstream_http", r.status);
      }),
      probe(() => indexSearch(env, new URL(request.url).origin, "nutella", "", 1, request.headers.get("CF-Connecting-IP") || "unknown"))
    ]);
    const catalogue = idxEnabled(env) ? await idxDiagnostic(env) : null;
    const value = { status: product.ok && index.ok ? "ok" : product.ok || index.ok ? "degraded" : "down", checks: { productApi: product, searchIndex: index, ...catalogue ? { catalogue: { ok: Boolean(catalogue.ready) } } : {} }, index: catalogue, checkedAt: (/* @__PURE__ */ new Date()).toISOString() };
    healthMemo = { at: Date.now(), value };
    return value;
  })();
  try {
    return await deepPending;
  } finally {
    deepPending = null;
  }
}
function eventRow(body, country = "") {
  if (!body || typeof body !== "object" || !EVENT_NAMES.has(body.name)) return null;
  const props = body.properties && typeof body.properties === "object" ? body.properties : {};
  const label = (v) => typeof v === "boolean" ? String(v) : typeof v === "string" && LABEL3.test(v) ? v : "";
  const viral = VIRAL_EVENTS.has(body.name);
  if (viral && (!SHARE_TOKEN.test(props.referral || "") || !EVENT_ID.test(body.eventId || ""))) return null;
  const cols = { ...props, referral: viral ? props.referral : "", parent: viral && SHARE_TOKEN.test(props.parent || "") && props.parent !== props.referral ? props.parent : "" };
  const ms = Number(props.durationMs);
  return {
    blobs: [body.name, VERSION, /^[A-Z]{2}$/.test(country) ? country : "", ...EVENT_COLUMNS.map((k) => label(cols[k])), viral ? body.eventId : ""],
    doubles: [1, Number.isFinite(ms) && ms >= 0 && ms < 12e4 ? Math.round(ms) : 0],
    indexes: [viral ? props.referral : body.name]
  };
}
var doNotTrack = (request) => request.headers.get("Sec-GPC") === "1" || /^(?:1|yes)$/i.test(request.headers.get("DNT") || "");
async function collectEvent(request, env) {
  const done = new Response(null, { status: 204, headers: { "Cache-Control": "no-store", "X-FoodScan-Version": VERSION } });
  if (request.method !== "POST") return error("method_not_allowed", "Use POST.", 405, {}, { Allow: "POST" });
  if (doNotTrack(request)) return done;
  try {
    const from = request.headers.get("Origin") || request.headers.get("Referer") || "";
    if (!from || new URL(from).origin !== new URL(request.url).origin) return done;
  } catch {
    return done;
  }
  if (!env?.ANALYTICS?.writeDataPoint) return done;
  const now = Date.now(), ip = request.headers.get("CF-Connecting-IP") || "unknown", recent = (eventBudget.get(ip) || []).filter((t2) => t2 > now - 6e4);
  if (recent.length >= 60) return done;
  recent.push(now);
  eventBudget.set(ip, recent);
  if (eventBudget.size > 4096) {
    for (const [k, times] of eventBudget) if (times.at(-1) <= now - 6e4) eventBudget.delete(k);
  }
  let body;
  try {
    body = JSON.parse(await boundedRequest(request, 2e3));
  } catch {
    return error("bad_event", "Invalid or oversized event.", 400);
  }
  const row = eventRow(body, request.cf?.country || "");
  if (!row) return error("bad_event", "Unknown event, or a share event without a valid share token and event id.", 400);
  if (VIRAL_EVENTS.has(body.name)) {
    if (seenEvents.has(body.eventId)) return done;
    if (seenEvents.size > 4e3) {
      for (const [id, at] of seenEvents) if (now - at > 6e5) seenEvents.delete(id);
    }
    if (seenEvents.size > 6e3) seenEvents.clear();
    seenEvents.set(body.eventId, now);
  }
  try {
    env.ANALYTICS.writeDataPoint(row);
  } catch {
  }
  return done;
}

