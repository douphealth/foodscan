/** FoodScan 11.16: accept documented source grade formats without inventing classifications. */
export * from '/assets/release-11.15.0/model.js';
import {parseProduct as previousParse,validateStoredProduct as previousValidate} from '/assets/release-11.15.0/model.js';
export const VERSION='11.16.0';
export function reportedGrade(...candidates){
 for(const raw of candidates){
  if(typeof raw!=='string')continue;
  const grade=raw.trim().toUpperCase();
  if(/^[A-E]$/.test(grade))return grade;
 }
 return null;
}
export function reportedNova(...candidates){
 for(const raw of candidates){
  if(typeof raw==='number'&&Number.isInteger(raw)&&raw>=1&&raw<=4)return raw;
  if(typeof raw==='string'&&/^[1-4]$/.test(raw.trim()))return Number(raw.trim());
 }
 return null;
}
export function parseProduct(payload,barcode,now){
 const product=previousParse(payload,barcode,now);
 if(!product)return null;
 const p=payload?.product;
 // Only explicit classification source fields are accepted; no invented grade from nutrient counts.
 product.nutriScore=reportedGrade(p?.nutriscore_grade,p?.nutrition_grades,product.nutriScore);
 product.nova=reportedNova(p?.nova_group,product.nova);
 return product;
}
export function validateStoredProduct(value){
 const product=previousValidate(value);
 if(!product)return null;
 product.nutriScore=reportedGrade(value?.nutriScore,product.nutriScore);
 product.nova=reportedNova(value?.nova,product.nova);
 return product;
}
