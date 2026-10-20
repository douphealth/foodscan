# FoodScan quality release gates — 2026-10-20

This branch improves the static crawlable homepage fallback. It deliberately does not change product grading, allergens, journal storage, or alternative selection without regression coverage.

## Required before production
1. Serve homepage with JavaScript disabled: heading, value proposition, /demo/ and /how/ links visible and keyboard accessible.
2. Serve homepage with JavaScript enabled: existing homepage replaces fallback, no duplicate H1, full navigation/search/camera entry remains functional.
3. At 320, 375, 768, 1024, 1440px: no horizontal scrolling, touch targets >=44px, 200% zoom usable, keyboard focus visible.
4. /demo/ and /how/ return 200 and canonical references use https://food-scan.gearuptofit.com/.
5. Compare Nutella E against Hacendado peanut butter A: it must not be described as taste-/category-equivalent without substantiating evidence.
6. Simulate upstream timeout, rate limiting, invalid candidate and offline use: never display a fabricated verified match or indefinite spinner.
7. Verify allergen claims against source records and package; keep 'contains', 'may contain', and unknown separate.
8. Run source-backed comparison regression checks for products from multiple category families and markets.
9. Inspect Lighthouse/Web Vitals; ensure changes do not increase CLS/LCP or violate accessibility testing.
10. Confirm analytics is opt-in, private records remain local, and no PII is added to telemetry.

## Follow-on implementation boundaries
- Change alternative matching only after inspecting nutrition.js, source-trust.js, comparison-recovery.js and api-core.js together.
- Group candidates by truly substitutable food use before sorting by score. Label broader-category alternatives separately.
- Distinguish live-source failure from no verified result; prefer bounded stale verified candidates with source timestamp.
- Create repeatable product fixtures and an automated smoke suite before making this branch the release candidate.
- Add authoritative, prerendered copy to /demo/ and /how/ only after ensuring DOM replacement behavior on JavaScript startup.

## Rollback
Do not merge the branch or deploy until manual regression testing. Revert this branch's index.html change if startup rendering regressions appear.
