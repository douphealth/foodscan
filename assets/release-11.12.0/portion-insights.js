/** Product-specific, source-data-only explanations for quick quantity buttons. */
export function presetFacts(values,per100={}){
 if(!values)return 'Nutrition unavailable';
 const pretty=n=>{const value=Number(n);if(!Number.isFinite(value))return null;return value>0&&value<0.1?'<0.1':new Intl.NumberFormat('en',{maximumFractionDigits:1}).format(value);};
 const seen=[];
 if(values.k!=null)seen.push(Math.round(values.k)+' kcal');
 const choices=[
  {key:'s',field:'sugars',label:'g total sugars',limit:5},
  {key:'sat',field:'saturatedFat',label:'g saturated fat',limit:1.5},
  {key:'salt',field:'salt',label:'g salt',limit:0.3},
  {key:'p',field:'protein',label:'g protein',limit:5},
  {key:'f',field:'fiber',label:'g fiber',limit:3},
  {key:'fat',field:'fat',label:'g fat',limit:10},
  {key:'carbs',field:'carbohydrates',label:'g carbohydrates',limit:15}
 ];
 const ranked=choices.filter(x=>values[x.key]!=null).map(x=>({...x,priority:Number(per100?.[x.field]||0)>=x.limit?1:0})).sort((a,b)=>b.priority-a.priority);
 for(const metric of ranked.slice(0,values.k!=null?2:3))seen.push(pretty(values[metric.key])+' '+metric.label);
 return seen.length?seen.join(' · '):'Nutrients not reported';
}
