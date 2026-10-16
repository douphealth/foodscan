export * from '/assets/release-11.10.0/result.js';
import {resultSummary as previous} from '/assets/release-11.10.0/result.js';
import {trafficLights} from '/assets/release-11.3.0/lib/nutrition.js';
const NS={A:['More favourable nutritional profile','nutri-a'],B:['Relatively favourable nutritional profile','nutri-b'],C:['Middle of the nutritional scale','nutri-c'],D:['Less favourable nutritional profile','nutri-d'],E:['Least favourable on this scale','nutri-e']};
const NOVA={1:'Unprocessed or minimally processed',2:'Processed culinary ingredient',3:'Processed food',4:'Ultra-processed food'};
function el(tag,cls,content){
 const node=document.createElement(tag);if(cls)node.className=cls;if(content!=null)node.textContent=content;return node;
}
function classification(p){
 const wrapper=el('section','fs14-classifications');
 wrapper.setAttribute('aria-label','Source-reported food classifications');
 const head=el('div','fs14-heading');
 head.append(el('span','fs14-eyebrow','FOOD PROFILE'),el('h3','','Understand the labels at a glance'));
 const intro=el('p','fs14-intro','Two different measures: nutrient profile and food processing.');
 head.append(intro);wrapper.append(head);
 const grade=NS[p.nutriScore]?p.nutriScore:null,nova=NOVA[p.nova]?p.nova:null;
 const panel=el('div','fs14-profile-stack');
 const nutrition=el('div','fs14-profile-tile fs14-nutri '+(grade?NS[grade][1]:'fs14-unknown'));
 nutrition.append(el('span','fs14-tile-label','NUTRI-SCORE'));
 const nr=el('div','fs14-tile-main');
 const mark=el('strong','fs14-mark',grade||'—');mark.setAttribute('aria-label',grade?'Nutri-Score '+grade:'Nutri-Score not reported');
 const explanation=el('div','fs14-tile-reading');explanation.append(el('strong','',grade?NS[grade][0]:'Not reported'),el('small','','A to E · nutrient-based classification'));
 nr.append(mark,explanation);nutrition.append(nr);
 const scale=el('div','fs14-grade-scale');
 for(const letter of 'ABCDE'){const cell=el('span','fs14-grade-step fs14-g-'+letter.toLowerCase()+(grade===letter?' is-active':''),letter);cell.setAttribute('aria-hidden','true');scale.append(cell);}
 nutrition.append(scale);
 const processing=el('div','fs14-profile-tile fs14-processing'+(nova===4?' is-ultra':''));
 processing.append(el('span','fs14-tile-label','NOVA PROCESSING GROUP'));
 const pr=el('div','fs14-tile-main');
 const markNova=el('strong','fs14-mark fs14-nova-mark',nova?String(nova):'—');markNova.setAttribute('aria-label',nova?'NOVA group '+nova:'NOVA group not reported');
 const nread=el('div','fs14-tile-reading');nread.append(el('strong','',nova?NOVA[nova]:'Not reported'),el('small','','1 to 4 · degree of processing'));
 pr.append(markNova,nread);processing.append(pr);
 const ns=el('div','fs14-nova-scale');
 for(let i=1;i<=4;i++){const seg=el('span','fs14-nova-step'+(nova===i?' is-active':''),String(i));seg.setAttribute('aria-hidden','true');ns.append(seg);}processing.append(ns);
 panel.append(nutrition,processing);wrapper.append(panel);
 const high=p.basis?trafficLights(p).items.filter(x=>x.level==='high').slice(0,3):[];
 if(high.length){
  const pills=el('div','fs14-evidence');pills.append(el('span','fs14-evidence-label','SOURCE NUTRIENTS / 100 '+p.basis));
  for(const fact of high){pills.append(el('span','fs14-evidence-pill','High '+String(fact.label||'').toLowerCase()));}
  wrapper.append(pills);
 }
 const note=el('p','fs14-classification-note','These are source-reported classifications, not food-safety ratings. Check the current packaging, especially for allergens.');
 wrapper.append(note);return wrapper;
}
export function resultSummary(p,s){
 const t=document.createElement('template');t.innerHTML=previous(p,s);
 const image=t.content.querySelector('.v18-product-image'),old=image?.querySelector('.v18-published');
 if(!image||!old)return t.innerHTML;
 old.remove();
 for(const paragraph of image.querySelectorAll(':scope > p'))paragraph.remove();
 image.append(classification(p));
 return t.innerHTML;
}
