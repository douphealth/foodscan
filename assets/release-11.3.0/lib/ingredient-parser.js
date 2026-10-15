/** Ingredient label tokenizer. Preserves source ordering, original text and decimal commas.
 * Classification is an optional reading aid, NEVER an allergen clearance or amount estimate.
 */
const GLOSSARY = [
  {re:/\b(sucre|sugar|syrup|sirop|glucose|fructose|dextrose|maltodextrin)\b/i,tag:'Sugar ingredient',tone:'sugar',en:'Sugar / sweetener'},
  {re:/huile\s+de\s+palme|\bpalm\s+oil\b|\bpalmolein\b/i,tag:'Palm oil',tone:'oil',en:'Palm oil'},
  {re:/noisettes?|hazelnuts?/i,tag:'Tree nut mentioned',tone:'allergen',en:'Hazelnuts'},
  {re:/cacao\s+maigre|fat[- ]reduced\s+cocoa/i,tag:'Cocoa',tone:'neutral',en:'Fat-reduced cocoa'},
  {re:/lait\s+[eé]cr[eé]m[eé]\s+en\s+poudre|skimmed\s+milk\s+powder/i,tag:'Milk mentioned',tone:'allergen',en:'Skimmed milk powder'},
  {re:/lactos[eé]rum|\bwhey\b/i,tag:'Milk derivative',tone:'allergen',en:'Whey'},
  {re:/l[eé]cithines?|lecithins?|[eé]mulsifiants?|emulsifiers?/i,tag:'Emulsifier term',tone:'additive',en:'Emulsifier / lecithins'},
  {re:/\bvanilline\b|\bvanillin\b/i,tag:'Flavoring',tone:'neutral',en:'Vanillin'},
  {re:/\b(e\s?\d{3,4}[a-z]?|preservatives?|stabilisers?|stabilizers?|sweeteners?|colorants?|colourings?|flavourings?|flavorings?)\b/i,tag:'Additive-related term',tone:'additive',en:null}
];

/** Do not split the comma in an EU percentage such as 7,4%. Nested lists stay intact. */
export function splitIngredientTokens(text){
  if(typeof text!=='string'||!text.trim())return [];
  const tokens=[];let current='',depth=0;
  for(let n=0;n<text.length;n++){
    const ch=text[n];
    if('([{'.includes(ch))depth++;
    else if(')]}'.includes(ch))depth=Math.max(0,depth-1);
    const decimal=ch===','&&/\d/.test(text[n-1]||'')&&/\d/.test(text[n+1]||'');
    if(depth===0&&(ch===','||ch===';')&&!decimal){
      if(current.trim())tokens.push(current.trim());
      current='';
    }else current+=ch;
  }
  if(current.trim())tokens.push(current.trim());
  return tokens;
}

export function parseIngredientsAccurately(rawText=''){
  if(typeof rawText!=='string'||!rawText.trim())return {items:[],footnote:null,rawText:''};
  const raw=rawText.trim();
  let cleaned=raw.replace(/^\s*(?:ingredients|ingr[eé]dients)\s*:\s*/i,'');
  let footnote=null;
  const match=cleaned.match(/\.\s*((?:sans\s+gluten|gluten[- ]free|peut\s+contenir|may\s+contain)[^.]*\.?\s*)$/i);
  if(match){footnote=match[1].trim();cleaned=cleaned.slice(0,match.index).trim();}
  const items=splitIngredientTokens(cleaned).map((rawToken,index)=>{
    const token=rawToken.replace(/\.$/,'').trim();
    const pct=token.match(/(\d+(?:[.,]\d+)?)\s*%/);
    const num=pct?Number(pct[1].replace(',','.')):null;
    const percentage=Number.isFinite(num)&&num>=0&&num<=100?num:null;
    const rule=GLOSSARY.find(r=>r.re.test(token));
    return {rank:index+1,raw:token,name:token.replace(/\s*\(?\s*\d+(?:[.,]\d+)?\s*%\s*\)?/,'').trim()||token,
      percentage,tag:rule?.tag||'Ingredient',tone:rule?.tone||'neutral',englishHint:rule?.en||null};
  });
  return {items,footnote,rawText:raw};
}
