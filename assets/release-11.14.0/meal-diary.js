/** FoodScan 11.14: semantic layout improvements without changing diary calculations or event hooks. */
export * from '/assets/release-11.12.0/meal-diary.js';
import {productDiaryPanel as prior} from '/assets/release-11.12.0/meal-diary.js';
function el(tag,klass,text){
 const node=document.createElement(tag);
 if(klass)node.className=klass;
 if(text!==undefined)node.textContent=text;
 return node;
}
export function productDiaryPanel(p){
 const template=document.createElement('template');template.innerHTML=prior(p);
 const section=template.content.querySelector('.fs12-portion');
 if(!section)return template.innerHTML;
 section.classList.add('fs15-portion');
 const intro=section.querySelector('.fs11-portion-intro');
 if(intro){
  intro.classList.add('fs15-portion-header');
  const label=intro.querySelector('.fs11-tag');
  if(label)label.textContent='YOUR PORTION • LIVE NUTRITION';
  const desc=intro.querySelector('p');
  if(desc)desc.textContent='Choose how much you ate. Every reported nutrient recalculates instantly—nothing is guessed.';
 }
 const control=section.querySelector('.fs12-portion-control');
 const output=section.querySelector('.fs12-portion-output');
 if(control){
  control.classList.add('fs15-portion-input');
  control.prepend(el('span','fs15-step-label','01  /  CHOOSE YOUR AMOUNT'));
  const help=control.querySelector('#fs11-serving-help');
  const presets=control.querySelector('.fs12-presets');
  const range=control.querySelector('#md-amount-slider');
  if(range){
   const ends=el('div','fs15-range-ends');
   ends.append(el('span','', '1 '+p.basis),el('span','','500 '+p.basis));
   range.after(ends);
  }
  if(presets){
   const label=el('div','fs15-preset-heading','QUICK AMOUNTS');
   presets.before(label);
   if(help)presets.after(help);
  }
 }
 if(output){
  output.classList.add('fs15-portion-results');
  const title=output.querySelector('.fs11-portion-results-head >span');
  if(title)title.textContent='02  /  NUTRITION FOR THIS AMOUNT';
  const nutrients=output.querySelector('.fs12-macro-grid'),sugar=output.querySelector('.fs12-sugar-focus');
  if(nutrients&&sugar)nutrients.after(sugar);
  if(nutrients)nutrients.setAttribute('aria-label','Calculated nutritional amounts for the selected quantity');
  const sat=nutrients?.querySelector('.fs12-macro-sat');
  if(sat)sat.title='Calculated saturated fat for the entered amount';
  if(sugar){
   const title=sugar.querySelector('span');
   if(title)title.textContent='Total sugars — teaspoon equivalent';
  }
 }
 const footer=section.querySelector('.fs12-portion-submit');
 if(footer)footer.classList.add('fs15-portion-footer');
 return template.innerHTML;
}
