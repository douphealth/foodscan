import { validBarcode, parseProduct, VERSION } from './model.js';
export const OFF_ORIGIN = 'https://world.openfoodfacts.org';
export const OFF_FIELDS = 'code,product_name,product_name_en,product_name_el,brands,image_front_url,image_url,quantity,serving_size,nutriments,nutriscore_grade,nutrition_grades,nova_group,ingredients_text,ingredients_text_en,ingredients_text_el,allergens_tags,traces_tags,last_modified_t,labels_tags,ingredients_analysis_tags,categories_tags,countries_tags,additives_n,product_quantity_unit,serving_quantity,serving_quantity_unit,data_quality_errors_tags,product_type,obsolete';
const MAX_BODY = 600000;
let latest = null, preferredDirectUntil = 0, cooldownUntil = 0;
const directReads = [];
export class LookupError extends Error {
  constructor(message, code = 'unavailable', retryAfter = 0) {
    super(message); this.name = 'LookupError'; this.code = code; this.retryAfter = retryAfter; this.diagnostics = null;
  }
}
export const getLastLookup = () => latest ? JSON.parse(JSON.stringify(latest)) : null;
export function directURL(barcode) {
  const url = new URL(`${OFF_ORIGIN}/api/v3/product/${barcode}`);
  url.searchParams.set('fields', OFF_FIELDS);
  // Browsers control their User-Agent. Do not set forbidden headers or cause a CORS preflight.
  // The query identifies the app in URL logs; the Worker supplies the custom User-Agent.
  url.searchParams.set('app_name', 'FoodScan'); url.searchParams.set('app_version', VERSION); url.searchParams.set('app_platform', 'web');
  return url.href;
}
function waitSeconds(value) {
  const n = /^\d+$/.test(String(value || '')) ? Number(value) : (Date.parse(value || '') - Date.now()) / 1000;
  return Number.isFinite(n) && n > 0 ? Math.min(86400, Math.ceil(n)) : 60;
}
const sleepRemaining = () => Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
async function readJSON(url, { signal, timeout = 9000, transport = 'server', attempt } = {}) {
  if (signal?.aborted) throw new DOMException('Lookup cancelled', 'AbortError');
  const controller = new AbortController(), abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(), timeout), start = Date.now();
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, credentials: 'omit',
      signal: controller.signal, mode: transport === 'direct' ? 'cors' : 'same-origin', redirect: 'follow', cache: 'no-store' });
    if (attempt) { attempt.httpStatus = response.status; attempt.cache = response.headers.get('X-FoodScan-Cache') || null; }
    // Never hide provider access restrictions or rate limits behind a retry on another route.
    if ([401, 403].includes(response.status)) throw new LookupError(transport === 'direct' ? 'Open Food Facts refused the request. Please check connection diagnostics.' : 'This site refused the API request. Please check its access settings.', transport === 'direct' ? 'upstream_blocked' : 'access_denied');
    if (response.status === 429 || (transport === 'direct' && response.status === 503)) {
      let detail = null;
      if (transport === 'server' && /json/i.test(response.headers.get('Content-Type') || '')) {
        try { const raw = await response.text(); if (raw.length <= MAX_BODY) detail = JSON.parse(raw)?.error; } catch {}
      }
      const seconds = waitSeconds(detail?.retryAfter || response.headers.get('Retry-After')); cooldownUntil = Date.now() + seconds * 1000;
      if (attempt && detail) { attempt.requestId = detail.requestId || null; attempt.upstream = detail.attempts || []; }
      const type = detail?.code === 'local_rate_limited' ? 'local_rate_limited' : response.status === 429 ? 'rate_limited' : 'upstream_busy';
      throw new LookupError(detail?.message || 'The database asked us to pause. Saved foods remain available.', type, seconds);
    }
    const jsonType = /(?:application\/json|\+json)/i.test(response.headers.get('Content-Type') || '');
    if (!jsonType) throw new LookupError(transport === 'server' ? 'This site did not return a FoodScan API response.' : 'The food API returned a page rather than product JSON.', transport === 'server' ? 'deployment' : 'upstream_format');
    if (Number(response.headers.get('Content-Length')) > MAX_BODY) throw new LookupError('The response exceeded the safe size limit.', 'upstream_size');
    const raw = await response.text(); if (raw.length > MAX_BODY) throw new LookupError('The response exceeded the safe size limit.', 'upstream_size');
    let body; try { body = JSON.parse(raw); } catch { throw new LookupError('The API returned unreadable JSON.', 'upstream_format'); }
    if (transport === 'server' && body?.error) {
      const code = body.error.code || 'unavailable';
      if (attempt) { attempt.requestId = body.error.requestId || null; attempt.upstream = body.error.attempts || []; }
      if (code === 'upstream_busy') { const wait = waitSeconds(body.error.retryAfter || response.headers.get('Retry-After')); cooldownUntil = Date.now() + wait * 1000; throw new LookupError(body.error.message, code, wait); }
      if (code === 'route_not_found') throw new LookupError('The FoodScan product API route is missing.', 'deployment');
      throw new LookupError(body.error.message || 'The product request failed.', code);
    }
    const nonFood = /different product type/i.test(body?.status_verbose || '') || (body?.result?.id || '').includes('different_product_type');
    if (nonFood) throw new LookupError('This barcode belongs to a different product type, not a food record.', 'not_food');
    if (body?.result?.id === 'product_not_found' || (body?.status === 0 && /product not found/i.test(body?.status_verbose || '')))
      throw new LookupError('Open Food Facts does not have this exact barcode yet. That does not mean the barcode is wrong.', 'not_found');
    if (!response.ok) throw new LookupError(`The food API returned HTTP ${response.status}.`, 'upstream_http');
    if (attempt && body?.connection) { attempt.requestId = body.connection.requestId; attempt.upstream = body.connection.attempts; }
    return body;
  } catch (error) {
    if (signal?.aborted) throw new DOMException('Lookup cancelled', 'AbortError');
    if (error instanceof LookupError) throw error;
    if (controller.signal.aborted) throw new LookupError('The connection timed out before the food database answered.', 'upstream_timeout');
    throw new LookupError(transport === 'direct'
      ? (navigator.onLine === false ? 'You appear to be offline. Saved foods still work.' : 'The food database did not answer. It is usually just busy, so please try again in a moment. Your saved foods still work.')
      : 'This browser could not reach the FoodScan server.', 'network_error');
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); if (attempt) attempt.elapsedMs = Date.now() - start; }
}
function canRecover(error) {
  // Do NOT bypass 429, 403, provider 503, a confirmed miss, or an identity mismatch.
  return ['network_error', 'upstream_network', 'upstream_unavailable', 'upstream_timeout', 'deployment', 'upstream_endpoint', 'upstream_format'].includes(error.code);
}
export async function lookupProduct(barcode, { signal, onProgress = () => {}, mode = 'auto' } = {}) {
  if (!validBarcode(barcode)) throw new LookupError('Check the barcode number and its last digit.', 'invalid');
  if (signal?.aborted) throw new DOMException('Lookup cancelled', 'AbortError');
  const wait = sleepRemaining(); if (wait) throw new LookupError('Please wait for the database request pause to finish.', 'rate_limited', wait);
  const report = { appVersion: VERSION, barcode, startedAt: new Date().toISOString(), outcome: 'running', attempts: [] };
  latest = report;
  const transports = mode === 'server' ? ['server'] : mode === 'direct' ? ['direct'] : preferredDirectUntil > Date.now() ? ['direct', 'server'] : ['server', 'direct'];
  let finalError;
  for (let index = 0; index < transports.length; index++) {
    const transport = transports[index];
    if (signal?.aborted) throw new DOMException('Lookup cancelled', 'AbortError');
    if (transport === 'direct') {
      const now = Date.now(); while (directReads.length && directReads[0] <= now - 60000) directReads.shift();
      if (directReads.length >= 10) { finalError = new LookupError('This browser reached its temporary direct-lookup budget. Please wait.', 'local_rate_limited', Math.ceil((directReads[0] + 60000 - now) / 1000)); break; }
      directReads.push(now);
    }
    onProgress({ transport, recovering: index > 0, message: index > 0 ? 'Recovering the connection to the same food database...' : transport === 'direct' ? 'Looking up this barcode directly with Open Food Facts...' : 'Looking up this barcode through the FoodScan server...' });
    const url = transport === 'server' ? `/api/product/${encodeURIComponent(barcode)}` : directURL(barcode);
    const attempt = { transport, endpoint: transport === 'server' ? url : `${OFF_ORIGIN}/api/v3/product/${barcode}`, httpStatus: null, elapsedMs: 0 };
    report.attempts.push(attempt);
    try {
      const payload = await readJSON(url, { signal, transport, timeout: transport === 'server' ? 9500 : 9000, attempt });
      const returned = String(payload?.product?.code || payload?.code || '');
      if (!validBarcode(returned) || returned.padStart(14, '0') !== barcode.padStart(14, '0')) throw new LookupError('The database returned a different barcode. No substitute was used.', 'upstream_mismatch');
      const product = parseProduct(payload, barcode);
      if (!product) throw new LookupError('The database has a record, but it contains no usable product information.', 'incomplete');
      report.outcome = 'success'; report.matchedBarcode = product.barcode; report.productName = product.name; report.transport = transport;
      attempt.outcome = 'success'; report.finishedAt = new Date().toISOString();
      if (transport === 'direct') preferredDirectUntil = Date.now() + 120000; else preferredDirectUntil = 0;
      product.connection = { transport, recovered: index > 0, requestId: attempt.requestId || null };
      return product;
    } catch (error) {
      if (error?.name === 'AbortError') { report.outcome = 'cancelled'; throw error; }
      finalError = error instanceof LookupError ? error : new LookupError('The request could not be completed.', 'unavailable');
      attempt.outcome = 'failed'; attempt.errorCode = finalError.code;
      if (!canRecover(finalError)) break;
    }
  }
  report.outcome = finalError?.code === 'not_found' ? 'not_found' : 'failed'; report.finishedAt = new Date().toISOString();
  finalError ||= new LookupError('The food database could not be reached.'); finalError.diagnostics = JSON.parse(JSON.stringify(report));
  throw finalError;
}
export async function probeBackend({ signal } = {}) {
  const attempt = { transport: 'health', endpoint: '/api/health', httpStatus: null, elapsedMs: 0 };
  try {
    const body = await readJSON('/api/health', { signal, timeout: 4500, attempt });
    if (body?.app !== 'FoodScan' || body?.backend !== 'ready') throw new LookupError('The server response is not the FoodScan health endpoint.', 'deployment');
    return { ...attempt, outcome: 'ready', version: String(body.version || 'unknown'), upstream: 'not-checked', contactConfigured: Boolean(body.contactConfigured) };
  } catch (error) { if (error?.name === 'AbortError') throw error; return { ...attempt, outcome: 'failed', errorCode: error.code || 'network_error', message: error.message }; }
}

