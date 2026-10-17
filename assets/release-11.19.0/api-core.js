export * from '/assets/release-11.3.0/lib/api.js?engine=11.10.0';
import {LookupError,directURL} from '/assets/release-11.3.0/lib/api.js?engine=11.10.0';
import {validBarcode,parseProduct,validateStoredProduct,VERSION} from './model.js';
import {reportAudit} from './report-audit.js';
const SERVER_TIMEOUT=20000,DIRECT_TIMEOUT=9000,MAX_BODY=600000,KEY='foodscan-public-query-cache-v5',FRESH=300000,MAX_AGE=7*86400000;
const memory=new Map(),pending=new Map(),searchReads=[];let cooldownUntil=0,latest=null,lastCategory=null;
const temporary=e=>['network_error','upstream_network','upstream_timeout','deployment','upstream_endpoint','upstream_format','upstream_http','upstream_busy','rate_limited','local_rate_limited','offline'].includes(e?.code);
const cancelled=()=>new DOMException('Request cancelled','AbortError');
const seconds=v=>{const n=Number(v);if(Number.isFinite(n)&&n>0)return Math.min(86400,Math.ceil(n));const t=(Date.parse(v)-Date.now())/1000;return Number.isFinite(t)&&t>0?Math.min(86400,Math.ceil(t)):60;};
function hydrate(entry){if(!entry||!Number.isFinite(entry.savedAt)||Date.now()-entry.savedAt>MAX_AGE||Date.now()<entry.savedAt)return null;const products=Array.isArray(entry.result?.products)?entry.result.products.map(validateStoredProduct).filter(Boolean):null;if(!products)return null;return {...entry,result:{...entry.result,products}};}
function cached(key){const known=memory.get(key);if(known)return hydrate(known);try{const rows=JSON.parse(localStorage.getItem(KEY)||'[]');const row=Array.isArray(rows)?rows.find(x=>x?.key===key):null;const value=hydrate(row);if(value){memory.set(key,value);return value;}}catch{}return null;}
function remember(key,result){const entry={key,savedAt:Date.now(),result};memory.set(key,entry);if(memory.size>12)memory.delete(memory.keys().next().value);try{let rows=[entry,...JSON.parse(localStorage.getItem(KEY)||'[]').filter(x=>x?.key!==key&&hydrate(x))].slice(0,4);while(rows.length&&JSON.stringify(rows).length>700000)rows.pop();localStorage.setItem(KEY,JSON.stringify(rows));}catch{}return entry;}
function snapshot(entry){return {...entry.result,products:entry.result.products.map(p=>({...p})),stale:true,cachedAt:entry.savedAt};}
async function request(url,{signal,direct=false}={}){
 if(signal?.aborted)throw cancelled();if(navigator.onLine===false)throw new LookupError('You are offline. Reconnect to refresh this record.','offline');
 if(cooldownUntil>Date.now())throw new LookupError('The database request pause has not finished.','rate_limited',Math.ceil((cooldownUntil-Date.now())/1000));
 if(!direct&&/^\/api\/(?:alternatives|search)\?/.test(url)){const now=Date.now();while(searchReads.length&&searchReads[0]<=now-60000)searchReads.shift();if(searchReads.length>=4)throw new LookupError('Please pause before another live comparison search.','local_rate_limited',Math.max(1,Math.ceil((searchReads[0]+60000-now)/1000)));searchReads.push(now);}
 const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});const timer=setTimeout(abort,direct?DIRECT_TIMEOUT:SERVER_TIMEOUT);
 try{
  const response=await fetch(url,{signal:controller.signal,credentials:'omit',headers:{Accept:'application/json'},mode:direct?'cors':'same-origin',cache:'no-store'});
  if([429,503].includes(response.status))cooldownUntil=Date.now()+seconds(response.headers.get('retry-after'))*1000;
  if([401,403].includes(response.status))throw new LookupError('The request was refused. Check the site or provider access settings.','access_denied');
  let body=null;const type=response.headers.get('content-type')||'';
  if(Number(response.headers.get('content-length'))>MAX_BODY)throw new LookupError('The database response exceeded the safe size limit.','upstream_size');
  if(/json/i.test(type)){const text=await response.text();if(text.length>MAX_BODY)throw new LookupError('The database response exceeded the safe size limit.','upstream_size');try{body=JSON.parse(text);}catch{throw new LookupError('The database returned unreadable data.','upstream_format');}}
  const detail=body?.error,code=detail?.code;
  if(response.status===429||response.status===503||['rate_limited','local_rate_limited','upstream_busy'].includes(code)){const wait=seconds(detail?.retryAfter||response.headers.get('retry-after'));cooldownUntil=Date.now()+wait*1000;throw new LookupError('The database has asked us to pause requests. Please wait before retrying.',code||'rate_limited',wait);}
  if(body?.result?.id==='product_not_found'||(body?.status===0&&/product not found/i.test(body?.status_verbose||'')))throw new LookupError('Open Food Facts has no record for this exact barcode.','not_found');
  if(/different product type/i.test(body?.status_verbose||''))throw new LookupError('This barcode is not a food record.','not_food');
  if(detail)throw new LookupError(detail.message||'The comparison service could not complete this request.',code||'upstream_http');
  if(!/json/i.test(type))throw new LookupError('The site did not return a database response.','deployment');
  if(!response.ok)throw new LookupError(`The database service returned HTTP ${response.status}.`,'upstream_http');
  return {body,cache:response.headers.get('x-foodscan-cache')||'',status:response.status};
 }catch(error){if(signal?.aborted)throw cancelled();if(error instanceof LookupError)throw error;if(controller.signal.aborted)throw new LookupError('The database request timed out after the server recovery window.','upstream_timeout');throw new LookupError('The comparison service could not be reached. Check your connection or try again later.','network_error');}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
