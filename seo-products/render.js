const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const barcodePattern = /^(?:\d{8}|\d{12}|\d{13}|\d{14})$/;
const severePattern = /(?:values-are-all-identical|energy-value-in-kcal-does-not-match-value-in-kj|energy-value-in-kj-does-not-match-value-in-kcal|nutrient-values-exceed|100g-.*-greater-than-100)/i;
const num = v => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : null;

function quality(p) {
  const n = p?.nutriments || {};
  const tags = Array.isArray(p?.data_quality_errors_tags) ? p.data_quality_errors_tags : [];
  const name = String(p?.product_name || p?.product_name_en || p?.product_name_el || "").trim();
  const kcal = num(n["energy-kcal_100g"]);
  const fat = num(n["fat_100g"]), protein = num(n["proteins_100g"]), carbs = num(n["carbohydrates_100g"]);
  const lower = 9 * (fat ?? 0) + 4 * (protein ?? 0) + 4 * (carbs ?? 0);
  const bad = tags.some(x => severePattern.test(String(x))) ||
    (kcal !== null && lower > 0 && kcal + Math.max(20, lower * .18) < lower);
  const count = ["energy-kcal","proteins","carbohydrates","sugars","fat","saturated-fat","fiber","salt"]
    .filter(k => num(n[k + "_100g"]) !== null).length;
  const basis = String(p?.nutrition_data_per || "100g").toLowerCase();
  return { name, count, eligible: Boolean(name && !bad && count >= 4 && /(100\s*g|100g|100\s*ml|100ml)/.test(basis)) };
}

export function renderPublicProductPage(record, origin = "https://food-scan.gearuptofit.com") {
  const code = String(record?.code || "");
  if (!barcodePattern.test(code)) return null;
  const q = quality(record);
  if (!q.eligible) return null;
  const name = q.name.slice(0, 180), brand = String(record.brands || "").slice(0, 180);
  const canonical = origin.replace(/\/$/, "") + "/products/" + encodeURIComponent(code);
  const n = record.nutriments || {};
  const image = /^https:\/\//.test(String(record.image_front_url || "")) ? String(record.image_front_url) : "";
  const description = (brand ? brand + " — " : "") + "Nutrition information and ingredients for " + name + ", based on the available Open Food Facts record. Verify details on the package.";
  const rows = [["Energy","energy-kcal","kcal"],["Protein","proteins","g"],["Carbohydrates","carbohydrates","g"],["Sugars","sugars","g"],["Total fat","fat","g"],["Saturated fat","saturated-fat","g"],["Fiber","fiber","g"],["Salt","salt","g"]]
    .map(([label,key,unit]) => {
      const v = num(n[key + "_100g"]);
      return "<tr><th scope=\"row\">" + esc(label) + "</th><td>" + esc(v === null ? "Not reported" : v + " " + unit) + "</td></tr>";
    }).join("");
  const ingredients = String(record.ingredients_text_en || record.ingredients_text || "").trim().slice(0, 5000);
  const schema = {"@context":"https://schema.org","@type":"Product","name":name,"sku":code,"url":canonical};
  if (brand) schema.brand = {"@type":"Brand","name":brand};
  return "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
    "<title>" + esc(name) + " nutrition facts | FoodScan</title><meta name=\"description\" content=\"" + esc(description.slice(0,300)) + "\">" +
    "<meta name=\"robots\" content=\"index,follow,max-image-preview:large\"><link rel=\"canonical\" href=\"" + esc(canonical) + "\">" +
    "<meta property=\"og:type\" content=\"product\"><meta property=\"og:title\" content=\"" + esc(name) + " nutrition facts | FoodScan\"><meta property=\"og:description\" content=\"" + esc(description.slice(0,300)) + "\"><meta property=\"og:url\" content=\"" + esc(canonical) + "\">" +
    (image ? "<meta property=\"og:image\" content=\"" + esc(image) + "\">" : "") +
    "<script type=\"application/ld+json\">" + JSON.stringify(schema).replace(/</g,"\\u003c") + "</script>" +
    "<style>body{font:16px/1.6 system-ui,sans-serif;max-width:780px;margin:0 auto;padding:24px;color:#20352b}img{max-width:100%;max-height:320px;object-fit:contain}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px;border-bottom:1px solid #dce5df}a{color:#176b49}.notice{padding:12px;background:#f2f6f1;border-radius:10px}</style></head><body><main>" +
    "<p><a href=\"/\">FoodScan</a> / Product facts</p><h1>" + esc(name) + "</h1>" + (brand ? "<p><strong>Brand:</strong> " + esc(brand) + "</p>" : "") +
    (image ? "<img src=\"" + esc(image) + "\" alt=\"Package image supplied by the source database\" loading=\"lazy\">" : "") +
    "<p class=\"notice\">These details reflect a community-maintained source record and may be incomplete or outdated. Check the current physical package, especially for allergens.</p>" +
    "<h2>Nutrition per 100 g or 100 ml, as reported</h2><table><tbody>" + rows + "</tbody></table>" +
    (ingredients ? "<h2>Ingredients reported by the source</h2><p>" + esc(ingredients) + "</p>" : "") +
    "<p>Barcode: " + esc(code) + "</p><p><a href=\"https://world.openfoodfacts.org/product/" + encodeURIComponent(code) + "\" rel=\"nofollow noopener\">View original source record</a></p>" +
    "<p><a href=\"/#home\">Scan another food with FoodScan</a></p></main></body></html>";
}
