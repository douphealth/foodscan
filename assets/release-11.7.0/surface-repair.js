/* FoodScan 11.7.0 surface repair: guarantees readable light surfaces whatever legacy CSS says. Presentation only. */
(()=>{
const SKIP='dialog,#toast,svg,img,video,canvas,input,textarea,select,option,script,style,noscript,[data-keep-dark]';
const KEEP='button,.button,[role=button],.nav-scan,.fs-scan-primary,.lookup-submit,.icon-button,.nav-count,.r16-next a,.r15-detail-actions>a,.fs12-hero-primary,.brand-mark,.fs12-ing-index,.ns-dot,.nova-pill,.nsbar *,.novabar *,.light-dot,.dot,.status-dot';
const LIGHT={bg:'#f3f6ec',ink:'#1d2616',soft:'#46523c'};
const parse=c=>{const m=/rgba?\(([^)]+)\)/.exec(c||'');if(!m)return null;const p=m[1].split(/[\s,\/]+/).filter(Boolean).map(x=>x.endsWith('%')?parseFloat(x)*2.55:parseFloat(x));if(p.length<3||p.slice(0,3).some(Number.isNaN))return null;return {r:p[0],g:p[1],b:p[2],a:p.length>3&&!Number.isNaN(p[3])?(p[3]>1?p[3]/255:p[3]):1};};
const lin=v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;};
const lum=c=>.2126*lin(c.r)+.7152*lin(c.g)+.0722*lin(c.b);
const contrast=(a,b)=>{const x=lum(a),y=lum(b),hi=Math.max(x,y),lo=Math.min(x,y);return (hi+.05)/(lo+.05);};
const mix=(f,b)=>({r:f.r*f.a+b.r*(1-f.a),g:f.g*f.a+b.g*(1-f.a),b:f.b*f.a+b.b*(1-f.a),a:1});
const gradientColor=img=>{if(!img||!/gradient/.test(img))return null;const all=[...img.matchAll(/rgba?\([^)]+\)/g)].map(m=>parse(m[0])).filter(c=>c&&c.a>=.6);if(!all.length)return null;const n=all.length;return {r:all.reduce((s,c)=>s+c.r,0)/n,g:all.reduce((s,c)=>s+c.g,0)/n,b:all.reduce((s,c)=>s+c.b,0)/n,a:1};};
const own=cs=>{const c=parse(cs.backgroundColor);if(c&&c.a>=.6)return c;return gradientColor(cs.backgroundImage);};
const PAGE={r:245,g:246,b:242,a:1};
function effective(el){for(let n=el;n&&n.nodeType===1;n=n.parentElement){const c=own(getComputedStyle(n));if(c)return c;}return PAGE;}
const skipped=el=>el.matches(SKIP)||el.closest('dialog,#toast,[data-keep-dark]');
let busy=false,timer=0;
function repair(root=document.body){
 if(busy)return;busy=true;
 try{
  const all=[root,...root.querySelectorAll('*')].filter(el=>el.nodeType===1&&!skipped(el));
  const dark=[];
  for(const el of all){
   if(el.matches(KEEP))continue;
   const c=own(getComputedStyle(el));if(!c||lum(c)>=.14)continue;
   const r=el.getBoundingClientRect();if((r.width||r.height)&&(r.width<18||r.height<18))continue;
   dark.push(el);
  }
  for(const el of dark)el.classList.add('r17-lit');
  const edits=[];
  for(const el of all){
   const cs=getComputedStyle(el);
   const text=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
   if(!text)continue;
   const fg=parse(cs.color);if(!fg)continue;
   const bg=effective(el),eff=fg.a<1?mix(fg,bg):fg,ratio=contrast(eff,bg);
   const weak=Number.parseInt(cs.fontWeight,10)<400;
   if(ratio<4.5){const ink=parse('rgb(29,38,22)'),pale=parse('rgb(244,248,238)');edits.push([el,contrast(ink,bg)>=contrast(pale,bg)?LIGHT.ink:'#f4f8ee',weak]);}
   else if(weak)edits.push([el,null,true]);
  }
  for(const [el,color,weak] of edits){if(color)el.style.setProperty('color',color,'important');if(weak)el.style.setProperty('font-weight','400','important');}
 }finally{busy=false;}
}
const schedule=()=>{clearTimeout(timer);timer=setTimeout(()=>repair(),70);};
const start=()=>{const target=document.body;if(!target)return;repair();new MutationObserver(m=>{if(busy)return;if(m.some(x=>x.type==='childList'))schedule();}).observe(target,{childList:true,subtree:true});document.addEventListener('toggle',schedule,true);window.addEventListener('load',schedule);if(document.fonts?.ready)document.fonts.ready.then(schedule);};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
globalThis.__foodscanSurfaceRepair={repair,contrast,parse};
})();
