# Etsy integration

## First phase: read-only listing mapping

Shopify remains the initial product source. Link existing Etsy listings and
variation combinations to the migrated Medusa variants; do not replace listing
IDs or publish duplicate listings. No live listing, price or quantity writes in
this phase. MarketSuite work is retained independently.

Capture Etsy shop/listing IDs, inventory product/offering IDs where available,
SKUs, variation property/value IDs, listing state and quantities. Preserve the
full variation structure; one listing may map to several Medusa variants.
SKU matches are candidates, not proof: flag missing/duplicate SKUs, bundles and
ambiguous options for review. Store stable external links after review.

Online Rustic Halo orders are made to order. Confirm the policy for each Etsy
listing rather than deriving availability from Copper Mill physical stock or
Medusa demo warehouse quantities. Stocked listings may use the Shop pool only
after the listing's stock source is verified. Do not copy historical orders or
send customer messages during the catalog audit.

## Access preparation

No Etsy connector tool is available in this session. The owner identified the
shop as `rustichalodotcom`. On September 21, 2026, the Etsy Developer Portal
showed the existing personal app `rustic-hallo-connector` as **Personal Access**. Keep that application; do not create a duplicate.
Credentials are configured privately on staging. OAuth token exchange succeeded,
but the full connection is not yet verified. Keep the existing approved app;
the evidence does not establish an access-level restriction.

### September 22 callback investigation

The sanitized VM report collected at 00:21:31 UTC proved that the container had
not restarted since 23:56:31 UTC. Subsequent attempted builds failed with
TS2345: the uploaded fixes changed required client arguments but omitted the
matching unit test file. Host source changed while running code did not. Previous
reports of the header fix being live were incorrect.

A direct read-only public shop lookup from that same container, using its
existing keystring and shared secret, returned HTTP 200 and one exact shop match.
There is no evidence that converting Personal Access or requesting Commercial
Access is necessary to fix this failure.

The corrected package includes client, callback, and matching tests. Local full
backend TypeScript checking and all ten Etsy unit tests pass. The callback keeps
the authenticated user's owner-based shop lookup and expected-shop identity
check. Error logging only allows fixed safe messages; database exception text
is not logged because it may include token values.

`deploy/staging/deploy-etsy-verified.py` is staged for an owner-authorized sudo
run. It backs up changed files, executes the existing build/deploy script, checks
source hashes inside the running container, verifies compiled header forwarding,
and performs a read-only owner lookup preflight. It writes the user-readable
`/home/shawnhouse/etsy-deployment-report.json`; private build logs remain root-only.
`diagnose-etsy-runtime.py` writes `/home/shawnhouse/etsy-runtime-report.json`.
Do not begin another OAuth attempt until the deployment report says `verified`.
At 00:27:26 UTC, the report confirmed the deployment completed and both running
source hashes and compiled header forwarding matched. The unauthenticated
owner-endpoint preflight still returned 403, while the public shop lookup returned
200 with one exact match. This does not establish the behavior of that owner
endpoint with an OAuth bearer token.

The next staged revision uses the verified public name lookup and **requires**
its `user_id` to equal the authenticated token's user ID before saving a
connection. Missing, mismatched, or ambiguous ownership fails closed. Sixteen
tests and full TypeScript checking pass. The deployment verifier now checks the
live public response and runs the compiled ownership function against that
response, including a deliberately mismatched owner. At 00:33:35 UTC, the deployment report returned `verified`: running source
hashes matched, compiled headers were correct, public lookup returned HTTP 200
with one exact match and owner ID, and the compiled identity guard accepted the
matching owner and rejected a different owner. Backend is healthy. A fresh Safari
authorization was opened after these checks.

### September 22 verified read-only comparison

The fresh browser authorization completed and the encrypted refresh token is
stored in the Medusa Etsy module. The deployed audit route refreshes the access
token server-side, reads active listings plus the dedicated batch inventory
endpoint, and compares Etsy inventory products to current Medusa variants using
a case-insensitive exact SKU match. It does not expose credentials, call Etsy
write endpoints, or change Medusa inventory.

