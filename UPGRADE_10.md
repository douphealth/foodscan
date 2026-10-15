# FoodScan 10.0 implementation

## Customer experience

- One dominant scan action; photo, manual digits and text search remain directly accessible.
- A one-glance reliability strip explains whether the source record is strong, partial or limited.
- Sugar is translated to approximate teaspoons while grams and source basis remain visible.
- Missing products lead with a useful private-record flow instead of a dead end.
- Returning users see a private daily rhythm and weekly path without creating an account.
- Product reports print cleanly for sharing with family or a clinician.

## Trust and safety

- Confidence represents record completeness, not food safety or medical certainty.
- Unknown facts remain unknown and hard restriction gates are unchanged.
- Anonymous measurement is opt-in, disabled by default and allowlisted server-side.
- Analytics discard unknown property names; barcodes, product names and profile choices are not accepted.

## Growth and earnings

- Existing disclosed affiliate surfaces remain intact.
- The opt-in funnel can measure scan success and failure without identifying a shopper.
- Cloudflare Analytics Engine and Rate Limiting bindings are optional; the app works without them.
- No new affiliate IDs, prices, stock claims or purchase claims were invented.

## Deployment

Upload the repository root to a Cloudflare Pages preview. If desired, create `ANALYTICS` and `UPSTREAM_RATE_LIMITER` bindings based on `wrangler.example.jsonc`. Validate the release checklist in `RELEASE_NOTES.md` before production promotion.
