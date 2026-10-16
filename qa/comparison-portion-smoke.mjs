import assert from 'node:assert/strict';
import {bestLocalComparison} from '../assets/release-11.12.0/comparison-recovery.js';
import {presetFacts} from '../assets/release-11.12.0/portion-insights.js';
import worker from '../_worker.js';

const base={barcode:'3017620422003',basis:'g',categories:['en:hazelnut-spreads']};
const saved=[
 {barcode:'3017620425035',basis:'g',categories:['en:hazelnut-spreads'],partial:false,provenance:'off'},
 {barcode:'3017620422003',basis:'g',categories:['en:hazelnut-spreads'],partial:false,provenance:'off'},
 {barcode:'3017620424567',basis:'g',categories:['en:hazelnut-spreads'],partial:true,provenance:'off'},
 {barcode:'3017620424568',basis:'g',categories:['en:hazelnut-spreads'],partial:false,provenance:'local'},
 {barcode:'3017620424569',basis:'ml',categories:['en:hazelnut-spreads'],partial:false,provenance:'off'}
];
const rank=(b,candidates,profile,category)=>({items:candidates.filter(p=>p.barcode==='3017620425035')});
const picked=bestLocalComparison(base,saved,['en:hazelnut-spreads'],{},rank);
assert.equal(picked.checked,1);
assert.equal(picked.improvements,1);
assert.equal(picked.items[0].barcode,'3017620425035');
assert.equal(bestLocalComparison(base,[],['en:hazelnut-spreads'],{},rank),null);
const n={k:80.85,s:8.45,sat:1.59,p:0.95,f:0.2,salt:null};
const summary=presetFacts(n,{sugars:56.3,saturatedFat:10.6,protein:6.3});
assert.match(summary,/81 kcal/);
assert.match(summary,/total sugars/);
assert.match(summary,/saturated fat/);
assert(!summary.includes('Not reported'));
assert.equal(presetFacts({k:null,s:null,p:null,sat:null},{}),'Nutrients not reported');

const liveFetch=globalThis.fetch;
let requested='';
try{
 globalThis.fetch=async function(input){
  const url=new URL(String(input));
  if(url.hostname==='world.openfoodfacts.org')return new Response(JSON.stringify({error:'provider down'}),{status:502,headers:{'content-type':'application/json'}});
  if(url.hostname==='search.openfoodfacts.org'){
   requested=url.searchParams.get('q')||'';
   return new Response(JSON.stringify({hits:[{code:'3017620425035',product_name:'Hazelnut spread',brands:['Example'],categories_tags:['en:hazelnut-spreads'],countries_tags:['en:france'],nutriments:{sugars_100g:20},nutrition_grades:'c',nova_group:3}]}),{status:200,headers:{'content-type':'application/json'}});
  }
  throw Error('Unexpected upstream: '+url.hostname);
 };
 const response=await worker.fetch(new Request('https://foodscan.test/api/alternatives?category=en%3Ahazelnut-spreads&country=france&detail=full'),{},{});
 const result=await response.json();
 assert.equal(response.status,200,JSON.stringify(result));
 assert.match(requested,/categories_tags:"en:hazelnut-spreads"/);
 assert.match(requested,/countries_tags:"en:france"/);
 assert.equal(result.products[0].categories_tags[0],'en:hazelnut-spreads');
 assert.equal(result.products[0].countries_tags[0],'en:france');
 assert.equal(result.products[0].partial,true);
 const health=await worker.fetch(new Request('https://foodscan.test/api/health'),{},{});
 assert.equal((await health.json()).version,'11.15.0');
}finally{globalThis.fetch=liveFetch;}
console.log('FoodScan comparison and portion regression checks passed.');
