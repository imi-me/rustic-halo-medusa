# Etsy order-event plan

Status: Etsy preparation workspace deployed and verified on staging October 15,
2026. Webhook intake remains disabled. Current acceptance is recorded in the
final section; the earlier report-only boundaries below are historical.

## Current boundary

The backend can validate and journal Etsy webhook envelopes, but the endpoint is
disabled unless `ETSY_WEBHOOK_INGEST_ENABLED=true`. The webhook scaffold has not
been deployed or registered with Etsy, and no webhook subscription exists. The
journal stores only Etsy's delivery ID, event type, shop ID, receipt ID,
resource URL, timestamps and processing status. It does not store the raw
payload, buyer information, address, payment details or line items.

The endpoint accepts only Etsy's documented `order.paid`, `order.canceled`,
`order.shipped` and `order.delivered` events. It verifies the signature against
the exact raw body, rejects timestamps outside five minutes, binds the resource
URL to the connected shop and receipt, and deduplicates on `webhook-id`. New
entries remain `received_unprocessed`; no handler fetches a receipt, creates a
Medusa order, changes inventory, sends email or updates Etsy.

## Read-only order report milestone

The backend now includes an authenticated Medusa Admin route at
`/admin/integrations/etsy/orders` and an **Etsy orders** admin page. It reads a
30-day window by default and limits requests to 90 days and 500 receipts. The
response includes receipt IDs, dates, paid/shipped status, totals, line titles,
SKUs and quantities. It discards buyer identity, email, shipping address,
payment details and the raw Etsy response, and stores none of those fields.

The route was enabled and verified on staging on September 22, 2026. The Etsy
OAuth reconnection succeeded with `transactions_r`; the implementation never
requests `transactions_w`. The authenticated Medusa Admin report fetched all
three receipts in its 30-day window and displayed only receipt/date/status,
item count, total and SKU information. Anonymous access returned 401. The
backend and storefront were healthy after deployment. No buyer identity, email,
address, payment detail or raw Etsy response is displayed or stored, and the
report performs no Etsy, Medusa order, email, or inventory write. Thirty-five
focused Etsy tests and both backend/admin TypeScript checks pass locally.

## Proposed processing stages

1. **Intake journal:** acknowledge each valid delivery once. Etsy delivery ID is
   the idempotency key. Duplicate deliveries return success without new work.
2. **Receipt read:** only after separate approval, add `transactions_r`,
   reauthorize the shop, and fetch the receipt named by Etsy's resource URL.
   Persist a minimal immutable snapshot keyed by receipt ID and Etsy's last
   modification marker. Do not assume address fields are available.
3. **Identity reconciliation:** match each Etsy transaction to exactly one
   Medusa variant using the reviewed SKU mapping. Missing and duplicate matches
   enter a review queue. They never become zero inventory or a guessed product.
4. **Read-only order view:** begin with an external-order record or report. Do
   not create a normal paid Medusa order until payment, tax, discounts, shipping,
   refunds, cancellations and fulfillment semantics are mapped and tested.
5. **Reconciliation:** periodically compare Etsy receipts to completed journal
   entries so a missed webhook can be detected. Recovery targets one receipt and
   reruns the same idempotent handler.
6. **Outbound actions:** shipment/tracking submission requires `transactions_w`
   and can notify the buyer. Keep it outside the first receipt-read milestone.

## Inventory ownership

Etsy online products are made to order. An Etsy sale must not decrement Copper
Mill inventory. The first order integration therefore performs no inventory
write. Any future quantity action needs a documented location, source owner,
loop-prevention marker and reconciliation rule. Market Suite remains the bridge
for Copper Mill and AntiqueSoft; Etsy order events cannot masquerade as an
AntiqueSoft sale or customer record.

## Decisions recorded for the first order-report phase

1. The first Etsy view is a read-only external-order report. It does not create
   Medusa orders.
2. Etsy owns fulfillment status and tracking. `transactions_w` remains absent.
3. The report stores no buyer or shipping data.
4. The UI defaults to 30 days and allows at most 90 days; full shop history is
   not imported.
5. Webhook intake remains a separate, disabled future milestone. Enabling it
   still requires staging signature and duplicate-delivery tests, failed-job
   visibility, receipt reconciliation and a rollback procedure.

## Verification required before any future webhook deployment

