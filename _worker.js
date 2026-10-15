/** FoodScan 9.1 - standalone Cloudflare Pages advanced-mode Worker.
 * Public, read-only Open Food Facts requests. No credentials or proxy services.
 *
 * Resilience (why a hiccup at Open Food Facts never has to look like "your network is broken"):
 *   - text search and category search go through OFF's dedicated search service first, then legacy search
 *   - every success is cached twice: a fresh copy, and a long-lived stale copy that is served if OFF is down,
 *     throttling or timing out ("stale-if-error"), clearly marked X-FoodScan-Cache: STALE
 *   - transient failures get one automatic retry
 * Per-isolate guards are best-effort, NOT a distributed rate limiter.
 */
const VERSION = '11.3.0';
const EVENT_NAMES = new Set(['scan_success','scan_outcome','merchant_open','list_add','install']);
const EVENT_PROPERTIES = new Set(['method','cached','durationMs','kind','placement']);
const ORIGIN = 'https://world.openfoodfacts.org';
const INDEX_ORIGIN = 'https://search.openfoodfacts.org/search';
const FIELDS = 'code,product_name,product_name_en,product_name_el,brands,image_front_url,image_url,quantity,serving_size,nutriments,nutriscore_grade,nutrition_grades,nova_group,ingredients_text,ingredients_text_en,ingredients_text_el,allergens_tags,traces_tags,last_modified_t,labels_tags,ingredients_analysis_tags,categories_tags,countries_tags,additives_n,product_quantity_unit,serving_quantity,serving_quantity_unit,data_quality_errors_tags,product_type,obsolete';
// The search index stores a slimmer record: no ingredient text, traces, serving size or additive count.
const INDEX_FIELDS = 'code,product_name,product_name_en,brands,image_front_url,image_url,quantity,nutriments,nutriscore_grade,nova_group,allergens_tags,labels_tags,ingredients_analysis_tags,categories_tags,countries_tags,last_modified_t,unique_scans_n';
const SEARCH_LANGS = 'en,fr,de,es,it,el,pt,nl';
const MAX_BODY = 600000, DEADLINE_MS = 7000, STALE_SECONDS = 30 * 86400;
const FRESH = { product: 21600, category: 3600, search: 1800 };
const inflight = new Map(), users = new Map(), upstreamReads = [];
const cooldown = { off: 0, index: 0 };
let providerCooldown = 0;
const retryable = new WeakSet();

