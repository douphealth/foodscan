/* BEGIN FOODSCAN PRICES 72 */
/* FoodScan 65: isolated price service. Inserted into the existing Pages advanced Worker build.
   Public observations: Open Prices (ODbL); authorized retailer data: optional D1.
   Never treat a community sighting as a current shelf-price guarantee. */
const FS_PRICE_VERSION = VERSION; // 78: the price service reports the same release as the app
const FS_PRICE_UPSTREAM = 'https://prices.openfoodfacts.org/api/v1/prices';
const FS_PRICE_CHAINS = [
  ['ab','AB Βασιλόπουλος',/(?:^|\b)(?:ab vassilopoulos|ab vasilopoulos|ab basilopoulos|abvassilopoulos|alfa beta|alpha beta|αβ)(?:\b|$)|(?:αβ\s*βασιλ|αλφα\s*βητα|άλφα\s*βήτα|βασιλοπουλ|βασιλόπουλ)/i],
  ['sklavenitis','Σκλαβενίτης',/sklavenit|σκλαβενιτ|σκλαβενίτ/i],
  ['lidl','Lidl',/\blidl\b|λιντλ|λίντλ/i],
  ['mymarket','My market',/my\s*market|my\s*μάρκετ|mymarket/i],
  ['masoutis','Μασούτης',/masout|μασουτ|μασούτ/i],
  ['kritikos','Κρητικός',/kritikos|κρητικο[σς]|κρητικό[σς]/i],
  ['galaxias','Γαλαξίας',/galaxias|γαλαξια|γαλαξία/i],
  ['marketin','Market In',/market\s*in|μαρκετ\s*ιν/i],
  ['synka','ΣΥΝΚΑ',/\bsynka\b|συνκα|σύνκα/i],
  ['chalkiadakis','Χαλκιαδάκης',/chalkiad|xalkiad|χαλκιαδακ|χαλκιαδάκ/i],
  ['bazaar','Bazaar',/\bbazaar\b|μπαζαρ|μπαζάρ/i],
  ['discount-markt','Discount Markt',/discount\s*markt/i],
];

/* ===== FoodScan 83: worldwide prices =====
 * A price is a real, dated observation made in the SHOPPER'S market (country) and in that market's currency. The market comes from, in
 * order: ?market=XX (the shopper's own choice, sent by the app), the visitor's network country (Cloudflare), else Greece (where FoodScan's
 * dedicated official sources are). Observations from other countries are kept apart ("elsewhere", with their own currency) and never ranked;
 * a price in another currency than the market's is never ranked either. No price is converted, estimated or guessed. */
const FS_CURRENCY_COUNTRIES = {
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
const FS_MARKET_CURRENCY = (() => { const m = {}; for (const [cur, list] of Object.entries(FS_CURRENCY_COUNTRIES)) for (const c of list.split(' ')) (m[c] ||= []).push(cur);
  m.PA = ['USD', 'PAB']; return m; })();
const FS_MARKET_DEFAULT = 'GR';
/** "uk" -> GB, "el" -> GR, "fr" -> FR; anything that is not a two-letter country code -> ''. */
function fsMarketCode(v) {
  const c = String(v || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return '';
  return c === 'UK' ? 'GB' : c === 'EL' ? 'GR' : c === 'XX' || c === 'T1' || c === 'ZZ' ? '' : c;
}
/** The shopper's market for one request (see the block comment above). */
function fsMarketOf(request, url) {
  return fsMarketCode(url.searchParams.get('market')) || fsMarketCode(request.cf?.country) || fsMarketCode(request.headers.get('CF-IPCountry')) || FS_MARKET_DEFAULT;
}
const fsMarketCurrencies = market => FS_MARKET_CURRENCY[market] || null;
/** Currencies whose everyday prices are large numbers (a 1 kg pack can cost 25,000 VND or 8,000 HUF): the sanity ceiling is higher. */
const FS_HIGH_DENOM = new Set(['JPY','KRW','IDR','VND','CLP','COP','PYG','UGX','TZS','KHR','LAK','MMK','IQD','IRR','LBP','SYP','UZS','MNT','XOF','XAF','RWF','MGA','HUF','ISK','PKR','NGN','KZT','AMD','HTG','CRC','ARS','XPF']);
const fsPriceCeiling = currency => FS_HIGH_DENOM.has(currency) ? 1e7 : 10000;
function fsPriceValidBarcode(s) {
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(s) || /^0+$/.test(s)) return false;
  let total = 0;
  for (let i = s.length - 2, weight = 3; i >= 0; i--, weight = 4 - weight) total += Number(s[i]) * weight;
  return (10 - total % 10) % 10 === Number(s.at(-1));
}
const fsPriceKey = code => String(code).padStart(14, '0');
const fsPriceText = (value, len=100) => typeof value === 'string' ? value.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0,len) : '';
const fsPriceNumber = v => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && /^\d+(?:[.,]\d+)?$/.test(v.trim())) {
    const n = Number(v.trim().replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};
function fsPriceISO(s) {
  if (typeof s !== 'string') return null;
  const clean = s.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return null;
  const ms = Date.parse(clean+'T00:00:00Z');
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0,10)===clean ? clean : null;
}
/** Today's date in Greece (Europe/Athens), YYYY-MM-DD. Greek observations are dated in local Greek days. */
function fsPriceToday(now = Date.now()) {
  try { return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Athens',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now)); }
  catch { return new Date(now + 2*3600000).toISOString().slice(0,10); }
}
/** Age in whole calendar days. 78: a future date is never clamped to "today": it gives a NEGATIVE age and every caller rejects it.
 *  83: outside Greece the reference day is UTC. A shop up to 14 h ahead of UTC can honestly date a price "tomorrow", so exactly one day
 *  ahead counts as today (age 0); two or more days ahead is still a mis-dated observation and is rejected. */
function fsPriceAge(s, now = Date.now(), market = 'GR') {
  const date = fsPriceISO(s); if (!date) return null;
  const reference = market === 'GR' ? fsPriceToday(now) : new Date(now).toISOString().slice(0,10);
  const age = Math.round((Date.parse(reference+'T00:00:00Z')-Date.parse(date+'T00:00:00Z'))/86400000);
  return market !== 'GR' && age === -1 ? 0 : age;
}
function fsPriceSourceURL(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && u.hostname.length>3 && !['localhost','127.0.0.1'].includes(u.hostname) ? u.toString().slice(0,400) : ''; }
  catch { return ''; }
}
function fsPriceRetailer(raw, market = 'GR') {
  const name = fsPriceText(raw, 100);
  if (market === 'GR') for (const [id,label,regex] of FS_PRICE_CHAINS) if (regex.test(name)) return {id,label,known:true};
  // 83: outside Greece the chain is whatever Open Street Map calls the shop's brand ("Carrefour", "Tesco"); its slug groups the branches.
  const slug = name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-+|-+$/g,'').slice(0,40);
  if (market !== 'GR' && slug.length >= 2) return {id:slug,label:name,known:true};
  return {id:'other',label:name || 'Supermarket observation',known:false};
}
function fsPriceDistanceKm(lat1, lon1, lat2, lon2) {
  const rad = Math.PI/180, a = Math.sin((lat2-lat1)*rad/2)**2 + Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin((lon2-lon1)*rad/2)**2;
  return 12742*Math.asin(Math.min(1,Math.sqrt(a)));
}
function fsPriceScope(url, request) {
  const market = request ? fsMarketOf(request, url) : (fsMarketCode(url.searchParams.get('market')) || FS_MARKET_DEFAULT);
  const latS=url.searchParams.get('lat'),lonS=url.searchParams.get('lon'),radiusS=url.searchParams.get('radius_km');
  const nearby = latS !== null || lonS !== null || radiusS !== null;
  if (!nearby) return {nearby:false, market};
  if (![latS,lonS,radiusS].every(x=>x!==null && /^-?\d+(?:\.\d+)?$/.test(x))) return null;
  const lat=Number(latS),lon=Number(lonS),radius=Number(radiusS);
  if (!(lat>=-90&&lat<=90&&lon>=-180&&lon<=180&&radius>=1&&radius<=50)) return null;
  return {nearby:true, market, lat:Math.round(lat*100)/100,lon:Math.round(lon*100)/100,radius:Math.round(radius)};
}
/* FoodScan prices 71: evidence only. Every offer is a real, dated observation from a named source.
 * No estimates, category benchmarks, chain multipliers or scraped name matches. Missing prices stay missing.
 * Freshness: current <= 7 days (only these can be "the cheapest"), older 8-90 days, historical > 90 days.
 * Greece and elsewhere are kept apart: an observation outside Greece is never shown as a Greek shelf price. */
const FS_PRICE_CURRENT_DAYS = 7, FS_PRICE_OLDER_DAYS = 90;
const FS_PRICE_RESTRICTED_PROMOS = ['LOYALTY_PROGRAM','QUANTITY','PICK_IT_YOURSELF','EXPIRES_SOON','SECOND_HAND'];
function fsPriceFreshness(age) { return age <= FS_PRICE_CURRENT_DAYS ? 'current' : age <= FS_PRICE_OLDER_DAYS ? 'older' : 'historical'; }
/** Country of an Open Prices location, from its own address fields only. A Greek-language shop name is not evidence
 *  of Greece: Σκλαβενίτης, Lidl and others trade in Cyprus too (Open Prices has Λεμεσός observations). */
