/* ===== FoodScan 80: labelled estimates + live data refresh =====
 * 1. ESTIMATES. /assets/gr-est-v80/e-NN.json (64 files by barcode) holds, only for barcodes that have NO recorded price, an estimate
 *    from comparable products with a recorded price. It is returned as `estimate`, a separate object: never an offer, never ranked.
 *    Its range is the measured error of the method (leave-one-out, checked on held-out data); see manifest.json in the same folder.
 * 2. REFRESH WITHOUT REDEPLOYING. The daily refresh job (.github/workflows/refresh-prices.yml) publishes newer copies of the seed
 *    files (seeds/*.json) and the estimate shards to the `prices-data` branch. When FS_V80_REMOTE (or FOODSCAN_PRICE_DATA_URL) is
 *    reachable, the NEWER of the bundled and the remote copy is used; a missing, older, invalid or unreachable remote copy is ignored.
 *    FOODSCAN_PRICE_DATA_URL=off switches it off. Every observation keeps its own date. */
const FS_V80_REMOTE = 'https://raw.githubusercontent.com/douphealth/foodscan/prices-data';
const FS_V80_TTL = 30 * 60 * 1000;
const FS_EST_ROOT = '/assets/gr-est-v80/';
const FS_EST_SHARDS = 64;
const fsV80Base = env => { const v = env?.FOODSCAN_PRICE_DATA_URL; if (v === 'off') return ''; return typeof v === 'string' && /^https:\/\/[^\s]+$/.test(v) ? v.replace(/\/+$/, '') : FS_V80_REMOTE; };
const fsV80Cache = new Map();
function fsV80Cached(key, load) {
  const hit = fsV80Cache.get(key);
  if (hit && Date.now() - hit.at < FS_V80_TTL) return hit.task;
  const task = load(); const entry = {at:Date.now(), task}; fsV80Cache.set(key, entry);
  task.catch(() => { if (fsV80Cache.get(key) === entry) fsV80Cache.delete(key); });
  if (fsV80Cache.size > 200) for (const [k, v] of fsV80Cache) { if (Date.now() - v.at > FS_V80_TTL) fsV80Cache.delete(k); }
  return task;
}
/** Bundled copy and (optionally) remote copy, in parallel; the newer by `stamp` wins. */
async function fsV80Read(request, env, bundledPath, remoteName, validate, stamp, accept = () => true) {
  const own = async () => {
    const res = await env.ASSETS.fetch(new Request(new URL(bundledPath, request.url)));
    if (!res.ok) throw new Error('missing');
    const raw = await res.text(); if (raw.length > 4 * 1024 * 1024) throw new Error('too_large');
    const data = JSON.parse(raw); if (!validate(data)) throw new Error('invalid'); return data;
  };
  const remote = async () => {
    const base = fsV80Base(env); if (!base) return null;
    const res = await fetch(base + '/' + remoteName, {signal:AbortSignal.timeout(1500), headers:{'Accept':'application/json'}, cf:{cacheEverything:true, cacheTtlByStatus:{'200-299':1800, '404':60, '500-599':0}}});
    if (!res.ok) return null;
    const raw = await res.text(); if (raw.length > 4 * 1024 * 1024) return null;
    const data = JSON.parse(raw); return validate(data) ? data : null;
  };
  const [a, b] = await Promise.all([own().catch(() => null), remote().catch(() => null)]);
  if (!a && !b) throw new Error('unavailable');
  if (a && b) return (stamp(b) || 0) > (stamp(a) || 0) && accept(b, a) ? Object.assign(b, {origin:'remote'}) : Object.assign(a, {origin:'bundled'});
  return b ? Object.assign(b, {origin:'remote'}) : Object.assign(a, {origin:'bundled'});
}
const fsEstShardId = code => String(Number(String(code).padStart(14, '0').slice(-6)) % FS_EST_SHARDS).padStart(2, '0');
const fsEstShard = (request, env, code) => fsV80Cached(new URL(request.url).origin + '|e-' + fsEstShardId(code), () =>
  fsV80Read(request, env, FS_EST_ROOT + 'e-' + fsEstShardId(code) + '.json', 'e-' + fsEstShardId(code) + '.json', d => d && d.v === 80 && d.items && typeof d.items === 'object', d => Date.parse(d.built)));
