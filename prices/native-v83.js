/* FoodScan 83 native prices (from 78/80): worldwide. The card names the shopper's market (country, with a one-tap change), writes every price in
 * its own currency, shows the typical price when at least 3 stores recorded one, and never ranks a foreign or other-currency price.
 * (78, from 72/75) One scan, one screen: the Nutri-Score and the real shelf price together.
 * - Product view: the cheapest CURRENT Greek price (store, per kg/L, date, freshness) sits under the grade card.
 * - Higher-grade choices and Compare: the cheapest current price only, with the per-kg/L difference.
 * - Prices · Τιμές: every store, opened straight from the product (no second scan).
 * The price request starts the moment the route changes, alongside the app's own product lookup, and never delays
 * the grade: the grade renders first, the price fills in. Only real, dated observations appear (price-core-v80).
 * 78: results expire after 10 minutes; a new scan of a barcode always asks the sources again; a partial answer (a source
 * down, nothing in the others) says so instead of "no price"; Higher-grade choices and Compare claim a saving only when
 * both prices are per kg or both per litre. */
import { getPrices, peekPrices, forgetPrices, setConfirmed, confirmedFor, shareConfirmation, TTL } from './price-client-v83.mjs';
import { esc, euro, money, unitText, whenText, dateText, unitDelta, pageLang, t, marketContext } from './price-core-v83.mjs';
import { detectMarket, setMarket, dismissSuggestion, marketName, marketFlag, marketsSorted, validMarket, liveSearchURL } from './market-v83.mjs';

const icon = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>';
const chev = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
const T = {
  en:{eyebrow:'Supermarket price', facts:'Compare label facts', hideFacts:'Hide label facts', moreOpts:n => `Show ${n} more`, show:'Show', hide:'Hide', navPrices:'Prices', update:'A new version of FoodScan is ready.', reload:'Refresh', cheapest:'Cheapest current price', condTitle:k => `Current ${k.toLowerCase()}`, offer:'offer', checking:'Checking supermarket prices…', na:'Not available', allStores:'All stores', seeAll:n => n > 1 ? `See all ${n} prices` : 'See all prices', seeAllOld:(c, o) => `All prices · ${c} current, ${o} older`, noneRel:'No supermarket price is on record for this exact barcode yet. FoodScan does not guess prices.', relHead:'Recorded prices of the closest products · not this product', candHead:'Is it one of these? Same brand, priced in every chain by the national price observatory', candHeadNow:'Current prices: is it one of these? Same brand, from the national price observatory', candSub:'Pick one only if the name and the pack size match the product in your hand. You will then see its own dated chain prices. You can undo it.', candBtn:'This is it', candChains:n => `prices in ${n} ${n === 1 ? 'chain' : 'chains'}`, candOtherSize:'different pack size', confLine:'Prices of the product you confirmed', confChange:'Change', otherPackPill:'Other pack size', otherPackLead:p => `Lowest price for ${p}`, otherPackNote:(a, b) => `The product you confirmed is listed as ${a}; this barcode's label says ${b}. Compare by the price per kg or litre.`, otherPackCount:n => `${n} ${n === 1 ? 'chain' : 'chains'} · not ranked as this barcode's price`, confNone:'The product you confirmed has no recorded price right now.', userConf:'confirmed by you', communityConf:'confirmed by shoppers', sharedOk:n => `Shared with everyone: confirmed by ${n} shoppers.`, sharedPending:(n, m) => `Saved for everyone: ${n} of ${m} confirmations. These prices show for all shoppers once ${m} different shoppers confirm.`, sharedOff:'Kept on this device only: shared confirmations are not switched on for this site yet.', sharedPack:'Not shared: that product is sold in another pack size than this barcode.', sharedNo:'Not shared: this choice could not be checked.', commLine:(n) => `Prices of the product ${n} shoppers confirmed as this one`, commDispute:'Not this product', commDisputed:'Thank you. If others agree, these prices stop showing for this barcode.', addShort:'Add a price',
    noData:'No supermarket price recorded for this barcode yet.', liveFail:'The shop\'s page could not confirm this price today, so it is not counted as the cheapest. Check the shelf.', addOwn:'Add a price you saw', lastSeen:'Last seen', notCurrent:'Not a current price',
    elsewhere:c => `Only seen outside Greece (${c})`, down:'Prices could not be checked right now. The grade above is unaffected.', retry:'Try again',
    of:(n, m) => n > 1 ? `Lowest of ${n} prices${m > 1 ? ` · ${m} chains` : ''}` : 'Only current price on record', upTo:x => `others up to +${x}`,
    observed:'Observed', alsoCheaper:'Also cheaper', perKgMore:x => `+${x}`, noPrice:'Price not available', vsThis:'vs this', row:'Cheapest price', fresh:'Current', older:'Older', historical:'Historical', expired:'Expired',
    receipt:'receipt', photo:'shelf photo', feed:'retailer feed', observatory:'official chain price', web:'chain web-shop price', online:'Online price', auto:'automatic exact match', shopper:'reported by a shopper', basket:'e-katanalotis', chains:'Chain prices', national:'National chain price', moreChains:n => `+${n} more`, card:'Card price', multi:'Multi-buy price', cond:'With conditions',
    condSub:(k, reg) => `${reg ? `Regular price ${reg} · ` : ''}No current price without conditions on record`,
    partial:'Some price sources did not answer, and the others have no price for this barcode.', notComparable:'Different units · no saving claimed', unitNote:'Not comparable per kg/L',
    last:'Last recorded price', agePill:a => `Recorded ${a}`, stale:a => `Recorded ${a}: it may have changed. Check the shelf.`, estBadge:'Estimate', estRough:'Rough estimate', est:'Estimated shelf price', notRecorded:'Not a recorded price', estNone:'No price is on record for this exact barcode.',
    estBasis:n => `Based on ${n} similar products with recorded Greek prices`, estBasisType:n => `Based on ${n} products of the same type with recorded Greek prices`, estPer:(u, b) => `about ${u}${b}`, perPack:'for this pack', how:'How is this estimated?',
    howBody:'The name, brand and pack size are compared with products that have a recorded Greek price (Ministry of Development price observatory and chain web shops). The range comes from the measured error of this method on products whose price is known.',
    valid:(m, n) => `On ${n} products with known prices the typical error was ${m}%.`, kinds:{close:'Very similar products', similar:'Similar products', broad:'Broadly similar products', rough:'Rough estimate: few close matches', typical:'Rough estimate: typical for this kind of product'}, sim:'match',
    none:'No verified price for this barcode', noneSub:'No supermarket price is on record for it yet. FoodScan does not guess prices. That does not mean it is not sold.', elseLine:(c, p, s, d) => `Seen in ${c}: ${p} · ${s} · ${d}`},
  el:{eyebrow:'Τιμή σούπερ μάρκετ', facts:'Σύγκριση στοιχείων ετικέτας', hideFacts:'Απόκρυψη στοιχείων', moreOpts:n => `Εμφάνιση ${n} ακόμη`, show:'Εμφάνιση', hide:'Απόκρυψη', navPrices:'Τιμές', update:'Νέα έκδοση FoodScan διαθέσιμη.', reload:'Ανανέωση', cheapest:'Φθηνότερη τρέχουσα τιμή', condTitle:k => `Τρέχουσα ${k.toLowerCase()}`, offer:'προσφορά', checking:'Έλεγχος τιμών σούπερ μάρκετ…', na:'Δεν υπάρχει διαθέσιμη τιμή', allStores:'Όλα τα καταστήματα', seeAll:n => n > 1 ? `Δείτε όλες τις τιμές (${n})` : 'Δείτε όλες τις τιμές', seeAllOld:(c, o) => `Όλες οι τιμές · ${c} τρέχουσες, ${o} παλαιότερες`, noneRel:'Δεν υπάρχει ακόμη καταγεγραμμένη τιμή σούπερ μάρκετ για αυτό ακριβώς το barcode. Το FoodScan δεν μαντεύει τιμές.', relHead:'Καταγεγραμμένες τιμές των πιο κοντινών προϊόντων · όχι αυτού του προϊόντος', candHead:'Μήπως είναι κάποιο από αυτά; Ίδια μάρκα, με τιμές σε κάθε αλυσίδα από το Παρατηρητήριο Τιμών', candHeadNow:'Τρέχουσες τιμές: μήπως είναι κάποιο από αυτά; Ίδια μάρκα, από το Παρατηρητήριο Τιμών', candSub:'Επιλέξτε μόνο αν το όνομα και η συσκευασία ταιριάζουν με το προϊόν που κρατάτε. Θα δείτε τις δικές του τιμές ανά αλυσίδα, με ημερομηνία. Μπορείτε να το αναιρέσετε.', candBtn:'Αυτό είναι', candChains:n => `τιμές σε ${n} ${n === 1 ? 'αλυσίδα' : 'αλυσίδες'}`, candOtherSize:'άλλη συσκευασία', confLine:'Τιμές του προϊόντος που επιβεβαιώσατε', confChange:'Αλλαγή', otherPackPill:'Άλλη συσκευασία', otherPackLead:p => `Χαμηλότερη τιμή για ${p}`, otherPackNote:(a, b) => `Το προϊόν που επιβεβαιώσατε είναι καταχωρημένο ως ${a}· η ετικέτα αυτού του barcode γράφει ${b}. Συγκρίνετε με την τιμή ανά κιλό ή λίτρο.`, otherPackCount:n => `${n} ${n === 1 ? 'αλυσίδα' : 'αλυσίδες'} · δεν κατατάσσεται ως τιμή αυτού του barcode`, confNone:'Το προϊόν που επιβεβαιώσατε δεν έχει καταγεγραμμένη τιμή αυτή τη στιγμή.', userConf:'επιβεβαιώθηκε από εσάς', communityConf:'επιβεβαιώθηκε από αγοραστές', sharedOk:n => `Κοινόχρηστο: επιβεβαιώθηκε από ${n} αγοραστές.`, sharedPending:(n, m) => `Καταχωρήθηκε για όλους: ${n} από ${m} επιβεβαιώσεις. Οι τιμές εμφανίζονται σε όλους όταν το επιβεβαιώσουν ${m} διαφορετικοί αγοραστές.`, sharedOff:'Κρατήθηκε μόνο σε αυτή τη συσκευή: οι κοινές επιβεβαιώσεις δεν έχουν ενεργοποιηθεί ακόμη.', sharedPack:'Δεν κοινοποιήθηκε: αυτό το προϊόν πωλείται σε άλλη συσκευασία από αυτό το barcode.', sharedNo:'Δεν κοινοποιήθηκε: η επιλογή δεν μπόρεσε να ελεγχθεί.', commLine:(n) => `Τιμές του προϊόντος που ${n} αγοραστές επιβεβαίωσαν ως αυτό`, commDispute:'Δεν είναι αυτό', commDisputed:'Ευχαριστούμε. Αν συμφωνήσουν κι άλλοι, οι τιμές παύουν να εμφανίζονται για αυτό το barcode.', addShort:'Προσθήκη τιμής',
    noData:'Δεν έχει καταγραφεί ακόμη τιμή για αυτό το barcode.', liveFail:'Η σελίδα του καταστήματος δεν επιβεβαίωσε σήμερα αυτή την τιμή, γι\' αυτό δεν μετράει ως η φθηνότερη. Ελέγξτε στο ράφι.', addOwn:'Προσθέστε μια τιμή που είδατε', lastSeen:'Τελευταία καταγραφή', notCurrent:'Όχι τρέχουσα τιμή',
    elsewhere:c => `Καταγραφή μόνο εκτός Ελλάδας (${c})`, down:'Οι τιμές δεν ελέγχθηκαν τώρα. Η βαθμολογία δεν επηρεάζεται.', retry:'Δοκιμάστε ξανά',
    of:(n, m) => n > 1 ? `Η χαμηλότερη από ${n} τιμές${m > 1 ? ` · ${m} αλυσίδες` : ''}` : 'Η μόνη τρέχουσα τιμή', upTo:x => `οι άλλες έως +${x}`,
    observed:'Καταγραφή', alsoCheaper:'Και φθηνότερο', perKgMore:x => `+${x}`, noPrice:'Τιμή μη διαθέσιμη', vsThis:'από αυτό', row:'Φθηνότερη τιμή', fresh:'Τρέχουσα', older:'Παλαιότερη', historical:'Ιστορική', expired:'Έληξε',
    receipt:'απόδειξη', photo:'φωτογραφία ραφιού', feed:'δεδομένα λιανοπωλητή', observatory:'επίσημη τιμή αλυσίδας', web:'τιμή e-shop αλυσίδας', online:'Τιμή e-shop', auto:'αυτόματη ακριβής αντιστοίχιση', shopper:'αναφορά καταναλωτή', basket:'e-katanalotis', chains:'Τιμές ανά αλυσίδα', national:'Πανελλαδική τιμή αλυσίδας', moreChains:n => `+${n} ακόμη`, card:'Τιμή με κάρτα', multi:'Τιμή πολυσυσκευασίας', cond:'Με όρους',
    condSub:(k, reg) => `${reg ? `Κανονική τιμή ${reg} · ` : ''}Δεν υπάρχει τρέχουσα τιμή χωρίς όρους`,
    partial:'Κάποιες πηγές τιμών δεν απάντησαν και οι υπόλοιπες δεν έχουν τιμή για αυτό το barcode.', notComparable:'Άλλη μονάδα · χωρίς σύγκριση', unitNote:'Μη συγκρίσιμο ανά κιλό/λίτρο',
    last:'Τελευταία καταγεγραμμένη τιμή', agePill:a => `Καταγράφηκε ${a}`, stale:a => `Καταγράφηκε ${a} και ίσως έχει αλλάξει. Ελέγξτε στο ράφι.`, estBadge:'Εκτίμηση', estRough:'Πρόχειρη εκτίμηση', est:'Εκτιμώμενη τιμή ραφιού', notRecorded:'Όχι καταγεγραμμένη τιμή', estNone:'Δεν υπάρχει καταγεγραμμένη τιμή για αυτό ακριβώς το barcode.',
    estBasis:n => `Βάσει ${n} παρόμοιων προϊόντων με καταγεγραμμένη τιμή στην Ελλάδα`, estBasisType:n => `Βάσει ${n} προϊόντων του ίδιου είδους με καταγεγραμμένη τιμή στην Ελλάδα`, estPer:(u, b) => `περίπου ${u}${b}`, perPack:'για αυτή τη συσκευασία', how:'Πώς γίνεται η εκτίμηση;',
    howBody:'Συγκρίνουμε το όνομα, τη μάρκα και τη συσκευασία με προϊόντα που έχουν καταγεγραμμένη ελληνική τιμή (Παρατηρητήριο Τιμών του Υπουργείου Ανάπτυξης και e-shop αλυσίδων). Το εύρος προκύπτει από το μετρημένο σφάλμα της μεθόδου σε προϊόντα με γνωστή τιμή.',
    valid:(m, n) => `Σε ${n} προϊόντα με γνωστή τιμή το τυπικό σφάλμα ήταν ${m}%.`, kinds:{close:'Πολύ παρόμοια προϊόντα', similar:'Παρόμοια προϊόντα', broad:'Σχετικά παρόμοια προϊόντα', rough:'Πρόχειρη εκτίμηση: λίγα κοντινά προϊόντα', typical:'Πρόχειρη εκτίμηση: τυπική τιμή για αυτό το είδος προϊόντος'}, sim:'ομοιότητα',
    none:'Δεν βρέθηκε επαληθευμένη τιμή', noneSub:'Δεν υπάρχει ακόμη καταγεγραμμένη τιμή σούπερ μάρκετ για αυτό το barcode. Το FoodScan δεν μαντεύει τιμές. Δεν σημαίνει ότι το προϊόν δεν πωλείται.', elseLine:(c, p, s, d) => `Καταγραφή σε ${c}: ${p} · ${s} · ${d}`},
};
Object.assign(T.en, {inCountry:(c, cur) => `Prices in ${c}${cur ? ' · ' + cur : ''}`, change:'Change', pickLabel:'Country for prices', pickAuto:'Automatic (where you are)', pickClose:'Done',
  webWait:'Checking shops online…', webWaitSub:'FoodScan is reading local shops\' product pages for this barcode. This can take up to a minute; the price appears here by itself.',
  typical:'Typical price', typBasis:(n, m) => `${n} prices${m > 1 ? ` at ${m} chains` : ''} · last 90 days`, noneIn:c => `No price for this barcode is on record in ${c} yet. FoodScan does not guess prices. That does not mean it is not sold.`,
  elseIn:c => `Only seen outside ${c}`, outsideTag:'other country', online:'Online price', liveShop:'Check live prices online', liveShopNote:'Opens a Google search for this barcode. Those prices are the shops\', not FoodScan\'s.'});
