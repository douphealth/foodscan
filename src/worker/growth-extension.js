/* BEGIN growth-extension.js */
// FoodScan 54: public discovery, quality-gated comparisons, anti-abuse voting and branded OG images.
function fs54Pair(a,b){
  const x=fscCanon(a),y=fscCanon(b);
  if(!x||!y||fscSame(x,y))return null;
  return x.padStart(14,'0')<y.padStart(14,'0')?[x,y]:[y,x];
}
function fs54Noindex(message,status=404){return fscResponseError(message,status);}
async function fs54ReadPair(env,a,b){
  if(!FSC_ENABLED(env))return null;
  const pair=fs54Pair(a,b);if(!pair)return null;
  const [left,right]=await Promise.all(pair.map(code=>fscGetRow(env,code)));
  if(!left||!right||!left.family||left.family!==right.family)return null;
  let p1,p2;
  try{p1=fscQuality(JSON.parse(left.source_json));p2=fscQuality(JSON.parse(right.source_json));}catch{return null;}
  if(!p1.eligible||!p2.eligible||p1.parsed.basis!==p2.parsed.basis)return null;
  return {pair,rows:[left,right],products:[p1.parsed,p2.parsed]};
}
function fs54BattleCard(p,code){
  const g=fscMarkupResult(p),source=`https://world.openfoodfacts.org/product/${code}`;
  return `<div class="fsc-fighter"><div class="fsc-photo"><img src="${fscEsc(safeImage(p.image)||'')}" alt="Source package photo of ${fscEsc(p.name)}" loading="lazy" width="300" height="300"></div><p class="fsc-eyebrow">${fscEsc(p.brand)}</p><h2>${fscEsc(p.name)}</h2><p class="fsc-mini">Barcode ${fscEsc(code)}</p><div class="fsc-grade-row"><span class="fsc-grade fsc-grade-${fscEsc(g.grade)}">${fscEsc(g.grade)}</span><span><strong>Nutri-Score</strong><br><small>${fscEsc(g.method)}</small></span></div>${fscFacts(p)}<p><a href="/products/${fscEsc(code)}">View verified facts</a> · <a href="${source}" rel="nofollow noopener noreferrer">Source record</a></p></div>`;
}
async function fs54BattlePage(request,env){
  const url=new URL(request.url),route=url.pathname.match(/^\/battles\/([0-9]{8,14})\/([0-9]{8,14})\/?$/);
  if(!route)return fs54Noindex('Invalid product comparison');
  const pair=fs54Pair(route[1],route[2]);if(!pair)return fs54Noindex('Invalid product comparison');
  if(url.pathname!==`/battles/${pair[0]}/${pair[1]}`)return Response.redirect(`${url.origin}/battles/${pair[0]}/${pair[1]}`,301);
  let info;try{info=await fs54ReadPair(env,...pair);}catch{return fs54Noindex('Comparison temporarily unavailable',503);}
  if(!info)return fs54Noindex('These products are not yet verified, comparable public records. Try the FoodScan scanner.');
  const [p1,p2]=info.products,[a,b]=pair,origin=siteOrigin(url,env),link=`${origin}/battles/${a}/${b}`;
  let votes={votes_a:0,votes_b:0};
  try{votes=await env.FOODSCAN_PUBLIC_DB.prepare('SELECT votes_a,votes_b FROM fsc_battle_votes WHERE pair=?').bind(`${a}:${b}`).first()||votes;}catch{}
  const voteReady=Boolean(env.FOODSCAN_TURNSTILE_SITE_KEY&&env.FOODSCAN_TURNSTILE_SECRET);
  const basis=p1.basis==='ml'?'100 ml':'100 g';
  const allergy1=(p1.allergens||[]).map(x=>String(x)),allergy2=(p2.allergens||[]).map(x=>String(x));
  const page=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${fscEsc(p1.name)} vs ${fscEsc(p2.name)} | FoodScan comparison</title>
   <meta name="description" content="Compare source-reported nutrition per ${basis} for two broad-category food products. Different ingredients and allergens may matter."><meta name="robots" content="noindex,follow"><link rel="canonical" href="${fscEsc(link)}"><meta property="og:title" content="Food Battle: ${fscEsc(p1.name)} vs ${fscEsc(p2.name)}"><meta property="og:description" content="Which would you choose? Compare nutrition facts, ingredients and allergens. No account needed."><meta property="og:image" content="${origin}/battle-cards/${a}/${b}.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="Two verified food products compared using source-reported grades and nutrition"><meta property="og:url" content="${fscEsc(link)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${origin}/battle-cards/${a}/${b}.png"><link rel="stylesheet" href="/public-catalog.css"><link rel="stylesheet" href="/growth-ui.css"><script defer src="/battle-ui.js"></script></head>
   <body><a class="fsc-skip" href="#main">Skip to battle</a><div class="fsc-topbar"><div class="fsc-width fsc-toprow"><a class="fsc-brand" href="/">FoodScan<span class="fsc-dot">.</span></a><nav><a href="/challenge/">Fridge Challenge</a><a href="/#/scan">Scan food</a></nav></div></div><main id="main" class="fsc-width"><div class="fsc-breadcrumb"><a href="/">FoodScan</a> › <a href="/challenge/">Challenges</a> › Food Battle</div>
   <section class="fsc-battle-intro"><span class="fsc-eyebrow">FOODSCAN BATTLE</span><h1>Which would you choose?</h1><p>Compare two products with source-reported facts, not a popularity-based health verdict. These are broad-category comparisons, not guaranteed substitutes.</p><button id="fsc-share-battle" class="fsc-button fsc-button-primary">Challenge a friend ↗</button><span id="fsc-battle-status" role="status" aria-live="polite"></span></section>
   <section class="fsc-fighters" aria-label="Product facts">${fs54BattleCard(p1,a)}${fs54BattleCard(p2,b)}</section>
   <section class="fsc-panel fsc-battle-vote"><h2>Your choice</h2><p>Voting reflects preference only. It does not establish nutritional superiority.</p><p id="fsc-tally">${Number(votes.votes_a)||0} chose the first product · ${Number(votes.votes_b)||0} chose the second.</p>
    ${voteReady?`<div class="cf-turnstile" data-sitekey="${fscEsc(env.FOODSCAN_TURNSTILE_SITE_KEY)}" data-action="foodbattle"></div><div class="fsc-actions"><button data-choice="a" class="fsc-button fsc-button-primary">Choose ${fscEsc(p1.name)}</button><button data-choice="b" class="fsc-button fsc-button-ghost">Choose ${fscEsc(p2.name)}</button></div><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`:'<p class="fsc-warning">Voting will be available after bot protection is configured. Comparison and sharing work now.</p>'}
   </section><section class="fsc-panel"><h2>Before swapping</h2><p>The nutrition basis is ${basis}. Ingredient profiles, serving sizes and allergens can differ. Nutri-Score is not a food-safety or allergy clearance rating.</p><p>Reported allergens may be incomplete. Always check the physical packs.</p></section>
   <section class="fsc-bottom-cta"><h2>Try your own Food Battle</h2><p>Scan another product and explore source-backed comparisons.</p><a href="/#/scan" class="fsc-button fsc-button-light">Scan yours free</a></section></main>
   <footer class="fsc-footer"><div class="fsc-width">Nutrition: Open Food Facts contributors (ODbL). Package images are community sourced. <a href="/how/">Method and limitations</a>.</div></footer>
   <div id="fsc-battle-data" hidden data-a="${fscEsc(a)}" data-b="${fscEsc(b)}" data-link="${fscEsc(link)}"></div></body></html>`;
  const battleCsp = voteReady ? CSP.replace("script-src 'self'", "script-src 'self' https://challenges.cloudflare.com").replace("connect-src 'self'", "connect-src 'self' https://challenges.cloudflare.com").replace("style-src 'self'", "style-src 'self' 'unsafe-inline'") + '; frame-src https://challenges.cloudflare.com' : CSP;
  const output=await secureHtml(page,url,env,200,{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex,follow','Content-Security-Policy':battleCsp},'');
  return request.method==='HEAD'?new Response(null,{status:output.status,headers:output.headers}):output;
}
async function fs54BattleVote(request,env){
  if(request.method!=='POST')return json({error:'method_not_allowed'},405);
  if(!FSC_ENABLED(env))return json({error:'catalog_disabled'},503);
  const url=new URL(request.url);
  if(request.headers.get('Origin')!==url.origin || request.headers.get('Sec-Fetch-Site')==='cross-site')return json({error:'origin_not_allowed'},403);
  if(!env.FOODSCAN_TURNSTILE_SECRET||!env.FOODSCAN_TURNSTILE_SITE_KEY)return json({error:'voting_not_configured'},503);
  let data;try{data=JSON.parse(await boundedRequest(request,1024));}catch{return json({error:'invalid_request'},400);}
  const pair=fs54Pair(data?.a,data?.b),choice=data?.choice,token=String(data?.turnstile||'');
  if(!pair||!['a','b'].includes(choice)||token.length<10||token.length>2048)return json({error:'invalid_vote'},422);
  let info;try{info=await fs54ReadPair(env,...pair);}catch{return json({error:'database_unavailable'},503);}
  if(!info)return json({error:'not_comparable'},404);
  const form=new FormData();form.set('secret',String(env.FOODSCAN_TURNSTILE_SECRET));form.set('response',token);
  let valid=false;
  try{const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:form,signal:AbortSignal.timeout(5000)});if(response.ok){const verify=await response.json();valid=verify.success===true && (!verify.action||verify.action==='foodbattle') && (!verify.hostname||verify.hostname===url.hostname);}}catch{}
  if(!valid)return json({error:'verification_failed'},403);
  const [a,b]=pair,key=`${a}:${b}`;
  try{
    await env.FOODSCAN_PUBLIC_DB.prepare('INSERT INTO fsc_battle_votes(pair,code_a,code_b,votes_a,votes_b,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(pair) DO UPDATE SET votes_a=votes_a+excluded.votes_a,votes_b=votes_b+excluded.votes_b,updated_at=excluded.updated_at').bind(key,a,b,choice==='a'?1:0,choice==='b'?1:0,Date.now()).run();
    const tally=await env.FOODSCAN_PUBLIC_DB.prepare('SELECT votes_a,votes_b FROM fsc_battle_votes WHERE pair=?').bind(key).first();
    return json({votes_a:tally?.votes_a??0,votes_b:tally?.votes_b??0});
  }catch{return json({error:'vote_persistence_failed'},503);}
}
async function fs54PublicLookup(request,env){
  if(request.method!=='GET')return json({error:'method_not_allowed'},405);
  const code=fscCanon(new URL(request.url).searchParams.get('barcode'));
  if(!code)return json({public:false});
  if(!FSC_ENABLED(env))return json({public:false});
  try{const row=await fscGetRow(env,code);if(!row)return json({public:false});const q=fscQuality(JSON.parse(row.source_json));return json(q.eligible?{public:true,url:`/products/${code}`}:{public:false});}
  catch{return json({public:false});}
}
async function fs54OgPage(request,env,code){
  const c=fscCanon(code);if(!c||!FSC_ENABLED(env))return fs54Noindex('Card unavailable');
  let row;try{row=await fscGetRow(env,c);}catch{return fs54Noindex('Card unavailable',503);}
  if(!row)return fs54Noindex('Card unavailable');
  let q;try{q=fscQuality(JSON.parse(row.source_json));}catch{return fs54Noindex('Card unavailable');}
  if(!q.eligible)return fs54Noindex('Card unavailable');
  const g=fscMarkupResult(q.parsed).grade;
  let data;try{data=await fs54RenderOg(q.parsed,g);}catch{return fs54Noindex('Card generation temporarily unavailable',503);}
  return new Response(request.method==='HEAD'?null:data,{status:200,headers:{'Content-Type':'image/png','Cache-Control':'public, max-age=60, s-maxage=60','X-Content-Type-Options':'nosniff','Content-Length':String(data.length)}});
}
async function fs55BattleImage(request,env,a,b){
  if(!['GET','HEAD'].includes(request.method))return fs54Noindex('Method not allowed',405);
  const pair=fs54Pair(a,b);if(!pair)return fs54Noindex('Invalid comparison');
  if(a!==pair[0]||b!==pair[1])return Response.redirect(`${new URL(request.url).origin}/battle-cards/${pair[0]}/${pair[1]}.png`,308);
  let info;try{info=await fs54ReadPair(env,...pair);}catch{return fs54Noindex('Card temporarily unavailable',503);}
  if(!info)return fs54Noindex('Verified comparison unavailable');
  let image;try{image=await fs55RenderBattleOg(...info.products);}catch{return fs54Noindex('Card generation unavailable',503);}
  return new Response(request.method==='HEAD'?null:image,{status:200,headers:{'Content-Type':'image/png','Cache-Control':'public, max-age=60, s-maxage=60','Content-Length':String(image.byteLength),'X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex'}});
}
async function fs54Route(request,env,ctx){
  const path=new URL(request.url).pathname;
  const battleImage=path.match(/^\/battle-cards\/([0-9]{8,14})\/([0-9]{8,14})\.png$/);
  if(battleImage)return fs55BattleImage(request,env,battleImage[1],battleImage[2]);
  if(path==='/api/public-products/lookup')return fs54PublicLookup(request,env);
  if(path==='/api/battles/vote')return fs54BattleVote(request,env);
  if(/^\/battles\/\d{8,14}\/\d{8,14}\/?$/.test(path)){
    if(!['GET','HEAD'].includes(request.method))return fs54Noindex('Method not allowed',405);
    return fs54BattlePage(request,env);
  }
  const og=path.match(/^\/scorecards\/([0-9]{8,14})\/og\.png$/);
  if(og){if(!['GET','HEAD'].includes(request.method))return fs54Noindex('Method not allowed',405);return fs54OgPage(request,env,og[1]);}
  if(path==='/challenge')return Response.redirect(`${new URL(request.url).origin}/challenge/`,308);
  return null;
}

/* END growth-extension.js */

