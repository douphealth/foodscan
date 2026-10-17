/** Offline-safe sourced category snapshots on FoodScan's own domain. */
const valid=/^[a-z]{2}:([a-z0-9][a-z0-9-]{1,100})$/;
const MAX_AGE=21*86400000;
export async function cachedSourceCategory(category,{signal,parseRecord,validBarcode,country=''}={}){
 const m=valid.exec(category);
 if(!m)throw Object.assign(new Error('Invalid category'),{code:'invalid'});
 const slug=m[1];
 const response=await fetch('/data/alternatives/'+slug+'.json',{signal,cache:'default',credentials:'same-origin',headers:{Accept:'application/json'}});
 if(!response.ok)throw Object.assign(new Error('This category has no verified comparison snapshot.'),{code:'catalog_missing'});
 const body=await response.json();
 if(body?.category!==category||!Array.isArray(body.products))throw Object.assign(new Error('Source catalog mismatch'),{code:'catalog_invalid'});
 const retrievedAt=Date.parse(body.retrievedAt);
 if(!Number.isFinite(retrievedAt)||retrievedAt>Date.now()+300000||Date.now()-retrievedAt>MAX_AGE)throw Object.assign(new Error('Source catalog is too old to show.'),{code:'catalog_stale'});
 const products=[],seen=new Set();
 for(const hit of body.products.slice(0,50)){
  const barcode=String(hit.code||'');
  if(!validBarcode(barcode)||seen.has(barcode)||!Array.isArray(hit.categories_tags)||!hit.categories_tags.includes(category))continue;
  const p=parseRecord({status:'success',product:{...hit,partial:true},fetchedAt:retrievedAt},barcode);
  if(!p)continue;
  p.partial=true;
  products.push(p);seen.add(barcode);
 }
 if(!products.length)throw Object.assign(new Error('No usable records in the source catalog'),{code:'catalog_empty'});
 return {category,country:'',products,checked:body.products.length,fetchedAt:retrievedAt,transport:'catalog',source:'Open Food Facts cached search index',stale:true,partial:true,
  scope:country?'Worldwide source sample; your requested country filter could not be verified.':'Worldwide source sample',
  ageDays:Math.floor((Date.now()-retrievedAt)/86400000)};
}
