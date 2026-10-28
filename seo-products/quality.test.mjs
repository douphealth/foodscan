import test from "node:test";
import assert from "node:assert/strict";
import { renderPublicProductPage } from "./render.js";
const good = {
  code:"3017624010701", product_name:"Chocolate spread", brands:"Example",
  nutrition_data_per:"100g",
  nutriments:{"energy-kcal_100g":539,"proteins_100g":6.3,"carbohydrates_100g":57.5,"sugars_100g":56.3,"fat_100g":30.9,"saturated-fat_100g":10.6,"fiber_100g":3.4,"salt_100g":0.107},
  data_quality_errors_tags:[], ingredients_text_en:"Sugar, oil, cocoa"
};
test("renders eligible product with canonical URL and facts",()=>{
 const html=renderPublicProductPage(good);
 assert.ok(html.includes("/products/3017624010701"));
 assert.ok(html.includes("<h1>Chocolate spread</h1>"));
 assert.ok(html.includes("Nutrition per 100 g or 100 ml"));
});
test("rejects malformed barcode",()=>assert.equal(renderPublicProductPage({...good,code:"not-a-barcode"}),null));
test("rejects low-quality record",()=>assert.equal(renderPublicProductPage({...good,nutriments:{"energy-kcal_100g":100}}),null));
test("rejects contradictory nutrition",()=>assert.equal(renderPublicProductPage({...good,nutriments:{...good.nutriments,"energy-kcal_100g":10}}),null));
test("escapes HTML in product name and ingredients",()=>{
 const html=renderPublicProductPage({...good,product_name:"<script>alert(1)</script>",ingredients_text:"<img src=x onerror=alert(1)>"});
 assert.ok(!html.includes("<h1><script>"));
 assert.ok(!html.includes("<img src=x onerror"));
});
