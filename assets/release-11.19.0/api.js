export * from '/assets/release-11.19.0/api-core.js';
import {searchCategory as proxySearch,LookupError} from '/assets/release-11.19.0/api-core.js';
import {validBarcode,parseProduct} from './model.js';
import {searchBrowserCategory} from '/assets/release-11.19.0/category-direct.js';
import {cachedSourceCategory} from './catalog.js';
const recoverable=new Set(['upstream_network','network_error','upstream_timeout','upstream_http','upstream_endpoint','upstream_query','upstream_format','upstream_busy','deployment','upstream_failure']);
export async function searchCategory(category,{signal,country='',full=false}={}){
 // Fast, same-origin provider snapshot. No third-party CORS or slow backend dependency.
 if(!full){try{return await cachedSourceCategory(category,{signal,country,validBarcode,parseRecord:parseProduct});}catch(error){if(signal?.aborted)throw new DOMException('Comparison cancelled','AbortError');}}
 try{return await proxySearch(category,{signal,country,full});}
 catch(proxyError){
  if(signal?.aborted||proxyError?.name==='AbortError'||globalThis.navigator?.onLine===false)throw proxyError;
  try{
   // A full-record requirement cannot be satisfied by an index-only catalog.
   if(!full&&['rate_limited','local_rate_limited'].includes(proxyError?.code))return await cachedSourceCategory(category,{signal,country,validBarcode,parseRecord:parseProduct});
   const answer=await searchBrowserCategory(category,{signal,country,full,validBarcode,parseRecord:parseProduct});
   if(full&&answer.products?.length&&answer.products.every(p=>p.partial))throw new LookupError('Only partial public records are available; dietary suitability cannot be verified.','unverified');
   return answer;
  }
  catch(browserError){
   if(signal?.aborted||browserError?.code==='cancelled')throw new DOMException('Comparison cancelled','AbortError');
   if(!full){
    try{return await cachedSourceCategory(category,{signal,country,validBarcode,parseRecord:parseProduct});}catch(catalogError){if(signal?.aborted)throw new DOMException('Comparison cancelled','AbortError');}
   }
   if(browserError?.code==='rate_limited')throw new LookupError(browserError.message,'rate_limited',browserError.retryAfter||60);
   const error=new LookupError('The FoodScan server and your browser could not retrieve live comparison records. You can still compare previously saved foods or scan another product.','upstream_network');
   error.providerFailure={server:proxyError.code||'unknown',browser:browserError.code||'unknown'};
   throw error;
  }
 }
}
