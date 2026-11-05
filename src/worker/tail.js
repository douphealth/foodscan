/* v63: cloud backup, hardened (replaces the v52-v62 token endpoint).
 * Off unless FOODSCAN_SYNC=1 and a D1 binding FOOD_DB exist. The shipped app does not call it, so it is dormant by default.
 * The backup key is a client-generated 256-bit secret sent only in the Authorization header (never in the address, so it is never logged);
 * the server stores only its SHA-256, accepts only an opaque base64 blob (a readable JSON backup is refused), caps size, rows and write
 * rate, answers unknown keys with a plain 404, lets the owner delete, and forgets backups after 180 days. */
const FS63_SYNC_MAX = 262144, FS63_SYNC_ROWS = 20000, FS63_SYNC_RETENTION = 180 * 86400000, FS63_SYNC_GAP = 5000;
const fs63SyncReady = new WeakMap();
const fs63Sha = async text => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(b => b.toString(16).padStart(2, '0')).join('');
const fs63Token = request => (request.headers.get('Authorization') || '').match(/^Bearer ([A-Za-z0-9_-]{43,128})$/)?.[1] || null;
async function fs63Sync(request, env) {
  if (env?.FOODSCAN_SYNC !== '1' || !env?.FOOD_DB) return error('route_not_found', 'Unknown API route.', 404);
  if (new URL(request.url).searchParams.has('token')) return error('token_in_url_refused', 'Send the backup key in the Authorization header, never in the address.', 400);
  const db = env.FOOD_DB, headers = { 'Cache-Control': 'no-store' };
  try {
    if (!fs63SyncReady.has(db)) fs63SyncReady.set(db, db.prepare('CREATE TABLE IF NOT EXISTS cloud_sync_v2(id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)').run().catch(e => { fs63SyncReady.delete(db); throw e; }));
    await fs63SyncReady.get(db);
    if (request.method === 'POST') {
      const token = fs63Token(request); if (!token) return error('unauthorized', 'A 256-bit backup key is required.', 401, {}, headers);
      let body; try { body = JSON.parse(await boundedRequest(request, FS63_SYNC_MAX + 2048)); } catch { return error('bad_request', 'Send JSON.', 400, {}, headers); }
      const data = body?.data;
      if (typeof data !== 'string' || !data || data.length > FS63_SYNC_MAX || !/^[A-Za-z0-9+/_=-]+$/.test(data)) return error('bad_request', 'The backup must be one encrypted base64 blob of at most 256 KB.', 400, {}, headers);
      const id = await fs63Sha(token), now = Date.now();
      const existing = await db.prepare('SELECT updated_at FROM cloud_sync_v2 WHERE id=?').bind(id).first();
      if (existing && now - existing.updated_at < FS63_SYNC_GAP) return error('rate_limited', 'Wait a few seconds between backups.', 429, {}, { ...headers, 'Retry-After': '5' });
      if (!existing) {
        const count = async () => (await db.prepare('SELECT COUNT(*) AS n FROM cloud_sync_v2').first())?.n || 0;
        if (await count() >= FS63_SYNC_ROWS) {
          await db.prepare('DELETE FROM cloud_sync_v2 WHERE updated_at<?').bind(now - FS63_SYNC_RETENTION).run();
          if (await count() >= FS63_SYNC_ROWS) return error('capacity', 'Backups are full. Try again later.', 503, {}, headers);
        }
      }
      await db.prepare('INSERT INTO cloud_sync_v2(id,payload,created_at,updated_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at').bind(id, data, now, now).run();
      return new Response(null, { status: 204, headers });
    }
    if (request.method === 'GET' || request.method === 'DELETE') {
      const token = fs63Token(request); if (!token) return error('unauthorized', 'A 256-bit backup key is required.', 401, {}, headers);
      const id = await fs63Sha(token);
      if (request.method === 'DELETE') { await db.prepare('DELETE FROM cloud_sync_v2 WHERE id=?').bind(id).run(); return new Response(null, { status: 204, headers }); }
      const row = await db.prepare('SELECT payload, updated_at FROM cloud_sync_v2 WHERE id=? AND updated_at>=?').bind(id, Date.now() - FS63_SYNC_RETENTION).first();
      if (!row) return error('not_found', 'No backup found.', 404, {}, headers);
      return json({ status: 'success', data: row.payload, updatedAt: row.updated_at }, 200, headers);
    }
    return error('method_not_allowed', 'Use GET, POST or DELETE.', 405, {}, headers);
  } catch { return error('sync_error', 'Cloud backup failed.', 500, {}, headers); }
}
/* END v63 sync */

