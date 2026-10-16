/** FoodScan 11.14: premium, evidence-led alternative cards; original action handlers untouched. */
export * from '/assets/release-11.13.0/views.js';
import {productView as priorProduct,swapsSection as priorSwaps} from '/assets/release-11.13.0/views.js';
function el(tag,klass,text){
 const node=document.createElement(tag);
 if(klass)node.className=klass;
 if(text!==undefined)node.textContent=text;
 return node;
}
function transformSwaps(html){
 const template=document.createElement('template');template.innerHTML=html;
 const list=template.content.querySelector('.swap7-list');
 if(!list)return template.innerHTML;
 list.classList.add('fs15-alternatives-grid');
 const meta=template.content.querySelector('.sec-sub');
 if(meta){
  const row=el('div','fs15-comparison-context');
  row.append(el('span','fs15-eyebrow','WHY THESE FOODS APPEAR'),el('p','',meta.textContent.trim()));
  meta.replaceWith(row);
 }
 const cards=[...list.querySelectorAll('.d8-swap')];
 for(const [index,card] of cards.entries()){
  card.classList.add('fs15-alternative-card');
  const top=card.querySelector('.d8-swap-top');
  if(top){
   top.before(el('div','fs15-alternative-number','OPTION '+String(index+1).padStart(2,'0')+' · SAME RECORDED CATEGORY'));
   const hint=top.querySelector('.d8-swap-label');
   if(hint)hint.textContent='Measured nutrition difference';
  }
  const deltas=card.querySelector('.d8-deltas');
  if(deltas){
   deltas.classList.add('fs15-difference-grid');
   for(const span of deltas.querySelectorAll(':scope > span')){
    const text=span.textContent.trim();
    const m=text.match(/^([+\-−]\s*[\d.,]+\s*g)\s+(.+?)\s+per\s+100\s+(g|ml)(?:\s*\(([+\-−]?\s*[\d.,]+%)\))?$/i);
    if(!m)continue;
    span.classList.add('fs15-difference');
    span.replaceChildren(
     el('strong','fs15-difference-value',m[1].replace(/\s+/g,' ').trim()),
     el('small','fs15-difference-label',m[2]+' / 100 '+m[3])
    );
    if(m[4])span.append(el('b','fs15-difference-percent',m[4]));
   }
  }
  const actions=card.querySelector('.d8-swap-actions');
  if(actions){
   const button=actions.querySelector('button[data-action="decision-swap"]');
   if(button)button.textContent=button.textContent.includes('Swap on')?'Replace on my list':'Add to my list';
   const details=actions.querySelector('a[href^="#food/"]');
   if(details&&details.textContent.includes('Details'))details.textContent='View report ↗';
  }
 }
 const note=template.content.querySelector('.affiliate-box');
 if(note)note.classList.add('fs15-comparison-disclosure');
 return template.innerHTML;
}
export function swapsSection(state){
 const html=priorSwaps(state);
 return transformSwaps(html);
}
export function productView(state){
 const template=document.createElement('template');template.innerHTML=priorProduct(state);
 const page=template.content.querySelector('.fs-product-page');
 if(!page)return template.innerHTML;
 page.classList.add('fs15-report-page');
 const swaps=page.querySelector('.fs-swaps-priority');
 if(swaps){
  swaps.classList.add('fs15-alternatives');
  const heading=swaps.querySelector('.d8-subhead h2');
  if(heading)heading.textContent='Alternatives worth considering';
  const label=swaps.querySelector('.fs-mini-kicker');
  if(label)label.textContent='BETTER MATCHES · VERIFIED DIFFERENCES';
  const deck=el('p','fs15-alternatives-deck','Compared on reported nutrients per 100 g or ml. Not a health score or guarantee of suitability.');
  const head=swaps.querySelector('.d8-subhead');
  if(head)head.after(deck);
  const slot=swaps.querySelector('#swaps-slot');
  if(slot&&state.swaps?.code===state.active?.barcode)slot.innerHTML=swapsSection(state);
 }
 return template.innerHTML;
}