function fsPriceLocationCountry(location) {
  const code = fsPriceText(location?.osm_address_country_code || location?.country_code, 8).toUpperCase();
  if (code === 'GR' || code === 'EL') return 'GR';
  if (/^[A-Z]{2}$/.test(code)) return code;
  const country = fsPriceText(location?.osm_address_country, 60).toLowerCase();
  if (/^(?:greece|hellas|ελλάδα|ελλαδα|ελλάς)$/.test(country)) return 'GR';
  if (/cyprus|κύπρος|κυπρος/.test(country)) return 'CY';
  return '';
}
function fsPriceProof(item) {
  const p = item?.proof;
  if (p?.draft === true) return false;
  return p && typeof p.type === 'string' && /^[A-Z_]{3,30}$/.test(p.type.trim().toUpperCase()) ? p.type.trim().toUpperCase() : null;
}
/** Pack size from a label quantity: "450 g" -> {amount:0.45, unit:'kg'}; "6 x 330 ml" -> {amount:1.98, unit:'l'}. Null when unclear. */
function fsPricePack(quantity, amount, unit) {
  const conv = (v, u) => { u = String(u||'').toLowerCase(); const n = Number(String(v).replace(',', '.'));
    if (!(n > 0)) return null;
    if (u === 'kg') return {amount:n, unit:'kg'}; if (u === 'g' || u === 'gr') return {amount:n/1000, unit:'kg'};
    if (u === 'l' || u === 'lt') return {amount:n, unit:'l'}; if (u === 'ml') return {amount:n/1000, unit:'l'}; if (u === 'cl') return {amount:n/100, unit:'l'};
    return null; };
  // 79: Greek unit words (γρ., λτ, μλ, κιλό) as written by Greek shops and labels; JS \b does not see Greek letters, hence the lookahead.
  const q = fsPriceText(quantity, 60).replace(/(\d)\s*(?:γραμμάρια|γραμ\.?|γρμ?\.?)(?![\p{L}])/giu, '$1g ').replace(/(\d)\s*(?:κιλά|κιλό|κιλ\.?)(?![\p{L}])/giu, '$1kg ')
    .replace(/(\d)\s*(?:λίτρα|λίτρο|λιτ\.?|λτ\.?)(?![\p{L}])/giu, '$1l ').replace(/(\d)\s*(?:μλ\.?)(?![\p{L}])/giu, '$1ml ');
  const multi = q.match(/(\d{1,3})\s*[x×*]\s*(\d+(?:[.,]\d+)?)\s*(kg|gr|g|ml|cl|lt|l)\b/i);
  let out = multi ? conv(multi[2], multi[3]) : null;
  if (out) out = {amount:out.amount*Number(multi[1]), unit:out.unit};
  if (!out) { const one = q.match(/(\d+(?:[.,]\d+)?)\s*(kg|gr|g|ml|cl|lt|l)\b/i); if (one) out = conv(one[1], one[2]); }
  if (!out && amount != null) out = conv(amount, unit);
  if (!out || out.amount < 0.005 || out.amount > 50) return null;
  return {amount:Math.round(out.amount*10000)/10000, unit:out.unit};
}
function fsPriceUnit(offer, pack) {
  if (offer.basis === 'kg' || offer.basis === 'l') return {unitPrice:offer.price, unitBasis:offer.basis};
  if (offer.basis === 'item' && pack) return {unitPrice:Math.round(offer.price/pack.amount*100)/100, unitBasis:pack.unit};
  return {unitPrice:null, unitBasis:null};
}
function fsPriceNormalizeOpen(item, code, scope, now=Date.now()) {
  if (!item || (item.type && item.type !== 'PRODUCT')) return null;
  const itemCode = item.product_code ?? item.product?.code;
  if (!itemCode || fsPriceKey(itemCode) !== fsPriceKey(code)) return null;
  // 83: any ISO 4217 currency. The offer keeps its own currency; nothing is converted.
  const currency = /^[A-Z]{3}$/.test(String(item.currency || '')) ? String(item.currency) : null;
  if (!currency) return null;
  if (item.duplicate_of !== null && item.duplicate_of !== undefined) return null;
  const id = Number(item.id);
  if (!Number.isInteger(id) || id <= 0) return null;
  const price = fsPriceNumber(item.price);
  if (price === null || !(price > 0 && price < fsPriceCeiling(currency))) return null;
  const dateStr = fsPriceISO(item.date);
  const home = scope.market || FS_MARKET_DEFAULT;
  const location = item.location || {};
  const countryCode = location.type === 'ONLINE' ? '' : fsPriceLocationCountry(location);
  const inMarket = countryCode === home;
  const age = fsPriceAge(dateStr, now, countryCode || home);
  if (age === null || age < 0 || age > 1825) return null; // 78: future-dated observations are rejected, not clamped
  const proofType = fsPriceProof(item);
  if (proofType === false) return null;
  const rawName = fsPriceText(location.osm_brand || location.osm_name || item.location_osm_name || '', 100);
  if (!rawName) return null;
  const lat = fsPriceNumber(location.osm_lat), lon = fsPriceNumber(location.osm_lon);
  if (scope.nearby && (!inMarket || lat===null || lon===null || fsPriceDistanceKm(scope.lat,scope.lon,lat,lon)>scope.radius)) return null;
  const retailer = fsPriceRetailer(rawName, inMarket ? home : countryCode || home);
  const basis = item.price_per === 'KILOGRAM' || item.price_per === 'KG' ? 'kg' : item.price_per === 'LITER' || item.price_per === 'L' ? 'l' : 'item';
  const discountType = fsPriceText(item.discount_type, 50).toUpperCase();
  const discounted = item.price_is_discounted === true || Boolean(discountType);
  const regular = fsPriceNumber(item.price_without_discount);
  const freshness = fsPriceFreshness(age);
  const conditional = FS_PRICE_RESTRICTED_PROMOS.includes(discountType);
  const file = String(item.proof?.file_path || '');
  const currencies = fsMarketCurrencies(home);
  return {
    id:'op:'+id, barcode:code, price:Math.round(price*100)/100,
    regularPrice:discounted && regular!==null && regular>price ? Math.round(regular*100)/100 : null,
    currency, basis, date:dateStr, ageDays:age, validUntil:null, freshness,
    // 78: only observations with a proof (receipt / shelf photo) rank; unproven ones are listed, never "the cheapest".
    // 83: and only in the shopper's own market and that market's currency (the final currency check for countries without a known currency is in fsPriceBuildPayload).
    rankingEligible:inMarket && (!currencies || currencies.includes(currency)) && freshness === 'current' && basis === 'item' && !conditional && Boolean(proofType),
    countryCode:countryCode || 'unknown', market:countryCode || 'unknown',
    retailer:retailer.label, retailerId:retailer.known ? retailer.id : 'other',
    storeName:fsPriceText(location.osm_name || rawName, 120), storeId:(Number(location.id ?? item.location_id) > 0 ? 'op-location:'+Number(location.id ?? item.location_id) : 'op-price:'+id),
    storeScope:location.type==='ONLINE' ? 'online' : 'branch',
    city:fsPriceText(location.osm_address_city || '', 60),
    discounted, discountType, offerConditions:conditional ? discountType : '',
    proofType, source:'Open Prices', sourceKind:'community', sourceLicense:'ODbL',
    sourceURL:`https://prices.openfoodfacts.org/prices/${id}`,
    proofURL:/^(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:jpe?g|png|webp)$/i.test(file) ? `https://prices.openfoodfacts.org/img/${file}` : null,
    latitude:lat, longitude:lon,
    productName:fsPriceText(item.product?.product_name || '', 120),
    productQuantity:fsPriceText(item.product?.quantity || '', 40),
    productAmount:fsPriceNumber(item.product?.product_quantity), productAmountUnit:fsPriceText(item.product?.product_quantity_unit || '', 4),
  };
}
function fsPriceNormalizeLicensed(row, code, scope, now=Date.now()) {
  const official=FS_GR_SOURCES[row?.source_id];
  if (official) { const o=fsGrOffer(official, code, fsPriceText(row.retailer_id,50), Number(row.price_cents)/100, fsPriceISO(row.observed_at), row.discounted===1, now);
    if (!o) return null;
    const out={...o, id:official.prefix+fsPriceText(row.offer_key,180), fetchedAt:fsPriceStamp(row.updated_at), origin:'d1'};
    if (official.kind==='retailer') {
      // Web-shop rows (written by the cron Worker): the product page the price was read from, and the shop's crossed-out price.
      const shop=fsPriceSourceURL(row.source_url), reg=row.regular_price_cents ? Number(row.regular_price_cents)/100 : null;
      const regular=reg!==null&&reg>o.price ? Math.round(reg*100)/100 : null;
      Object.assign(out,{regularPrice:regular, discounted:regular!==null||o.discounted, discountType:regular!==null||o.discounted?'SALE':'', match:'barcode', evidenceURL:official.url,
        sourceURL:shop && shop.startsWith(official.url.replace(/\/$/,'')) ? shop : official.url});
    }
    return out; }
  if (!row || fsPriceKey(String(row.barcode||''))!==fsPriceKey(code)) return null;
  const date=fsPriceISO(row.observed_at),age=fsPriceAge(date,now);
  if (age===null || age<0 || age>FS_PRICE_OLDER_DAYS) return null; // 78: future-dated feed rows are rejected
  const today=fsPriceToday(now);
  const expiration=row.valid_until ? fsPriceISO(row.valid_until):null;
  const expired=Boolean(row.valid_until && (!expiration || expiration < today));
  const price=Number(row.price_cents)/100;
  if (!Number.isFinite(price)||price<=0||price>10000) return null;
  const lat=fsPriceNumber(row.latitude),lon=fsPriceNumber(row.longitude);
  if (scope.nearby && row.store_scope==='branch' && (lat===null||lon===null||fsPriceDistanceKm(scope.lat,scope.lon,lat,lon)>scope.radius)) return null;
  const basis=['item','kg','l'].includes(row.price_basis)?row.price_basis:'item';
  const conditional=row.discount_type==='LOYALTY_PROGRAM'||row.discount_type==='QUANTITY';
  const freshness=expired?'expired':fsPriceFreshness(age);
  const regular=row.regular_price_cents ? Number(row.regular_price_cents)/100 : null;
  return {
    id:'lf:'+fsPriceText(row.offer_key,180),barcode:code,price,regularPrice:regular!==null&&regular>price?regular:null,
    currency:'EUR',basis,date,ageDays:age,validUntil:expiration,freshness,
    rankingEligible:freshness==='current'&&basis==='item'&&!conditional,
    countryCode:'GR',market:'GR',
    retailer:fsPriceText(row.retailer,100),retailerId:fsPriceText(row.retailer_id,50),storeName:fsPriceText(row.store_name,120),
    storeId:'licensed:'+fsPriceText(row.store_id,100),storeScope:row.store_scope,city:fsPriceText(row.city,60),
    discounted:row.discounted===1,discountType:fsPriceText(row.discount_type,50),offerConditions:fsPriceText(row.offer_conditions,140),
    proofType:'RETAILER_FEED',source:fsPriceText(row.source_label,80),sourceKind:'licensed',sourceLicense:fsPriceText(row.license_ref,120),
    sourceURL:fsPriceSourceURL(row.source_url),proofURL:null,latitude:lat,longitude:lon,
  };
}
/** One row per store and price basis: the most recent observation wins; same-day conflicts keep the lower price but are flagged. */
/** An ISO timestamp the cron Worker or a seed file recorded when it read the price ("fetched at"), or null. */
function fsPriceStamp(v) { const t=Date.parse(String(v||'')); return Number.isFinite(t) && t>Date.parse('2024-01-01') && t<Date.now()+86400000 ? new Date(t).toISOString() : null; }
function fsPriceDeduplicate(items) {
  const buckets=new Map();
  for(const o of items){
    const key=[o.storeId,o.basis].join('|');
    const old=buckets.get(key);
    if(!old){buckets.set(key,{...o});continue;}
    if(o.date>old.date) buckets.set(key,{...o,earlierObservations:(old.earlierObservations||0)+1});
    else if(o.date===old.date && o.fetchedAt && old.fetchedAt && o.fetchedAt!==old.fetchedAt) buckets.set(key,{...(o.fetchedAt>old.fetchedAt?o:old),earlierObservations:(old.earlierObservations||0)+1});
    else if(o.date===old.date && o.price!==old.price) buckets.set(key,{...(o.price<old.price?o:old),conflictingEvidence:true,earlierObservations:(old.earlierObservations||0)+1});
    else old.earlierObservations=(old.earlierObservations||0)+1;
  }
  return [...buckets.values()].sort(fsPriceOrder);
}
function fsPriceOrder(a,b){
  return Number(b.rankingEligible)-Number(a.rankingEligible) || (a.rankingEligible ? a.price-b.price : 0) || b.date.localeCompare(a.date) || a.price-b.price;
}

const FS_PRICE_SCHEMA = `CREATE TABLE IF NOT EXISTS foodscan_price_offers (
 offer_key TEXT PRIMARY KEY, barcode TEXT NOT NULL, retailer_id TEXT NOT NULL, retailer TEXT NOT NULL,
 store_id TEXT NOT NULL, store_name TEXT NOT NULL, store_scope TEXT NOT NULL, city TEXT NOT NULL DEFAULT '',
 latitude REAL, longitude REAL, price_cents INTEGER NOT NULL, regular_price_cents INTEGER,
 price_basis TEXT NOT NULL DEFAULT 'item', discounted INTEGER NOT NULL DEFAULT 0, discount_type TEXT NOT NULL DEFAULT '',
 offer_conditions TEXT NOT NULL DEFAULT '', observed_at TEXT NOT NULL, valid_until TEXT,
 source_id TEXT NOT NULL, source_label TEXT NOT NULL, source_url TEXT NOT NULL, license_ref TEXT NOT NULL,
 updated_at TEXT NOT NULL
);`;
const FS_PRICE_INDEX = 'CREATE INDEX IF NOT EXISTS foodscan_price_barcode ON foodscan_price_offers (barcode, observed_at DESC);';
async function fsPriceLicensedOffers(env, code, scope) {
  if (!env?.FOODSCAN_PRICES_DB) return {status:'disabled',reason:'not_configured',items:[]};
  try {
    const db=env.FOODSCAN_PRICES_DB, since=new Date(Date.now()-90*86400000).toISOString().slice(0,10);
    const result=await db.prepare('SELECT * FROM foodscan_price_offers WHERE barcode = ? AND observed_at >= ? ORDER BY observed_at DESC LIMIT 150').bind(fsPriceKey(code),since).all();
    // FoodScan 74: the cron Worker records every price change it sees (old -> new, both dated). Attach the latest one per offer.
    let changes=new Map();
    try { const c=await db.prepare('SELECT offer_key, old_cents, new_cents, old_observed_at, new_observed_at, detected_at FROM foodscan_price_changes WHERE barcode = ? AND detected_at >= ? ORDER BY detected_at DESC LIMIT 100').bind(fsPriceKey(code),since).all();
      for (const r of c?.results||[]) if (!changes.has(r.offer_key)) changes.set(r.offer_key,r); } catch {}
    const items=(result?.results||[]).map(r=>{ const o=fsPriceNormalizeLicensed(r,code,scope); if(!o)return null; const ch=changes.get(r.offer_key);
      if (ch && Number(ch.new_cents)===Number(r.price_cents) && Number(ch.old_cents)>0) o.priceChange={from:Number(ch.old_cents)/100, to:Number(ch.new_cents)/100, fromDate:fsPriceISO(ch.old_observed_at), toDate:fsPriceISO(ch.new_observed_at), detectedAt:fsPriceStamp(ch.detected_at)};
      return o; }).filter(Boolean);
    return {status:items.length?'ok_with_data':'ok_empty',items};
  } catch {
    return {status:'unavailable',items:[],reason:'database_not_ready'};
  }
}
const fsPriceBuckets=new Map();
function fsPriceCanFetch(ip) {
  const now=Date.now();
  const xs=(fsPriceBuckets.get(ip)||[]).filter(at=>at>now-60000);
  if(xs.length>=60) return false;
  xs.push(now);fsPriceBuckets.set(ip,xs);
  if(fsPriceBuckets.size>2500) for(const [key,arr] of fsPriceBuckets) if(arr.at(-1)<now-60000)fsPriceBuckets.delete(key);
  return true;
}
function fsPriceJson(data,status=200, extra={}) {
  return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-FoodScan-Version':FS_PRICE_VERSION,...extra}});
}
function fsPriceValidateImportRecord(rec,source) {
  if(!rec||typeof rec!=='object'||Array.isArray(rec))return null;
  const barcode=String(rec.barcode||'').trim();
  if(!fsPriceValidBarcode(barcode))return null;
  const retailer=FS_PRICE_CHAINS.find(x=>x[0]===rec.retailer_id);
  if(!retailer)return null;
  const scope=rec.store_scope==='national'?'national':rec.store_scope==='branch'?'branch':null;
  const storeId=fsPriceText(rec.store_id,80),storeName=fsPriceText(rec.store_name,120);
  if(!scope||!storeId||!storeName)return null;
  const fullStoreId=retailer[0]+':'+storeId;
  const price=fsPriceNumber(rec.price);
  if(price===null||price<0.01||price>10000)return null;
  const observed=fsPriceISO(rec.observed_at);
  const age=fsPriceAge(observed);
  if(age===null||age<0||age>30)return null;
  const until=rec.valid_until==null ? null:fsPriceISO(rec.valid_until);
  if(rec.valid_until!=null && (!until||until<observed))return null;
  const basis=['item','kg','l'].includes(rec.basis)?rec.basis:null;
  if(!basis)return null;
  const discountType=rec.discount_type==null?'':fsPriceText(rec.discount_type,40);
  const allowed=['','SALE','LOYALTY_PROGRAM','QUANTITY','SEASONAL','OTHER'];
  if(!allowed.includes(discountType))return null;
  const discounted=Boolean(discountType),regular=rec.regular_price==null?null:fsPriceNumber(rec.regular_price);
  if(regular!==null && (regular<price||regular>10000))return null;
  const lat=rec.latitude==null?null:fsPriceNumber(rec.latitude),lon=rec.longitude==null?null:fsPriceNumber(rec.longitude);
  if(scope==='branch' && (lat===null||lon===null||lat<34||lat>42||lon<19||lon>30))return null;
  const city=fsPriceText(rec.city,60),conditions=fsPriceText(rec.offer_conditions,140);
  if((discountType==='LOYALTY_PROGRAM'||discountType==='QUANTITY')&&!conditions)return null;
  const sourceUrl=fsPriceSourceURL(rec.source_url);
  if(!sourceUrl)return null;
  const recordKey=[source.id,fsPriceKey(barcode),fullStoreId,basis,discountType].join('|');
  return {offer_key:recordKey,barcode:fsPriceKey(barcode),retailer_id:retailer[0],retailer:retailer[1],store_id:fullStoreId,store_name:storeName,
    store_scope:scope,city,latitude:lat,longitude:lon,price_cents:Math.round(price*100),regular_price_cents:regular===null?null:Math.round(regular*100),
    price_basis:basis,discounted:discounted?1:0,discount_type:discountType,offer_conditions:conditions,observed_at:observed,
    valid_until:until,source_id:source.id,source_label:source.label,source_url:sourceUrl,license_ref:source.license,
    updated_at:new Date().toISOString()};
}
function fsPriceSameOrigin(request) {
  const url=new URL(request.url), origin=request.headers.get('Origin');
  if(origin&&origin!==url.origin)return false;
  return request.headers.get('Sec-Fetch-Site')!=='cross-site';
}
async function fsPriceAdminImport(request,env) {
  if(request.method!=='POST')return fsPriceJson({error:'method_not_allowed'},405,{Allow:'POST'});
  if(!env?.FOODSCAN_PRICES_DB||!env?.FOODSCAN_PRICES_ADMIN_TOKEN || String(env.FOODSCAN_PRICES_ADMIN_TOKEN).length<32) return fsPriceJson({error:'import_not_configured'},503);
  const bearer=request.headers.get('Authorization')||'';
  const given=bearer.startsWith('Bearer ')?bearer.slice(7):'';
  const d=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
  const [a,b]=await Promise.all([d(given),d(String(env.FOODSCAN_PRICES_ADMIN_TOKEN))]);
  let x=0; for(let i=0;i<a.length;i++)x|=a[i]^b[i];
  if(!given||x!==0)return fsPriceJson({error:'unauthorized'},401);
  if(Number(request.headers.get('Content-Length')||0)>180000)return fsPriceJson({error:'too_large'},413);
  let text;
  try{ text=await request.text();if(text.length>180000)throw new Error('large');}catch{return fsPriceJson({error:'too_large'},413);}
  let body;try{body=JSON.parse(text);}catch{return fsPriceJson({error:'bad_json'},400);}
  if(!body||!Array.isArray(body.records)||body.records.length<1||body.records.length>100)return fsPriceJson({error:'invalid_batch'},400);
  const source={id:fsPriceText(body.source_id,60),label:fsPriceText(body.source_label,80),license:fsPriceText(body.license_ref,120)};
  if(!/^[a-z0-9_-]{3,60}$/.test(source.id)||!source.label||source.license.length<6 || body.rights_confirmed!==true)
    return fsPriceJson({error:'rights_confirmation_required'},400);
  const records=body.records.map(r=>fsPriceValidateImportRecord(r,source));
  if(records.some(x=>!x))return fsPriceJson({error:'invalid_record',invalidIndices:records.map((r,i)=>r?null:i).filter(i=>i!==null)},400);
  const query=`INSERT INTO foodscan_price_offers (offer_key,barcode,retailer_id,retailer,store_id,store_name,store_scope,city,latitude,longitude,price_cents,regular_price_cents,price_basis,discounted,discount_type,offer_conditions,observed_at,valid_until,source_id,source_label,source_url,license_ref,updated_at)
 VALUES (${Array(23).fill('?').join(',')}) ON CONFLICT(offer_key) DO UPDATE SET price_cents=excluded.price_cents,regular_price_cents=excluded.regular_price_cents,
 discounted=excluded.discounted,offer_conditions=excluded.offer_conditions,observed_at=excluded.observed_at,valid_until=excluded.valid_until,source_url=excluded.source_url,license_ref=excluded.license_ref,updated_at=excluded.updated_at
 WHERE excluded.observed_at >= foodscan_price_offers.observed_at`;
  try{
    await env.FOODSCAN_PRICES_DB.batch(records.map(row=>env.FOODSCAN_PRICES_DB.prepare(query).bind(...[
      row.offer_key,row.barcode,row.retailer_id,row.retailer,row.store_id,row.store_name,row.store_scope,row.city,row.latitude,row.longitude,row.price_cents,row.regular_price_cents,row.price_basis,row.discounted,row.discount_type,row.offer_conditions,row.observed_at,row.valid_until,row.source_id,row.source_label,row.source_url,row.license_ref,row.updated_at])));
    return fsPriceJson({ok:true,accepted:records.length,source:source.label});
  }catch {return fsPriceJson({error:'database_not_ready'},503);}
}
/** Open Prices, newest first. All spellings of the code are asked at once. "unavailable" means the source did not answer:
 *  it is never reported as "no prices".
 *  83: a popular product has thousands of observations from dozens of countries, so the newest 300 may hold none from the shopper's
 *  own country. The shopper's market is therefore asked for FIRST (a country filter, up to 200 newest), next to the newest 100 of the
 *  world (for "seen elsewhere"). If the API rejects the filter (4xx) the answer falls back to the plain newest-300 read of 82. Every
 *  observation is checked again here (country, currency, date, proof), whichever way it was fetched. */