Object.assign(T.el, {inCountry:(c, cur) => `Τιμές σε ${c}${cur ? ' · ' + cur : ''}`, change:'Αλλαγή', pickLabel:'Χώρα για τις τιμές', pickAuto:'Αυτόματα (όπου βρίσκεστε)', pickClose:'Τέλος',
  webWait:'Έλεγχος καταστημάτων online…', webWaitSub:'Το FoodScan διαβάζει σελίδες προϊόντων τοπικών καταστημάτων για αυτό το barcode. Μπορεί να πάρει έως ένα λεπτό· η τιμή εμφανίζεται μόνη της.',
  typical:'Τυπική τιμή', typBasis:(n, m) => `${n} τιμές${m > 1 ? ` σε ${m} αλυσίδες` : ''} · τελευταίες 90 ημέρες`, noneIn:c => `Δεν υπάρχει ακόμη καταγεγραμμένη τιμή για αυτό το barcode σε ${c}. Το FoodScan δεν μαντεύει τιμές. Δεν σημαίνει ότι το προϊόν δεν πωλείται.`,
  elseIn:c => `Καταγραφή μόνο εκτός ${c}`, outsideTag:'άλλη χώρα', online:'Τιμή e-shop', liveShop:'Δείτε ζωντανές τιμές online', liveShopNote:'Ανοίγει αναζήτηση Google για αυτό το barcode. Οι τιμές είναι των καταστημάτων, όχι του FoodScan.'});
