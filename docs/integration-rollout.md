# Integration rollout

## Owner decisions

- Shopify is the only source for the initial catalog migration.
- Shopify's Copper Mill location is physical market inventory.
- MarketSuite is the owner's bridge between Medusa and the market POS.
- Etsy also needs an adapter.
- Online orders are made to order; Copper Mill stock must not limit website availability.
- Theme selection can proceed independently of integrations.
- Medusa will replace Shopify's role in the existing MarketSuite connector for
  Rustic Halo. Copper Mill items mirror to AntiqueSoft (AS); inventory reductions
  are the existing sales signal and adjustments sync back. Reports stay in MS.
- AS provides no customer information. This bridge must not require customers,
  invent customer accounts, or treat inventory reductions as verified payments.
- Deeper POS and kiosk integrations are deferred.

## Verified source mapping

Live Shopify connector check on September 20, 2026 confirmed Rustic Halo and
separate location entries for the Top Down Hair Claws product. This is a sample
verification, not a complete location or catalog audit.

| Shopify location ID | Source name | Intended meaning |
| --- | --- | --- |
| `gid://shopify/Location/79837790404` | Copper Mill @ Greenvillle | Physical market stock; separate Medusa location |
| `gid://shopify/Location/68049862852` | Shopify On-line Store | Source online/shop stock; preserve separately from market |

Match using stable location and variant IDs, not spelling or SKU alone. Retain
original names and IDs as source metadata. The existing pilot created locations
with a `— Local Snapshot` suffix; reconcile their source IDs before creating
anything new to avoid duplicate stock locations.

## Existing implementation and gaps

`import-pilot.ts` only targets the isolated local database, imports five products,
and preserves existing rows on reruns. It is not a staging migration or ongoing
sync. It supports only three product types, infers a single option name, and
matches inventory items by SKU. A broader importer must preserve actual option
names/values and detect duplicate or missing SKUs before applying changes.

The pilot puts source `available` into Medusa `stocked_quantity`. Do not reuse
that conversion blindly for a full migration: capture on-hand, available, and
committed independently. Decide how existing Shopify commitments are represented
without creating or losing reservations. An absent location level is not proof
of zero inventory. Never refresh market quantities from a stale snapshot after
new POS activity.

MarketSuite has local read-only endpoint/client implementations and simulation
tests, but no deployed Medusa connection. Etsy remains in preparation: the owner
reports the `rustichalodotcom` developer application is pending approval. Do not
create another app or assume authorization is available. See
`shopify-catalog-audit.md` for the partial catalog audit and export gaps.

## Delivery sequence

1. Read-only Shopify catalog/location export with pagination completeness and
   counts; preserve product, variant, inventory-item and location IDs.
2. Produce a staging import diff: new products, existing mappings, options,
   photos, prices, stock by location, unsupported shipping types and conflicts.
   Preserve the verified pilot's CDN images and local edits for review.
3. Inspect MarketSuite's existing Shopify/AS connector and implement Medusa as
   its replacement for Rustic Halo: Copper Mill item mirroring, inventory changes,
   stable item mappings, deduplication, loop prevention and reconciliation.
   Preserve existing sales/adjustment classification and MS reporting. Do not
   infer customer records, paid orders, refunds or voids from quantity changes.
4. Inspect Etsy application access and existing listing/variation mappings.
   Confirm made-to-order versus stocked availability per listing; never publish
   Copper Mill quantities as Etsy availability implicitly.
5. Test adapters in staging with replay and failure cases, then agree on stock
   ownership and cutover before enabling ongoing external writes.

## Needed inputs

- Etsy developer application/access availability and shop identity.
- Exact connector mappings and cutover procedure, established from MarketSuite
  code before enabling writes. Avoid simultaneous Shopify and Medusa writers.

No Shopify quantities, Etsy listings, MarketSuite records, or staging inventory
were changed during this initial integration audit.

## Market Suite source located — September 20

Codex project `Market Suite` is at
`/Users/shawnhouse/Documents/ChatGPT/Market Suite`.
Read-only inspection of README.md, CLAUDE.md and source filenames establishes:

- The existing market POS integration is AntiqueSoft.
- Market Suite currently treats its standalone catalog as authoritative, with
  a Shopify connector and inbound Shopify webhooks. Its documentation says
  Shopify sales are not ingested.
- No Medusa references were found in src or supabase/functions in this checkout.
  A Medusa bridge must therefore be designed/implemented, not merely configured.
- Production frontend deployment is automatic on pushes to main. No changes or
  pushes were made to that project during discovery.

The owner clarified that Medusa should replace Shopify's connector role, not
change MarketSuite's catalog ownership globally. Scope the adapter to Rustic
Halo and Copper Mill; preserve other MarketSuite users and the AS workflow.
Shopify is the initial import source. The connector must work without AS customer
data, and reporting stays in MarketSuite. Validate the actual code paths and
agree on cutover before enabling ongoing external writes.