The clean staging build was verified at 01:32:04 UTC. Running source hashes and
compiled Etsy headers match, the backend is healthy, the public shop identity
and ownership guard pass, and the compiled audit route contains the inventory
and comparison logic. Twenty-two Etsy tests and the full backend TypeScript
check pass.

The first complete report includes 97 active listings and 97 inventory records,
with 143 Etsy inventory products and 600 Medusa variants. It found 119 unique
exact-SKU matches and 24 Etsy products requiring review: 12 SKUs are absent from
Medusa and 12 color variations reuse Etsy SKU `38316`. It also records 478
Medusa variants absent from the active Etsy inventory and two Medusa variants
without SKUs. Etsy quantities of 998 or 999 are observations only and are not
treated as physical stock.

Private artifacts are ignored by Git and mode 0600:

- `.local/etsy-review/etsy-medusa-comparison.md`
- `.local/etsy-review/etsy-medusa-comparison.json`

Inventory synchronization and automated Etsy catalog writes remain disabled.

### September 22 owner-approved hair-claw color options

The owner approved a one-time Etsy catalog update after reviewing the standard
hair-claw colors and SKU suffixes. Medusa models `Color` as a product option;
each size/finish/color combination remains a distinct variant with a stable
SKU. Existing decorative choices that had been labeled `Color` are retained as
`Finish`, so they remain separate from the physical claw color.

Medusa now has 528 color variants across 20 hair-claw products. Etsy has 384
color combinations across the corresponding 20 active listings: the verified
12-option Boho Birds listing plus 372 combinations generated from 31 existing
size/finish variants on the other 19 listings. The Etsy operation was manual,
bounded to those listing IDs, and protected by a preflight snapshot and drift
checks. Inventory synchronization remains disabled.

Exact postflight comparison against the preflight snapshot verified that all
prices, quantities, enabled states, processing-readiness profiles, and 22
existing variation-image mappings were preserved. A new whole-shop read-only
audit returned 92 active listings, 472 Etsy inventory products, 472 exact
Medusa SKU matches, and zero unresolved Etsy products. The private evidence is:

- `.local/etsy-review/etsy-hair-claw-inventory-preflight.json`
- `.local/etsy-review/etsy-hair-claw-inventory-postflight.json`
- `.local/etsy-review/etsy-hair-claw-color-postflight-verification.json`
- `.local/etsy-review/etsy-listing-audit-post-color.json`

Reusable guarded tooling is in
`deploy/staging/apply-etsy-hair-claw-colors.cjs` and
`scripts/verify-etsy-hair-claw-color-postflight.py`. The OAuth connection now
includes `listings_w` for explicitly approved catalog maintenance. It does not
enable scheduled writes, order ingestion, or inventory synchronization.

### September 22 identity resolution and owner-authorized cleanup

The 12 Etsy variants without Medusa identities were traced against the Shopify
snapshot and `/Volumes/NAS/Assets`. The evidence is recorded in
`integrations/etsy/identity-resolution-plan.json`. The owner directed that these
variants be treated as orphans and removed from active Etsy sale. Five listings
containing only orphan variants were moved to inactive: Sunflower Hair Claw,
Paws Hair Claw, Sunflower Artsy Hair Claw, Simple Floral Earring and Leaf Dangle
Earring. The Burnt Orange `38096` option was hidden from Falling Leaves Dangle
Earrings while its valid Natural `38095` option remained active.

Etsy Shop Manager verified 97 active listings before the cleanup and 92 after,
with 30 inactive listings afterward. A subsequent API read still returned the
pre-cleanup count of 97, so the private comparison retains the baseline rows and
labels the Etsy API propagation delay. The audit now excludes inventory products
whose offerings are all disabled when Etsy's API view updates. No Medusa product,
Medusa SKU or inventory quantity was changed.