const categoryCache=new Map(),searchReads=[];
const CATEGORY_RE=/^[a-z]{2}:[a-z0-9][a-z0-9-]{1,100}$/,COUNTRY_RE=/^[a-z][a-z-]{2,40}$/;
/** Popular products in one source category, optionally limited to a country where they are sold. */
export async function searchCategory(category,{signal,country='',full=false}={}){
 if(!CATEGORY_RE.test(category))throw new LookupError('Choose a category supplied by the source.','invalid');
 if(country&&!COUNTRY_RE.test(country))country='';
 const key=`${category}|${country}|${full}`,cached=categoryCache.get(key);
 if(cached&&Date.now()-cached.fetchedAt<3600000)return cached;
 const pause=sleepRemaining();if(pause)throw new LookupError('The provider request pause has not finished.','rate_limited',pause);
 let payload;
 try{payload=await readJSON(`/api/alternatives?category=${encodeURIComponent(category)}${country?`&country=${encodeURIComponent(country)}`:''}${full?'&detail=full':''}`,{signal,timeout:9500});}
 catch(error){
  if(!canRecover(error)||error.name==='AbortError')throw error;
  const now=Date.now();while(searchReads.length&&searchReads[0]<now-60000)searchReads.shift();
  if(searchReads.length>=4)throw new LookupError('Please pause before another category search.','local_rate_limited',60);searchReads.push(now);
  const url=new URL(`${OFF_ORIGIN}/api/v2/search`);url.searchParams.set('categories_tags',category);if(country)url.searchParams.set('countries_tags',`en:${country}`);url.searchParams.set('page_size','24');url.searchParams.set('page','1');url.searchParams.set('fields',OFF_FIELDS);url.searchParams.set('app_name','FoodScan');url.searchParams.set('app_version',VERSION);
  payload=await readJSON(url.href,{signal,timeout:8500,transport:'direct'});
 }
 if(!Array.isArray(payload?.products))throw new LookupError('The category response contained no product list.','upstream_format');
 const at=Number.isFinite(payload.fetchedAt)?payload.fetchedAt:Date.now();
 const products=payload.products.slice(0,24).map(p=>validBarcode(String(p?.code||''))?parseProduct({status:'success',product:p,fetchedAt:at},String(p.code)):null).filter(Boolean);
 const result={products,category,country,fetchedAt:at,checked:payload.products.length};
 if(categoryCache.size>=12)categoryCache.delete(categoryCache.keys().next().value);categoryCache.set(key,result);return result;
}

