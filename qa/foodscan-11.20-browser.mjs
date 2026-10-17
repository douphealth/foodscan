import {chromium} from 'playwright';import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
const code='80823131';
try{
 for(const width of [390,1440]){
  const ctx=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
  const page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
  page.on('requestfailed',r=>errors.push('request: '+r.url()+' '+r.failure()?.errorText));
  page.on('response',r=>{if(r.status()>=400&&r.url().includes('/assets/'))errors.push('HTTP '+r.status()+' '+r.url())});
  const raw={code,image_front_url:'https://images.openfoodfacts.org/images/products/000/008/082/3131/front_en.5.400.jpg',ingredients_text:'Οκκ',categories_tags:['el:Ζάχαρη'],serving_size:'100',nutrition_data_per:'100g',data_quality_errors_tags:['en:nutrition-packaging-as-sold-100g-energy-value-in-kcal-does-not-match-value-in-kj','en:nutrition-packaging-as-sold-100g-values-are-all-identical'],nutriments:{'energy-kcal_100g':10,'energy-kj_100g':10,'fat_100g':10,'saturated-fat_100g':10}};
  await page.route('**/api/product/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'success',fetchedAt:Date.now(),product:raw})}));
  await page.route('**/api/events',route=>route.fulfill({status:204}));
  await page.goto('http://127.0.0.1:8787/#food/'+code);
  try{await page.locator('.fs20-source-rejected .fs20-integrity').waitFor({timeout:11000});}catch(e){console.log('STARTUP',JSON.stringify({html:(await page.locator('#main').innerHTML()).slice(0,2300),errors,urls:await page.evaluate(()=>performance.getEntriesByType('resource').filter(x=>x.name.includes('/assets/')).map(x=>x.name).slice(-20))}));throw e;}
  assert.equal(await page.locator('.fs15-macro-grid').count(),0);
  assert.equal(await page.locator('.fs20-integrity [data-action="label-facts"]').count(),1);
  await page.locator('[data-action="label-facts"]').click();
  await page.locator('#fs20-label-form').waitFor();
  await page.locator('#fs20-label-form [name="name"]').fill('My verified package label');
  await page.locator('#fs20-label-form [name="kcal"]').fill('539');
  await page.locator('#fs20-label-form [name="fat"]').fill('30.9');
  await page.locator('#fs20-label-form [name="protein"]').fill('6.3');
  await page.locator('#fs20-label-form [name="carbohydrates"]').fill('57.5');
  await page.locator('#fs20-label-form [name="sugars"]').fill('56.3');
  await page.locator('#fs20-label-form [name="saturatedFat"]').fill('10.6');
  await page.locator('#fs20-label-form button[type="submit"]').click();
  await page.locator('.fs15-macro-grid').waitFor({timeout:12000});
  assert.equal(await page.locator('.fs20-integrity').count(),0);
  assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),'Overflow');
  assert.deepEqual(errors,[]);
  await page.reload();
  await page.locator('.fs15-macro-grid').waitFor({timeout:18000});
  assert.equal(await page.locator('.fs20-integrity').count(),0,'Stored manual entry overwritten');
  console.log('PASS exact barcode blocked, manual label accepted, persisted',width);
  await ctx.close();
 }
}finally{await browser.close();}
