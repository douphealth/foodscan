import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
const barcode='3017620422003';
const base={code:barcode,product_name:'Butter',brands:'Example',quantity:'225 g',product_quantity_unit:'g',
 ingredients_text:'Cream, salt',nutriments:{'energy-kcal_100g':720,'fat_100g':80,'saturated-fat_100g':50,'salt_100g':.6}};
try{
 for(const scenario of [{width:320,theme:'dark',grades:false},{width:390,theme:'light',grades:false},{width:1440,theme:'dark',grades:true}]){
  const context=await browser.newContext({viewport:{width:scenario.width,height:900},colorScheme:scenario.theme,serviceWorkers:'block'});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/product/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'success',product:{...base,...(scenario.grades?{nutriscore_grade:'c',nova_group:'4'}:{})},fetchedAt:Date.now()})}));
  await page.route('**/api/alternatives?**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({products:[],checked:0})}));
  await page.route('**/api/events',route=>route.fulfill({status:204}));
  await page.goto('http://127.0.0.1:8787/#food/'+barcode);
  await page.locator('.fs17-trust-grid').waitFor({timeout:20000});
  const scores=await page.locator('.fs15-classification-band .fs14-mark').allTextContents();
  assert.deepEqual(scores.map(x=>x.trim()),scenario.grades?['C','4']:['?','?']);
  const colors=await page.evaluate(()=>{
   const node=document.querySelector('.fs17-trust-value');
   const parent=node.parentElement;
   const rgba=str=>str.match(/[\d.]+/g).map(Number);
   const fg=rgba(getComputedStyle(node).color),bg=rgba(getComputedStyle(parent).backgroundColor);
   const lum=rgb=>{let a=rgb.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return a[0]*.2126+a[1]*.7152+a[2]*.0722};
   const a=lum(fg),b=lum(bg);
   return {contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),fg,bg,overflow:document.documentElement.scrollWidth>innerWidth+1};
  });
  assert(colors.contrast>=4.5,'contrast '+JSON.stringify(colors));
  assert(!colors.overflow,'horizontal overflow');
  assert.deepEqual(errors,[]);
  console.log('Source QA',scenario,colors);
  await context.close();
 }
}finally{await browser.close();}