Twelve collision-free, review-only Boho Birds SKU proposals are recorded for the
color variants currently sharing `38316`. They use readable color suffixes and
the owner's `BL` for blue and `BLK` for black convention. They have not been
written to Etsy or Medusa.

Current official documentation checked September 20, 2026:

- [Getting started](https://developers.etsy.com/documentation/): Seller Apps
  are the own-shop integration path for eligible sellers. Inspect an existing
  app before creating another; eligibility includes not already having an
  active app. This is distinct from an app distributed to other sellers.
- [Authentication](https://developers.etsy.com/documentation/essentials/authentication/):
  API requests require the keystring and shared secret in the x-api-key header.
  Scoped endpoints additionally require OAuth. Use authorization-code flow with
  PKCE S256, single-use state, exact registered HTTPS callback and server-side
  token storage. Never put secrets in repository files or browser bundles.
- [Inventory migration](https://developers.etsy.com/documentation/tutorials/inventory-shipping-migration/):
  inventory reads use listings_r. Confirm current endpoint scopes/schema before
  implementing each request; missing inventory data is not a zero quantity.

The initial comparison began with `listings_r` and the read scopes needed for
verified shop lookup. `listings_w` was added only after the owner approved the
bounded hair-claw catalog update described above. Transaction-write, customer
email, and address access remain outside this integration. Order ingestion is a
later phase requiring separate scope and data-handling review.

The callback must be implemented and reachable before registering it; the
existing staging storefront is not automatically an OAuth callback. Do not
invent a working URL or assume a sandbox exists. Test parsing and mapping with
fixtures, then read authorized real data without performing commerce writes.

## Planned AI product-presentation assistant

Add an optional assistant inside Medusa Admin after the Etsy catalog mapping is
stable. Medusa remains the factual product source; the assistant prepares
channel-specific presentation drafts without forcing the Rustic Halo website,
Etsy and social channels to use identical wording.

The assistant may propose:

- Rustic Halo website titles and descriptions.
- Etsy-specific titles, all relevant tags, descriptions, taxonomy/category and
  attribute suggestions.
- SEO titles, meta descriptions and image alt text.
- Social captions, collection suggestions and related-product suggestions.
- Missing-information warnings instead of invented product facts.

Keep shared facts such as SKU, barcode, measurements, weight, materials, color,
price, images and inventory policy in the core Medusa product/variant records.
Store Etsy listing IDs, variation mappings, titles, tags, taxonomy, attributes,
description, photo order, personalization, shipping profile and any approved
channel overrides in an Etsy-specific presentation record.

The Admin workflow should show the current presentation beside the proposed
revision, identify the facts and images used, and provide explicit approve and
discard actions. AI output is always a draft: never publish or update an Etsy
listing automatically. Keep a revision history and record approval. Apply known
Rustic Halo conventions, preserve existing SKUs, and flag missing dimensions,
materials, packaging or policy details for review rather than guessing.

Run model requests through the Medusa backend. Keep provider credentials and
prompts server-side, apply cost and rate limits, and send only the product data
needed for the requested draft. Begin with individual or small-batch generation;
bulk generation and Etsy publishing require a separate reviewed milestone.

## Reusable hair-claw catalog workflow

The reusable product builder is implemented in
`integrations/etsy/hair-claw-catalog.cjs`. It takes one reviewed base variant
per size or style and expands each base SKU across the approved colors in
`hair-claw-color-policy.json`. Generated products are always Medusa drafts.
Generated variants use made-to-order inventory behavior and receive no stock
levels, including no Copper Mill quantity.

Preview a new product locally before any staging change:

```text
node scripts/preview-hair-claw-product.cjs \
  integrations/etsy/hair-claw-product-spec.example.json \
  /tmp/hair-claw-product-preview.json
```

After replacing the example values and reviewing the preview, wrap the same
`product` object in `{ "reviewed": true, "product": { ... } }`. The guarded
staging executor in `deploy/staging/create-hair-claw-product.cjs` checks the
handle and every generated SKU for collisions, creates one draft, and verifies
that all new inventory items have zero stock levels. The wrapper refuses to run
without an explicit request file and a staging environment.

Future colors follow a separate preview/apply gate. First add the reviewed name
and unique SKU suffix to `hair-claw-color-policy.json`. Use the request shape in
`hair-claw-color-request.example.json` with `mode` set to `preview`. The guarded
executor reports only the missing Medusa combinations. Changing the same
reviewed request to `mode: "apply"` creates those missing variants, verifies
that existing quantities did not change, and verifies that new variants have
no stock levels. The report explicitly marks Etsy as a separate review step;
this workflow never writes Etsy or enables inventory synchronization.

This milestone was completed and tested locally on September 22, 2026. No new
product or color was supplied, so nothing was deployed and no catalog or
inventory data changed.

## Medusa-only Etsy publishing decision

The post-color comparison contains 610 Medusa variants that are not part of the
current active Etsy catalog. `scripts/build-etsy-publishing-review.py` converts
that snapshot into a product-level review without calling either platform. The
generated artifacts are:

- `.local/etsy-review/medusa-only-etsy-review.md`
- `.local/etsy-review/medusa-only-etsy-review.csv`
- `.local/etsy-review/medusa-only-etsy-review.json`

The default decision is to keep Etsy matching what is active there now. Of the
610 variants, 154 are extra siblings on 13 products already represented on
Etsy, 262 belong to 159 published Medusa products absent from active Etsy, and
194 belong to 171 Medusa drafts or unpublished products. None are a publish
queue. The 262 published variants are deferred until the owner selects an
individual product; the 194 draft variants are excluded. Two additional Medusa
variants without SKUs are also excluded from publishing review.

The report was generated and validated locally on September 22, 2026. It made
no Etsy, Medusa, product-status, or inventory changes and did not enable
inventory synchronization.

## Disabled order-event intake scaffold

The detailed design and enablement gates are in
`integrations/etsy/order-event-plan.md`. A local backend scaffold now validates
Etsy's signed order-event envelope, enforces a five-minute replay window, binds
the receipt URL to the connected shop, and journals each `webhook-id` once. It
stores no raw payload or buyer information and leaves each event
`received_unprocessed`.

The endpoint is disabled by default and has not been deployed or registered in
Etsy's webhook portal. The connected app now has `transactions_r` solely for the
separate authenticated order report; `transactions_w` is absent. The webhook
scaffold cannot create Medusa orders, change quantities, submit tracking, send
email or synchronize inventory. Seven focused webhook tests and the full
backend TypeScript check pass locally.

## Next steps

1. Use the draft workflow when the next hair-claw product facts, base SKU,
   shipping profile, price and measurements are ready.
2. Use the color preview/apply workflow when a new color name and SKU suffix are
   approved, then prepare a separate Etsy batch for owner review.
3. Select an individual deferred Medusa product only when it should receive a
   separately reviewed Etsy listing preview.
4. Keep the verified order report read-only. Any webhook intake, Medusa order
   creation, tracking update or inventory action is a separate future milestone
   requiring explicit review and approval.

## Read-only Etsy order report

The owner selected the recommended read-only external-order report with Etsy
retaining fulfillment ownership. The report is implemented as an authenticated
Medusa Admin page and API and was enabled and verified on staging on September
22, 2026. The one-time OAuth reconnection granted `transactions_r`, and the live
30-day report fetched all three available receipts. It displays only
receipt/date/status, item count, total and SKU information. It omits and does
not store buyer names, email, addresses, payment details, or raw Etsy responses.
It never requests `transactions_w`, creates Medusa orders, changes inventory,
sends email, or updates Etsy. Anonymous API access returned 401. See
`integrations/etsy/order-event-plan.md` for the boundary and verification
record.