// 101 (fix 14): French, German, Spanish, Italian for the price card, written and checked by hand (the machine translation of
// this card had errors, e.g. a garbled "prices reported" line). Sentences built from numbers are translated too, so the card never mixes languages.
const pl = (n, one, many) => (n === 1 ? one : many);
const NATIVE_L10N = {
  fr: {
    eyebrow:'Prix en supermarché', facts:'Comparer les infos de l’étiquette', hideFacts:'Masquer les infos de l’étiquette', show:'Afficher', hide:'Masquer', navPrices:'Prix',
    update:'Une nouvelle version de FoodScan est prête.', reload:'Actualiser', cheapest:'Prix actuel le plus bas', offer:'promo', checking:'Vérification des prix en supermarché…',
    na:'Non disponible', allStores:'Tous les magasins', noneRel:'Aucun prix en supermarché n’est encore enregistré pour ce code-barres exact. FoodScan ne devine pas les prix.',
    relHead:'Prix enregistrés des produits les plus proches · pas ce produit', candHead:'Est-ce l’un de ceux-ci ? Même marque, prix relevés dans chaque enseigne par l’observatoire national des prix',
    candHeadNow:'Prix actuels : est-ce l’un de ceux-ci ? Même marque, selon l’observatoire national des prix',
    candSub:'Choisissez-en un seulement si le nom et le format correspondent au produit que vous avez en main. Vous verrez alors ses propres prix datés par enseigne. Vous pourrez annuler.',
    candBtn:'C’est celui-ci', candOtherSize:'autre format', confLine:'Prix du produit que vous avez confirmé', confChange:'Modifier', otherPackPill:'Autre format',
    confNone:'Le produit que vous avez confirmé n’a pas de prix enregistré pour le moment.', userConf:'confirmé par vous', communityConf:'confirmé par des clients',
    sharedOff:'Gardé sur cet appareil uniquement : les confirmations partagées ne sont pas encore activées sur ce site.', sharedPack:'Non partagé : ce produit est vendu dans un autre format que ce code-barres.',
    sharedNo:'Non partagé : ce choix n’a pas pu être vérifié.', commDispute:'Pas ce produit', commDisputed:'Merci. Si d’autres sont d’accord, ces prix ne s’afficheront plus pour ce code-barres.',
    addShort:'Ajouter un prix', noData:'Aucun prix en supermarché enregistré pour ce code-barres pour l’instant.',
    liveFail:'La page du magasin n’a pas pu confirmer ce prix aujourd’hui : il n’est donc pas compté comme le moins cher. Vérifiez en rayon.',
    addOwn:'Ajouter un prix que vous avez vu', lastSeen:'Vu pour la dernière fois', notCurrent:'Pas un prix actuel', down:'Les prix n’ont pas pu être vérifiés pour le moment. La note ci-dessus n’est pas concernée.',
    retry:'Réessayer', observed:'Relevé', alsoCheaper:'Aussi moins cher', noPrice:'Prix non disponible', vsThis:'par rapport à celui-ci', row:'Prix le plus bas', fresh:'Actuel', older:'Plus ancien',
    historical:'Historique', expired:'Expiré', receipt:'ticket de caisse', photo:'photo du rayon', feed:'flux du distributeur', observatory:'prix officiel de l’enseigne', web:'prix de la boutique en ligne de l’enseigne',
    online:'Prix en ligne', auto:'correspondance exacte automatique', shopper:'signalé par un client', basket:'e-katanalotis', chains:'Prix par enseigne', national:'Prix national de l’enseigne',
    card:'Prix avec carte de fidélité', multi:'Prix par lot', cond:'Sous conditions', partial:'Certaines sources de prix n’ont pas répondu, et les autres n’ont aucun prix pour ce code-barres.',
    notComparable:'Unités différentes · aucune économie annoncée', unitNote:'Non comparable au kg/L', last:'Dernier prix enregistré', estBadge:'Estimation', estRough:'Estimation approximative',
    est:'Prix estimé en rayon', notRecorded:'Pas un prix enregistré', estNone:'Aucun prix n’est enregistré pour ce code-barres exact.', perPack:'pour ce format', how:'Comment est-ce estimé ?',
    howBody:'Le nom, la marque et le format sont comparés à des produits ayant un prix enregistré en Grèce. La fourchette vient de l’erreur mesurée de cette méthode sur des produits dont le prix est connu.',
    sim:'correspondance', none:'Aucun prix vérifié pour ce code-barres', noneSub:'Aucun prix en supermarché n’est encore enregistré pour lui. FoodScan ne devine pas les prix. Cela ne veut pas dire qu’il n’est pas vendu.',
    change:'Modifier', pickLabel:'Pays des prix', pickAuto:'Automatique (là où vous êtes)', pickClose:'Terminé', webWait:'Vérification des boutiques en ligne…',
    webWaitSub:'FoodScan lit les pages produit des magasins locaux pour ce code-barres. Cela peut prendre jusqu’à une minute ; le prix s’affichera ici tout seul.',
    typical:'Prix habituel', outsideTag:'autre pays', liveShop:'Voir les prix en ligne', liveShopNote:'Ouvre une recherche Google pour ce code-barres. Ces prix sont ceux des magasins, pas de FoodScan.',
    moreOpts:n => `Afficher ${n} de plus`, condTitle:k => `${k} actuel`, seeAll:n => n > 1 ? `Voir les ${n} prix` : 'Voir tous les prix', seeAllOld:(c, o) => `Tous les prix · ${c} actuels, ${o} plus anciens`,
    candChains:n => `prix dans ${n} ${pl(n, 'enseigne', 'enseignes')}`, otherPackLead:p => `Prix le plus bas pour ${p}`,
    otherPackNote:(a, b) => `Le produit que vous avez confirmé est indiqué en ${a} ; l’étiquette de ce code-barres indique ${b}. Comparez au prix au kg ou au litre.`,
    otherPackCount:n => `${n} ${pl(n, 'enseigne', 'enseignes')} · pas classé comme prix de ce code-barres`, sharedOk:n => `Partagé avec tous : confirmé par ${n} clients.`,
    sharedPending:(n, m) => `Enregistré pour tous : ${n} confirmations sur ${m}. Ces prix s’affichent pour tous dès que ${m} clients différents les confirment et après vérification.`,
    commLine:n => `Prix du produit que ${n} clients ont confirmé comme étant celui-ci`, elsewhere:c => `Vu seulement hors de Grèce (${c})`,
    of:(n, m) => n > 1 ? `Le plus bas de ${n} prix${m > 1 ? ` · ${m} enseignes` : ''}` : 'Seul prix actuel enregistré', upTo:x => `les autres jusqu’à +${x}`, perKgMore:x => `+${x}`, moreChains:n => `+${n} de plus`,
    condSub:(k, reg) => `${reg ? `Prix normal ${reg} · ` : ''}Aucun prix actuel sans condition enregistré`, agePill:a => `Relevé ${a}`, stale:a => `Relevé ${a} : il a peut-être changé. Vérifiez en rayon.`,
    estBasis:n => `D’après ${n} produits similaires avec un prix enregistré en Grèce`, estBasisType:n => `D’après ${n} produits du même type avec un prix enregistré en Grèce`, estPer:(u, b) => `environ ${u}${b}`,
    valid:(m, n) => `Sur ${n} produits au prix connu, l’erreur habituelle était de ${m} %.`, elseLine:(c, p, s, d) => `Vu ailleurs (${c}) : ${p} · ${s} · ${d}`,
    inCountry:(c, cur) => `Prix · ${c}${cur ? ' · ' + cur : ''}`, typBasis:(n, m) => `${n} prix${m > 1 ? ` dans ${m} enseignes` : ''} · 90 derniers jours`,
    noneIn:c => `Aucun prix n’est encore enregistré pour ce code-barres dans ce pays (${c}). FoodScan ne devine pas les prix. Cela ne veut pas dire qu’il n’est pas vendu.`, elseIn:c => `Vu seulement hors de ce pays (${c})`,
  },
  de: {
    eyebrow:'Supermarktpreis', facts:'Etikettangaben vergleichen', hideFacts:'Etikettangaben ausblenden', show:'Anzeigen', hide:'Ausblenden', navPrices:'Preise',
    update:'Eine neue Version von FoodScan ist bereit.', reload:'Aktualisieren', cheapest:'Günstigster aktueller Preis', offer:'Angebot', checking:'Supermarktpreise werden geprüft…',
    na:'Nicht verfügbar', allStores:'Alle Geschäfte', noneRel:'Für genau diesen Barcode ist noch kein Supermarktpreis erfasst. FoodScan rät keine Preise.',
    relHead:'Erfasste Preise der ähnlichsten Produkte · nicht dieses Produkt', candHead:'Ist es eines davon? Gleiche Marke, Preise jeder Kette laut nationaler Preisbeobachtungsstelle',
    candHeadNow:'Aktuelle Preise: Ist es eines davon? Gleiche Marke, laut nationaler Preisbeobachtungsstelle',
    candSub:'Wählen Sie nur, wenn Name und Packungsgröße zum Produkt in Ihrer Hand passen. Dann sehen Sie dessen eigene datierte Preise je Kette. Sie können es rückgängig machen.',
    candBtn:'Das ist es', candOtherSize:'andere Packungsgröße', confLine:'Preise des Produkts, das Sie bestätigt haben', confChange:'Ändern', otherPackPill:'Andere Packungsgröße',
    confNone:'Für das bestätigte Produkt ist derzeit kein Preis erfasst.', userConf:'von Ihnen bestätigt', communityConf:'von Käufern bestätigt',
    sharedOff:'Nur auf diesem Gerät gespeichert: Geteilte Bestätigungen sind für diese Seite noch nicht eingeschaltet.', sharedPack:'Nicht geteilt: Dieses Produkt wird in einer anderen Packungsgröße verkauft als dieser Barcode.',
    sharedNo:'Nicht geteilt: Diese Auswahl konnte nicht geprüft werden.', commDispute:'Nicht dieses Produkt', commDisputed:'Danke. Wenn andere zustimmen, werden diese Preise für diesen Barcode nicht mehr angezeigt.',
    addShort:'Preis hinzufügen', noData:'Für diesen Barcode ist noch kein Supermarktpreis erfasst.',
    liveFail:'Die Seite des Geschäfts konnte diesen Preis heute nicht bestätigen, daher zählt er nicht als günstigster. Prüfen Sie das Regal.',
    addOwn:'Einen gesehenen Preis hinzufügen', lastSeen:'Zuletzt gesehen', notCurrent:'Kein aktueller Preis', down:'Die Preise konnten gerade nicht geprüft werden. Die Bewertung oben ist davon nicht betroffen.',
    retry:'Erneut versuchen', observed:'Erfasst', alsoCheaper:'Ebenfalls günstiger', noPrice:'Preis nicht verfügbar', vsThis:'im Vergleich zu diesem', row:'Günstigster Preis', fresh:'Aktuell', older:'Älter',
    historical:'Historisch', expired:'Abgelaufen', receipt:'Kassenbon', photo:'Regalfoto', feed:'Händler-Datenfeed', observatory:'offizieller Kettenpreis', web:'Preis im Onlineshop der Kette',
    online:'Onlinepreis', auto:'automatische exakte Zuordnung', shopper:'von einem Käufer gemeldet', basket:'e-katanalotis', chains:'Preise je Kette', national:'Landesweiter Kettenpreis',
    card:'Preis mit Kundenkarte', multi:'Mehrfachkauf-Preis', cond:'Mit Bedingungen', partial:'Einige Preisquellen haben nicht geantwortet, und die anderen haben keinen Preis für diesen Barcode.',
    notComparable:'Andere Einheiten · keine Ersparnis angegeben', unitNote:'Nicht pro kg/L vergleichbar', last:'Zuletzt erfasster Preis', estBadge:'Schätzung', estRough:'Grobe Schätzung',
    est:'Geschätzter Regalpreis', notRecorded:'Kein erfasster Preis', estNone:'Für genau diesen Barcode ist kein Preis erfasst.', perPack:'für diese Packung', how:'Wie wird das geschätzt?',
    howBody:'Name, Marke und Packungsgröße werden mit Produkten verglichen, für die ein Preis in Griechenland erfasst ist. Die Spanne ergibt sich aus dem gemessenen Fehler dieser Methode bei Produkten mit bekanntem Preis.',
    sim:'Übereinstimmung', none:'Kein geprüfter Preis für diesen Barcode', noneSub:'Dafür ist noch kein Supermarktpreis erfasst. FoodScan rät keine Preise. Das heißt nicht, dass es nicht verkauft wird.',
    change:'Ändern', pickLabel:'Land für Preise', pickAuto:'Automatisch (wo Sie sind)', pickClose:'Fertig', webWait:'Onlineshops werden geprüft…',
    webWaitSub:'FoodScan liest die Produktseiten lokaler Geschäfte für diesen Barcode. Das kann bis zu einer Minute dauern; der Preis erscheint dann von selbst hier.',
    typical:'Üblicher Preis', outsideTag:'anderes Land', liveShop:'Aktuelle Preise online ansehen', liveShopNote:'Öffnet eine Google-Suche nach diesem Barcode. Diese Preise stammen von den Geschäften, nicht von FoodScan.',
    moreOpts:n => `${n} weitere anzeigen`, condTitle:k => `Aktuell: ${k}`, seeAll:n => n > 1 ? `Alle ${n} Preise ansehen` : 'Alle Preise ansehen', seeAllOld:(c, o) => `Alle Preise · ${c} aktuell, ${o} älter`,
    candChains:n => `Preise in ${n} ${pl(n, 'Kette', 'Ketten')}`, otherPackLead:p => `Günstigster Preis für ${p}`,
    otherPackNote:(a, b) => `Das bestätigte Produkt ist als ${a} gelistet; das Etikett dieses Barcodes sagt ${b}. Vergleichen Sie den Preis pro kg oder Liter.`,
    otherPackCount:n => `${n} ${pl(n, 'Kette', 'Ketten')} · nicht als Preis dieses Barcodes gewertet`, sharedOk:n => `Mit allen geteilt: von ${n} Käufern bestätigt.`,
    sharedPending:(n, m) => `Für alle gespeichert: ${n} von ${m} Bestätigungen. Diese Preise erscheinen für alle, sobald ${m} verschiedene Käufer bestätigen und sie geprüft sind.`,
    commLine:n => `Preise des Produkts, das ${n} Käufer als dieses bestätigt haben`, elsewhere:c => `Nur außerhalb Griechenlands gesehen (${c})`,
    of:(n, m) => n > 1 ? `Günstigster von ${n} Preisen${m > 1 ? ` · ${m} Ketten` : ''}` : 'Einziger erfasster aktueller Preis', upTo:x => `andere bis zu +${x}`, perKgMore:x => `+${x}`, moreChains:n => `+${n} weitere`,
    condSub:(k, reg) => `${reg ? `Normalpreis ${reg} · ` : ''}Kein aktueller Preis ohne Bedingungen erfasst`, agePill:a => `Erfasst ${a}`, stale:a => `Erfasst ${a}: Er kann sich geändert haben. Prüfen Sie das Regal.`,
    estBasis:n => `Auf Basis von ${n} ähnlichen Produkten mit erfasstem Preis in Griechenland`, estBasisType:n => `Auf Basis von ${n} Produkten derselben Art mit erfasstem Preis in Griechenland`, estPer:(u, b) => `etwa ${u}${b}`,
    valid:(m, n) => `Bei ${n} Produkten mit bekanntem Preis lag der übliche Fehler bei ${m} %.`, elseLine:(c, p, s, d) => `Anderswo gesehen (${c}): ${p} · ${s} · ${d}`,
    inCountry:(c, cur) => `Preise · ${c}${cur ? ' · ' + cur : ''}`, typBasis:(n, m) => `${n} Preise${m > 1 ? ` in ${m} Ketten` : ''} · letzte 90 Tage`,
    noneIn:c => `Für diesen Barcode ist in diesem Land (${c}) noch kein Preis erfasst. FoodScan rät keine Preise. Das heißt nicht, dass er nicht verkauft wird.`, elseIn:c => `Nur außerhalb dieses Landes gesehen (${c})`,
  },
  es: {
    eyebrow:'Precio en supermercado', facts:'Comparar datos de la etiqueta', hideFacts:'Ocultar datos de la etiqueta', show:'Mostrar', hide:'Ocultar', navPrices:'Precios',
    update:'Hay una nueva versión de FoodScan lista.', reload:'Actualizar', cheapest:'Precio actual más bajo', offer:'oferta', checking:'Comprobando precios de supermercado…',
    na:'No disponible', allStores:'Todas las tiendas', noneRel:'Todavía no hay ningún precio de supermercado registrado para este código de barras exacto. FoodScan no adivina precios.',
    relHead:'Precios registrados de los productos más parecidos · no este producto', candHead:'¿Es uno de estos? Misma marca, con precio en cada cadena según el observatorio nacional de precios',
    candHeadNow:'Precios actuales: ¿es uno de estos? Misma marca, según el observatorio nacional de precios',
    candSub:'Elija uno solo si el nombre y el tamaño del envase coinciden con el producto que tiene en la mano. Verá entonces sus propios precios fechados por cadena. Puede deshacerlo.',
    candBtn:'Es este', candOtherSize:'otro tamaño', confLine:'Precios del producto que confirmó', confChange:'Cambiar', otherPackPill:'Otro tamaño',
    confNone:'El producto que confirmó no tiene ningún precio registrado en este momento.', userConf:'confirmado por usted', communityConf:'confirmado por compradores',
    sharedOff:'Guardado solo en este dispositivo: las confirmaciones compartidas aún no están activadas en este sitio.', sharedPack:'No compartido: ese producto se vende en otro tamaño distinto al de este código de barras.',
    sharedNo:'No compartido: no se pudo comprobar esta elección.', commDispute:'No es este producto', commDisputed:'Gracias. Si otros están de acuerdo, estos precios dejarán de mostrarse para este código de barras.',
    addShort:'Añadir un precio', noData:'Todavía no hay ningún precio de supermercado registrado para este código de barras.',
    liveFail:'La página de la tienda no pudo confirmar este precio hoy, así que no cuenta como el más barato. Compruébelo en el lineal.',
    addOwn:'Añadir un precio que haya visto', lastSeen:'Visto por última vez', notCurrent:'No es un precio actual', down:'No se pudieron comprobar los precios ahora mismo. La nota de arriba no se ve afectada.',
    retry:'Reintentar', observed:'Registrado', alsoCheaper:'También más barato', noPrice:'Precio no disponible', vsThis:'frente a este', row:'Precio más bajo', fresh:'Actual', older:'Más antiguo',
    historical:'Histórico', expired:'Caducado', receipt:'ticket de compra', photo:'foto del lineal', feed:'datos del distribuidor', observatory:'precio oficial de la cadena', web:'precio de la tienda online de la cadena',
    online:'Precio online', auto:'coincidencia exacta automática', shopper:'indicado por un comprador', basket:'e-katanalotis', chains:'Precios por cadena', national:'Precio nacional de la cadena',
    card:'Precio con tarjeta de cliente', multi:'Precio por compra múltiple', cond:'Con condiciones', partial:'Algunas fuentes de precios no respondieron y las demás no tienen precio para este código de barras.',
    notComparable:'Unidades distintas · sin ahorro anunciado', unitNote:'No comparable por kg/L', last:'Último precio registrado', estBadge:'Estimación', estRough:'Estimación aproximada',
    est:'Precio estimado en el lineal', notRecorded:'No es un precio registrado', estNone:'No hay ningún precio registrado para este código de barras exacto.', perPack:'para este envase', how:'¿Cómo se estima?',
    howBody:'El nombre, la marca y el tamaño se comparan con productos que tienen un precio registrado en Grecia. El rango procede del error medido de este método en productos cuyo precio se conoce.',
    sim:'coincidencia', none:'Ningún precio verificado para este código de barras', noneSub:'Todavía no hay ningún precio de supermercado registrado. FoodScan no adivina precios. Eso no significa que no se venda.',
    change:'Cambiar', pickLabel:'País de los precios', pickAuto:'Automático (donde está usted)', pickClose:'Hecho', webWait:'Comprobando tiendas online…',
    webWaitSub:'FoodScan está leyendo las páginas de producto de tiendas locales para este código de barras. Puede tardar hasta un minuto; el precio aparecerá aquí solo.',
    typical:'Precio habitual', outsideTag:'otro país', liveShop:'Ver precios online', liveShopNote:'Abre una búsqueda de Google para este código de barras. Esos precios son de las tiendas, no de FoodScan.',
    moreOpts:n => `Mostrar ${n} más`, condTitle:k => `${k} actual`, seeAll:n => n > 1 ? `Ver los ${n} precios` : 'Ver todos los precios', seeAllOld:(c, o) => `Todos los precios · ${c} actuales, ${o} más antiguos`,
    candChains:n => `precios en ${n} ${pl(n, 'cadena', 'cadenas')}`, otherPackLead:p => `Precio más bajo para ${p}`,
    otherPackNote:(a, b) => `El producto que confirmó figura como ${a}; la etiqueta de este código de barras dice ${b}. Compare por el precio por kg o litro.`,
    otherPackCount:n => `${n} ${pl(n, 'cadena', 'cadenas')} · no se clasifica como precio de este código de barras`, sharedOk:n => `Compartido con todos: confirmado por ${n} compradores.`,
    sharedPending:(n, m) => `Guardado para todos: ${n} de ${m} confirmaciones. Estos precios se mostrarán a todos cuando ${m} compradores distintos los confirmen y se revisen.`,
    commLine:n => `Precios del producto que ${n} compradores confirmaron como este`, elsewhere:c => `Visto solo fuera de Grecia (${c})`,
    of:(n, m) => n > 1 ? `El más bajo de ${n} precios${m > 1 ? ` · ${m} cadenas` : ''}` : 'Único precio actual registrado', upTo:x => `los demás hasta +${x}`, perKgMore:x => `+${x}`, moreChains:n => `+${n} más`,
    condSub:(k, reg) => `${reg ? `Precio normal ${reg} · ` : ''}No hay ningún precio actual sin condiciones registrado`, agePill:a => `Registrado ${a}`, stale:a => `Registrado ${a}: puede haber cambiado. Compruébelo en el lineal.`,
    estBasis:n => `Según ${n} productos similares con precio registrado en Grecia`, estBasisType:n => `Según ${n} productos del mismo tipo con precio registrado en Grecia`, estPer:(u, b) => `unos ${u}${b}`,
    valid:(m, n) => `En ${n} productos con precio conocido, el error habitual fue del ${m} %.`, elseLine:(c, p, s, d) => `Visto en ${c}: ${p} · ${s} · ${d}`,
    inCountry:(c, cur) => `Precios en ${c}${cur ? ' · ' + cur : ''}`, typBasis:(n, m) => `${n} precios${m > 1 ? ` en ${m} cadenas` : ''} · últimos 90 días`,
    noneIn:c => `Todavía no hay ningún precio registrado para este código de barras en ${c}. FoodScan no adivina precios. Eso no significa que no se venda.`, elseIn:c => `Visto solo fuera de ${c}`,
  },
  it: {
    eyebrow:'Prezzo al supermercato', facts:'Confronta i dati in etichetta', hideFacts:'Nascondi i dati in etichetta', show:'Mostra', hide:'Nascondi', navPrices:'Prezzi',
    update:'È pronta una nuova versione di FoodScan.', reload:'Aggiorna', cheapest:'Prezzo attuale più basso', offer:'offerta', checking:'Controllo dei prezzi al supermercato…',
    na:'Non disponibile', allStores:'Tutti i negozi', noneRel:'Per questo codice a barre esatto non è ancora registrato alcun prezzo al supermercato. FoodScan non indovina i prezzi.',
    relHead:'Prezzi registrati dei prodotti più simili · non questo prodotto', candHead:'È uno di questi? Stessa marca, con il prezzo di ogni catena secondo l’osservatorio nazionale dei prezzi',
    candHeadNow:'Prezzi attuali: è uno di questi? Stessa marca, secondo l’osservatorio nazionale dei prezzi',
    candSub:'Sceglierne uno solo se nome e formato corrispondono al prodotto che ha in mano. Vedrà allora i suoi prezzi datati per catena. Può annullare.',
    candBtn:'È questo', candOtherSize:'altro formato', confLine:'Prezzi del prodotto che ha confermato', confChange:'Cambia', otherPackPill:'Altro formato',
    confNone:'Il prodotto che ha confermato non ha prezzi registrati al momento.', userConf:'confermato da lei', communityConf:'confermato dagli acquirenti',
    sharedOff:'Salvato solo su questo dispositivo: le conferme condivise non sono ancora attive su questo sito.', sharedPack:'Non condiviso: quel prodotto è venduto in un formato diverso da questo codice a barre.',
    sharedNo:'Non condiviso: non è stato possibile verificare questa scelta.', commDispute:'Non è questo prodotto', commDisputed:'Grazie. Se altri sono d’accordo, questi prezzi non verranno più mostrati per questo codice a barre.',
    addShort:'Aggiungi un prezzo', noData:'Nessun prezzo al supermercato registrato finora per questo codice a barre.',
    liveFail:'La pagina del negozio non ha potuto confermare questo prezzo oggi, quindi non conta come il più basso. Verifichi sullo scaffale.',
    addOwn:'Aggiungi un prezzo che ha visto', lastSeen:'Visto l’ultima volta', notCurrent:'Non è un prezzo attuale', down:'Non è stato possibile verificare i prezzi in questo momento. Il punteggio qui sopra non cambia.',
    retry:'Riprova', observed:'Rilevato', alsoCheaper:'Anche più economico', noPrice:'Prezzo non disponibile', vsThis:'rispetto a questo', row:'Prezzo più basso', fresh:'Attuale', older:'Meno recente',
    historical:'Storico', expired:'Scaduto', receipt:'scontrino', photo:'foto dello scaffale', feed:'dati del distributore', observatory:'prezzo ufficiale della catena', web:'prezzo del negozio online della catena',
    online:'Prezzo online', auto:'corrispondenza esatta automatica', shopper:'segnalato da un acquirente', basket:'e-katanalotis', chains:'Prezzi per catena', national:'Prezzo nazionale della catena',
    card:'Prezzo con carta fedeltà', multi:'Prezzo per acquisto multiplo', cond:'Con condizioni', partial:'Alcune fonti di prezzo non hanno risposto e le altre non hanno prezzi per questo codice a barre.',
    notComparable:'Unità diverse · nessun risparmio indicato', unitNote:'Non confrontabile al kg/L', last:'Ultimo prezzo registrato', estBadge:'Stima', estRough:'Stima approssimativa',
    est:'Prezzo stimato a scaffale', notRecorded:'Non è un prezzo registrato', estNone:'Nessun prezzo registrato per questo codice a barre esatto.', perPack:'per questa confezione', how:'Come viene stimato?',
    howBody:'Nome, marca e formato vengono confrontati con prodotti che hanno un prezzo registrato in Grecia. L’intervallo deriva dall’errore misurato di questo metodo su prodotti dal prezzo noto.',
    sim:'corrispondenza', none:'Nessun prezzo verificato per questo codice a barre', noneSub:'Non è ancora registrato alcun prezzo al supermercato. FoodScan non indovina i prezzi. Non significa che non sia in vendita.',
    change:'Cambia', pickLabel:'Paese dei prezzi', pickAuto:'Automatico (dove si trova)', pickClose:'Fatto', webWait:'Controllo dei negozi online…',
    webWaitSub:'FoodScan sta leggendo le pagine prodotto dei negozi locali per questo codice a barre. Può richiedere fino a un minuto; il prezzo comparirà qui da solo.',
    typical:'Prezzo abituale', outsideTag:'altro paese', liveShop:'Vedi i prezzi online', liveShopNote:'Apre una ricerca Google per questo codice a barre. Quei prezzi sono dei negozi, non di FoodScan.',
    moreOpts:n => `Mostra altri ${n}`, condTitle:k => `${k} attuale`, seeAll:n => n > 1 ? `Vedi tutti i ${n} prezzi` : 'Vedi tutti i prezzi', seeAllOld:(c, o) => `Tutti i prezzi · ${c} attuali, ${o} meno recenti`,
    candChains:n => `prezzi in ${n} ${pl(n, 'catena', 'catene')}`, otherPackLead:p => `Prezzo più basso per ${p}`,
    otherPackNote:(a, b) => `Il prodotto che ha confermato è indicato come ${a}; l’etichetta di questo codice a barre riporta ${b}. Confronti il prezzo al kg o al litro.`,
    otherPackCount:n => `${n} ${pl(n, 'catena', 'catene')} · non classificato come prezzo di questo codice a barre`, sharedOk:n => `Condiviso con tutti: confermato da ${n} acquirenti.`,
    sharedPending:(n, m) => `Salvato per tutti: ${n} conferme su ${m}. Questi prezzi verranno mostrati a tutti quando ${m} acquirenti diversi li confermeranno e dopo la verifica.`,
    commLine:n => `Prezzi del prodotto che ${n} acquirenti hanno confermato come questo`, elsewhere:c => `Visto solo fuori dalla Grecia (${c})`,
    of:(n, m) => n > 1 ? `Il più basso di ${n} prezzi${m > 1 ? ` · ${m} catene` : ''}` : 'Unico prezzo attuale registrato', upTo:x => `gli altri fino a +${x}`, perKgMore:x => `+${x}`, moreChains:n => `altri ${n}`,
    condSub:(k, reg) => `${reg ? `Prezzo normale ${reg} · ` : ''}Nessun prezzo attuale senza condizioni registrato`, agePill:a => `Rilevato ${a}`, stale:a => `Rilevato ${a}: potrebbe essere cambiato. Verifichi sullo scaffale.`,
    estBasis:n => `In base a ${n} prodotti simili con prezzo registrato in Grecia`, estBasisType:n => `In base a ${n} prodotti dello stesso tipo con prezzo registrato in Grecia`, estPer:(u, b) => `circa ${u}${b}`,
    valid:(m, n) => `Su ${n} prodotti dal prezzo noto, l’errore tipico era del ${m} %.`, elseLine:(c, p, s, d) => `Visto altrove (${c}): ${p} · ${s} · ${d}`,
    inCountry:(c, cur) => `Prezzi · ${c}${cur ? ' · ' + cur : ''}`, typBasis:(n, m) => `${n} prezzi${m > 1 ? ` in ${m} catene` : ''} · ultimi 90 giorni`,
    noneIn:c => `Per questo codice a barre non è ancora registrato alcun prezzo in questo paese (${c}). FoodScan non indovina i prezzi. Non significa che non sia in vendita.`, elseIn:c => `Visto solo fuori da questo paese (${c})`,
  },
};
/* 102: which country is this? (unknown location, and the "your phone's clock says elsewhere" offer). French, German, Spanish and Italian are hand-written, not machine-translated; a native speaker should still read them. */
Object.assign(T.en, {whereTitle:'Which country are you in?', whereSub:'FoodScan could not tell where you are, so it shows no prices rather than another country\'s. Choose your country to see local, dated prices.',
  devHint:c => `Your phone's clock is set to ${c}.`, devUse:c => `Use ${c}`, devKeep:'Keep this country', srcDevice:'from your phone\'s clock', srcLanguage:'guessed from your language'});
