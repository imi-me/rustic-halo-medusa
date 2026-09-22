# Shopify catalog audit

## Organization and CDN transfer completed — September 20, 2026, 11:35 PM Eastern

VM report completed at 2026-09-21T03:35:35.231Z: all 414 imported drafts updated,
zero failed products, 1,499 distinct source image URLs copied and byte-verified
on cdn.rustichalo.com (465,454,151 bytes). Retrieved report is
`.local/staging-catalog-organization.json`. Product IDs exactly match the 414
created by the draft import, with no overlap with preserved pilot IDs. One
product still has no source images (previously identified Coastal Catch Hair
Claw); no replacement imagery was invented. This supersedes preparation below.

Collections assigned while retaining draft status: 175 earrings, 68 hair claws,
93 signs, 25 coasters, 53 gifts/home decor. Stock quantities, publication and
shipping setup were not changed. Remaining work includes missing SKU/image
review, shipping profile mapping and packaging details, and deliberate
publication. Local report verification checks completed IDs and CDN destinations;
it is not a separate post-run browser audit or backup/restore verification.

## Catalog organization / CDN transfer prepared

Uploaded `organize-catalog-drafts.cjs` and `.sh`; execution pending via owner VM
command `sudo sh ~/rh-images`. Covers imported drafts only, leaving pilots and
unrelated products untouched. Planned collections: 175 earrings, 68 hair claws,
93 signs, 25 coasters, 53 gifts/home decor. Explicit source-ID mappings handle
three blank product types and Cowgirl Heart Boot Dangles. Existing collection
assignments are preserved. No stock, publication or shipping flags are changed.

Image copies use the existing Medusa file provider and verify CDN bytes before
updating each product. Checkpoint `/tmp/catalog-organization.json` in the backend
container records original product fields, verified URL mappings and completed
products. Reruns resume rather than repeating completed product updates. Failed
items remain for review. Images are not deleted from either source or CDN.
Two tests verify draft-only/resumable behavior and preservation on failed download.
VM result is `catalog-organization.json` after execution; no live transfer claimed yet.

## Draft import completed — September 20, 2026, 11:06 PM Eastern

Owner ran the staged importer. Report completed at 2026-09-21T03:06:02.097Z:
414 new draft products created, five existing mapped products preserved. Each
created product was retrieved and checked for draft status, source identity and
variant count during execution. Local report `.local/staging-catalog-draft-import.json`
matches all 414 planned Shopify IDs exactly, with unique destination IDs; all
25 coasters are included. No stock quantities were written and no sales channels
were assigned. Packaging/profile mapping, R2 image migration, catalog review and
publication remain pending. This supersedes the preparation status below.

## Staging draft import preparation — September 20, 2026

Fresh destination comparison at 2026-09-21T02:46:57Z found 10 existing products:
five mapped Shopify products to preserve, five unrelated products to leave alone,
and 414 source products eligible for new drafts. No handle or SKU conflicts.
Saved comparison: `.local/staging-catalog-import-preview.json`.

`deploy/staging/import-catalog-drafts.cjs` and `.sh` are uploaded but not executed.
Offline planning against the actual comparison confirms 414 drafts / 573 variants,
including 25 coaster products with packaging pending. Four safety tests passed.
Shopify shop currency freshly verified USD. Uses createProductsWorkflow and source
identity metadata; reruns preserve completed imports. No sales channel assignment,
stock level creation, publication, barcode assignment or existing product updates.
Original barcodes, HTML, types and tags remain in metadata for later mapping.
Images initially reference Shopify CDN; R2 migration remains pending. Source
weights convert to grams; packaging is not included. Missing SKUs stay blank and
are marked for review. No physical inventory counts are imported in this step.

Execution requires the owner's VM administrator password:
`sudo sh ~/rustic-halo-staging/import-catalog-drafts.sh`.
Verify `catalog-draft-import.json` and a fresh catalog comparison after execution.

## Completed discovery — September 20, 2026, 10:32 PM Eastern

All nine pages retrieved: **419 distinct products, 579 variants**. Last page
reports no next page. Every product's returned variant count matches its
declared count after supplementary detail reads. This is complete discovery
and identifier auditing, not a complete import payload or atomic stock snapshot.

No remaining duplicate nonempty SKUs were found after a fresh read confirmed
Black Jeeper Ornament `38146BLK`. Seven missing SKUs were confirmed with fresh
product-detail reads:

