import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base='http://127.0.0.1:8787',code='3017620422003';
const food={
 code,product_name:'Nutella',brands:'Ferrero',quantity:'400 g',
 ingredients_text:'Sugar, palm oil, hazelnuts (13%), skimmed milk powder, cocoa',
 categories_tags:['en:breakfasts','en:spreads','en:hazelnut-spreads'],
 countries_tags:['en:france'],allergens_tags:['en:nuts','en:milk'],
 nutriscore_grade:'e',nova_group:4,
 nutriments:{'energy-kcal_100g':539,'sugars_100g':56.3,'fat_100g':30.9,
 'saturated-fat_100g':10.6,'salt_100g':0.107,'proteins_100g':6.3,'carbohydrates_100g':57.5}
};
const respond=(route,body)=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
const browser=await chromium.launch({headless:true});
const failures=[];
await fs.mkdir('ui-audit/11.14.1',{recursive:true});
try{
 for(const [width,theme] of [[320,'dark'],[390,'light'],[768,'dark'],[1440,'light'],[1440,'dark']]){
  const context=await browser.newContext({viewport:{width,height:900},colorScheme:theme,reducedMotion:'reduce',serviceWorkers:'block'});
  const page=await context.newPage();
  page.on('pageerror',error=>failures.push(width+': '+error.message));
  page.on('response',response=>{if(response.status()>=400&&/\/assets\/.*\.(css|js)$/.test(new URL(response.url()).pathname))failures.push('missing asset '+response.url());});
  await page.route('**/api/product/**',route=>respond(route,{status:'success',product:food,fetchedAt:Date.now()}));
  await page.route('**/api/alternatives?**',route=>respond(route,{products:[],checked:0,fetchedAt:Date.now()}));
  await page.route('**/api/events',route=>route.fulfill({status:204}));
  await page.goto(base+'/#food/'+code,{waitUntil:'domcontentloaded'});
  const ringCards=page.locator('.fs15-macro-grid > .v19-macro');
  await ringCards.first().waitFor({state:'visible',timeout:22000});
  assert.equal(await ringCards.count(),3);
  const values=await ringCards.locator('.v19-ring-value strong').allTextContents();
  assert.deepEqual(values.map(x=>x.trim()),['6.3','30.9','57.5']);
  const labels=await ringCards.locator('.v19-macro-label').allTextContents();
  assert.deepEqual(labels.map(x=>x.trim()),['Protein','Fat','Carbs']);
  const basis=await ringCards.locator(':scope > small').allTextContents();
  assert.deepEqual(basis.map(x=>x.trim()),['per 100 g','per 100 g','per 100 g']);
  const metrics=await page.evaluate(()=>{
   const grid=document.querySelector('.fs15-macro-grid');
   const cards=[...grid.querySelectorAll(':scope > .v19-macro')];
   return {
    docOverflow:document.documentElement.scrollWidth>window.innerWidth+1,
    columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length,
    cards:cards.map(card=>{
     const box=card.querySelector('.v19-ring'), svg=box.querySelector('svg'),value=box.querySelector('strong');
     const ring=box.getBoundingClientRect(),label=value.getBoundingClientRect();
     return {layout:getComputedStyle(card).display,svg:getComputedStyle(svg).display,
      width:ring.width,height:ring.height,centerDelta:Math.abs((ring.left+ring.width/2)-(label.left+label.width/2)),
      fits:label.width<=ring.width+1,color:getComputedStyle(card).getPropertyValue('--ring').trim()};
    })
   };
  });
  assert.equal(metrics.columns,3,'Three ring cards should remain side-by-side at '+width);
  assert(!metrics.docOverflow,'Horizontal overflow at '+width);
  for(const c of metrics.cards){
   assert.equal(c.layout,'flex');
   assert.equal(c.svg,'block');
   assert(c.width>=63&&c.height>=63,'Ring is too small');
   assert(c.centerDelta<=2,'Value is not centered in ring');
   assert(c.fits,'Value extends beyond its ring');
   assert(c.color,'Missing source nutrient accent color');
  }
  assert.match(await page.locator('.v19-ring-note').innerText(),/Circular outlines are decorative, not percentages of a daily target/);
  assert.equal(await page.locator('.fs15-classification-band').count(),1);
  assert.equal(await page.locator('.fs15-portion').count(),1);
  if([320,390,1440].includes(width)){
   await page.screenshot({path:'ui-audit/11.14.1/circular-macros-'+width+'-'+theme+'.png',fullPage:false,animations:'disabled'});
  }
  console.log('RING PASS',width,theme,JSON.stringify({values,ringWidths:metrics.cards.map(c=>Math.round(c.width)),columns:metrics.columns}));
  await context.close();
 }
 assert.deepEqual(failures,[]);
 console.log('FoodScan 11.14.1 responsive circular cards: PASS');
}finally{await browser.close();}
