/** Public Open Food Facts browser fallback. No credentials, invented records or silent rate-limit bypass. */
const INDEX='https://search.openfoodfacts.org/search',LEGACY='https://world.openfoodfacts.org/api/v2/search';
const FIELDS='code,product_name,product_name_en,brands,image_front_url,image_url,quantity,product_quantity_unit,nutriments,nutriscore_grade,nutrition_grades,nova_group,allergens_tags,traces_tags,labels_tags,ingredients_analysis_tags,categories_tags,countries_tags,last_modified_t,unique_scans_n,obsolete';
const CATEGORY=/^[a-z]{2}:[a-z0-9][a-z0-9-]{1,100}$/;
const COUNTRY=/^[a-z][a-z-]{2,40}$/;
const fail=(message,code,retryAfter=0)=>Object.assign(new Error(message),{code,retryAfter});
export function categoryProviderUrls(category,{country='',full=false}={}){
 if(!CATEGORY.test(category))throw fail('Invalid source category.','invalid');
 if(country&&!COUNTRY.test(country))country='';
 const query='categories_tags:"'+category+'"'+(country?' AND countries_tags:"en:'+country+'"':'');
 const index=new URL(INDEX),off=new URL(LEGACY);
 index.searchParams.set('q',query);index.searchParams.set('langs','en,fr,de,es,it,el,pt,nl');
 index.searchParams.set('page_size','24');index.searchParams.set('page','1');index.searchParams.set('sort_by','-unique_scans_n');index.searchParams.set('fields',FIELDS);
 off.searchParams.set('categories_tags',category);if(country)off.searchParams.set('countries_tags','en:'+country);
 off.searchParams.set('page_size','24');off.searchParams.set('page','1');off.searchParams.set('fields',FIELDS);
 const urls=[{url:index.href,index:true},{url:off.href,index:false}];
 return full?urls.reverse():urls;
}
function normalized(hit,fromIndex){
 if(!hit||typeof hit!=='object'||Array.isArray(hit))return null;
 const record={...hit};
 if(fromIndex){
  record.partial=true;
  if(Array.isArray(record.brands))record.brands=record.brands.filter(x=>typeof x==='string').join(', ');
  for(const [field,legacy] of [['categories','categories_tags'],['countries','countries_tags'],['allergens','allergens_tags'],['labels','labels_tags'],['ingredients_analysis','ingredients_analysis_tags']]){
   if(!Array.isArray(record[legacy])&&Array.isArray(record[field]))record[legacy]=record[field];
  }
  const nova=Number(record.nova_group);if([1,2,3,4].includes(nova))record.nova_group=nova;
 }
 return record;
}
async function requestJSON(url,{fetcher,signal}){
 const controller=new AbortController(),abort=()=>controller.abort();
 if(signal?.aborted)throw fail('Comparison cancelled.','cancelled');
 signal?.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(abort,7500);
 try{
  const res=await fetcher(url,{method:'GET',headers:{Accept:'application/json'},credentials:'omit',mode:'cors',cache:'no-store',signal:controller.signal});
  const wait=Number(res.headers?.get('Retry-After'));
  if(res.status===429||res.status===503)throw fail('The public database requested a pause before another search.','rate_limited',Number.isFinite(wait)&&wait>0?Math.min(86400,Math.ceil(wait)):60);
  if(res.status===401||res.status===403)throw fail('The provider refused browser access.','access_denied');
  if(!res.ok)throw fail('Provider returned HTTP '+res.status+'.','upstream_http');
  if(!/json/i.test(res.headers?.get('Content-Type')||''))throw fail('Provider did not return JSON.','upstream_format');
  if(Number(res.headers?.get('Content-Length'))>600000)throw fail('Provider response too large.','upstream_size');
  const text=await res.text();
  if(text.length>600000)throw fail('Provider response too large.','upstream_size');
  try{return JSON.parse(text);}catch{throw fail('Provider returned invalid JSON.','upstream_format');}
 }catch(error){
  if(signal?.aborted)throw fail('Comparison cancelled.','cancelled');
  if(error?.code)throw error;
  if(controller.signal.aborted)throw fail('Direct source search timed out.','upstream_timeout');
  throw fail('This browser could not reach the public source.','network_error');
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
export async function searchBrowserCategory(category,{country='',full=false,signal,parseRecord,validBarcode,fetcher=globalThis.fetch}={}){
 if(typeof parseRecord!=='function'||typeof validBarcode!=='function')throw fail('Missing source validation.','invalid');
 const urls=categoryProviderUrls(category,{country,full});let last=null,empty=null;
 for(const provider of urls){
  try{
   const response=await requestJSON(provider.url,{fetcher,signal});
   const list=provider.index?response?.hits:response?.products;
   if(!Array.isArray(list))throw fail('Unexpected source response.','upstream_format');
   const at=Date.now(),products=[],seen=new Set();
   for(const hit of list.slice(0,24)){
    const product=normalized(hit,provider.index),code=String(product?.code||'');
    if(!validBarcode(code)||seen.has(code.padStart(14,'0')))continue;
    const parsed=parseRecord({status:'success',product,fetchedAt:at},code);
    if(parsed){seen.add(code.padStart(14,'0'));products.push(parsed);}
   }
   const result={category,country,products,checked:list.length,fetchedAt:at,transport:'browser',source:provider.index?'Open Food Facts search index':'Open Food Facts legacy search',stale:false};
   if(products.length)return result;
   empty=result;
  }catch(error){
   if(['cancelled','rate_limited','access_denied'].includes(error?.code))throw error;
   last=error;
  }
 }
 if(empty)return empty;
 throw last||fail('Live category records were unavailable.','upstream_network');
}