async function fsPriceOpenOffers(code, scope, env, request) {
  const site = request ? new URL(request.url).origin : 'https://food-scan.gearuptofit.com';
  const contact = typeof contactFor === 'function' ? contactFor(env, site) : 'https://food-scan.gearuptofit.com/how/';
  const codes = [...new Set([String(code).trim(), String(code).replace(/^0+/, ''), String(code).padStart(13, '0')])].filter(c => c.length >= 8 && c.length <= 14);
  const headers = {'Accept':'application/json','User-Agent':`FoodScan/${FS_PRICE_VERSION} (${contact})`};
  const page = async (candidate, n, extra = '') => {
    try {
      const res = await fetch(`${FS_PRICE_UPSTREAM}?product_code=${encodeURIComponent(candidate)}&size=100&page=${n}&order_by=-date${extra}`, {headers, redirect:'follow', signal:AbortSignal.timeout(4500)});
      if (res.status === 429) return {status:'rate_limited', items:[], httpStatus:429};
      if (!res.ok) return {status:'unavailable', items:[], httpStatus:res.status};
      const raw = await res.text();
      if (raw.length > 2500000) return {status:'unavailable', items:[]};
      const data = JSON.parse(raw);
      const list = Array.isArray(data?.items) ? data.items : null;
      return list ? {status:'available', items:list, total:Number(data.total)||list.length} : {status:'unavailable', items:[]};
    } catch { return {status:'unavailable', items:[]}; }
  };
  const read = async (candidate, extra, maxPages) => {
    const first = await page(candidate, 1, extra);
    if (first.status !== 'available' || !(first.total > first.items.length)) return first;
    const more = await Promise.all(Array.from({length:maxPages - 1}, (_, i) => i + 2).filter(n => (n - 1) * 100 < first.total).map(n => page(candidate, n, extra)));
    return {...first, items:[...first.items, ...more.filter(r => r.status === 'available').flatMap(r => r.items)], pages:1 + more.length};
  };
  // 84: the filters the Open Prices API REALLY has (checked in its source, open_prices/api/prices/filters.py): `currency` (exact), `date__gte`, and the nearby
  // trio `lat` + `lon` + `radius_km` (the server keeps only prices at locations within the radius). It has NO country filter: the 83 filter
  // `location__osm_address_country_code` was ignored by the API, so that read was a duplicate of the plain one. Every observation is still re-checked here.
  const since = new Date(Date.now() - FS_PRICE_OLDER_DAYS * 86400000).toISOString().slice(0, 10), cur = fsMarketCurrencies(scope.market || FS_MARKET_DEFAULT)?.[0];
  const recent = `&date__gte=${since}`;
  const focus = recent + (cur ? `&currency=${cur}` : '') + (scope.nearby ? `&lat=${scope.lat}&lon=${scope.lon}&radius_km=${scope.radius}` : '');
  const one = async candidate => {
    const [focused, world] = await Promise.all([read(candidate, focus, 2), read(candidate, recent, 1)]);
    if (focused.status === 'unavailable' && focused.httpStatus >= 400 && focused.httpStatus < 500) { // filters not understood: the plain newest-300 read
      const plain = await read(candidate, '', 3);
      return {...plain, focusedBy:'none'};
    }
    const answered = [focused, world].filter(r => r.status === 'available');
    if (!answered.length) return focused.status === 'rate_limited' || world.status === 'rate_limited' ? {status:'rate_limited', items:[], httpStatus:429} : (focused.httpStatus ? focused : world);
    return {status:'available', items:answered.flatMap(r => r.items), total:Math.max(...answered.map(r => r.total || 0)), focusedBy:focused.status === 'available' ? 'currency' : 'none'};
  };
  const results = await Promise.all(codes.map(one));
  const answered = results.filter(r => r.status === 'available');
  if (!answered.length) return {status:'unavailable', reason:results.some(r=>r.status==='rate_limited')?'rate_limited':(results.find(r=>r.httpStatus)?'http_'+results.find(r=>r.httpStatus).httpStatus:'network'), items:[], inspected:0};
  const seen = new Set(), raw = [];
  for (const r of answered) for (const i of r.items) if (!seen.has(i?.id)) { seen.add(i?.id); raw.push(i); }
  const items = raw.map(i => fsPriceNormalizeOpen(i, code, scope)).filter(Boolean);
  // 78: truthful health. 'ok_with_data' only when at least one usable observation survived validation.
  return {status:items.length?'ok_with_data':'ok_empty', items, inspected:raw.length, total:Math.max(...answered.map(r => r.total || 0))};
}
/** Name, brand and pack size only (for the label and per-kg maths). Never prices. */
/** The pack/identity fields FoodScan reads from a product record (bundled catalogue or Open Food Facts). */
function fsPricePickMeta(p) {
  return {
    name: fsPriceText(p.product_name_el || p.product_name || p.generic_name_el || p.generic_name || '', 120),
    brand: fsPriceText(String(p.brands || '').split(',')[0], 60),
    quantity: fsPriceText(p.quantity || '', 40),
    productAmount: fsPriceNumber(p.product_quantity), productAmountUnit: fsPriceText(p.product_quantity_unit || '', 4),
    nutriScore: /^[a-e]$/i.test(String(p.nutriscore_grade || '')) ? String(p.nutriscore_grade).toUpperCase() : null,
    image: fsPriceSourceURL(p.image_front_small_url || p.image_front_url || ''),
  };
}
/** The validated Open Food Facts product record (identity, quantity, grade). Never a price source. */
async function fsPriceOffRecord(code) {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,product_name_el,brands,quantity,product_quantity,product_quantity_unit,nutriscore_grade,image_front_small_url`, {
    headers:{'Accept':'application/json','User-Agent':`FoodScan/${FS_PRICE_VERSION} (https://food-scan.gearuptofit.com)`}, signal:AbortSignal.timeout(2600)});
  if (!res.ok) return null;
  const p = (await res.json())?.product; return p ? {...fsPricePickMeta(p), source:'open_food_facts'} : null;
}
/** 78: product identity, quantity and grade come ONLY from here: the bundled catalogue, then Open Food Facts.
 *  (v77 read them from a hardcoded price index first, which mislabelled e.g. 5202336082308.) */
async function fsPriceLocalCatalogueMeta(request, env, code) {
  const key = fsPriceKey(code);
  try {
    const m = await fs60Manifest(request, env, true);
    const bucket = String(Number(key.slice(-6)) % 32).padStart(2, '0');
    const index = await fs60ReadAsset(request, env, `codes-${bucket}.json`);
    if (index.revision === m.revision && index.codes?.[key]) {
      const data = await fs61Rows(request, env, m, [index.codes[key]]);
      const p = data.products.find(x => String(x.code).padStart(14, '0') === key);
      if (p) { const cat = {...fsPricePickMeta(p), source:'catalogue'};
        // The bundled catalogue sometimes omits the pack size; the validated Open Food Facts record may complete it.
        if (!cat.quantity && !cat.productAmount) { const off = await fsPriceOffRecord(code).catch(()=>null);
          if (off && (off.quantity || off.productAmount)) Object.assign(cat, {quantity:off.quantity, productAmount:off.productAmount, productAmountUnit:off.productAmountUnit, quantitySource:'open_food_facts'}); }
        return cat; }
    }
  } catch {}
  try { return await fsPriceOffRecord(code); } catch { return null; }
}

/* FoodScan 72/73: Greek prices from dated, public sources.
 *  - posokanei.gov.gr price observatory (Ministry of Development): daily national chain prices for ~10,000 products, no
 *    barcodes. A price reaches a barcode only through the link file (ingest/data/ean-posokanei-map-v3.json): links checked
 *    by a person ('h') plus automatic exact matches ('a': same brand, same pack size and unit count, all words and variants
 *    agree, one candidate only, same-week shelf prices consistent; measured 0 errors on the held-out hand-checked links).
 *    The offer says which ('reviewed' / 'auto-exact'). Every other barcode gets nothing from it.
 *  - e-katanalotis: barcode-keyed basket prices. The file has not changed since 16 Jun 2026, so they are history only.
 *  - bazaar-online.gr (v73): the chain's web shop prints the barcode next to the price; online price, dated, linked.
 *  Sources: the dated seed files below (built by ingest/scripts/import.mjs and ingest/scripts/bazaar.py) and, when
 *  configured, the D1 rows written by the daily ingest Worker. The newest dated price per chain wins. Prices are copied,
 *  never computed. */
const FS_GR_SEED_ROOT = '/assets/gr-prices-v72/';
const FS_GR_SOURCES = {
  posokanei:{prefix:'pk:', file:'posokanei-latest.json', store:'posokanei-national', source:'Παρατηρητήριο Τιμών · posokanei.gov.gr', proofType:'GOV_OBSERVATORY',
    url:'https://posokanei.gov.gr/', license:'Public-sector data (Law 4727/2020); daily archive github.com/spyrosavl/posokanei (MIT)'},
  ekatanalotis:{prefix:'ek:', file:'ekatanalotis-latest.json', store:'ekatanalotis', source:'e-katanalotis · Υπουργείο Ανάπτυξης', proofType:'GOV_BASKET',
    url:'https://e-katanalotis.gov.gr/', license:'Public-sector data (Law 4727/2020)'},
  // FoodScan 73: the chain's own web shop, which prints the barcode next to each price. Read politely from public category
  // pages that robots.txt allows (ingest/scripts/bazaar.py), cached, one request at a time. Online price, dated, linked.
  bazaar:{prefix:'bz:', file:'bazaar-eshop-latest.json', store:'eshop', source:'bazaar-online.gr · e-shop', proofType:'RETAILER_WEB', kind:'retailer',
    url:'https://www.bazaar-online.gr/', license:'Publicly displayed retailer price, quoted with link and date', chain:'bazaar', scope:'online', live:'microdata'},
  // FoodScan 74: lidl.gr product pages (robots.txt allows /p/; the sitemap lists them) carry the GTIN and one price in JSON-LD.
  // Lidl prices can differ by region; the site shows its default price, which is what is quoted.
  lidl:{prefix:'li:', file:'lidl-eshop-latest.json', store:'lidl-gr-web', source:'lidl.gr · τιμή ιστοσελίδας (προεπιλεγμένη περιοχή)', proofType:'RETAILER_WEB', kind:'retailer',
    url:'https://www.lidl.gr/', license:'Publicly displayed retailer price, quoted with link and date', chain:'lidl', scope:'online', live:'jsonld',
    // 79: lidl.gr now answers 301 to www.lidl-hellas.gr (same company, same /p/ pages, robots.txt allows /p/); only that hop is followed.
    liveHosts:['www.lidl.gr','www.lidl-hellas.gr']},
  // FoodScan 79: the Kritikos web shop (kritikos-sm.gr; robots.txt: Allow /). Its own product records carry the barcodes and the
  // price in cents. Read off-Workers by ingest/scripts/kritikos-seed.mjs (the shop's CDN may refuse Workers), sharded by barcode.
  // At scan time the product page is re-read once (live check); if that fails the dated seed price is shown with its date.
  kritikos:{prefix:'kr:', file:'kritikos-eshop-latest.json', store:'kritikos-eshop', source:'kritikos-sm.gr · τιμή e-shop', proofType:'RETAILER_WEB', kind:'retailer',
    url:'https://kritikos-sm.gr/', license:'Publicly displayed retailer price, quoted with link and date (price facts only; no shop texts or images)', chain:'kritikos', scope:'online', live:'next',
    // 79: OFF unless the operator sets FS_KRITIKOS=1. The shop's terms (kritikos-sm.gr/pages/oroi-xrhshs/, "Υποχρεώσεις Χρηστών")
    // forbid copying or any use of the site's content beyond the uses the site defines, so it may be switched on only with the
    // chain's written permission. Its seed files are not in the site zip (tools zip: optional/kritikos-seed/).
    optIn:'FS_KRITIKOS'},
};
const FS_GR_RETAILER_WEB = Object.keys(FS_GR_SOURCES).filter(id => FS_GR_SOURCES[id].kind === 'retailer');
/** 79: a source with optIn is read only when the operator has set that variable to '1' (needs the owner's permission). */
const fsGrEnabled = (id, env) => !FS_GR_SOURCES[id]?.optIn || String(env?.[FS_GR_SOURCES[id].optIn] ?? '') === '1';
const fsGrFiles = new Map();
function fsGrSeedFile(request, env, key, file, check) {
  if (!fsGrFiles.has(key)) {
    const task = (async () => {
      const res = await env.ASSETS.fetch(new Request(new URL(FS_GR_SEED_ROOT + file, request.url)));
      if (!res.ok) throw new Error('seed_missing');
      const raw = await res.text(); if (raw.length > 3 * 1024 * 1024) throw new Error('seed_too_large');
      const data = JSON.parse(raw); if (!check(data)) throw new Error('seed_invalid');
      return data;
    })();
    fsGrFiles.set(key, task); task.catch(() => { if (fsGrFiles.get(key) === task) fsGrFiles.delete(key); });
  }
  return fsGrFiles.get(key);
}
/** 79: one source's seed. A sharded seed (Kritikos, ~19k barcodes) is a small manifest plus 100 shards named by the last two
 *  digits of the 14-digit barcode, so a scan parses ~50 KB instead of megabytes. With a code, the shard is merged in. */
async function fsGrSeedV79(request, env, id, code=null) {
  const def = FS_GR_SOURCES[id]; if (!def || !env?.ASSETS) return null;
  const origin = new URL(request.url).origin;
  try {
    const man = await fsGrSeedLegacy(request, env, id);
    if (!man) return null;
    if (!man.sharded || code === null) return man;
    const shard = fsPriceKey(code).slice(-2), dir = /^[a-z0-9-]+\/$/.test(man.sharded) ? man.sharded : null; if (!dir) return null;
    const part = await fsGrSeedFile(request, env, origin + '|' + id + '|' + shard, dir + shard + '.json',
      d => d?.schema === 2 && d.products && Array.isArray(d.rows) && d.source?.snapshot === man.source.snapshot).catch(e => (e.message === 'seed_missing' ? {products:{}, rows:[]} : null));
    if (!part) return null;
    return {...man, products:part.products, rows:part.rows};
  } catch { return null; }
}
function fsGrSeedLegacyV79(request, env, id) {
  const def = FS_GR_SOURCES[id]; if (!def || !env?.ASSETS) return Promise.resolve(null);
  const key = new URL(request.url).origin + '|' + id;
  if (!fsGrFiles.has(key)) {
    const task = (async () => {
      const res = await env.ASSETS.fetch(new Request(new URL(FS_GR_SEED_ROOT + def.file, request.url)));
      if (!res.ok) throw new Error('seed_missing');
      const raw = await res.text(); if (raw.length > 3 * 1024 * 1024) throw new Error('seed_too_large');
      const data = JSON.parse(raw); if (![1, 2].includes(data?.schema) || !data.products || !fsPriceISO(data.source?.snapshot)) throw new Error('seed_invalid');
      return data;
    })();
    fsGrFiles.set(key, task); task.catch(() => { if (fsGrFiles.get(key) === task) fsGrFiles.delete(key); });
  }
  return fsGrFiles.get(key).catch(() => null);
}
/** One official chain price -> a FoodScan offer. National chain price (not one branch). */
function fsGrOffer(def, code, chainId, price, date, sale, now=Date.now()) {
  const chain = FS_PRICE_CHAINS.find(c => c[0] === chainId); if (!chain || !date) return null;
  if (!Number.isFinite(price) || price < 0.01 || price > 10000) return null;
  const age = fsPriceAge(date, now); if (age === null || age < 0) return null; // 78: no future dates, ages never capped
  const freshness = fsPriceFreshness(age);
  return {
    id:def.prefix+[date, chain[0], fsPriceKey(code)].join(':'), barcode:code, price:Math.round(price*100)/100, regularPrice:null,
    currency:'EUR', basis:'item', date, ageDays:age, validUntil:null, freshness,
    rankingEligible:freshness === 'current', countryCode:'GR', market:'GR',
    retailer:chain[1], retailerId:chain[0], storeName:chain[1], storeId:'licensed:'+chain[0]+':'+def.store, storeScope:def.scope || 'national', city:'',
    discounted:Boolean(sale), discountType:sale ? 'SALE' : '', offerConditions:'',
    proofType:def.proofType, source:def.source, sourceKind:def.kind || 'official', sourceLicense:def.license, sourceURL:def.url, proofURL:null, latitude:null, longitude:null,
  };
}
/** 79: live check of one Kritikos product page (the seed's own link, never a search). Reads the shop's record for this barcode
 *  from the page's __NEXT_DATA__ and returns today's price. 'unavailable' (network, HTTP error, challenge, timeout) keeps the
 *  dated seed price; 'barcode_not_on_page'/'gone' (the page answers but no longer lists the barcode, or 404) drops it. */
const FS_KR_SIMPLE = new Set(['none','percentage','super','amount','price']);
async function fsGrLiveCheck(def, path, code, now=Date.now()) {
  if (def.live === 'microdata' || def.live === 'jsonld') return fsGrLiveHtml(def, path, code, now);
  try {
    const res = await fetch(def.url.replace(/\/$/, '') + path, {headers:{'Accept':'text/html','User-Agent':`FoodScan/${FS_PRICE_VERSION} (+https://food-scan.gearuptofit.com/how/; one product page per scan)`}, redirect:'manual', signal:AbortSignal.timeout(2500)});
    if (res.status === 404 || res.status === 410) { await res.body?.cancel(); return {status:'gone'}; }
    if (!res.ok) { await res.body?.cancel(); return {status:'unavailable', http:res.status}; }
    const html = await res.text(); if (html.length > 3000000) return {status:'unavailable'};
    const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/); if (!m) return {status:'unavailable', reason:'no_product_data'};
    let pp = null; try { pp = JSON.parse(m[1])?.props?.pageProps || null; } catch { return {status:'unavailable', reason:'bad_product_data'}; }
    const list = [...['productSelected','product'].map(k => pp?.[k]).filter(x => x && typeof x === 'object'), ...Object.values(pp?.staticProducts || {}).flat()].filter(x => x && typeof x === 'object');
    const key = fsPriceKey(code);
    const rec = list.find(x => Array.isArray(x.barcodes) && x.barcodes.some(b => /^\d{8,14}$/.test(String(b)) && fsPriceKey(String(b)) === key));
    if (!rec) return {status:'barcode_not_on_page'};
    if (rec.enabled === false || rec.archived === true) return {status:'gone'};
    const c = v => Number.isInteger(v) && v >= 1 && v <= 1000000 ? v : null;
    const fin = c(rec.finalPrice), begin = c(rec.beginPrice) ?? c(rec.itemPrice); if (!fin || rec.isWeighed !== false) return {status:'unavailable', reason:'no_item_price'};
    const simple = FS_KR_SIMPLE.has(String(rec.offerType || 'none'));
    const price = (simple ? fin : (begin || fin)) / 100, regular = simple && begin && begin > fin ? begin / 100 : null;
    const date = fsPriceToday(now);
    return {status:'confirmed', offer:{price:Math.round(price*100)/100, regularPrice:regular, discounted:regular !== null, discountType:regular !== null ? 'SALE' : '',
      date, ageDays:0, freshness:'current', rankingEligible:rec.available !== false, available:rec.available !== false,
      extraOffer:simple ? '' : 'offer:' + String(rec.offerType).slice(0, 24), fetchedAt:new Date(now).toISOString(), origin:'live',
      id:def.prefix + [date, def.chain, key].join(':'), ...(fsPricePack(fsPriceText(rec.quantity || '', 60)) ? {shopPack:fsPricePack(fsPriceText(rec.quantity || '', 60))} : {})}};
  } catch { return {status:'unavailable'}; }
}
/** 79: live check of one Bazaar (schema.org microdata) or Lidl (schema.org JSON-LD) product page: the seed's own link, a page
 *  robots.txt allows, one request per scan. The page must name THIS barcode (Bazaar itemprop "model", Lidl gtin13) and print
 *  exactly one EUR price; then that price is today's. Anything else keeps the dated seed price ('unavailable'), except a page that
 *  clearly describes a product under another barcode ('barcode_not_on_page'), which drops it. A 404 is NOT taken as proof the item
 *  is gone (the shop may be refusing the fetch); the dated seed price stays, with its date. */
