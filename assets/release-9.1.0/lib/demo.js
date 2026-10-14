/** The demo page. It renders the app's REAL components with built-in, unbranded sample products,
 *  so what a visitor sees here is exactly what the app does. No network, works offline.
 */
import {parseProduct} from './model.js';
import {icon as i} from './icons.js';
import {packArt,barcodeBars,sugarCubes} from './art.js';
import {scoreCards,quickReadList,lightTiles,compositionBar,portionPanel,portionStart,swapCard} from './components.js';
import {betterChoices,swapsWorthOffering,tipOfTheDay} from './nutrition.js';
import {DEFAULT_PROFILE} from './profile.js';
import {escapeHTML as e} from './model.js';

const eanCheck=body=>{let sum=0;for(let n=body.length-1,w=3;n>=0;n--,w=4-w)sum+=Number(body[n])*w;return (10-sum%10)%10;};
const ean13=n=>{const body=String(n).padStart(12,'0');return body+eanCheck(body);};
export const DEMO_CODES={spread:ean13(500000000011),pasta:ean13(500000000028),cola:ean13(500000000035)};
const CHOCO_CATS=['en:breakfasts','en:spreads','en:sweet-spreads','en:chocolate-spreads'];
const wrap=(code,fields)=>({status:'success',fetchedAt:Date.now(),product:{code,last_modified_t:Math.floor(Date.now()/1000)-86400*9,...fields}});
const RAW={
 [DEMO_CODES.spread]:{product_name:'Chocolate hazelnut spread',brands:'Example Foods',quantity:'400 g',serving_size:'1 tbsp (15 g)',serving_quantity:15,serving_quantity_unit:'g',product_quantity_unit:'g',
  nutriscore_grade:'e',nova_group:4,allergens_tags:['en:milk','en:nuts','en:soybeans'],traces_tags:[],labels_tags:[],ingredients_analysis_tags:['en:palm-oil'],categories_tags:CHOCO_CATS,countries_tags:['en:united-kingdom'],additives_n:1,
  ingredients_text:'sugar, palm oil, hazelnuts (13%), skimmed milk powder, fat-reduced cocoa (7.4%), emulsifier: lecithins (soya), vanillin',
  nutriments:{'energy-kcal_100g':539,fat_100g:30.9,'saturated-fat_100g':10.6,carbohydrates_100g:57.5,sugars_100g:56.3,proteins_100g:6.3,salt_100g:.11}},
 [DEMO_CODES.pasta]:{product_name:'Wholewheat spaghetti',brands:'Example Foods',quantity:'500 g',serving_size:'80 g dry',serving_quantity:80,serving_quantity_unit:'g',product_quantity_unit:'g',
  nutriscore_grade:'a',nova_group:1,allergens_tags:['en:gluten'],traces_tags:[],labels_tags:[],ingredients_analysis_tags:['en:vegan'],categories_tags:['en:plant-based-foods','en:cereals-and-potatoes','en:pastas','en:dry-pastas','en:wholewheat-pastas'],countries_tags:['en:united-kingdom'],additives_n:0,
  ingredients_text:'wholewheat durum wheat semolina',
  nutriments:{'energy-kcal_100g':348,fat_100g:2.5,'saturated-fat_100g':.5,carbohydrates_100g:62,sugars_100g:3,proteins_100g:13,fiber_100g:8,salt_100g:.02}},
 [DEMO_CODES.cola]:{product_name:'Zero sugar cola',brands:'Example Foods',quantity:'330 ml',serving_size:'1 can (330 ml)',serving_quantity:330,serving_quantity_unit:'ml',product_quantity_unit:'ml',
  nutriscore_grade:'c',nova_group:4,allergens_tags:[],traces_tags:[],labels_tags:['en:contains-artificial-sweeteners'],ingredients_analysis_tags:['en:vegan'],categories_tags:['en:beverages','en:carbonated-drinks','en:sodas','en:colas','en:diet-sodas'],countries_tags:['en:united-kingdom'],additives_n:4,
  ingredients_text:'carbonated water, colour: caramel E150d, acid: phosphoric acid, sweeteners: aspartame and acesulfame K, flavourings, caffeine',
  nutriments:{'energy-kcal_100g':.3,fat_100g:0,'saturated-fat_100g':0,carbohydrates_100g:0,sugars_100g:0,proteins_100g:0,salt_100g:.02}}
};
export const DEMO=Object.fromEntries(Object.entries(RAW).map(([code,fields])=>[code,parseProduct(wrap(code,fields),code)]));
const lighter=(n,name,grade,sugars,sat,fat)=>parseProduct(wrap(ean13(500000000100+n*7),{product_name:name,brands:'Example Foods',quantity:'380 g',product_quantity_unit:'g',nutriscore_grade:grade,nova_group:3,allergens_tags:['en:milk','en:nuts'],categories_tags:CHOCO_CATS,countries_tags:['en:united-kingdom'],additives_n:0,
 nutriments:{'energy-kcal_100g':440+n*10,fat_100g:fat,'saturated-fat_100g':sat,carbohydrates_100g:sugars+3,sugars_100g:sugars,proteins_100g:8,salt_100g:.1}}),ean13(500000000100+n*7));