/** Name search. The FoodScan server answers first (dedicated search service, legacy search, cached fallback);
 *  the browser only asks Open Food Facts directly if the server itself cannot be reached. */
export async function searchProducts(term,{signal,full=false}={}){
 const q=String(term||'').trim().slice(0,80);
 if(q.length<2)throw new LookupError('Type at least 2 characters to search.','invalid');
 if(signal?.aborted)throw new DOMException('Search cancelled','AbortError');
 const pause=sleepRemaining();if(pause)throw new LookupError('The provider request pause has not finished.','rate_limited',pause);
 let payload;
 try{payload=await readJSON(`/api/search?q=${encodeURIComponent(q)}${full?'&detail=full':''}`,{signal,timeout:9500});}
 catch(error){
  if(!canRecover(error)||error.name==='AbortError')throw error;
  // Legacy search sends CORS headers and works from a browser; the newer endpoints do not.
  const url=new URL(`${OFF_ORIGIN}/cgi/search.pl`);
  url.searchParams.set('search_terms',q);url.searchParams.set('search_simple','1');url.searchParams.set('action','process');url.searchParams.set('json','1');
  url.searchParams.set('sort_by','unique_scans_n');url.searchParams.set('page_size','12');url.searchParams.set('fields',OFF_FIELDS);
  payload=await readJSON(url.href,{signal,timeout:9000,transport:'direct'});
 }
 if(!Array.isArray(payload?.products))throw new LookupError('The search returned no product list.','upstream_format');
 const at=Number.isFinite(payload.fetchedAt)?payload.fetchedAt:Date.now();
 return payload.products.map(p=>{
  const code=String(p?.code||'');
  if(!validBarcode(code))return null;
  try{return parseProduct({status:'success',product:p,fetchedAt:at},code);}catch{return null;}
 }).filter(Boolean).slice(0,12);
}