async function fsGrLiveHtml(def, path, code, now=Date.now()) {
  try {
    const get = u => fetch(u, {headers:{'Accept':'text/html','User-Agent':`FoodScan/${FS_PRICE_VERSION} (+https://food-scan.gearuptofit.com/how/; one product page per scan)`}, redirect:'manual', signal:AbortSignal.timeout(2500)});
    let res = await get(def.url.replace(/\/$/, '') + path);
    if ([301,302,307,308].includes(res.status) && def.liveHosts) { // one hop, only to the shop's own listed host, same /p/ path
      let to = null; try { to = new URL(res.headers.get('location') || '', def.url); } catch {}
      await res.body?.cancel();
      if (!to || to.protocol !== 'https:' || !def.liveHosts.includes(to.hostname) || to.pathname !== path.split('?')[0]) return {status:'unavailable', http:res.status};
      res = await get(to.href);
    }
    if (!res.ok) { await res.body?.cancel(); return {status:'unavailable', http:res.status}; }
    const html = await res.text(); if (html.length > 3000000) return {status:'unavailable'};
    const key = fsPriceKey(code), same = b => /^\d{8,14}$/.test(String(b || '')) && fsPriceKey(String(b)) === key;
    let codes = [], prices = [], available = true;
    if (def.live === 'microdata') {
      if ((html.match(/itemtype="https?:\/\/schema\.org\/Product"/g) || []).length !== 1) return {status:'unavailable', reason:'no_single_product'};
      codes = [...html.matchAll(/itemprop="(?:model|gtin13|gtin)"\s+content="(\d{8,14})"/g)].map(m => m[1]);
      prices = [...html.matchAll(/itemprop="price"\s+content="(\d{1,4}(?:\.\d{1,2})?)"/g)].map(m => Number(m[1]));
      const cur = html.match(/itemprop="priceCurrency"\s+content="([A-Z]{3})"/); if (cur && cur[1] !== 'EUR') return {status:'unavailable', reason:'currency'};
      if (/itemprop="availability"\s+href="https?:\/\/schema\.org\/(OutOfStock|Discontinued|SoldOut)"/.test(html)) available = false;
    } else {
      const nodes = []; const walk = x => { if (!x || typeof x !== 'object') return; if (Array.isArray(x)) return x.forEach(walk);
        const t = [].concat(x['@type'] || []); if (t.includes('Product')) nodes.push(x); if (x['@graph']) walk(x['@graph']); };
      for (const m of html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) { try { walk(JSON.parse(m[1])); } catch {} }
      if (nodes.length !== 1) return {status:'unavailable', reason:'no_single_product'};
      const n = nodes[0]; codes = ['gtin13','gtin','gtin14','gtin12','gtin8'].flatMap(k => [].concat(n[k] ?? [])).map(String);
      for (const o of [].concat(n.offers || [])) { if (o?.priceCurrency && o.priceCurrency !== 'EUR') continue; const v = Number(o?.price); if (Number.isFinite(v)) prices.push(v);
        if (/OutOfStock|Discontinued|SoldOut/.test(String(o?.availability || ''))) available = false; } // InStoreOnly: the shop's shelf price, still a price
    }
    if (!codes.length) return {status:'unavailable', reason:'no_barcode_on_page'};
    if (!codes.some(same)) return {status:'barcode_not_on_page'};
    const distinct = [...new Set(prices.filter(v => v > 0 && v < 1000).map(v => Math.round(v * 100)))];
    if (distinct.length !== 1) return {status:'unavailable', reason:distinct.length ? 'ambiguous_price' : 'no_price'};
    const date = fsPriceToday(now);
    return {status:'confirmed', offer:{price:distinct[0] / 100, date, ageDays:0, freshness:'current', fetchedAt:new Date(now).toISOString(), origin:'live',
      ...(available ? {} : {available:false, rankingEligible:false}), id:def.prefix + [date, def.chain, key].join(':')}};
  } catch { return {status:'unavailable'}; }
}
/** Seed offers for one barcode, plus what the payload needs to name the product and its real pack size. */
async function fsGrSeedOffers(request, env, code, now=Date.now()) {
  const key = fsPriceKey(code), out = {items:[], providers:{}, product:null, pack:null}, pending = [];
  for (const id of Object.keys(FS_GR_SOURCES)) {
    if (!fsGrEnabled(id, env)) { out.providers[id] = {status:'disabled', reason:'needs_permission', count:0}; continue; }
    const def = FS_GR_SOURCES[id], seed = await fsGrSeed(request, env, id, code);
    if (!seed) { out.providers[id] = {status:'unavailable', reason:'seed_missing', count:0}; continue; }
    let p = seed.products[key];
    if (typeof p === 'number') p = Array.isArray(seed.rows) ? seed.rows[p] || null : null; // 79: rows shared by the barcodes of one shop item
    const items = [];
    if (def.kind === 'retailer') {
      // One web-shop price per barcode: {n name, u product path, p price, o previous price, d date, f fetch time}. The barcode is the shop's own.
      const path = typeof p?.u === 'string' && /^\/[a-z0-9\-\/,.]+$/i.test(p.u) && !p.u.includes('..') ? p.u : null;
      const o = p ? fsGrOffer(def, code, def.chain, Number(p.p), fsPriceISO(p.d), Number(p.o) > Number(p.p), now) : null;
      if (o) items.push({...o, regularPrice:Number(p.o) > Number(p.p) ? Math.round(Number(p.o)*100)/100 : null, discountType:Number(p.o) > Number(p.p) ? 'SALE' : '',
        sourceURL:path ? def.url.replace(/\/$/, '') + path : def.url, evidenceURL:def.url, match:'barcode', productName:undefined,
        fetchedAt:fsPriceStamp(p.f || seed.source.fetched_at), origin:'seed',
        // 79: the pack the shop lists for its item (checked against the label in the payload), how many barcodes the shop puts on
        // that item, its stock flag and any offer condition. Weight/volume unit price as the shop prints it, when it has one.
        shopPack:fsPricePack(fsPriceText(p.q || p.n || '', 60)), shopBarcodes:Number(p.nb) > 1 ? Math.min(99, Number(p.nb)) : 1,
        ...(p.a === 'out_of_stock' ? {available:false, rankingEligible:false} : {}),
        // A multi-buy / gift offer on the item: the price shown is the plain single-item price, so it still ranks; the offer is noted.
        ...(typeof p.c === 'string' && p.c ? {extraOffer:fsPriceText(p.c, 40)} : {})});
      // 79: the live checks of the shops run in parallel (each at most 2.5 s); see fsGrLiveCheck / fsGrLiveHtml.
      const liveOn = def.live && items.length && path && env?.FS_SHOP_LIVE !== '0' && !(id === 'kritikos' && env?.FS_KRITIKOS_LIVE === '0');
      if (liveOn) { pending.push(fsGrLiveCheck(def, path, code, now).then(r => {
        if (r.status === 'confirmed') Object.assign(items[0], r.offer);
        else if (r.status === 'barcode_not_on_page' || r.status === 'gone') items.length = 0; // the shop no longer sells it under this barcode
        const pv = out.providers[id]; pv.live = r.status; if (r.status !== 'confirmed') pv.liveReason = r.reason || (r.http ? 'http_' + r.http : undefined);
        pv.count = items.length; pv.status = items.length ? 'ok_with_data' : 'ok_empty';
        out.items.push(...items);
      })); } else out.items.push(...items);
      out.providers[id] = {status:items.length?'ok_with_data':'ok_empty', snapshot:seed.source.snapshot, fetchedAt:fsPriceStamp(seed.source.fetched_at), count:items.length, source:new URL(def.url).hostname.replace(/^www\./,''), license:def.license};
      continue; // 78: the shop's product name is never used as the product identity
    }
    // Observatory links carry how the barcode was tied to the observatory product: 'h' reviewed by a person, 'a' automatic exact match.
    const match = id === 'posokanei' ? (p?.m === 'a' ? 'auto-exact' : 'reviewed') : 'barcode';
    if (id === 'posokanei' && p) out.linkMatch = match;
    if (p && Array.isArray(p.p)) for (const [chainId, price, date, sale] of p.p) {
      // posokanei flags a temporary discount; the e-katanalotis flag means a permanent reduction, i.e. the regular price.
      const o = fsGrOffer(def, code, chainId, Number(price), fsPriceISO(date), id === 'posokanei' && sale === 1, now);
      if (o) items.push({...o, match, evidenceURL:fsPriceSourceURL(seed.source.archive || seed.source.feed || '') || def.url, fetchedAt:fsPriceStamp(seed.source.fetched_at), origin:'seed'});
    }
    out.items.push(...items);
    out.providers[id] = {status:items.length?'ok_with_data':'ok_empty', snapshot:seed.source.snapshot, count:items.length, linked:id === 'posokanei' ? Boolean(p) : undefined, license:def.license};
    // 78: the observatory's pack size is kept ONLY to check the link against the validated label; it never sets the quantity.
    if (p && !out.pack && (p.u === 'kg' || p.u === 'l') && p.q > 0.005 && p.q <= 50) out.pack = {amount:Math.round(p.q*10000)/10000, unit:p.u, source:id};
  }
  const est = await fsEstimateFor(request, env, code).catch(() => null);
  if (est) { out.estimate = est.estimate; out.estimateMeta = est.meta; out.estimateName = est.name; out.candidates = est.candidates || []; }
  await Promise.all(pending);
  return out;
}
/** 78: truthful provider health. Every provider reports exactly one of:
 *  ok_with_data (answered, and at least one usable observation for this barcode), ok_empty (answered, nothing usable),
 *  unavailable (did not answer: network, HTTP error, rate limit, missing file) or disabled (not configured on this deployment). */