const SWAPS=[lighter(1,'Hazelnut cocoa spread, light','b',18,3.2,15),lighter(2,'Oat and cocoa spread','c',24,4.4,19),lighter(3,'Cocoa spread, less sugar','c',32,6.1,24)];
export const demoProduct=code=>DEMO[code]||DEMO[DEMO_CODES.spread];

const PICKS=[[DEMO_CODES.spread,'Chocolate spread','Sugary spread · grade E'],[DEMO_CODES.pasta,'Wholewheat pasta','Pantry staple · grade A'],[DEMO_CODES.cola,'Zero cola','Sugar-free · ultra-processed']];

/* ---------- animated phone: four scenes on a loop, purely decorative ---------- */
function phone(){
 const p=demoProduct(DEMO_CODES.spread);
 return `<div class="phone-wrap"><div class="phone" aria-hidden="true"><div class="screen">
  <div class="scene scene-scan"><span class="eyebrow" style="color:#d9efb8">1 · Scan</span><div class="sc-frame">${barcodeBars('5012345678900',{height:80})}</div><h4>Point at any barcode</h4><span class="sc-cap" style="color:#bcd4c0">Or type it, or snap a photo</span></div>
  <div class="scene"><span class="eyebrow">2 · Read</span><div class="sc-head">${packArt(p)}<div><h4>${e(p.name)}</h4><span class="sc-cap">${e(p.brand)}</span></div></div>
   <div class="nsbar nsbar-sm" style="align-self:flex-start">${[...'ABCDE'].map(l=>`<span class="ns ns-${l}${l==='E'?' on':''}">${l}</span>`).join('')}</div>
   <div class="sc-row r"><i></i>High in sugar<span>56 g · 14 tsp</span></div><div class="sc-row a"><i></i>Ultra-processed<span>NOVA 4</span></div><div class="sc-row r"><i></i>High in saturated fat<span>10.6 g</span></div><div class="sc-row g"><i></i>Low in salt<span>0.11 g</span></div></div>
  <div class="scene"><span class="eyebrow">3 · Dose</span><h4>How much will you have?</h4><div class="sc-amount"><span>A real spoonful</span><b>15 g</b></div><div class="sc-slider"></div>
   <div class="sc-cap" style="margin-top:10px">That is about 2 sugar cubes</div><div class="sc-cubes"><i style="--i:0"></i><i style="--i:1"></i></div>
   <div class="sc-cap" style="margin-top:8px">The whole 400 g jar would be 56 cubes.</div></div>
  <div class="scene"><span class="eyebrow">4 · Swap</span><h4>Better choices, same aisle</h4>
   ${SWAPS.slice(0,3).map(s=>`<div class="sc-swap">${packArt(s)}<div><strong>${e(s.name)}</strong><small>E → ${s.nutriScore} · less sugar</small></div></div>`).join('')}</div>
 </div></div><div class="phone-dots" aria-hidden="true"><i></i><i></i><i></i><i></i></div></div>`;
}

