import {parseProduct,validBarcode} from './domain.mjs';
export const CATALOGUE_URL='/assets/{{catalogue}}/index.json';
export const SNAPSHOT_MAX_AGE=90*86400000;
const ROOT='/assets/{{catalogue}}/';
const SEARCH_URL='/assets/search-index-{{suffix}}.json';
const ageOK=(at,now=Date.now(),max=SNAPSHOT_MAX_AGE)=>Number.isFinite(at)&&at>0&&at<=now+300000&&now-at<=max;
/** Past 90 days a snapshot is no longer evidence for recommendations, but lookups and search keep working (labelled) for up to a year. */
export const LOOKUP_MAX_AGE=365*86400000;
export function snapshotUsable(p,now=Date.now()) {
 const s=p?.catalogueSnapshot;
 return p?.provenance==='off'&&!p.partial&&validBarcode(String(p.barcode||''))&&s?.provider==='openfoodfacts-daily-export'&&ageOK(s.exportedAt,now);
}
const abortError=()=>new DOMException('Aborted','AbortError');
class CatalogueError extends Error{constructor(code,status=0){super(code);this.name='CatalogueError';this.code=code;this.status=status;}}
function waitFor(task,signal){
 if(signal?.aborted)return Promise.reject(abortError());
 return new Promise((resolve,reject)=>{const cancel=()=>reject(abortError());signal?.addEventListener('abort',cancel,{once:true});task.then(resolve,reject).finally(()=>signal?.removeEventListener('abort',cancel));});
}
const fold=value=>String(value||'').normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/ς/g,'σ').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
/* 62.0 search key. Greek and Latin spellings of the same word reduce to one skeleton, so "γιωτης", "Giotis" and "GIOTIS" meet, and a shopper
 * typing Greeklish ("galaktos", "feta", "xalvas") finds the Greek record. The same function builds the index at release time and folds the
 * query in the browser, so the two can never drift. Accents, final sigma, punctuation and double letters are normalised first. */
