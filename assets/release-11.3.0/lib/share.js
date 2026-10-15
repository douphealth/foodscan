/** Share card: a result summary drawn on a canvas, entirely on the device.
 * No product photo is drawn (cross-origin images would taint the canvas) and nothing is uploaded.
 */
import {quickRead,GRADE_STYLE,NOVA_INFO} from './nutrition.js';

const W=1080,H=1350;
const FONT='system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
const TONE={red:'#ff8a78',amber:'#ffd27a',green:'#9fe0a6',info:'#cfe3d6'};

function wrap(ctx,text,maxWidth,maxLines){
 const words=String(text).split(/\s+/),lines=[];
 let line='';
 for(const word of words){
  const test=line?`${line} ${word}`:word;
  if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=word;}else line=test;
 }
 if(line)lines.push(line);
 if(lines.length>maxLines){
  lines.length=maxLines;
  let last=lines[maxLines-1];
  while(last&&ctx.measureText(`${last}…`).width>maxWidth)last=last.slice(0,-1);
  lines[maxLines-1]=`${last}…`;
 }
 return lines;
}
function roundRect(ctx,x,y,w,h,r){
 ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
}
export function drawShareCard(canvas,product,host){
 canvas.width=W;canvas.height=H;
 const ctx=canvas.getContext('2d');
 const bg=ctx.createLinearGradient(0,0,W,H);bg.addColorStop(0,'#1d4a38');bg.addColorStop(1,'#0e2a1f');
 ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
 ctx.fillStyle='rgba(212,236,170,.07)';ctx.beginPath();ctx.arc(W-120,160,360,0,Math.PI*2);ctx.fill();
 ctx.beginPath();ctx.arc(80,H-60,300,0,Math.PI*2);ctx.fill();
 // brand
 ctx.fillStyle='#d5e9ae';roundRect(ctx,72,72,64,64,20);ctx.fill();
 ctx.fillStyle='#173f30';ctx.font=`800 40px ${FONT}`;ctx.textBaseline='middle';ctx.fillText('F',92,106);
 ctx.fillStyle='#f4faea';ctx.font=`750 44px ${FONT}`;ctx.fillText('FoodScan',156,106);
 // product
 ctx.textBaseline='alphabetic';
 ctx.fillStyle='#bcd4c0';ctx.font=`700 28px ${FONT}`;
 ctx.fillText(String(product.brand||'').toUpperCase().slice(0,34),72,230);
 ctx.fillStyle='#ffffff';ctx.font=`760 68px ${FONT}`;
 const nameLines=wrap(ctx,product.name,W-144,3);
 nameLines.forEach((line,idx)=>ctx.fillText(line,72,306+idx*80));
 let y=306+nameLines.length*80+30;
 // Nutri-Score strip
 if(product.nutriScore){
  const letters='ABCDE';let x=72;
  letters.split('').forEach(letter=>{
   const on=letter===product.nutriScore,size=on?150:92,top=y+(150-size)/2,st=GRADE_STYLE[letter];
   ctx.globalAlpha=on?1:.55;ctx.fillStyle=st.bg;roundRect(ctx,x,top,size,size,on?34:24);ctx.fill();ctx.globalAlpha=1;
   ctx.fillStyle=st.fg;ctx.font=`800 ${on?84:46}px ${FONT}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(letter,x+size/2,top+size/2+3);
   ctx.textAlign='left';x+=size+14;
  });
  ctx.textBaseline='alphabetic';
  ctx.fillStyle='#cfe3d6';ctx.font=`600 26px ${FONT}`;ctx.fillText(`Nutri-Score ${product.nutriScore}${product.nova?`  ·  NOVA ${product.nova} (${NOVA_INFO[product.nova].short})`:''}`,72,y+150+48);
  y+=150+96;
 }else if(product.nova){
  ctx.fillStyle='#cfe3d6';ctx.font=`600 30px ${FONT}`;ctx.fillText(`NOVA ${product.nova}: ${NOVA_INFO[product.nova].title}`,72,y+20);y+=70;
 }
 // sugar, made tangible: one cube is one 4 g teaspoon
 const sugar=product.nutrition?.sugars;
 if(sugar>=4&&product.basis){
  const cubes=Math.round(sugar/4),shown=Math.min(cubes,24),size=34,gap=9;
  ctx.fillStyle='#cfe3d6';ctx.font=`600 26px ${FONT}`;ctx.fillText(`Sugar in 100 ${product.basis}: about ${cubes} cube${cubes===1?'':'s'}`,72,y+8);
  for(let n=0;n<shown;n++){
   const x=72+(n%12)*(size+gap),top=y+28+Math.floor(n/12)*(size+gap);
   ctx.fillStyle='#fffdf6';roundRect(ctx,x,top,size,size,9);ctx.fill();
   ctx.fillStyle='#e2dac6';ctx.fillRect(x+size-8,top+9,8,size-18);ctx.fillRect(x+9,top+size-8,size-18,8);
  }
  if(cubes>shown){ctx.fillStyle='#d5e9ae';ctx.font=`750 28px ${FONT}`;ctx.fillText(`+${cubes-shown}`,72+12*(size+gap)-6,y+28+(size+gap)+size-6);}
  y+=28+Math.ceil(shown/12)*(size+gap)+28;
 }
 // facts
 const facts=quickRead(product).filter(x=>['red','amber','green'].includes(x.tone)).slice(0,sugar>=4&&product.basis?3:4);
 facts.forEach((f,idx)=>{
  const top=y+idx*118;
  ctx.fillStyle='rgba(255,255,255,.08)';roundRect(ctx,72,top,W-144,98,26);ctx.fill();
  ctx.fillStyle=TONE[f.tone]||TONE.info;ctx.beginPath();ctx.arc(116,top+49,13,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#ffffff';ctx.font=`720 34px ${FONT}`;
  const title=wrap(ctx,f.title,W-144-110,1)[0];ctx.fillText(title,152,top+46);
  ctx.fillStyle='#bcd4c0';ctx.font=`500 25px ${FONT}`;
  ctx.fillText(wrap(ctx,f.detail||'',W-144-110,1)[0]||'',152,top+78);
 });
 // footer
 ctx.fillStyle='#d5e9ae';ctx.font=`750 36px ${FONT}`;ctx.fillText('Scan any food. Get the real story.',72,H-118);
 ctx.fillStyle='#9fbfaa';ctx.font=`500 28px ${FONT}`;ctx.fillText(`${host}  ·  Facts from Open Food Facts. Check the pack.`,72,H-70);
 return canvas;
}
export function shareCardBlob(product,host=location.host){
 const canvas=document.createElement('canvas');
 drawShareCard(canvas,product,host);
 return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Could not draw the share card.')),'image/png'));
}