/* ---------- live stage ---------- */
function liveStage(state){
 const d=state.demo||{},p=demoProduct(d.code);
 if(d.phase==='scanning')return `<div class="live-scanning" role="status" aria-live="polite"><div class="reading">${barcodeBars(p.barcode,{height:64})}</div><strong>Reading the label…</strong><span>Looking up ${e(p.barcode)}</span></div>`;
 const amount=state.portionAmount??portionStart(p);
 const swaps=swapsWorthOffering(p,DEFAULT_PROFILE())?betterChoices(p,SWAPS,DEFAULT_PROFILE(),'en:chocolate-spreads'):null;
 const comp=compositionBar(p);
 return `<div class="live-head"><div class="ph-visual">${packArt(p)}</div><div><span class="eyebrow"><span class="dot"></span>${e(p.brand)}</span><h3>${e(p.name)}</h3><p>${e(p.quantity)} · barcode ${e(p.barcode)}</p></div></div>
 <div class="live-grid"><div class="live-col">
  ${scoreCards(p)}
  <section class="card-sec" aria-label="The quick read"><div class="sec-head"><h2>The quick read</h2><p class="sec-sub">Tap any line. Every one has a reason.</p></div>${quickReadList(p)}</section>
  ${swaps&&swaps.items.length?`<section class="card-sec"><div class="sec-head"><h2>${i('swap')} Better choices</h2><p class="sec-sub">Same aisle. Better on ${e(swaps.plan.reason)}.</p></div><div class="swap7-list">${swaps.items.slice(0,3).map(x=>swapCard(x,p,{demo:true})).join('')}</div></section>`:
   `<section class="card-sec"><div class="sec-head"><h2>${i('swap')} Better choices</h2></div><p class="muted">${p.nutriScore==='A'?'Already a strong pick, so nothing to swap. FoodScan only suggests a swap when there is a real improvement.':'Nothing here is high in sugar, saturated fat or salt, so there is no swap to suggest. It will still tell you it is ultra-processed and lists the additives.'}</p></section>`}
 </div><div class="live-col">
  <section class="card-sec"><div class="sec-head"><h2>At a glance <small>per 100 ${p.basis==='ml'?'ml':'g'}</small></h2></div>${lightTiles(p)}</section>
  <section class="card-sec"><div class="sec-head"><h2>Your portion</h2><p class="sec-sub">Drag the slider. The numbers and the cubes follow.</p></div>${portionPanel(p,amount)}</section>
  ${comp?`<section class="card-sec"><div class="sec-head"><h2>What is in 100 ${p.basis==='ml'?'ml':'g'}?</h2></div>${comp}</section>`:''}
 </div></div>`;
}

