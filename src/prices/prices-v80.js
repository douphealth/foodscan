import { getPrices as fetchPrices } from './price-client-v80.mjs';
import { CHAINS, unitText, whenText, dateText, t as coreT } from './price-core-v80.mjs';
/* FoodScan 78 Prices (from 72/75): every supermarket price for one barcode, evidence only (no estimates, benchmarks or multipliers).
   Opened straight from a scan via /prices/?barcode=. Private notes & basket stay on the device and are never shown as store prices. */
const I18N = {
  el: {
    skip:'Μετάβαση στις συγκρίσεις',logoSuffix:'/ Τιμές',brandFoot:'FoodScan Τιμές',nutrition:'Διατροφή',scan:'Σάρωση',saved:'Αποθηκευμένα',scanFood:'Σάρωση',eyebrow:'ΠΡΑΓΜΑΤΙΚΑ ΔΕΔΟΜΕΝΑ · ΗΜΕΡΟΜΗΝΙΕΣ · ΕΛΛΑΔΑ',
    hero:'Τρώτε καλύτερα.<br><em>Ξοδεύετε λιγότερα.</em>',intro:'Σαρώστε ένα προϊόν και συγκρίνετε καταγεγραμμένες τιμές σε ελληνικά καταστήματα, με πηγή και ημερομηνία. Χωρίς επινοημένες τιμές.',
    barcode:'Ταύτιση barcode',verified:'Πηγές και ημερομηνίες',basket:'Έξυπνο καλάθι',clarity:'Κάθε τιμή έχει ιστορία.',claritySub:'Πού · Πότε · Με ποιους όρους',
    compare:'Σύγκριση τιμών',myBasket:'Το καλάθι μου',private:'Το καλάθι και οι σημειώσεις μένουν στη συσκευή σας',
    findCode:'Πληκτρολογήστε το barcode του προϊόντος',search:'Εύρεση τιμών',searchHelp:'Χρησιμοποιήστε το barcode της συσκευασίας ή',openScanner:'σαρώστε το στο FoodScan',
    scope:'Περιοχή αναζήτησης',scopeHelp:'Αρχικά όλη η Ελλάδα· κοντινά καταστήματα μόνο με άδειά σας.',nearby:'Κοντά μου',allGreece:'Όλη η Ελλάδα',
    ready:'Η επόμενη σάρωση μπορεί να σας εξοικονομήσει χρήματα.',readySub:'Εισαγάγετε έγκυρο barcode για διαθέσιμες καταγραφές τιμών και σύγκριση καταστημάτων.',
    notes:'Οι δικές μου τιμές',notesCaveat:'Ιδιωτικές καταγραφές που εισάγατε εσείς, όχι επαληθευμένες τιμές καταστημάτων.',noteEntry:'Αποθήκευση τιμής που είδα σε κατάστημα',notePrivacy:'Αποθηκεύεται μόνο στη συσκευή σας και δεν παρουσιάζεται ως επαληθευμένη τιμή.',
    store:'Σούπερ μάρκετ',pickStore:'Επιλέξτε κατάστημα',amount:'Τιμή (€) ανά τεμάχιο',date:'Ημερομηνία',saveNote:'Αποθήκευση σημείωσης',
    basketEyebrow:'ΟΡΓΑΝΩΣΗ ΑΓΟΡΩΝ',basketTitle:'Το καλάθι αγορών σας',basketSub:'Προσθέστε σαρωμένα προϊόντα. Τα ολικά ποσά συγκρίνονται μόνο στο ίδιο φυσικό κατάστημα, όχι μεταξύ υποκαταστημάτων.',
    export:'Εξαγωγή λίστας',
    backFood:'Διατροφικό FoodScan',all:'Όλη η Ελλάδα',invalid:'Το barcode δεν έχει έγκυρο μήκος ή ψηφίο ελέγχου.',searching:'Αναζήτηση πραγματικών καταγραφών…',
    noPrice:'Δεν βρέθηκαν κατάλληλες πρόσφατες τιμές',noPriceSub:'Δεν υπάρχουν διαθέσιμες επιβεβαιωμένες καταγραφές για αυτό το barcode στην περιοχή σας. Δεν σημαίνει πως το προϊόν δεν πωλείται.',
    onlyHistoric:'Βρέθηκαν μόνο παλαιότερες καταγραφές',onlyHistoricSub:'Οι παλιές τιμές παρουσιάζονται για ενημέρωση, όχι ως σημερινές τιμές στο ράφι.',
    serviceDown:'Δεν ήταν δυνατή η ανάκτηση τιμών',serviceDownSub:'Δεν υπάρχουν διαθέσιμες αξιόπιστες απαντήσεις αυτή τη στιγμή. Η σάρωση τροφίμων συνεχίζει να λειτουργεί.',
    backendMissing:'Η υπηρεσία τιμών δεν έχει εγκατασταθεί σωστά',backendMissingSub:'Το Cloudflare συνεχίζει να δρομολογεί τις τιμές σε παλιό Worker ή λανθασμένη εγκατάσταση. Χρειάζεται να ενεργοποιηθεί η νέα υπηρεσία τιμών στον διακομιστή. Το «Δοκιμάστε ξανά» δεν διορθώνει τη ρύθμιση.',
    publicFallback:'Εναλλακτική πρόσβαση στο Open Prices',publicFallbackSub:'Η εφαρμογή διαβάζει απευθείας τις δημόσιες καταγραφές Open Prices. Οι εταιρικές ροές τιμών δεν είναι διαθέσιμες έως ότου ενημερωθεί ο διακομιστής FoodScan.',
    unavailableDirect:'Η απευθείας πρόσβαση στην ανοικτή πηγή απέτυχε επίσης (σύνδεση ή δικαιώματα browser).',rateLimited:'Έχουν γίνει πάρα πολλά αιτήματα. Δοκιμάστε ξανά σε λίγο.',proofImage:'Αποδεικτικό εικόνας',
    findOfficial:'Ελέγξτε το PosoKanei',recent:'Πρόσφατες καταγραφές',retailers:'Αλυσίδες/πωλητές',locations:'Σημεία πώλησης',
    latest:'Χαμηλότερη πρόσφατη καταγραφή',notCheckout:'Η χαμηλότερη καταγραφή δεν εγγυάται τη σημερινή τιμή στο ταμείο.',offerList:'Καταγραφές ανά κατάστημα',offerDetails:'Ίδιο barcode · Αναγνωρισμένο κατάστημα · Ημερομηνία παρατήρησης',
    observed:'Καταγραφή',recentTag:'Πρόσφατη',olderTag:'Παλαιότερη',historicTag:'Ιστορική',feedTag:'Δεδομένα προμηθευτή',
    promo:'Προσφορά',loyalty:'Απαιτείται κάρτα/ποσότητα',item:'ανά τεμάχιο',kg:'ανά κιλό',l:'ανά λίτρο',unknown:'άγνωστη μονάδα',
    add:'Προσθήκη στο καλάθι',added:'Προστέθηκε στο καλάθι',inBasket:'Στο καλάθι',noQualified:'Δεν υπάρχουν πρόσφατες συγκρίσιμες καταγραφές. Οι παλιές τιμές δεν συνυπολογίζονται.',
    source:'Πηγή',check:'Δείτε την πηγή',openReport:'Διατροφικό προφίλ',permissionDenied:'Δεν δόθηκε πρόσβαση στην τοποθεσία. Συνεχίζουμε για όλη την Ελλάδα.',
    outsideGR:'Η κοντινή σύγκριση λειτουργεί μόνο για τοποθεσίες στην Ελλάδα.',nearScope:'Κοντά μου (25 χλμ.)',personalSaved:'Αποθηκεύτηκε μόνο στη συσκευή σας.',notSaved:'Η αποθήκευση δεν είναι διαθέσιμη σε αυτή τη συσκευή.',
    noBasket:'Δεν υπάρχουν προϊόντα στο καλάθι.',noBasketSub:'Σαρώστε ένα προϊόν, ανοίξτε τη σύγκριση τιμών και επιλέξτε Προσθήκη στο καλάθι.',
    remove:'Αφαίρεση',checkBasket:'Έλεγχος τιμών καλαθιού',basketCoverage:'Τιμές ανά πραγματικό κατάστημα',basketCoverageSub:'Μόνο διαθέσιμες, πρόσφατες καταγραφές ανά τεμάχιο. Οι προσφορές με ειδικούς όρους εξαιρούνται.',
    complete:'Πλήρες καλάθι',partial:'Ελλιπή δεδομένα',coverage:'Κάλυψη',covered:'προϊόντα',missing:'Χωρίς τιμή',
    priceIndicative:'Ενδεικτικό σύνολο καταγραφών, όχι τελική τιμή αγοράς.',noComplete:'Κανένα κατάστημα δεν έχει ακόμη πρόσφατες τιμές για όλα τα προϊόντα. Δεν επιλέγουμε αυθαίρετα «φθηνότερο καλάθι».',
    noteNeeded:'Πρώτα αναζητήστε έγκυρο barcode.',noteBad:'Συμπληρώστε έγκυρη τιμή, ημερομηνία και σούπερ μάρκετ.',today:'Σήμερα',openBasket:'Προβολή καλαθιού',
    providersDown:'Η υπηρεσία ανοικτών τιμών είναι προσωρινά μη διαθέσιμη.',licensedMissing:'Δεν έχει συνδεθεί ακόμη αδειοδοτημένη ροή ελληνικών καταστημάτων.',
    historyTitle:'Παλαιότερες παρατηρήσεις',network:'Ελληνικές αλυσίδες σούπερ μάρκετ',available:'Πρόσφατη καταγραφή σε κατάστημα',notAvailable:'Χωρίς επιβεβαιωμένη πρόσφατη τιμή',conflict:'Διαφορετικές καταγραφές την ίδια ημέρα — δεν συμμετέχει στην κατάταξη',limited:'Παρουσιάζεται μόνο η πρώτη σελίδα του παρόχου. Μπορεί να λείπουν καταγραφές.',tryAgain:'Δοκιμάστε ξανά',noOrigin:'Χωρίς προσδιορισμένη τιμή ανά τεμάχιο',
    expiredTag:'Έληξε',cheapestTag:'Φθηνότερη',priceEyebrow:'ΤΙΜΗ ΣΤΗΝ ΕΛΛΑΔΑ',cheapestNow:'Φθηνότερη τρέχουσα τιμή',currentOf:'Τρέχουσες τιμές',spread:'Διαφορά',na:'Μη διαθέσιμη',lastSeen:'Τελευταία καταγραφή',notCurrent:'όχι τρέχουσα τιμή',
    offerSub:'Από τη φθηνότερη · Καταγραφές έως 30 ημερών · Με πηγή και ημερομηνία',yourNote:'Η σημείωσή σας',partialSources:'Κάποιες πηγές τιμών δεν απάντησαν. Όσα βλέπετε προέρχονται από τις υπόλοιπες· μπορεί να λείπουν τιμές.',partialNone:'Κάποιες πηγές τιμών δεν απάντησαν και οι υπόλοιπες δεν έχουν τιμή για αυτό το barcode. Δοκιμάστε ξανά σε λίγο.',sourcesTitle:'Πηγές που ελέγχθηκαν',st_ok_with_data:'απάντησε · με τιμές',st_ok_empty:'απάντησε · χωρίς τιμή',st_unavailable:'δεν απάντησε',st_disabled:'μη ενεργή',notesTitle:'Οι σημειώσεις σας',notesSub:'Ιδιωτικές, μόνο σε αυτή τη συσκευή. Δεν μετρούν στο φθηνότερο, στην κάλυψη ή στο σύνολο του καλαθιού.',notesNone:'Δεν έχετε σημειώσεις για αυτά τα προϊόντα.',historySub:'Πάνω από 30 ημέρες. Για ενημέρωση μόνο, δεν συμμετέχουν στη σύγκριση.',
    elsewhereTitle:'Τιμές εκτός Ελλάδας',elsewhereSub:'Καταγραφές του ίδιου barcode σε άλλες χώρες (π.χ. Κύπρος). Μόνο για αναφορά· δεν είναι ελληνικές τιμές ραφιού.',shelfTag:'Ετικέτα ραφιού',receiptTag:'Απόδειξη',cardTag:'Τιμή με κάρτα',condTag:'Με όρους',cardNow:'Τρέχουσα τιμή με κάρτα',condNow:'Τρέχουσα τιμή με όρους',regular:'Κανονική τιμή',noUncond:'Δεν υπάρχει τρέχουσα τιμή χωρίς όρους',
    saveOther:'Σημειώστε τη δική σας τιμή',entryTooLong:'Το καλάθι δέχεται έως 20 προϊόντα.',
    obsShort:'Παρατηρητήριο',packResolved:(x,n,y)=>'Μέγεθος '+x+': συμφωνούν '+n+' ανεξάρτητες πηγές για αυτόν τον κωδικό (καταστήματα ή Παρατηρητήριο Τιμών)'+(y?' (το Open Food Facts γράφει '+y+')':'')+'. Οι τιμές ανά μονάδα υπολογίζονται για '+x+'.',otherSizeTitle:'Ίδιο προϊόν, άλλη συσκευασία',otherSizeSub:'Το κατάστημα πουλά αυτόν τον κωδικό σε άλλο μέγεθος από αυτό της ετικέτας. Η τιμή δείχνεται με τη δική της τιμή μονάδας και δεν συγκρίνεται ως η φθηνότερη.',otherSizeTag:x=>'Άλλη συσκευασία: '+x,packUnconfTag:'Μέγεθος μη επιβεβαιωμένο',outOfStockTag:'Μη διαθέσιμο online',extraOfferTag:'Υπάρχει και προσφορά πολλαπλής αγοράς',liveTag:'Επιβεβαιώθηκε τώρα στο e-shop',addPrice:'📷 Πρόσθεσε τιμή',webTag:'Τιμή e-shop αλυσίδας',fetchedTag:'Ανάγνωση',changedTag:(a,b)=>'Άλλαξε από '+a+' σε '+b,autoMatch:'αυτόματη ακριβής αντιστοίχιση',reviewedMatch:'ελεγμένη αντιστοίχιση',shopperOn:d=>'Αναφέρθηκε από καταναλωτή στις '+d,obsTag:'Επίσημη τιμή αλυσίδας',ekTag:'Ιστορικό καλάθι',nationalTag:'Πανελλαδική τιμή αλυσίδας',dataFile:'Αρχείο δεδομένων',footer:'Τιμές: Παρατηρητήριο Τιμών του Υπουργείου Ανάπτυξης (posokanei.gov.gr, πανελλαδικές τιμές αλυσίδων, μόνο για barcode που έχουν ελεγχθεί), τιμές e-shop από bazaar-online.gr και lidl.gr (με ώρα ανάγνωσης· Lidl: προεπιλεγμένη περιοχή), e-katanalotis (παλαιότερες τιμές, ως ιστορικό) και Open Prices / Open Food Facts (ODbL). Ελέγξτε την τιμή στο ράφι, τις προσφορές και τη διαθεσιμότητα πριν την αγορά.',
  },
};
const EN = {
  expiredTag:'Expired',cheapestTag:'Cheapest',priceEyebrow:'PRICE IN GREECE',cheapestNow:'Cheapest current price',currentOf:'Current prices',spread:'Spread',na:'Not available',lastSeen:'Last seen',notCurrent:'not a current price',
  offerSub:'Cheapest first · Observed within 30 days · Source and date for each',yourNote:'Your note',partialSources:'Some price sources did not answer. What you see comes from the others; prices may be missing.',partialNone:'Some price sources did not answer, and the others have no price for this barcode. Try again shortly.',sourcesTitle:'Sources checked',st_ok_with_data:'answered · prices found',st_ok_empty:'answered · no price',st_unavailable:'did not answer',st_disabled:'not enabled',notesTitle:'Your notes',notesSub:'Private, on this device only. Never counted in the cheapest price, basket coverage or totals.',notesNone:'You have no notes for these products.',historySub:'Older than 30 days. Shown for context only, never compared as current.',
  elsewhereTitle:'Prices outside Greece',elsewhereSub:'The same barcode observed in other countries (e.g. Cyprus). Reference only, not Greek shelf prices.',shelfTag:'Shelf label',receiptTag:'Receipt',cardTag:'Card price',condTag:'With conditions',cardNow:'Current card price',condNow:'Current price with conditions',regular:'Regular price',noUncond:'No current price without conditions on record',
  all:'All Greece', invalid:'The barcode has an invalid length or check digit.',searching:'Looking up real price observations…',
  compare:'Compare prices',noPrice:'No qualifying recent prices found',noPriceSub:'No verified observations are currently available for this barcode in the selected area. That does not mean the product is not sold.',
  onlyHistoric:'Only older observations found',onlyHistoricSub:'Past prices are shown as history, not as today’s shelf prices.',serviceDown:'Price information could not be retrieved',serviceDownSub:'No reliable prices could be retrieved. The nutrition scanner and saved products still work.',
  backendMissing:'The price backend has not been deployed',backendMissingSub:'This Cloudflare hostname is still routing price requests to the wrong Worker or an outdated deployment. A correct server-side pricing service must be deployed. Retrying alone will not fix the configuration.',
  publicFallback:'Public Open Prices fallback',publicFallbackSub:'Reading observed prices directly from the public Open Prices API. Licensed supermarket feeds are unavailable until FoodScan’s price backend is updated.',
  unavailableDirect:'Direct access to Open Prices also failed (network or browser permissions).',rateLimited:'Too many requests. Try again shortly.',proofImage:'View evidence photo',findOfficial:'Check PosoKanei',
  recent:'Recent observations',retailers:'Retailers',locations:'Store locations',latest:'Lowest recently observed',notCheckout:'The lowest observed price is not a guaranteed checkout price.',
  offerList:'Observations by shop',offerDetails:'Same barcode · Identified store · Dated observation',
  observed:'Observed',recentTag:'Recent',olderTag:'Older',historicTag:'Historical',feedTag:'Licensed feed',promo:'Promotion',loyalty:'Loyalty/quantity conditions',
  item:'per item',kg:'per kg',l:'per litre',unknown:'unit not established',add:'Add to basket',added:'Added to your basket',inBasket:'In basket',
  noQualified:'No recent comparable prices. Historical observations are excluded from cheapest-price comparisons.',
  network:'Greek supermarket chains',available:'Recently observed at a store',notAvailable:'No verified recent price',conflict:'Conflicting same-day observations — excluded from ranking',limited:'Only the provider’s first page is loaded. Some observations may be missing.',source:'Source',check:'View evidence',openReport:'Nutrition report',permissionDenied:'Location permission was not granted. Keeping the country-wide view.',outsideGR:'Nearby comparison is currently available only within Greece.',nearScope:'Nearby (25 km)',personalSaved:'Saved privately on this device.',notSaved:'Local storage is unavailable on this device.',
  noBasket:'Your basket is empty',noBasketSub:'Scan a product, open its price comparison and select Add to basket.',remove:'Remove',checkBasket:'Check basket prices',basketCoverage:'Real-store basket coverage',basketCoverageSub:'Only recent, comparable per-item prices. Conditional loyalty and quantity promotions are excluded.',
  complete:'Complete basket',partial:'Incomplete data',coverage:'Coverage',covered:'items',missing:'No price for',priceIndicative:'Indicative observed total, not a checkout guarantee.',
  packResolved:(x,n,y)=>'Size '+x+': '+n+' independent sources agree for this barcode (shops or the price observatory)'+(y?' (Open Food Facts says '+y+')':'')+'. Unit prices use '+x+'.',otherSizeTitle:'Same product, other size',otherSizeSub:'The shop sells this barcode as a different size from the label. Shown with its own unit price; never compared as the cheapest.',otherSizeTag:x=>'Other size: '+x,packUnconfTag:'Size not confirmed',outOfStockTag:'Out of stock online',extraOfferTag:'A multi-buy offer also exists',liveTag:'Confirmed on the web shop just now',noComplete:'No single store has comparable recent prices for all items. FoodScan will not invent a “cheapest basket.”',noteNeeded:'Look up a valid barcode first.',noteBad:'Enter a valid price, date and supermarket.',today:'Today',openBasket:'Open basket',providersDown:'Open Prices is temporarily unavailable.',licensedMissing:'No licensed Greek supermarket price feed is connected yet.',historyTitle:'Older observations',tryAgain:'Try again',noOrigin:'Unknown per-item basis',saveOther:'Record my own price',entryTooLong:'Your basket holds up to 20 items.',obsShort:'Observatory',addPrice:'📷 Add a price',webTag:'Chain web-shop price',fetchedTag:'Read',changedTag:(a,b)=>'Changed from '+a+' to '+b,autoMatch:'automatic exact match',reviewedMatch:'reviewed match',shopperOn:d=>'Reported by a shopper on '+d,obsTag:'Official chain price',ekTag:'Historical basket',nationalTag:'National chain price',dataFile:'Data file'
};
/* v80: price-first states. Recorded prices keep their dates; an estimate is a separate, labelled object. */
Object.assign(EN,{
  footer:'Recorded prices: the Ministry of Development price observatory (posokanei.gov.gr, national chain prices, linked to barcodes by exact or name-and-size matching), the Bazaar and Lidl web shops (re-read on every scan when they answer), e-katanalotis (older prices, shown as history) and Open Prices by Open Food Facts (ODbL). Estimates are labelled and are not recorded prices. Confirm shelf prices, discounts and availability before purchasing.',
  offerSub:'Cheapest first · Recorded in the last 7 days · Source and date for each',
  lastTitle:'Last recorded price',estTitle:'Estimated shelf price',estBadge:'Estimate',estRough:'Rough estimate',notRecorded:'Not a recorded price',estNone:'No price is on record for this exact barcode.',
  estBasis:n=>`Based on ${n} similar products with recorded Greek prices`,estBasisType:n=>`Based on ${n} products of the same type with recorded Greek prices`,estPer:(a,b)=>`about ${a}${b}`,perPack:'for this pack',
  how:'How is this estimated?',howBody:'The name, brand and pack size are compared with products that have a recorded Greek price (Ministry of Development price observatory and chain web shops). The range comes from the measured error of this method on products whose price is known.',
  estValid:(m,n)=>`On ${n} products with known prices the typical error was ${m}%.`,sim:'match',
  estKinds:{close:'Very similar products',similar:'Similar products',broad:'Broadly similar products',rough:'Rough estimate: few close matches',typical:'Rough estimate: typical for this kind of product'},
  agePill:a=>`Recorded ${a}`,staleNote:a=>`Recorded ${a}: it may have changed. Check the shelf.`,
  noPrice:'No verified price for this barcode',noPriceSub:'No supermarket price is on record for it yet. FoodScan does not guess prices. That does not mean it is not sold. You can add a price you saw.',relHead:'Recorded prices of the closest products · not this product',
  onlyHistoric:'No recent price, only older records',onlyHistoricSub:'Older recorded prices are listed with their dates. They may have changed.',
  chainsHead:'Chains with a recorded price',chainsNone:'No recorded price at:'});