function validBarcode(code) {
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(code) || /^0+$/.test(code)) return false;
  let sum = 0;
  for (let i = code.length - 2, w = 3; i >= 0; i--, w = 4 - w) sum += Number(code[i]) * w;
  return (10 - sum % 10) % 10 === Number(code.at(-1));
}
const equivalent = (a, b) => validBarcode(a) && validBarcode(b) && a.padStart(14, '0') === b.padStart(14, '0');
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: {
  'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-FoodScan-Version': VERSION, ...headers
}});
const error = (code, message, status, details = {}, headers = {}) => json({ error: { code, message, ...details }, version: VERSION }, status, headers);
function withCache(response, state) {
  const headers = new Headers(response.headers); headers.set('X-FoodScan-Cache', state);
  return new Response(response.body, { status: response.status, headers });
}
function retrySeconds(value) {
  const seconds = /^\d+$/.test(value || '') ? Number(value) : (Date.parse(value || '') - Date.now()) / 1000;
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(86400, Math.ceil(seconds)) : 60;
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const contactFor = (env, origin) => typeof env.CONTACT_EMAIL === 'string' && /^[^\s<>()[\]@]+@[^\s<>()[\]@]+\.[^\s<>()[\]@]+$/.test(env.CONTACT_EMAIL)
  ? env.CONTACT_EMAIL.slice(0, 200) : `${origin}/#about`;

/* ---------- two-tier edge cache ---------- */
async function remember(cache, ctx, key, staleKey, response, freshSeconds) {
  if (!cache || response.status !== 200) return;
  const copy = (seconds) => { const headers = new Headers(response.headers); headers.set('Cache-Control', `public, max-age=${seconds}, s-maxage=${seconds}`); return new Response(response.clone().body, { status: 200, headers }); };
  const writes = Promise.all([cache.put(key, copy(freshSeconds)).catch(() => {}), cache.put(staleKey, copy(STALE_SECONDS)).catch(() => {})]);
  if (ctx?.waitUntil) ctx.waitUntil(writes); else await writes;
}
async function staleCopy(cache, staleKey) {
  if (!cache) return null;
  try {
    const hit = await cache.match(staleKey); if (hit?.status !== 200) return null;
    const headers = new Headers(hit.headers); headers.set('Cache-Control', 'no-store'); headers.set('X-FoodScan-Cache', 'STALE');
    return new Response(hit.body, { status: 200, headers });
  } catch { return null; }
}

/* ---------- rate budgets ---------- */
async function reserveRead(ip, env) {
  if (env?.UPSTREAM_RATE_LIMITER?.limit) { const out = await env.UPSTREAM_RATE_LIMITER.limit({ key: 'open-food-facts' }); if (!out.success) return { code: 'local_rate_limited', wait: 10 }; }

  const now = Date.now();
  while (upstreamReads.length && upstreamReads[0] <= now - 60000) upstreamReads.shift();
  if (providerCooldown > now) return { code: 'rate_limited', wait: Math.ceil((providerCooldown - now) / 1000) };
  if (upstreamReads.length >= 12) return { code: 'local_rate_limited', wait: Math.max(1, Math.ceil((upstreamReads[0] + 60000 - now) / 1000)) };
  if (users.size > 2048) { for (const [key, hits] of users) if (!hits.length || hits.at(-1) < now - 60000) users.delete(key); }
  if (users.size > 4096 && !users.has(ip)) return { code: 'local_rate_limited', wait: 60 };
  const hits = (users.get(ip) || []).filter(t => t > now - 60000);
  if (hits.length >= 10) return { code: 'local_rate_limited', wait: Math.max(1, Math.ceil((hits[0] + 60000 - now) / 1000)) };
  hits.push(now); users.set(ip, hits); upstreamReads.push(now); return null;
}
function approvedURL(value, base, code) {
  try {
    const u = new URL(value, base);
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
    if (!/^(?:world(?:-[a-z]{2})?|[a-z]{2}(?:-[a-z]{2})?|(?:ssl-)?api)\.openfoodfacts\.org$/.test(u.hostname)) return null;
    const match = u.pathname.match(/^\/api\/v(?:2|3(?:\.\d+)?)\/product\/(\d+)(?:\.json)?$/);
    if (!match || !equivalent(match[1], code)) return null;
    u.hash = ''; return u;
  } catch { return null; }
}
async function limitedText(response) {
  if (Number(response.headers.get('Content-Length')) > MAX_BODY) throw new Error('response_size');
  if (!response.body?.getReader) { const text = await response.text(); if (text.length > MAX_BODY) throw new Error('response_size'); return text; }
  const reader = response.body.getReader(), decoder = new TextDecoder(); let size = 0, text = '';
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength; if (size > MAX_BODY) { await reader.cancel(); throw new Error('response_size'); }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally { reader.releaseLock(); }
}

/* ---------- product by barcode ---------- */
async function fetchProduct(request, env, code) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), DEADLINE_MS);
  const site = new URL(request.url).origin, contact = contactFor(env, site);
  const requestId = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const attempts = [], ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  let redirects = 0, compatibility = false;
  let url = new URL(`${ORIGIN}/api/v3/product/${code}`); url.searchParams.set('fields', FIELDS);
  const fail = (type, message, status, extra = {}, headers = {}) => {
    const response = error(type, message, status, { requestId, attempts, ...extra }, headers);
    if (['upstream_network', 'upstream_timeout', 'upstream_http', 'upstream_format', 'upstream_endpoint'].includes(type)) retryable.add(response);
    return response;
  };
  try {
    for (let hop = 0; hop < 4; hop++) {
      const limit = await reserveRead(ip, env);
      if (limit) return fail(limit.code, limit.code === 'rate_limited'
        ? 'Open Food Facts asked us to pause requests. Please wait before trying again.'
        : 'This FoodScan server has reached its temporary request budget. Please wait before trying again.',
      429, { retryAfter: limit.wait }, { 'Retry-After': String(limit.wait) });
      const started = Date.now(), attempt = { endpoint: url.origin + url.pathname, httpStatus: null, elapsedMs: 0 };
      attempts.push(attempt);
      // Follow only a bounded number of checked HTTPS redirects. Never forward visitor headers.
      const response = await fetch(url.href, { method: 'GET', redirect: 'manual', signal: controller.signal,
        headers: { 'User-Agent': `FoodScan/${VERSION} (${contact})`, 'Accept': 'application/json' } });
      attempt.httpStatus = response.status; attempt.elapsedMs = Date.now() - started;
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const next = approvedURL(response.headers.get('Location'), url, code);
        try { await response.body?.cancel(); } catch {}
        if (!next || ++redirects > 2) return fail('upstream_redirect', 'The database redirected this request outside the allowed food API route.', 502);
        url = next; continue;
      }
      if (response.status === 429) {
        const wait = retrySeconds(response.headers.get('Retry-After')); providerCooldown = Date.now() + wait * 1000;
        return fail('rate_limited', 'Open Food Facts is limiting requests. Your saved foods still work.', 429,
          { upstreamStatus: 429, retryAfter: wait }, { 'Retry-After': String(wait) });
      }
      if ([401, 403].includes(response.status)) return fail('upstream_blocked', 'Open Food Facts refused this server request. The site operator should check API identification and access.', 502, { upstreamStatus: response.status });
      if (response.status === 503) {
        const wait = retrySeconds(response.headers.get('Retry-After')); providerCooldown = Date.now() + wait * 1000;
        return fail('upstream_busy', 'The food database is busy or unavailable. Please wait before retrying.', 503,
          { upstreamStatus: 503, retryAfter: wait }, { 'Retry-After': String(wait) });
      }
      const isJSON = /(?:application\/json|\+json)/i.test(response.headers.get('Content-Type') || '');
      let body = null;
      if (!isJSON) { try { await response.body?.cancel(); } catch {} }
      if (isJSON) { const raw = await limitedText(response); try { body = JSON.parse(raw); } catch { return fail('upstream_format', 'The database returned unreadable JSON.', 502); } }
      // A database miss is a JSON assertion, NOT an arbitrary HTTP 404 or an HTML error page.
      const nonFood = /different product type/i.test(body?.status_verbose || '') || (body?.result?.id || '').includes('different_product_type');
      if (nonFood) return fail('not_food', 'This barcode belongs to a different product type, not a food record.', 404);
      const missing = body?.result?.id === 'product_not_found' || (body?.status === 0 && /product not found/i.test(body?.status_verbose || ''));
      if (missing) return fail('not_found', 'Open Food Facts does not have a record for this exact barcode.', 404, { upstreamStatus: response.status });
      if ((!isJSON && (response.status === 404 || response.status >= 500)) || [405, 501].includes(response.status)) {
        // v2 is a supported compatibility endpoint, NOT a second database. Never retry a genuine miss.
        if (!compatibility) { compatibility = true; url = new URL(`${ORIGIN}/api/v2/product/${code}.json`); url.searchParams.set('fields', FIELDS); continue; }
        return fail('upstream_endpoint', 'The requested food API endpoint did not return product data.', 502, { upstreamStatus: response.status });
      }
      if (!response.ok) return fail('upstream_http', 'The food database returned a server error.', 502, { upstreamStatus: response.status });
      if (!isJSON) return fail('upstream_format', 'The food API returned a web page instead of JSON. No product data was accepted.', 502);
      if (!body || typeof body !== 'object' || body.status === 'failure' || body.status === 0)
        return fail('upstream_failure', 'The database could not complete this request. This is not a confirmed product miss.', 502);
      if (!body.product || typeof body.product !== 'object' || Array.isArray(body.product))
        return fail('upstream_format', 'The food API returned no product object.', 502);
      const returned = String(body.product.code || body.code || '');
      if (!equivalent(returned, code)) return fail('upstream_mismatch', 'The returned barcode did not match the package. No substitute product was displayed.', 502);
      const product = Object.fromEntries(FIELDS.split(',').filter(key => Object.hasOwn(body.product, key)).map(key => [key, body.product[key]]));
      product.code = returned;
      return json({ status: 'success', product, fetchedAt: Date.now(), source: 'Open Food Facts', version: 2,
        connection: { version: VERSION, requestId, endpoint: url.origin + url.pathname, attempts, compatibility } }, 200,
      { 'Cache-Control': 'public, max-age=300, s-maxage=21600' });
    }
    return fail('upstream_redirect', 'The food API exceeded the safe redirect limit.', 502);
  } catch (exception) {
    const last = attempts.at(-1); if (last) last.failure = controller.signal.aborted ? 'timeout' : exception.message === 'response_size' ? 'response_size' : 'network_error';
    // Do not expose stack traces, infrastructure details, visitor IPs or credentials.
    if (exception.message === 'response_size') return fail('upstream_size', 'The product response exceeded the safe size limit.', 502);
    const type = controller.signal.aborted ? 'upstream_timeout' : 'upstream_network';
    console.warn(JSON.stringify({ app: 'FoodScan', version: VERSION, requestId, error: type, attempts }));
    return fail(type, controller.signal.aborted ? 'The server connection to Open Food Facts timed out.' : 'This server could not connect to Open Food Facts.', controller.signal.aborted ? 504 : 502);
  } finally { clearTimeout(timer); }
}