/* v60.1: static source catalogue, isolated from upstream availability. */
const fs60Files=new Map(),fs61AssetText=new WeakMap(),fs61AssetChecks=new WeakMap();
const FS61_ROOT='/assets/greece-r20261030/';
async function fs60ReadAsset(request,env,name){
 if(!/^(index|categories|search|codes-\d{2}|part-[a-z0-9-]+)\.json$/.test(name))throw new Error('catalogue_path');
 const key=new URL(request.url).origin+'|'+name;
 if(!fs60Files.has(key)){
  const task=(async()=>{const response=await env.ASSETS.fetch(new Request(new URL(FS61_ROOT+name,request.url)));if(!response.ok)throw new Error('catalogue_asset_missing');const raw=await response.text();if(raw.length>4*1024*1024)throw new Error('catalogue_asset_too_large');const data=JSON.parse(raw);if(data.schema!==2)throw new Error('catalogue_asset_invalid');fs61AssetText.set(data,raw);return data;})();
  fs60Files.set(key,task);task.catch(()=>{if(fs60Files.get(key)===task)fs60Files.delete(key);});
  if(fs60Files.size>48)for(const old of fs60Files.keys())if(old!==key&&!old.endsWith('|index.json')){fs60Files.delete(old);break;}
 }
 return fs60Files.get(key);
}
async function fs60Manifest(request,env,allowExpired=false){
 const m=await fs60ReadAsset(request,env,'index.json');
 if(m.schema!==2||m.country!=='greece'||!Number.isFinite(m.exportedAt)||m.exportedAt<=0||m.exportedAt>Date.now()+300000||Date.now()-m.exportedAt>(allowExpired?365:90)*86400000)throw new Error('catalogue_expired');
 return m;
}
async function fs61Rows(request,env,m,files){
 const products=[],failures=[];
 for(let i=0;i<files.length;i+=3){
  const batch=await Promise.allSettled(files.slice(i,i+3).map(async name=>{
   if(!m.shards[name])throw new Error('catalogue_path');const data=await fs60ReadAsset(request,env,name);
   if(data.revision!==m.revision||data.exportedAt!==m.exportedAt||!Array.isArray(data.products)||data.products.length!==m.shards[name].count)throw new Error('catalogue_revision_mismatch');
   if(m.integrity==='sha256'){
    if(!fs61AssetChecks.has(data)){const check=(async()=>{const bytes=new TextEncoder().encode(fs61AssetText.get(data)||'');const expected=m.shards[name];if(bytes.length!==expected.bytes)throw new Error('catalogue_integrity_failed');const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');if(hash!==expected.sha256)throw new Error('catalogue_integrity_failed');})();fs61AssetChecks.set(data,check);check.catch(()=>{fs61AssetChecks.delete(data);fs60Files.delete(new URL(request.url).origin+'|'+name);});}
    await fs61AssetChecks.get(data);
   }return data.products;
  }));
  for(let j=0;j<batch.length;j++){const item=batch[j];if(item.status==='fulfilled')products.push(...item.value);else failures.push({file:files[i+j],code:String(item.reason.message||'catalogue_unavailable')});}
 }
 return {products,failures};
}
async function fs60LocalAlternatives(request,env){
 const u=new URL(request.url),country=marketCountry(request),category=u.searchParams.get('category')||'',page=marketPage(request);
 if(u.searchParams.get('refresh')==='1')return null;
 if(!/^[a-z]{2}:[a-z0-9][a-z0-9-]{1,100}$/.test(category))return error('invalid_category','Choose a source-listed food category.',400);
 if(!page)return error('invalid_page','Page must be from 1 to 50.',400);
 try{
  const m=await fs60Manifest(request,env),index=await fs60ReadAsset(request,env,'categories.json');
  if(index.revision!==m.revision)throw new Error('catalogue_revision_mismatch');
  const data=await fs61Rows(request,env,m,index.categories[category]||[]);
  const products=data.products.filter(p=>(!country||p.countries_tags?.includes('en:'+country))&&p.categories_tags?.includes(category));
  if(!products.length&&(data.failures.length||country&&country!=='greece'))return null;
  products.sort((a,b)=>String(a.code).localeCompare(String(b.code)));const size=48,total=products.length;
  return json({products:products.slice((page-1)*size,page*size),country:country||null,category,page,total,hasMore:page*size<total,partial:false,recordMode:'dated-catalogue-record-v1',provider:'off-catalogue',source:'Open Food Facts daily CSV export',fetchedAt:m.exportedAt,
   catalogue:{status:data.failures.length?'partial':'ready',datasetMarket:'greece',market:country||'any',marketCoverage:country&&country!=='greece'?'listed-subset':'greece-snapshot',failedFiles:data.failures,count:m.productCount,exportedAt:m.exportedAt,revision:m.revision,source:m.source},version:VERSION,coverage:m.coverage},200,{'X-FoodScan-Cache':'BUNDLED-CATALOGUE','Cache-Control':'public, max-age=300'});
 }catch{return null;}
}
async function fs60LocalProduct(request,env,code){
 try{
  const m=await fs60Manifest(request,env,true),key=String(code).padStart(14,'0'),bucket=String(Number(key.slice(-6))%32).padStart(2,'0'),index=await fs60ReadAsset(request,env,`codes-${bucket}.json`);
  if(index.revision!==m.revision)return null;const file=index.codes?.[key];if(!file)return null;
  const data=await fs61Rows(request,env,m,[file]),product=data.products.find(p=>String(p.code).padStart(14,'0')===key);if(!product)return null;
  return json({status:1,product,fetchedAt:m.exportedAt,catalogueSnapshot:{provider:'openfoodfacts-daily-export',exportedAt:m.exportedAt,revision:m.revision,source:m.source},version:VERSION},200,{'X-FoodScan-Cache':'DATED-CATALOGUE'});
 }catch{return null;}
}
