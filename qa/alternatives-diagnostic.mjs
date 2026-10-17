import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const u='https://search.openfoodfacts.org/search?q='+encodeURIComponent('categories_tags:"en:hazelnut-spreads"')+'&page_size=3&fields=code%2Cproduct_name%2Cnutriments';
let nodeResult={};
try{const res=await fetch(u,{signal:AbortSignal.timeout(13000)});nodeResult={status:res.status,contentType:res.headers.get('content-type'),cors:res.headers.get('access-control-allow-origin')};const b=await res.json();nodeResult.count=b.hits?.length;}catch(e){nodeResult={error:String(e).slice(0,250)};}
console.log('NODE_INDEX',JSON.stringify(nodeResult));
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:8787',{waitUntil:'domcontentloaded'});
 const test=await page.evaluate(async url=>{const t=AbortSignal.timeout(12000);try{const res=await fetch(url,{headers:{Accept:'application/json'},cache:'no-store',signal:t,mode:'cors'});const j=await res.json();return {ok:res.ok,status:res.status,hits:j?.hits?.length||0,cors:res.headers.get('access-control-allow-origin')}}catch(e){return {error:String(e).slice(0,240)}}},u);
 console.log('BROWSER_CORS',JSON.stringify(test));
}finally{await browser.close();}
try{const res=await fetch('https://foodscan-9oi.pages.dev/api/alternatives?category=en%3Ahazelnut-spreads',{signal:AbortSignal.timeout(13000)});let body=await res.json();console.log('LIVE_BACKEND',JSON.stringify({status:res.status,error:body.error||null,count:body.products?.length||0,version:body.version}).slice(0,2000));}catch(e){console.log('LIVE_BACKEND_ERROR',String(e).slice(0,400));}
