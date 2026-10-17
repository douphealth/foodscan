export * from '/assets/release-11.17.0/api-core.js';
import {searchCategory as proxySearch,LookupError} from '/assets/release-11.17.0/api-core.js';
import {validBarcode,parseProduct} from './model.js';
import {searchBrowserCategory} from '/assets/release-11.13.0/category-direct.js';
const recoverable=new Set(['upstream_network','network_error','upstream_timeout','upstream_http','upstream_endpoint','upstream_query','upstream_format','upstream_busy','deployment','upstream_failure']);
export async function searchCategory(category,{signal,country='',full=false}={}){
 try{return await proxySearch(category,{signal,country,full});}
 catch(proxyError){
  if(signal?.aborted||proxyError?.name==='AbortError'||globalThis.navigator?.onLine===false||!recoverable.has(proxyError?.code))throw proxyError;
  try{return await searchBrowserCategory(category,{signal,country,full,validBarcode,parseRecord:parseProduct});}
  catch(browserError){
   if(signal?.aborted||browserError?.code==='cancelled')throw new DOMException('Comparison cancelled','AbortError');
   if(browserError?.code==='rate_limited')throw new LookupError(browserError.message,'rate_limited',browserError.retryAfter||60);
   const error=new LookupError('The FoodScan server and your browser could not retrieve live comparison records. You can still compare previously saved foods or scan another product.','upstream_network');
   error.providerFailure={server:proxyError.code||'unknown',browser:browserError.code||'unknown'};
   throw error;
  }
 }
}