Object.assign(T.el, {whereTitle:'Σε ποια χώρα βρίσκεστε;', whereSub:'Το FoodScan δεν μπόρεσε να καταλάβει πού βρίσκεστε, γι’ αυτό δεν δείχνει τιμές από άλλη χώρα. Επιλέξτε χώρα για να δείτε τοπικές τιμές με ημερομηνία.',
  devHint:c => `Η ζώνη ώρας της συσκευής σας είναι της χώρας: ${c}.`, devUse:c => `Χρήση: ${c}`, devKeep:'Παραμονή στην τρέχουσα χώρα', srcDevice:'από το ρολόι της συσκευής', srcLanguage:'εκτίμηση από τη γλώσσα σας'});
Object.assign(NATIVE_L10N.fr, {whereTitle:'Dans quel pays êtes-vous ?', whereSub:'FoodScan n’a pas pu savoir où vous êtes ; il n’affiche donc aucun prix plutôt que ceux d’un autre pays. Choisissez votre pays pour voir des prix locaux et datés.',
  devHint:c => `L’horloge de votre téléphone est réglée sur : ${c}.`, devUse:c => `Utiliser : ${c}`, devKeep:'Garder ce pays', srcDevice:'d’après l’horloge du téléphone', srcLanguage:'deviné d’après votre langue'});
Object.assign(NATIVE_L10N.de, {whereTitle:'In welchem Land sind Sie?', whereSub:'FoodScan konnte nicht feststellen, wo Sie sind, und zeigt deshalb lieber keine Preise als die eines anderen Landes. Wählen Sie Ihr Land, um örtliche Preise mit Datum zu sehen.',
  devHint:c => `Die Uhr Ihres Telefons ist auf dieses Land eingestellt: ${c}.`, devUse:c => `${c} verwenden`, devKeep:'Dieses Land behalten', srcDevice:'nach der Uhr des Telefons', srcLanguage:'aus Ihrer Sprache geschätzt'});
Object.assign(NATIVE_L10N.es, {whereTitle:'¿En qué país está?', whereSub:'FoodScan no pudo saber dónde está, así que no muestra precios en lugar de mostrar los de otro país. Elija su país para ver precios locales con fecha.',
  devHint:c => `El reloj de su teléfono está en la zona horaria de: ${c}.`, devUse:c => `Usar ${c}`, devKeep:'Mantener este país', srcDevice:'según el reloj del teléfono', srcLanguage:'deducido de su idioma'});
Object.assign(NATIVE_L10N.it, {whereTitle:'In quale paese si trova?', whereSub:'FoodScan non ha potuto capire dove si trova, quindi non mostra prezzi invece di quelli di un altro paese. Scelga il suo paese per vedere prezzi locali con data.',
  devHint:c => `L’orologio del suo telefono è sul fuso orario di: ${c}.`, devUse:c => `Usa ${c}`, devKeep:'Mantieni questo paese', srcDevice:'dall’orologio del telefono', srcLanguage:'dedotto dalla lingua'});
