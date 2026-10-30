/** Product-use compatibility. Discovery hints never alter a product's nutrition or grading category.
 *
 * 62.0: a suggestion has to be the same KIND of product, not merely the same aisle. Every product resolves to one product type:
 *   1. a cross-family type when its name says so (pasta is never a cereal, a plant drink is never a nut, cocoa powder is never a
 *      chocolate bar, a ready meal is never a meat cut, tofu is never a sausage);
 *   2. otherwise the subtype of its family from the ordered lexicon below (English, Greek and the other languages found on Greek shelves),
 *      with a family default so that "Dark Chocolate" and "Milk Chocolate" are both tablets;
 * and two products are comparable only when their types are equal. Where a product's category tags share a specific, non-generic
 * category that is accepted as extra evidence for the same use; a different type is never rescued by a shared parent category. */
const fold = v => String(v || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ς/g, 'σ').replace(/ß/g, 'ss');
const has = (re, s) => re.test(s);

// 1. cross-family types, first match wins. Written against folded text (no accents, final sigma = σ).
const GLOBAL = [
 ['plant-drink', s => /(?:almond|oat|soy|soya|rice|coconut|hazelnut|cashew|pea|plant|vegetable|vegan|αμυγδαλ|βρωμ|σογια|ρυζι|καρυδα|φουντουκ|φυτικ|amande|avoine|mandel|hafer|mandorla|avena)[^|]{0,28}(?:drink|milk|boisson|bevanda|getrank|bebida|ροφημα|γαλα|lait|latte|milch|leche)|(?:ροφημα|γαλα|drink|milk|boisson|bevanda|lait)[^|]{0,18}(?:almond|oat|soy|soya|rice|coconut|hazelnut|αμυγδαλ|βρωμ|σογια|ρυζι|καρυδα|φουντουκ|plant|φυτικ)|plant-based-milk-alternatives|alpro|plant protein drink/.test(s) && !/seeds?(?![a-zα-ω])|σπορ/.test(s)],
 ['cocoa-powder', s => (/(?:^|[^a-zα-ω])(?:cocoa|cacao|κακαο)(?![a-zα-ω])/.test(s) && !/chocolat|σοκολατ|(?:^|[^a-zα-ω])bars?(?![a-zα-ω])|μπαρα|biscuit|cookie|cream|κρεμα|milk|γαλα|spread|drink|ροφημα|nuts?|candy|cereal|δημητριακ|ice|παγωτο|wafer|γκοφρετ|cake|κεικ/.test(s)) || /cocoa-powders?|cocoa-and-chocolate-powders/.test(s)],
 ['drinking-chocolate', s => /(?:chocolate|σοκολατ)[^|]{0,14}(?:drink|powder|ροφημα|σκονη)|(?:drink|ροφημα)[^|]{0,14}(?:chocolate|σοκολατ)|hot chocolate|goody cao|nesquik|benco|ovomaltine|ovaltine/.test(s)],
 ['stock-cube', s => /(?:^|[^a-zα-ω])ζωμοσ(?![a-zα-ω])|bouillon|stock cubes?|(?:^|[^a-zα-ω])broth(?![a-zα-ω])|κυβοι|κυβακια|gran?ulated stock/.test(s)],
 ['pasta-filled', s => /ravioli|tortellini|tortelloni|gnocchi|νιοκι|γεμιστα ζυμαρικ|cappelletti|agnolotti|ραβιολι|τορτελιν/.test(s)],
 ['pasta', s => /(?:^|[^a-zα-ω])spaghet|σπαγγετ|(?:^|[^a-zα-ω])penne(?![a-zα-ω])|πεννεσ|πενεσ|fusilli|φουσιλι|macaron|μακαρον|ζυμαρικ|κριθαρακι|(?:^|[^a-zα-ω])orzo(?![a-zα-ω])|lasagn|λαζανι|tagliatelle|ταλιατελ|fettuccin|rigatoni|ριγκατον|κοφτο μακαρον|κανελον|cannellon|farfalle|φαρφαλε|linguine|(?:^|[^a-zα-ω])pasta(?![a-zα-ω])|χυλοπιτ|φιδε(?![a-zα-ω])|τραχανα|κοφτοπιτ/.test(s) && !/sauce|σαλτσα|pesto|χωρισ|salad|σαλατα(?![a-zα-ω])/.test(s)],
 ['noodles', s => /noodle|ραμεν|ramen|νουντλ|vermicelli|ερμηνε/.test(s)],
 ['pizza', s => /(?:^|[^a-zα-ω])pizza|πιτσα|flammkuchen|calzone/.test(s) && !/sauce|σαλτσα|βαση|dough|ζυμη(?![a-zα-ω])/.test(s)],
 ['pizza-base', s => /(?:pizza|πιτσα)[^|]{0,12}(?:base|βαση|dough|ζυμη)|(?:βαση|ζυμη)[^|]{0,12}(?:pizza|πιτσα)/.test(s)],
 ['potato-fries', s => /pre-?fried potato|french fries|(?:^|[^a-zα-ω])fries(?![a-zα-ω])|προτηγανισμεν|πατατεσ τηγανητεσ|πατατεσ για τηγανισμα|oven chips|frozen potato|πατατακια φουρνου/.test(s) || /potatoes? (?:in|with)[^|]{0,12}oil/.test(s)],
 ['ready-meal', s => /mousak|μουσακα|pastitsi|παστιτσι|stuffed (?:tomato|pepper|vine)|γεμιστα(?: ντοματ| πιπερ|(?:^|[^a-zα-ω]))|ready meal|ετοιμο γευμα|γλυκοξιν|sweet (?:and|&) sour|with basmati|με μπασματι|(?:^|[^a-zα-ω])curry(?![a-zα-ω])|μαγειρευτ|ριζοτο|risotto|γιουβετσι|σουτζουκακ|gyros kit|brizola meal|lasagne ready/.test(s) && !/μπισκοτ|biscuit|cookie/.test(s)],
 ['meat-alternative', s => /(?:^|[^a-zα-ω])tofu(?![a-zα-ω])|τοφου|tempeh|seitan|(?:veggie|vegan|vegetarian|plant[- ]based|φυτικ|χορτοφαγικ)[^|]{0,22}(?:burger|sausage|chicken|nugget|schnitzel|mince|μπιφτεκ|λουκανικ|κοτοπουλ|ντονερ|steak|fillet)/.test(s)],
 ['cheese-vegan', s => /(?:vegan|plant[- ]based|φυτικ)[^|]{0,18}(?:cheese|τυρι)|(?:cheese|τυρι)[^|]{0,14}(?:vegan|φυτικ|plant)/.test(s)],
 ['puffed-cake', s => /rice[- ]?cakes?|ricecake|corn[- ]?cakes?|puffed[- ]cereal[- ]cakes?|wafle (?:kukurydz|ryz)|puffed (?:rice|corn)|ρυζογκοφρετ|πουφακια|puffed-corn-cakes|puffed-rice-cakes/.test(s)],
 ['sauce-condiment', s => /(?:^|[^a-zα-ω])(?:sauce|ketchup|mayonnaise|mustard|dressing|vinaigrette)(?![a-zα-ω])|σαλτσα|κετσαπ|μαγιονεζα|μουσταρδα/.test(s) && !/ice cream|παγωτο|pasta|ζυμαρικ/.test(s)],
 ['pastry-pie', s => /μπουγατσα|bougatsa|τυροπιτα|σπανακοπιτα|κρεατοπιτα|μηλοπιτα|κολοκυθοπιτα|(?:^|[^a-z])pie(?![a-z])|μπουρεκι|bourek/.test(s) && !/pizza|πιτσα/.test(s)],
 ['cream-dessert', s => /κρεμα (?:βανιλια|σοκολατα|καραμελε|ζαχαρωτη)|πουτιγκα|pudding|creme (?:caramel|brulee)|panna cotta|mousse|(?:^|[^a-zα-ω])μους(?![a-zα-ω])|ρυζογαλο|custard/.test(s) && !/μπισκοτ|biscuit|cookie|cake|κεικ/.test(s)],
 ['flavoured-milk-drink', s => /(?:^|[^a-zα-ω])(?:choco ?milk|chocolate milk|milko(?![a-zα-ω])|γαλα σοκολατουχο|σοκολατουχο γαλα|tou topou mas|τοσ τοπου μασ|ροφημα γαλακτοσ|ροφημα σοκολατασ|(?:milk|γαλα)[^|]{0,10}(?:chocolat|cocoa|σοκολατ|κακαο|strawberry|φραουλα|banana|μπανανα|vanilla|βανιλια|caramel|καραμελα))(?![a-zα-ω])/.test(s) && !/(?:^|[^a-zα-ω])bar(?![a-zα-ω])|cookie|biscuit/.test(s)]
];