export const demoStage=liveStage;
const OFFER=[
 ['spark','Instant quick read','High in sugar, low in salt, ultra-processed, contains milk. In plain English, in about two seconds.'],
 ['info','Receipts for every line','Tap Why? to see the number, the threshold it was compared with, and where it came from.'],
 ['cube','Dose, not fear','Slide to your real portion. See sugar as cubes and everything as a share of a daily guide.'],
 ['swap','Better choices','Same aisle, sold in your country, never more processed, never something you avoid.'],
 ['shield','Allergen-aware','Unknown is never treated as safe. It even flags when the ingredients mention an allergen the tags missed.'],
 ['leaf','Made for you','Pick priorities like less sugar or more protein, and what to avoid. Every screen adapts.'],
 ['compare','Side-by-side compare','Up to four foods in one table, ranked by what matters to you, never hidden by it.'],
 ['list','Smart shopping list','Tick it off and it moves to your pantry. See the Nutri-Score mix of your trip before you shop.'],
 ['package','Pantry and reminders','Dates you enter, gentle reminders, and no guessing about whether something is safe.'],
 ['share','Share cards','Turn any read into an image, drawn on your own device with nothing uploaded.'],
 ['offline','Works offline','Install it like an app. Foods you have scanned, your lists and your pantry are there with no signal.'],
 ['lock','Private by design','No account or third-party tracking scripts. Your profile and lists stay local; merchant searches open only when tapped.']
];
const FAQ=[
 ['Is FoodScan really free?','Yes. No account or subscription is required. Optional, clearly labeled affiliate search links may earn a commission when used.'],
 ['Where does the information come from?','From Open Food Facts, a community-built open database. If something is missing FoodScan says so, and it never treats a missing number as zero.'],
 ['Why no score out of 100?','A single number hides the reasoning, and two foods with the same number can be very different. FoodScan shows Nutri-Score exactly as the source gives it, and every other line comes with the rule behind it, so you decide.'],
 ['Can I rely on it for allergies?','FoodScan is allergy-aware, not allergy-proof. It withholds anything it cannot confirm and flags when ingredients mention an allergen the tags miss. Always read the physical label too.'],
 ['Does it work without internet?','For foods you have already scanned, your lists and your pantry, yes. Looking up something new needs a connection.'],
 ['Does it track me?','No third-party tracking scripts are included. Optional weekly activity stays on this device. A requested lookup shares only the barcode, search words or category with the source; an Amazon search sends its query only after you tap the merchant link.']
];