for (const [l, d] of Object.entries(NATIVE_L10N)) T[l] = Object.setPrototypeOf(d, T.en);
// 105: the prices came in two steps and a shop's own page is still being checked. liveWait stands where liveFail would (a "last seen" price leads);
// liveWaitMore sits under a current price that another shop's answer may still change.
for (const [l, s] of Object.entries({
  en:['Checking the shop’s page for today’s price…', 'Still checking one shop’s page. This price may update in a moment.'],
  el:['Γίνεται έλεγχος της σελίδας του καταστήματος για τη σημερινή τιμή…', 'Ελέγχεται ακόμη η σελίδα ενός καταστήματος. Η τιμή μπορεί να ενημερωθεί σε λίγο.'],
  fr:['Vérification de la page du magasin pour le prix du jour…', 'La page d’un magasin est encore en cours de vérification. Ce prix peut changer dans un instant.'],
  de:['Die Seite des Geschäfts wird auf den heutigen Preis geprüft…', 'Die Seite eines Geschäfts wird noch geprüft. Dieser Preis kann sich gleich ändern.'],
  es:['Comprobando la página de la tienda para el precio de hoy…', 'Aún se está comprobando la página de una tienda. Este precio puede cambiar en un momento.'],
  it:['Controllo della pagina del negozio per il prezzo di oggi…', 'La pagina di un negozio è ancora in fase di controllo. Questo prezzo può cambiare tra un momento.'],
})) if (T[l]) Object.assign(T[l], {liveWait:s[0], liveWaitMore:s[1]});
const lang = () => pageLang();
const tx = (k, ...a) => { const v = (T[lang()] || T.en)[k]; return typeof v === 'function' ? v(...a) : v; };
const mHome = () => marketContext().home;
/** One price in the currency it was recorded in. */
const $ = (o, L, key = 'price') => money(o[key], L, o.currency || marketContext().currency, mHome());
const placeName = (cc, L) => /^[A-Z]{2}$/.test(String(cc || '')) ? `${marketFlag(cc)} ${marketName(cc, L)}`.trim() : tx('online');
const ui = {picker:false};
const pricesURL = code => '/prices/?barcode=' + encodeURIComponent(code);
const route = () => (location.hash.startsWith('#/') ? location.hash.slice(1) : location.pathname);
const productCode = () => route().match(/^\/p\/(\d{8}|\d{12,14})(?:[/?]|$)/)?.[1] || null;
const compareCodes = () => { const m = route().match(/^\/compare\/(\d{8,14})\/(\d{8,14})/); return m ? [m[1], m[2]] : null; };
// 78: every result carries the time it was read and expires with the device cache (10 min); v77 kept them for the whole session.
const results = new Map(), asked = new Set(), cheapResults = new Map(), cheapAsked = new Set();
const keep = (code, r) => { results.set(code, {...r, readAt:Date.now()}); };
/** 84: `cheap` = the answer for a small chip (a better choice listed under another product): FoodScan's free sources only, never the paid web search; the product
 *  the shopper opens, and a comparison, always ask in full. */
const want = (code, {fresh:force = false, cheap = false} = {}) => { if (!code) return null;
  const R = cheap ? cheapResults : results, A = cheap ? cheapAsked : asked, put = (c, r) => R.set(c, {...r, readAt:Date.now()});
  const have = R.get(code);
  // A partial or failed answer is re-asked after one minute (not on every repaint); a complete one after 10 minutes.
  const life = have && (have.status === 'temporarily_unavailable' || have.status === 'incomplete' || have.liveUnsettled) ? 60000 : TTL; // 105: nor an answer whose shop check never finished
  if (have && !force && Date.now() - have.readAt < life) return have;
  if (have && !force && A.has(code)) return have; // a request is already on its way
  if (!force) { const hit = peekPrices(code, undefined, cheap); if (hit) { put(code, hit); return R.get(code); } }
  if (force) { forgetPrices(code); R.delete(code); }
  A.add(code);
  const asking = detectMarket().code; // 83: an answer for a market the shopper has since left is dropped
  getPrices(code, {fresh:force, cheap}).then(r => { if (asking === detectMarket().code) put(code, r); A.delete(code); schedule(); }).catch(() => A.delete(code)); return force ? null : have || null; };
// 84: a finished web price search replaces the earlier answer at once.
// 105: also the complete answer after a quick one (a shop's page was still being checked); a chip's answer goes back to the chips' own store.
window.addEventListener('foodscan:prices-updated', e => { const c = e.detail?.code; if (c && e.detail.result) { if (e.detail.cheap) cheapResults.set(c, {...e.detail.result, readAt:Date.now()}); else keep(c, e.detail.result); schedule(); } });
const fresh = o => tx(o.freshness === 'current' ? 'fresh' : o.freshness);
const proof = o => o.id?.startsWith('pk:') ? tx('observatory') + (o.match === 'auto-exact' ? ' · ' + tx('auto') : o.match === 'user-confirmed' ? ' · ' + tx('userConf') : o.match === 'community-confirmed' ? ' · ' + tx('communityConf') : '') : /^(?:bz|li|ws):/.test(o.id || '') ? tx('web') : o.id?.startsWith('ek:') ? tx('basket') : o.sourceKind === 'licensed' ? tx('feed') : o.proofType === 'RECEIPT' || o.proofType === 'PRICE_TAG' ? tx('shopper') + ' · ' + tx(o.proofType === 'RECEIPT' ? 'receipt' : 'photo') : '';
const condLabel = o => o.conditional === 'LOYALTY_PROGRAM' ? tx('card') : o.conditional === 'QUANTITY' ? tx('multi') : tx('cond');
const where = o => esc(o.retailer) + (o.city ? ` · ${esc(o.city)}` : '');
/** One badge per chain: its cheapest current price (any source), cheapest first. Real offers only; a chain with no current
 *  price simply has no badge. */
function chainBadges(r) {
  const L = lang(), per = new Map();
  for (const o of r.offers) if (o.rankingEligible && o.retailerId && o.retailerId !== 'other') { const old = per.get(o.retailerId); if (!old || o.price < old.price) per.set(o.retailerId, o); }
  const list = [...per.values()].sort((a, b) => a.price - b.price);
  if (list.length < 2) return '';
  const shown = list.slice(0, 8), more = list.length - shown.length;
  return `<div class="fp72-chains" tabindex="0" role="list" aria-label="${esc(tx('chains'))}">` + shown.map((o, i) => `<span role="listitem" class="fp72-chip${i === 0 ? ' is-best' : ''}" title="${esc(o.source)} · ${esc(dateText(o.date, L))}"><b>${esc(o.retailer)}</b>${esc($(o, L))}${o.discounted ? '<i>%</i>' : ''}</span>`).join('') + (more > 0 ? `<span class="fp72-chip fp72-chip--more">${esc(tx('moreChains', more))}</span>` : '') + '</div>';
}

/* ---------- product view: a compact price strip INSIDE the grade card ----------
 * 75: the strip is mounted inside article.gradecard, right under the grade, points and A–E scale, for every layout the app
 * renders (graded hero, grade on hold, no grade, catalogue snapshot, demo samples, live). 72 skipped demo samples
 * (?demo=1) and mounted after the card, so the price sat below a tall card or was missing. */
const fmtShort = (d, L) => new Intl.DateTimeFormat(({el:'el-GR', fr:'fr-FR', de:'de-DE', es:'es-ES', it:'it-IT'})[L] || 'en-GB', {day:'numeric', month:'short', timeZone:'UTC'}).format(new Date(d + 'T00:00:00Z'));
function chainRow(r, best) {
  const L = lang(), per = new Map();
  for (const o of r.offers) if (o.rankingEligible && o.retailerId && o.retailerId !== 'other') { const old = per.get(o.retailerId); if (!old || o.price < old.price) per.set(o.retailerId, o); }
  const list = [...per.values()].sort((a, b) => a.price - b.price);
  if (list.length < 2) return '';
  const shown = list.slice(0, 6), more = list.length - shown.length;
  return `<div class="fp75__chains" tabindex="0" role="list" aria-label="${esc(tx('chains'))}">` + shown.map(o => `<span role="listitem" class="fp75__chip${o.retailerId === best.retailerId ? ' is-best' : ''}" title="${esc(o.source)} · ${esc(dateText(o.date, L))}"><b>${esc(o.retailer)}</b> ${esc($(o, L))}${o.discounted ? '<i>%</i>' : ''}</span>`).join('') + (more > 0 ? `<span role="listitem" class="fp75__chip fp75__chip--more">${esc(tx('moreChains', more))}</span>` : '') + '</div>';
}
const rangeText = (e, L) => e.pack ? `${euro(e.pack[0], L)} – ${euro(e.pack[2], L)}` : `${euro(e.unitLow, L)} – ${euro(e.unitHigh, L)}${t(L, e.unit)}`;
const elseLine = (r, L) => { const e = r.elsewhere?.[0]; return e ? `<p class="fp80-else">${esc(tx('elseLine', placeName(e.countryCode, L), $(e, L), e.retailer, dateText(e.date, L)))}</p>` : ''; };
/** Estimate state of the strip: labelled, dashed, and worded so it can never be read as a recorded price. */
function estimateStrip(code, r, head, link) {
  const L = lang(), e = r.estimate;
  const per = `<em>${esc(tx('estPer', euro(e.unitMid, L), t(L, e.unit)))}${e.pack ? ' · ' + esc(tx('perPack')) : ''}</em>`;
  const ex = e.examples.map(x => `<li><span>${esc(x.name)}</span><b>${esc($(x, L))}</b><small>${esc(dateText(x.date, L))} · ${esc(tx('sim'))} ${x.similarity}%</small></li>`).join('');
  const v = e.validation && e.validation.medianErrorPct != null && e.validation.tested ? `<p class="fp80-valid">${esc(tx('valid', Math.round(e.validation.medianErrorPct), e.validation.tested))}</p>` : '';
  return `${head(`<span class="fp75__pill fp80-pill-est">${esc(tx(e.cls === 'D' || e.cls === 'E' ? 'estRough' : 'estBadge'))}</span>`)}
    <div class="fp75__main fp80-estmain"><div class="fp75__price fp80-est"><small>${esc(tx('est'))}</small><strong>${esc(rangeText(e, L))}</strong>${per}</div>
      <div class="fp75__store"><b>${esc(tx('notRecorded'))}</b><span>${esc(tx('estNone'))}</span><span>${esc(e.cls === 'E' ? tx('estBasisType', e.n) : tx('estBasis', e.n))}</span></div></div>
    <p class="fp80-kind">${esc(tx('kinds')[e.kind] || '')}</p>
    <details class="fp80-why"><summary>${esc(tx('how'))}${chev}</summary><p>${esc(tx('howBody'))}</p>${ex ? `<ul class="fp80-ex">${ex}</ul>` : ''}${v}</details>
    ${elseLine(r, L)}<footer class="fp75__foot">${link(tx('addOwn'))}</footer>`;
}
/** 81: no recorded price for this barcode. Close products (same brand, similar name and size) are listed with THEIR OWN recorded
 *  price, source and date, under a heading that says they are not this product. No range, no "about", no estimate. */
function relatedStrip(r, head, link) {
  const L = lang();
  const items = r.related.map(x => `<li><span>${esc(x.name)}</span><b>${esc($(x, L))}</b><small>${esc(x.source)} · ${esc(dateText(x.date, L))}</small></li>`).join('');
  return `${head('')}<div class="fp75__none"><div><b>${esc(tx('none'))}</b><span>${esc(tx('noneRel'))}</span></div></div>
    <div class="fp81-rel"><p class="fp81-rel__head">${esc(tx('relHead'))}</p><ul class="fp80-ex fp81-rel__list">${items}</ul></div>
    ${elseLine(r, L)}<footer class="fp75__foot">${link(tx('addOwn'))}</footer>`;
}
/** 82: same-brand observatory products the shopper can confirm as this one. Their prices are NOT shown here: only after "This is it"
 *  does the card show that product's own dated chain prices, under a line saying whose choice it was (with "Change"). */
const packLabel = (p, L) => { if (!p) return ''; if (p.unit === 'pcs') return `${p.amount} ${({el:'τεμ.', fr:'pcs', de:'Stk.', es:'uds.', it:'pz.'})[L] || 'pcs'}`;
  const small = p.amount < 1, v = small ? Math.round(p.amount * 1000) : Math.round(p.amount * 100) / 100;
  return `${String(v).replace('.', ['el', 'fr', 'de', 'es', 'it'].includes(L) ? ',' : '.')}\u00a0${p.unit === 'kg' ? (small ? 'g' : 'kg') : (small ? 'ml' : 'L')}`; };