const fsEstManifest = (request, env) => fsV80Cached(new URL(request.url).origin + '|e-manifest', () =>
  fsV80Read(request, env, FS_EST_ROOT + 'manifest.json', 'manifest.json', d => d && d.version === 80 && d.estimator, d => Date.parse(d.built)));
/** Estimate record from a shard -> the payload object (checked again by the client). */
function fsEstObject(e, manifest) {
  if (!e || typeof e !== 'object' || !['kg', 'l', 'pcs'].includes(e.u) || !(e.m > 0) || !(e.a > 0) || !(e.b >= e.m) || !['A', 'B', 'C', 'D', 'E'].includes(e.c)) return null;
  const cal = manifest?.estimator?.classes?.[e.c];
  const label = s => /^pk\d+$/.test(s) ? 'Παρατηρητήριο Τιμών' : s === 'bz' ? 'bazaar-online.gr' : s === 'li' ? 'lidl.gr' : '';
  return {
    unit:e.u, unitLow:e.a, unitMid:e.m, unitHigh:e.b, pack:Array.isArray(e.p) && e.p.length === 3 ? e.p : null, n:e.n, cls:e.c, category:fsPriceText(e.g || '', 60),
    examples:(Array.isArray(e.x) ? e.x : []).slice(0, 3).map(x => ({name:fsPriceText(x[0], 90), price:Number(x[1]), source:label(String(x[2])), date:fsPriceISO(x[3]), similarity:Number(x[4]) || 0})),
    validation:cal && cal.usable ? {medianErrorPct:cal.medianAbsPctError, coverage80:manifest.estimator?.holdout?.[e.c]?.coverage80 ?? null, tested:cal.n} : null,
    builtAt:fsPriceISO(String(manifest?.built || '')),
  };
}
async function fsEstimateFor(request, env, code) {
  const [shard, manifest] = await Promise.all([fsEstShard(request, env, code), fsEstManifest(request, env).catch(() => null)]);
  const e = shard.items[fsPriceKey(code)]; if (!e?.e) return null;
  const estimate = fsEstObject(e.e, manifest); if (!estimate) return null;
  return {estimate, name:fsPriceText(e.n || '', 120), meta:{builtAt:manifest?.built || shard.built || null, origin:shard.origin || 'bundled'}};
}
/** The four source seeds (observatory, e-katanalotis, Bazaar, Lidl) are SHARDED (see tools/lib/shard-seeds.mjs): the manifest is ~2 KB, a
 *  lookup reads one ~9 KB shard per source. That is ~1 ms of parsing instead of ~18 ms for the monolithic files, which is more than the
 *  Workers Free plan's ~10 ms CPU budget on a cold start. This loads the MANIFEST: the bundled one, or a NEWER remote one that kept at
 *  least 90 % of the bundled products (a truncated crawl never replaces a good file). A monolithic remote file still works (older job). */
function fsGrSeedLegacy(request, env, id) {
  const def = FS_GR_SOURCES[id]; if (!def || !env?.ASSETS) return Promise.resolve(null);
  return fsV80Cached(new URL(request.url).origin + '|seed|' + id, async () => {
    const valid = d => [1, 2].includes(d?.schema) && d.products && typeof d.products === 'object' && fsPriceISO(d.source?.snapshot);
    const count = d => d.sharded ? Number(d.source?.counts?.products) || 0 : Object.keys(d.products).length;
    const stamp = d => Date.parse(d.source?.fetched_at || d.source?.snapshot) || 0;
    const own = async () => {
      const res = await env.ASSETS.fetch(new Request(new URL(FS_GR_SEED_ROOT + def.file, request.url)));
      if (!res.ok) throw new Error('seed_missing');
      const raw = await res.text(); if (raw.length > 4 * 1024 * 1024) throw new Error('seed_too_large');
      const data = JSON.parse(raw); if (!valid(data)) throw new Error('seed_invalid'); return data;
    };
    const remote = async () => {
      const base = fsV80Base(env); if (!base) return null;
      const res = await fetch(base + '/seeds/' + def.file, {signal:AbortSignal.timeout(1500), headers:{'Accept':'application/json'}, cf:{cacheEverything:true, cacheTtlByStatus:{'200-299':1800, '404':60, '500-599':0}}});
      if (!res.ok) return null;
      const raw = await res.text(); if (raw.length > 4 * 1024 * 1024) return null;
      const data = JSON.parse(raw); return valid(data) ? data : null;
    };
    const [a, b] = await Promise.all([own().catch(() => null), remote().catch(() => null)]);
    if (!a && !b) throw new Error('unavailable');
    if (a && b && stamp(b) > stamp(a) && count(b) >= count(a) * 0.9) return {...b, origin:'remote', alt:a};
    return a ? {...a, origin:'bundled'} : {...b, origin:'remote'};
  }).catch(() => null);
}
/** One source's seed for one barcode: the manifest merged with that barcode's shard (bundled, or remote when the remote manifest won;
 *  if the remote shard cannot be read the consistent bundled set is used instead). With no code (health) the manifest alone. */
