import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const barcode='3017620422003';
const browser=await chromium.launch();
try{
 for(const [width,theme] of [[320,'dark'],[390,'dark'],[390,'light'],[1440,'light']]){
  const ctx=await browser.newContext({viewport:{width,height:900},colorScheme:theme,serviceWorkers:'block'});
  const page=await ctx.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  const nutr={code:barcode,product_name:'Source-only product',brands:'Example',quantity:'Unknown',
    ingredients_text:'Unverified ingredients',nutriments:{},nova_group:null,nutriscore_grade:null};
  await page.route('**/api/product/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'success',product:nutr,fetchedAt:Date.now()})}));
  await page.route('**/api/alternatives?**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({products:[]})}));
  await page.route('**/api/events',r=>r.fulfill({status:204}));
  await page.goto('http://127.0.0.1:8787/#food/'+barcode);
  await page.locator('.fs18-report-limited').waitFor({timeout:22000});
  assert.equal(await page.locator('.fs18-evidence-alert').count(),1);
  assert.equal(await page.locator('.fs15-macro-grid').count(),0);
  assert.equal(await page.locator('.fs15-classification-band').count(),0);
  assert(await page.locator('.fs18-evidence-actions button[data-action="reload"]').count());
  assert(!await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1),'overflow '+width);
  assert.deepEqual(errors,[]);
  console.log('PASS sparse-screen',width,theme);
  await ctx.close();
 }
}finally{await browser.close();}