// 2. family subtype lexicon: [subtype, name regex, category regex?], first match wins, `def` is the family default. Names are matched before categories.
const FAMILY = {
 spread: { def: 'sweet-spread', list: [
  ['jam', /(?:^|[^a-z])(?:jams?|marmalades?|fruit[- ]spreads?|confitures?|marmelad[ae])(?:[^a-z]|$)|μαρμελαδ|γλυκο του κουταλιου/],
  ['honey', /(?:^|[^a-z])(?:honey|honeys|miel)(?:[^a-z]|$)|μελι(?: |$|τ[οα])/],
  ['tahini', /tahin|ταχιν/],
  ['chocolate-spread', /chocolat.{0,24}spread|cocoa.{0,24}spread|hazelnut.{0,24}spread|nutella|πραλινα|αλ[εει]+μμα.{0,24}(?:κακαο|σοκολατ)|nocciolata|nucrema|merenda/],
  ['nut-butter', /peanut[- ]butter|almond[- ]butter|nut[- ]butter|cashew[- ]butter|puree.{0,16}(?:cacahuete|amande)|φυστικοβουτυρ|φιστικοβουτυρ|βουτυρο.{0,16}(?:αμυγδαλ|φιστικ)/],
  ['hummus', /hummus|houmous|χουμουσ/],
  ['savoury-dip', /tapenade|taram|tzatziki|τζατζικ|ταραμο|olive[- ]paste|melitzanosal|μελιτζανοσαλ|guacamole|dip(?![a-zα-ω])/]] },
 bread: { def: 'bread', list: [
  ['filled-sandwich', /sandwich|filled[- ]wrap|σαντουιτσ/],
  ['wrap', /tortilla|(?:^|[^a-zα-ω])wraps?(?![a-zα-ω])|τορτιγι/],
  ['pita', /(?:^|[^a-zα-ω])pita(?![a-zα-ω])|(?:^|[^a-zα-ω])pitta(?![a-zα-ω])|πιτα(?![a-zα-ω])|πιτεσ(?![a-zα-ω])|αραβικ|souvlaki bread|σουβλακι/],
  ['bagel', /bagel|μπαγκελ/],
  ['dry-bread', /crispbread|(?:^|[^a-zα-ω])rusks?(?![a-zα-ω])|breadsticks|φρυγανι|παξιμαδ|κριτσιν|κρισπ|crackers?|toasts? ?(?:slices|round)|rye (?:crisp|crackers)/],
  ['bread', /bread|pain(?![a-zα-ω])|ψωμι|ψωμακ|ψωμαι|τοστ|brot(?![a-zα-ω])|pane(?![a-zα-ω])|pan de/]] },
 yogurt: { def: 'yogurt', list: [['drinking-yogurt', /kefir|κεφιρ|drinking[- ]yog|drinkable|ayran|ariani|αριανι|ποσιμο/],['plant-yogurt', /(?:soy|soya|oat|coconut|almond|plant|vegan|φυτικ|σογια)[^|]{0,20}(?:yogh?urt|γιαουρτ)|(?:yogh?urt|γιαουρτ)[^|]{0,16}(?:soy|soya|oat|coconut|almond|plant|vegan|φυτικ|σογια)/],['yogurt', /yogh?urt|γιαουρ|skyr|σκυρ/]] },
 milk: { def: 'milk', list: [['powdered-milk', /powder|σκονη/],['condensed-milk', /condensed|evaporated|συμπυκνωμ|εβαπορε|ζαχαρουχο/],['flavoured-milk', /flavoured|flavored|chocolat|cocoa|κακαο|σοκολατ|strawberry|φραουλα|banana|μπανανα|vanilla|βανιλια/],['milk', /milk|lait|milch|γαλα(?:\s|$|κτοσ)/]] },
 sauce: { def: 'sauce', list: [['mayonnaise', /mayonnaise|μαγιονεζ|(?:^|[^a-zα-ω])mayo(?![a-zα-ω])/],['ketchup', /ketchup|κετσαπ/],['mustard', /mustard|moutarde|μουσταρδ|senf/],['soy-sauce', /soy[- ]sauce|soya[- ]sauce|σαλτσα.{0,12}σογια|^soja(?![a-zα-ω])|(?:^|[^a-zα-ω])soja sauce|shoyu|tamari/],['pesto', /pesto|πεστο/],['tomato-sauce', /tomato|bolognese|passata|pasta[- ]sauce|ντοματ|τοματ|arrabbiata|napoletana/],['salad-dressing', /dressing|vinaigrette|σαλατασ|balsamic|βαλσαμικ|vinegar|ξυδι|aceto/],['hot-sauce', /(?:^|[^a-zα-ω])hot sauce|sriracha|tabasco|chili sauce|chilli sauce|πικαντικη σαλτσα|sweet chilli|μπαρμπεκιου|(?:^|[^a-zα-ω])bbq(?![a-zα-ω])|barbecue/]] },
 cereal: { def: 'breakfast-cereal', list: [['protein-snack', /protein|whey|πρωτειν|high protein|hipro|(?:^|[^a-z])pro(?![a-z])/],['oats', /rolled[- ]oats|oat[- ]flakes|porridge|oatmeal|νιφαδ.{0,12}βρωμ|κουακερ|(?:^|[^a-zα-ω])βρωμη(?![a-zα-ω])|(?:^|[^a-zα-ω])oats(?![a-zα-ω])/],['bran', /(?:^|[^a-zα-ω])bran(?![a-zα-ω])|πιτυρο/],['muesli-granola', /muesli|musli|granola|μουσλι|γκρανολα/],['breakfast-cereal', /breakfast[- ]cereal|cereals|corn[- ]?flakes|δημητριακ|κορν φλεικ|weetabix|chocos|(?:^|[^a-zα-ω])puffs?(?![a-zα-ω])|(?:^|[^a-zα-ω])flakes(?![a-zα-ω])|müsli/]] },
 cheese: { def: '', list: [
  ['feta', /(?:^|[^a-zα-ω])feta(?![a-zα-ω])|φετα(?![a-zα-ω])|φετεσ ?(?:ελλ|π\.?ο\.?π|βαρελ)|white brined|brined cheese/],
  ['halloumi', /halloumi|χαλουμι/],
  ['greek-hard', /graviera|γραβιερα|kefalograviera|κεφαλογραβιερα|κεφαλοτυρ|kefalotyri|kasseri|κασερι|ladotyri|λαδοτυρι|kalathaki|καλαθακι|ημισκληρ|ementhal|αγελαδινο ημισκληρ|metsovone|μετσοβονε|formaela|φορμαελα|sfela|σφελα|batzos|μπατσοσ|ανεβατο|(?:^|[^a-zα-ω])kopanisti|κοπανιστη/],
  ['fresh-white', /anthotyr|ανθοτυρ|myzithr|μυζηθρ|manouri|μανουρι|ricotta|ρικοτα|(?:^|[^a-zα-ω])mascarpone(?![a-zα-ω])/],
  ['cottage', /cottage|κοτατζ|творог|quark|τυροκρεμα|fromage blanc/],
  ['cream-cheese', /cream[- ]cheese|spreadable|philadelphia|τυρι.{0,12}κρεμα|αλειφομενο|τυρι κρεμα|kiri|boursin/],
  ['mozzarella', /mozzarella|μοτσαρελ|burrata|μπουρατα/],
  ['yellow-cheese', /gouda|edam|emmental|emmenthal|cheddar|maasdam|gruy|leerdammer|sliced[- ]cheese|cheese slices|τυρι.{0,10}φετεσ|τοστ|γκουντα|ενταμ|τσενταρ|εμμενταλ|μααστνταμ|jarlsberg|provolone|colby|havarti/],
  ['grated-cheese', /grated|τριμμεν|parmesan|παρμεζαν|parmigiano|pecorino|ρομανο|grana padano|shredded/],
  ['blue-cheese', /blue[- ]cheese|roquefort|gorgonzola|stilton|μπλε τυρι|danablu|blue(?![a-zα-ω])/],
  ['processed-cheese', /processed[- ]cheese|τηγμενο|σχηματοσ|cheese spread|babybel|laughing cow|la vache qui rit|triangles?/]] },
 pasta: { def: 'pasta', list: [['pasta', /pasta|spaghet|penne|fusilli|macaron|ζυμαρικ|μακαρον|σπαγγετ|πεννεσ/]] },
 'rice-grain': { def: 'rice', list: [['cooked-grains', /cooked|prepared|ready|μαγειρεμ|ετοιμ|microwave|pouch|express/],['quinoa', /quinoa|κινοα/],['couscous-bulgur', /couscous|bulgur|κουσκουσ|πλιγουρ|πληγουρι/],['rice-cakes', /rice[- ]cakes?|corn[- ]cakes?|ρυζογκοφρετ/],['rice', /(?:^|[^a-zα-ω])rice(?![a-zα-ω])|rices|ρυζι|riso(?![a-zα-ω])|reis(?![a-zα-ω])|(?:^|[^a-zα-ω])riz(?![a-zα-ω])|arroz/]] },
 meat: { def: 'meat', list: [['sausages', /sausage|λουκανικ|frankfurt|hot ?dog|wurst|chorizo|loukaniko|μπουκοβο|kabanos|καμπανο/],['bacon', /bacon|μπεικον|pancetta|πανσετα|γουρουνοπουλα/],['burger', /burger|μπιφτεκι|patty|patties|κεφτε|meatball|σουτζουκ/],['breaded', /nugget|schnitzel|σνιτσελ|παναρ|breaded|cordon bleu|κροκετ|crispy|tempura|fingers?/],['salami', /salami|σαλαμι|μορταδελ|mortadella|παριζα|παριζιανο|pepperoni|πεπερονι|σουτζουκ/],['ham', /(?:^|[^a-zα-ω])ham(?![a-zα-ω])|hams|ζαμπον|prosciutto|jambon|speck|σπεκ|pastrami|παστραμα|pavo|ψητη γαλοπουλα|γαλοπουλα(?: |$).{0,25}(?:φετεσ|καπνιστ|βραστ|ψητ|φιλετο)|smoked (?:turkey|chicken)|turkey (?:roast|breast|fillet|slices)|chicken (?:breast|fillet) (?:slices|roast|smoked)|καπνιστη γαλοπουλα|στηθοσ.{0,10}(?:γαλοπουλ|κοτοπουλ).{0,12}(?:βραστ|καπνιστ|φετεσ)|βραστη γαλοπουλα|ψητο κοτοπουλο φετεσ/],['poultry-fresh', /chicken|poultry|turkey|κοτοπουλ|γαλοπουλ|πουλερικ|duck|παπια/],['beef', /(?:^|[^a-zα-ω])beef(?![a-zα-ω])|veal|μοσχαρ|βοδιν/],['pork', /(?:^|[^a-zα-ω])pork(?![a-zα-ω])|χοιριν/],['lamb', /(?:^|[^a-zα-ω])lamb(?![a-zα-ω])|αρνι|κατσικι/]] },
 fish: { def: 'fish', list: [['canned-tuna', /canned[- ]tuna|tuna|τονοσ|τονου|thon(?![a-zα-ω])|thunfisch|atun|tonno/],['salmon', /salmon|σολομ|lachs/],['sardines', /sardin|σαρδελ|anchov|αντζουγι|μαριδα|mackerel|σκουμπρι/],['fish-fingers', /fish[- ]fingers|breaded[- ]fish|fish[- ]sticks|παναρισμ|πανε/],['caviar-roe', /roe|caviar|ταραμ|αβγοταραχο|καβιαρι/],['shellfish', /shrimp|prawn|γαριδ|mussel|μυδι|squid|καλαμαρ|octopus|χταποδ|crab|κάβουρ/]] },
 'legume-veg': { def: 'legume-veg', list: [['roasted-chickpea-snack', /στραγαλ|roasted chickpeas|chickpea snack|crunchy chickpeas/],['chickpeas', /chickpea|ρεβ[υι]θ/],['lentils', /lentil|φακεσ|φακη(?![a-zα-ω])/],['beans', /(?:^|[^a-zα-ω])beans?(?![a-zα-ω])|φασολ|φασουλ|gigantes|γιγαντ/],['peas', /(?:^|[^a-zα-ω])peas?(?![a-zα-ω])|αρακα/],['corn', /sweetcorn|(?:^|[^a-zα-ω])corn(?![a-zα-ω])|καλαμποκ/],['tomatoes', /tomato|ντοματ|τοματ/],['potatoes', /potato|πατατεσ/],['olives', /olive|ελιεσ|ελια(?![a-zα-ω])/],['pickled', /pickle|τουρσι|gherkin|αγγουρακια|capers|καπαρη/]] },
 fat: { def: 'fat', list: [['olive-oil', /olive|ελαιολαδ|oliv|extra virgin|εξτρα παρθενο/],['seed-oil', /sunflower|ηλιελαι|corn oil|αραβοσιτελαι|canola|rapeseed|κολζα|vegetable oil|σπορελαι|σογιελαι|soybean oil|παλμελαι|palm oil|(?:^|[^a-zα-ω])oil(?![a-zα-ω])|λαδι(?![a-zα-ω])/],['coconut-oil', /coconut oil|καρυδελαιο|coconut fat/],['butter', /(?:^|[^a-zα-ω])butter(?![a-zα-ω])|βουτυρ|beurre|(?:^|[^a-zα-ω])unt(?![a-zα-ω])|burro|mantequilla|ghee/],['margarine', /margarin|μαργαριν|soft spread|becel|flora(?![a-zα-ω])|ελαφρυ λιπαρο|vitalite|(?:^|[^a-zα-ω])soft(?![a-zα-ω])/]] },
 meal: { def: 'prepared-meal', list: [['sandwich', /sandwich|filled[- ]wrap|σαντουιτσ|toast ham/],['vegetable-pie', /spinach|vegetable[- ]pie|σπανακοπιτ|χορτοπιτ|πιτα(?![a-zα-ω])|pie(?![a-zα-ω])|πιτεσ|φυλλο/],['cheese-pie', /cheese[- ]pie|τυροπιτ|quiche|κις(?![a-zα-ω])/],['rice-meal', /risotto|with.{0,25}rice|ριζοτο|ρυζι με|rice with|pilaf|πιλαφι/],['caponata', /caponata/],['curry', /(?:^|[^a-zα-ω])curry(?![a-zα-ω])|καρι/],['legume-meal', /beans (?:in|with)|baked beans|φασολαδα|φακεσ μαγειρ|giant beans|γιγαντεσ|soup/]] },
 'coffee-tea': { def: 'coffee', list: [['iced-tea', /ice[d]?[- ]tea|παγωμενο.{0,10}τσαι|cool tea|ice tea|fuze|nestea|lipton ice|green ice|iced mountain tea|ice green/],['herbal-tea', /herbal|infusion|camomile|χαμομηλ|mountain tea|τσαι του βουνου|sideritis|σιδηρ|mint|μεντα|rooibos|chamomile|linden|φασκομηλο|δικταμο/],['tea', /(?:^|[^a-zα-ω])teas?(?![a-zα-ω])|τσα[ιγ]/],['coffee-capsule', /capsule|κapsoul|καψουλ|pods?(?![a-zα-ω])|nespresso|dolce gusto|nescafe dolce/],['instant-coffee', /instant|στιγμιαι|nescafe|frappe|φραπε|cappuccino|καπουτσινο|3 ?in ?1|latte mix/],['coffee', /coffee|καφεσ|καφε(?![a-zα-ω])|espresso|εσπρεσσο|ελληνικοσ καφεσ|greek coffee|filter|φιλτρου/]] },
 soda: { def: 'soft-drink', list: [['soda-water', /soda water|club soda|σοδα(?![a-zα-ω])|sparkling water|ανθρακουχο νερο|seltzer|mineral water sparkling|tonic water/],['tonic', /tonic|τονικ/],['energy-drink', /energy|ενεργειακ|red bull|monster|hell(?![a-zα-ω])|burn(?![a-zα-ω])|rockstar/],['isotonic', /isotonic|powerade|gatorade|ισοτονικ/],['cola', /(?:^|[^a-zα-ω])cola(?![a-zα-ω])|(?:^|[^a-zα-ω])colas(?![a-zα-ω])|κολα(?![a-zα-ω])|coca-?cola|pepsi/],['citrus-soda', /lemonade|λεμοναδα|πορτοκαλαδα|orangeade|sprite|fanta|7up|7 up|lemon|orange|σοδα λεμονι|schweppes|limonata/],['iced-tea', /ice[d]?[- ]tea|ice tea/]] },
 water: { def: 'plain-water', list: [['flavoured-water', /flavou?red|λεμονι|φρουτ|vitamin|infused|aqua|γευση|taste|zero/],['plain-water', /water|νερο|aqua/]] },
 'savoury-snack': { def: 'savoury-snack', list: [['rice-cakes', /rice[- ]cakes?|corn[- ]cakes?|ρυζογκοφρετ|puffed rice|puffed corn|wafle kukurydz|wafle ryz|pufuleti|πουφακια/],['breadsticks', /grissini|breadsticks|κριτσιν/],['corn-snack', /tortilla[- ]chips?|corn[- ]snack|nachos|γαριδακια|cheetos|doritos|corn chips|puff corn|τσιτοσ/],['popcorn', /popcorn|ποπ κορν/],['crackers', /cracker|κρακερ|mini crackers|rye crisp|crispbread|σκρακερ|cracker thins|σταφιδα/],['pretzel', /pretzel|πρετσελ/],['potato-chips', /potato|crisps|chips|πατατακια|lays(?![a-zα-ω])|pringles/],['nut-snack', /nuts?(?![a-zα-ω])|peanut|καρπο|ξηροι καρποι|almond|pistach|cashew/]] },
 chocolate: { def: 'chocolate-tablet', list: [['baking-chocolate', /κουβερτουρα|couverture|baking chocolate|για μαγειρικη|chocolate chips|chocolate chunks|σταγονεσ σοκολατασ|σοκολατα (?:γλασαρισματοσ|γλασο)|μαγειρικησ|pastry chocolate|cooking chocolate/],['filled-chocolate', /praline|πραλιν|truffle|τρουφα|bonbon|μπονμπον|kinder|ferrero|bueno|raffaello|merci(?![a-zα-ω])|chocolates? box|assorted|σοκολατακι|mini eggs|(?:^|[^a-zα-ω])eggs?(?![a-zα-ω])|αβγο|bunny|santa|christmas|easter|χριστουγεν|πασχαλιν/],['chocolate-bar-snack', /(?:^|[^a-zα-ω])bars?(?![a-zα-ω])|μπαρα|wafer|γκοφρετ|crunch(?![a-zα-ω])|kit ?kat|twix|snickers|mars(?![a-zα-ω])|bounty|milky way|lion(?![a-zα-ω])|nuts bar|caramel bar/],['protein-chocolate', /protein|whey|πρωτειν/],['chocolate-tablet', /chocolat|σοκολατ|cioccolat|schokolad|choco(?![a-zα-ω])|lacta|milka|toblerone|lindt|γαλακτοσ|υγειασ|ion(?![a-zα-ω])/]] },
 biscuit: { def: 'sweet-biscuit', list: [['protein-snack', /protein|whey|πρωτειν|high protein|hipro|(?:^|[^a-z])pro(?![a-z])/],['wafer', /wafer|γκοφρετ|waffle|wafle|gaufrette/],['rusk-cracker', /rusk|φρυγανι|παξιμαδ|cracker|κρακερ|κριτσιν|κουλουρακι|κουλουρι|grissini|zwieback|crispbread/],['sweet-biscuit', /biscuit|cookie|μπισκοτ|digestive|petit beurre|oreo|sandwich|shortbread|oatmeal|γεμιστα|belvita|soft bake|sables?|speculoos|lotus|savoiardi|ladyfinger|μπισκοτακι|cantuccini|tarallini|amaretti|macaron(?:s)?(?![a-zα-ω])|бисквит|keks|galletas|biscotti|biscotta/]] },
 cake: { def: 'cake', list: [['protein-snack', /protein|whey|πρωτειν|high protein|hipro|(?:^|[^a-z])pro(?![a-z])/],['croissant', /croissant|κρουασαν|κρουασανακ/],['greek-pastry', /baklav|μπακλαβ|τσουρεκ|καταιφ|kataifi|γαλακτομπουρεκ|loukoumad|λουκουμαδ|μελομακαρον|κουραμπιε|kourabie|melomakarona|diples|διπλεσ|σιροπιαστ|revani|ραβανι|σαραγλι|saragli|τουλουμπα|tulumba/],['pancake-waffle', /pancake|crepe|κρεπ|waffle|βαφλα|blini/],['brioche', /brioche|μπριος|tsoureki|τσουρεκι|panettone|πανετον|pandoro|vasilopita|βασιλοπιτα/],['swiss-roll-bar', /(?:^|[^a-zα-ω])bar(?![a-zα-ω])|bars(?![a-zα-ω])|μπαρα|roll(?![a-zα-ω])|ρολο|swiss roll|bake bars/],['strudel-pie', /strudel|pie(?![a-zα-ω])|tart(?![a-zα-ω])|τάρτα|τουρτα|profiterole|προφιτερολ|eclair|εκλερ|mille ?feuille|μιλφει|tiramisu/],['cake', /cake|κεικ|muffin|brownie|plumcake|sponge|bundt|donut|ντονατ|madeleine|μαντλεν|cupcake|μαφιν|banana bread|lava|fondant|cheesecake|cakes?(?![a-zα-ω])/]] },
 dessert: { def: 'dessert', list: [['yogurt', /yogh?urt|γιαουρτ|skyr|σκυρ|strained|στραγγιστ|total(?![a-zα-ω])|fage|activia|γιαουρτι/],['pudding', /pudding|πουτιγκ|κρεμα|creme|mousse|μουσ(?![a-zα-ω])|custard|panna cotta|ρυζογαλο|flan(?![a-zα-ω])|caramel cream|γαλακτομπουρεκο|semolina|σιμιγδαλ|halva dessert|danette|dolce/],['jelly', /jelly|ζελε|zele|gelatin|gelatina|jello/],['ice', /ice cream|παγωτο|sorbet|σορμπε/],['plant-dessert', /soy|soya|plant|vegan|φυτικ|oat dessert|alpro/]] },
 sweets: { def: 'candy', list: [['protein-snack', /protein|whey|πρωτειν|high protein|hipro|(?:^|[^a-z])pro(?![a-z])/],['gum', /(?:^|[^a-zα-ω])gum(?![a-zα-ω])|τσιχλ|chewing|trident|orbit|extra gum|airwaves|hubba bubba|mentos gum/],['halva', /halva|χαλβα|halvas|halwa|χαλβας/],['marshmallow-jelly', /gummy|gummies|haribo|jelly bean|marshmallow|μαρσμελοου|jelly candy|ζελεδακι|ζελε|sour belt|fruit gums|wine gums|pastilles|νουγκατ|nougat|turkish delight|λουκουμι/],['lollipop-hard', /lollipop|γλειφιτζουρι|hard candy|lozenge|halls|καραμελ|mentos|candy|candies|ζαχαρωτ|ginger candy|throat/],['chocolate-confection', /chocolat|σοκολατ|kitkat|maltesers|bueno|kinder|twix|snickers|mars|bounty|pralin|truffle|choco|filling|κακαο|nucrema|sweet bar/]] },
 juice: { def: 'juice', list: [['smoothie', /smoothie|avocando|σμουθι|shake|φρουτοσαλατα|puree drink|fruit puree/],['nectar-drink', /nectar|νεκταρ|(?:^|[^a-zα-ω])drink(?![a-zα-ω])|cocktail|κοκτειλ|flavou?red|ποτο(?![a-zα-ω])|punch|squash|syrup|σιροπι|from concentrate with sugar|πορτοκαλαδα|lemonade|amita free|fruit drink|ηβη/],['vegetable-juice', /tomato juice|χυμοσ ντοματασ|carrot|καροτο|vegetable juice|beetroot|παντζαρ|celery|σελινο|χυμοσ λαχανικ|v8|spinach|green juice/],['juice', /juice|χυμοσ|(?:^|[^a-zα-ω])jus(?![a-zα-ω])|zumo|succo|saft|apple|orange|πορτοκαλι|μηλο|pomegranate|ροδι|grape|σταφυλι|lemon|λεμονι|peach|ροδακιν|pineapple|ανανα|mango|cranberry|grapefruit|γκρειπφρουτ/]] },
 bar: { def: 'snack-bar', list: [['protein-bar', /protein|whey|πρωτειν|high protein|hipro|pro(?![a-zα-ω])|fit(?:ness)? bar|quest|barebells|grenade|oatein|optimum|nutrend/],['fruit-nut-bar', /fruit bar|date|φοινικ|nut bar|nuts bar|raw|ωμο|energy bar|energy ball|bites?(?![a-zα-ω])|fruit & nut|fruit and nut|cocoa date|nood/],['snack-bar', /bar|bars|μπαρα|muesli|cereal|granola|digestive|flapjack|oat|crunchy|δημητριακ|chocolate|σοκολατ/]] },
 nut: { def: 'nuts', list: [['seeds', /(?:^|[^a-zα-ω])seeds?(?![a-zα-ω])|σπορ|chia|flax|lein|linseed|sunflower|ηλιοσπορ|σουσαμι|sesame|pumpkin|κολοκυθοσπορ|poppy|hemp|graines|semillas|kerne(?![a-zα-ω])/],['nut-butter', /(?:^|[^a-zα-ω])butter(?![a-zα-ω])|βουτυρο|κρεμα φυστικ|nut cream|nut paste|paste|tahin|ταχιν|puree|spread/],['trail-mix', /(?:^|[^a-zα-ω])mix(?![a-zα-ω])|μιξ|trail|snack mix|cocktail|assorted|μειγμα/],['nuts', /nuts?|almond|αμυγδαλ|pistach|φιστικ|hazelnut|φουντουκ|walnut|καρυδι|cashew|κασιου|peanut|macadamia|pecan|brazil|chestnut|κασταν|pine nut|κουκουναρ|ψιχα|kernel|ξηροι καρποι|noix|mandorle|noci|nueces/]] },
 'dried-fruit': { def: 'dried-fruit', list: [['raisins', /raisin|σταφιδ|sultana|σουλτανιν|currant|κορινθιακ|dates?(?![a-zα-ω])|φοινικ|χουρμαδ/],['dried-fruit', /dried|αποξηραμ|ξηρα|figs?(?![a-zα-ω])|σκουρα|apricot|βερικοκ|prune|δαμασκην|cranberr|goji|mango|γκοτζι|berries|μπερι|pineapple|banana|chips/]] },
 soup: { def: 'soup', list: [['stock-cube', /ζωμοσ|bouillon|stock|cubes?|broth|κυβοι/],['soup', /soup|σουπα|velout|βελουτε|gazpacho|minestrone|chowder|noodle/]] },
 pizza: { def: 'pizza', list: [['pizza-base', /βαση|dough|ζυμη|base(?![a-zα-ω])/],['pizza-snack', /rolls?|bake(?![a-zα-ω])|bites?|popped|chips|corn|bruschett|cakes?|snack|pizzette|μινι/],['pizza', /pizza|πιτσα|flammkuchen/]] },
 'ice-cream': { def: 'ice-cream', list: [['ice-lolly', /ice lolly|lolly|popsicle|ξυλακι|stick|παγακι|ksilakia|ξυλακια|sorbet|σορμπε|granita|γρανιτα|παγωτο νερου|water ice|frozen yog.{0,6}bar/],['ice-cream-cone-bar', /cone|κορνετ|sandwich|bar(?![a-zα-ω])|magnum|σαντουιτσ|choco bar|ice cream bar|παγωτο.{0,6}μπαρα|mochi|brownie ice/],['frozen-yogurt', /frozen yog|παγωμενο γιαουρτ|froyo|yogurt ice/],['ice-cream', /ice ?cream|παγωτο|gelato|icecream|spoon|tub|βανιλια|vanilla|σοκολατα|strawberry/]] },
 'plant-drink': { def: 'plant-drink', list: [['plant-drink', /./]] }
};
const states = [ ['dried', /(?:^|[-\s])dried|dehydrated|αποξηρα/], ['powder', /powder|σκονη/], ['prepared', /(?:^|[-\s])cooked|prepared[- ]|ready[- ]|μαγειρεμ/], ['canned', /canned|preserved|κονσερβ/], ['raw', /(?:^|[-\s])raw|fresh|νωπ/] ];
const strictFamilies = new Set(Object.keys(FAMILY));
// Families whose default type is too wide to stand on its own ("meal", "vegetable", "meat"): two unresolved products of such a family are only
// comparable when their category tags share something specific.
const LOOSE = new Set(['legume-veg', 'meal', 'fat', 'meat', 'fish', 'cheese', 'sweets', 'dessert', 'soup', 'savoury-snack', 'dried-fruit', 'sauce', 'spread']);
const broad = /^(?:en:)?(?:plant-based-foods(?:-and-beverages)?|foods(?:-and-beverages)?|beverages|snacks|sweet-snacks|salty-snacks|groceries|dairies|dairy-products|meals|spreads|sweet-spreads|sauces|condiments|cheeses|meats|fishes|legumes|vegetables|cereals-and-potatoes|cereals-and-their-products|breakfast-cereals|pastas|products|desserts|biscuits-and-cakes|biscuits|cakes|chocolates|cocoa-and-its-products|confectioneries|fruit-juices|juices-and-nectars|fruits-and-vegetables-based-foods|fats|oils|nuts|seeds|plant-based-beverages|non-alcoholic-beverages|sodas|carbonated-drinks|teas|coffees|breads|frozen-foods|canned-foods)$/;

