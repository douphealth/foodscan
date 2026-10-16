import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base='http://127.0.0.1:8787';
const code='3017620422003';
const food={code,product_name:'Nutella',brands:'Ferrero',quantity:'400 g',ingredients_text:'Sugar, palm oil, hazelnuts (13%), skimmed milk powder, cocoa',categories_tags:['en:breakfasts','en:spreads','en:hazelnut-spreads'],countries_tags:['en:france'],allergens_tags:['en:nuts','en:milk'],nutriscore_grade:'e',nova_group:4,nutriments:{'energy-kcal_100g':539,'sugars_100g':56.3,'fat_100g':30.9,'saturated-fat_100g':10.6,'salt_100g':0.107,'proteins_100g':6.3,'carbohydrates_100g':57.5}};
const alternatives=[{code:'3017620425035',product_name:'Less sweet hazelnut spread',brands:['Example'],categories_tags:['en:hazelnut-spreads'],countries_tags:['en:france'],nutriments:{'sugars_100g':20,'fat_100g':25,'saturated-fat_100g':6,'proteins_100g':10,'energy-kcal_100g':400},nutriscore_grade:'b',nova_group:3}];
await fs.mkdir('ui-audit/11.14',{recursive:true});
const browser=await chromium.launch();
const failures=[];
try{
 for(const [width,theme] of [[320,'dark'],[390,'light'],[768,'dark'],[1440,'light']]){
  const context=await browser.newContext({viewport:{width,height:900},colorScheme:theme,reducedMotion:'reduce',serviceWorkers:'block'});
  const page=await context.newPage();
  page.on('pageerror',e=>failures.push(e.message));
  await page.route('**/api/product/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'success',product:food,fetchedAt:Date.now()})}));
  await page.route('**/api/alternatives?**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({products:alternatives,checked:1,fetchedAt:Date.now()})}));
  await page.route('**/api/events',route=>route.fulfill({status:204}));
  await page.goto(base+'/#food/'+code);
  await page.locator('.fs15-report-page').waitFor({timeout:20000});
  assert.equal(await page.locator('.fs15-classification-band').count(),1);
  assert.equal(await page.locator('.fs15-classification-band .fs14-mark').first().textContent(),'E');
  assert.equal(await page.locator('.fs15-classification-band .fs14-nova-mark').textContent(),'4');
  assert.equal(await page.locator('.fs15-portion').count(),1);
  await page.locator('#md-product-amount').fill('30');
  await page.waitForTimeout(200);
  assert.match(await page.locator('#fs12-selected-amount').textContent(),/30/);
  assert.equal(await page.locator('.fs15-portion-results .fs12-macro-k').count(),1);
  const button=page.locator('[data-action=load-swaps]').first();if(await button.count())await button.click();
  await page.locator('.fs15-alternatives-grid .fs15-alternative-card').first().waitFor({timeout:12000});
  assert(await page.locator('.fs15-alternative-card .d8-swap-actions a[href^="#food/"]').count());
  assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)),'Horizontal overflow '+width);
  await page.screenshot({path:'ui-audit/11.14/food-'+width+'-'+theme+'.png',fullPage:true,animations:'disabled'});
  await context.close();
 }
 assert.deepEqual(failures,[]);
 console.log('FoodScan 11.14 browser PASS');
}finally{await browser.close();}
