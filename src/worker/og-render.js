/* BEGIN og-render.js */
// Dependency-free, deterministic edge PNG renderer for source-backed 1200x630 social previews.
// Uses a compact bitmap display font so it runs in a Cloudflare Worker without canvas/WASM/services.
const fs54Font = {
 'A':['01110','10001','10001','11111','10001','10001','10001'],
 'B':['11110','10001','10001','11110','10001','10001','11110'],
 'C':['01111','10000','10000','10000','10000','10000','01111'],
 'D':['11110','10001','10001','10001','10001','10001','11110'],
 'E':['11111','10000','10000','11110','10000','10000','11111'],
 'F':['11111','10000','10000','11110','10000','10000','10000'],
 'G':['01111','10000','10000','10111','10001','10001','01111'],
 'H':['10001','10001','10001','11111','10001','10001','10001'],
 'I':['11111','00100','00100','00100','00100','00100','11111'],
 'J':['00111','00010','00010','00010','10010','10010','01100'],
 'K':['10001','10010','10100','11000','10100','10010','10001'],
 'L':['10000','10000','10000','10000','10000','10000','11111'],
 'M':['10001','11011','10101','10101','10001','10001','10001'],
 'N':['10001','11001','10101','10011','10001','10001','10001'],
 'O':['01110','10001','10001','10001','10001','10001','01110'],
 'P':['11110','10001','10001','11110','10000','10000','10000'],
 'Q':['01110','10001','10001','10001','10101','10010','01101'],
 'R':['11110','10001','10001','11110','10100','10010','10001'],
 'S':['01111','10000','10000','01110','00001','00001','11110'],
 'T':['11111','00100','00100','00100','00100','00100','00100'],
 'U':['10001','10001','10001','10001','10001','10001','01110'],
 'V':['10001','10001','10001','10001','10001','01010','00100'],
 'W':['10001','10001','10001','10101','10101','10101','01010'],
 'X':['10001','10001','01010','00100','01010','10001','10001'],
 'Y':['10001','10001','01010','00100','00100','00100','00100'],
 'Z':['11111','00001','00010','00100','01000','10000','11111'],
 '0':['01110','10001','10011','10101','11001','10001','01110'],
 '1':['00100','01100','00100','00100','00100','00100','01110'],
 '2':['01110','10001','00001','00110','01000','10000','11111'],
 '3':['11110','00001','00001','01110','00001','00001','11110'],
 '4':['00010','00110','01010','10010','11111','00010','00010'],
 '5':['11111','10000','10000','11110','00001','00001','11110'],
 '6':['01111','10000','10000','11110','10001','10001','01110'],
 '7':['11111','00001','00010','00100','01000','01000','01000'],
 '8':['01110','10001','10001','01110','10001','10001','01110'],
 '9':['01110','10001','10001','01111','00001','00001','11110'],
 ' ':['00000','00000','00000','00000','00000','00000','00000'],
 '.':['00000','00000','00000','00000','00000','00110','00110'],
 '-':['00000','00000','00000','11111','00000','00000','00000'],
 ':':['00000','00110','00110','00000','00110','00110','00000'],
 '/':['00001','00001','00010','00100','01000','10000','10000'],
 '?':['01110','10001','00001','00010','00100','00000','00100'],
 '+':['00000','00100','00100','11111','00100','00100','00000'],
 '&':['01100','10010','10100','01000','10101','10010','01101'],
 ',':['00000','00000','00000','00000','00110','00110','00100'],
 "'":['00100','00100','01000','00000','00000','00000','00000']
};
// The compact edge rasterizer supports Latin glyphs. Transliterate Greek rather than
// silently erasing Greek product names on social previews; page HTML keeps native text.
const fs55GreekLatin=Object.freeze({'Α':'A','Β':'V','Γ':'G','Δ':'D','Ε':'E','Ζ':'Z','Η':'I','Θ':'TH','Ι':'I','Κ':'K','Λ':'L','Μ':'M','Ν':'N','Ξ':'X','Ο':'O','Π':'P','Ρ':'R','Σ':'S','Τ':'T','Υ':'Y','Φ':'F','Χ':'CH','Ψ':'PS','Ω':'O','Ϊ':'I','Ϋ':'Y'});
function fs54TextSafe(value){
  return String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toUpperCase().split('').map(c=>fs55GreekLatin[c]||c).join('').replace(/[^A-Z0-9 .:'?&,+/-]/g,' ').replace(/\s+/g,' ').trim();
}
function fs54Painter(w,h){
  const rgba=new Uint8Array(w*h*4);
  const rect=(x,y,ww,hh,c)=>{x=Math.max(0,Math.floor(x));y=Math.max(0,Math.floor(y));const ex=Math.min(w,Math.floor(x+ww)),ey=Math.min(h,Math.floor(y+hh));for(let j=y;j<ey;j++){let k=(j*w+x)*4;for(let i=x;i<ex;i++){rgba[k++]=c[0];rgba[k++]=c[1];rgba[k++]=c[2];rgba[k++]=255;}}};
  const text=(value,x,y,scale,c,maxChars=42)=>{const txt=fs54TextSafe(value).slice(0,maxChars);for(const char of txt){for(let j=0;j<7;j++){const line=(fs54Font[char]||fs54Font['?'])[j];for(let i=0;i<5;i++)if(line[i]==='1')rect(x+i*scale,y+j*scale,scale,scale,c);}x+=6*scale;}return x;};
  return {rgba,rect,text};
}
function fs54PngChunk(type,body){
  const typeBytes=new TextEncoder().encode(type),out=new Uint8Array(12+body.length);const v=new DataView(out.buffer);
  v.setUint32(0,body.length);out.set(typeBytes,4);out.set(body,8);
  let crc=0xffffffff;for(let i=4;i<body.length+8;i++){crc^=out[i];for(let j=0;j<8;j++)crc=crc&1?0xedb88320^(crc>>>1):crc>>>1;}
  v.setUint32(body.length+8,(crc^0xffffffff)>>>0);return out;
}
async function fs54EncodePng(w,h,rgba){
  const scan=new Uint8Array(h*(w*4+1));for(let y=0;y<h;y++)scan.set(rgba.subarray(y*w*4,(y+1)*w*4),y*(w*4+1)+1);
  const input=new Blob([scan]).stream().pipeThrough(new CompressionStream('deflate'));
  const compressed=new Uint8Array(await new Response(input).arrayBuffer());
  const ihdr=new Uint8Array(13),dv=new DataView(ihdr.buffer);dv.setUint32(0,w);dv.setUint32(4,h);ihdr[8]=8;ihdr[9]=6;
  const chunks=[Uint8Array.of(137,80,78,71,13,10,26,10),fs54PngChunk('IHDR',ihdr),fs54PngChunk('IDAT',compressed),fs54PngChunk('IEND',new Uint8Array())];
  const out=new Uint8Array(chunks.reduce((a,x)=>a+x.length,0));let offset=0;for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.length;}return out;
}
async function fs54RenderOg(p,grade){
  const {rgba,rect,text}=fs54Painter(1200,630);const cream=[246,241,230],forest=[24,75,58],light=[237,248,241],muted=[83,108,96];
  const tone={A:[16,148,94],B:[117,179,74],C:[204,165,45],D:[225,130,40],E:[198,68,68]}[grade]||[97,126,118];
  rect(0,0,1200,630,cream);rect(0,0,1200,22,[30,124,93]);rect(0,515,1200,115,forest);
  rect(34,52,890,422,[255,255,255]);rect(944,52,223,422,light);rect(965,205,180,180,tone);
  text('FOODSCAN',66,80,9,forest);text('THE LABEL, EXPLAINED',67,161,4,muted,30);
  const name=fs54TextSafe(p?.name||'Food product')||'FOOD PRODUCT';const words=name.split(' ');const lines=[];let line='';
  for(const word of words){
    if((line+' '+word).trim().length>21 && line){lines.push(line);line=word;}
    else line=(line+' '+word).trim();
  }
  if(line)lines.push(line);
  if(!lines.length)lines.push('FOOD PRODUCT');
  if(lines.length>3)lines[2]=lines[2].slice(0,17)+'...';
  lines.slice(0,3).forEach((v,i)=>text(v,67,230+i*67,6,forest,22));
  text(fs54TextSafe(p?.brand||'')||'COMMUNITY SOURCE',68,443,3,muted,46);
  text(grade&&/^[A-E]$/.test(grade)?grade:'?',1000,238,23,[255,255,255],1);
  text('NUTRI',980,103,5,forest,10);text('SCORE',980,143,5,forest,10);
  const details=[['SUGAR',p?.nutrition?.sugars],['SAT FAT',p?.nutrition?.saturatedFat],['SALT',p?.nutrition?.salt]];
  details.forEach(([label,value],i)=>{const x=65+i*290;text(label,x,539,4,[204,237,218],12);text(typeof value==='number'&&Number.isFinite(value)?`${Number(value.toFixed(1))} G`:'N/A',x,578,5,[255,255,255],14);});
  text(p?.basis==='ml'?'PER 100 ML':'PER 100 G',977,442,2,muted,14);
  text('OFF DATA',977,466,2,muted,11);
  return fs54EncodePng(1200,630,rgba);
}

// Two independently reviewed product records. Visual preference challenge, never a health verdict.
async function fs55RenderBattleOg(p1,p2){
  const {rgba,rect,text}=fs54Painter(1200,630);
  const forest=[24,73,55],cream=[245,242,233],accent=[28,126,92],muted=[74,105,90],white=[255,255,255];
  rect(0,0,1200,630,cream);rect(0,0,1200,18,accent);
  text('FOODSCAN BATTLE',50,48,8,forest,24);
  text('WHICH WOULD YOU CHOOSE?',52,121,4,muted,36);
  function card(p,x){
    rect(x,192,547,315,white);rect(x,192,547,12,accent);
    const name=(fs54TextSafe(p.name||'Food product')||'FOOD PRODUCT').split(' ');let line='',rows=[];
    for(const word of name){if((line+' '+word).trim().length>16&&line){rows.push(line);line=word;}else line=(line+' '+word).trim();}
    if(line)rows.push(line);
    rows.slice(0,2).forEach((v,i)=>text(v,x+24,229+i*42,4,forest,17));
    text(p.brand||'SOURCE REPORTED',x+24,329,3,muted,28);
    const score=fscMarkupResult(p).grade,tones={A:[25,151,101],B:[109,171,73],C:[209,165,44],D:[225,127,45],E:[196,68,71]};
    rect(x+426,222,96,100,tones[score]||muted);text(score==='—'?'?':score,x+441,243,10,white,1);
    const facts=[['SUGAR',p.nutrition?.sugars],['SAT FAT',p.nutrition?.saturatedFat]];
    facts.forEach(([label,val],i)=>{const y=390+i*51;text(label,x+25,y,3,muted,10);text(typeof val==='number'&&Number.isFinite(val)?`${Number(val.toFixed(1))} G`:'UNKNOWN',x+224,y,4,forest,13);});
  }
  card(p1,42);card(p2,612);
  rect(0,527,1200,103,forest);text('PREFERENCE IS NOT A HEALTH VERDICT',46,547,4,white,44);
  text('SOURCE: OPEN FOOD FACTS | CHECK ALLERGENS & PACK',47,592,3,[196,225,211],68);
  return fs54EncodePng(1200,630,rgba);
}

/* END og-render.js */

