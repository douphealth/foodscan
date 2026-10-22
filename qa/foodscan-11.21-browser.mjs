import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch();
try{
 for(const width of [375,768,1440]){
  const page=await browser.newPage({viewport:{width,height:850},serviceWorkers:'block',reducedMotion:'reduce'});
  const errors=[];
  page.on('pageerror',x=>errors.push(x.message));
  await page.goto('http://127.0.0.1:8787/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#main .fs21-home')!==null,{timeout:25000});
  assert.equal(await page.locator('#main h1').count(),1);
  assert.equal(await page.locator('.fs21-finder-host #quick-find-form').count(),1);
  assert.equal(await page.locator('.fs21-example[data-action="sample"]').count(),3);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'Mobile overflow');
  assert.deepEqual(errors,[],'No uncaught JS errors');
  await page.close();
 }
 const behavior=await browser.newPage();
 await behavior.goto('http://127.0.0.1:8787/',{waitUntil:'domcontentloaded'});
 const checked=await behavior.evaluate(async()=>{
  const {betterChoices,matchFoodType}=await import('/assets/release-11.21.0/recommendation-quality.js');
  const {allergenEvidence}=await import('/assets/release-11.21.0/allergen-evidence.js');
  const make=(barcode,name,grade,cats,sugars,protein=5)=>({
   barcode,name,brand:'Brand',nutriScore:grade,categories:cats.map(t=>'en:'+t),
   basis:'g',provenance:'off',partial:false,qualityWarnings:[],
   nutrition:{kcal:450,protein,carbohydrates:60,sugars,fat:20,saturatedFat:8,fiber:4,salt:.1},
   allergens:[],traces:[],ingredients:''
  });
  const base=make('3017620422003','Hazelnut cocoa spread','E',['sweet-spreads','hazelnut-spreads'],50);
  const peanut=make('3017620422004','Peanut spread','A',['sweet-spreads','peanut-butters'],5);
  const better=make('3017620422005','Reduced sugar hazelnut spread','B',['sweet-spreads','hazelnut-spreads'],20);
  const same=make('3017620422006','Other chocolate spread','E',['sweet-spreads','hazelnut-spreads'],15);
  const out=betterChoices(base,[peanut,better,same],{},'en:sweet-spreads');
  const allergen=allergenEvidence({...base,ingredients:'milk powder, hazelnuts',allergens:['tree nuts'],traces:['soy']});
  return {related:matchFoodType(base,better).compatible,unrelated:matchFoodType(base,peanut).compatible,ids:out.items.map(i=>i.product.barcode),allergen};
 });
 assert.equal(checked.related,true);
 assert.equal(checked.unrelated,false,'Unrelated peanut butter must not be marketed as equivalent');
 assert.deepEqual(checked.ids,['3017620422005'],'Only compatible higher-grade alternatives');
 assert(checked.allergen.unresolved.includes('milk'));
 assert(checked.allergen.mayContain.includes('soy'));
 await behavior.close();
 const page=await browser.newPage({javaScriptEnabled:false});
 await page.goto('http://127.0.0.1:8787/');
 assert.match(await page.locator('h1').first().innerText(),/Better food choices/);
 assert.equal(await page.locator('a[href="/demo/"]').count(),1);
 assert.equal(await page.locator('a[href="/how/"]').count(),1);
 await page.close();
 console.log('PASS browser homepage layout on 375/768/1440 and no-JS fallback');
}finally{await browser.close()}
