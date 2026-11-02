import{o as r}from"./chunk-6K6QREZY-v8200.js";
var i=null;
function p(){return i??=import("./chunk-QKBAEP6B-v7540.js").then(o=>d(o.default)),i}
function d(o){
  let s=new Map,byGtin=new Map;
  let add=(code,raw,fromPool=!1)=>{
    if(!code||!raw)return;
    let rec=fromPool?{...raw,partial:!1}:raw;
    let c=r({status:"success",product:rec,fetchedAt:Number.isFinite(rec.last_modified_t)?rec.last_modified_t*1e3:Date.now()},String(code));
    if(!c)return;
    let key=String(code).trim(),g14=key.padStart(14,"0");
    if(!s.has(key)||!fromPool)s.set(key,c);
    if(!byGtin.has(g14)||!fromPool)byGtin.set(g14,c);
  };
  for(let[t,e]of Object.entries(o.products||{}))add(t,e,!1);
  for(let list of Object.values(o.pools||{})){
    if(Array.isArray(list))for(let e of list)add(String(e?.code||""),e,!0);
  }
  let u=t=>t.map(e=>r({status:1,product:e,fetchedAt:Number.isFinite(e.last_modified_t)?e.last_modified_t*1e3:0},String(e.code))).filter(Boolean);
  let find=t=>{
    let k=String(t||"").replace(/[\s-]/g,"");
    return s.get(k)||byGtin.get(k.padStart(14,"0"))||null;
  };
  return{
    product:find,
    products:s,
    source:{pool:async t=>o.pools[t]?{products:u(o.pools[t])}:{products:[...s.values()].filter(e=>e.categories.includes(t))}},
    featured:o.featured
  };
}
export{p as a};