| Product | Variant needing a SKU |
| --- | --- |
| Turkey Football Round Door Hanger | Default |
| Christian Faith Hair Claw Clip | Colors by Cate 4-inch |
| Merry and Bright Hair Claw | Default |
| Wildflower Hearts Dangle Earrings | Red Floral |
| Wildflower Hearts Dangle Earrings | Brown |
| Wildflower Hearts Dangle Earrings | White Floral |
| You Are Loved Faith Shelf Sitter | Default |

**Coastal Catch Hair Claw** has no images, confirmed in its detail response.
Three products have an empty product type. Preserve these as review exceptions,
not invented labels or automatically published incomplete records.

The catalog includes 25 coaster products. The owner has now approved including
coasters in the catalog import. Keep their shipping setup pending until packaging
dimensions and empty packaging weight are supplied; do not invent rates or
automatically publish them for checkout before shipping is configured.

Consolidated machine-readable findings: ignored
`.local/shopify-catalog-audit-summary.json`. Exception confirmations:
`.local/shopify-final-exception-details.json`. Original page snapshots are kept
for provenance; they predate the authorized Black SKU correction.

Full source export is now saved across 42 pages: 419 products, 579 variants,
and 1,667 media references, with descriptions, structured options, weights/units,
and per-location on-hand/available/committed quantities. All nested pagination
flags are complete and variant counts match. These are image references, not
downloaded or migrated image files. Inventory was read over time, not atomically.

Run `python3 scripts/prepare-shopify-import-preview.py` to validate the saved
pages and regenerate `.local/shopify-import-snapshot.json` and
`.local/shopify-import-preview.json`. The preview includes all 25 coasters with
packaging pending and marks the five known pilot products for preservation.
It is a source-based plan, not a fresh staging diff. Nothing is automatically
published and no destination stock is modified.

Remaining import work: fresh destination comparison, collection and shipping
profile mapping, image migration, and draft import. Existing pilot content/CDN
images must be preserved. No products or quantities were imported or changed
during this export; the earlier authorized Black SKU correction is recorded below.

## First page reviewed — September 20, 2026

Read-only live Shopify product search, first 50 products ordered by ID. More
pages exist; this is not a complete catalog audit or import-ready export.
Captured source response is in ignored `.local/shopify-catalog-audit-page-1.json`,
including continuation cursor and IDs. No Shopify or Medusa records changed.

The sample contains 22 Round Wood Sign, 18 Dangle Earrings, six Drop Earrings,
three Stud Earrings and one Bread Board products. The pilot importer only
handles Round Wood Sign, Dangle Earrings and Hair Claw types. Full import must
support the additional types without silently guessing collections or shipping
packages. Bread board packaging/weight is not yet verified. Stud and drop
earring weights must not automatically inherit an unverified dangle weight.

No missing or duplicate SKUs were found among the returned variants. All 50
products had a featured image. These are sample-level findings only.

## Export completeness issue

Baseball/Softball Earrings reports six variants but this browsing response
contains only five. Descriptions are shortened, featured media is not the full
image gallery, and per-location inventory and true option fields are absent.
Do not feed the browsing response to an importer or fill gaps from assumptions.

Full export must obtain complete product and variant pagination, descriptions,
options and option values, images, prices/currency, weights/units and inventory
item IDs. Read location inventory separately, preserving on-hand, available and
committed values. Reconcile source totals and detect concurrent updates before
using snapshots to set any quantities. Preserve existing pilot CDN images and
local edits when preparing a diff.

Next choices: continue the catalog audit with the next page, or narrow to a
product category for an initial import batch. A complete export mechanism is
needed either way before applying changes.

## Second page and detail retrieval

Continued using the installed Shopify connector at the owner's request. Saved
the next 50 products in `.local/shopify-catalog-audit-page-2.json`. There are 100
distinct product IDs across both pages; additional pages remain. Combined types:
28 Round Wood Sign, 41 Dangle Earrings, 10 Drop Earrings, 10 Stud Earrings,
two Bread Board, one Dangle, one Gift Boxes, and seven Christmas Ornament.
No duplicate SKUs were found among the variants returned by the two search pages.

The connector's dedicated get-product tool resolves search-result truncation:
Baseball/Softball Earrings returned all six variants and ten images, and Wood
Heart Stud Earrings returned all six variants and seven images. Saved both
detail responses in ignored `.local/shopify-*-detail.json` files. Descriptions
are provided as full HTML by this tool. This is a browsing-result limitation,
not a missing Shopify product variation or a need for another connector.

