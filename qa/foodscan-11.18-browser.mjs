import {chromium} from 'playwright';import assert from 'node:assert/strict';
const browser=await chromium.launch();
try{
 for(const [width,scheme] of [[320,'dark'],[390,'dark'],[390,'light'],[1440,'light']]){
  const ctx=await browser.newContext({viewport:{width,height:900},colorScheme:scheme,serviceWorkers:'block'});
  const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/product/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'success',fetchedAt:Date.now(),product:{code:'3017620422003',product_name:'Nutella',brands:'Ferrero',quantity:'400 g',product_quantity_unit:'g',nutriscore_grade:'e',nova_group:4,nutriments:{'energy-kcal_100g':539,'proteins_100g':6.3,'fat_100g':30.9,'carbohydrates_100g':57.5,'sugars_100g':56.3,'saturated-fat_100g':10.6,'salt_100g':0.11}}})}));
  await page.route('**/api/events',r=>r.fulfill({status:204}));
  await page.goto('http://127.0.0.1:8787/#food/3017620422003');
  await page.locator('.fs15-macro-grid').waitFor({timeout:25000});
  assert.equal(await page.locator('.fs15-classification-band').count(),1);
  assert.equal(await page.locator('.fs15-macro-grid > .v19-macro').count(),3);
  assert.equal(await page.locator('.fs18-evidence-alert').count(),0);
  assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),'overflow at '+width);
  assert.deepEqual(errors,[]);
  console.log('PASS classic report',width,scheme);
  await ctx.close();
 }
}finally{await browser.close();}