const GREEK={'α':'a','β':'v','γ':'g','δ':'d','ε':'e','ζ':'z','η':'i','θ':'th','ι':'i','κ':'k','λ':'l','μ':'m','ν':'n','ξ':'x','ο':'o','π':'p','ρ':'r','σ':'s','τ':'t','υ':'y','φ':'f','χ':'ch','ψ':'ps','ω':'o'};
const DIGRAPHS=[[/ou/g,'u'],[/ei/g,'i'],[/oi/g,'i'],[/ai/g,'e'],[/ph/g,'f'],[/th/g,'t'],[/ch/g,'x'],[/kh/g,'x'],[/y/g,'i'],[/w/g,'v'],[/ps/g,'p'],[/mp/g,'b'],[/nt/g,'d'],[/gk/g,'g'],[/gg/g,'g'],[/(.)\1+/g,'$1']];
export function skeleton(value){
 // Greek digraphs first (ου, ει, οι, αι, μπ, ντ, γκ, αυ/ευ), then letter by letter.
 let s=fold(value).replace(/ου/g,'u').replace(/[εου]ι/g,'i').replace(/αι/g,'e').replace(/μπ/g,'b').replace(/ντ/g,'d').replace(/γ[κγ]/g,'g')
  .replace(/([αε])υ(?=[κξπστφχψ])/g,'$1f').replace(/([αε])υ/g,'$1v');
 s=s.replace(/[α-ω]/g,c=>GREEK[c]??c);
 for(const [re,to] of DIGRAPHS)s=s.replace(re,to);
 return s.replace(/\s+/g,' ').trim();
}
const market=value=>value==='any'||!value?'':String(value).toLowerCase().replace(/^en:/,'');
const keyOf=value=>String(value).padStart(14,'0');
const listed=(p,country)=>!country||p.countries?.includes('en:'+country);
function trimLRU(map,max,protectedKey){for(const key of map.keys()){if(map.size<=max)break;if(key!==protectedKey)map.delete(key);}}
export function createCatalogue(fetcher=(...args)=>fetch(...args)){
 const cache=new Map(),raws=new Map(),normalized=new Map(),searchRows=new Map(),searchIndexes=new Map();
 const counters={requests:0,rawHits:0,normalizedHits:0,recordsParsed:0,hashChecks:0};
 function read(file){
  if(!/^(?:index|categories|search|codes-\d{2}|part-[a-z0-9-]+)\.json$/.test(file))return Promise.reject(new CatalogueError('catalogue_invalid_path'));
  if(cache.has(file)){counters.rawHits++;const hit=cache.get(file);cache.delete(file);cache.set(file,hit);return hit;}
  const job=(async()=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6000);
   try{counters.requests++;const res=await fetcher(ROOT+file,{signal:controller.signal});if(!res.ok)throw new CatalogueError(res.status===404?'catalogue_asset_missing':'catalogue_asset_unavailable',res.status);
    const text=await res.text();if(text.length>4*1024*1024)throw new CatalogueError('catalogue_asset_too_large');
    let data;try{data=JSON.parse(text);}catch{throw new CatalogueError('catalogue_asset_invalid');}
    if(!data||data.schema!==2)throw new CatalogueError('catalogue_asset_invalid');
    return {data,text};
   }catch(e){if(e.name==='AbortError')throw new CatalogueError('catalogue_asset_timeout');throw e;}finally{clearTimeout(timer);}
  })();cache.set(file,job);job.catch(()=>{if(cache.get(file)===job)cache.delete(file);});trimLRU(cache,16,'index.json');return job;
 }
 async function manifest(signal,{allowExpired=false}={}){
  const {data:m}=await waitFor(read('index.json'),signal);
  if(m.country!=='greece'||!ageOK(m.exportedAt,Date.now(),allowExpired?LOOKUP_MAX_AGE:SNAPSHOT_MAX_AGE))throw new CatalogueError('catalogue_expired');
  if(!m.shards||!m.families||m.barcodeBuckets!==32||!Number.isInteger(m.productCount)||m.productCount<=0)throw new CatalogueError('catalogue_asset_invalid');return m;
 }
 function checkRevision(batch,m){if(batch.revision!==m.revision||batch.schema!==2)throw new CatalogueError('catalogue_revision_mismatch');}
 const snapshotOf=m=>({provider:'openfoodfacts-daily-export',exportedAt:m.exportedAt,revision:m.revision,source:m.source});
 /** Fetches, size-checks and hash-checks one shard and returns its raw records. No record is parsed here: a barcode lookup parses one. */
 function loadRaw(m,file,signal){
  const cacheKey=m.revision+'|'+file;
  if(raws.has(cacheKey)){counters.normalizedHits++;const value=raws.get(cacheKey);raws.delete(cacheKey);raws.set(cacheKey,value);return waitFor(value,signal);}
  const job=(async()=>{
   const {data,text}=await read(file);checkRevision(data,m);
   if(data.exportedAt!==m.exportedAt||!Array.isArray(data.products)||data.products.length!==m.shards[file].count)throw new CatalogueError('catalogue_asset_invalid');
   const expected=m.shards[file];
   // The application origin supplies the manifest. This detects corrupt/mixed deploys,
   // not a cryptographic certification of the underlying community nutrition data.
   if(m.integrity==='sha256'){
    if(!globalThis.crypto?.subtle)throw new CatalogueError('catalogue_integrity_unavailable');
    const bytes=new TextEncoder().encode(text);if(bytes.length!==expected.bytes)throw new CatalogueError('catalogue_integrity_failed');
    const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');counters.hashChecks++;
    if(hash!==expected.sha256)throw new CatalogueError('catalogue_integrity_failed');
   }
   const byRaw=new Map(),parsed=new Map();
   for(const raw of data.products){const code=keyOf(raw.code);if(byRaw.has(code))throw new CatalogueError('catalogue_duplicate_barcode');byRaw.set(code,raw);}
   return {raws:data.products,byRaw,parsed};
  })();raws.set(cacheKey,job);job.catch(()=>{if(raws.get(cacheKey)===job)raws.delete(cacheKey);cache.delete(file);});trimLRU(raws,12,cacheKey);
  return waitFor(job,signal);
 }
 function parseOne(m,shard,raw){
  const code=keyOf(raw.code);if(shard.parsed.has(code))return shard.parsed.get(code);
  const value=parseProduct({product:raw,fetchedAt:m.exportedAt},String(raw.code));counters.recordsParsed++;
  const p=value&&{...value,stores:String(raw.stores||'').slice(0,500),catalogueSnapshot:snapshotOf(m)};
  shard.parsed.set(code,p||null);return p||null;
 }
 async function loadShard(m,file,signal){
  const cacheKey=m.revision+'|'+file;
  if(normalized.has(cacheKey)){counters.normalizedHits++;const value=normalized.get(cacheKey);normalized.delete(cacheKey);normalized.set(cacheKey,value);return waitFor(value,signal);}
  const job=(async()=>{
   const shard=await loadRaw(m,file);const products=[];
   for(const raw of shard.raws){const p=parseOne(m,shard,raw);if(p)products.push(p);}
   return {products,byCode:new Map(products.map(p=>[keyOf(p.barcode),p]))};
  })();normalized.set(cacheKey,job);job.catch(()=>{if(normalized.get(cacheKey)===job)normalized.delete(cacheKey);});trimLRU(normalized,8,cacheKey);
  return waitFor(job,signal);
 }
 async function rows(m,files,signal){
  const output=[],failed=[],paths=[...new Set(files)].filter(f=>m.shards[f]&&/^part-[a-z0-9-]+\.json$/.test(f));let loaded=0;
  for(let i=0;i<paths.length;i+=3){if(signal?.aborted)throw abortError();
   const results=await Promise.allSettled(paths.slice(i,i+3).map(f=>loadShard(m,f,signal)));
   for(let j=0;j<results.length;j++){const result=results[j];if(result.status==='fulfilled'){loaded++;output.push(...result.value.products);}else{if(signal?.aborted)throw abortError();failed.push({file:paths[i+j],code:result.reason.code||'catalogue_asset_unavailable'});}}
  }return {products:output,loaded,failed,requested:paths.length};
 }
 const info=(m,country='',rest={})=>({status:'ready',count:m.productCount,exportedAt:m.exportedAt,source:m.source,revision:m.revision,market:country||'any',datasetMarket:'greece',marketCoverage:country&&country!=='greece'?'listed-subset':'greece-snapshot',...rest});
 async function query(plan,{country='greece',signal}={}){
  country=market(country);const m=await manifest(signal);let files=[],filterTags=null;
  if(plan?.family&&m.families[plan.family])files=m.families[plan.family].files;
  else if(plan?.candidates?.length){const {data:index}=await waitFor(read('categories.json'),signal);checkRevision(index,m);filterTags=plan.candidates.map(c=>c.tag);files=filterTags.flatMap(tag=>index.categories?.[tag]||[]);}
  const data=await rows(m,files,signal);
  const products=data.products.filter(p=>listed(p,country)&&(!filterTags||p.categories.some(c=>filterTags.includes(c))));
  return {products,catalogue:info(m,country,{status:data.failed.length?(data.loaded?'partial':'unavailable'):'ready',loadedFiles:data.loaded,totalFiles:data.requested,failedFiles:data.failed,matchingRecords:products.length,family:plan?.family||null})};
 }
 async function product(code,{signal}={}){
  if(!validBarcode(String(code)))return null;const m=await manifest(signal,{allowExpired:true}),key=keyOf(code),bucket=String(Number(key.slice(-6))%m.barcodeBuckets).padStart(2,'0');
  const {data:index}=await waitFor(read(`codes-${bucket}.json`),signal);checkRevision(index,m);const file=index.codes?.[key];if(!file)return null;
  if(!m.shards[file])throw new CatalogueError('catalogue_invalid_path');
  const shard=await loadRaw(m,file,signal),raw=shard.byRaw.get(key);
  return raw?parseOne(m,shard,raw):null;
 }
 /** The 62.0 index carries a precomputed skeleton per row; an older deployment without it falls back to folding every row once. */
 async function searchIndex(m,signal){
  if(searchIndexes.has(m.revision))return searchIndexes.get(m.revision);
  const job=(async()=>{
   try{
    const res=await waitFor(fetcher(SEARCH_URL),signal);
    if(res.ok){const data=await res.json();if(data?.schema===2&&data.revision===m.revision&&Array.isArray(data.rows)&&data.rows.length===m.productCount)return data.rows.map(r=>({code:r[0],file:r[1],countries:r[2],text:' '+r[3]+' ',norm:r[3]}));}
   }catch(e){if(e?.name==='AbortError'&&signal?.aborted)throw e;}
   const {data:index}=await waitFor(read('search.json'),signal);checkRevision(index,m);
   return index.rows.map(row=>{const norm=skeleton(row[1]+' '+row[2]);return {code:row[0],file:row[3],countries:row[4],text:' '+norm+' ',norm};});
  })();searchIndexes.set(m.revision,job);job.catch(()=>{if(searchIndexes.get(m.revision)===job)searchIndexes.delete(m.revision);});return job;
 }
 /** Ranked, country-filtered, PAGED search over the whole index. 63.0: nothing that matches is dropped: the page is cut from the full ranking
  * (no five-shard / 80-hit ceiling), only that page's shards are fetched, and a shard that fails to load is reported (failedFiles, unavailable)
  * instead of silently shrinking the list. */
 async function search(query,{country='greece',signal,limit=20,page=1}={}){
  country=market(country);const text=skeleton(query),tokens=text.split(' ').filter(Boolean);
  const size=Math.max(1,Math.min(30,Math.floor(Number(limit))||20)),pageNo=Math.max(1,Math.min(500,Math.floor(Number(page))||1));
  if(text.length<2)return {products:[],partial:false,hasMore:false,total:0,page:pageNo,pageSize:size};
  const m=await manifest(signal,{allowExpired:true});const index=await waitFor(searchIndex(m,signal),signal);
  const hits=[];
  for(const x of index){
   if(country&&x.countries&&!x.countries.includes('en:'+country))continue;
   let ok=true;for(const token of tokens){if(!(x.text.includes(' '+token+' ')||token.length>=4&&x.text.includes(' '+token))){ok=false;break;}}
   if(!ok)continue;
   hits.push({...x,rank:(x.norm.startsWith(text)?20:0)+(x.norm.includes(text)?10:0)-x.norm.length*.001});
  }
  hits.sort((a,b)=>b.rank-a.rank||String(a.code).localeCompare(String(b.code)));
  const total=hits.length,slice=hits.slice((pageNo-1)*size,pageNo*size),expired=!ageOK(m.exportedAt);
  const files=[...new Set(slice.map(x=>x.file))].filter(f=>m.shards[f]),failed=[],shards=new Map();
  for(let i=0;i<files.length;i+=3){
   const settled=await Promise.allSettled(files.slice(i,i+3).map(f=>loadRaw(m,f,signal)));
   settled.forEach((r,j)=>{if(r.status==='fulfilled')shards.set(files[i+j],r.value);else{if(signal?.aborted)throw abortError();failed.push({file:files[i+j],code:r.reason.code||'catalogue_asset_unavailable'});}});
  }
  const products=[];let unavailable=0;
  for(const x of slice){const shard=shards.get(x.file),raw=shard?.byRaw.get(keyOf(x.code));if(!raw){unavailable++;continue;}const p=parseOne(m,shard,raw);if(p&&listed(p,country))products.push(p);else unavailable++;}
  return {products,partial:failed.length>0,recordMode:'dated-catalogue-record-v1',provider:'off-catalogue',source:'Open Food Facts catalogue snapshot',hasMore:pageNo*size<total,total,page:pageNo,pageSize:size,unavailable,catalogue:info(m,country,{matchingRecords:total,failedFiles:failed,status:failed.length?'partial':expired?'expired':'ready',expired})};
 }
 return {query,product,search,manifest,stats:()=>({...counters,rawFiles:cache.size,normalizedShards:normalized.size}),clear:()=>{cache.clear();raws.clear();normalized.clear();searchRows.clear();searchIndexes.clear();}};
}
export const marketCatalogue=createCatalogue();