Object.assign(I18N.el,{
  footer:'Καταγεγραμμένες τιμές: Παρατηρητήριο Τιμών του Υπουργείου Ανάπτυξης (posokanei.gov.gr, πανελλαδικές τιμές αλυσίδων, συνδεδεμένες με barcode μέσω ακριβούς αντιστοίχισης ονόματος και συσκευασίας), e-shop των bazaar-online.gr και lidl.gr (ξαναδιαβάζονται σε κάθε σάρωση όταν απαντούν), e-katanalotis (παλαιότερες τιμές, ως ιστορικό) και Open Prices / Open Food Facts (ODbL). Οι εκτιμήσεις επισημαίνονται και δεν είναι καταγεγραμμένες τιμές. Ελέγξτε την τιμή στο ράφι, τις προσφορές και τη διαθεσιμότητα πριν την αγορά.',
  offerSub:'Από τη φθηνότερη · Καταγραφές των τελευταίων 7 ημερών · Με πηγή και ημερομηνία',
  lastTitle:'Τελευταία καταγεγραμμένη τιμή',estTitle:'Εκτιμώμενη τιμή ραφιού',estBadge:'Εκτίμηση',estRough:'Πρόχειρη εκτίμηση',notRecorded:'Όχι καταγεγραμμένη τιμή',estNone:'Δεν υπάρχει καταγεγραμμένη τιμή για αυτό ακριβώς το barcode.',
  estBasis:n=>`Βάσει ${n} παρόμοιων προϊόντων με καταγεγραμμένη τιμή στην Ελλάδα`,estBasisType:n=>`Βάσει ${n} προϊόντων του ίδιου είδους με καταγεγραμμένη τιμή στην Ελλάδα`,estPer:(a,b)=>`περίπου ${a}${b}`,perPack:'για αυτή τη συσκευασία',
  how:'Πώς γίνεται η εκτίμηση;',howBody:'Συγκρίνουμε το όνομα, τη μάρκα και τη συσκευασία με προϊόντα που έχουν καταγεγραμμένη ελληνική τιμή (Παρατηρητήριο Τιμών του Υπουργείου Ανάπτυξης και e-shop αλυσίδων). Το εύρος προκύπτει από το μετρημένο σφάλμα της μεθόδου σε προϊόντα με γνωστή τιμή.',
  estValid:(m,n)=>`Σε ${n} προϊόντα με γνωστή τιμή το τυπικό σφάλμα ήταν ${m}%.`,sim:'ομοιότητα',
  estKinds:{close:'Πολύ παρόμοια προϊόντα',similar:'Παρόμοια προϊόντα',broad:'Σχετικά παρόμοια προϊόντα',rough:'Πρόχειρη εκτίμηση: λίγα κοντινά προϊόντα',typical:'Πρόχειρη εκτίμηση: τυπική τιμή για αυτό το είδος προϊόντος'},
  agePill:a=>`Καταγράφηκε ${a}`,staleNote:a=>`Καταγράφηκε ${a} και ίσως έχει αλλάξει. Ελέγξτε στο ράφι.`,
  noPrice:'Δεν βρέθηκε επαληθευμένη τιμή',noPriceSub:'Δεν υπάρχει ακόμη καταγεγραμμένη τιμή σούπερ μάρκετ για αυτό το barcode. Το FoodScan δεν μαντεύει τιμές. Δεν σημαίνει ότι το προϊόν δεν πωλείται. Μπορείτε να προσθέσετε μια τιμή που είδατε.',relHead:'Καταγεγραμμένες τιμές των πιο κοντινών προϊόντων · όχι αυτού του προϊόντος',
  onlyHistoric:'Δεν υπάρχει πρόσφατη τιμή, μόνο παλαιότερες καταγραφές',onlyHistoricSub:'Οι παλαιότερες καταγεγραμμένες τιμές εμφανίζονται με τις ημερομηνίες τους. Ίσως έχουν αλλάξει.',
  chainsHead:'Αλυσίδες με καταγεγραμμένη τιμή',chainsNone:'Χωρίς καταγεγραμμένη τιμή σε:'});
