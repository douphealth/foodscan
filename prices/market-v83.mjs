/* FoodScan market 83: which country's prices does this shopper want, and how is a price in any currency written.
 * Only EXPLICIT signals are used here, so every page of the app asks for the same country:
 *   1. the shopper's own choice on the price card or the Prices page ("Change"), kept on this device;
 *   2. the country chosen for food choices in the app profile (the "Market" in Food comparisons).
 * Otherwise nothing is sent and FoodScan's server decides from the visitor's network country (Cloudflare), which is the same answer on the product card
 * and on the Prices page. 83.2: the browser language and the device time zone are NOT used any more: an English-language phone in Athens was shown Greek
 * prices on the card and "United States" on the Prices page. The market is only ever sent as ?market=XX with a price request. */
export const MARKET_KEY = 'foodscan:market:v83';
const TABLE = 'AD:andorra,AE:united-arab-emirates,AF:afghanistan,AG:antigua-and-barbuda,AI:anguilla,AL:albania,AM:armenia,AO:angola,AQ:antarctic,AR:argentina,AS:american-samoa,AT:austria,AU:australia,AW:aruba,AX:aland-islands,AZ:azerbaijan,BA:bosnia-and-herzegovina,BB:barbados,BD:bangladesh,BE:belgium,BF:burkina-faso,BG:bulgaria,BH:bahrain,BI:burundi,BJ:benin,BL:saint-barthelemy,BM:bermuda,BN:brunei,BO:bolivia,BQ:caribbean-netherlands,BR:brazil,BS:the-bahamas,BT:bhutan,BV:bouvet-island,BW:botswana,BY:belarus,BZ:belize,CA:canada,CC:cocos-keeling-islands,CD:democratic-republic-of-the-congo,CF:central-african-republic,CG:republic-of-the-congo,CH:switzerland,CI:cote-d-ivoire,CK:cook-islands,CL:chile,CM:cameroon,CN:china,CO:colombia,CR:costa-rica,CU:cuba,CV:cape-verde,CW:curacao,CX:christmas-island,CY:cyprus,CZ:czech-republic,DE:germany,DJ:djibouti,DK:denmark,DM:dominica,DO:dominican-republic,DZ:algeria,EC:ecuador,EE:estonia,EG:egypt,EH:western-sahara,ER:eritrea,ES:spain,ET:ethiopia,FI:finland,FJ:fiji,FK:falkland-islands,FM:federated-states-of-micronesia,FO:faroe-islands,FR:france,GA:gabon,GB:united-kingdom,GD:grenada,GE:georgia,GF:french-guiana,GG:guernsey,GH:ghana,GI:gibraltar,GL:greenland,GM:gambia,GN:guinea,GP:guadeloupe,GQ:equatorial-guinea,GR:greece,GT:guatemala,GU:guam,GW:guinea-bissau,GY:guyana,HK:hong-kong,HM:heard-island-and-mcdonald-islands,HN:honduras,HR:croatia,HT:haiti,HU:hungary,ID:indonesia,IE:ireland,IL:israel,IM:isle-of-man,IN:india,IO:british-indian-ocean-territory,IQ:iraq,IR:iran,IS:iceland,IT:italy,JE:jersey,JM:jamaica,JO:jordan,JP:japan,KE:kenya,KG:kyrgyzstan,KH:cambodia,KI:kiribati,KM:comoros,KN:saint-kitts-and-nevis,KP:north-korea,KR:south-korea,KW:kuwait,KY:cayman-islands,KZ:kazakhstan,LA:laos,LB:lebanon,LC:saint-lucia,LI:liechtenstein,LK:sri-lanka,LR:liberia,LS:lesotho,LT:lithuania,LU:luxembourg,LV:latvia,LY:libya,MA:morocco,MC:monaco,MD:moldova,ME:montenegro,MF:saint-martin,MG:madagascar,MH:marshall-islands,MK:north-macedonia,ML:mali,MM:myanmar,MN:mongolia,MO:macau,MP:northern-mariana-islands,MQ:martinique,MR:mauritania,MS:montserrat,MT:malta,MU:mauritius,MV:maldives,MW:malawi,MX:mexico,MY:malaysia,MZ:mozambique,NA:namibia,NC:new-caledonia,NE:niger,NF:norfolk-island,NG:nigeria,NI:nicaragua,NL:netherlands,NO:norway,NP:nepal,NR:nauru,NU:niue,NZ:new-zealand,OM:oman,PA:panama,PE:peru,PF:french-polynesia,PG:papua-new-guinea,PH:philippines,PK:pakistan,PL:poland,PM:saint-pierre-and-miquelon,PN:pitcairn,PR:puerto-rico,PS:state-of-palestine,PT:portugal,PW:palau,PY:paraguay,QA:qatar,RE:reunion,RO:romania,RS:serbia,RU:russia,RW:rwanda,SA:saudi-arabia,SB:solomon-islands,SC:seychelles,SD:sudan,SE:sweden,SG:singapore,SH:saint-helena,SI:slovenia,SJ:svalbard-and-jan-mayen,SK:slovakia,SL:sierra-leone,SM:san-marino,SN:senegal,SO:somalia,SR:suriname,SS:south-sudan,ST:sao-tome-and-principe,SV:el-salvador,SX:sint-maarten,SY:syria,SZ:swaziland,TC:turks-and-caicos-islands,TD:chad,TF:french-southern-and-antarctic-lands,TG:togo,TH:thailand,TJ:tajikistan,TK:tokelau,TL:timor-leste,TM:turkmenistan,TN:tunisia,TO:tonga,TR:turkey,TT:trinidad-and-tobago,TV:tuvalu,TW:taiwan,TZ:tanzania,UA:ukraine,UG:uganda,UM:united-states-minor-outlying-islands,US:united-states,UY:uruguay,UZ:uzbekistan,VA:vatican-city,VC:saint-vincent-and-the-grenadines,VE:venezuela,VG:british-virgin-islands,VI:virgin-islands-of-the-united-states,VN:vietnam,VU:vanuatu,WF:wallis-and-futuna,WS:samoa,XK:kosovo,YE:yemen,YT:mayotte,YU:yugoslavia,ZA:south-africa,ZM:zambia,ZW:zimbabwe';
const SLUG = Object.fromEntries(TABLE.split(',').map(p => p.split(':')));
const ISO_BY_SLUG = Object.fromEntries(Object.entries(SLUG).map(([k, v]) => [v, k]));
export const ALL_MARKETS = Object.freeze(Object.keys(SLUG).filter(c => !['AQ', 'BV', 'HM', 'GS', 'TF', 'UM'].includes(c)));
const store = (() => { try { return globalThis.localStorage; } catch { return null; } })();
const norm = v => { const c = String(v || '').trim().toUpperCase(); return !/^[A-Z]{2}$/.test(c) ? '' : c === 'UK' ? 'GB' : c === 'EL' ? 'GR' : c === 'XX' || c === 'T1' ? '' : c; };
export const validMarket = c => Object.hasOwn(SLUG, norm(c)) ? norm(c) : '';