/* ---------- search providers (text and category) ---------- */
class SearchFailure extends Error { constructor(code, status, wait = 0) { super(code); this.code = code; this.status = status; this.wait = wait; } }
async function upstreamJSON(href, env, origin, which) {
  const now = Date.now();
  if (cooldown[which] > now) throw new SearchFailure('rate_limited', 429, Math.ceil((cooldown[which] - now) / 1000));
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), DEADLINE_MS);
  try {
    const response = await fetch(href, { method: 'GET', signal: controller.signal, redirect: 'error', headers: { Accept: 'application/json', 'User-Agent': `FoodScan/${VERSION} (${contactFor(env, origin)})` } });
    if ([429, 503].includes(response.status)) { const wait = retrySeconds(response.headers.get('Retry-After')); cooldown[which] = Date.now() + Math.min(wait, 120) * 1000; try { await response.body?.cancel(); } catch {} throw new SearchFailure('rate_limited', 429, wait); }
    if ([401, 403].includes(response.status)) { try { await response.body?.cancel(); } catch {} throw new SearchFailure('upstream_blocked', 502); }
    if (!response.ok) { try { await response.body?.cancel(); } catch {} throw new SearchFailure('upstream_http', 502); }
    if (!/json/i.test(response.headers.get('Content-Type') || '')) { try { await response.body?.cancel(); } catch {} throw new SearchFailure('upstream_format', 502); }
    try { return JSON.parse(await limitedText(response)); } catch (exception) { throw exception instanceof SearchFailure ? exception : new SearchFailure('upstream_format', 502); }
  } catch (exception) {
    if (exception instanceof SearchFailure) throw exception;
    throw new SearchFailure(controller.signal.aborted ? 'upstream_timeout' : 'upstream_network', controller.signal.aborted ? 504 : 502);
  } finally { clearTimeout(timer); }
}
const usable = p => p && validBarcode(String(p.code || '')) && !['beauty', 'petfood', 'product'].includes(p.product_type) && p.obsolete !== 'on' && String(p.obsolete) !== '1';
const pick = (p, fields) => Object.fromEntries(fields.split(',').filter(k => Object.hasOwn(p, k)).map(k => [k, p[k]]));
/** Search-index hits become OFF-shaped records, flagged partial so safety checks never over-trust them. */
function fromIndex(hit) {
  const record = pick(hit, INDEX_FIELDS);
  record.code = String(hit.code);
  record.brands = Array.isArray(hit.brands) ? hit.brands.join(', ') : String(hit.brands || '');
  record.partial = true;
  return record;
}
const isoName = text => String(text).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
async function indexSearch(env, origin, query, sort, size) {
  const u = new URL(INDEX_ORIGIN);
  u.searchParams.set('q', query); u.searchParams.set('langs', SEARCH_LANGS); u.searchParams.set('page_size', String(size)); u.searchParams.set('page', '1'); u.searchParams.set('fields', INDEX_FIELDS);
  if (sort) u.searchParams.set('sort_by', sort);
  const raw = await upstreamJSON(u.href, env, origin, 'index');
  if (!Array.isArray(raw.hits)) throw new SearchFailure('upstream_format', 502);
  return { products: raw.hits.filter(usable).map(fromIndex), checked: raw.hits.length, source: 'search-index', partial: true };
}
async function offSearch(env, origin, params, size, text) {
  const u = new URL(text ? `${ORIGIN}/cgi/search.pl` : `${ORIGIN}/api/v2/search`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set('page_size', String(size)); u.searchParams.set('page', '1'); u.searchParams.set('fields', FIELDS);
  const raw = await upstreamJSON(u.href, env, origin, 'off');
  if (!Array.isArray(raw.products)) throw new SearchFailure('upstream_format', 502);
  return { products: raw.products.filter(usable).map(p => pick(p, FIELDS)), checked: raw.products.length, source: 'off-search', partial: false };
}
async function firstWorking(providers) {
  let last;
  for (const run of providers) { try { return await run(); } catch (exception) { last = exception; } }
  throw last || new SearchFailure('upstream_network', 502);
}
function searchError(exception) {
  const code = exception?.code || 'upstream_network';
  if (code === 'rate_limited') return error('rate_limited', 'The food database is busy right now. Your saved foods still work.', 429, { retryAfter: exception.wait || 60 }, { 'Retry-After': String(exception.wait || 60) });
  if (code === 'upstream_blocked') return error(code, 'The food database refused this search.', 502);
  return error(code, 'The food database did not answer. It is usually busy rather than down, so please try again in a moment.', exception?.status || 502);
}
/** Shared cache + stale-if-error wrapper for text and category search. */
async function cachedSearch(request, ctx, kind, keyPart, run) {
  const url = new URL(request.url), cache = globalThis.caches?.default;
  const key = new Request(`${url.origin}/api/cache/${VERSION}/${kind}/${keyPart}`), staleKey = new Request(`${url.origin}/api/cache/${VERSION}/stale/${kind}/${keyPart}`);
  if (cache) { try { const hit = await cache.match(key); if (hit?.status === 200) return withCache(hit, 'HIT'); } catch {} }
  const pending = inflight.get(key.url); if (pending) return (await pending).clone();
  const job = (async () => {
    try {
      const result = await run();
      const response = json({ ...result, fetchedAt: Date.now(), source: 'Open Food Facts', version: VERSION }, 200, { 'Cache-Control': 'public, max-age=300' });
      await remember(cache, ctx, key, staleKey, response, FRESH[kind === 'search' ? 'search' : 'category']);
      return withCache(response, 'MISS');
    } catch (exception) {
      return (await staleCopy(cache, staleKey)) || searchError(exception);
    }
  })();
  inflight.set(key.url, job);
  try { return (await job).clone(); } finally { inflight.delete(key.url); }
}
/** Popular products in one category, optionally sold in one country. */
function categorySearch(request, env, ctx) {
  const url = new URL(request.url), category = url.searchParams.get('category') || '', country = url.searchParams.get('country') || '';
  const full = url.searchParams.get('detail') === 'full';
  if (!/^[a-z]{2}:[a-z0-9][a-z0-9-]{1,100}$/.test(category)) return error('invalid_category', 'Choose a category returned by the source record.', 400);
  if (country && !/^[a-z][a-z-]{2,40}$/.test(country)) return error('invalid_country', 'Use a country name as listed by the source, for example united-kingdom.', 400);
  const query = `categories_tags:"${category}"${country ? ` AND countries_tags:"en:${country}"` : ''}`;
  const viaIndex = () => indexSearch(env, url.origin, query, '-unique_scans_n', 24);
  const viaOff = () => offSearch(env, url.origin, { categories_tags: category, ...(country ? { countries_tags: `en:${country}` } : {}) }, 24, false);
  // Hard restrictions need complete records (ingredient text and traces), so those shoppers try full records first.
  return cachedSearch(request, ctx, 'category', `${encodeURIComponent(category)}/${country || 'any'}/${full ? 'full' : 'fast'}`,
    async () => ({ ...(await firstWorking(full ? [viaOff, viaIndex] : [viaIndex, viaOff])), category, country: country || null,
      coverage: 'Sample of up to 24 popular records, not the entire category. Country filter reflects where a record is listed as sold, not stock or local availability.' }));
}
/** Name search. */
function textSearch(request, env, ctx) {
  const url = new URL(request.url), query = isoName(url.searchParams.get('q') || ''), full = url.searchParams.get('detail') === 'full';
  if (query.length < 2) return error('invalid_query', 'Type at least 2 letters or digits to search.', 400);
  const viaIndex = () => indexSearch(env, url.origin, query, '', 12);
  const viaOff = () => offSearch(env, url.origin, { search_terms: query, search_simple: '1', action: 'process', json: '1', sort_by: 'unique_scans_n' }, 12, true);
  return cachedSearch(request, ctx, 'search', `${full ? 'full' : 'fast'}/${encodeURIComponent(query)}`,
    async () => ({ ...(await firstWorking(full ? [viaOff, viaIndex] : [viaIndex, viaOff])), query }));
}


async function collectEvent(request, env) {
  if (request.method !== 'POST') return error('method_not_allowed', 'Use POST.', 405);
  if (!String(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) return error('bad_event', 'Use JSON.', 400);
  let body; try { const text = await request.text(); if (text.length > 2000) throw new Error(); body = JSON.parse(text); } catch { return error('bad_event', 'Invalid event.', 400); }
  if (!EVENT_NAMES.has(body?.name)) return error('bad_event', 'Unknown event.', 400);
  const properties = body.properties && typeof body.properties === 'object' && !Array.isArray(body.properties) ? Object.fromEntries(Object.entries(body.properties).filter(([k,v]) => EVENT_PROPERTIES.has(k) && ['string','number','boolean'].includes(typeof v)).slice(0,10).map(([k,v]) => [k, typeof v === 'string' ? v.slice(0,80) : v])) : {};
  const event = { name: body.name, properties, version: String(body.version || '').slice(0,20), path: String(body.path || '').slice(0,40), at: Date.now() };
  if (env?.ANALYTICS?.writeDataPoint) env.ANALYTICS.writeDataPoint({ blobs: [event.name,event.version,event.path,JSON.stringify(event.properties)], doubles: [1], indexes: [event.name] });
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store', 'X-FoodScan-Version': VERSION } });
}

export default {
  async fetch(request, env = {}, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (url.pathname === '/api/events') {
      if (request.headers.get('Sec-Fetch-Site') === 'cross-site' || (request.headers.get('Origin') && request.headers.get('Origin') !== url.origin)) return error('origin_not_allowed', 'Use the API from this FoodScan site.', 403);
      return collectEvent(request, env);
    }
    if (request.method !== 'GET') return error('method_not_allowed', 'Only GET requests are supported.', 405, {}, { Allow: 'GET' });
    if (request.headers.get('Sec-Fetch-Site') === 'cross-site' || (request.headers.get('Origin') && request.headers.get('Origin') !== url.origin))
      return error('origin_not_allowed', 'Use the API from this FoodScan site.', 403);
    if (url.pathname === '/api/health') return json({ app: 'FoodScan', version: VERSION, backend: 'ready', upstream: 'not-checked',
      contactConfigured: Boolean(env.CONTACT_EMAIL), source: ORIGIN, search: 'index+legacy', recovery: 'stale-if-error-then-browser-direct', serverDeadlineMs: DEADLINE_MS });
    if (url.pathname === '/api/alternatives') return categorySearch(request, env, ctx);
    if (url.pathname === '/api/search') return textSearch(request, env, ctx);
    const match = url.pathname.match(/^\/api\/product\/(\d+)$/);
    if (!match) return error('route_not_found', 'Unknown API route.', 404);
    const code = match[1]; if (!validBarcode(code)) return error('invalid_barcode', 'The barcode length or check digit is invalid.', 400);
    const cache = globalThis.caches?.default;
    // A new namespace cannot reuse a v2.0 false-negative cache entry.
    const key = new Request(`${url.origin}/api/cache/${VERSION}/product/${code}`), staleKey = new Request(`${url.origin}/api/cache/${VERSION}/stale/product/${code}`);
    if (cache) { try { const hit = await cache.match(key); if (hit?.status === 200) return withCache(hit, 'HIT'); } catch {} }
    const pending = inflight.get(key.url); if (pending) return (await pending).clone();
    const job = (async () => {
      let result = await fetchProduct(request, env, code);
      // One quiet retry for a transient failure before the shopper ever sees an error.
      if (retryable.has(result)) { await sleep(300); result = await fetchProduct(request, env, code); }
      // Only successes are cached. Connection errors and not-found results are never stored at the edge.
      if (result.status === 200) { await remember(cache, ctx, key, staleKey, result, FRESH.product); return withCache(result, 'MISS'); }
      // Provider trouble (not a confirmed miss): the last good answer beats an error message.
      if (![400, 403, 404].includes(result.status)) { const stale = await staleCopy(cache, staleKey); if (stale) return stale; }
      return withCache(result, 'MISS');
    })();
    inflight.set(key.url, job);
    try { return (await job).clone(); } finally { inflight.delete(key.url); }
  }
};