async function fsGrSeed(request, env, id, code=null) {
  const def = FS_GR_SOURCES[id]; if (!def || !env?.ASSETS) return null;
  try {
    let man = await fsGrSeedLegacy(request, env, id); if (!man) return null;
    if (!man.sharded || code === null) return man;
    const origin = new URL(request.url).origin, shardId = fsPriceKey(code).slice(-2);
    const read = m => {
      const dir = /^[a-z0-9-]+\/$/.test(m.sharded) ? m.sharded : null; if (!dir) return Promise.resolve(null);
      const name = dir + shardId + '.json', ok = d => d?.schema === 2 && d.products && Array.isArray(d.rows) && d.source?.snapshot === m.source.snapshot;
      return fsV80Cached(origin + '|seedshard|' + id + '|' + m.origin + '|' + m.source.snapshot + '|' + shardId, async () => {
        if (m.origin === 'remote') {
          const res = await fetch(fsV80Base(env) + '/seeds/' + name, {signal:AbortSignal.timeout(1500), headers:{'Accept':'application/json'}, cf:{cacheEverything:true, cacheTtlByStatus:{'200-299':1800, '404':60, '500-599':0}}});
          if (!res.ok) throw new Error('remote_shard');
          const raw = await res.text(); if (raw.length > 1024 * 1024) throw new Error('shard_too_large');
          const d = JSON.parse(raw); if (!ok(d)) throw new Error('seed_invalid'); return d;
        }
        const res = await env.ASSETS.fetch(new Request(new URL(FS_GR_SEED_ROOT + name, request.url)));
        if (res.status === 404) return {products:{}, rows:[]};
        if (!res.ok) throw new Error('seed_missing');
        const raw = await res.text(); if (raw.length > 1024 * 1024) throw new Error('shard_too_large');
        const d = JSON.parse(raw); if (!ok(d)) throw new Error('seed_invalid'); return d;
      }).catch(() => null);
    };
    let part = await read(man);
    if (!part && man.origin === 'remote' && man.alt?.sharded) { man = {...man.alt, origin:'bundled'}; part = await read(man); }
    if (!part) return null;
    return {...man, products:part.products, rows:part.rows};
  } catch { return null; }
}
/** GET /api/prices/health: the v79 report plus the estimator and the data origin. */
async function fsPriceHealth(request, env, now=Date.now()) {
  const res = await fsPriceHealthV79(request, env, now); let body; try { body = await res.clone().json(); } catch { return res; }
  try {
    const m = await fsEstManifest(request, env);
    body.estimator = {builtAt:m.built, origin:m.origin || 'bundled', referenceItems:m.estimator?.referenceItems || 0, estimates:m.withEstimate || 0, byClass:m.estimatesByClass || {}, validation:m.estimator?.classes || null, holdout:m.estimator?.holdout || null};
  } catch { body.estimator = null; }
  body.remote = {url:fsV80Base(env) || null, note:'The newer of the bundled and the remote copy is used for the seed files and the estimates.'};
  return fsPriceJson(body, res.status);
}
/* ===== end FoodScan 80 ===== */