const otherPack = (a, b) => Boolean(a && b && (a.unit !== b.unit || Math.abs(a.amount - b.amount) / a.amount > 0.05));
function candList(code, r) {
  const L = lang();
  const items = r.candidates.map(x => `<li class="fp82-cand"><span class="fp82-cand__txt"><b>${esc(x.name)}</b><small>${esc(tx('candChains', x.chains))}${x.date ? ' · ' + esc(dateText(x.date, L)) : ''}${otherPack(r.pack, x.pack) ? ` · <em class="fp82-other">${esc(tx('candOtherSize'))}${x.pack ? ' (' + esc(packLabel(x.pack, L)) + ')' : ''}</em>` : ''}</small></span>
    <button type="button" class="fp82-cand__btn" data-fs-confirm="${esc(code)}" data-id="${esc(x.id)}" data-name="${esc(x.name)}">${esc(tx('candBtn'))}</button></li>`).join('');
  return `<div class="fp82-cands"><ul class="fp82-cand__list">${items}</ul><p class="fp82-cands__note">${esc(tx('candSub'))}</p></div>`;
}
function candStrip(code, r, head, link) {
  const L = lang();
  return `${head('')}<div class="fp75__none"><div><b>${esc(tx('none'))}</b><span>${esc(tx('candHead'))}</span></div></div>
    ${candList(code, r)}${elseLine(r, L)}<footer class="fp75__foot">${link(tx('addOwn'))}</footer>`;
}
// 91: the shared state of this device's choice, and a link shared by shoppers (with "Not this product")
const shared = new Map(); // code -> server answer to the last vote from this device
const sharedKey = code => { const a = shared.get(code); return a ? [a.status || a.error || '', a.confirmations ?? '', a.disputed ? 'd' : ''].join('/') : ''; };
const sharedText = a => !a ? '' : a.status === 'shared' ? tx('sharedOk', a.confirmations) : a.status === 'pending' ? tx('sharedPending', a.confirmations, a.needed) : a.disputed ? tx('commDisputed') : a.error === 'not_configured' || a.error === 'unavailable' || a.error === 'temporarily_unavailable' ? tx('sharedOff') : a.error === 'pack_mismatch' ? tx('sharedPack') : tx('sharedNo');
const confLine = (code, r) => r?.confirmed ? `<p class="fp82-conf"><span>${esc(r.confirmed.offers ? tx('confLine') : tx('confNone'))}${r.confirmed.name ? `: <b>${esc(r.confirmed.name)}</b>` : ''}</span><button type="button" class="fp82-conf__undo" data-fs-unconfirm="${esc(code)}">${esc(tx('confChange'))}</button></p>${shared.has(code) ? `<p class="fp82-shared">${esc(sharedText(shared.get(code)))}</p>` : ''}`
  : r?.community ? `<p class="fp82-conf fp91-comm"><span>${esc(tx('commLine', r.community.confirmations))}${r.community.name ? `: <b>${esc(r.community.name)}</b>` : ''}</span><button type="button" class="fp82-conf__undo" data-fs-dispute="${esc(code)}" data-id="${esc(r.community.id)}">${esc(tx('commDispute'))}</button></p>${shared.get(code)?.disputed ? `<p class="fp82-shared">${esc(tx('commDisputed'))}</p>` : ''}` : '';
/** 83: "Prices in 🇫🇷 France · EUR  [Change]". Change opens a country list; the choice stays on this device and every price is asked again for it. */
function pickerHTML(home, L) {
  const opts = marketsSorted(L).map(m => `<option value="${m.code}"${m.code === home ? ' selected' : ''}>${esc(marketFlag(m.code) + ' ' + m.name)}</option>`).join('');
  return `<div class="fp83-pick"><label for="fp83-sel">${esc(tx('pickLabel'))}</label><div class="fp83-pick__row"><select id="fp83-sel" data-fs-market-select><option value="">${esc(tx('pickAuto'))}</option>${opts}</select>
    <button type="button" class="fp83-change" data-fs-market-close>${esc(tx('pickClose'))}</button></div></div>`;
}
function marketLine(r, L) {
  const d = detectMarket(), home = r?.home || d.code; if (!home) return '';
  if (ui.picker) return pickerHTML(home, L);
  // 102: say where the country came from when it is not the shopper's own choice or the network's (the phone's clock, or only the browser language)
  const note = d.source === 'device' ? tx('srcDevice') : d.source === 'language' ? tx('srcLanguage') : '';
  // 102: the network says one country, the phone's clock another (a roaming SIM, a VPN): offer the phone's country, never switch silently
  const sg = d.suggest && d.code === home ? d.suggest : '';
  return `<p class="fp83-market"><span class="fp83-market__name">${esc(marketFlag(home))} ${esc(tx('inCountry', marketName(home, L), r?.currency || ''))}${note ? ` <small class="fp102-src">· ${esc(note)}</small>` : ''}</span><button type="button" class="fp83-change" data-fs-market-open>${esc(tx('change'))}</button></p>`
    + (sg ? `<p class="fp102-suggest"><span>${esc(tx('devHint', marketName(sg, L)))}</span><button type="button" class="fp83-change" data-fs-loc-use="${sg}">${esc(tx('devUse', marketName(sg, L)))}</button><button type="button" class="fp83-change" data-fs-loc-keep="${home}>${sg}">${esc(tx('devKeep'))}</button></p>` : '');
}
const typicalLine = (r, L) => { const y = r?.typical; if (!y) return '';
  return `<p class="fp83-typ"><span><b>${esc(tx('typical'))}</b> ${esc(money(y.price, L, y.currency, r.home))}</span><small>${esc(money(y.low, L, y.currency, r.home))} – ${esc(money(y.high, L, y.currency, r.home))} · ${esc(tx('typBasis', y.n, y.retailers))}</small></p>`; };
const noneSub = r => r?.home && r.home !== 'GR' ? tx('noneIn', marketName(r.home, lang())) : tx('noneSub');
/** 83: a price is never a dead end. Whatever is recorded, the shopper can open live prices for THIS barcode in their country (Google Shopping, which
 *  matches by GTIN). It is a search link, not a FoodScan price: the note says whose prices they are. */
const liveLink = (code, r) => `<p class="fp83-live"><a href="${esc(liveSearchURL(code))}" target="_blank" rel="noopener noreferrer">${esc(tx('liveShop'))} ↗</a><small>${esc(tx('liveShopNote'))}</small></p>`;
function stripHTML(code, r) { const html = stripHTML0(code, r) + (r?.livePending && r.best ? `<p class="fp80-stale fp105-wait" role="status">${esc(tx('liveWaitMore'))}</p>` : ''); return r && r.status !== 'temporarily_unavailable' ? html + liveLink(code, r) : html; }
function stripHTML0(code, r) {
  const L = lang();
  const head = pill => `<header class="fp75__head"><span class="fp75__eyebrow">${icon}${esc(tx('eyebrow'))}</span>${pill || ''}</header>${r ? marketLine(r, L) : ''}`;
  const link = (label, cta) => `<a class="fp75__all${cta ? ' fp75__all--cta' : ''}" href="${pricesURL(code)}">${esc(label)}${chev}</a>`;
  if (!r) return `${head('')}<div class="fp75__skel" aria-hidden="true"><i class="fp75__sk fp75__sk--price"></i><span><i class="fp75__sk"></i><i class="fp75__sk fp75__sk--short"></i></span></div><p class="fp75__sr">${esc(tx('checking'))}</p>`;
  // 102: nobody can tell which country this is (no choice, no network country, no phone clock, no language region): no prices, and the shopper chooses a country
  if (r.status === 'market_unknown') return `${head('')}<div class="fp75__none"><div><b>${esc(tx('whereTitle'))}</b><span>${esc(tx('whereSub'))}</span></div></div>${pickerHTML('', L)}`;
  // 84: the shops' web search is still running (the app asks again by itself and replaces this when it finishes)
  if (r.webPending && !r.best && !r.latest) return `${head('')}<div class="fp75__none"><div><b>${esc(tx('webWait'))}</b><span>${esc(tx('webWaitSub'))}</span></div></div>`;
  if (r.status === 'temporarily_unavailable') return `${head('')}<div class="fp75__none"><div><b>${esc(tx('na'))}</b><span>${esc(tx('down'))}</span></div><button type="button" class="fp75__all" data-fp71-retry="${esc(code)}">${esc(tx('retry'))}</button></div>`;
  if (r.status === 'incomplete' && !r.best && !r.latest) return `${head('')}<div class="fp75__none"><div><b>${esc(tx('na'))}</b><span>${esc(tx('partial'))}</span></div><button type="button" class="fp75__all" data-fp71-retry="${esc(code)}">${esc(tx('retry'))}</button></div>`;
  const b = r.best;
  if (b) {
    // 83: older = this market's other usable prices; unusual and other-currency prices and other countries are listed on the Prices page but not counted here
    const total = r.offers.filter(o => !o.suspect && !o.otherCurrency).length;
    const sub = b.conditional ? esc(tx('condSub', condLabel(b), b.regularPrice ? $(b, L, 'regularPrice') : '')) : esc(tx('of', r.currentCount, r.retailerCount)) + (r.spread > 0 ? ` · ${esc(tx('upTo', euro(r.spread, L)))}` : '');
    const scope = b.storeScope === 'national' ? tx('national') : b.storeScope === 'online' ? tx('online') : '';
    return `${head(`<span class="fp75__pill">${esc(fresh(b))}</span>`)}
      <div class="fp75__main"><div class="fp75__price"><strong>${esc($(b, L))}</strong>${b.unitPrice != null ? `<em>${esc(unitText(b, L))}</em>` : ''}</div>
        <div class="fp75__store"><b>${where(b)}</b><span>${esc(fmtShort(b.date, L))} · ${esc(whenText(b, L))}${b.discounted && !b.conditional ? ' · ' + esc(tx('offer')) : ''}</span><span class="fp75__src">${esc(scope || b.source)}</span></div></div>
      ${chainRow(r, b)}${typicalLine(r, L)}${confLine(code, r)}
      <footer class="fp75__foot"><span>${sub}</span>${link(total > r.currentCount ? tx('seeAllOld', r.currentCount, total - r.currentCount) : tx('seeAll', total), true)}</footer>`;
  }
  // 82: the confirmed product is sold in another pack size: its lowest price leads, named by ITS pack, never ranked as this barcode's
  const os = r.confirmed ? r.offers.filter(o => o.packMismatch && o.freshness === 'current').sort((a, b) => a.price - b.price) : [];
  if (os.length) { const o = os[0];
    return `${head(`<span class="fp75__pill fp75__pill--stale">${esc(tx('otherPackPill'))}</span>`)}
      <div class="fp75__main"><div class="fp75__price"><small class="fp80-lead">${esc(tx('otherPackLead', packLabel(o.observedPack, L)))}</small><strong>${esc($(o, L))}</strong>${o.unitPrice != null ? `<em>${esc(unitText(o, L))}</em>` : ''}</div>
        <div class="fp75__store"><b>${where(o)}</b><span>${esc(fmtShort(o.date, L))} · ${esc(whenText(o, L))}</span><span class="fp75__src">${esc(tx('national'))}</span></div></div>
      <p class="fp80-stale">${esc(tx('otherPackNote', packLabel(o.observedPack, L), packLabel(r.pack, L)))}</p>${confLine(code, r)}
      <footer class="fp75__foot"><span>${esc(tx('otherPackCount', new Set(os.map(x => x.retailerId)).size))}</span>${link(tx('allStores'), true)}</footer>`; }
  // 80: no current price. Lead with the last recorded price (shown with its age), else a labelled estimate, else an explicit "no verified price".
  const last = r.latest;
  if (last) return `${head(`<span class="fp75__pill fp75__pill--stale">${esc(tx('agePill', whenText(last, L)))}</span>`)}
      <div class="fp75__main"><div class="fp75__price"><small class="fp80-lead">${esc(tx('last'))}</small><strong>${esc($(last, L))}</strong>${last.unitPrice != null ? `<em>${esc(unitText(last, L))}</em>` : ''}</div>
        <div class="fp75__store"><b>${where(last)}</b><span>${esc(fmtShort(last.date, L))} · ${esc(whenText(last, L))}</span><span class="fp75__src">${esc(last.storeScope === 'national' ? tx('national') : last.storeScope === 'online' ? tx('online') : last.source)}</span></div></div>
      <p class="fp80-stale${r.livePending && last.liveUnconfirmed ? ' fp105-wait" role="status' : ''}">${esc(last.liveUnconfirmed ? tx(r.livePending ? 'liveWait' : 'liveFail') : tx('stale', whenText(last, L)))}</p>${typicalLine(r, L)}${confLine(code, r)}${r.candidates?.length ? `<p class="fp81-rel__head fp82-cands__head">${esc(tx('candHeadNow'))}</p>${candList(code, r)}` : ''}${elseLine(r, L)}<footer class="fp75__foot">${link(tx('allStores'))}</footer>`;
  if (r.confirmed) return `${head('')}${confLine(code, r)}${elseLine(r, L)}<footer class="fp75__foot">${link(tx('addOwn'))}</footer>`;
  if (r.candidates?.length) return candStrip(code, r, head, link);
  if (r.related?.length) return relatedStrip(r, head, link);
  if (r.elsewhere?.length) return `${head('')}<div class="fp75__none"><div><b>${esc(tx('none'))}</b><span>${esc(noneSub(r))}</span></div></div>${elseLine(r, L)}<footer class="fp75__foot">${link(tx('addOwn'))}</footer>`;
  return `${head('')}<div class="fp75__none"><div><b>${esc(tx('none'))}</b><span>${esc(noneSub(r))}</span></div>${link(tx('addShort'))}</div>`;
}
/** Where the strip goes: inside the grade card, under the A–E scale (else the points row, else the verdict), so it is the
 *  next thing read after the grade. Falls back to under the product name when a layout has no grade card. */
