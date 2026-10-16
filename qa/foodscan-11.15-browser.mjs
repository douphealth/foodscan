import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const code='5740900401365',image='https://images.openfoodfacts.org/images/products/574/090/040/1365/front_nl.17.400.jpg';
const data={code,product_name:'Lurpak butter',brands:'Lurpak',quantity:'225 g',product_quantity_unit:'g',
 image_front_url:image,selected_images:{front:{display:{nl:image,en:image}}},
 ingredients_text:'Cream, salt',categories_tags:['en:butters'],allergens_tags:['en:milk'],
 nutriments:{'energy-kcal_100g':14579.3499043977,'energy-kj_100g':2793.7,
  'fat_100g':75,'saturated-fat_100g':35,'carbohydrates_100g':.6,'sugars_100g':.6,'proteins_100g':.5,'salt_100g':.885}
};
await fs.mkdir('ui-audit/11.15',{recursive:true});
const browser=await chromium.launch();
const issues=[];
try{
 for(const [width,scheme] of [[320,'dark'],[390,'dark'],[430,'light'],[768,'light'],[1440,'dark']]){
  const ctx=await browser.newContext({viewport:{width,height:900},colorScheme:scheme,serviceWorkers:'block',reducedMotion:'reduce'});
  const page=await ctx.newPage();
  page.on('pageerror',e=>issues.push(e.message));
  await page.route('**/api/product/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'success',product:data,fetchedAt:Date.now()})}));
  await page.route('**/api/alternatives?**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({products:[],checked:0,fetchedAt:Date.now()})}));
  await page.route('**/api/events',route=>route.fulfill({status:204}));
  await page.goto('http://127.0.0.1:8787/#food/'+code);
  await page.locator('.fs16-report').waitFor({timeout:22000});
  const photo=page.locator('.fs16-photo-frame'),img=photo.locator('img');
  assert.equal(await img.count(),1);
  assert.match(await page.locator('.fs16-data-panel').innerText(),/Nutrition data coverage/);
  assert.match(await page.locator('.fs16-data-panel').innerText(),/converted from reported kJ/);
  const layout=await page.evaluate(()=>{
   const image=document.querySelector('.fs16-photo-frame img');
   const box=image.getBoundingClientRect(),host=image.parentElement.getBoundingClientRect();
   return {display:getComputedStyle(image).display,fit:getComputedStyle(image).objectFit,
    center:Math.abs((box.left+box.width/2)-(host.left+host.width/2)),
    imageHeight:box.height,hostHeight:host.height,
    overflow:document.documentElement.scrollWidth>innerWidth+1};
  });
  assert.equal(layout.fit,'contain');
  assert(!layout.overflow,'horizontal overflow '+width);
  assert(layout.center<=3,'image not centered '+width+': '+layout.center);
  if(width<=430)assert(layout.imageHeight<=260,'mobile photo unnecessarily tall: '+layout.imageHeight);
  await page.locator('#md-product-amount').fill('30');
  assert.match(await page.locator('#fs12-selected-amount').innerText(),/30/);
  await page.screenshot({path:'ui-audit/11.15/product-'+width+'-'+scheme+'.png',fullPage:false,animations:'disabled'});
  console.log('MOBILE QA',width,scheme,JSON.stringify(layout));
  await ctx.close();
 }
 assert.deepEqual(issues,[]);
 console.log('FoodScan 11.15 browser PASS');
}finally{await browser.close();}
