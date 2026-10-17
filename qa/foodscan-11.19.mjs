import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {cachedSourceCategory} from '../assets/release-11.19.0/catalog.js';
import {searchBrowserCategory} from '../assets/release-11.19.0/category-direct.js';
const html=await fs.readFile('index.html','utf8'),inline=html.split('<script type="importmap">')[1]?.split('</script>')[0];
assert(inline,'Missing import map');
const h='sha256-'+crypto.createHash('sha256').update(inline).digest('base64');
assert((await fs.readFile('_headers','utf8')).includes(h),'CSP import-map mismatch');
for(const filename of Object.values(JSON.parse(inline).imports))await fs.stat('.'+filename);
assert(html.includes('"softwareVersion":"11.19.0"'));
const status=JSON.parse(await fs.readFile('data/alternatives/catalog-status.json','utf8'));
const files=(await fs.readdir('data/alternatives')).filter(x=>x.endsWith('.json')&&x!=='catalog-status.json');
assert(files.length>=20,'Verified source catalog too small');
assert(status.summary.filter(x=>x.verified>=3).length>=10);
const raw=JSON.parse(await fs.readFile('data/alternatives/hazelnut-spreads.json','utf8'));
assert.equal(raw.category,'en:hazelnut-spreads');
assert(raw.products.length>=3);
for(const hit of raw.products){
 assert(Array.isArray(hit.categories_tags)&&hit.categories_tags.includes(raw.category));
 assert.equal(hit.partial,true);
 assert(/^\d{8,14}$/.test(hit.code));
 assert(Object.keys(hit.nutriments||{}).length);
}
let calls=0;const oldFetch=globalThis.fetch;
globalThis.fetch=async url=>{
 calls++;
 const part=String(url).split('/').at(-1);
 try{return new Response(await fs.readFile('data/alternatives/'+part),{status:200,headers:{'Content-Type':'application/json'}});}
 catch{return new Response('Not found',{status:404});}
};
try{
 const result=await cachedSourceCategory('en:hazelnut-spreads',{country:'greece',parseRecord:({product},code)=>({...product,barcode:code}),validBarcode:c=>/^\d{8,14}$/.test(c)});
 assert(result.products.length>3);
 assert.equal(result.transport,'catalog');
 assert(result.stale===true);
 assert(result.scope.includes('Worldwide'));
 assert(calls===1,'Same-origin catalog should use just one request');
 await assert.rejects(cachedSourceCategory('en:not-a-real-category',{parseRecord:()=>null,validBarcode:()=>true}),x=>x.code==='catalog_missing');
}finally{globalThis.fetch=oldFetch;}
let tries=0;
const fetcher=async(url)=>{tries++;if(url.includes('world.openfoodfacts.org'))return new Response('{}',{status:503,headers:{'Content-Type':'application/json'}});return new Response(JSON.stringify({hits:[raw.products[0]]}),{status:200,headers:{'Content-Type':'application/json'}})};
const browserFallback=await searchBrowserCategory('en:hazelnut-spreads',{full:true,fetcher,parseRecord:({product},code)=>({...product,barcode:code}),validBarcode:c=>/^\d{8,14}$/.test(c)});
assert.equal(browserFallback.products.length,1,'Index must recover legacy HTTP 503');
assert.equal(tries,2,'Both providers should have been tried');
const worker=await fs.readFile('_worker.js','utf8');
assert(worker.includes("reserveSearchRead(which, env)"));
assert(worker.includes("foodscan-search-"));
console.log('PASS comparison catalog, CSP, provenance and independent provider fallback');
