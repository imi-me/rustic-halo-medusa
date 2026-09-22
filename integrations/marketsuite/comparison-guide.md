# Read-only inventory comparison

This tool is implemented locally. It has not been run against fresh staging and
MarketSuite data. It cannot enable synchronization or authorize cutover.

## Medusa export

Run `src/scripts/export-market-inventory.ts` through the backend's existing
`medusa exec` command with `MARKET_INVENTORY_EXPORT` set to a new absolute file
path in a private local directory. The script uses only module list operations.
It refuses to overwrite an existing file and finds Copper Mill by its preserved
Shopify location ID, never its display name. It reads all pages of inventory
levels and retains stocked, reserved and available separately.

The export is non-atomic: stock may change during pagination. Use it for review,
not as the authoritative cutover baseline. It exports inventory-level identities,
not the complete product catalog or variants without a Copper Mill stock level.

## MarketSuite input and reviewed mappings

A fresh account-scoped export still needs to be connected to MarketSuite's
authenticated read path. Do not export credentials, customers or entire tables.
Normalize only these fields into the input contract:

```json
{
  "schemaVersion": 1,
  "source": "marketsuite",
  "sourceLocationId": "gid://shopify/Location/79837790404",
  "locationId": "actual configured market location ID",
  "accountId": "actual Rustic Halo account ID",
  "capturedAt": "actual ISO observation time",
  "complete": true,
  "items": [{ "id": "MS product ID", "asStockId": "AS stock ID", "quantity": 4 }]
}
```

`complete` must mean all pages for the account/location were read successfully.
MarketSuite quantities are not a fresh direct AS observation. Capture that
distinction when reviewing differences. Never relabel an old snapshot as fresh.

The mapping file has `schemaVersion: 1`, `accountId`, `medusaLocationId`,
`marketLocationId`, and `items` containing `medusaItemId`, `marketItemId`, and
`asStockId`. Populate these from verified existing links. SKU similarity alone
does not approve a mapping; duplicate and missing IDs are rejected.

## Compare

```sh
node integrations/marketsuite/compare-inventory.mjs medusa.json marketsuite.json mapping.json
node --test integrations/marketsuite/compare-inventory.test.mjs
```

Snapshots must be no more than 15 minutes old. Output reports matches, quantity
differences, reservations, missing records and unmapped records. Nothing is
written back, and no customer, order or payment records are created. Even a
matching report leaves `cutoverApproved` false.

## Import and event planning prototype

`plan-import.mjs` exports two pure functions with no network or database access:

- `planImport` proposes an explicit zero-level creation only when the market
  snapshot says zero, the reviewed AS mapping matches, and a complete Medusa
  identity snapshot proves the inventory item exists but its location level is
  absent. Positive source counts, unknown items and existing discrepancies stay
  in review. A complete `catalog` identity snapshot must have schemaVersion 1,
  source medusa, the same locationId and capturedAt as the inventory export,
  complete true and unique itemIds. The current export does not yet emit this
  additional catalog snapshot; do not manufacture it from missing level data.
- `planQuantityEvent` models version conflicts, duplicate event IDs and no-op
  echoes for simulated Medusa/portal events. It only returns a proposal and next
  state. No paid orders or customers are produced.

Run both test suites:

```sh
node --test integrations/marketsuite/compare-inventory.test.mjs integrations/marketsuite/plan-import.test.mjs
```

Twelve tests pass locally. These are pure-function simulations, not a deployed
connector or proof of transport retries. Before live use, implement authenticated
transport, durable receipts/outbox, tenant-scoped mappings, reservations-aware
Medusa workflows and destination-side idempotency. Commit successful state only
after confirmed writes; an ambiguous timeout needs reconciliation, not blind
retry. In-memory receipts here are fixtures, not a production persistence layer.
The event location/item IDs represent a canonical mapping; translate to each
destination's verified IDs at the transport boundary. Source event versioning
must be implemented on both sides rather than assumed to exist already.