const STORES={ab:'AB Βασιλόπουλος',sklavenitis:'Σκλαβενίτης',lidl:'Lidl',mymarket:'My market',masoutis:'Μασούτης',kritikos:'Κρητικός',galaxias:'Γαλαξίας',marketin:'Market In',synka:'ΣΥΝΚΑ',chalkiadakis:'Χαλκιαδάκης',bazaar:'Bazaar'};
const BASKET_STORAGE='foodscan:price-basket:v65',NOTES_STORAGE='foodscan:price-notes:v65';
const $=id=>document.getElementById(id);
const h=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const safeCode=s=>/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(String(s))&&!/^0+$/.test(String(s))&&validGTIN(String(s));
function validGTIN(s){let n=0;for(let i=s.length-2,w=3;i>=0;i--,w=4-w)n+=Number(s[i])*w;return (10-n%10)%10===Number(s.at(-1));}
function loadStorage(key){try{const v=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(v)?v:[];}catch{return [];}}
function saveStorage(key,obj){try{localStorage.setItem(key,JSON.stringify(obj));return true;}catch{return false;}}
const state={lang:/^el\b/i.test(navigator.language||'')?'el':'en',code:'',name:'',data:null,near:null,basket:loadStorage(BASKET_STORAGE).filter(x=>safeCode(x.barcode)&&Number.isInteger(x.quantity)&&x.quantity>=1&&x.quantity<=99).slice(0,20),notes:loadStorage(NOTES_STORAGE).filter(x=>safeCode(x.barcode)&&Object.hasOwn(STORES,x.store)&&typeof x.price==='number'&&x.price>0).slice(-300),pricing:new Map(),loading:false,basketLoading:false};
function T(key){return state.lang==='el'?(I18N.el[key]??EN[key]??key):(EN[key]??key);}
const euro=n=>new Intl.NumberFormat(state.lang==='el'?'el-GR':'en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:2}).format(n);
const stamp=s=>{try{return new Intl.DateTimeFormat(state.lang==='el'?'el-GR':'en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Athens'}).format(new Date(s));}catch{return '';}};
const day=s=>{try{return new Intl.DateTimeFormat(state.lang==='el'?'el-GR':'en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(s+'T00:00:00Z'));}catch{return s;}};
const todayISO=()=>{const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Europe/Athens'}).formatToParts(new Date()).map(p=>[p.type,p.value]));return `${parts.year}-${parts.month}-${parts.day}`;};
function toast(s){const el=$('fpToast');el.textContent=s;el.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.hidden=true,4000);}
function setLang(lang){state.lang=lang;document.documentElement.lang=lang;document.querySelectorAll('[data-i18n]').forEach(el=>{const key=el.dataset.i18n,text=I18N.el[key];if(el.dataset.defaultText===undefined)el.dataset.defaultText=el.innerHTML;if(lang==='el'&&text){if(key==='hero')el.innerHTML=text;else el.textContent=text;}else el.innerHTML=el.dataset.defaultText;});
  $('fpLang').textContent=lang==='el'?'EN':'ΕΛ';$('fpLocationLabel').textContent=state.near?T('nearScope'):T('all');document.title=lang==='el'?'FoodScan Τιμές · Σύγκριση σούπερ μάρκετ':'FoodScan Prices · Greek supermarket comparison';document.body.classList.toggle('fp-has-code',Boolean(state.code));
  if(state.data)renderResult();renderNotes();renderBasket();if(state.pricing.size)renderBasketResults();}
function setTab(tab){const basket=tab==='basket';$('fpComparePane').hidden=basket;$('fpBasketPane').hidden=!basket;$('fpTabCompare').classList.toggle('is-active',!basket);$('fpTabBasket').classList.toggle('is-active',basket);$('fpTabCompare').setAttribute('aria-pressed',String(!basket));$('fpTabBasket').setAttribute('aria-pressed',String(basket));if(basket){renderBasket();if(state.pricing.size)renderBasketResults();}window.scrollTo({top:0,behavior:'instant'});}
async function jsonFetch(url,timeout=10500,options={}){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeout);
 try{
  let response;
  try{response=await fetch(url,{signal:ctrl.signal,headers:{Accept:'application/json'},credentials:'same-origin',...options});}
  catch(error){const e=new Error('same_origin_network');e.issue=error?.name==='AbortError'?'timeout':'network';throw e;}
  let data=null;
  try{data=await response.json();}catch{if(response.ok){const e=new Error('invalid_json');e.issue='missing_route';throw e;}}
  if(!response.ok){const e=new Error(data?.error||'http_'+response.status);e.httpStatus=response.status;e.issue=response.status===404?'missing_route':response.status===429?'rate_limited':'server_error';throw e;}
  return data;
 }finally{clearTimeout(timer);}
}

// One shared client (price-client-v72): FoodScan's price service first, Open Prices directly if it cannot answer.
const keyOf=code=>state.near?`${code}@${state.near.lat},${state.near.lon}`:code;
function freshPriceData(code){return state.pricing.get(keyOf(code))||null;}
async function getPrices(code,{refresh=false}={}){
 const cached=freshPriceData(code);if(!refresh&&cached&&Date.now()-cached.at<10*60*1000)return cached.data;
 const data=await fetchPrices(code,{fresh:refresh,near:state.near});
 // 78: a partial answer (a source down) is shown but not kept, so the next look asks again.
 if(data.status!=='temporarily_unavailable'&&data.status!=='incomplete')state.pricing.set(keyOf(code),{at:Date.now(),data});
 else state.pricing.delete(keyOf(code));
 return data;
}

let searchRevision=0;
async function lookup(code,{refresh=false}={}){
  if(!safeCode(code)){toast(T('invalid'));return;}
  const revision=++searchRevision;
  if(state.code!==code)state.name=state.basket.find(x=>x.barcode===code)?.name||'';
  state.code=code;document.body.classList.add('fp-has-code');$('fpCode').value=code;state.data=null;$('fpResult').innerHTML=`<div class="fp-loading"><span class="fp-spinner"></span>${h(T('searching'))}</div>`;
  const u=new URL(location.href);u.searchParams.set('barcode',code);history.replaceState({},'',u.pathname+u.search);
  $('fpSubmit').disabled=true;state.loading=true;
  try{const result=await getPrices(code,{refresh});if(revision!==searchRevision)return;state.data=result;if(!state.name&&(result.product?.name||result.productName))state.name=String(result.product?.name||result.productName).slice(0,120);renderResult();void enrichProductName(code);}
  catch(err){if(revision!==searchRevision)return;state.data={status:'temporarily_unavailable',offers:[],elsewhere:[],providers:{}};renderResult();void enrichProductName(code);}
  finally{if(revision===searchRevision){state.loading=false;$('fpSubmit').disabled=false;renderNotes();}}
}

function packText(p){const a=Number(p?.amount);if(!(a>0))return '';const u=p.unit==='l'?(a<1?[Math.round(a*1000),'ml']:[a,'L']):(a<1?[Math.round(a*1000),'g']:[a,'kg']);return String(u[0]).replace('.',state.lang==='el'?',':'.')+' '+u[1];}
function srcShort(o){return String(o.id||'').startsWith('pk:')?T('obsShort'):String(o.id||'').startsWith('bz:')?'bazaar-online.gr':String(o.id||'').startsWith('li:')?'lidl.gr':String(o.id||'').startsWith('kr:')?'kritikos-sm.gr':String(o.id||'').startsWith('ek:')?'e-katanalotis':o.sourceKind==='community'?'Open Prices':o.source||'';}
function priceTag(o){const k=o.freshness==='current'?'recentTag':o.freshness==='older'?'olderTag':o.freshness==='expired'?'expiredTag':'historicTag';return `<span class="fp-tag ${o.freshness==='current'?'fp-tag--good':'fp-tag--past'}">${h(T(k))}</span>`;}
function showPrice(o,delta=null){const reg=o.regularPrice&&o.regularPrice>o.price?`<s class="fp-was">${euro(o.regularPrice)}</s>`:'';
  return `<div class="fp-offer__price">${reg}${euro(o.price)}<div class="fp-offer__basis">${o.unitPrice!=null&&o.basis==='item'?h(unitText(o,state.lang)):h(T(o.basis)||T('unknown'))}</div>${delta!=null?`<div class="fp-offer__delta">${delta>0?'+'+euro(delta):h(T('cheapestTag'))}</div>`:''}</div>`;}
function heroCard(data){
  const b=data.best,L=state.lang,link=`<a class="fp71__all" href="/#/p/${encodeURIComponent(state.code)}">${h(T('openReport'))}</a>`;
  const head=`<header class="fp71__head"><span class="fp71__eyebrow">€ ${h(T('priceEyebrow'))}</span>`;
  if(b)return `<section class="fp71 fp71--page">${head}<span class="fp71__pill fp71__pill--current">${h(T('recentTag'))}</span></header><div class="fp71__main"><div class="fp71__price"><small>${h(b.conditional?T(b.conditional==='LOYALTY_PROGRAM'?'cardNow':'condNow'):T('cheapestNow'))}</small><strong>${euro(b.price)}</strong>${b.unitPrice!=null?`<em>${h(unitText(b,L))}</em>`:''}</div><div class="fp71__store"><b>${h(b.retailer)}${b.city?' · '+h(b.city):''}</b><span>${h(T('observed'))} ${h(day(b.date))} · ${h(whenText(b,L))}</span><span>${h(b.source)}</span></div></div><p class="fp71__sub">${b.conditional?`${b.regularPrice?`${h(T('regular'))} ${euro(b.regularPrice)} · `:''}${h(T('noUncond'))}`:`${h(T('currentOf'))}: ${data.currentCount} · ${h(T('retailers'))}: ${data.retailerCount}${data.spread>0?` · ${h(T('spread'))} ${euro(data.spread)}`:''}`}</p><div class="fp71__row">${link}</div></section>`;
  const last=data.latest,est=data.estimate;
  // 80: the last recorded price is shown as the price, with its age; an estimate is labelled and never styled as a recorded price.
  if(last)return `<section class="fp71 fp71--page">${head}<span class="fp71__pill fp71__pill--stale">${h(T('agePill')(whenText(last,L)))}</span></header><div class="fp71__main"><div class="fp71__price"><small>${h(T('lastTitle'))}</small><strong>${euro(last.price)}</strong>${last.unitPrice!=null?`<em>${h(unitText(last,L))}</em>`:''}</div><div class="fp71__store"><b>${h(last.retailer)}${last.city?' · '+h(last.city):''}</b><span>${h(T('observed'))} ${h(day(last.date))}</span><span>${h(srcShort(last))}</span></div></div><p class="fp71__sub">${h(T('staleNote')(whenText(last,L)))}</p><div class="fp71__row">${link}</div></section>`;
  if(est)return `<section class="fp71 fp71--page fp80-is-est">${head}<span class="fp71__pill fp80-pill-est">${h(T(est.cls==='D'||est.cls==='E'?'estRough':'estBadge'))}</span></header><div class="fp71__main"><div class="fp71__price fp80-est"><small>${h(T('estTitle'))}</small><strong>${h(estRange(est))}</strong><em>${h(T('estPer')(euro(est.unitMid),coreT(L,est.unit)))}${est.pack?' · '+h(T('perPack')):''}</em></div><div class="fp71__store"><b>${h(T('notRecorded'))}</b><span>${h(T('estNone'))}</span><span>${h(T(est.cls==='E'?'estBasisType':'estBasis')(est.n))}</span></div></div><p class="fp71__sub">${h(T('estKinds')[est.kind]||'')}</p>${estWhy(est)}<div class="fp71__row">${link}</div></section>`;
  return `<section class="fp71 fp71--page fp80-is-none">${head}</header><p class="fp71__na">${h(T('noPrice'))}</p><p class="fp71__sub">${h(data.status==='incomplete'?T('partialNone'):T('noPriceSub'))}</p>${relatedHTML(data)}<div class="fp71__row">${link}</div></section>`;
}
// 81: closest products with THEIR OWN recorded prices, labelled as not this product. Never a range, never an estimate.
const relatedHTML=d=>d.related?.length?`<div class="fp81-rel"><p class="fp81-rel__head">${h(T('relHead'))}</p><ul class="fp80-ex">${d.related.map(x=>`<li><span>${h(x.name)}</span><b>${euro(x.price)}</b><small>${h(x.source)} · ${h(day(x.date))}</small></li>`).join('')}</ul></div>`:'';
const estRange=e=>e.pack?`${euro(e.pack[0])} – ${euro(e.pack[2])}`:`${euro(e.unitLow)} – ${euro(e.unitHigh)}${coreT(state.lang,e.unit)}`;
function estWhy(e){const v=e.validation&&e.validation.medianErrorPct!=null&&e.validation.tested?`<p class="fp80-valid">${h(T('estValid')(Math.round(e.validation.medianErrorPct),e.validation.tested))}</p>`:'';
  return `<details class="fp80-why" open><summary>${h(T('how'))}</summary><p>${h(T('howBody'))}</p><ul class="fp80-ex">${(e.examples||[]).map(x=>`<li><span>${h(x.name)}</span><b>${euro(x.price)}</b><small>${h(x.source)} · ${h(day(x.date))} · ${h(T('sim'))} ${x.similarity}%</small></li>`).join('')}</ul>${v}</details>`;}
function renderResult(){const out=$('fpResult'),data=state.data;if(!data)return;
  if(data.status==='temporarily_unavailable'){
    out.innerHTML=`<div class="fp-empty"><span class="fp-empty__mark">↻</span><h2>${h(T('serviceDown'))}</h2><p>${h(T('serviceDownSub'))}</p><button class="fp-btn fp-btn--outline" id="fpRetry" style="margin-top:18px">${h(T('tryAgain'))}</button><p class="fp-muted" style="margin-top:14px"><a href="https://posokanei.gov.gr/" target="_blank" rel="noopener noreferrer">${h(T('findOfficial'))} ↗</a></p></div>`;return;
  }
  const offers=data.offers||[],eligible=offers.filter(o=>o.rankingEligible).sort((a,b)=>a.price-b.price||a.ageDays-b.ageDays);
  // 79: "same product, other size" (and size-unconfirmed) prices are their own labelled list, never mixed with current prices.
  const otherSize=offers.filter(o=>!o.rankingEligible&&(o.tier==='otherSize'||o.tier==='packUnconfirmed'||o.packMismatch)).sort((a,b)=>(a.unitPrice??9e9)-(b.unitPrice??9e9));
  const conditional=offers.filter(o=>!o.rankingEligible&&!otherSize.includes(o)&&o.tier!=='outOfStock'&&o.countryCode==='GR'&&o.freshness==='current'&&o.sourceKind!=='personal').sort((a,b)=>a.price-b.price),others=offers.filter(o=>!o.rankingEligible&&!conditional.includes(o)&&!otherSize.includes(o)).sort((a,b)=>a.ageDays-b.ageDays);
  const name=state.name||data.product?.name||data.productName||'Product '+state.code;
  let html=`<div class="fp-section-head"><div><div class="fp-eyebrow">GTIN ${h(state.code)}${data.product?.quantity?' · '+h(data.product.quantity):''}</div><h2>${h(name)}</h2><p>${h(T('offerDetails'))}</p></div><div class="fp-actions"><a class="fp-btn fp-btn--outline fp-btn--sm" href="/#/p/${encodeURIComponent(state.code)}">${h(T('openReport'))}</a><button type="button" class="fp-btn fp-btn--outline fp-btn--sm" data-addprice>${h(T('addPrice'))}</button><button type="button" class="fp-btn fp-btn--primary fp-btn--sm" data-add="${h(state.code)}">${h(state.basket.some(x=>x.barcode===state.code)?T('inBasket'):T('add'))}</button></div></div>`;
  html+=heroCard(data);
  if(data.packCheck?.resolvedBy&&data.pack)html+=`<div class="fp-alert fp-alert--grey">${h(T('packResolved')(packText(data.pack),data.packCheck.resolvedBy.length,data.packCheck.label?packText(data.packCheck.label):''))}</div>`;
  if(eligible.length){const branches=new Set(eligible.filter(o=>o.storeScope!=='national').map(o=>o.storeId)).size;html+=`<div class="fp-stats"><div class="fp-stat"><b>${eligible.length}</b><small>${h(T('recent'))}</small></div><div class="fp-stat"><b>${data.retailerCount||0}</b><small>${h(T('retailers'))}</small></div>${branches?`<div class="fp-stat"><b>${branches}</b><small>${h(T('locations'))}</small></div>`:''}</div>`;}
  const down=Object.values(data.providers||{}).filter(p=>p&&p.status==='unavailable').length;
  if(down&&offers.length)html+=`<div class="fp-alert">${h(T('partialSources'))}</div>`;
  if(data.transport==='browser_open_prices')html+=`<div class="fp-alert fp-alert--grey">${h(T('publicFallbackSub'))}</div>`;
  if(eligible.length||conditional.length){const low=eligible[0]?.price;html+=`<div class="fp-section-head"><div><h2>${h(T('offerList'))}</h2><p>${h(T('offerSub'))}</p></div></div><div class="fp-offers">`+eligible.map((o,i)=>offerHTML(o,i===0,Math.round((o.price-low)*100)/100)).join('')+conditional.map(o=>offerHTML(o,false)).join('')+'</div>';}
  else if(others.length)html+=`<div class="fp-section-head"><div><h2>${h(T('onlyHistoric'))}</h2><p>${h(T('onlyHistoricSub'))}</p></div></div><div class="fp-offers">${others.slice(0,12).map(o=>offerHTML(o,false)).join('')}</div>`;
  else if(data.status==='incomplete')html+=`<div class="fp-empty"><button class="fp-btn fp-btn--outline" id="fpRetry">${h(T('tryAgain'))}</button></div>`;
  // Every major chain, real data only: current price, or the dated last observation, or "Not available".
  const myCodeNotes=state.notes.filter(n=>n.barcode===state.code);
  const tiles=[],missing=[];
  for(const [id,label] of CHAINS.filter(([id])=>id!=='discount-markt'||offers.some(o=>o.retailerId===id))){
    const cur=eligible.filter(o=>o.retailerId===id)[0]||null,old=cur?null:others.filter(o=>o.retailerId===id&&o.basis==='item').sort((a,b)=>b.date.localeCompare(a.date))[0]||null;
    const note=myCodeNotes.filter(n=>n.store===id).at(-1);
    if(!cur&&!old&&!note){missing.push(label);continue;}
    const main=cur?`<div class="fp-network__found">${euro(cur.price)}</div><small>${h(T('observed'))} ${h(day(cur.date))}${cur.unitPrice!=null?' · '+h(unitText(cur,state.lang)):''}</small><small class="fp-network__src">${h(srcShort(cur))}</small>`
      :old?`<div class="fp-network__last">${euro(old.price)}</div><small>${h(T('lastSeen'))} ${h(day(old.date))} (${h(T(old.freshness==='older'?'olderTag':'historicTag'))})</small><small class="fp-network__src">${h(srcShort(old))}</small>`:'';
    tiles.push(`<div class="fp-network__store${cur?' is-found':''}"><strong>${h(label)}</strong>${main}${note?`<small class="fp-network__note">${h(T('yourNote'))}: ${euro(note.price)} · ${h(day(note.date))}</small>`:''}</div>`);
  }
  html+=`<section class="fp-network">${tiles.length?`<h3>${h(T('chainsHead'))}</h3><div class="fp-network__grid">${tiles.join('')}</div>`:''}${missing.length?`<p class="fp-network__none">${h(T('chainsNone'))} ${missing.map(h).join(' · ')}</p>`:''}</section>`;
  html+=sourcesHTML(data);
  if(otherSize.length)html+=`<details class="fp-note-card fp-othersize"><summary>${h(T('otherSizeTitle'))} (${otherSize.length})</summary><p class="fp-muted">${h(T('otherSizeSub'))}</p><div class="fp-offers" style="margin-top:12px">${otherSize.slice(0,20).map(o=>offerHTML(o,false)).join('')}</div></details>`;
  if(others.length)html+=`<details class="fp-note-card"><summary>${h(T('historyTitle'))} (${others.length})</summary><p class="fp-muted">${h(T('historySub'))}</p><div class="fp-offers" style="margin-top:12px">${others.slice(0,40).map(o=>offerHTML(o,false)).join('')}</div></details>`;
  if(data.elsewhere?.length)html+=`<details class="fp-note-card"><summary>${h(T('elsewhereTitle'))} (${data.elsewhere.length})</summary><p class="fp-muted">${h(T('elsewhereSub'))}</p><div class="fp-offers" style="margin-top:12px">${data.elsewhere.map(o=>offerHTML(o,false)).join('')}</div></details>`;
  html+=`<p class="fp-muted" style="margin-top:17px">${h(T('notCheckout'))} <a href="https://prices.openfoodfacts.org/products/${encodeURIComponent(state.code)}" target="_blank" rel="noopener noreferrer">Open Prices (ODbL) ↗</a> · <a href="https://posokanei.gov.gr/" target="_blank" rel="noopener noreferrer">${h(T('findOfficial'))} ↗</a></p>`;
  out.innerHTML=html;
}
// 78: what each source answered for this barcode, truthfully: answered with prices, answered empty, did not answer, not enabled.
const SOURCE_NAMES={openPrices:'Open Prices',observatory:'posokanei.gov.gr',ekatanalotis:'e-katanalotis',bazaar:'bazaar-online.gr',lidl:'lidl.gr',kritikos:'kritikos-sm.gr',liveDatabase:'FoodScan D1'};
function sourcesHTML(data){const list=Object.entries(data.providers||{}).filter(([id,p])=>p&&SOURCE_NAMES[id]&&typeof p.status==='string');if(!list.length)return '';
  const st=s=>['ok_with_data','ok_empty','unavailable','disabled'].includes(s)?s:'unavailable';
  return `<details class="fp-note-card fp-sources"><summary>${h(T('sourcesTitle'))} (${list.filter(([,p])=>st(p.status)==='ok_with_data').length}/${list.filter(([,p])=>st(p.status)!=='disabled').length})</summary><ul class="fp-sources__list">${list.map(([id,p])=>`<li class="fp-sources__item is-${st(p.status)}"><span class="fp-sources__dot" aria-hidden="true"></span><b>${h(SOURCE_NAMES[id])}</b><span>${h(T('st_'+st(p.status)))}${p.snapshot?' · '+h(day(p.snapshot)):''}</span>${p.license?`<small>${h(p.license)}</small>`:''}</li>`).join('')}</ul></details>`;}
function offerHTML(o,best,delta=null){const url=String(o.sourceURL||'').startsWith('https://')?o.sourceURL:'';
  const name=o.storeName&&o.storeName!==o.retailer?o.retailer+' · '+o.storeName:o.retailer;
  const place=[o.city,o.countryCode&&o.countryCode!=='GR'?o.countryCode:null,o.storeScope==='national'?T('nationalTag'):o.storeScope==='online'?'Online':null].filter(Boolean).join(' · ');
  return `<article class="fp-offer ${best?'fp-offer--good':''}"><div><div class="fp-offer__title">${best?`<span class="fp-tag fp-tag--good">${h(T('cheapestTag'))}</span> `:''}${h(name)}</div><div class="fp-offer__city">${h(place)}</div></div>${showPrice(o,delta)}<div class="fp-offer__meta">${priceTag(o)}${o.conflictingEvidence?`<span class="fp-tag fp-tag--past">${h(T('conflict'))}</span>`:''}${o.packMismatch&&o.observedPack?`<span class="fp-tag fp-tag--past">${h(T('otherSizeTag')(packText(o.observedPack)))}</span>`:''}${o.packUnconfirmed?`<span class="fp-tag fp-tag--past">${h(T('packUnconfTag'))}</span>`:''}${o.available===false?`<span class="fp-tag fp-tag--past">${h(T('outOfStockTag'))}</span>`:''}${o.origin==='live'?`<span class="fp-tag fp-tag--good">${h(T('liveTag'))}</span>`:''}${o.extraOffer?`<span class="fp-tag fp-tag--promo">${h(T('extraOfferTag'))}</span>`:''}<span>${h(T('observed'))}: <strong>${h(day(o.date))}</strong> · ${h(whenText(o,state.lang))}</span>${o.fetchedAt?`<span class="fp-fetched">${h(T('fetchedTag'))}: ${h(stamp(o.fetchedAt))}</span>`:''}${o.priceChange&&o.priceChange.from>0?`<span class="fp-tag ${o.priceChange.to<o.priceChange.from?'fp-tag--good':'fp-tag--past'}">${h(T('changedTag')(euro(o.priceChange.from),euro(o.priceChange.to)))}${o.priceChange.fromDate?' · '+h(day(o.priceChange.fromDate)):''}</span>`:''}${o.discounted?`<span class="fp-tag fp-tag--promo">${h(T('promo'))}${o.offerConditions?' · '+h(T(o.offerConditions==='LOYALTY_PROGRAM'?'cardTag':'loyalty')):''}</span>`:''}<span>${h(o.source)}${o.proofType==='GOV_OBSERVATORY'?' · '+h(T('obsTag')):o.proofType==='GOV_BASKET'?' · '+h(T('ekTag')):o.proofType==='RETAILER_FEED'?' · '+h(T('feedTag')):o.proofType==='RETAILER_WEB'?' · '+h(T('webTag')):o.proofType==='PRICE_TAG'?' · '+h(T('shelfTag')):o.proofType==='RECEIPT'?' · '+h(T('receiptTag')):''}</span>${o.match==='auto-exact'?`<span class="fp-match" title="${h(T('autoMatch'))}">${h(T('autoMatch'))}</span>`:''}${o.sourceKind==='community'&&(o.proofType==='PRICE_TAG'||o.proofType==='RECEIPT')?`<span class="fp-shopper">${h(T('shopperOn')(day(o.date)))}</span>`:''}${url?`<a href="${h(url)}" rel="noopener noreferrer" target="_blank">${h(T('check'))} ↗</a>`:''}${o.evidenceURL&&o.evidenceURL!==url?`<a href="${h(o.evidenceURL)}" rel="noopener noreferrer" target="_blank">${h(T('dataFile'))} ↗</a>`:''}${o.proofURL&&String(o.proofURL).startsWith('https://prices.openfoodfacts.org/img/')?`<a href="${h(o.proofURL)}" rel="noopener noreferrer" target="_blank">${h(T('proofImage'))} ↗</a>`:''}</div></article>`;}
function addToBasket(code,name=''){
  if(!safeCode(code))return;
  const prev=state.basket.find(x=>x.barcode===code);
  if(prev){toast(T('inBasket'));setTab('basket');return;}
  if(state.basket.length>=20){toast(T('entryTooLong'));return;}
  state.basket.push({barcode:code,name:name||state.name||'Product '+code,quantity:1});
  if(!saveStorage(BASKET_STORAGE,state.basket)){state.basket.pop();toast(T('notSaved'));return;}
  toast(T('added'));renderBasket();if(state.data)renderResult();setTab('basket');void enrichProductName(code);
}
const productNames=new Map(),productNameLoading=new Set();
async function enrichProductName(code){
  const item=state.basket.find(x=>x.barcode===code);
  if(productNames.has(code)){const n=productNames.get(code);if(item&&item.name==='Product '+code){item.name=n;saveStorage(BASKET_STORAGE,state.basket);renderBasket();}if(state.code===code&&!state.name){state.name=n;if(state.data)renderResult();}return;}
  if(productNameLoading.has(code)||state.code!==code&&(!item||item.name!=='Product '+code))return;
  productNameLoading.add(code);
  try{const payload=await jsonFetch('/api/product/'+encodeURIComponent(code),4500);const prod=payload.product;
    const name=typeof prod?.product_name==='string'?prod.product_name.trim().slice(0,120):'';
    if(name){productNames.set(code,name);if(item&&item.name==='Product '+code){item.name=name;saveStorage(BASKET_STORAGE,state.basket);renderBasket();}
      if(state.code===code&&!state.name){state.name=name;if(state.data)renderResult();}}}
  catch{}finally{productNameLoading.delete(code);}
}
function renderBasket(){const parent=$('fpBasketList');$('fpBasketCount').textContent=String(state.basket.length);
  if(!state.basket.length){parent.innerHTML=`<div class="fp-empty"><span class="fp-empty__mark">▤</span><h2>${h(T('noBasket'))}</h2><p>${h(T('noBasketSub'))}</p><button type="button" id="fpStartCompare" class="fp-btn fp-btn--primary" style="margin-top:18px">${h(T('compare'))}</button></div>`;$('fpBasketResults').innerHTML='';return;}
  parent.innerHTML=state.basket.map(item=>`<div class="fp-basketrow"><div><b>${h(item.name||'Product '+item.barcode)}</b><small><a href="/prices/?barcode=${encodeURIComponent(item.barcode)}" data-basket-lookup="${h(item.barcode)}">${h(item.barcode)}</a> · <a href="/#/p/${encodeURIComponent(item.barcode)}">${h(T('openReport'))}</a></small></div><div class="fp-qty"><button type="button" aria-label="Decrease" data-minus="${h(item.barcode)}">−</button><span>${item.quantity}</span><button type="button" aria-label="Increase" data-plus="${h(item.barcode)}">+</button></div><button class="fp-icon-btn" type="button" data-remove="${h(item.barcode)}" aria-label="${h(T('remove'))}">×</button></div>`).join('')+
  `<div class="fp-actions" style="margin-top:20px"><button id="fpCheckBasket" class="fp-btn fp-btn--primary" type="button">${h(T('checkBasket'))}</button><button id="fpAddAnother" type="button" class="fp-btn fp-btn--outline">+ ${h(T('add'))}</button></div>`;
}
function bestPerStore(offers){const best=new Map();for(const o of offers||[]){if(!o.rankingEligible||o.basis!=='item')continue;const old=best.get(o.storeId);if(!old||o.price<old.price)best.set(o.storeId,o);}return [...best.values()];}
function renderBasketResults(){const el=$('fpBasketResults');if(!state.basket.length){el.innerHTML='';return;}
  const byStore=new Map();let loaded=0;
  for(const item of state.basket){const data=freshPriceData(item.barcode)?.data;if(!data)continue;loaded++;
    // 78: private notes are NEVER part of the basket: not in the cheapest store, coverage, "complete" or totals (v77 counted them).
    for(const offer of bestPerStore((data.offers||[]).filter(o=>o.sourceKind!=='personal'&&!String(o.id||'').startsWith('note:')))){
      if(!byStore.has(offer.storeId))byStore.set(offer.storeId,{id:offer.storeId,retailer:offer.retailer,storeName:offer.storeName,city:offer.city,storeScope:offer.storeScope,countryCode:offer.countryCode,items:new Map(),cost:0});
      const store=byStore.get(offer.storeId);store.items.set(item.barcode,offer);store.cost+=offer.price*item.quantity;
    }}
  const rows=[...byStore.values()].sort((a,b)=>b.items.size-a.items.size||a.cost-b.cost);
  const complete=rows.filter(x=>x.items.size===state.basket.length),partial=rows.filter(x=>x.items.size<state.basket.length);
  let html=`<div class="fp-section-head"><div><h2>${h(T('basketCoverage'))}</h2><p>${h(T('basketCoverageSub'))}</p></div></div>`;
  if(loaded<state.basket.length)html+=`<div class="fp-alert">${h(T('coverage'))}: ${loaded}/${state.basket.length} GTINs checked. ${h(T('checkBasket'))}.</div>`;
  if(complete.length)html+=`<div class="fp-alert fp-alert--green">${h(T('complete'))} · ${h(T('priceIndicative'))}</div>`;
  else html+=`<div class="fp-alert">${h(T('noComplete'))}</div>`;
  if(!rows.length){el.innerHTML=html+basketNotesHTML();return;}
  for(const row of [...complete,...partial.slice(0,8)]){
    const full=row.items.size===state.basket.length;const missing=state.basket.filter(item=>!row.items.has(item.barcode));
    html+=`<article class="fp-basketstore ${full?'fp-basketstore--complete':''}"><header><div><h3>${h(row.retailer)}${row.storeName&&row.storeName!==row.retailer?' · '+h(row.storeName):''}</h3>${(()=>{const pl=[row.city,row.storeScope==='national'?T('nationalTag'):row.storeScope==='online'?'Online':null].filter(Boolean).join(' · ');return pl?`<small class="fp-muted">${h(pl)}</small> `:''})()}<span class="fp-tag ${full?'fp-tag--good':''}">${h(full?T('complete'):T('partial'))} · ${row.items.size}/${state.basket.length}</span></div><div style="text-align:right"><b>${full?euro(row.cost):'—'}</b><div class="fp-muted">${full?h(T('priceIndicative')):euro(row.cost)+' '+(state.lang==='el'?'μερικό':'partial')}</div></div></header>${missing.length?`<p>${h(T('missing'))}: ${h(missing.map(x=>x.name).join(', '))}</p>`:''}</article>`;
  }
  el.innerHTML=html+basketNotesHTML();
}
/** Your notes for the basket items, shown apart, with no totals. */
function basketNotesHTML(){const codes=new Set(state.basket.map(x=>x.barcode));const latest=new Map();
  for(const n of state.notes)if(codes.has(n.barcode)){const k=n.barcode+'|'+n.store,o=latest.get(k);if(!o||n.date>=o.date)latest.set(k,n);}
  if(!latest.size)return '';
  const name=c=>state.basket.find(x=>x.barcode===c)?.name||c;
  return `<section class="fp-basketnotes" aria-labelledby="fpBasketNotesTitle"><h3 id="fpBasketNotesTitle">${h(T('notesTitle'))}</h3><p class="fp-muted">${h(T('notesSub'))}</p><ul>${[...latest.values()].sort((a,b)=>b.date.localeCompare(a.date)).map(n=>`<li><span><b>${h(name(n.barcode))}</b><small>${h(STORES[n.store]||n.store)} · ${h(day(n.date))}</small></span><span class="fp-basketnotes__price">${euro(n.price)}</span></li>`).join('')}</ul></section>`;}
async function checkBasket(){if(state.basketLoading||!state.basket.length)return;state.basketLoading=true;const button=$('fpCheckBasket');if(button)button.disabled=true;
  $('fpBasketResults').innerHTML=`<div class="fp-loading"><span class="fp-spinner"></span>${h(T('searching'))}</div>`;
  let idx=0;const batch=async()=>{while(idx<state.basket.length){const item=state.basket[idx++];try{await getPrices(item.barcode);}catch{}}};
  try{await Promise.all([batch(),batch()]);renderBasketResults();}finally{state.basketLoading=false;if($('fpCheckBasket'))$('fpCheckBasket').disabled=false;}
}
function renderNotes(){const area=$('fpPersonal'),rows=state.notes.filter(x=>x.barcode===state.code);
  area.hidden=!state.code||!rows.length;if(!rows.length)return;
  $('fpNotesList').innerHTML=`<div class="fp-notes">${rows.slice().reverse().map(row=>`<div class="fp-note-row"><span><strong>${h(STORES[row.store])}</strong> · ${euro(row.price)} · ${h(day(row.date))}</span><button type="button" data-delete-note="${h(row.id)}" aria-label="${h(T('remove'))}">×</button></div>`).join('')}</div>`;
}
function onNoteSubmit(form){if(!safeCode(state.code)){toast(T('noteNeeded'));return;}const data=new FormData(form),store=String(data.get('store')||''),price=Number(data.get('price')),date=String(data.get('date')||''),today=todayISO();
  if(!Object.hasOwn(STORES,store)||!Number.isFinite(price)||price<.01||price>10000||!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>today||date<new Date(Date.now()-365*864e5).toISOString().slice(0,10)){toast(T('noteBad'));return;}
  const note={id:crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2),barcode:state.code,store,price:Math.round(price*100)/100,date};
  state.notes.push(note);if(state.notes.length>300)state.notes.shift();if(!saveStorage(NOTES_STORAGE,state.notes)){state.notes.pop();toast(T('notSaved'));return;}toast(T('personalSaved'));form.reset();form.elements.date.value=todayISO();renderNotes();}
/* FoodScan 73: photo -> on-device text reading -> the shopper confirms -> saved here, and optionally shared on Open Prices. */
function saveNoteObj(v){if(!safeCode(v.barcode)||!Object.hasOwn(STORES,v.store))return false;
  const note={id:crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2),barcode:v.barcode,store:v.store,price:v.price,date:v.date,
    ...(v.regularPrice?{regularPrice:v.regularPrice}:{}),...(v.source?{source:v.source}:{}),...(Number.isInteger(v.opPriceId)?{opPriceId:v.opPriceId}:{})};
  const same=state.notes.findIndex(n=>n.barcode===note.barcode&&n.store===note.store&&n.date===note.date&&n.price===note.price);
  if(same>=0){state.notes[same]={...state.notes[same],...note,id:state.notes[same].id};}else{state.notes.push(note);if(state.notes.length>300)state.notes.shift();}
  if(!saveStorage(NOTES_STORAGE,state.notes)){toast(T('notSaved'));return false;}renderNotes();if(state.data)renderResult();return true;}
