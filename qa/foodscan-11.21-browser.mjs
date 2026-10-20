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
 const page=await browser.newPage({javaScriptEnabled:false});
 await page.goto('http://127.0.0.1:8787/');
 assert.match(await page.locator('h1').first().innerText(),/Better food choices/);
 assert.equal(await page.locator('a[href="/demo/"]').count(),1);
 assert.equal(await page.locator('a[href="/how/"]').count(),1);
 await page.close();
 console.log('PASS browser homepage layout on 375/768/1440 and no-JS fallback');
}finally{await browser.close()}
