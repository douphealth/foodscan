import{j as c}from"./chunk-6K2A3QNO-v8300.js";import{m as Rt}from"./chunk-JOUXBJOG-v8300.js";import{c as g,g as d,i as m,j as y,k as closeSheet,l as b}from"./chunk-4O7IN74N-v8300.js";import{d as e,e as tn}from"./chunk-6K6QREZY-v8300.js";
function L(n,t=null){y(e("Share this link"),g`<p class="small muted">${e("Automatic copying was unavailable. Select and copy this link.")}</p><label class="sr" for="share-manual">${e("Link to share")}</label><input id="share-manual" class="share-url" type="url" readonly value="${n}">`,{focus:"#share-manual"}),c(t,"manual")}
async function v(n,t=null,r=""){try{if(!navigator.clipboard?.writeText)throw new Error("no clipboard");return await navigator.clipboard.writeText(r?`${r} ${n}`:n),c(t,"clipboard"),m(e("Link copied. Paste it into any chat.")),"copied"}catch{return L(n,t),"manual"}}
async function R({title:n,text:t,url:r,share:a=null}){if(navigator.share)try{return await navigator.share({title:n,text:t,url:r}),c(a,"native"),"shared"}catch(i){if(i?.name==="AbortError")return"cancelled"}return v(r,a,t)}
function k(n,t){let r=URL.createObjectURL(n),a=document.createElement("a");a.href=r,a.download=t,document.body.append(a),a.click(),a.remove(),setTimeout(()=>URL.revokeObjectURL(r),4e3)}
async function W(n,t=null){try{if(!navigator.clipboard?.write||typeof ClipboardItem>"u")throw new Error("no-img-clip");return await navigator.clipboard.write([new ClipboardItem({"image/png":n})]),c(t,"clipboard"),m(e("Card image copied! Paste it directly into WhatsApp, Discord, X or Messages.")),!0}catch{return!1}}
async function S(n,{filename:t,title:r,text:a,share:i=null}){let l=new File([n],t,{type:"image/png"});if(navigator.canShare?.({files:[l]}))try{return await navigator.share({files:[l],title:r,text:a}),c(i,"image"),"shared"}catch(o){if(o?.name==="AbortError")return"cancelled"}return await W(n,i)?"copied":(k(n,t),c(i,"download"),m(e("Image saved. Add it to a post or a chat.")),"downloaded")}
var f="";
function I({heading:n,title:t,text:r,hooks:hk=null,share:a,makeImage:i,filename:l,initialVariant:initFmt="post",swapLabel:swLbl="",onUrlForVariant:urlFn=null}){
  let o=null,u="",fmt=initFmt,hIdx=0,cache=new Map;
  let list=Array.isArray(hk)&&hk.length?hk:[{id:"verdict",label:e("Verdict"),text:r},{id:"story",label:e("Viral hook"),text:`${r} 👇`},{id:"clean",label:e("Short"),text:t}];
  let curText=()=>list[hIdx]?.text||r;
  let curUrl=()=>urlFn?urlFn(fmt):a.url;
  let curFile=()=>l.replace(/\.png$/i,fmt==="post"?".png":`-${fmt}.png`);
  let savedCount=Rt().length,showBasketJump=a?.via!=="basket"&&savedCount>0;
  f&&(URL.revokeObjectURL(f),f="");
  y(n,g`<div class="sharesheet">
    <div class="sharesheet__tabs" role="tablist" aria-label="${e("Card style")}">
      <button type="button" role="tab" aria-selected="${String(fmt==="post")}" class="opt opt--xs ${fmt==="post"?"is-on":""}" data-act="sh:fmt" data-arg="post">${b("photo",14)}${e("4:5 Feed")}</button>
      <button type="button" role="tab" aria-selected="${String(fmt==="swap")}" class="opt opt--xs ${fmt==="swap"?"is-on":""}" data-act="sh:fmt" data-arg="swap">${b("sparkle",14)}${swLbl||e("Swap Spotlight")}</button>
      <button type="button" role="tab" aria-selected="${String(fmt==="story")}" class="opt opt--xs ${fmt==="story"?"is-on":""}" data-act="sh:fmt" data-arg="story">${b("scanframe",14)}${e("9:16 Story")}</button>
      <button type="button" role="tab" aria-selected="${String(fmt==="receipt")}" class="opt opt--xs ${fmt==="receipt"?"is-on":""}" data-act="sh:fmt" data-arg="receipt">${b("sliders",14)}${e("Dark Receipt")}</button>
    </div>
    <figure class="sharesheet__card" id="share-card" data-fmt="${fmt}" aria-busy="true"><span class="skel skel--card"></span><figcaption class="sr" role="status">${e("Drawing the card…")}</figcaption></figure>
    <div class="sharesheet__hooks">
      <div class="sharesheet__hook-bar" role="group" aria-label="${e("Caption style")}">
        ${list.map((x,idx)=>g`<button type="button" class="opt opt--xs ${idx===0?"is-on":""}" data-act="sh:hook" data-arg="${idx}">${x.label}</button>`)}
      </div>
      <p class="sharesheet__caption" id="share-caption-preview">${curText()}</p>
    </div>
    <p class="sharesheet__url"><span class="sr">${e("Link to share")}: </span><span class="mono" id="share-url-preview">${curUrl().replace(/^https?:\/\//,"").replace(/\?.*$/,"")}</span></p>
    <div class="sharesheet__actions">
      <button type="button" class="btn btn--primary" data-act="sh:image" disabled>${b("share",18)}${e("Share the card")}</button>
      <button type="button" class="btn btn--soft" data-act="sh:copy-img" disabled>${b("photo",18)}${e("Copy card image")}</button>
      <button type="button" class="btn btn--soft" data-act="sh:save" disabled>${b("plus",18)}${e("Save image")}</button>
      <button type="button" class="btn btn--ghost" data-act="sh:copy">${e("Copy link")}</button>
    </div>
    <div class="sharesheet__quick" aria-label="${e("Share this link")}">
      <button type="button" class="btn btn--ghost btn--xs" data-act="sh:wa">WhatsApp</button>
      <button type="button" class="btn btn--ghost btn--xs" data-act="sh:tg">Telegram</button>
      <button type="button" class="btn btn--ghost btn--xs" data-act="sh:x">X / Post</button>
      <button type="button" class="btn btn--ghost btn--xs" data-act="sh:link">${b("share",14)}${e("Share the link")}</button>
    </div>
    ${showBasketJump?g`<div class="sharesheet__basket"><button type="button" class="btn btn--soft btn--xs" data-act="sh:go-basket">${b("layers",15)}${tn(savedCount,"Share my whole basket & swaps ({n} product)","Share my whole basket & swaps ({n} products)")}</button></div>`:""}
  </div>`);
  let draw=async vFmt=>{
    fmt=vFmt;
    let h=document.getElementById("share-card"),up=document.getElementById("share-url-preview");
    h&&(h.dataset.fmt=vFmt,h.setAttribute("aria-busy","true"));
    up&&(up.textContent=curUrl().replace(/^https?:\/\//,"").replace(/\?.*$/,""));
    try{
      let s=cache.get(vFmt);
      s||(s=await i({variant:vFmt}),s&&cache.set(vFmt,s));
      o=s,h=document.getElementById("share-card");
      if(!h||!s)return;
      u&&URL.revokeObjectURL(u),u=f=URL.createObjectURL(s),h.innerHTML="";
      let p=new Image;
      p.src=u,p.alt=e("The card that will be shared: {name}",{name:t}),p.decoding="async",h.append(p),h.setAttribute("aria-busy","false");
      for(let $ of document.querySelectorAll('[data-act="sh:image"],[data-act="sh:save"],[data-act="sh:copy-img"]'))$.disabled=!1;
    }catch{
      let s=document.getElementById("share-card");
      s&&(s.setAttribute("aria-busy","false"),s.textContent=e("The card could not be made. You can still share the link."));
    }
  },w=Promise.resolve().then(()=>draw(fmt));
  return d("sh:fmt",btn=>{
    let vFmt=btn.dataset.arg||"post";
    for(let el of document.querySelectorAll('[data-act="sh:fmt"]')){
      let on=el.dataset.arg===vFmt;
      el.classList.toggle("is-on",on),el.setAttribute("aria-selected",String(on));
    }
    draw(vFmt);
  }),d("sh:hook",btn=>{
    hIdx=Number(btn.dataset.arg)||0;
    for(let el of document.querySelectorAll('[data-act="sh:hook"]'))el.classList.toggle("is-on",Number(el.dataset.arg)===hIdx);
    let cap=document.getElementById("share-caption-preview");
    cap&&(cap.textContent=curText());
  }),d("sh:image",async()=>{o&&await S(o,{filename:curFile(),title:t,text:`${curText()} ${curUrl()}`,share:{...a,url:curUrl()}})}),
  d("sh:copy-img",async()=>{o&&(await W(o,a)||(k(o,curFile()),c(a,"download"),m(e("Image saved. Add it to a post or a chat."))))}),
  d("sh:save",()=>{o&&(k(o,curFile()),c(a,"download"),m(e("Image saved. Add it to a post or a chat.")))}),
  d("sh:link",()=>R({title:t,text:curText(),url:curUrl(),share:{...a,url:curUrl()}})),
  d("sh:copy",()=>v(curUrl(),a,curText())),
  d("sh:wa",()=>{c(a,"native"),window.open(`https://wa.me/?text=${encodeURIComponent(`${curText()} ${curUrl()}`)}`,"_blank","noopener,noreferrer")}),
  d("sh:tg",()=>{c(a,"native"),window.open(`https://t.me/share/url?url=${encodeURIComponent(curUrl())}&text=${encodeURIComponent(curText())}`,"_blank","noopener,noreferrer")}),
  d("sh:x",()=>{c(a,"native"),window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(curText())}&url=${encodeURIComponent(curUrl())}`,"_blank","noopener,noreferrer")}),
  d("sh:go-basket",()=>{closeSheet(),location.hash="#/choices?share=1"}),
  {ready:w,release:()=>u&&URL.revokeObjectURL(u)};
}
export{R as a,I as b};
