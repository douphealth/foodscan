/* v77: Greek text for the discovery card (it shipped English only). Exact phrases are looked up; unknown text is left alone. */
const EL_TEXT={
  'EXPERIENCE THE CHALLENGE':'ΔΟΚΙΜΑΣΤΕ ΤΗΝ ΠΡΟΚΛΗΣΗ','DISCOVERY SAVED':'Η ΑΝΑΚΑΛΥΨΗ ΑΠΟΘΗΚΕΥΤΗΚΕ','MAKE THIS ONE COUNT':'ΑΞΙΟΠΟΙΗΣΤΕ ΑΥΤΗ ΤΗ ΣΑΡΩΣΗ',
  'Seven foods. A new perspective.':'Επτά τρόφιμα. Μια νέα ματιά.','Nice find.':'Ωραίο εύρημα.','Keep exploring.':'Συνεχίστε την εξερεύνηση.',
  'This food has a story.':'Κάθε τρόφιμο έχει μια ιστορία.','Explore the next.':'Ανακαλύψτε το επόμενο.',
  'Try the challenge with foods from your own kitchen. No account and no health rankings.':'Δοκιμάστε την πρόκληση με τρόφιμα από την κουζίνα σας. Χωρίς λογαριασμό και χωρίς κατάταξη υγείας.',
  'This product is in your private collection. Revisit its facts, explore more foods or share a report with a friend.':'Αυτό το προϊόν βρίσκεται στην ιδιωτική σας συλλογή. Ξαναδείτε τα στοιχεία του, εξερευνήστε κι άλλα τρόφιμα ή μοιραστείτε μια αναφορά με έναν φίλο.',
  'Your first seven discoveries are complete. Keep exploring, or save this as an additional find.':'Ολοκληρώσατε τις πρώτες επτά ανακαλύψεις σας. Συνεχίστε την εξερεύνηση ή αποθηκεύστε αυτό ως επιπλέον εύρημα.',
  'Save this product to your private seven-discovery collection, then uncover something interesting from your kitchen.':'Αποθηκεύστε αυτό το προϊόν στην ιδιωτική σας συλλογή επτά ανακαλύψεων και ανακαλύψτε κάτι ενδιαφέρον από την κουζίνα σας.',
  '◈ Saved FoodScan report available':'◈ Υπάρχει αποθηκευμένη αναφορά FoodScan','◈ Private discovery, no account needed':'◈ Ιδιωτική ανακάλυψη, χωρίς λογαριασμό',
  'Real products. Real curiosity.':'Πραγματικά προϊόντα. Πραγματική περιέργεια.','Try the 7-discovery quest':'Δοκιμάστε την αποστολή των 7 ανακαλύψεων','Explore my collection':'Δείτε τη συλλογή μου',
  'Save another discovery':'Αποθήκευση άλλης ανακάλυψης','Save this discovery':'Αποθήκευση αυτής της ανακάλυψης','My collection':'Η συλλογή μου','Share food report':'Κοινοποίηση αναφοράς',
  'Approved public product page available':'Διαθέσιμη εγκεκριμένη δημόσια σελίδα προϊόντος','◈ Private on this device':'◈ Ιδιωτικό στη συσκευή σας','◈ Check the pack for allergens':'◈ Ελέγξτε τη συσκευασία για αλλεργιογόνα',
  'Already recorded in your private challenge.':'Έχει ήδη καταγραφεί στην ιδιωτική σας πρόκληση.','Local storage is unavailable. Check privacy mode or browser storage settings.':'Η τοπική αποθήκευση δεν είναι διαθέσιμη. Ελέγξτε την ιδιωτική περιήγηση ή τις ρυθμίσεις αποθήκευσης του προγράμματος περιήγησης.',
  'Your 30-entry shelf is full. Remove an entry to make space.':'Το ράφι των 30 εγγραφών είναι γεμάτο. Αφαιρέστε μια εγγραφή για να αδειάσει χώρος.','This barcode did not pass its check-digit test.':'Αυτό το barcode δεν πέρασε τον έλεγχο ψηφίου ελέγχου.',
  'Could not save this barcode.':'Δεν ήταν δυνατή η αποθήκευση αυτού του barcode.','FoodScan report':'Αναφορά FoodScan',
  'Explore source-reported nutrition and ingredients. Always check the package.':'Δείτε τα διατροφικά στοιχεία και τα συστατικά όπως αναφέρονται στην πηγή. Ελέγχετε πάντα τη συσκευασία.',
  'The report link was handed to your share sheet.':'Ο σύνδεσμος της αναφοράς στάλθηκε στο μενού κοινοποίησης.','Report link copied.':'Ο σύνδεσμος αντιγράφηκε.',
};
const elOn=()=>document.documentElement.lang==='el';
function elText(s){
  if(!elOn()||typeof s!=='string')return s;
  const k=s.trim();if(EL_TEXT[k]!==undefined)return s.replace(k,EL_TEXT[k]);
  let m=k.match(/^Added privately: (\d+) of 7 discoveries\. Open My progress to explore your shelf\.$/);if(m)return `Προστέθηκε ιδιωτικά: ${m[1]} από 7 ανακαλύψεις. Ανοίξτε την πρόοδό μου για να δείτε το ράφι σας.`;
  m=k.match(/^(\d+) OF (\d+) FOUND$/);if(m)return `${m[1]} ΑΠΟ ${m[2]} ΒΡΕΘΗΚΑΝ`;
  m=k.match(/^Copy this report link: (.*)$/);if(m)return `Αντιγράψτε αυτόν τον σύνδεσμο: ${m[1]}`;
  m=k.match(/^Could not open sharing\. Copy this link: (.*)$/);if(m)return `Δεν άνοιξε η κοινοποίηση. Αντιγράψτε αυτόν τον σύνδεσμο: ${m[1]}`;
  return s;
}
function elLocalize(root){
  if(!elOn())return;
  const nodes=[],w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode()))nodes.push(n);
  for(const x of nodes){const t=elText(x.nodeValue);if(t!==x.nodeValue)x.nodeValue=t;}
  root.querySelectorAll('[aria-label]').forEach(el=>{const m=el.getAttribute('aria-label').match(/^(\d+) of (\d+) challenge discoveries recorded$/);if(m)el.setAttribute('aria-label',`${m[1]} από ${m[2]} ανακαλύψεις καταγράφηκαν`);});
}
/* ---- notify ---- */
