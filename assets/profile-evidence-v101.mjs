/** Conservative reconciliation: absent allergen tags cannot override clear category evidence. */
export function reconcileProfileEvidence(product,profile,result,translate=x=>x){
 const avoids=new Set(profile?.avoids||[]),restricted=avoids.size>0||profile?.diet&&profile.diet!=='none';
 if(!restricted)return result;
 const conflicts=[...(result?.conflicts||[])],notes=[...(result?.notes||[])],tags=new Set(product?.categories||[]);
 const dairy=['en:dairies','en:milks','en:cheeses','en:yogurts','en:kefir','en:fermented-milk-products'].some(t=>tags.has(t));
 const plant=['en:plant-based-milk-alternatives','en:plant-based-yogurts','en:dairy-free-cheeses'].some(t=>tags.has(t));
 if(dairy&&!plant&&(avoids.has('milk')||profile?.diet==='vegan')&&!conflicts.some(c=>c.key==='milk'))conflicts.push({kind:avoids.has('milk')?'allergen':'diet',key:'milk',via:'category',text:translate('The source category indicates dairy. Milk avoidance cannot be confirmed, even when allergen tags are missing.')});
 const ingredients=String(product?.ingredients||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const hasList=/(?:ingredients|ingredient|\u03c3\u03c5\u03c3\u03c4\u03b1\u03c4\u03b9\u03ba)/.test(ingredients);
 const panel=!hasList&&/kcal|kj|\u03b4\u03b9\u03b1\u03c4\u03c1\u03bf\u03c6\u03b9\u03ba/.test(ingredients)&&/protein|carbohyd|energy|\u03c0\u03c1\u03c9\u03c4\u03b5\u03b9\u03bd|\u03bb\u03b9\u03c0\u03b1\u03c1|\u03b5\u03bd\u03b5\u03c1\u03b3/.test(ingredients);
 const unsupported=/[\u0400-\u04ff\u0600-\u06ff\u4e00-\u9fff]/.test(ingredients);
 if(panel)notes.push(translate('The ingredient field appears to contain nutrition values, not an ingredient list. Your restrictions cannot be confirmed.'));
 else if(unsupported&&!conflicts.length)notes.push(translate('The ingredient text cannot be fully checked in its recorded language. Check the package before choosing this food.'));
 return {...result,status:conflicts.length?'conflict':notes.length?'unconfirmed':result.status,conflicts,notes};
}