Use search for discovery and dedicated detail reads for migration content,
checking returned variants against totalVariants each time. This detail schema
still lacks structured option names/selected values and physical weight fields;
obtain those through the connector's validated GraphQL tools before importing.
Inventory totals remain unsuitable for Copper Mill location quantities.

Gift boxes and Christmas ornaments introduce additional packaging checks.
Do not silently assign them the hair-claw, earring or sign shipping profiles.
The type `Dangle` should be reviewed as a possible category alias, not rewritten
on Shopify. No source products or destination catalog records were changed.

## Third page and identifier exceptions

Continued to the third page with owner authorization: 150 distinct products
reviewed cumulatively; more pages remain. Saved the page and detail reads in
ignored `.local/shopify-catalog-audit-page-3.json`,
`.local/shopify-jeeper-ornaments-detail.json` and
`.local/shopify-turkey-football-detail.json`.

Jeeper Ornaments has nine variants; dedicated detail retrieval returned all
nine, versus five in the browsing result. Bright Blue (variant
42614927556804) and Black (42660331159748) share SKU `38146B`. Keep them separate
using their Shopify variant IDs; a SKU-based inventory lookup could collapse
them. Do not rename the existing source SKUs without checking MarketSuite/AS
links. The pilot SKU-only importer must not process these variants.

Turkey Football Round Door Hanger, variant 42612843741380, has no SKU in the
search response. Keep it as an explicit import exception until source detail
and the ID-based mapping policy are resolved; do not invent a business SKU.

New types include Christmas Food Tray, Earrings and Tumbler Topper. They need
category and shipping-profile review. Every product on the three search pages
has a featured image, but this does not prove complete galleries or image quality.

No records changed. Next: continue the remaining catalog pages or narrow the
audit by category; keep missing/duplicate SKU exceptions in the import report.

## Owner-authorized SKU follow-up marker

Changed Jeeper Ornaments **Black**, Shopify variant `42660331159748`, from
`38146B` to `38146B-used` at the owner's request. Shopify mutation confirmed
the new value with no user errors. Bright Blue was not included in the update.
This suffix is a temporary follow-up marker, not a used-condition designation.
Owner will investigate the underlying duplicate later. Only the SKU field was
submitted; no prices, quantities, barcodes or option values were included.
Earlier snapshots retain their historical values; fresh imports must fetch
current details. Downstream MarketSuite webhook propagation is not verified.

Owner then clarified the color convention: BL for Blue, BLK for Black. Replaced
the temporary Black SKU with `38146BLK`; Shopify confirmed success. The distinct
Blue variant already has `38146BL` and Bright Blue retains `38146B`. The
temporary `-used` marker is superseded; no color variants were merged.

## Fourth page

Read the next 50 products through the Shopify connector and saved
`.local/shopify-catalog-audit-page-4.json`. The four pages contain 200 distinct
products, with more pages remaining. Every product on page four returned as
many variants as its declared count; full descriptions, structured options,
galleries and per-location inventory still need the separate export/detail pass.

No additional missing or duplicate SKUs were found among the search variants
across pages one through four, accounting for the confirmed Black ornament SKU
correction. Turkey Football remains the known missing-SKU exception. All sampled
products have a featured image. Page four adds Hair Claw to the observed types
(14 products in the cumulative sample), which the pilot already recognizes.
No product or inventory mutations were performed during this page review.

## Fifth page

The next page returned 50 more products, bringing discovery to 250, all ACTIVE
in the retrieved records. Shopify still reports `hasNextPage: true`; the catalog
discovery is not complete. Saved `.local/shopify-catalog-audit-page-5.json`.
Its `complete` flag describes pagination termination only, not import readiness.

Bow Dangle Earrings reports seven variants; its detail read returned all seven
and was saved in `.local/shopify-bow-earrings-detail.json`. No additional missing
or duplicate SKU was found in the search variants, accounting for the Black
ornament correction. Complete options, weights and location inventory remain
outside these browse/detail samples. No live records changed.

## Sixth page and exact store count

The sixth search page brings discovery to 300 products; its 50 records are
ACTIVE and have SKUs in all returned variant rows. Boho Geometric Earrings
detail retrieval returned all seven variants. Saved page six and that detail
under ignored `.local` audit files.

A validated live `productsCount` query returned EXACT counts: 419 total,
419 active, zero draft and zero archived. Therefore 119 products remain after
page six; the extra results are not explained by draft/archived products.
These counts were observed during the audit and may change with catalog edits.
No live records changed in this step.