function anchorOf(hero) {
  const card = hero.querySelector('article.gradecard, .gradecard');
  if (card) { const a = card.querySelector(':scope > .snip__scale') || card.querySelector(':scope > .snip__score') || card.querySelector(':scope > .snip__core');
    if (a) return {parent: card, after: a};
    const foot = card.querySelector(':scope > .snip__foot'); return {parent: card, before: foot || null}; }
  const prod = hero.querySelector('.hero__prod'); return prod ? {parent: hero, after: prod} : {parent: hero, before: null};
}
/** The barcode is not in Open Food Facts, so no grade card exists: the price (or estimate) is still the most useful thing to show. */
function paintStandalone(code, view) {
  const page = view.querySelector('#instant-calc')?.closest('.page'); if (!page) return;
  let box = page.querySelector(':scope > .fp75.fp80-standalone');
  if (box && box.dataset.code !== code) { box.remove(); box = null; }
  const r = results.get(code) || null, state = lang() + ':' + sharedKey(code) + ':' + (ui.picker ? 'pick:' : '') + (r?.home || '') + (detectMarket().suggest || '') + ':' + (r ? (r.status + ':' + (r.best?.id || r.latest?.id || '') + ':' + r.offers.length + ':' + (r.estimate ? r.estimate.cls + r.estimate.unitMid : '') + ':' + (r.confirmed?.id || '') + ':' + (r.candidates?.length || 0) + ':' + (r.typical?.price || '') + (r.livePending ? ':checking' : '')) : 'wait'); // 105: the "checking the shop's page" note is part of what is drawn
  if (!box) { box = document.createElement('section'); box.className = 'fp75 fp80-standalone'; box.dataset.code = code; box.setAttribute('aria-live', 'polite'); page.prepend(box); }
  if (box.dataset.state === state) return;
  box.dataset.state = state; box.setAttribute('aria-label', tx('eyebrow')); box.setAttribute('aria-busy', r ? 'false' : 'true');
  box.classList.toggle('fp80-is-est', r?.lead?.kind === 'estimate'); box.classList.toggle('fp80-is-none', r?.lead?.kind === 'none');
  const name = r?.productName || r?.product?.name || '';
  box.innerHTML = (name ? `<p class="fp80-prod">${esc(name)}</p>` : '') + stripHTML(code, r);
}
function paintProduct() {
  const code = productCode();
  const view = document.querySelector('#view');
  // Remove strips left from another product, from the 72 layout, or duplicates.
  document.querySelectorAll('#view .fp71, #view .fp-price-bridge').forEach(n => n.remove());
  if (!code || !view) { view?.querySelectorAll('.fp75').forEach(n => n.remove()); return; }
  const hero = view.querySelector('article.hero');
  if (!hero) { paintStandalone(code, view); return; }
  view.querySelectorAll('.fp80-standalone').forEach(n => n.remove());
  if (!hero.textContent.includes(code)) return; // the old product is still on screen; the new one paints on the next mutation
  const at = anchorOf(hero);
  const all = [...view.querySelectorAll('.fp75')];
  let box = all.find(n => n.parentElement === at.parent && n.dataset.code === code) || null;
  all.forEach(n => { if (n !== box) n.remove(); });
  const r = results.get(code) || null, state = lang() + ':' + sharedKey(code) + ':' + (ui.picker ? 'pick:' : '') + (r?.home || '') + (detectMarket().suggest || '') + ':' + (r ? (r.status + ':' + (r.best?.id || r.latest?.id || '') + ':' + r.offers.length + ':' + (r.estimate ? r.estimate.cls + r.estimate.unitMid : '') + ':' + (r.confirmed?.id || '') + ':' + (r.candidates?.length || 0) + ':' + (r.typical?.price || '') + (r.livePending ? ':checking' : '')) : 'wait'); // 105: the "checking the shop's page" note is part of what is drawn
  if (!box) { box = document.createElement('section'); box.className = 'fp75'; box.dataset.code = code; box.setAttribute('aria-live', 'polite'); }
  const placed = at.after ? at.after.nextElementSibling === box : (at.before ? at.before.previousElementSibling === box : at.parent.lastElementChild === box);
  if (!placed) { if (at.after) at.after.after(box); else at.parent.insertBefore(box, at.before); }
  if (box.dataset.state === state) return;
  box.dataset.state = state;
  box.setAttribute('aria-label', tx('eyebrow'));
  box.setAttribute('aria-busy', r ? 'false' : 'true');
  box.classList.toggle('fp75--has', Boolean(r?.best));
  box.classList.toggle('fp80-is-est', r?.lead?.kind === 'estimate');
  box.classList.toggle('fp80-is-none', r?.lead?.kind === 'none');
  box.classList.toggle('fp75--wait', !r);
  box.innerHTML = stripHTML(code, r);
}