const kindMemo = new WeakMap();
/** Memoised per product object and family: a recommendation run asks about the same base product once per candidate. */
export function productKind(p, family) {
 if (p && typeof p === 'object') {
  let byFamily = kindMemo.get(p); if (!byFamily) kindMemo.set(p, byFamily = new Map());
  let hit = byFamily.get(family); if (!hit) byFamily.set(family, hit = computeKind(p, family));
  return hit;
 }
 return computeKind(p, family);
}
function computeKind(p, family) {
 const name = fold(p?.name), tags = (p?.categories || []).map(fold).join(' '), s = name + ' | ' + tags;
 const text = name + ' ' + fold(p?.brand);
 // 1. cross-family type from the name (tags only when the name is silent: tags are inherited and noisy)
 let type = (GLOBAL.find(([, test]) => test(name + ' |'))?.[0]) || '';
 if (!type) type = (GLOBAL.find(([, test]) => /plant-based-milk-alternatives|cocoa-powders?|cocoa-and-chocolate-powders|puffed-(?:rice|corn|cereal)-cakes?/.test(tags) && test(tags))?.[0]) || '';
 const entry = FAMILY[family];
 let subtype = '';
 if (entry) {
  // category tags are inherited parents ("ice-creams-and-sorbets" would make every tub a sorbet), so they never pick a subtype
  subtype = entry.list.find(([, re]) => re.test(name))?.[0] || entry.list.find(([, re]) => re.test(text))?.[0] || entry.def;
 }
 const preparation = ['meat','fish','legume-veg','pasta','rice-grain','coffee-tea'].includes(family) ? states.find(([, re]) => re.test(s))?.[0] || 'unknown' : null;
 if (!type && (family === 'pasta' || family === 'pizza') && subtype === family) type = family; // the family default is the same type as the cross-family one
 const resolved = !!type || (entry ? subtype !== entry.def : false);
 return { family, subtype, type: type || (subtype ? `${family}:${subtype}` : family), global: !!type, resolved, loose: LOOSE.has(family), preparation, strict: strictFamilies.has(family) };
}
export function productUseMatch(base, candidate, family) {
 const a = productKind(base, family), b = productKind(candidate, family);
 if (a.type !== b.type) return { ok: false, reason: 'different-product-use', a: a.type, b: b.type };
 if (a.preparation && b.preparation && a.preparation !== b.preparation && a.preparation !== 'unknown' && b.preparation !== 'unknown') return { ok: false, reason: 'different-preparation' };
 const categories = new Set((base.categories || []).filter(c => !broad.test(c)));
 const shared = (candidate.categories || []).filter(c => categories.has(c) && !broad.test(c));
 if (a.loose && !a.resolved && !b.resolved && !shared.length) return { ok: false, reason: 'product-use-unconfirmed', a: a.type, b: b.type };
 return { ok: true, reason: shared.length ? 'shared-category' : 'same-product-type', subtype: a.subtype || family, type: a.type, shared };
}
/** Smaller is closer, not healthier. Unit-free distance for a neutral comparison. */
export function nutritionDistance(a, b) {
 const scales = { kcal: 100, sugars: 10, saturatedFat: 3, salt: .5, protein: 5, fiber: 3 }; let sum = 0, count = 0;
 for (const [k, scale] of Object.entries(scales)) { const x = a?.nutrition?.[k], y = b?.nutrition?.[k]; if (typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y)) { sum += Math.min(4, Math.abs(x - y) / Math.max(scale, x * .5)); count++; } }
 return count ? sum / count : 10;
}

/** Comparison display precision, never a grading or nutrition-data mutation. */
export function nutrientDelta(from, to) {
 const known = n => typeof n === 'number' && Number.isFinite(n) && n >= 0;
 if (!known(from) || !known(to)) return { kind: 'unknown', amount: null };
 const diff = to - from;
 if (diff === 0) return { kind: 'same', amount: 0 };
 const shown = n => n > 0 && n < .01 ? '<0.01' : n.toFixed(2);
 if (Math.abs(diff) <= 1e-6 * Math.max(1, from, to) || shown(from) === shown(to)) return { kind: 'rounded', amount: Math.abs(diff) };
 return { kind: diff > 0 ? 'higher' : 'lower', amount: Math.abs(diff) };
}
