/** FoodScan 11.19: disclose sourced cached alternatives, retain the classic report look. */
export * from '/assets/release-11.16.0/views.js';
import {swapsSection as previous} from '/assets/release-11.16.0/views.js';
export function swapsSection(state){
 const html=previous(state),sw=state?.swaps;
 if(sw?.mode!=='catalog'||sw?.status!=='done')return html;
 const template=document.createElement('template');template.innerHTML=html;
 const note=document.createElement('div');note.className='fs19-catalog-note';note.setAttribute('role','note');
 const strong=document.createElement('strong');strong.textContent='Source-backed comparisons recovered';
 const p=document.createElement('p');
 p.textContent='The live provider is unreachable. These Open Food Facts records were retrieved '+(Number.isFinite(sw.ageDays)?sw.ageDays+' days ago':'previously')+'. Values use source-reported amounts; availability and dietary suitability are not verified. '+(sw.scope||'');
 note.append(strong,p);template.content.prepend(note);
 return template.innerHTML;
}
