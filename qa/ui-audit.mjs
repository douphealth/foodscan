import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
const origin=new URL(process.env.APP_URL||'https://foodscan-9oi.pages.dev/').origin;
if(origin!=='https://foodscan-9oi.pages.dev')throw Error('Audit target must be the approved FoodScan origin.');
const expected='11.8.0',out='ui-audit',run=process.env.GITHUB_RUN_ID||String(Date.now());
await fs.mkdir(out,{recursive:true});
const report={origin,expected,started:new Date().toISOString(),limits:['Fresh disposable browser storage only.','Camera uses a synthetic stream, not physical hardware.','No automated contrast certification; inspect the captured screenshots.'],screens:[],findings:[]};
const finding=(severity,screen,message)=>report.findings.push({severity,screen,message});
const routes=['home','saved','shopping','pantry','compare','insights','profile','demo','about','privacy','connection','review','alternatives/3017620422003','food/3017620422003'];
const browser=await chromium.launch({args:['--use-fake-device-for-media-stream']});
const save=async(page,label)=>{const file=label.replace(/[^a-z0-9-]/gi,'-')+'.png';await page.screenshot({path:path.join(out,file),fullPage:true,animations:'disabled'});return file;};
async function inspect(page,label){
 const details=await page.evaluate(()=>{
  const main=document.getElementById('main'),text=main?.innerText||'';
  const version=document.querySelector('.release')?.textContent?.trim()||null;
  const tiny=[];for(const e of main?.querySelectorAll('p,small,label,summary,button,a')||[]){const r=e.getBoundingClientRect(),s=getComputedStyle(e);if(r.width&&r.height&&s.visibility!=='hidden'&&Number.parseFloat(s.fontSize)<12&&e.textContent.trim())tiny.push({tag:e.tagName,size:s.fontSize,text:e.textContent.trim().slice(0,90)});}
  return {version,h1:main?.querySelectorAll('h1').length||0,overflow:document.documentElement.scrollWidth>innerWidth+1,mainTextLength:text.length,tinyTextCount:tiny.length,tinyTextExamples:tiny.slice(0,12),font:getComputedStyle(document.body).fontFamily};
 });
 if(details.version!==expected)finding('error',label,`Expected ${expected}; footer reports ${details.version||'no version'}.`);
 if(details.overflow)finding('error',label,'Horizontal page overflow.');
 if(!details.mainTextLength)finding('error',label,'Main content is empty.');
 if(details.h1!==1)finding('warning',label,`Main contains ${details.h1} H1 headings.`);
 if(details.tinyTextCount)finding('warning',label,`${details.tinyTextCount} visible text elements are below 12px; inspect screenshots.`);
 report.screens.push({label,...details,screenshot:await save(page,label)});
}
async function open(page,route,label){
 await page.goto(`${origin}/?ui-audit=${run}#${route}`,{waitUntil:'domcontentloaded',timeout:45000});
 await page.waitForFunction(()=>document.querySelector('#main')&&!document.querySelector('#main .startup'),null,{timeout:20000}).catch(()=>finding('error',label,'Startup shell did not finish.'));
 if(route.startsWith('food/'))await page.waitForSelector('.v18-product,#gate-title,.lookup-error,.notice.error',{timeout:30000}).catch(()=>finding('error',label,'No product report or recognized error state appeared.'));
 await page.waitForTimeout(600);await inspect(page,label);
}
try{
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:960},deviceScaleFactor:1,serviceWorkers:'block',permissions:['camera'],reducedMotion:'reduce'});
  const page=await context.newPage();let active=String(width);
  page.on('pageerror',e=>finding('error',active,`Uncaught JavaScript: ${e.message}`));
  page.on('response',r=>{const u=new URL(r.url());if(u.origin===origin&&r.status()>=400&&/\.(?:js|css)(?:$|\?)/.test(u.pathname+u.search))finding('error',active,`Asset HTTP ${r.status()}: ${u.pathname}`);});
  await page.route('**/api/events',route=>route.fulfill({status:204}));
  for(const route of routes){active=`${width}-${route.replaceAll('/','-')}`;try{await open(page,route,active);}catch(e){finding('error',active,e.message);await save(page,active+'-failure').catch(()=>{});}}
  active=`${width}-product-actions`;
  if(await page.locator('.v18-product').count()){
   const anchor=page.locator('.v18-product a[href="#fs-ingredients"]').first();
   if(await anchor.count()){
    await anchor.click();await page.waitForTimeout(700);
    if(!await page.locator('.v18-product').count())finding('error',active,'Read ingredients link navigated away from the product report.');
    else if(!await page.locator('#fs-ingredients').count())finding('error',active,'Ingredients target is missing.');
    await inspect(page,`${width}-ingredients-link`);
   }
   if(!await page.locator('.v18-product').count())await open(page,'food/3017620422003',`${width}-product-restored`).catch(e=>finding('error',active,e.message));
   const portionLink=page.locator('.v18-product a[href="#fs-product-log-heading"]').first();
   if(await portionLink.count()){
    await portionLink.click();await page.waitForTimeout(700);
    if(!await page.locator('#md-product-amount').count())finding('error',active,'Portion link did not retain a product quantity input.');
    else{await page.locator('#md-product-amount').fill('30');await page.waitForTimeout(400);const amount=await page.locator('#fs12-selected-amount').textContent().catch(()=>'');if(!amount.includes('30'))finding('error',active,'Selected quantity did not update to 30.');}
    await inspect(page,`${width}-portion-30g`);
   }
   const saveButton=page.locator('.v18-report-bottom [data-action="save"]').first();
   if(await saveButton.count()){await saveButton.click();await page.waitForTimeout(400);await page.evaluate(()=>location.hash='saved');await page.waitForTimeout(600);await inspect(page,`${width}-saved-after-save`);}
  }else finding('warning',active,'Product actions skipped: live product record was unavailable.');
  active=`${width}-settings`;
  try{await page.locator('[data-action="settings"]').first().click();await page.waitForSelector('dialog[open]',{timeout:5000});await save(page,active);await page.locator('dialog[open] [data-action="close-dialog"]').first().click();}catch(e){finding('error',active,e.message);}
  active=`${width}-camera-synthetic`;
  try{await page.evaluate(()=>location.hash='scan');await page.waitForSelector('dialog[data-kind="camera"][open]',{timeout:15000});await page.waitForTimeout(2500);await save(page,active);const status=await page.locator('#camera-status').textContent().catch(()=>'');report.screens.push({label:active,status,synthetic:true,screenshot:active+'.png'});await page.locator('dialog[open] [data-action="close-dialog"]').first().click();}catch(e){finding('error',active,e.message);}
  active=`${width}-diary`;
  try{
   await open(page,'home',`${width}-home-before-diary`);
   await page.locator('#v18-diary').evaluate(e=>e.open=true);
   const form=page.locator('#md-quick-form');await form.locator('#md-name').fill('UI audit test meal');
   const details=form.locator('details').first();if(await details.count())await details.evaluate(e=>e.open=true);
   await form.locator('input[name="k"]').fill('120');await form.locator('input[name="p"]').fill('8');await form.locator('button[type="submit"]').click();await page.waitForTimeout(600);
   await inspect(page,`${width}-diary-after-log`);
  }catch(e){finding('error',active,e.message);}
  active=`${width}-offline-saved`;
  try{await context.setOffline(true);await page.evaluate(()=>location.hash='saved');await page.waitForTimeout(600);await inspect(page,active);}catch(e){finding('error',active,e.message);}finally{await context.setOffline(false);}
  await context.close();
 }
}catch(e){finding('error','audit-runner',e.stack||e.message);}finally{
 await browser.close();report.finished=new Date().toISOString();
 await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
 const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const html=`<!doctype html><meta charset="utf-8"><title>FoodScan live UI audit</title><style>body{font:16px system-ui;max-width:1100px;margin:30px auto;padding:20px;line-height:1.6}img{max-width:100%;border:1px solid #ddd}pre{white-space:pre-wrap}article{margin:40px 0}</style><h1>FoodScan live UI audit</h1><p>${esc(origin)} · expected ${expected}</p><h2>Findings</h2><pre>${esc(JSON.stringify(report.findings,null,2))}</pre>${report.screens.map(s=>`<article><h2>${esc(s.label)}</h2><pre>${esc(JSON.stringify({...s,screenshot:undefined},null,2))}</pre><img src="${esc(s.screenshot)}" alt="${esc(s.label)} screenshot"></article>`).join('')}`;
 await fs.writeFile(path.join(out,'report.html'),html);
 console.log(JSON.stringify({screens:report.screens.length,errors:report.findings.filter(x=>x.severity==='error').length,warnings:report.findings.filter(x=>x.severity==='warning').length}));
 if(report.findings.some(x=>x.severity==='error'))process.exitCode=1;
}
