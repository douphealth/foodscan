# FoodScan 105.0.0

A speed audit of the live app (104.0.0): every main request was timed on the live site, the running app was timed from opening a product to
its grade, its swaps and its price, and one price lookup was traced subrequest by subrequest. One bottleneck stood out, and this release
removes it: **the price no longer waits for the slowest source.**

No grade, price or ranking rule changes. Every number below was measured; where it was measured is stated.

## What was measured on the live 104.0.0

| What | Measured | Verdict |
| --- | --- | --- |
| Product record (`/api/product/<code>`) | 0.07 s stored, 0.38 to 0.46 s not stored | Fine |
| Search (`/api/search`) | 0.12 to 0.17 s stored, 0.23 to 0.74 s not stored | Fine |
| Home page document | 0.22 to 0.24 s | Fine |
| In the app, opening a product: the grade appears | 0.58 s | Fine |
| In the app: the swap list appears | 2.0 s | Not changed here (see limits) |
| In the app: **the product's own price appears** | **4.9 s** (one sample; other lookups 1.1 to 2.1 s) | **The bottleneck** |
| In the app: the price chips on the swap rows | 1.3 to 3.0 s each | Same cause |

These are single runs from one desktop connection in Greece, in a browser pane, not a phone on a shop's signal.

## Why the price was slow

Two causes, both in the worker's price lookup.

1. **The whole answer waited for one shop's product page.** A Greek shop price is re-read on the shop's own page before it may be called
   current (2.5 s time-out, one retry). In the 4.9 s sample that page timed out once and answered on the retry. The observatory, e-katanalotis
   and Open Prices prices were ready in a fraction of a second and waited with it.
2. **A cold worker read its files one after another.** Since the signed price data went live, a lookup reads the signed manifest and then,
   per source, a manifest and a shard, then the candidates, then the prices found ahead. Traced against the real network: **11 subrequests in
   a chain, 2,285 ms**.

## What changed

| Change | Effect |
| --- | --- |
| **The answer comes in two steps when a shop is slow** (`quick=1`, sent by the app). The service answers once the fast sources are in and the shops have had 0.7 s. A shop price still being checked is exactly what an unconfirmed one already was: shown as "last seen", never ranked, marked `livePending`. The app then asks once more without `quick`; that request joins the shop check already running in the same worker, or reads the finished answer from the edge cache. | In Cloudflare's local runtime, against the real shops: the prices arrived in **0.95 s** while the complete answer (shop timed out, then retried) took 4.3 s. |
| The price card says **"Checking the shop's page for today's price…"** while that check runs, in all six languages, and replaces it by itself when the complete answer arrives. | No "could not confirm" message for a check that has not finished. |
| The sources' files are read **side by side**: the four Greek sources, the candidates and the prices found ahead no longer queue behind each other. | The same 11 subrequests, byte-identical answer (22,887 bytes): **2,285 ms to 959 ms** in the one run where the shop answered quickly. |
| While the signed manifest is still loading (a cold worker), each file is asked for at the same time instead of after it. | One request less in every cold chain. |
| The list lookup (`/api/prices/peek`) reads the prices found ahead beside the other sources. | Cold: 291, 297, 343 ms on 104; 251, 212, 171 ms on 105 (three runs each, same network). |
| `Server-Timing` on every price answer (`sources;dur=…`, and `live;desc="pending"` or `"joined"`). | The live site can now be measured from outside. |

What did **not** change, on purpose:

- **Trust in the signed data.** A file fetched ahead of the manifest is used only after the manifest has verified and lists exactly that
  file's SHA-256; an unlisted file is dropped unread. A forged file is still refused and the bundled data answers (tested).
- **The shop check itself.** Same request, same time-out, same single retry, same rules for what counts as confirmed.
- **A snapshot is never cached, never kept on the device, and never starts the paid web search.**
- **An app tab opened before 105** does not send `quick`, so it gets one complete answer as before.
- **"Try again" and a rescan** still wait for everything in one request, so they can never be answered from an older stored copy.

## Found while checking in the browser

The price card stayed on "Checking…" after the complete answer arrived with the same price: the card is redrawn only when its state key
changes, and the key did not include the note. Fixed (both cards) and covered by a test. The first set of tests had not caught it.

## Files

- `src/worker/prices.js` (rebuilt into `_worker.js`), `prices/price-client-v83.mjs`, `prices/native-v83.js`, `prices/native-v83.css`.
- `/prices/*` is served `no-cache`, so no cached asset file had to be renamed in this release.
- Tests: `qa/audit105.test.mjs` (9 tests).

## Checked

- **Tests:** 272 of 272 pass (263 before, 9 new).
- **Real runtime:** the tree served by `wrangler pages dev` (workerd), with the live public key and the real `prices-data` branch: the quick
  answer, the pending state, the joined follow-up and the `Server-Timing` header all behave as described.
- **Browser, phone width, local copy:** a product with a Bazaar price shows its prices, then "Checking the shop's page…", then the final
  state. The transition was forced with a delayed follow-up, because from this network the shop either answered within the 0.7 s or timed out.

## Not done, and limits

- **Not measured on real Cloudflare.** Every "after" number is from this computer (Node against the real network, or the local runtime).
  The cold-chain number (2,285 ms to 959 ms) is one run; in later runs the shop page timed out and both versions took 5.6 s for a complete
  answer, which is the case the two-step answer exists for. Measure the live site after deploying, with the `Server-Timing` header.
- **A complete answer is as slow as the slowest shop.** The two-step answer shows the other prices early; it does not make the shop faster.
  A shop price is still ranked only after the shop's page confirms it.
- **The follow-up joins the running check only inside the same worker instance.** On another instance it asks the shop again (one more
  page request) unless the finished answer is already in the edge cache.
- **The grade still waits for the live record** of a catalogue product (up to 2.6 s on a bad signal, then the catalogue answers). That is
  the 101 accuracy rule and was left alone.
- **The swap list still appears about 2 s after the product** (it loads several catalogue files). Not changed here.
- **A first visit still loads about 73 requests and 700 kB.** Not changed here.
- **The French, German, Spanish and Italian sentences** added here are hand-written and need a native reader.
- **Not tried on a real phone.**