/* ---------- Better choices ---------- */
function chipHTML(r, base) {
  const L = lang();
  if (!r) return `<span class="fp71c fp71c--wait">${icon}…</span>`;
  const b = r.best;
  if (!b && r.latest) { const o = r.latest; return `<span class="fp71c fp71c--old" title="${esc(o.retailer)} · ${esc(dateText(o.date, L))} · ${esc(o.source)}">${icon}<b>${esc($(o, L))}</b>${o.unitPrice != null ? `<small>${esc(unitText(o, L))}</small>` : ''}<small>${esc(tx('agePill', whenText(o, L)))}</small></span>`; }
  if (!b && r.estimate) return `<span class="fp71c fp71c--est" title="${esc(tx('notRecorded'))}">${icon}<b>≈ ${esc(rangeText(r.estimate, L))}</b><small>${esc(tx(r.estimate.cls === 'D' || r.estimate.cls === 'E' ? 'estRough' : 'estBadge'))}</small></span>`;
  if (!b) return `<span class="fp71c fp71c--na">${icon}${esc(tx('noPrice'))}</span>`;
  const d = unitDelta(base, r);
  // 78: a saving is claimed only when both prices are per kg or both per litre (unitDelta returns null otherwise).
  const nc = !d && base?.best && b ? `<span class="fp71c__d fp71c__d--nc">${esc(tx('notComparable'))}</span>` : '';
  const delta = d && !d.same ? (d.cheaper ? `<span class="fp71c__d fp71c__d--down">${esc(tx('alsoCheaper'))} · −${esc(euro(-d.diff, L))}${esc(t(L, d.basis))}</span>`
    : `<span class="fp71c__d fp71c__d--up">${esc(tx('perKgMore', euro(d.diff, L)))}${esc(t(L, d.basis))} ${esc(tx('vsThis'))}</span>`) : '';
  return `<span class="fp71c" title="${esc(b.retailer)} · ${esc(dateText(b.date, L))} · ${esc(b.source)}">${icon}<b>${esc($(b, L))}</b>${b.unitPrice != null ? `<small>${esc(unitText(b, L))}</small>` : ''}<small>${esc(b.retailer)}</small>${b.conditional ? `<small>${esc(condLabel(b))}</small>` : ''}</span>${delta}${nc}`;
}
function paintChoices() {
  const code = productCode(); if (!code) return;
  const base = results.get(code) || null;
  const cards = [...document.querySelectorAll('#view .card--swap .swap, #view .card--swap li.prow, #view .card--swap article.nutrition-option')].slice(0, 10);
  for (const card of cards) {
    const a = card.querySelector('a[href^="#/p/"]'); const alt = a?.getAttribute('href').match(/#\/p\/(\d{8,14})/)?.[1];
    if (!alt || alt === code) continue;
    const r = want(alt, {cheap:true});
    const state = (r ? r.status + ':' + (r.best?.id || r.latest?.id || '') + ':' + (r.estimate ? r.estimate.cls + r.estimate.unitMid : '') : 'wait') + '|' + (base?.best?.id || '');
    let slot = card.querySelector('.fp71-slot');
    if (slot && slot.dataset.state === state) continue;
    if (!slot) {
      slot = document.createElement('span'); slot.className = 'fp71-slot';
      const host = card.querySelector('.swap__chips') || card.querySelector('.prow__text') || card.querySelector('a');
      if (card.matches('.nutrition-option')) (card.querySelector('.row-actions') || card.lastElementChild)?.before(slot); // "Compare nutrition" cards: the price sits above the buttons
      else host.append(slot);
    }
    slot.dataset.state = state; slot.innerHTML = chipHTML(r, base);
  }
}

/* ---------- Compare ---------- */
function paintCompare() {
  const codes = compareCodes(); if (!codes) return;
  const rs = codes.map(c => want(c));
  const L = lang();
  const heads = [...document.querySelectorAll('#view .vs2__head')];
  heads.forEach((h, i) => {
    const c = h.getAttribute('href')?.match(/#\/p\/(\d{8,14})/)?.[1]; const k = codes.indexOf(c); if (k < 0) return;
    const r = rs[k], other = rs[1 - k];
    const state = r ? r.status + ':' + (r.best?.id || r.latest?.id || '') + ':' + (r.estimate ? r.estimate.cls + r.estimate.unitMid : '') + '|' + (other?.best?.id || '') : 'wait';
    let s = h.querySelector('.fp71-slot');
    if (s && s.dataset.state === state) return;
    if (!s) { s = document.createElement('span'); s.className = 'fp71-slot fp71-slot--vs'; h.append(s); }
    s.dataset.state = state; s.innerHTML = chipHTML(r, null);
  });
  const table = document.querySelector('#view .cmpn__table'); if (!table) return;
  const order = [...table.querySelectorAll('thead th a[href^="#/p/"]')].map(a => a.getAttribute('href').match(/#\/p\/(\d{8,14})/)?.[1]);
  const state = rs.map(r => r ? r.status + ':' + (r.best?.id || r.latest?.id || '') + ':' + (r.estimate ? r.estimate.cls + r.estimate.unitMid : '') : 'wait').join('|');
  let row = table.querySelector('tr.fp71-row');
  if (row && row.dataset.state === state) return;
  if (!row) { row = document.createElement('tr'); row.className = 'fp71-row'; const first = table.querySelector('tbody tr'); first ? first.after(row) : table.querySelector('tbody')?.append(row); }
  const bests = order.map(c => rs[codes.indexOf(c)]?.best || null);
  const comparable = bests.every(b => b && b.unitPrice != null) && bests[0].unitBasis === bests[1].unitBasis && Boolean(bests[0].conditional) === Boolean(bests[1].conditional);
  const win = comparable ? (bests[0].unitPrice < bests[1].unitPrice ? 0 : bests[1].unitPrice < bests[0].unitPrice ? 1 : -1) : -1;
  row.dataset.state = state;
  const bothPriced = bests.every(Boolean);
  row.innerHTML = `<th scope="row">${esc(tx('row'))}${bothPriced && !comparable ? `<small class="fp71-nc">${esc(tx('unitNote'))}</small>` : ''}</th>` + order.map((c, i) => {
    const r = rs[codes.indexOf(c)], b = r?.best;
    if (!r) return '<td class="fp71-cell">…</td>';
    if (!b && r.latest) { const o = r.latest; return `<td class="fp71-cell fp71-cell--old"><a href="${pricesURL(c)}"><b>${esc($(o, L))}</b>${o.unitPrice != null ? `<small>${esc(unitText(o, L))}</small>` : ''}<small>${esc(o.retailer)} · ${esc(dateText(o.date, L))}</small></a></td>`; }
    if (!b && r.estimate) return `<td class="fp71-cell fp71-cell--est"><a href="${pricesURL(c)}"><b>≈ ${esc(rangeText(r.estimate, L))}</b><small>${esc(tx('estBadge'))}</small></a></td>`;
    if (!b) return `<td class="fp71-cell fp71-cell--na"><a href="${pricesURL(c)}">${esc(tx('na'))}</a></td>`;
    return `<td class="fp71-cell${i === win ? ' is-win' : ''}"><a href="${pricesURL(c)}"><b>${esc($(b, L))}</b>${b.unitPrice != null ? `<small>${esc(unitText(b, L))}</small>` : ''}<small>${esc(b.retailer)} · ${esc(dateText(b.date, L))}</small>${b.conditional ? `<small>${esc(condLabel(b))}</small>` : ''}</a></td>`;
  }).join('');
}

/* ---------- navigation (kept from 65) ---------- */
function addPricesLink() {
  const nav = document.querySelector('.top__nav');
  if (nav && !nav.querySelector('.fp-prices-link')) { const a = document.createElement('a'); a.className = 'fp-prices-link'; a.href = '/prices/'; a.textContent = tx('navPrices'); nav.insertBefore(a, nav.querySelector('[data-nav="demo"]') || null); }
  const dock = document.querySelector('.dock');
  if (dock && !dock.querySelector('.fp-dock-prices')) { const a = document.createElement('a'); a.className = 'fp-dock-prices'; a.href = '/prices/'; a.innerHTML = icon + `<span>${esc(tx('navPrices'))}</span>`; dock.insertBefore(a, dock.querySelector('[data-nav="me"]') || null); dock.classList.add('fp-dock-expanded'); }
  const code = productCode();
  for (const a of document.querySelectorAll('.fp-prices-link, .fp-dock-prices')) { a.href = code ? pricesURL(code) : '/prices/'; const l = tx('navPrices'), s = a.matches('.fp-dock-prices') ? a.querySelector('span') : a; if (s && s.textContent !== l) s.textContent = l; }
}


/* ---------- calmer product page (75) ----------
 * Secondary sections (how the grade was worked out, portions, sources, guides) start folded behind their heading;
 * comparison options show the product, kind and actions, with the full label table one tap away, and only the first
 * three options until "show more". Nothing is removed or moved: classes only, so the app's own re-renders stay intact. */
const FOLD = new Set(['why-title', 'portion-title', 'trust-title', 'gutf-comp-title']);
const openKey = id => 'fp75:open:' + id;
const isOpen = id => { try { return sessionStorage.getItem(openKey(id)) === '1'; } catch { return false; } };
const chevDown = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
function tidy() {
  if (!productCode()) return;
  for (const sec of document.querySelectorAll('#view section.card[aria-labelledby]')) {
    const id = sec.getAttribute('aria-labelledby'); if (!FOLD.has(id)) continue;
    const head = sec.querySelector(':scope > header.card__head'); if (!head) continue;
    let btn = head.querySelector(':scope > .fp75-fold__btn');
    if (!btn) { btn = document.createElement('button'); btn.type = 'button'; btn.className = 'fp75-fold__btn'; btn.innerHTML = chevDown; btn.setAttribute('aria-controls', id); head.append(btn);
      sec.classList.add('fp75-fold'); sec.classList.toggle('is-folded', !isOpen(id)); }
    const folded = sec.classList.contains('is-folded'), label = (folded ? tx('show') : tx('hide')) + ': ' + (document.getElementById(id)?.textContent.trim() || '');
    if (btn.getAttribute('aria-label') !== label) { btn.setAttribute('aria-label', label); btn.setAttribute('aria-expanded', String(!folded)); }
  }
  for (const list of document.querySelectorAll('#view .nutrition-options')) {
    const opts = [...list.querySelectorAll(':scope > .nutrition-option')];
    opts.forEach((o, i) => {
      if (!o.querySelector(':scope > .fp75-facts')) {
        const table = o.querySelector(':scope > table'); if (!table) return;
        o.classList.add('fp75-tight');
        const b = document.createElement('button'); b.type = 'button'; b.className = 'fp75-facts'; b.setAttribute('aria-expanded', 'false');
        b.innerHTML = `<span>${esc(tx('facts'))}</span>${chevDown}`; table.before(b);
      }
      if (!list.dataset.fp75All) o.classList.toggle('fp75-later', i >= 3);
    });
    let more = list.querySelector(':scope > .fp75-more');
    const hidden = list.dataset.fp75All ? 0 : Math.max(0, opts.length - 3);
    if (hidden && !more) { more = document.createElement('button'); more.type = 'button'; more.className = 'fp75-more'; list.append(more); }
    if (more) { if (!hidden) more.remove(); else { const l = tx('moreOpts', hidden); if (more.textContent !== l) more.textContent = l; } }
  }
}
document.addEventListener('click', e => {
  const head = e.target.closest?.('.fp75-fold > header.card__head');
  if (head && !e.target.closest('a, button:not(.fp75-fold__btn), input, select, summary')) {
    const sec = head.parentElement, id = sec.getAttribute('aria-labelledby'); const folded = !sec.classList.toggle('is-folded') ? false : true;
    try { sessionStorage.setItem(openKey(id), folded ? '0' : '1'); } catch {}
    tidy(); return;
  }
  const f = e.target.closest?.('.fp75-facts');
  if (f) { const o = f.closest('.nutrition-option'); const open = o.classList.toggle('is-open'); f.setAttribute('aria-expanded', String(open)); f.querySelector('span').textContent = open ? tx('hideFacts') : tx('facts'); return; }
  const m = e.target.closest?.('.fp75-more');
  if (m) { const list = m.parentElement; list.dataset.fp75All = '1'; list.querySelectorAll('.fp75-later').forEach(o => o.classList.remove('fp75-later')); m.remove(); }
});

/* The grade word ("Εξαιρετικό") is one long word in Greek: shrink it to its column instead of letting it run under the seal. */
function fitVerdict() {
  for (const el of document.querySelectorAll('#view .snip__verdict > strong')) {
    const box = el.parentElement.clientWidth; if (!box) continue;
    const cur = parseFloat(getComputedStyle(el).fontSize), base = Number(el.dataset.fp75Fs) || cur;
    if (!el.dataset.fp75Fs) el.dataset.fp75Fs = String(cur);
    const r = document.createRange(); r.selectNodeContents(el); const w = r.getBoundingClientRect().width; if (!w) continue;
    const natural = w * base / cur, target = Math.max(18, Math.min(base, base * box / natural * 0.97));
    if (Math.abs(target - cur) > 0.5) el.style.fontSize = target >= base ? '' : target.toFixed(1) + 'px';
  }
}
addEventListener('resize', () => { try { fitVerdict(); } catch {} });
document.fonts?.ready?.then(() => { try { fitVerdict(); } catch {} });

let timer = 0;
/** A long product name is clamped to three lines and a smaller size, so it stays inside the grade card. */
function longNames() { document.querySelectorAll('#view .hero__name h1').forEach(h => { const long = h.textContent.trim().length > 26; if (h.classList.contains('fs80-long') !== long) { h.classList.toggle('fs80-long', long); if (long) h.title = h.textContent.trim(); } }); }
/** 94: once per product per visit, what the product page could show (grade tier, price tier, photo) is counted by the server, without any id
 *  (POST /api/prices/outcome, daily counts only; skipped under Do Not Track / Global Privacy Control). It tells the owner which opened products miss what. */
const reported = new Set();
function reportOutcome(code) {
  if (!code || reported.has(code)) return;
  if (navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true) { reported.add(code); return; }
  const r = results.get(code), qk = globalThis.__fs85quick?.get(code), hero = document.querySelector('#view article.hero');
  if (!r || r.status === 'temporarily_unavailable' || (r.webPending && !r.best && !r.latest) || !hero || !hero.textContent.includes(code)) return;
  const gc = hero.querySelector('.gradecard'), shown = /^[A-E]$/i.test(gc?.dataset.grade || ''); // the app's own grade card: the grade reader is never started for it
  const hasSavedLabel = Boolean(hero.querySelector('.fr85 .fg85--label'));
  if (!shown && !hasSavedLabel && (!qk || qk.state === 'loading')) return;
  const pending = hero.querySelector('img'); if (pending && !pending.complete) { pending.addEventListener('load', () => reportOutcome(code), {once:true}); pending.addEventListener('error', () => setTimeout(() => reportOutcome(code), 50), {once:true}); return; }
  reported.add(code);
  const grade = shown || qk?.q?.reason === 'app-has-grade' ? 'source' : (hasSavedLabel || qk?.kind === 'quick' || qk?.kind === 'similar') ? 'estimated' : qk?.kind === 'exempt' ? 'exempt' : 'none';
  const price = r.best ? 'current' : r.latest ? 'older' : r.estimate ? 'estimate' : 'none';
  const img = hero.querySelector('img'), photo = Boolean(img && img.complete && img.naturalWidth > 0); // a failed photo is replaced by an illustration
  try { fetch('/api/prices/outcome', {method:'POST', keepalive:true, headers:{'Content-Type':'application/json'}, body:JSON.stringify({barcode:code, grade, price, photo})}).catch(() => {}); } catch {}
}
function paint() { timer = 0; addPricesLink(); const pc = productCode(); want(pc); compareCodes()?.forEach(c => want(c)); paintProduct(); paintChoices(); paintCompare(); try { tidy(); fitVerdict(); longNames(); } catch {} try { reportOutcome(pc); } catch {} }
function schedule() { if (!timer) timer = setTimeout(paint, 60); }
// 78: arriving at a product straight from the scanner is a rescan: ask every source again (device and edge copies skipped).
let lastRoute = route();
function onRoute() {
  const now = route(), fromScan = /^\/(?:scan|s)(?:[/?]|$)/.test(lastRoute) && now !== lastRoute; lastRoute = now;
  want(productCode(), {fresh:fromScan && Boolean(productCode())}); compareCodes()?.forEach(c => want(c)); schedule();
}
/* 83: market choice. A change drops every answer held for the old market and asks again for the new one. */
const marketChanged = () => { results.clear(); asked.clear(); cheapResults.clear(); cheapAsked.clear(); ui.picker = false; schedule(); };
addEventListener('foodscan:market', marketChanged);
document.addEventListener('change', e => { const sel = e.target.closest?.('[data-fs-market-select]'); if (!sel) return; setMarket(sel.value); });
document.addEventListener('click', e => {
  if (e.target.closest?.('[data-fs-market-open]')) { ui.picker = true; schedule(); setTimeout(() => document.getElementById('fp83-sel')?.focus(), 80); return; }
  if (e.target.closest?.('[data-fs-market-close]')) { ui.picker = false; schedule(); return; }
  const lu = e.target.closest?.('[data-fs-loc-use]'); if (lu) { setMarket(lu.getAttribute('data-fs-loc-use')); return; }   // 102: the phone's country, on the shopper's tap
  const lk = e.target.closest?.('[data-fs-loc-keep]'); if (lk) { const [from, to] = String(lk.getAttribute('data-fs-loc-keep')).split('>'); dismissSuggestion(from, to); schedule(); return; }
  const c = e.target.closest?.('[data-fs-confirm]');
  if (c) { const code = c.dataset.fsConfirm; setConfirmed(code, {id:c.dataset.id, name:c.dataset.name}); want(code, {fresh:true}); schedule();
    shareConfirmation(code, c.dataset.id, 1).then(a => { shared.set(code, a); schedule(); }); return; } // 91: also a vote for everyone
  const u = e.target.closest?.('[data-fs-unconfirm]');
  if (u) { const code = u.dataset.fsUnconfirm, prev = confirmedFor(code); setConfirmed(code, null); shared.delete(code); want(code, {fresh:true}); schedule(); if (prev?.id) shareConfirmation(code, prev.id, 0); return; }
  const d = e.target.closest?.('[data-fs-dispute]');
  if (d) { const code = d.dataset.fsDispute; d.disabled = true; shareConfirmation(code, d.dataset.id, -1).then(a => { shared.set(code, {...a, disputed:true}); forgetPrices(code); want(code, {fresh:true}); schedule(); }); return; }
  const b = e.target.closest?.('[data-fp71-retry]'); if (!b) return;
  want(b.dataset.fp71Retry, {fresh:true}); schedule();
});
function start() {
  const host = document.getElementById('app');
  if (host) new MutationObserver(schedule).observe(host, {childList:true, subtree:true});
  addEventListener('hashchange', onRoute); addEventListener('popstate', onRoute);
  onRoute();
}
onRoute(); // the request leaves now, in parallel with the app's own product lookup
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true}); else start();

/* ---------- updates (75): a stale service worker must never keep an old build on a phone ----------
 * sw.js now activates new builds immediately (skipWaiting + clients.claim). When the controlling worker changes to a
 * different build, the page reloads itself if it is in the background or idle on a non-input route; otherwise it shows a
 * small refresh bar so a scan or typing is never interrupted. */
export const BUILD = 'foodscan-105.0.0';
function updateBar() {
  if (document.querySelector('.fp75-update')) return;
  const bar = document.createElement('div'); bar.className = 'fp75-update'; bar.setAttribute('role', 'status');
  bar.innerHTML = `<span>${esc(tx('update'))}</span><button type="button">${esc(tx('reload'))}</button>`;
  bar.querySelector('button').addEventListener('click', () => location.reload());
  document.body.append(bar);
}
function onNewBuild() {
  const busy = /^\/(?:scan|s)(?:[/?]|$)/.test(route()) || document.activeElement?.matches?.('input, textarea, select');
  if (document.visibilityState === 'hidden' || !busy) location.reload(); else updateBar();
}
if ('serviceWorker' in navigator) {
  const sw = navigator.serviceWorker; let handled = false;
  const ask = w => new Promise(res => { if (!w) return res(null); const ch = new MessageChannel(); const to = setTimeout(() => res(null), 1500);
    ch.port1.onmessage = e => { clearTimeout(to); res(e.data?.build || null); }; try { w.postMessage({type:'GET_BUILD'}, [ch.port2]); } catch { res(null); } });
  sw.addEventListener('controllerchange', async () => {
    if (handled) return; const b = await ask(sw.controller);
    if (b && b.startsWith(BUILD)) return; // this page already runs the new build
    handled = true; onNewBuild();
  });
  // Check for a newer build when the app comes back to the foreground.
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sw.getRegistration().then(r => r?.update()).catch(() => {}); });
}