/** The market in use, and where it came from. '' means "let the server decide from the network country". */
export function detectMarket() {
  try { const own = validMarket(store?.getItem(MARKET_KEY)); if (own) return {code:own, source:'choice'}; } catch {}
  try {
    const slug = JSON.parse(store?.getItem('fs13:profile') || '{}')?.country;
    if (slug && slug !== 'any' && ISO_BY_SLUG[slug]) return {code:ISO_BY_SLUG[slug], source:'profile'};
  } catch {}
  return {code:'', source:'server'};
}
export function setMarket(code) {
  const c = validMarket(code);
  try { if (c) store?.setItem(MARKET_KEY, c); else store?.removeItem(MARKET_KEY); } catch {}
  try { globalThis.dispatchEvent?.(new CustomEvent('foodscan:market', {detail:{code:c}})); } catch {}
  return c;
}
export const marketName = (code, lang = 'en') => { try { return new Intl.DisplayNames([lang === 'el' ? 'el' : 'en'], {type:'region'}).of(norm(code)) || code; } catch { return code; } };
/** Flag emoji from the two letters (regional indicator symbols); '' where the platform draws none (then the letters are shown). */
export const marketFlag = code => { const c = norm(code); return c ? String.fromCodePoint(...[...c].map(ch => 0x1F1A5 + ch.charCodeAt(0))) : ''; };
export const marketsSorted = (lang = 'en') => ALL_MARKETS.map(c => ({code:c, name:marketName(c, lang)})).sort((a, b) => a.name.localeCompare(b.name, lang === 'el' ? 'el' : 'en'));