export function demoView(state){
 const d=state.demo||{},tip=tipOfTheDay();
 return `<div class="container demo">
  <section class="demo-hero" aria-labelledby="demo-title"><div><span class="eyebrow"><span class="dot"></span>How FoodScan works</span>
   <h1 id="demo-title">From barcode to <em>real facts</em> with one scan.</h1>
   <p class="lead">Scan any packaged food and get a plain-English read with the reason for every line, what a real portion adds up to, and better choices in the same aisle. No account. No fear scores.</p>
   <div class="button-row"><button class="button button-primary button-lg" data-action="scroll-to" data-target="try">${i('spark')} Try it live</button><button class="button button-ghost button-lg" data-action="camera">${i('scan')} Scan my first food</button></div>
   <ul class="demo-facts"><li>${i('lock')} No account</li><li>${i('shield')} No third-party trackers</li><li>${i('offline')} Works offline</li><li>${i('check')} Free</li></ul></div>
   ${phone()}</section>

  <section aria-labelledby="easy-title"><div class="sec-title"><span class="eyebrow">So easy</span><h2 id="easy-title">Three taps from <em>curious</em> to confident.</h2><p>No setup, no sign-up, nothing to learn.</p></div>
   <div class="steps"><div class="step"><span class="step-ico">${i('scan')}</span><h3>Scan or type</h3><p>Point your camera at any barcode, snap a photo of it, or type the digits. Nothing to download first.</p><span class="time">Camera and connection permitting</span></div>
    <div class="step"><span class="step-ico">${i('spark')}</span><h3>Read the real story</h3><p>Nutri-Score, how processed it is, sugar in cubes, allergens. All plain English, each line with its reason.</p><span class="time">zero jargon</span></div>
    <div class="step"><span class="step-ico">${i('swap')}</span><h3>Pick a better one</h3><p>Tap Better choices for options in the same aisle that beat it on what matters, then add one to your list.</p><span class="time">one tap</span></div></div></section>

  <section id="try" aria-labelledby="try-title"><div class="sec-title"><span class="eyebrow">Try it yourself</span><h2 id="try-title">Scan something. <em>Really.</em></h2><p>These are example products with built-in data, so this works right here, even offline. It is the same screen you get for a real scan.</p></div>
   <div class="live-bar" role="group" aria-label="Pick an example product to scan">${PICKS.map(([code,name,sub])=>`<button class="demo-pick" data-action="demo-scan" data-code="${code}" aria-pressed="${d.code===code}">${barcodeBars(code,{height:26})}<span>${e(name)}<small>${e(sub)}</small></span></button>`).join('')}</div>
   <div class="live-stage" aria-live="polite">${liveStage(state)}</div>
   <p class="live-note">Example products, not real brands. Real scans use live Open Food Facts data.</p></section>

  <section aria-labelledby="offer-title"><div class="sec-title"><span class="eyebrow">What you get</span><h2 id="offer-title">Everything a smart shopper <em>actually needs.</em></h2><p>Twelve things FoodScan does, and every one of them runs on your device.</p></div>
   <div class="offer">${OFFER.map(([ic,t,text])=>`<article class="offer-card"><span class="offer-ico">${i(ic)}</span><h3>${t}</h3><p>${text}</p></article>`).join('')}</div></section>

  <section aria-labelledby="vs-title"><div class="sec-title"><span class="eyebrow">A different idea</span><h2 id="vs-title">A number tells you <em>what.</em> We show you <em>why.</em></h2><p>Most scanners boil a food down to one score and ask you to trust it. FoodScan shows its working.</p></div>
   <div class="vs"><div class="vs-card vs-old"><small>A single score (illustration)</small><div class="num">23<span>/100</span></div><div class="verdict-word">Poor</div><p>Why? How much of it are you eating? What is it made of?</p><div class="q">&ldquo;Just trust the number&rdquo;</div></div>
   <div class="vs-card vs-new"><small>FoodScan</small><h3>Chocolate hazelnut spread</h3>
    <div class="sc-row r"><i></i>High in sugar<span>56 g per 100 g · about 14 tsp</span></div>
    <div class="sc-row a" style="margin-top:8px"><i></i>Ultra-processed (NOVA 4)<span>industrial formulation</span></div>
    <div class="sc-row g" style="margin-top:8px"><i></i>Low in salt<span>0.11 g</span></div>
    <p class="small muted mt-1">A real 15 g spoonful is 8.4 g of sugar, about 2 cubes:</p>${sugarCubes(8.4)}
    <p class="small muted">Every line opens to show the rule behind it. You decide.</p></div></div></section>

  <section aria-label="Why people trust it"><div class="trust">
   <div class="trust-item">${i('lock')}<span>No account<small>Nothing to sign up for</small></span></div>
   <div class="trust-item">${i('shield')}<span>No third-party trackers<small>No third-party scripts</small></span></div>
   <div class="trust-item">${i('offline')}<span>Works offline<small>Install it like an app</small></span></div>
   <div class="trust-item">${i('info')}<span>Open data<small>Powered by Open Food Facts</small></span></div></div></section>

  <section aria-labelledby="faq-title"><div class="sec-title"><span class="eyebrow">Good questions</span><h2 id="faq-title">Straight <em>answers.</em></h2></div>
   <div class="faq">${FAQ.map(([q,a])=>`<details><summary>${q}</summary><div>${a}</div></details>`).join('')}</div></section>

  <section class="demo-cta" aria-labelledby="cta-title"><h2 id="cta-title">Ready to scan your <em>first food?</em></h2><p>No installation or signup needed. Lookup speed depends on your connection. Today's label wisdom: ${e(tip.title.toLowerCase())}.</p>
   <div class="button-row"><button class="button button-primary button-lg" data-action="camera">${i('scan')} Scan now</button><a class="button button-ghost button-lg" href="#home">${i('keyboard')} Type a barcode</a><button class="button button-ghost button-lg" data-action="install">${i('download')} Install the app</button></div></section>
 </div>`;
}
