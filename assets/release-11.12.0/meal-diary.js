export * from '/assets/release-11.3.0/lib/meal-diary.js?engine=11.12.0';
import {productDiaryPanel as originalPanel,productAmounts} from '/assets/release-11.3.0/lib/meal-diary.js?engine=11.12.0';
import {presetFacts} from './portion-insights.js';
export function productDiaryPanel(p){
 const html=originalPanel(p);
 if(!p||p.partial||!['g','ml'].includes(p.basis))return html;
 const explain=html.replace('No reliable serving quantity provided. 100 '+p.basis+' is a calculation starting point, not a recommendation.',
   'No confirmed serving size is recorded. Select what you actually consumed. The numbers below scale reported nutrition per 100 '+p.basis+'.');
 return explain.replace(/(<button\b[^>]*\bdata-meal-set-amount="([0-9.]+)"[^>]*><strong>)([^<]*)(<\/strong><small>)[\s\S]*?(<\/small><\/button>)/g,
   (whole,open,amount,label,mid,close)=>{
     const value=Number(amount),shown=label==='Label serving'?'Label: '+value+' '+p.basis:label;
     const nutrition=presetFacts(productAmounts(p,value),p.nutrition||{});
     return open+shown+mid+'<span class="fs13-preset-facts">'+nutrition+'</span>'+close;
   });
}
