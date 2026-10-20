import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {betterChoices,matchFoodType} from '../assets/release-11.21.0/recommendation-quality.js';
import {allergenEvidence} from '../assets/release-11.21.0/allergen-evidence.js';
const make=(barcode,name,grade,categories,nutrition={})=>({
 barcode,name,brand:'SourceBrand',nutriScore:grade,categories:categories.map(k=>'en:'+k),
 basis:'g',provenance:'off',nutrition:{kcal:540,sugars:55,saturatedFat:11,fat:31,carbohydrates:57,protein:6,...nutrition},
 ingredients:'',allergens:[],traces:[],qualityWarnings:[],partial:false
});
const base=make('3017620422003','Chocolate hazelnut spread','E',['sweet-spreads','hazelnut-spreads']);
const peanuts=make('3017620422004','Peanut butter','A',['sweet-spreads','peanut-butters'],{sugars:5,saturatedFat:6});
const hazelnut=make('3017620422005','Hazelnut spread alternative','B',['sweet-spreads','hazelnut-spreads'],{sugars:22,saturatedFat:6});
const equal=make('3017620422006','Another hazelnut spread','E',['hazelnut-spreads'],{sugars:21,saturatedFat:6});
assert.equal(matchFoodType(base,peanuts).compatible,false,'Never market peanut butter as a direct hazelnut spread');
assert.equal(matchFoodType(base,hazelnut).compatible,true);
const result=betterChoices(base,[peanuts,hazelnut,equal],{},'en:sweet-spreads');
assert.deepEqual(result.items.map(x=>x.product.barcode),[hazelnut.barcode], 'Only higher grade with matching food type');
assert.equal(result.items[0].verification,'source-record');
assert.equal(betterChoices({...base,nutriScore:'A'},[hazelnut],{},'en:sweet-spreads').items.length,0,'No grade above A');
const e=allergenEvidence({...base,ingredients:'milk powder, hazelnuts',allergens:['tree nuts'],traces:['soy']});
assert(e.unresolved.includes('milk'),'Ingredients must be checked when tag excludes milk');
assert(e.mayContain.includes('soy'),'Trace warning must remain distinct');
const html=await fs.readFile('index.html','utf8'),headers=await fs.readFile('_headers','utf8');
const map=html.match(/<script type="importmap">([\s\S]*?)<\/script>/)?.[1];assert(map);
const hash='sha256-'+crypto.createHash('sha256').update(map).digest('base64');
assert(headers.includes(hash),'CSP import map hash must match');
for(const target of Object.values(JSON.parse(map).imports))await fs.stat('.'+target);
for(const name of ['app.css','views.js','recommendation-quality.js','allergen-evidence.js'])await fs.stat('assets/release-11.21.0/'+name);
assert((await fs.readFile('sw.js','utf8')).includes("foodscan-shell-11.21.0"));
assert(html.includes('release-11.21.0/app.css'));
console.log('PASS FoodScan 11.21 release integrity, category equivalence, grade improvement, allergen evidence');