- Run the local webhook unit tests and full backend TypeScript check.
- Apply the journal migration in staging and verify the endpoint remains 503
  while disabled.
- Store the signing secret outside Git, enable intake, and use Etsy's webhook
  portal test delivery before subscribing to a commerce event.
- Verify one delivery, one duplicate, one stale delivery and one invalid
  signature. Confirm no order, inventory, email or provider request occurred.
- Disable the endpoint again until the receipt-read milestone is approved.

References: [Etsy webhooks](https://developers.etsy.com/documentation/essentials/webhooks/),
[Etsy API reference](https://developers.etsy.com/documentation/reference), and
[Medusa raw webhook bodies](https://docs.medusajs.com/learn/fundamentals/api-routes/parse-body).

## Etsy preparation workspace — October 15, 2026

Owner authorized building and deploying the next staging milestone: a shared
Orders workspace with Website/Etsy channels, preparation stages, detailed order
selections/personalization, ship-by dates, packing suggestions/slips, an Etsy
label link, and shipment/tracking reads. This supersedes the report-only UI
boundary above for this milestone. Etsy owns payment, refunds, cancellation and
shipment status. No normal Medusa order, payment, inventory write, outbound
Etsy notification, label purchase, or listing update is part of this phase.

Preflight through the existing staging OAuth connection returned HTTP 200:
seven receipts in the last 90 days, all paid/shipped; all seven expose complete
shipping address fields and existing shipment tracking. Four have variations;
all have expected ship dates. No additional OAuth scope is needed. Only field
names and aggregate counts were retained in the private capability report.

The new `/admin/integrations/etsy/workspace` API and per-receipt route use staff
actor checks and order/product/shipping policies; local writes require the
existing allowed-origin check. Existing report enablement gates the workspace
and a 15-minute scheduled refresh. Refresh reads the last 90 days plus older
unshipped orders, reconciles previously open receipts individually, deduplicates
by shop/receipt, retains saved preparation stages, and reports bounded-page
truncation/failures without replacing good snapshots with invalid data. No
webhook subscription or transaction-write scope is required for this phase.

Minimal operational snapshots and preparation revisions use the existing
admin-operations module. Names, addresses, email, messages, personalizations,
tracking codes and raw provider responses are not stored in the cache.
A one-way content fingerprint detects changes to live fulfillment details.
Opening an order fetches permitted details on demand with private/no-store
responses. Packing slips are printed from those details and omit prices.
Exact case-insensitive SKU matching must identify one native variant; no title
or color guess is used. Missing/duplicate SKUs, refunds, cancellations, unpaid,
digital-only and partly shipped orders cannot be marked ready. Product mapping
and the existing shipping calculator provide the complete-order box suggestion;
any unmatched physical item blocks automatic packing for the whole order.

Preparation changes are local to Medusa, revision-checked and serialized with
refresh/detail reads. Each change re-reads Etsy first, rejecting any changed
receipt, newly shipped/canceled/refunded order, or changed product mapping.
Etsy payment and shipment state always override local preparation stages.
Shippo remains limited to the existing website workflow; Etsy labels are bought
in Etsy. The feature does not enable any external write/purchase gate.

Implementation/evidence: `.local/admin-etsy-orders-20261015/` (isolated source,
`capabilities.json`, focused tests, typechecks, build and staging acceptance).
Staging release and final browser/API results will be appended after verification.


### Staging acceptance — October 15, 2026

Completed and verified: feature release `9813e350cd7e19aa76915ad12824d7c7902cd0e5`,
with preparation-save repair `6713329b603a6576ee1a6e01b2a23fcb9a7fc8f1`.
Final Coolify deployment `0nluuadhpz5sqr3r6pejpz4p` finished
2026-10-15T18:32:38Z; both services are healthy. The fresh sanitized job-health
report at 2026-10-15T18:34:20.210Z is OK with zero failed/waiting/active/delayed/paused jobs.

73 tests in 11 Etsy suites, backend/Admin TypeScript, and the full backend/Admin
build pass. The initial real-order negative check exposed JSONB object-key
reordering: a stringified-object comparison rejected unchanged receipts. The
repair uses structural equality; regression fixtures now roundtrip objects with
sorted keys. A disposable internal Etsy workspace fixture against staging's real
database persisted Needs making → Ready to pack → Needs making, rejected a stale
revision, reconciled a simulated shipment to Shipped, and produced a correct
6×4×3-inch, 2.601-oz box for two mapped accessory items. Provider receipt reads
were simulated for that fixture; no Etsy order, native order, stock or payment
was created. The internal fixture was soft-deleted and seven real cached orders
remain, with no duplicate keys or private fulfillment fields in stored payloads.

Real staging API checks opened all seven historical paid/shipped orders: all
seven provide usable shipping addresses and tracking. Shipped-order preparation
changes return 409, anonymous requests return 401, and untrusted origins return
403. One historical line matches the current native catalog; seven lines across
six other receipts have older unmatched SKUs. Those details display a review
warning and block automatic packing for the entire order. Do not guess SKU
aliases or alter historical Etsy records. The matched one-item order gives the
approved 6×4×3-inch accessory box at 2.101 oz packed. All 419 complete original
product responses match the baseline, the native order count remains 10, and
all original Etsy receipt summaries match their baseline exactly.

A real scheduled refresh ran at 18:30:00Z and finished at 18:30:01Z, fetching all
seven orders without errors. Native browser checks confirm both channels load,
actual packing/tracking/address availability, shipped-stage controls disabled,
and no UI errors. A fresh verified Etsy order list is open in the preview at
`https://staging.rustichalo.com/app/orders-workspace?source=etsy`.

Exact evidence: `.local/admin-etsy-orders-20261015/` contains
`initial-release.json`, `release.json`, `capabilities.json`, `unit-tests.log`,
`backend-typecheck.log`, `admin-typecheck.log`, `build.log`,
`local-browser-checks.json`, `native-preparation.json`, `scheduled-refresh.json`,
`staging-checks.json`, `native-cache-check.json`, `staging-browser-checks.json`,
`deployed-services.json`, and `staging-etsy-orders.png`.

Remaining work: deliberate matching for historical/unknown SKUs as needed,
physical packing-slip printer acceptance, and any future separately scoped
Etsy listing-write or Shippo-for-Etsy label milestone. Preparation saves are
verified with a disposable native-database fixture; all seven actual available
orders are already shipped. Label purchasing stays in Etsy, all external
listing/color/Shippo purchase gates remain off, and production/Shopify were not
changed. No blocker remains for testing the workspace on staging.

## Historical Etsy SKU matching — October 15, 2026

Owner authorized linking old Etsy order SKUs to the correct products so historical
packing suggestions work. Seven previously unmatched lines across six receipts
trace to five source SKUs: `38308-2` Daisy 2-inch, `38290-2` Paisley 2-inch,
`39082-4` Floral Nurse 4-inch, `38510` Playful Cat 4-inch, and `HC38559` Freebird
4-inch (Etsy title: Flying Mallard). The September 22 exact-SKU audit independently
records each original Etsy listing/product ID and unchanged native variant ID;
current variant `base_sku` metadata and saved size-specific measurements agree.

These older transactions record no color. A reviewed, shop-scoped crosswalk is
saved under `etsy-order-matches:<shop>` in admin-operations, keyed by receipt and
transaction. It binds the original listing/product/SKU/quantity/selection
fingerprint to the native product and original audited variant's source group.
It never rewrites native/Etsy SKUs, prices, inventory, historical orders, or
product availability. No global prefix/fuzzy/title-only SKU guessing is added.

Historical matches carry product identity with no purchased native variant or
invented color. Their saved size-specific reference group must still exist,
belong to the approved product/base SKU, and have identical explicit positive
item weights and effective package/mixing/capacity settings across every color.
Only after that check can one equivalent reference be passed privately into the
unchanged packing calculator. Deleted, changed-source, cross-product, divergent
or unmeasured references require review. A product-only match cannot authorize
making/ready-to-pack work on an unshipped order where a color remains unknown.

UI details show the matched product link and explain that the original color was
not recorded. The reviewed staging-only operation is
`deploy/staging/link-historical-etsy-orders.cjs`; it preflights every source and
reference before saving one crosswalk record, requires explicit staging flags,
and checks the expected prior revision. Removing the reviewed links and
refreshing restores the prior unmatched state without touching catalog/orders.

Source/evidence: `.local/admin-etsy-sku-links-20261015/`, especially
`etsy-identities.json`, `prior-sku-matches.json`, `catalog-history.json`,
`live-products.json`, and `approved-plan.json`. Final release and acceptance
results will be appended after deployment and verification.
