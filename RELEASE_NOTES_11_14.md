# FoodScan 11.14.0 — Product report visual refinement

- Full-width Nutri-Score and NOVA classification cards instead of classifications trapped beneath the product photo.
- Key source nutrition facts moved next to the main decision; factual allergen warnings retained.
- Three protein/fat/carbohydrate values displayed in compact horizontal metric panels instead of oversized rings (same source values).
- The portion calculator retains its existing amount, stepper, range, preset, live calculation and diary logging handlers. Energy and total sugars lead, with six supporting nutrients and teaspoon equivalence kept but de-emphasized.
- Alternative-product cards use a clearer image/title hierarchy, compact measured differences, actionable buttons and source details.
- No claim of safer food or guaranteed alternative is added. Existing source gating, allergy checks, comparison ranking and quantity calculations remain unchanged.
- Screenshots and automated browser tests should be reviewed before promoting the release to Cloudflare production. Rollback: revert this commit and redeploy 11.13.0.
