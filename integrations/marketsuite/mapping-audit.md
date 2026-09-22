# MarketSuite mapping audit — September 20, 2026

Read-only queries of the Rustic Halo owner's active portal catalog in project
`vvlkojebvpwbkgeeplka`. These observations are a mapping audit, not a fresh
Medusa/AS quantity comparison or authorization to change inventory.

## Identifier checks

- No duplicates found within trimmed Shopify variant IDs, barcodes, SKUs or
  explicit AS stock IDs among active records.
- No duplicate or empty effective sync keys found using the sync manager's
  digit-normalized barcode → SKU → record ID fallback.
- All six variants from the five-product pilot matched by Shopify variant ID.
  Several portal SKUs differ from the pilot snapshot; SKU-only matching would
  miss them. Preserve leading zeros and keep all identifiers as strings.
- These checks do not verify actual AS item existence or cross-field collisions.

## Pilot links found

| Shopify variant ID | MarketSuite product ID | Portal barcode | Explicit AS ID |
| --- | --- | --- | --- |
| 46129682546884 | c5fc241f-9adb-4ba5-949d-32a72bc0d7e5 | 08887236 | 08887236 |
| 46129682579652 | c942f327-00f5-4ee2-8131-0e56782dec23 | 84627391 | absent |
| 44767529337028 | 85abc01c-6ac0-4cab-b7ec-a884a80d56f1 | 29337028 | 29337028 |
| 44848049881284 | 8d3dbade-b166-41f2-ab67-b9691b9dcb86 | 49881284 | 49881284 |
| 44714392191172 | d59b3cdc-96d8-4419-9a9c-b8a842ad3684 | 92191172 | absent |
| 44758104932548 | a036c476-4df8-4d8d-becc-9f72a41b0a66 | 04932548 | 04932548 |

Numeric Shopify variant IDs correspond to Medusa's preserved metadata value
`gid://shopify/ProductVariant/<id>`. Resolve the actual Medusa inventory item
through variant links, not SKU. Confirm AS fallback IDs for the two absent
explicit links before producing an approved mapping file.

## Three records without Shopify variant links

| Product | MarketSuite ID | Imported from | Barcode |
| --- | --- | --- | --- |
| Sea Turtle Serenity 8-inch Round | 10da3574-2487-4de9-b7ca-eb3e02d03adc | manual | 562764381 |
| Breast Cancer Survivor Car Charm/Ornament | b00e2694-ffd7-4b51-8296-517b8cf9d3ee | manual | 39520452 |
| MAMA Charm | d34aafe8-ce47-4f0a-9383-20a0ee44589d | antiquesoft | 589900387 |

Preserve these existing portal records. Do not delete them, silently add them to
the Shopify-sourced website catalog, or fabricate Shopify identities. Resolve
them separately before cutover if they need a Medusa counterpart.

## Remaining verification

Read current Medusa variant/inventory links, collect paired fresh snapshots,
confirm effective AS keys, and review differences. Retain the existing portal
catalog and standalone-to-AS baseline/history throughout migration.

## Paired pilot quantity review — September 20, 9:47 PM Eastern

Read current Medusa admin inventory details through localhost:19000 and freshly
queried MarketSuite at 2026-09-21T01:47:22Z. This is a manual UI/database sample,
not an execution of the export script or a direct AS query. Server-side export
was unavailable without a sudo password; existing authenticated admin access
allowed the read-only review to proceed.

| Pilot variant | Medusa Copper Mill stocked / reserved | MS quantity | Result |
| --- | --- | --- | --- |
| Top Down 4-inch | 2 / 0 | 2 | Matches |
| Top Down 2-inch | 2 / 0 | 2 | Matches |
| Floral Cross | 2 / 0 | 2 | Matches |
| Welcome Succas | 1 / 0 | 1 | Matches |
| Round Medallion | No Copper Mill level shown | 0 | Missing level; not an explicit zero |
| Goat Hi | No Copper Mill level shown | 0 | Missing level; not an explicit zero |

The inventory detail pages also show a separate European Warehouse demo location
with 1,000,000 units per pilot item. Never export aggregate stock or include that
location in the market connection. Online-location test reservations are also
separate; Floral Cross shows negative online available stock. No cleanup or
inventory changes were made during this audit.

Next: explicitly map missing market levels during the reviewed import, verify
variant metadata against the actual inventory links, and implement the portal
connector in isolated tests. The four count matches are not full-catalog or
cutover approval.

## Owner-facing comparison review — September 22, 11:13 AM Eastern

The installed Market Suite **Medusa comparison** report completed successfully
against fresh snapshots collected at 11:13:35 AM Eastern. The report remained
read-only and displayed the inventory-sync-disabled notice throughout the run.
It returned:

- 3 exact quantity matches: Welcome Succas (1 stocked, 0 reserved, 1 available),
  Floral Cross (2 / 0 / 2), and Top Down 4-inch (2 / 0 / 2).
- 1 unmapped Medusa inventory item: Top Down 2-inch, SKU `38462-2`, with 2
  stocked, 0 reserved and 2 available at Copper Mill.
- 551 unmapped Market Suite items. These are identity/coverage review items,
  not zero quantities or quantity discrepancies.

The Top Down 2-inch Medusa variant retains Shopify variant identity
`gid://shopify/ProductVariant/46129682579652`. Its corresponding Market Suite
record was already known to lack an explicit AS stock ID; its barcode fallback
must not be promoted to an AS identity without confirmation. The comparison
therefore correctly kept it out of the proposed mapping.

This review does not approve cutover or inventory synchronization. The next
input is confirmation of the Top Down 2-inch AS stock identity, followed by a
reviewed decision about which of the 551 Market Suite records should receive a
Copper Mill inventory level in Medusa. Missing levels must remain missing until
that decision; they must never be inferred as zero stock.
