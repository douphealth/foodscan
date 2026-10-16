/** FoodScan 11.14.1: restore the circular macro presentation and its accurate explanation. */
export * from '/assets/release-11.14.0/result.js';
import {resultSummary as previous} from '/assets/release-11.14.0/result.js';
export function resultSummary(product,state){
 const template=document.createElement('template');
 template.innerHTML=previous(product,state);
 const note=template.content.querySelector('.v19-ring-note');
 if(note)note.textContent='Reported grams. Circular outlines are decorative, not percentages of a daily target.';
 return template.innerHTML;
}
