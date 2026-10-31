import { renderPublicProductPage } from "./render.js";

const BARCODE = /^(?:[0-9]{8}|[0-9]{12,14})$/;
const BASE = "https://food-scan.gearuptofit.com";
const headers = {"content-type":"text/html; charset=utf-8","x-content-type-options":"nosniff","cache-control":"public, max-age=120, s-maxage=600"};
const response = (body,status=200,extra={}) => new Response(body,{status,headers:{...headers,...extra}});
function safeBarcode(value) {
  if (!BARCODE.test(value)) return false;
  const digits = value.split("").map(Number);
  const check = digits.pop();
  let sum = 0, weight = 3;
  for (let i=digits.length-1;i>=0;i--){sum += digits[i]*weight;weight = weight===3?1:3;}
  return (10 - sum % 10) % 10 === check;
}
function pageNotFound() { return response("<!doctype html><html><head><meta name=\"robots\" content=\"noindex,nofollow\"></head><body><h1>Product unavailable</h1><a href=\"/\">Scan a food</a></body></html>",404,{"cache-control":"no-store"}); }
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});}
export function publicQuality(p){
  if(!p || !safeBarcode(String(p.code||""))) return false;
  const n=p.nutriments||{};
  const keys=["energy-kcal","sugars","salt","fat","saturated-fat","carbohydrates","proteins"];
  const count=keys.filter(k=>Number.isFinite(Number(n[k+"_100g"])) && n[k+"_100g"]!==null && n[k+"_100g"]!=="" && Number(n[k+"_100g"])>=0).length;
  const name=String(p.product_name||"").trim();
  const flags=Array.isArray(p.data_quality_errors_tags)?p.data_quality_errors_tags:[];
  return name.length>=3 && name.length<=180 && count>=6 && keys.slice(0,5).every(k=>Number.isFinite(Number(n[k+"_100g"])) && n[k+"_100g"]!==null && n[k+"_100g"]!=="" && Number(n[k+"_100g"])>=0) &&
    ["100g","100ml"].includes(String(p.nutrition_data_per||"").toLowerCase()) &&
    flags.length===0 && Boolean(String(p.ingredients_text_en||p.ingredients_text||"").trim()) &&
    Boolean(String(p.brands||"").trim()) && Boolean(String(p.image_front_url||"").startsWith("https://")) &&
    !!renderPublicProductPage(p);
}
export async function handlePublicRoute(request,env){
  const url=new URL(request.url),path=url.pathname, db=env?.FOODSCAN_DB;
  if(!(/^\/products\/[0-9]+$/.test(path) || path==="/sitemap-products-d1.xml" || path==="/api/public-products/ingest"))return null;
  if(!db)return json({error:"public_catalog_not_configured"},503);
  if(path==="/api/public-products/ingest"){
    if(request.method!=="POST")return json({error:"method_not_allowed"},405);
    if(!env.FOODSCAN_INGEST_TOKEN)return json({error:"ingest_not_configured"},503);
    const supplied=request.headers.get("authorization")||"";
    if(supplied!==`Bearer ${env.FOODSCAN_INGEST_TOKEN}`)return json({error:"unauthorized"},401);
    if(Number(request.headers.get("content-length")||0)>20000)return json({error:"payload_too_large"},413);
    let body;try{body=await request.json();}catch{return json({error:"bad_json"},400);}
    const code=String(body?.barcode||"");
    if(!safeBarcode(code))return json({error:"invalid_barcode"},422);
    const exists=await db.prepare("SELECT barcode, quality_status FROM public_products WHERE barcode=?").bind(code).first();
    if(exists?.quality_status==="eligible")return json({barcode:code,status:"already_eligible"});
    // Ingestion never trusts client-supplied nutrition facts, names, images or grades.
    let upstream;
    try{
      upstream=await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=code,product_name,brands,nutrition_data_per,nutriments,ingredients_text,ingredients_text_en,image_front_url,data_quality_errors_tags,nutriscore_grade,nova_group,last_modified_t`,{
        headers:{"User-Agent":env.FOODSCAN_OFF_USER_AGENT||"FoodScan-Catalog/1.0 (https://food-scan.gearuptofit.com/)"},signal:AbortSignal.timeout(7500)});
    }catch{return json({error:"upstream_unavailable"},503);}
    if(!upstream.ok)return json({error:"upstream_unavailable",upstream_status:upstream.status},503);
    const source=await upstream.json(),p=source?.product;
    if(!p || String(p.code)!==code)return json({error:"source_product_not_found"},404);
    const eligible=publicQuality(p), status=eligible?"eligible":"quarantined";
    const payload=JSON.stringify(p);
    if(payload.length>20000)return json({error:"record_too_large"},422);
    const count=["energy-kcal","sugars","salt","fat","saturated-fat","carbohydrates","proteins","fiber"].filter(k=>Number.isFinite(Number(p.nutriments?.[k+"_100g"]))).length;
    await db.prepare(`INSERT INTO public_products (barcode,product_name,brand,public_payload_json,source_url,source_modified_at,quality_status,core_nutrient_count)
      VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(barcode) DO UPDATE SET product_name=excluded.product_name,brand=excluded.brand,
      public_payload_json=excluded.public_payload_json,source_url=excluded.source_url,source_modified_at=excluded.source_modified_at,
      quality_status=excluded.quality_status,core_nutrient_count=excluded.core_nutrient_count,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')`).bind(code,String(p.product_name||"").slice(0,180),String(p.brands||"").slice(0,180),payload,`https://world.openfoodfacts.org/product/${code}`,String(p.last_modified_t||""),status,count).run();
    return json({barcode:code,status});
  }
  if(path==="/sitemap-products-d1.xml"){
    const rows=await db.prepare("SELECT barcode,updated_at FROM public_products WHERE quality_status='eligible' ORDER BY updated_at DESC LIMIT 5000").all();
    const entries=(rows.results||[]).filter(p=>safeBarcode(p.barcode)).map(p=>`<url><loc>${BASE}/products/${p.barcode}</loc><lastmod>${String(p.updated_at).slice(0,10)}</lastmod></url>`).join("");
    return response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`,200,{"content-type":"application/xml; charset=utf-8","cache-control":"public, max-age=300"});
  }
  if(request.method!=="GET" && request.method!=="HEAD")return response("",405);
  const code=path.slice("/products/".length);
  if(!safeBarcode(code))return pageNotFound();
  const row=await db.prepare("SELECT public_payload_json FROM public_products WHERE barcode=? AND quality_status='eligible'").bind(code).first();
  if(!row)return pageNotFound();
  let p;try{p=JSON.parse(row.public_payload_json);}catch{return pageNotFound();}
  if(!publicQuality(p))return pageNotFound();
  const html=renderPublicProductPage(p,BASE);
  if(!html)return pageNotFound();
  return response(request.method==="HEAD"?"":html,200);
}