const FS_PROVIDER_STATES = ['ok_with_data','ok_empty','unavailable','disabled'];
function fsProvider(p, extra={}) {
  const status = FS_PROVIDER_STATES.includes(p?.status) ? p.status : 'unavailable';
  const {items, ...rest} = p || {};
  return {...rest, ...extra, status, ...(p?.status && p.status !== status ? {reason:p.reason || p.status} : {})};
}
/** Per-source licence and provenance, shown with every price. Only these sources can rank. */
const FS_PRICE_LICENSES = {
  'op:':'ODbL (Open Prices, Open Food Facts)',
  'pk:':FS_GR_SOURCES.posokanei.license, 'ek:':FS_GR_SOURCES.ekatanalotis.license,
  'bz:':FS_GR_SOURCES.bazaar.license, 'li:':FS_GR_SOURCES.lidl.license, 'kr:':FS_GR_SOURCES.kritikos.license,
};
const fsPriceLicenseOf = o => { const pre = String(o.id||'').slice(0,3); return pre === 'lf:' ? (o.sourceLicense || 'Licensed retailer feed') : (FS_PRICE_LICENSES[pre] || o.sourceLicense || ''); };
/* 83: integrity checks that need the whole set of observations of one barcode in one market. */
const fsPriceMedian = xs => { const a = xs.slice().sort((x, y) => x - y), m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
/** (1) A price in another currency than the market's never ranks (countries without a known currency use the most common currency of their
 *  own observations). (2) A community observation far from what at least 3 OTHER stores recorded for the same barcode, currency and pack
 *  basis (below half or above 2.5x their median) is a probable typing or unit mistake: shown, flagged "suspect", never ranked, never counted.
 *  A discounted price whose crossed-out regular price is in the normal band is a real promotion and stays. (3) "Typical": the median of
 *  the non-suspect, unconditional shelf prices of the last 90 days, one per store, when at least 3 stores recorded one. It is a statistic
 *  of this barcode's own recorded prices, never an estimate from other products. */
function fsPriceFlagSuspects(items) {
  const live = items.filter(o => !o.otherCurrency && o.basis === 'item' && o.freshness !== 'historical' && o.freshness !== 'expired');
  return items.map(o => {
    if (!o.id.startsWith('op:') || o.otherCurrency || o.basis !== 'item' || o.freshness === 'historical') return o;
    const peers = live.filter(x => x.storeId !== o.storeId && x.currency === o.currency).map(x => x.price);
    if (peers.length < 3) return o;
    const med = fsPriceMedian(peers);
    const promo = o.discounted && o.regularPrice && o.regularPrice >= med * 0.7 && o.regularPrice <= med * 2.5;
    return (o.price < med * 0.5 && !promo) || o.price > med * 2.5 ? {...o, rankingEligible:false, suspect:true, peerMedian:Math.round(med * 100) / 100} : o;
  });
}
function fsPriceMarketGuard(local, home) {
  const known = fsMarketCurrencies(home);
  let currency = known ? known[0] : null;
  if (!known) { const n = {}; for (const o of local) if (o.freshness !== 'historical') n[o.currency] = (n[o.currency] || 0) + 1; currency = Object.keys(n).sort((a, b) => n[b] - n[a])[0] || null; }
  const sameCurrency = o => known ? known.includes(o.currency) : o.currency === currency;
  const base = local.map(o => sameCurrency(o) ? o : {...o, rankingEligible:false, otherCurrency:true});
  const guarded = fsPriceFlagSuspects(base);
  const pool = guarded.filter(o => !o.suspect && !o.otherCurrency && o.basis === 'item' && o.freshness !== 'historical' && o.freshness !== 'expired' && !o.offerConditions && !(o.discountType && FS_PRICE_RESTRICTED_PROMOS.includes(o.discountType)));
  const typical = pool.length >= 3 ? (() => { const prices = pool.map(o => o.price);
    return {price:Math.round(fsPriceMedian(prices) * 100) / 100, low:Math.min(...prices), high:Math.max(...prices), n:pool.length, retailers:new Set(pool.map(o => o.retailerId)).size,
      windowDays:FS_PRICE_OLDER_DAYS, currency, newest:pool.map(o => o.date).sort().at(-1)}; })() : null;
  return {offers:guarded, currency, typical};
}
/** The whole answer, built from evidence only. Exported shape is shared with prices/price-core-v79.mjs. */
function fsPriceBuildPayload({code, scope, meta, open, licensed, official={items:[],providers:{},pack:null}, web={status:'disabled',items:[]}, now=Date.now()}) {
  const home = scope.market || FS_MARKET_DEFAULT;
  // D1 observatory rows carry no link method; the seed's link file says how this barcode was tied to the observatory product.
  const off = FS_GR_RETAILER_WEB.filter(id => official.providers?.[id]?.status === 'disabled').map(id => FS_GR_SOURCES[id].prefix);
  const lic = licensed.items.filter(o => !off.some(pre => String(o.id||'').startsWith(pre))) // 79: a disabled source never shows, even from D1
    .map(o => o.id?.startsWith('pk:') ? {...o, match:official.linkMatch || o.match} : o);
  const all = [...official.items, ...lic, ...(web.items||[]), ...open.items];
  // 78: product identity, quantity and grade come ONLY from the validated catalogue / Open Food Facts record.
  // Open Prices embeds the Open Food Facts product record, so it is accepted as a fallback and labelled as such.
  const sample = open.items.find(o => o.productName || o.productQuantity || o.productAmount) || {};
  const labelPack = fsPricePack(meta?.quantity || sample.productQuantity, meta?.productAmount ?? sample.productAmount, meta?.productAmountUnit || sample.productAmountUnit);
  // 79: the barcode identifies the item, the label size comes from a crowd-sourced record. When at least two independent shops
  // list THIS exact barcode (one barcode per shop item) with the same size and the label says otherwise, the label record is the
  // odd one out: the shops' size is used, and the response says so (packCheck.resolvedBy). One shop alone never overrides it.
  const differs = (a, b) => a.unit !== b.unit || Math.abs(a.amount - b.amount) / a.amount > 0.05;
  const shopPacks = []; for (const o of all) if (o.shopPack && o.shopBarcodes === 1 && o.market === 'GR') { const src = o.id.split(':')[0]; if (!shopPacks.some(x => x.src === src)) shopPacks.push({src, pack:o.shopPack}); }
  // 79: the observatory's own product record (linked by this barcode, reviewed or exact auto-match) is an independent second
  // source: one shop + the observatory agreeing on the size also outvote a crowd-sourced label (e.g. a 410 g cereal labelled 30 g).
  if (shopPacks.length && official.pack?.source === 'posokanei') shopPacks.push({src:'pk', pack:{amount:official.pack.amount, unit:official.pack.unit}});
  const agreed = shopPacks.length >= 2 && shopPacks.every(x => !differs(shopPacks[0].pack, x.pack)) ? shopPacks[0].pack : null;
  const resolvedBy = agreed && (!labelPack || differs(labelPack, agreed)) ? shopPacks.map(x => x.src) : null;
  const pack = resolvedBy ? {amount:agreed.amount, unit:agreed.unit} : labelPack;
  // The observatory links a barcode to its own product by name; if its pack size disagrees with the label, the link is
  // suspect: its prices are shown with a warning and never rank.
  const obsPack = official.pack || null;
  const packMismatch = Boolean(pack && obsPack && (pack.unit !== obsPack.unit || Math.abs(pack.amount - obsPack.amount) / pack.amount > 0.05));
  // 78: the observatory row is for a different pack than this barcode's label: keep it visible as evidence, never rank it,
  // and give its unit price for the pack actually observed (so it is never compared as if it were this product).
  const checkLink = o => {
    if (packMismatch && /^(?:pk|ek):/.test(o.id)) return {...o, rankingEligible:false, packMismatch:true, observedPack:{amount:obsPack.amount, unit:obsPack.unit}};
    // 79: a web-shop price is checked against the label too. The shop's own item size differs from this barcode's label (shops
    // list old/new or multipack barcodes on one item): "same product, other size", never ranked, unit price for the shop's size.
    if (o.shopPack && pack && differs(pack, o.shopPack)) return {...o, rankingEligible:false, packMismatch:true, observedPack:o.shopPack};
    // The shop puts several barcodes on this item and the size cannot be checked: shown, never ranked.
    if (o.shopBarcodes > 1 && !(o.shopPack && pack)) return {...o, rankingEligible:false, packUnconfirmed:true};
    return o;
  };
  // 79: every offer says which tier it is in; only 'current' can be the cheapest.
  const tierOf = o => o.rankingEligible ? 'current' : o.packMismatch ? 'otherSize' : o.packUnconfirmed ? 'packUnconfirmed' : o.available === false ? 'outOfStock'
    : o.suspect ? 'suspect' : o.otherCurrency ? 'otherCurrency' : o.freshness !== 'current' ? 'older' : 'notRanked';
  // 83: "local" = this shopper's market (Greece: the official and shop sources plus Open Prices; elsewhere: Open Prices). Everything else is "elsewhere".
  const guard = fsPriceMarketGuard(fsPriceDeduplicate(all.filter(o => o.market === home).map(checkLink)), home);
  const greek = guard.offers.slice().sort(fsPriceOrder);
  // 83: other countries: a probable typing mistake there is dropped (grouped per country and currency), and the rest is listed newest first
  const abroad = (() => { const groups = new Map(); for (const o of fsPriceDeduplicate(all.filter(o => o.market !== home))) { const k = o.market + '|' + o.currency; (groups.get(k) || groups.set(k, []).get(k)).push(o); }
    return [...groups.values()].flatMap(g => fsPriceFlagSuspects(g)).filter(o => !o.suspect); })();
  const elsewhere = abroad.filter(o => o.freshness !== 'historical').sort((a,b)=>b.date.localeCompare(a.date)).slice(0, 12)
    .map(o => ({...o, rankingEligible:false}));
  const strip = o => { const {productName, productQuantity, productAmount, productAmountUnit, market, shopPack, ...rest} = o; return {...rest, tier:tierOf(o), sourceLicense:fsPriceLicenseOf(o), ...(o.packMismatch && o.observedPack ? fsPriceUnit(o, o.observedPack) : fsPriceUnit(o, pack))}; };
  const offers = greek.slice(0, 60).map(strip), others = elsewhere.map(strip);
  const eligible = offers.filter(o => o.rankingEligible);
  const best = eligible.slice().sort((a,b)=>a.price-b.price || b.date.localeCompare(a.date))[0] || null;
  const latest = offers.filter(o => !o.suspect && !o.otherCurrency).sort((a,b)=>b.date.localeCompare(a.date))[0] || null;
  // 78: cheapest per chain, keeping every branch: each chain's cheapest current offer plus how many branches/sources it has.
  const perChain = {};
  for (const o of eligible) { if (!o.retailerId || o.retailerId === 'other') continue;
    const c = perChain[o.retailerId] || (perChain[o.retailerId] = {retailerId:o.retailerId, retailer:o.retailer, bestOfferId:o.id, storeId:o.storeId, price:o.price, observations:0, storeIds:[]});
    c.observations++; if (!c.storeIds.includes(o.storeId)) c.storeIds.push(o.storeId); if (o.price < c.price) Object.assign(c, {bestOfferId:o.id, storeId:o.storeId, price:o.price}); }
  const greekMarket = home === 'GR';
  const providers = {
    openPrices:fsProvider(open, {inspected:open.inspected||0, greek:open.items.filter(o=>o.market===home).length, local:open.items.filter(o=>o.market===home).length, elsewhere:open.items.filter(o=>o.market!==home).length, license:FS_PRICE_LICENSES['op:']}),
    liveDatabase:fsProvider(licensed, {count:licensed.items.length}),
    webSearch:fsProvider(web, {count:(web.items||[]).length, checkedAt:web.checkedAt||null, cached:Boolean(web.cached)}),
    // 83: the Greek official and web-shop sources exist only for the Greek market; elsewhere they are not part of the answer at all (no "unavailable" noise).
    ...(greekMarket ? {
      observatory:fsProvider(official.providers.posokanei, {source:'posokanei.gov.gr', d1:licensed.items.filter(o=>o.id.startsWith('pk:')).length, packMismatch}),
      ekatanalotis:fsProvider(official.providers.ekatanalotis, {source:'e-katanalotis.gov.gr', historical:true}),
      ...Object.fromEntries(FS_GR_RETAILER_WEB.map(id=>[id, fsProvider(official.providers[id], {d1:licensed.items.filter(o=>o.id.startsWith(FS_GR_SOURCES[id].prefix)).length})])),
    } : {}),
  };
  const active = Object.values(providers).filter(p => p.status !== 'disabled');
  const down = active.filter(p => p.status === 'unavailable').length;
  // All providers down: the result is NOT available (never "no data"). Some down and nothing found: incomplete.
  // 80: an estimate is offered only when no recorded price of this exact barcode can lead the card (a current, older, not-ranked or out-of-stock one)
  const leadable = offers.some(o => ['current', 'older', 'notRanked', 'outOfStock'].includes(o.tier));
  // 81: no price is ever estimated. A range from "similar products" read as this product's price and was often far off
  // (EUR 5.40-22.33/kg). When this barcode has no recorded price, up to 3 CLOSE products (same-brand class A/B matches, >= 55 %
  // similar) are listed as `related`: each with its OWN recorded price, name, source and date, and never as this product's price.
  const near = !leadable ? (official.estimate || null) : null;
  const related = near && ['A', 'B'].includes(near.cls) ? (near.examples || []).filter(x => x && x.name && x.price > 0 && x.similarity >= 55).slice(0, 3) : [];
  const estimate = null;
  // 82: same-brand observatory products the shopper may confirm as this one (only while this barcode has no CURRENT price;
  // an old price, e.g. e-katanalotis from June, is still shown first, with its age)
  const candidates = !offers.some(o => o.tier === 'current') && !official.confirmed ? (official.candidates || []).slice(0, 4) : [];
  const status = offers.length || others.length ? 'observations_available' : !active.length || down === active.length ? 'temporarily_unavailable' : down ? 'incomplete' : 'no_data';
  return {
    version:FS_PRICE_VERSION, barcode:code, country:home, currency:guard.currency, scope:scope.nearby?'nearby':(greekMarket?'greece':'market'), checkedAt:new Date(now).toISOString(),
    market:{code:home, currency:guard.currency, currencies:fsMarketCurrencies(home), source:scope.marketSource || 'default'},
    status, transport:'pages_worker',
    product: meta ? {name:meta.name, brand:meta.brand, quantity:meta.quantity, nutriScore:meta.nutriScore, image:meta.image, source:meta.source} :
      (sample.productName ? {name:sample.productName, brand:'', quantity:sample.productQuantity||'', nutriScore:null, image:'', source:'open_food_facts_via_open_prices'} : null),
    productName: meta ? [meta.name, meta.brand && !meta.name.toLowerCase().includes(meta.brand.toLowerCase()) ? meta.brand : '', meta.quantity].filter(Boolean).join(' · ') : (sample.productName || official.estimateName || ''),
    pack, packCheck: obsPack || resolvedBy ? {label:labelPack, ...(obsPack ? {observatory:{amount:obsPack.amount, unit:obsPack.unit}, consistent:!packMismatch} : {}), ...(resolvedBy ? {resolvedBy, shops:{amount:agreed.amount, unit:agreed.unit}} : {})} : null,
    offers, elsewhere:others, estimate, related, candidates, confirmed:official.confirmed || null, data:official.estimateMeta || null, providers,
    providerSummary:{active:active.length, unavailable:down, disabled:Object.values(providers).length-active.length},
    summary:{bestOfferId:best?.id||null, lowestCurrentPrice:best?.price??null, currentOffers:eligible.length,
      retailers:new Set(eligible.map(o=>o.retailer)).size, stores:new Set(eligible.map(o=>o.storeId)).size, perChain:Object.values(perChain).sort((a,b)=>a.price-b.price),
      latestGreekOfferId:latest?.id||null, latestGreekDate:latest?.date||null, latestOfferId:latest?.id||null, latestDate:latest?.date||null,
      typical:guard.typical, suspect:offers.filter(o => o.suspect).length,
      tiers:Object.fromEntries(['current','otherSize','packUnconfirmed','older','outOfStock','notRanked','suspect','otherCurrency'].map(t => [t, offers.filter(o => o.tier === t).length]))},
    limitations:greekMarket ? [
      `Only real, dated prices are shown, each with its own source and licence: the Ministry of Development price observatory (posokanei.gov.gr, national chain prices), e-katanalotis (history only), Open Prices (community receipts and shelf photos, ODbL), the chains' own web shops (${FS_GR_RETAILER_WEB.filter(id => official.providers?.[id]?.status !== 'disabled').map(id => new URL(FS_GR_SOURCES[id].url).hostname.replace(/^www\./, '')).join(', ')}) and licensed retailer feeds when configured. No price is ever estimated (81). When a barcode has no recorded price, "related" may list up to 3 close products (same brand, similar name and size) with THEIR OWN recorded price, source and date; they are never presented as this product's price.`,
      'Only observations from the last 7 days, with no expired promotion and a dated proof, can be "the cheapest". Older prices are still shown, as the last recorded price, with their age. Future-dated observations are rejected.',
      'The observatory publishes no barcodes. Its prices appear only for barcodes linked to its products by a reviewed link, an automatic exact match, or (81) a price-anchored match (a chain web shop and the observatory report the same chain\'s regular price to the cent, same brand and size, one product only); each price says which. If its pack size disagrees with the label, its prices never rank.',
      'Web-shop prices found by FoodScan\'s web search (84) come from shops\' own product pages in your country. An AI model reads the page, then every price is checked: it must appear on that page, in your currency, for this barcode or the exact same name, brand and size. Each shows the shop, the link and when it was read.',
      'Lidl prices can vary by region; lidl.gr shows its default (national) price. Web-shop prices are the shop\'s online price; shelf prices in stores may differ.',
      'A web-shop price is checked against the label size. If the shop sells this barcode as another size it is shown as "same product, other size" with its own unit price, and never ranks. Prices older than 7 days are shown as "older price" with their date and age.',
      'A store with no observation shows "Not available". Shelf prices change and offers expire: check the price in store or at checkout.',
    ] : [
      'Only real, dated prices are shown, each with its own source, store and date. They come from Open Prices (community receipts and shelf photos of Open Food Facts contributors, ODbL). No price is ever converted from another currency, estimated or guessed.',
      'Only prices recorded in the last 7 days, in this country\'s currency, with a dated receipt or shelf-photo proof and no loyalty-card or multi-buy condition can be "the cheapest". Older prices stay visible as the last recorded price, with their age. Future-dated observations are rejected.',
      'A price far from what at least three other stores recorded for the same barcode (below half or above 2.5 times their median) is shown as unusual and is never ranked or counted. The typical price is the median of the unconditional prices of the last 90 days, when at least three stores recorded one.',
      'Shop prices found by web search come from shops\' own product pages in this country. Each price was read from the page, checked to appear there in this country\'s currency, and only an exact barcode or exact name, brand and size match in stock can be the cheapest. Each shows the shop, a link and when it was read.',
      'Prices recorded in other countries are listed separately with their own currency; they are reference only, not prices in your country.',
      'Community coverage differs by country and product. A store with no observation shows "Not available". Shelf prices change and offers expire: check the price in store or at checkout.',
    ],
  };
}
/** GET /api/prices/health: is the automatic price refresh working? Read-only. From D1 (cron Worker runs, crawl cursors, row
 *  counts, price changes) when bound; otherwise the dates of the bundled seed files. 'stale' when a source has not succeeded
 *  within its expected interval. */
const FS_PRICE_HEALTH_LIMITS = {posokanei:{hours:50, cadence:'daily'}, ekatanalotis:{hours:24*45, cadence:'when the ministry publishes (historical)'}, bazaar:{hours:12, cadence:'hourly slices'}, lidl:{hours:12, cadence:'hourly slices'},
  kritikos:{hours:24*8, cadence:'weekly off-Workers crawl (ingest/scripts/kritikos-seed.mjs) + one live product-page check per scan'}};
async function fsPriceHealthV79(request, env, now=Date.now()) {
  const out = {version:FS_PRICE_VERSION, release:VERSION, checkedAt:new Date(now).toISOString(), currentDays:FS_PRICE_CURRENT_DAYS, mode:'seed', sources:{}};
  for (const id of Object.keys(FS_GR_SOURCES)) {
    if (!fsGrEnabled(id, env)) { out.sources[id] = {label:FS_GR_SOURCES[id].source, state:'disabled', reason:`needs the shop's permission; set ${FS_GR_SOURCES[id].optIn}=1 only when granted`}; continue; }
    const seed = await fsGrSeed(request, env, id);
    out.sources[id] = {label:FS_GR_SOURCES[id].source, cadence:FS_PRICE_HEALTH_LIMITS[id]?.cadence || '', seed:seed ? {snapshot:seed.source.snapshot, fetchedAt:fsPriceStamp(seed.source.fetched_at), products:seed.sharded ? Number(seed.source.counts?.products) || 0 : Object.keys(seed.products).length,
      ageDays:fsPriceAge(seed.source.snapshot, now)} : null};
  }
  const db = env?.FOODSCAN_PRICES_DB;
  if (db) {
    try {
      const since7 = new Date(now - 7*86400000).toISOString();
      const [runs, okRuns, counts, crawl, changes, first] = await Promise.all([
        db.prepare('SELECT r.source_id, r.status, r.run_at, r.snapshot_date, r.rows FROM foodscan_price_ingest_runs r JOIN (SELECT source_id, MAX(run_at) m FROM foodscan_price_ingest_runs GROUP BY source_id) x ON x.source_id = r.source_id AND x.m = r.run_at').all(),
        db.prepare("SELECT source_id, MAX(run_at) last_ok FROM foodscan_price_ingest_runs WHERE status IN ('ok','cycle_done','unchanged') GROUP BY source_id").all(),
        db.prepare('SELECT source_id, COUNT(*) offers, COUNT(DISTINCT barcode) barcodes, MAX(observed_at) newest, MAX(updated_at) last_write FROM foodscan_price_offers GROUP BY source_id').all(),
        db.prepare('SELECT source_id, json_array_length(targets) targets, position, cycle, cycle_started_at, last_cycle_done_at, last_run_at, last_ok_at, last_status, pages_ok, pages_failed, consecutive_failures FROM foodscan_crawl_state').all().catch(() => ({results:[]})),
        db.prepare('SELECT source_id, COUNT(*) n FROM foodscan_price_changes WHERE detected_at >= ? GROUP BY source_id').bind(since7).all().catch(() => ({results:[]})),
        db.prepare('SELECT MIN(run_at) first_run FROM foodscan_price_ingest_runs').first().catch(() => null),
      ]);
      // a fresh deployment: sources that have not had their first scheduled run yet (daily ones wait up to 24 h) are 'awaiting_first_run', not failures
      const young = !first?.first_run || now - Date.parse(first.first_run) < 26*3600000;
      const by = (r, k='source_id') => Object.fromEntries((r?.results || []).map(x => [x[k], x]));
      const R = by(runs), O = by(okRuns), C = by(counts), S = by(crawl), X = by(changes);
      out.mode = 'live';
      for (const id of Object.keys(out.sources)) {
        if (out.sources[id].state === 'disabled') continue;
        const lastOk = O[id]?.last_ok || null, hours = lastOk ? (now - Date.parse(lastOk)) / 3600000 : null, lim = FS_PRICE_HEALTH_LIMITS[id]?.hours ?? 48;
        out.sources[id].live = {lastRun:R[id] ? {status:R[id].status, at:R[id].run_at, snapshot:R[id].snapshot_date, rows:R[id].rows} : null, lastOk,
          hoursSinceOk:hours === null ? null : Math.round(hours*10)/10, offers:C[id]?.offers || 0, barcodes:C[id]?.barcodes || 0, newestObservation:C[id]?.newest || null, lastWrite:C[id]?.last_write || null,
          crawl:S[id] ? {targets:S[id].targets, position:S[id].position, cycle:S[id].cycle, progress:S[id].targets ? Math.round(1000*S[id].position/S[id].targets)/10 : null,
            lastCycleDoneAt:S[id].last_cycle_done_at, lastStatus:S[id].last_status, consecutiveFailures:S[id].consecutive_failures} : null,
          priceChanges7d:X[id]?.n || 0};
        out.sources[id].state = !lastOk ? (R[id] ? 'failing' : young ? 'awaiting_first_run' : 'never_ran') : hours > lim ? 'stale' : (S[id]?.consecutive_failures || 0) >= 3 ? 'failing' : 'ok';
      }
    } catch { out.mode = 'seed'; out.database = 'not_ready'; }
  }
  if (out.mode === 'seed') for (const id of Object.keys(out.sources)) {
    if (out.sources[id].state === 'disabled') continue;
    const s = out.sources[id].seed; out.sources[id].state = !s ? 'missing' : s.ageDays <= FS_PRICE_CURRENT_DAYS ? 'seed_current' : 'seed_older';
  }
  for (const id of Object.keys(out.sources)) out.sources[id].license = FS_GR_SOURCES[id]?.license || null; // 78: per-source licence, never a blanket ODbL
  out.openPrices = {checked:'per request (public API)', license:FS_PRICE_LICENSES['op:']};
  const states = Object.values(out.sources).map(s => s.state).filter(s => s !== 'disabled');
  out.status = states.every(s => s === 'ok') ? 'ok' : out.mode === 'live' ? (states.every(s => s === 'ok' || s === 'awaiting_first_run') ? 'starting' : states.some(s => s === 'ok') ? 'degraded' : 'down') : 'seed_only';
  out.note = out.mode === 'live' ? 'Live: prices are refreshed by the foodscan-price-ingest cron Worker and read from D1 on every request.'
    : 'No live database is bound: prices come from the bundled seed files (dated). Run scripts/deploy-prices.sh to switch on automatic refresh.';
  return fsPriceJson(out, out.status === 'down' ? 503 : 200);
}
/* ===== FoodScan 80: labelled estimates + live data refresh =====
 * 1. ESTIMATES. /assets/gr-est-v80/e-NN.json (64 files by barcode) holds, only for barcodes that have NO recorded price, an estimate
 *    from comparable products with a recorded price. It is returned as `estimate`, a separate object: never an offer, never ranked.
 *    Its range is the measured error of the method (leave-one-out, checked on held-out data); see manifest.json in the same folder.
 * 2. REFRESH WITHOUT REDEPLOYING. The daily refresh job (.github/workflows/refresh-prices.yml) publishes newer copies of the seed
 *    files (seeds/*.json) and the estimate shards to the `prices-data` branch. When FS_V80_REMOTE (or FOODSCAN_PRICE_DATA_URL) is
 *    reachable, the NEWER of the bundled and the remote copy is used; a missing, older, invalid or unreachable remote copy is ignored.
 *    FOODSCAN_PRICE_DATA_URL=off switches it off. Every observation keeps its own date. */
const FS_V80_REMOTE = 'https://raw.githubusercontent.com/douphealth/foodscan/prices-data';
const FS_V80_TTL = 30 * 60 * 1000;
const FS_EST_ROOT = '/assets/gr-est-v80/';
const FS_EST_SHARDS = 64;
const fsV80Base = env => { const v = env?.FOODSCAN_PRICE_DATA_URL; if (v === 'off') return ''; return typeof v === 'string' && /^https:\/\/[^\s]+$/.test(v) ? v.replace(/\/+$/, '') : FS_V80_REMOTE; };
const fsV80Cache = new Map();
function fsV80Cached(key, load) {
  const hit = fsV80Cache.get(key);
  if (hit && Date.now() - hit.at < FS_V80_TTL) return hit.task;
  const task = load(); const entry = {at:Date.now(), task}; fsV80Cache.set(key, entry);
  task.catch(() => { if (fsV80Cache.get(key) === entry) fsV80Cache.delete(key); });
  if (fsV80Cache.size > 200) for (const [k, v] of fsV80Cache) { if (Date.now() - v.at > FS_V80_TTL) fsV80Cache.delete(k); }
  return task;
}
/** Bundled copy and (optionally) remote copy, in parallel; the newer by `stamp` wins. */
async function fsV80Read(request, env, bundledPath, remoteName, validate, stamp, accept = () => true) {
  const own = async () => {
    const res = await env.ASSETS.fetch(new Request(new URL(bundledPath, request.url)));
    if (!res.ok) throw new Error('missing');
    const raw = await res.text(); if (raw.length > 4 * 1024 * 1024) throw new Error('too_large');
    const data = JSON.parse(raw); if (!validate(data)) throw new Error('invalid'); return data;
  };
  const remote = async () => {
    const base = fsV80Base(env); if (!base) return null;
    const res = await fetch(base + '/' + remoteName, {signal:AbortSignal.timeout(1500), headers:{'Accept':'application/json'}, cf:{cacheEverything:true, cacheTtlByStatus:{'200-299':1800, '404':60, '500-599':0}}});
    if (!res.ok) return null;
    const raw = await res.text(); if (raw.length > 4 * 1024 * 1024) return null;
    const data = JSON.parse(raw); return validate(data) ? data : null;
  };
  const [a, b] = await Promise.all([own().catch(() => null), remote().catch(() => null)]);
  if (!a && !b) throw new Error('unavailable');
  if (a && b) return (stamp(b) || 0) > (stamp(a) || 0) && accept(b, a) ? Object.assign(b, {origin:'remote'}) : Object.assign(a, {origin:'bundled'});
  return b ? Object.assign(b, {origin:'remote'}) : Object.assign(a, {origin:'bundled'});
}
const fsEstShardId = code => String(Number(String(code).padStart(14, '0').slice(-6)) % FS_EST_SHARDS).padStart(2, '0');
const fsEstShard = (request, env, code) => fsV80Cached(new URL(request.url).origin + '|e-' + fsEstShardId(code), () =>
  fsV80Read(request, env, FS_EST_ROOT + 'e-' + fsEstShardId(code) + '.json', 'e-' + fsEstShardId(code) + '.json', d => d && d.v === 80 && d.items && typeof d.items === 'object', d => Date.parse(d.built),
    // 82: a newer remote shard from a build without candidates must not hide the bundled candidates
    (remote, own) => fsEstHasK(remote) || !fsEstHasK(own)));
const fsEstHasK = d => Object.values(d.items).some(x => Array.isArray(x?.k) && x.k.length);
const fsEstManifest = (request, env) => fsV80Cached(new URL(request.url).origin + '|e-manifest', () =>
  fsV80Read(request, env, FS_EST_ROOT + 'manifest.json', 'manifest.json', d => d && d.version === 80 && d.estimator, d => Date.parse(d.built)));
/** Estimate record from a shard -> the payload object (checked again by the client). */
function fsEstObject(e, manifest) {
  if (!e || typeof e !== 'object' || !['kg', 'l', 'pcs'].includes(e.u) || !(e.m > 0) || !(e.a > 0) || !(e.b >= e.m) || !['A', 'B', 'C', 'D', 'E'].includes(e.c)) return null;
  const cal = manifest?.estimator?.classes?.[e.c];
  const label = s => /^pk\d+$/.test(s) ? 'Παρατηρητήριο Τιμών' : s === 'bz' ? 'bazaar-online.gr' : s === 'li' ? 'lidl.gr' : '';
  return {
    unit:e.u, unitLow:e.a, unitMid:e.m, unitHigh:e.b, pack:Array.isArray(e.p) && e.p.length === 3 ? e.p : null, n:e.n, cls:e.c, category:fsPriceText(e.g || '', 60),
    examples:(Array.isArray(e.x) ? e.x : []).slice(0, 3).map(x => ({name:fsPriceText(x[0], 90), price:Number(x[1]), source:label(String(x[2])), date:fsPriceISO(x[3]), similarity:Number(x[4]) || 0})),
    validation:cal && cal.usable ? {medianErrorPct:cal.medianAbsPctError, coverage80:manifest.estimator?.holdout?.[e.c]?.coverage80 ?? null, tested:cal.n} : null,
    builtAt:fsPriceISO(String(manifest?.built || '')),
  };
}
async function fsEstimateFor(request, env, code) {
  const [shard, manifest] = await Promise.all([fsEstShard(request, env, code), fsEstManifest(request, env).catch(() => null)]);
  const e = shard.items[fsPriceKey(code)]; if (!e?.e && !e?.k) return null;
  const estimate = e.e ? fsEstObject(e.e, manifest) : null, candidates = fsObsCandidates(e.k);
  if (!estimate && !candidates.length) return null;
  return {estimate, candidates, name:fsPriceText(e.n || '', 120), meta:{builtAt:manifest?.built || shard.built || null, origin:shard.origin || 'bundled'}};
}
/* 82: "Is this your product?" The observatory (posokanei.gov.gr) prices ~10,000 products in every chain but publishes no barcodes.
 * For a barcode with no recorded price, the daily build lists up to 4 same-brand observatory products that no barcode is linked to
 * (`k` in the estimate shard). They are CANDIDATES only: their prices are never shown as this barcode's price. When the shopper,
 * holding the pack, confirms one (?pk=<observatory id>), that product's own dated chain prices are returned, labelled
 * match:'user-confirmed', and the observatory's pack size is checked against the label (a different size is shown, never ranked). */
const FS_OBS_ROOT = '/assets/gr-obs-v82/';
const FS_OBS_SHARDS = 64;
const fsObsId = v => /^[0-9a-f]{32}$/.test(String(v || '')) ? String(v) : '';
const fsObsShardId = id => String(parseInt(id.slice(0, 6), 16) % FS_OBS_SHARDS).padStart(2, '0');
const fsObsShard = (request, env, id) => fsV80Cached(new URL(request.url).origin + '|o-' + fsObsShardId(id), () =>
  fsV80Read(request, env, FS_OBS_ROOT + 'o-' + fsObsShardId(id) + '.json', 'o-' + fsObsShardId(id) + '.json', d => d && d.v === 82 && d.items && typeof d.items === 'object', d => Date.parse(d.built)));
function fsObsCandidates(k) {
  if (!Array.isArray(k)) return [];
  return k.slice(0, 4).map(x => Array.isArray(x) && fsObsId(x[0]) ? {id:x[0], name:fsPriceText(x[1], 90), chains:Math.max(0, Math.min(20, Number(x[2]) || 0)), date:fsPriceISO(x[3]), similarity:Math.max(0, Math.min(100, Number(x[4]) || 0)),
    pack:Array.isArray(x[5]) && ['kg', 'l', 'pcs'].includes(x[5][0]) && Number(x[5][1]) > 0 ? {unit:x[5][0], amount:Number(x[5][1])} : null} : null).filter(x => x && x.name);
}
async function fsObsConfirmed(request, env, code, id, now=Date.now()) {
  const shard = await fsObsShard(request, env, id); const p = shard.items[id];
  if (!p || !Array.isArray(p.p)) return {id, name:'', items:[], pack:null, found:false};
  const def = FS_GR_SOURCES.posokanei, items = [];
  for (const [chainId, price, date, sale] of p.p.slice(0, 20)) {
    const o = fsGrOffer(def, code, chainId, Number(price), fsPriceISO(date), sale === 1, now);
    if (o) items.push({...o, match:'user-confirmed', evidenceURL:def.url, fetchedAt:fsPriceStamp(shard.built), origin:shard.origin || 'bundled'});
  }
  const pack = Array.isArray(p.q) && (p.q[0] === 'kg' || p.q[0] === 'l') && p.q[1] > 0.005 && p.q[1] <= 50 ? {amount:Math.round(p.q[1]*10000)/10000, unit:p.q[0], source:'posokanei'} : null;
  return {id, name:fsPriceText(p.n || '', 120), items, pack, found:true};
}
/** The four source seeds (observatory, e-katanalotis, Bazaar, Lidl) are SHARDED (see tools/lib/shard-seeds.mjs): the manifest is ~2 KB, a
 *  lookup reads one ~9 KB shard per source. That is ~1 ms of parsing instead of ~18 ms for the monolithic files, which is more than the
 *  Workers Free plan's ~10 ms CPU budget on a cold start. This loads the MANIFEST: the bundled one, or a NEWER remote one that kept at
 *  least 90 % of the bundled products (a truncated crawl never replaces a good file). A monolithic remote file still works (older job). */
function fsGrSeedLegacy(request, env, id) {
  const def = FS_GR_SOURCES[id]; if (!def || !env?.ASSETS) return Promise.resolve(null);
  return fsV80Cached(new URL(request.url).origin + '|seed|' + id, async () => {
    const valid = d => [1, 2].includes(d?.schema) && d.products && typeof d.products === 'object' && fsPriceISO(d.source?.snapshot);
    const count = d => d.sharded ? Number(d.source?.counts?.products) || 0 : Object.keys(d.products).length;
    const stamp = d => Date.parse(d.source?.fetched_at || d.source?.snapshot) || 0;
    const own = async () => {
      const res = await env.ASSETS.fetch(new Request(new URL(FS_GR_SEED_ROOT + def.file, request.url)));
      if (!res.ok) throw new Error('seed_missing');
      const raw = await res.text(); if (raw.length > 4 * 1024 * 1024) throw new Error('seed_too_large');
      const data = JSON.parse(raw); if (!valid(data)) throw new Error('seed_invalid'); return data;
    };
    const remote = async () => {
      const base = fsV80Base(env); if (!base) return null;
      const res = await fetch(base + '/seeds/' + def.file, {signal:AbortSignal.timeout(1500), headers:{'Accept':'application/json'}, cf:{cacheEverything:true, cacheTtlByStatus:{'200-299':1800, '404':60, '500-599':0}}});
      if (!res.ok) return null;
      const raw = await res.text(); if (raw.length > 4 * 1024 * 1024) return null;
      const data = JSON.parse(raw); return valid(data) ? data : null;
    };
    const [a, b] = await Promise.all([own().catch(() => null), remote().catch(() => null)]);
    if (!a && !b) throw new Error('unavailable');
    if (a && b && stamp(b) > stamp(a) && count(b) >= count(a) * 0.9) return {...b, origin:'remote', alt:a};
    return a ? {...a, origin:'bundled'} : {...b, origin:'remote'};
  }).catch(() => null);
}
/** One source's seed for one barcode: the manifest merged with that barcode's shard (bundled, or remote when the remote manifest won;
 *  if the remote shard cannot be read the consistent bundled set is used instead). With no code (health) the manifest alone. */
async function fsGrSeed(request, env, id, code=null) {
  const def = FS_GR_SOURCES[id]; if (!def || !env?.ASSETS) return null;
  try {
    let man = await fsGrSeedLegacy(request, env, id); if (!man) return null;
    if (!man.sharded || code === null) return man;
    const origin = new URL(request.url).origin, shardId = fsPriceKey(code).slice(-2);
    const read = m => {
      const dir = /^[a-z0-9-]+\/$/.test(m.sharded) ? m.sharded : null; if (!dir) return Promise.resolve(null);
      const name = dir + shardId + '.json', ok = d => d?.schema === 2 && d.products && Array.isArray(d.rows) && d.source?.snapshot === m.source.snapshot;
      return fsV80Cached(origin + '|seedshard|' + id + '|' + m.origin + '|' + m.source.snapshot + '|' + shardId, async () => {
        if (m.origin === 'remote') {
          const res = await fetch(fsV80Base(env) + '/seeds/' + name, {signal:AbortSignal.timeout(1500), headers:{'Accept':'application/json'}, cf:{cacheEverything:true, cacheTtlByStatus:{'200-299':1800, '404':60, '500-599':0}}});
          if (!res.ok) throw new Error('remote_shard');
          const raw = await res.text(); if (raw.length > 1024 * 1024) throw new Error('shard_too_large');
          const d = JSON.parse(raw); if (!ok(d)) throw new Error('seed_invalid'); return d;
        }
        const res = await env.ASSETS.fetch(new Request(new URL(FS_GR_SEED_ROOT + name, request.url)));
        if (res.status === 404) return {products:{}, rows:[]};
        if (!res.ok) throw new Error('seed_missing');
        const raw = await res.text(); if (raw.length > 1024 * 1024) throw new Error('shard_too_large');
        const d = JSON.parse(raw); if (!ok(d)) throw new Error('seed_invalid'); return d;
      }).catch(() => null);
    };
    let part = await read(man);
    if (!part && man.origin === 'remote' && man.alt?.sharded) { man = {...man.alt, origin:'bundled'}; part = await read(man); }
    if (!part) return null;
    return {...man, products:part.products, rows:part.rows};
  } catch { return null; }
}
/** GET /api/prices/health: the v79 report plus the estimator and the data origin. */
async function fsPriceHealth(request, env, now=Date.now()) {
  const res = await fsPriceHealthV79(request, env, now); let body; try { body = await res.clone().json(); } catch { return res; }
  try {
    const m = await fsEstManifest(request, env);
    body.estimator = {builtAt:m.built, origin:m.origin || 'bundled', referenceItems:m.estimator?.referenceItems || 0, estimates:m.withEstimate || 0, byClass:m.estimatesByClass || {}, validation:m.estimator?.classes || null, holdout:m.estimator?.holdout || null};
  } catch { body.estimator = null; }
  body.remote = {url:fsV80Base(env) || null, note:'The newer of the bundled and the remote copy is used for the seed files and the estimates.'};
  return fsPriceJson(body, res.status);
}
/* ===== end FoodScan 80 ===== */


/* ===== FoodScan 84: AI web price search (host-provided env.FS_WEB_PRICES) =====
 * Shops' own product pages in the shopper's country, read by an AI model and then checked: the price must literally appear on the page,
 * be in the market's currency and come from a shop page. Only barcode or exact name+brand+size matches that are in stock can rank. */
async function fsPriceWebOffers(env, code, scope, meta, fresh) {
  if (!env?.FS_WEB_PRICES) return {status:'disabled',items:[]};
  const market = scope.market || FS_MARKET_DEFAULT;
  const r = await env.FS_WEB_PRICES.lookup({code:fsPriceKey(code), market, name:meta?.name||'', brand:meta?.brand||'', quantity:meta?.quantity||'', currencies:fsMarketCurrencies(market)||[], fresh});
  const today = fsPriceToday(Date.now());
  // Pack size: each shop page's own size is checked against the label (fsPriceBuildPayload marks a different size "other size").
  // Without a label size, name matches are trusted only when every shop reports the same size (else: "size unconfirmed").
  const label = fsPricePack(meta?.quantity, meta?.productAmount, meta?.productAmountUnit);
  const packs = (r?.items||[]).map(o => fsPricePack(fsPriceText(o.packSize||o.productTitle||'', 60)));
  const sizes = new Set(packs.filter(Boolean).map(p => p.unit+':'+Math.round(p.amount*1000)));
  const sizeAgreed = !label && sizes.size === 1 && packs.every(Boolean);
  const items = (r?.items||[]).map((o, i) => {
    const shopPack = packs[i];
    const host = (() => { try { return new URL(o.url).hostname.replace(/^www\./,''); } catch { return ''; } })();
    const chain = FS_PRICE_CHAINS.find(c => c[2].test(o.retailer) || c[2].test(host));
    const date = String(o.checkedAt||'').slice(0,10) || today, age = fsPriceAge(date) ?? 0;
    const sameSize = label && shopPack && label.unit === shopPack.unit && Math.abs(label.amount - shopPack.amount) / label.amount <= 0.05;
    // Only verified local barcode or exact brand+name+pack evidence can rank; close names never do.
    const strong = Boolean(o.countryCode === market && (o.match === 'barcode' || (o.match === 'exact' && sameSize)));
    const unconfirmed = !strong && !(label && shopPack && !sameSize);
    return {
      id:'ws:'+host+':'+i, barcode:code, price:o.price, regularPrice:null, currency:o.currency, basis:'item', date, ageDays:age, validUntil:null,
      freshness:fsPriceFreshness(age), rankingEligible:strong && o.inStock !== false && age <= FS_PRICE_CURRENT_DAYS,
      countryCode:market, market, retailer:chain ? chain[1] : o.retailer, retailerId:chain ? chain[0] : 'web:'+host,
      storeName:o.retailer, storeId:'web:'+host, storeScope:'online', city:'', discounted:false, discountType:'', offerConditions:'',
      proofType:'WEB_PAGE', source:host, sourceKind:'retailer', sourceLicense:'Shop web page (price read on '+date+')',
      sourceURL:o.url, evidenceURL:o.url, proofURL:null, latitude:null, longitude:null, available:o.inStock !== false,
      match:o.match, webTitle:o.productTitle||'', webPack:o.packSize||'', fetchedAt:o.checkedAt||null, origin:'web',
      ...(shopPack ? {shopPack} : {}), ...(unconfirmed ? {packUnconfirmed:true} : {}),
    };
  });
  return {status:r?.status||'unavailable', items, checkedAt:r?.checkedAt, cached:r?.cached};
}

async function fsPricesRoute(request,env,ctx) {
  const url=new URL(request.url);
  const publicPath=url.pathname.startsWith('/prices/service/') ? url.pathname.slice('/prices/service/'.length) :
    url.pathname.startsWith('/api/prices/') ? url.pathname.slice('/api/prices/'.length) : null;
  if(publicPath===null)return null;
  if(!fsPriceSameOrigin(request))return fsPriceJson({error:'origin_not_allowed'},403);
  if(url.pathname==='/api/prices/admin/import')return fsPriceAdminImport(request,env);
  const canPost=publicPath==='compare';
  if(!['GET','HEAD',...(canPost?['POST']:[])].includes(request.method))return fsPriceJson({error:'method_not_allowed'},405,{Allow:canPost?'GET, HEAD, POST':'GET, HEAD'});
  if(request.method==='HEAD')return new Response(null,{status:200,headers:{'Cache-Control':'no-store','X-FoodScan-Version':FS_PRICE_VERSION}});
  if(publicPath==='health')return fsPriceHealth(request,env);
  if(publicPath==='status'){
    let probe='not_run';
    if(url.searchParams.get('probe')==='1'){
      try{const r=await fetch('https://prices.openfoodfacts.org/api/v1/status',{headers:{'Accept':'application/json','User-Agent':`FoodScan/${FS_PRICE_VERSION} (https://food-scan.gearuptofit.com)`},signal:AbortSignal.timeout(4000)});probe=r.ok?'responding':'http_'+r.status;}
      catch{probe='network_unavailable';}
    }
    return fsPriceJson({version:FS_PRICE_VERSION,route:'ready',endpoint:url.pathname,serverSideProxy:true,sources:{webSearch:(env?.FS_WEB_PRICES||fsWebConfigured(env))?'on (FIRECRAWL_API_KEY, ANTHROPIC_API_KEY and FOODSCAN_PRICES_DB present)':'off (needs the secrets FIRECRAWL_API_KEY and ANTHROPIC_API_KEY and the D1 binding FOODSCAN_PRICES_DB)',openPrices:'public_api',licensedFeeds:env?.FOODSCAN_PRICES_DB?'configured':'not_configured',observatory:'seed+d1',ekatanalotis:'seed_historical',retailerWeb:'seed+d1 (bazaar-online.gr, lidl.gr, kritikos-sm.gr + live product-page check)'},health:'/api/prices/health',probe,
      policy:'evidence_only: no estimated, benchmark or multiplier prices; missing prices are reported as not available',currentDays:FS_PRICE_CURRENT_DAYS,
      sourceLicenses:{openPrices:FS_PRICE_LICENSES['op:'],observatory:FS_GR_SOURCES.posokanei.license,ekatanalotis:FS_GR_SOURCES.ekatanalotis.license,bazaar:FS_GR_SOURCES.bazaar.license,lidl:FS_GR_SOURCES.lidl.license,kritikos:FS_GR_SOURCES.kritikos.license,licensedFeeds:'per feed (license_ref on every row)'}});
  }
  if(publicPath!=='compare')return fsPriceJson({error:'not_found'},404);
  const code=url.searchParams.get('barcode')||'',scope=fsPriceScope(url, request);
  if(!fsPriceValidBarcode(code)||!scope)return fsPriceJson({error:'invalid_query',message:'Provide a valid 8/12/13/14-digit GTIN, an optional two-letter market (country) and an optional latitude, longitude and radius (1–50 km).'},400);
  scope.marketSource = fsMarketCode(url.searchParams.get('market')) ? 'choice' : (fsMarketCode(request.cf?.country) || fsMarketCode(request.headers.get('CF-IPCountry'))) ? 'network' : 'default';
  const greekMarket = scope.market === 'GR';
  const cache = typeof caches!=='undefined' ? caches.default : null;
  const cacheURL=new URL(url.origin+'/prices/cache/v'+FS_PRICE_VERSION+'/'+scope.market+'/'+fsPriceKey(code));
  if(scope.nearby){cacheURL.searchParams.set('lat',String(scope.lat));cacheURL.searchParams.set('lon',String(scope.lon));cacheURL.searchParams.set('r',String(scope.radius));}
  if(url.searchParams.get('web')==='0')cacheURL.searchParams.set('web','0');
  const pkId=fsObsId(url.searchParams.get('pk'));   // 82: an observatory product the shopper confirmed for this barcode
  if(pkId)cacheURL.searchParams.set('pk',pkId);
  const cacheKey=new Request(cacheURL.toString());
  // 78: ?fresh=1 (sent on a rescan or "Try again") skips the edge copy and asks every source again.
  const forceFresh=url.searchParams.get('fresh')==='1';
  if(cache&&!forceFresh){try{const cached=await cache.match(cacheKey);if(cached)return cached;}catch{}}
  if(!fsPriceCanFetch(request.headers.get('CF-Connecting-IP')||'unknown'))return fsPriceJson({error:'rate_limited',message:'Please retry shortly.'},429,{'Retry-After':'60'});
  const [meta, open, licensed, official] = await Promise.all([
    fsPriceLocalCatalogueMeta(request, env, code).catch(()=>null),
    fsPriceOpenOffers(code, scope, env, request),
    fsPriceLicensedOffers(env, code, scope),
    // 83: the Greek official and web-shop sources are consulted only for the Greek market
    greekMarket ? fsGrSeedOffers(request, env, code).catch(()=>({items:[],providers:{},product:null,pack:null})) : Promise.resolve({items:[],providers:{},product:null,pack:null}),
  ]);
  // 82: a confirmation is used only while this barcode has no observatory link of its own (a reviewed or exact link always wins).
  if(greekMarket&&pkId&&!official.providers?.posokanei?.linked){
    const c=await fsObsConfirmed(request, env, code, pkId).catch(()=>null);
    if(c){official.items.push(...c.items);if(c.items.length)official.linkMatch='user-confirmed';if(c.pack&&!official.pack)official.pack=c.pack;}
    official.confirmed={id:pkId,name:c?.name||'',offers:c?.items.length||0,status:!c?'unavailable':!c.found?'not_found':c.items.length?'ok':'no_prices'};
  }
  let web = {status:'disabled',items:[]}, payload = fsPriceBuildPayload({code, scope, meta, open, licensed, official, web});
  // 84: the web search costs money, so it runs only when the cheap sources left this barcode without a CURRENT price in the shopper's market (or the shopper
  // asked again). deep=1 is the app's follow-up to a search that was still running: it waits for the whole search inside its own request.
  const webSvc = url.searchParams.get('web') === '0' ? null : fsWebService(env, ctx, url.searchParams.get('deep') === '1'); // web=0: a chip, never the paid search
  if (webSvc && payload.summary.currentOffers === 0) {
    web = await fsPriceWebOffers({FS_WEB_PRICES:webSvc}, code, scope, meta, forceFresh).catch(()=>({status:'unavailable',items:[]}));
    payload = fsPriceBuildPayload({code, scope, meta, open, licensed, official, web});
  }
  // 78: an answer with any provider down is never cached (the next scan asks again). Complete answers are kept 10 minutes. 84: nor while the web search is still running.
  const ttl = payload.providerSummary.unavailable === 0 && payload.status !== 'temporarily_unavailable' && web.status !== 'pending' ? 600 : 0;
  const output=fsPriceJson(payload,200,{'Cache-Control':ttl?`public, max-age=0, s-maxage=${ttl}`:'no-store','X-Price-Cache-TTL':String(ttl)});
  if(cache&&ttl){try{const copy=output.clone();const cacheable=new Response(copy.body,{status:200,headers:{...Object.fromEntries(copy.headers),'Cache-Control':`public, max-age=${ttl}`}});ctx?.waitUntil?.(cache.put(cacheKey,cacheable).catch(()=>{}));}catch{}}
  return output;
}

/* END FOODSCAN PRICES 72 */