async function openAdd(){if(!safeCode(state.code)){toast(T('noteNeeded'));return;}const root=$('fpAdd');
  try{const m=await import('./add-price-v80.mjs');m.openAddPrice(root,{code:state.code,name:state.name,lang:state.lang,stores:STORES,saveLocal:saveNoteObj,toast});root.scrollIntoView({behavior:'smooth',block:'start'});}
  catch{toast(T('notSaved'));}}
function exportBasket(){if(!state.basket.length){toast(T('noBasket'));return;}const csv=['barcode,product_name,quantity',...state.basket.map(it=>[it.barcode,it.name,it.quantity].map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(','))].join('\r\n');const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='foodscan-grocery-basket.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function init(){const query=new URLSearchParams(location.search);$('fpNoteForm').elements.date.value=todayISO();
  // Preserve the original English strings before translating any element.
  document.querySelectorAll('[data-i18n]').forEach(el=>el.dataset.defaultText=el.dataset.i18n==='hero'?el.innerHTML:el.textContent);
  $('fpLang').addEventListener('click',()=>setLang(state.lang==='el'?'en':'el'));
  $('fpTabCompare').addEventListener('click',()=>setTab('compare'));$('fpTabBasket').addEventListener('click',()=>setTab('basket'));
  $('fpLookup').addEventListener('submit',event=>{event.preventDefault();const c=$('fpCode').value.trim();void lookup(c,{refresh:c===state.code});}); // 78: looking up the same barcode again is a rescan: ask every source again
  $('fpResult').addEventListener('click',event=>{if(event.target.closest('#fpRetry'))void lookup(state.code,{refresh:true});const add=event.target.closest('[data-add]');if(add)addToBasket(add.dataset.add);if(event.target.closest('[data-addprice]'))void openAdd();});
  $('fpNear').addEventListener('click',()=>{if(!navigator.geolocation){toast(T('permissionDenied'));return;}$('fpNear').disabled=true;
    navigator.geolocation.getCurrentPosition(pos=>{const lat=+pos.coords.latitude.toFixed(2),lon=+pos.coords.longitude.toFixed(2);$('fpNear').disabled=false;
      if(lat<34||lat>42||lon<19||lon>30){toast(T('outsideGR'));return;}
      state.near={lat,lon};$('fpLocationLabel').textContent=T('nearScope');$('fpAll').hidden=false;if(state.code)void lookup(state.code,{refresh:true});
    },()=>{$('fpNear').disabled=false;toast(T('permissionDenied'));},{enableHighAccuracy:false,maximumAge:180000,timeout:7000});});
  $('fpAll').addEventListener('click',()=>{state.near=null;$('fpLocationLabel').textContent=T('all');$('fpAll').hidden=true;if(state.code)void lookup(state.code,{refresh:true});});
  $('fpNoteForm').addEventListener('submit',e=>{e.preventDefault();onNoteSubmit(e.currentTarget);});
  $('fpPersonal').addEventListener('click',e=>{const btn=e.target.closest('[data-delete-note]');if(!btn)return;state.notes=state.notes.filter(x=>x.id!==btn.dataset.deleteNote);if(saveStorage(NOTES_STORAGE,state.notes))renderNotes();else toast(T('notSaved'));});
  $('fpBasketList').addEventListener('click',e=>{
    if(e.target.closest('#fpStartCompare')||e.target.closest('#fpAddAnother')){setTab('compare');$('fpCode').focus();return;}
    if(e.target.closest('#fpCheckBasket')){void checkBasket();return;}
    const lookupBtn=e.target.closest('[data-basket-lookup]');if(lookupBtn){e.preventDefault();setTab('compare');void lookup(lookupBtn.dataset.basketLookup);return;}
    for(const [attr,type] of [['data-plus','plus'],['data-minus','minus'],['data-remove','remove']]){
      const btn=e.target.closest('['+attr+']');if(!btn)continue;const code=btn.getAttribute(attr);const item=state.basket.find(x=>x.barcode===code);if(!item)return;
      if(type==='remove')state.basket=state.basket.filter(x=>x.barcode!==code);
      else if(type==='plus')item.quantity=Math.min(99,item.quantity+1);else item.quantity=Math.max(1,item.quantity-1);
      if(!saveStorage(BASKET_STORAGE,state.basket)){toast(T('notSaved'));return;}renderBasket();renderBasketResults();if(state.data)renderResult();return;
    }
  });
  $('fpExport').addEventListener('click',exportBasket);window.addEventListener('storage',event=>{if(event.key===BASKET_STORAGE){state.basket=loadStorage(BASKET_STORAGE).filter(x=>safeCode(x.barcode));renderBasket();renderBasketResults();}});
  setLang(state.lang);renderBasket();const code=query.get('barcode')||'';
  const name=query.get('name');if(name&&typeof name==='string')state.name=name.trim().slice(0,120);
  if(safeCode(code)){void lookup(code);}
  if(query.get('tab')==='basket')setTab('basket');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
