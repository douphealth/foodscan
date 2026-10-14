/** Local EAN decoder. No network, camera images, or photo uploads leave the device.
 * Fallback scope: reasonably horizontal EAN-13, EAN-8 and UPC-A (via leading-zero EAN-13).
 * Native BarcodeDetector is preferred by scanner.js when the browser supports it.
 */
import { validBarcode } from './model.js';
const L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
const G = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
const PARITY = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];
const invert = bits => bits.replace(/[01]/g,x=>x==='0'?'1':'0');
function widths(bits) {const out=[];let last=bits[0],n=0;for(const bit of bits){if(bit===last)n++;else{out.push(n);last=bit;n=1;}}out.push(n);return out;}
const LWIDTHS=L.map(widths), GWIDTHS=G.map(widths);
export function encodeEAN(code) {
  if(!validBarcode(code)) throw new Error('Invalid barcode');
  if(code.length===12)code='0'+code;
  if(code.length===8)return '101'+[...code.slice(0,4)].map(d=>L[+d]).join('')+'01010'+[...code.slice(4)].map(d=>invert(L[+d])).join('')+'101';
  if(code.length!==13)throw new Error('The illustration encoder supports EAN-8, EAN-13 and UPC-A.');
  return '101'+[...code.slice(1,7)].map((d,i)=>(PARITY[+code[0]][i]==='L'?L:G)[+d]).join('')+'01010'+[...code.slice(7)].map(d=>invert(L[+d])).join('')+'101';
}
export function barcodeSVG(code='3017624010701') {
  const bits=encodeEAN(code), pad=12;
  return `<svg viewBox="0 0 ${bits.length+pad*2} 52" role="img" aria-label="Barcode ${code}"><rect width="100%" height="100%" fill="white"/>${[...bits].map((b,i)=>b==='1'?`<rect x="${i+pad}" y="4" width="1" height="40" fill="#142b22"/>`:'').join('')}</svg>`;
}
function matchDigit(runs, at, allowG=false) {
  const slice=runs.slice(at,at+4);
  if(slice.length!==4)return null;
  const module=slice.reduce((a,b)=>a+b,0)/7;
  if(module<.65)return null;
  let best=null;
  for(const parity of allowG?['L','G']:['L']){
    const table=parity==='L'?LWIDTHS:GWIDTHS;
    for(let digit=0;digit<10;digit++){
      const errors=slice.map((v,i)=>Math.abs(v/module-table[digit][i]));
      const error=errors.reduce((a,b)=>a+b,0)/4;
      if(error<.38&&Math.max(...errors)<.8&&(!best||error<best.error))best={digit,parity,error,module};
    }
  }
  return best;
}
function guard(runs,at,count,module) {return runs.slice(at,at+count).length===count&&runs.slice(at,at+count).every(v=>v/module>.45&&v/module<1.8);}
function readAt(runs,start,digits) {
  const count=digits===13?6:4, required=3+count*4+5+count*4+3;
  if(start+required>runs.length)return null;
  const module=(runs[start]+runs[start+1]+runs[start+2])/3;
  if(module<.65||!guard(runs,start,3,module))return null;
  let at=start+3,left='',right='',parity='',errors=0;
  for(let i=0;i<count;i++,at+=4){const d=matchDigit(runs,at,digits===13);if(!d||d.module/module<.6||d.module/module>1.6)return null;left+=d.digit;parity+=d.parity;errors+=d.error;}
  if(!guard(runs,at,5,module))return null;at+=5;
  for(let i=0;i<count;i++,at+=4){const d=matchDigit(runs,at);if(!d||d.module/module<.6||d.module/module>1.6)return null;right+=d.digit;errors+=d.error;}
  if(!guard(runs,at,3,module)||errors/(2*count)>.28)return null;
  const first=digits===13?PARITY.indexOf(parity):'';
  if(first===-1)return null;
  const code=String(first)+left+right;
  return validBarcode(code)?code:null;
}
export function decodeBinaryRow(row) {
  // Ignore a leading white margin, but preserve the color of every later run.
  let start=0;while(start<row.length&&!row[start])start++;
  if(start>=row.length)return null;
  const runs=[];let color=1,length=0;
  for(let i=start;i<row.length;i++){if(row[i]===color)length++;else{runs.push(length);length=1;color=row[i];}}
  runs.push(length);
  for(let at=0;at<runs.length-42;at+=2){const code=readAt(runs,at,13)||readAt(runs,at,8);if(code)return code;}
  return null;
}
export function decodeImageData({data,width,height}) {
  if(!data||width<80||height<8)return null;
  const confirmations=new Map();
  for(const fraction of [.5,.4,.6,.3,.7,.2,.8,.1,.9]){
    const y=Math.min(height-1,Math.max(0,Math.round(height*fraction))), gray=new Uint8Array(width);
    let min=255,max=0;
    for(let x=0;x<width;x++){const p=(y*width+x)*4;const g=(data[p]*77+data[p+1]*150+data[p+2]*29)>>8;gray[x]=g;if(g<min)min=g;if(g>max)max=g;}
    if(max-min<35)continue;
    let lineCode=null;
    for(const threshold of [.45,.6,.3]){
      const cutoff=min+(max-min)*threshold,row=new Uint8Array(width);
      for(let x=0;x<width;x++)row[x]=gray[x]<cutoff?1:0;
      lineCode=decodeBinaryRow(row)||decodeBinaryRow(row.reverse());
      if(lineCode)break;
    }
    if(lineCode){const n=(confirmations.get(lineCode)||0)+1;if(n>=2)return lineCode;confirmations.set(lineCode,n);}
  }
  return null;
}
export function expandUPCE(code) {
  if(!/^[01]\d{7}$/.test(code))return null;
  const [ns,a,b,c,d,e,f,check]=code;
  const expanded=+f<=2?ns+a+b+f+'0000'+c+d+e+check:f==='3'?ns+a+b+c+'00000'+d+e+check:f==='4'?ns+a+b+c+d+'00000'+e+check:ns+a+b+c+d+e+'0000'+f+check;
  return validBarcode(expanded)?expanded:null;
}