function shared(key,work,signal){
 if(signal?.aborted)return Promise.reject(cancelled());let task=pending.get(key);
 if(!task||task.controller.signal.aborted){task={controller:new AbortController(),refs:0,done:false};const own=task;task.promise=Promise.resolve().then(()=>work(own.controller.signal)).finally(()=>{own.done=true;if(pending.get(key)===own)pending.delete(key);});pending.set(key,task);}
 task.refs++;
 return new Promise((resolve,reject)=>{let ended=false;const finish=(fn,value)=>{if(ended)return;ended=true;signal?.removeEventListener('abort',onAbort);task.refs--;if(!task.refs&&!task.done)task.controller.abort();fn(value);};const onAbort=()=>finish(reject,cancelled());signal?.addEventListener('abort',onAbort,{once:true});task.promise.then(v=>finish(resolve,v),e=>finish(reject,e));});
}
function normalize(body,limit){if(!Array.isArray(body?.products))throw new LookupError('The database returned no valid product list.','upstream_format');const at=Number.isFinite(body.fetchedAt)?body.fetchedAt:Date.now();return body.products.slice(0,limit).map(p=>{const code=String(p?.code||'');return validBarcode(code)?parseProduct({status:'success',product:p,fetchedAt:at},code):null;}).filter(Boolean);}
async function search(key,url,meta,limit,signal){
 const hit=cached(key);if(hit&&Date.now()-hit.savedAt<FRESH&&navigator.onLine!==false&&cooldownUntil<=Date.now())return {...hit.result,stale:Boolean(hit.result.stale),cachedAt:hit.savedAt};
 try{return await shared(key,async inner=>{const response=await request(url,{signal:inner});const products=normalize(response.body,limit);const result={...meta,products,checked:response.body.products.length,fetchedAt:Number.isFinite(response.body.fetchedAt)?response.body.fetchedAt:Date.now(),stale:response.cache.toUpperCase()==='STALE'};const saved=remember(key,result);return {...result,stale:response.cache.toUpperCase()==='STALE',cachedAt:saved.savedAt};},signal);}
 catch(error){if(error?.name==='AbortError')throw error;const previous=cached(key);if(previous&&temporary(error))return snapshot(previous);throw error;}
}
export async function searchCategory(category,{signal,country='',full=false}={}){
 if(!/^[a-z]{2}:[a-z0-9][a-z0-9-]{1,100}$/.test(category))throw new LookupError('Choose a category supplied by the source.','invalid');if(country&&!/^[a-z][a-z-]{2,40}$/.test(country))country='';
 const key=`category|${category}|${country}|${full}`,url=`/api/alternatives?category=${encodeURIComponent(category)}${country?`&country=${encodeURIComponent(country)}`:''}${full?'&detail=full':''}`;
 const result=await search(key,url,{category,country},24,signal);if(signal?.aborted)throw cancelled();lastCategory={category,country,stale:result.stale,fetchedAt:result.fetchedAt,cachedAt:result.cachedAt};return result;
}
export function getLastCategoryStatus(){return lastCategory?{...lastCategory}:null;}
export async function searchProducts(term,{signal,full=false}={}){
 const q=String(term||'').trim().slice(0,80);if(q.length<2)throw new LookupError('Type at least 2 characters to search.','invalid');
 const result=await search(`text|${q}|${full}`,`/api/search?q=${encodeURIComponent(q)}${full?'&detail=full':''}`,{query:q},12,signal);
 return result.products.map(p=>result.stale?{...p,connection:{transport:'cache',stale:true,fetchedAt:p.fetchedAt}}:p);
}
export const getLastLookup=()=>latest?JSON.parse(JSON.stringify(latest)):null;
export async function lookupProduct(barcode,{signal,onProgress=()=>{},mode='auto'}={}){
 if(!validBarcode(barcode))throw new LookupError('Check the barcode and its last digit.','invalid');if(signal?.aborted)throw cancelled();
 const key='product|'+barcode,hit=cached(key),report={appVersion:VERSION,barcode,startedAt:new Date().toISOString(),outcome:'running',attempts:[]};latest=report;
 const useSaved=()=>{const product=hit?.result.products[0];if(mode!=='auto'||!product||product.barcode.padStart(14,'0')!==barcode.padStart(14,'0'))return null;report.outcome='cached';report.finishedAt=new Date().toISOString();return {...product,connection:{transport:'cache',recovered:true,stale:true,fetchedAt:product.fetchedAt}};};
 let error;
 for(const transport of mode==='direct'?['direct']:mode==='server'?['server']:['server','direct']){
  if(transport==='direct'&&error&&!['network_error','upstream_network','upstream_timeout','deployment','upstream_endpoint','upstream_format'].includes(error.code))break;
  if(transport==='direct'&&error&&hit&&temporary(error)){const saved=useSaved();if(saved)return saved;}
  const attempt={transport,endpoint:transport==='server'?`/api/product/${barcode}`:directURL(barcode),startedAt:Date.now(),httpStatus:null};report.attempts.push(attempt);onProgress({transport,recovering:report.attempts.length>1,message:transport==='server'?'Looking up this barcode through FoodScan…':'Recovering the exact barcode from Open Food Facts…'});
  try{
   const response=await shared(key+'|'+transport,inner=>request(attempt.endpoint,{signal:inner,direct:transport==='direct'}),signal);attempt.httpStatus=response.status;
   const returned=String(response.body?.product?.code||response.body?.code||'');if(!validBarcode(returned)||returned.padStart(14,'0')!==barcode.padStart(14,'0'))throw new LookupError('The database returned a different barcode. No substitute was used.','upstream_mismatch');
   const product=parseProduct(response.body,barcode);if(!product)throw new LookupError('The source record contains insufficient product information.','incomplete');
   if(reportAudit(product).safeToCalculate)remember(key,{products:[product],fetchedAt:product.fetchedAt});report.outcome='success';report.finishedAt=new Date().toISOString();attempt.outcome='success';product.connection={transport,recovered:report.attempts.length>1,stale:response.cache.toUpperCase()==='STALE',fetchedAt:product.fetchedAt};return product;
  }catch(e){if(e?.name==='AbortError')throw e;error=e;attempt.outcome='failed';attempt.errorCode=e.code;}finally{attempt.elapsedMs=Date.now()-attempt.startedAt;}
 }
 if(hit&&temporary(error)){const saved=useSaved();if(saved)return saved;}report.outcome='failed';report.finishedAt=new Date().toISOString();error||=new LookupError('The food record could not be retrieved.','unavailable');error.diagnostics=getLastLookup();throw error;
}

export function clearPublicQueryCache(storage){for(const task of pending.values())task.controller.abort();pending.clear();memory.clear();try{(storage||globalThis.localStorage).removeItem(KEY);return '';}catch{return 'The saved public-query cache could not be removed.';}}
