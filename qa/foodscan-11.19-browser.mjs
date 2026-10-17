import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch();
try{
 for(const width of [390,1440]){
  const ctx=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
  const page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  let attempts=0;
  await page.route('**/api/product/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'success',fetchedAt:Date.now(),product:{
    code:'3017620422003',product_name:'Nutella',brands:'Ferrero',quantity:'400 g',product_quantity_unit:'g',
    categories_tags:['en:spreads','en:hazelnut-spreads','en:chocolate-spreads'],
    countries_tags:['en:france'],nutriscore_grade:'e',nova_group:4,
    nutriments:{'energy-kcal_100g':539,'proteins_100g':6.3,'fat_100g':30.9,'carbohydrates_100g':57.5,'sugars_100g':56.3,'saturated-fat_100g':10.6,'salt_100g':0.11}
  }})}));
  await page.route('**/api/alternatives?**',route=>{attempts++;return route.fulfill({status:502,contentType:'application/json',body:JSON.stringify({error:{code:'upstream_network',message:'Blocked edge egress'}})});});
  await page.route('**/api/events',route=>route.fulfill({status:204}));
  await page.goto('http://127.0.0.1:8787/#food/3017620422003');
  try{await page.locator('.fs15-macro-grid').waitFor({timeout:12000});}catch(err){console.log('STARTUP_DIAGNOSTICS',JSON.stringify({width,url:page.url(),html:await page.locator('#main').innerHTML().then(x=>x.slice(0,2800)),errors}));throw err;}
  const button=page.locator('[data-action="load-swaps"]').first();
  assert(await button.count(),'Missing compare action');
  await button.click();
  await page.locator('.fs19-catalog-note').waitFor({timeout:20000});
  assert.equal(attempts,0,'Catalog should load before broken upstream API');
  assert.match(await page.locator('.fs19-catalog-note').innerText(),/Open Food Facts/);
  assert.equal(await page.locator('.fs15-classification-band').count(),1);
  assert.equal(await page.locator('.fs15-macro-grid > .v19-macro').count(),3);
  assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),'Mobile overflow');
  assert.deepEqual(errors,[]);
  console.log('PASS browser catalogue recovery',width,'cards',await page.locator('.fs15-alternative-card').count());
  await ctx.close();
 }
}finally{await browser.close();}
