/** Build source-backed offline-safe category snapshots from Open Food Facts.
 * Generates immutable, versioned JSON with real product barcodes and source metadata.
 * This script is designed to run in GitHub Actions with outbound connectivity.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
const cats=[
'hazelnut-spreads','confectionery-based-spreads','chocolate-spreads','sweet-spreads',
'breakfast-cereals','cereals-and-their-products','mueslis','cereal-bars','biscuits',
'cookies','chocolates','chocolate-bars','candies','snacks',
'yogurts','flavoured-yogurts','greek-style-yogurts','dairies',
'cheeses','butters','margarines','milks','plant-based-milks',
'soft-drinks','sodas','fruit-juices','fruit-based-beverages',
'breads','sliced-breads','crackers','chips-and-fries','potato-chips',
'peanut-butters','nuts','jams','spreads',
'ready-meals','pizzas','sauces','tomato-sauces','ketchups',
'ice-creams','frozen-desserts','protein-bars','energy-bars',
'pasta','rice','breakfasts','salts','oils'
];
const fields='code,product_name,product_name_en,brands,image_front_url,image_url,quantity,product_quantity_unit,nutriments,nutriscore_grade,nutrition_grades,nova_group,allergens_tags,labels_tags,ingredients_analysis_tags,categories_tags,countries_tags,last_modified_t,obsolete,unique_scans_n';
const id=code=>/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(code)&&(()=>{let sum=0;for(let i=code.length-2,w=3;i>=0;i--,w=4-w)sum+=Number(code[i])*w;return (10-sum%10)%10===Number(code.at(-1))})()
const valid=p=>p&&id(String(p.code||''))&&p.obsolete!==true&&String(p.obsolete)!=='1'&&p.nutriments&&typeof p.nutriments==='object'&&Number.isFinite(Number(p.nutriments.sugars_100g??p.nutriments['saturated-fat_100g']??p.nutriments.salt_100g));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const date=new Date().toISOString();
const out='data/alternatives';await fs.mkdir(out,{recursive:true});
const log=[];
for(const slug of cats){
 const cat='en:'+slug;
 const url=new URL('https://search.openfoodfacts.org/search');
 url.searchParams.set('q','categories_tags:"'+cat+'"');
 url.searchParams.set('langs','en,fr,de,es,it,el,pt,nl');
 url.searchParams.set('page_size','60');url.searchParams.set('fields',fields);
 url.searchParams.set('sort_by','-unique_scans_n');
 let hits=[],lastError='';
 for(let attempt=0;attempt<3;attempt++){
  try{
   const response=await fetch(url,{signal:AbortSignal.timeout(20000),headers:{Accept:'application/json','User-Agent':'FoodScan-VerifiedCatalog/1.0 (https://food-scan.gearuptofit.com/)'}});
   if(response.status===429||response.status===503){lastError=String(response.status);await sleep(1500*(attempt+1));continue;}
   if(!response.ok)throw new Error('HTTP '+response.status);
   const b=await response.json();if(!Array.isArray(b.hits))throw new Error('Invalid search response');
   hits=b.hits;break;
  }catch(e){lastError=String(e);await sleep(850);}
 }
 const selected=[],seen=new Set();
 for(const hit of hits){
  const code=String(hit.code||'');
  if(!valid(hit)||seen.has(code)||!Array.isArray(hit.categories_tags)||!hit.categories_tags.includes(cat))continue;
  const n=hit.nutriments||{};const item={...hit,code,partial:true};
  if(Array.isArray(item.brands))item.brands=item.brands.filter(x=>typeof x==='string').join(', ');
  item.categories_tags=hit.categories_tags.filter(x=>typeof x==='string').slice(0,50);
  for(const key of ['countries_tags','allergens_tags','labels_tags','ingredients_analysis_tags'])if(!Array.isArray(item[key]))item[key]=[];
  if(!Number.isFinite(Number(item.nova_group)))delete item.nova_group;
  selected.push(item);seen.add(code);if(selected.length>=48)break;
 }
 const target=path.join(out,slug+'.json');
 if(selected.length){
  await fs.writeFile(target,JSON.stringify({category:cat,source:'Open Food Facts search index',retrievedAt:date,partial:true,products:selected})+'\n');
 }else{
  // Never overwrite a prior verified catalog with a failed or empty query.
  try{await fs.access(target);}catch{}
 }
 log.push({category:slug,verified:selected.length,error:lastError});
 console.log(slug,selected.length,lastError||'OK');
 await sleep(280);
}
await fs.writeFile(path.join(out,'catalog-status.json'),JSON.stringify({generatedAt:date,summary:log})+'\n');
if(log.filter(x=>x.verified>=3).length<10)throw Error('Too few working source categories: '+JSON.stringify(log));