/** Country -> currencies (same table as the worker's FS_CURRENCY_COUNTRIES; qa/ checks they are identical). */
const CURRENCY_COUNTRIES = {
  EUR:'AD AT AX BE BG BL CY DE EE ES FI FR GF GP GR HR IE IT LT LU LV MC ME MF MQ MT NL PM PT RE SI SK SM VA XK YT',
  USD:'US PR GU VI AS MP EC SV TL PW FM MH PA', GBP:'GB GG JE IM', CHF:'CH LI', CAD:'CA', AUD:'AU CC CX NF KI NR TV', NZD:'NZ CK NU TK',
  SEK:'SE', NOK:'NO SJ', DKK:'DK GL FO', ISK:'IS', PLN:'PL', CZK:'CZ', HUF:'HU', RON:'RO', RSD:'RS', BAM:'BA', ALL:'AL', MKD:'MK', MDL:'MD',
  UAH:'UA', BYN:'BY', RUB:'RU', TRY:'TR', GEL:'GE', AMD:'AM', AZN:'AZ', KZT:'KZ', UZS:'UZ', KGS:'KG', TJS:'TJ', TMT:'TM', MNT:'MN',
  ILS:'IL PS', JOD:'JO', LBP:'LB', SYP:'SY', IQD:'IQ', IRR:'IR', SAR:'SA', AED:'AE', QAR:'QA', KWD:'KW', BHD:'BH', OMR:'OM', YER:'YE',
  EGP:'EG', LYD:'LY', TND:'TN', DZD:'DZ', MAD:'MA', ZAR:'ZA', NAD:'NA', BWP:'BW', MZN:'MZ', ZMW:'ZM', AOA:'AO', NGN:'NG', GHS:'GH', KES:'KE',
  TZS:'TZ', UGX:'UG', RWF:'RW', ETB:'ET', XOF:'SN CI BJ BF ML NE TG GW', XAF:'CM GA CG TD CF GQ', MGA:'MG', MUR:'MU',
  INR:'IN', PKR:'PK', BDT:'BD', LKR:'LK', NPR:'NP', BTN:'BT', MVR:'MV', AFN:'AF', CNY:'CN', HKD:'HK', MOP:'MO', TWD:'TW', JPY:'JP', KRW:'KR',
  THB:'TH', VND:'VN', IDR:'ID', MYR:'MY', SGD:'SG', PHP:'PH', KHR:'KH', LAK:'LA', MMK:'MM', BND:'BN',
  MXN:'MX', GTQ:'GT', HNL:'HN', NIO:'NI', CRC:'CR', DOP:'DO', CUP:'CU', JMD:'JM', TTD:'TT', BBD:'BB', BSD:'BS', HTG:'HT',
  COP:'CO', VES:'VE', PEN:'PE', BOB:'BO', CLP:'CL', ARS:'AR', UYU:'UY', PYG:'PY', BRL:'BR', GYD:'GY', SRD:'SR', FJD:'FJ', PGK:'PG', XPF:'PF NC WF',
};
const BY_COUNTRY = (() => { const o = {}; for (const [cur, list] of Object.entries(CURRENCY_COUNTRIES)) for (const c of list.split(' ')) (o[c] ||= []).push(cur); o.PA = ['USD', 'PAB']; return o; })();
/** The currency prices are written in in this country ('' when unknown: then the answer's own currency is used). */
export const marketCurrency = code => BY_COUNTRY[norm(code)]?.[0] || '';

/* Money. A price keeps the currency it was recorded in; nothing is converted. The number style follows the shopper's market so that
 * 4.99 reads "$4.99" in the US, "£2.50" in Britain, "398 yen" without decimals in Japan and "2,50 EUR" style where the language wants it. */
const ENGLISH_REGIONS = new Set(['US', 'GB', 'CA', 'AU', 'NZ', 'IE', 'IN', 'SG', 'ZA', 'HK', 'PH', 'NG', 'KE', 'MY', 'PK']);
const formatters = new Map();
export function moneyLocale(lang, market) {
  if (lang === 'el') return 'el-GR';
  const m = norm(market);
  return ENGLISH_REGIONS.has(m) ? 'en-' + m : 'en-IE';
}
export function money(n, lang = 'en', currency = 'EUR', market = '') {
  const cur = /^[A-Z]{3}$/.test(String(currency || '')) ? currency : 'EUR', loc = moneyLocale(lang, market);
  // the market's own currency gets its short symbol ($, ¥, kr, zl); a foreign one keeps the long form (US$, JP¥, CHF) so it cannot be mistaken
  const own = !market || BY_COUNTRY[norm(market)]?.includes(cur), key = loc + cur + (own ? 'n' : 's');
  let f = formatters.get(key);
  if (!f) { try { f = new Intl.NumberFormat(loc, {style:'currency', currency:cur, currencyDisplay:own ? 'narrowSymbol' : 'symbol'}); } catch { f = new Intl.NumberFormat('en-IE', {style:'currency', currency:'EUR'}); } formatters.set(key, f); }
  return f.format(n);
}

/* The barcode as shoppers and Google know it: no leading zeros that are only padding (a 13-digit 0-prefixed EAN is a 12-digit UPC-A; 8-digit EAN-8 stays 8). */
export function searchCode(code) {
  const digits = String(code || '').replace(/\D/g, ''), t = digits.replace(/^0+/, '');
  if (!t) return digits;
  return t.length <= 8 ? t.padStart(8, '0') : t.length <= 12 ? t.padStart(12, '0') : t.padStart(t.length === 14 ? 14 : 13, '0');
}
/** "Check live prices online": a plain web search for the barcode. Added parameters (tbm=shop, gl=, udm=) made Google rank other products first; the bare
 *  barcode returns the right product and its shops. */
export const liveSearchURL = code => 'https://www.google.com/search?q=' + encodeURIComponent(searchCode(code));
