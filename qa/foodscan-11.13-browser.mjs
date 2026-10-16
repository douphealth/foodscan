import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base='http://127.0.0.1:8787',id='3017620422003';
const food={
 code:id,product_name:'Nutella',brands:'Ferrero',quantity:'400 g',
 categories_tags:['en:breakfasts','en:spreads','en:hazelnut-spreads'],countries_tags:['en:france'],
 ingredients_text:'Sugar, palm oil, hazelnuts (13%), skimmed milk powder, cocoa, emulsifier',
 allergens_tags:['en:nuts','en:milk'],traces_tags:[],
 serving_size:'15 g',serving_quantity:15,
 nutriscore_grade:'e',nova_group:4,
 nutriments:{'energy-kcal_100g':539,'sugars_100g':56.3,'fat_100g':30.9,'saturated-fat_100g':10.6,'salt_100g':0.107,'proteins_100g':6.3,'carbohydrates_100g':57.5}
};
const replacement={code:'3017620425035',product_name:'Less sweet hazelnut spread',brands:'Example',quantity:'350 g',nutriscore_grade:'b',nova_group:3,categories_tags:['en:hazelnut-spreads'],countries_tags:['en:france'],nutriments:{'sugars_100g':20,'fat_100g':25,'saturated-fat_100g':6,'salt_100g':0.1,'proteins_100g':10,'energy-kcal_100g':400}};
const respond=(route,body,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(body)});
const browser=await chromium.launch({headless:true});
const errors=[],screens=[];
await fs.mkdir('ui-audit/11.13',{recursive:true});
async function scenario(width,theme,providerOk){
 const context=await browser.newContext({viewport:{width,height:860},colorScheme:theme,reducedMotion:'reduce',serviceWorkers:'block'});
 const page=await context.newPage();
 page.on('pageerror',error=>errors.push(theme+'/'+width+': '+error.message));
 page.on('response',res=>{if(res.status()>=400&&/\/assets\/.*\.(css|js)$/.test(new URL(res.url()).pathname))errors.push('Missing asset: '+res.url());});
 await page.route('**/api/product/**',route=>respond(route,{status:'success',product:food,fetchedAt:Date.now()}));
 await page.route('**/api/alternatives?**',route=>respond(route,{error:{code:'upstream_network',message:'The server could not connect to the search providers.'}},502));
 await page.route('https://search.openfoodfacts.org/search?**',route=>providerOk?respond(route,{hits:[replacement]}):respond(route,{error:'unavailable'},502));
 await page.route('https://world.openfoodfacts.org/api/v2/search?**',route=>respond(route,{error:'unavailable'},502));
 await page.route('**/api/events',route=>route.fulfill({status:204}));
 await page.goto(base+'/#food/'+id,{waitUntil:'domcontentloaded'});
 await page.locator('.v18-product').waitFor({timeout:25000});
 const grade=page.locator('.fs14-nutri .fs14-mark'),nova=page.locator('.fs14-processing .fs14-mark');
 assert.equal(await grade.textContent(),'E');
 assert.equal(await nova.textContent(),'4');
 assert.match(await page.locator('.fs14-classifications').innerText(),/Ultra-processed food/);
 assert.equal(await page.locator('.fs14-grade-step.is-active').textContent(),'E');
 assert.equal(await page.locator('.fs14-nova-step.is-active').textContent(),'4');
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
 assert(!overflow,'Horizontal overflow at '+width);
 await page.screenshot({path:'ui-audit/11.13/report-'+width+'-'+theme+'.png',fullPage:true,animations:'disabled'});
 screens.push({width,theme,providerOk,grade:'E',nova:4,overflow});
 const btn=page.locator('[data-action="load-swaps"]').first();
 assert(await btn.count(),'Comparison button missing from rendered result');
 await btn.click();
 if(providerOk){
  await page.locator('.fs14-browser-note').waitFor({timeout:30000});
  assert.match(await page.locator('.fs14-browser-note').innerText(),/Live results recovered through your browser/);
  assert(!await page.locator('.fs14-recovery').count(),'Recovery error shown despite successful browser result');
 }else{
  await page.locator('.fs14-recovery').waitFor({timeout:30000});
  assert.match(await page.locator('.fs14-recovery').innerText(),/Compare this food side by side/);
  await page.locator('.fs14-action-main').click();
  await page.waitForTimeout(400);
  assert.equal(new URL(page.url()).hash,'#compare');
 }
 await context.close();
}
try{
 await scenario(390,'dark',true);
 await scenario(320,'light',false);
 await scenario(1440,'light',true);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({screens,errors,result:'PASS'}));
}finally{await browser.close();}
