// src/domain/profile.js
var DEFAULT_PROFILE = Object.freeze({ avoids: [], diet: "none", country: "" });
var DIETS = Object.freeze({ none: "No preference", vegetarian: "Vegetarian", vegan: "Vegan" });
var AVOID_CHOICES = Object.freeze(ALLERGENS.map((a) => Object.freeze({ key: a.key, get label() {
  return t(a.label.replace(/ \(.*\)/, ""));
} })));
var REGION_BY_COUNTRY = Object.freeze(Object.fromEntries(Object.entries(COUNTRY_BY_REGION).map(([region, slug]) => [slug, region])));

