# MarketSuite connector mapping

Read-only source review, September 20, 2026. These findings describe the local
Market Suite checkout, not verified production configuration. No external writes.

Source root: `/Users/shawnhouse/Documents/ChatGPT/Market Suite`.

## Live account configuration verified September 20

Read-only queries against the source project's verified Supabase project
`vvlkojebvpwbkgeeplka` found the owner's sync configuration uses platform
`standalone`, location key `standalone`, label `Portal Catalog`, enabled.
The separate Shopify connector selects location `79837790404`, Copper Mill @
Greenvillle. Thus the actual replacement point is Shopify ↔ portal catalog;
the portal ↔ AS inventory adapter should remain standalone. Do not switch that
adapter to Medusa merely because the code supports additional providers.

The scoped active catalog contains 554 records: 551 with a non-null Shopify
variant link, 301 with a non-null explicit AS stock ID, and none with an empty
barcode. These counts do not prove uniqueness, AS presence or current quantities.
Missing explicit AS IDs may use barcode/SKU fallback; audit before classifying
them as unlinked or creating AS items. Three records lack a Shopify variant link
and need separate mapping review.

Preserve standalone product IDs, AS baseline keys and MS report history. Attach
Medusa identities alongside legacy Shopify links. A new direct Medusa platform
adapter is not needed for the initial replacement; use the portal catalog's
existing AS boundary. Quantity observations still need a fresh paired comparison.

## Existing connection points

| Source | Observed behavior | Medusa replacement |
| --- | --- | --- |
| `supabase/functions/inventory-sync-manager/index.ts`, `PlatformInventoryAdapter` | Reads location inventory and sets a target quantity; implementations exist for Shopify, Square and standalone | Add an explicitly selected Medusa provider, scoped to Rustic Halo and Copper Mill |
| Same file, `resolvePlatformAdapter` | Unknown platform falls back to Shopify | Reject unknown providers for new configuration; never allow a Medusa configuration to silently use Shopify |
| Same file, sync loop | Creates positive-stock items missing from AS; compares last observed quantities; logs AS reductions as sales | Reuse AS boundary and MS reporting, with reviewed baselines and durable successful-change tracking |
| `supabase/functions/shopify-webhook/index.ts` | Selected-location events update known standalone products, propagate to AS, and mark a portal adjustment | Receive authenticated Medusa changes with stable event IDs, account/location mapping and echo suppression |
| Same file, `stagePendingFromInventory` | Unknown stocked items are staged for review; SKU/barcode and positive availability are required | Owner wants automatic mirroring for eligible Copper Mill items; explicitly implement this difference, leaving invalid or ambiguous mappings for review |
| `supabase/functions/shopify-connector/index.ts` | Connect/location selection, catalog sync, barcode lookup/import and pending imports | Provide equivalent Medusa connection and catalog operations without changing other accounts' Shopify behavior |

`adjustQuantity` currently takes an **absolute target**, despite its name. Do not
implement it as an additive delta. Source fields and history still carry Shopify
names even for other providers; inventory identities and baseline rows need an
explicit migration/mapping, not new unrelated rows that trigger first-contact sync.

## Important behavior to protect at cutover

- First-contact differences currently force AS to match the provider's quantity.
  Run a read-only comparison first; preserve/reconcile the existing baseline
  before enabling Medusa. An initial difference is not a newly detected sale.
- A missing AS bulk-list item triggers a direct lookup. In the reviewed branch,
  lookup failure can still lead to zeroing provider stock. The Medusa path must
  treat failed/incomplete observations as unknown, not sold-out evidence.
- Some write failures are caught but the loop still constructs a next baseline
  with intended quantities. Commit a new baseline only after confirmed success;
  retain failed work for retry and reconciliation.
- Recent outbound changes suppress apparent AS decreases using last direction.
  Test delayed AS visibility and simultaneous restock/sale; direction alone must
  not discard a real new sale or replay an old one.
- Some outbound AS updates use return-and-readd operations. Keep these behind
  the existing AS connector and test recovery if the second step fails.
- The reviewed loop does not establish symmetric handling for every adjustment
  (for example AS increases). Trace manual adjustment/report paths before
  promising full parity. Do not reinterpret every quantity change as a sale.

## Initial Medusa contract

1. List the configured Copper Mill location's mapped variants, display fields,
   price, barcode/SKU, and separately defined physical/available quantities.
   Paginate fully; incomplete results cannot establish deletion or zero stock.
2. Mirror eligible item additions and changes through MarketSuite to AS. Keep
   legacy Shopify IDs, Medusa variant/inventory IDs, MS product ID and AS stock ID.
3. Apply an observed market quantity change only to the mapped Copper Mill stock
   level, with event deduplication, expected baseline/version and conflict handling.
   Never overwrite reservations by confusing available with stocked quantity.
4. Record synchronization state and errors without creating customer or payment
   records. Keep MS sale statistics and notifications within its existing flow.
5. Disable Shopify writes for this account/location at the agreed cutover, take a
   fresh comparison, then enable Medusa. Preserve a documented rollback baseline.

No AS customer fields are available or required. Website made-to-order
availability remains independent of Copper Mill finished stock. Kiosk, payment
confirmation and deeper reporting remain deferred.

## Staging acceptance cases

Test eligible new item, invalid/duplicate identifiers, existing-item edits,
restock, AS reduction, manual adjustment, explicit zero, missing item in a partial
listing, failed direct lookup, duplicate/reordered event, failed write, restart,
simultaneous changes, delayed AS visibility, location/account isolation and
cutover without quantity changes. No real AS writes or customer messages are
needed for contract tests.

Next implementation slice: a read-only Medusa inventory export and comparison
against portal catalog mappings, followed by a mock-backed Medusa-to-portal
connector. Retain the existing standalone-to-AS adapter.
