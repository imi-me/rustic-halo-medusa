# Catalog items needing review

## Owner weight confirmation

Owner superseded size-specific claw weights: use **1 oz for every hair claw**,
including 2-inch styles; keep **0.5 oz per earring pair**. Prepared staging update
now covers 256 earring variants and all 127 claw variants (383 total). No size
clarification is needed for item weight. Packaging weight is additional.
Applied and verified by the staging script at 2026-09-21T03:51:05.830Z:
383 of 383 variants updated. The script retrieved every variant after updating
and checked the weight and confirmation metadata. Saved report:
`.local/staging-accessory-weight-update.json`.
Original Shopify weights remain in source snapshot/metadata.

Catalog weight updates are complete. The deployed checkout map now contains
383 accessory SKUs plus two previously confirmed signs (385 total), verified
by the deployment helper at 2026-09-21T13:18:57Z. All six recovered studio SKUs
were applied to staging variants and their linked inventory items. Other signs,
gifts and coasters remain unmapped until measurements are confirmed. Shipping
remains test-only. On September 21, 242 eligible imports were published to the
staging storefront after their setup and checkout checks passed; the 171
measurement-pending products and one photo-pending product remain unpublished.

Validation: backend TypeScript check passed; six focused shipping/boundary tests
and ten packing tests passed. Mixed example using actual catalog mappings:
two claws + four earring pairs = one 6 x 4 x 3 inch box, 5.6 oz total including
1.6 oz packaging. Test-only Shippo/Stripe environment restrictions are retained.
Full default Jest config could not resolve `@medusajs/utils`; focused tests used
an isolated SWC config without database setup.

Deployed-provider sandbox test prepared: `sudo sh ~/rh-test`. Uses imported
Coffee Cup 2-inch claw (37146-2, now 1 oz) and Striped Pumpkin Studs (38081,
0.5 oz per pair), with combinations 2+4, 1+6 and 3+1. Quotes through the actual
fulfillment module/Shippo test provider to the configured origin address; no
customer addresses, store cart, order, label or product publication. Also checks
unknown-product rejection. This is a provider integration check, not an
end-to-end storefront cart test. Completed 2026-09-21T04:04:35.497Z; fresh VM
report `catalog-shipping-test.json` confirms all three sandbox quotes:
2 claws + 4 pairs $5.68; 1 claw + 6 pairs $5.68; 3 claws + 1 pair $10.95.
Unknown-product rejection passed. These are test-mode quotes for the configured
origin destination, not live customer shipping prices. No orders or labels were
created, and drafts were not published.

The full catalog is imported. Existing pilot products are preserved and no
inventory counts have been synchronized. Of the 414 imports, 242 are now
staging-visible; 172 remain unpublished until their shipping measurements or
photo are confirmed.

## Before enabling checkout for new products

The shipping provider has 385 confirmed SKU mappings. The 242 eligible staging
products have verified shipping-profile and online-sales-channel assignments,
made-to-order availability, and a storefront cart-to-payment check. Imported
Shopify weights are product weights, not packed weights; add confirmed
packaging once per parcel. Do not assume a Shopify weight confirms package fit.

## Missing SKUs

| Product | Variant |
| --- | --- |
| Turkey Football Round Door Hanger | Default Title |

## Missing photo

- Coastal Catch Hair Claw

## Weight records to check

Zero weights and earrings over 2 ounces are review flags, not confirmed errors. Source units are retained below. No source or destination weight corrections were made.

| Product | Variant | SKU | Source weight |
| --- | --- | --- | --- |
| Game Day Football Dangle Earrings | Default Title | 37547 | 0.6 POUNDS |
| Flowered Hoops with Macrame Tassels | White/Purple | 37599 | 13 OUNCES |
| Flowered Hoops with Macrame Tassels | White/Beige | 37600 | 13 OUNCES |
| Happy Hearts Stud Earrings | Default Title | 37593 | 0.6 POUNDS |
| Autumn Studs | Default Title | 38067 | 0.75 POUNDS |
| Strawberry Studs | Default Title | 37578 | 0.6 POUNDS |
| Sunflower Dangle Earrings | Yellow | 37910-Y | 0 POUNDS |
| Sunflower Dangle Earrings | Yellow/Orange | 37910-O | 0.6 POUNDS |
| Red Lip Studs | Default Title | 37579 | 0.6 POUNDS |
| Snowman Dangling Earrings | Default Title | 38183 | 0.6 POUNDS |
| Rudolph Earrings Dangle Earrings | Default Title | 38092 | 0.6 POUNDS |
| Santa Hat Stud Earrings | Default Title | 38188 | 1 POUNDS |
| Holly Stud Earrings | Default Title | 38190 | 1 POUNDS |
| Manger Scene Ornaments | Shepherd | 38221-SH | 0 POUNDS |
| Manger Scene Ornaments | Nativity Scene | 38221-NS | 0 POUNDS |
| Paw Print Christmas Tree Ornament | Embossed | 38156 | 0 POUNDS |
| Paw Print Christmas Tree Ornament | Recessed | 38157 | 0 POUNDS |
| Highland Cow Christmas Ornament | Natural | 38135-N | 0 POUNDS |
| Highland Cow Christmas Ornament | Black | 38135-B | 0 POUNDS |
| Joshua 24:15 Bread Board | Default Title | 38355 | 0 POUNDS |
| Christmas Tree Nativity Earrings | Default Title | 38201 | 0.75 POUNDS |
| Highland Cow Stanley Tumbler  Lid Topper | Default Title | 38250 | 0 POUNDS |
| Daffodil Stud Earrings | Yellow | 38284-A | 0.75 POUNDS |
| Medical Stud Earrings | Ambulance | 38305-A | 0 POUNDS |
| Medical Stud Earrings | Stethascope | 38305-S | 0 POUNDS |
| Medical Stud Earrings | RX | 38305-RX | 0 POUNDS |
| Petal Patch Hair Claw | 4” | 38547-4 | 0 OUNCES |

## Packaging still needed

- Coasters: outside package dimensions, empty packaging weight, capacity, and mixed-order fit. All 25 are imported with packaging pending.
- Gifts and home decor: package dimensions, empty packaging weight, item weights and capacity by product family.
- Signs: confirm which variants fit the existing 14-inch sign box; do not apply it to other sizes.
- Accessories: item weights are confirmed for all imported claws and earrings; existing packaging limits apply.

## Already confirmed packaging

- Hair claws: 6 × 4 × 3 inches, 1.6 ounces empty. Up to 3 claws; mixed limits 2 claws + 4 earring pairs or 1 claw + 6 pairs; up to 8 pairs alone.
- Earrings: 6 × 4 × 1.5 inches, 1.3 ounces empty, up to 4 pairs.
- 14-inch signs: 14 × 14 × 2 inches, 7 ounces empty, one sign.

Current owner-confirmed item-only weights: all hair claws 1 ounce; earring pair 0.5 ounce; the two confirmed pilot signs 40 ounces. Add packaging separately.

## Next staging audit

> **Current status (September 21):** The audit, made-to-order setup, two-product
> checkout, full staging publication, cart-label cleanup, and catalog pagination
> check are complete. The historical entries below record that work as it was
> performed; the status above is the current operating state.

`sudo sh ~/rh-check` generates a read-only catalog readiness report covering
shipping profiles, sales channels, variant inventory flags, inventory links,
and stock-location channel assignments. Prepared and syntax-checked locally;
execution currently requires the owner to enter the VM administrator password.
No product publication or inventory changes are performed by this audit.

### Verified staging audit — 2026-09-21T13:32:16.041Z

- 414 imported draft products; 242 have confirmed shipping mappings and CDN photos.
- 171 need shipping measurements; one additional accessory needs its photo.
- All 414 lack shipping-profile and sales-channel links. All 573 variants have
  inventory management enabled, backorders disabled, and one linked inventory item.
- Copper Mill has no sales channels or fulfillment sets attached. The online
  snapshot location is linked to Local Development and its shipping fulfillment set.
- An unrelated European Warehouse / Default Sales Channel also exists: preserve it
  and do not use it for Rustic Halo setup.

Next setup should target only the 242 eligible drafts, preserve draft status,
use the existing Rustic Halo online channel and shipping profile, and keep
inventory management enabled. Before enabling backorders, inspect inventory
levels and ensure fulfillment is scoped to the online location. Never attach
Copper Mill to the online channel or change its quantities. Eligibility here is
limited to photos and shipping mappings, not full publication approval.

Prepared `deploy/staging/prepare-online-drafts.cjs` with a guarded staging-only
setup for exactly 242 eligible drafts. It preflights channel isolation, existing
shipping profile/provider, inventory links and inventory levels before writes;
links only the existing online channel/profile, creates missing online levels at
zero, and enables backorders while retaining inventory management and draft
status. Existing quantities are preserved and checked afterward. Conflicting
channels, profiles or inventory locations stop the operation. Partial progress
is recorded for review; the script is rerunnable with matching configuration.
Three selection/guard tests pass. Uploaded as `sudo sh ~/rh-online`; administrator
password is required, so it has not yet been applied or verified on the VM.

Verified setup completion: 2026-09-21T13:39:56.157Z. The VM report confirms
242 planned, 242 updated, and 242 unique product IDs with complete=true.
The helper read back each product to verify draft status, the selected online
channel and shipping profile, and inventory management/backorder flags. It also
verified each inventory item has only the online location and unchanged stocked
and reserved quantities (or zero for newly created levels). Copper Mill was not
linked to online sales and no Copper Mill quantities were written.

This is configuration verification, not an end-to-end storefront checkout test.
Products remain unpublished. Next: review a small representative set of imported
products and then test their storefront availability and checkout on staging.

Two-product storefront preview prepared: Striped Pumpkin Studs (38081) and
Coffee Cup claw (37146-2). `sudo sh ~/rh-preview` publishes only those two products
on staging after checking the completed setup report, test credentials, shipping
profile, online channel, photos, all variant mappings and made-to-order flags.
The other 240 configured products remain drafts. The helper records original
statuses and verified resulting handles in `two-product-preview.json`. It has
been uploaded and syntax-checked, but execution is awaiting the VM password.
No new storefront/cart checkout verification has yet occurred.

## Two-product storefront check — September 21

Preview report completed 2026-09-21T13:43:30.794Z: only Striped Pumpkin Studs
and Coffee Cup Hair Claw changed from draft to published on staging. Browser
verification loaded both pages with prices and made-to-order messaging, selected
the 2-inch claw, and added one of each to an initially empty cart ($16 subtotal).
Checkout accepted the test address at the configured business origin, offered
USPS Ground Advantage TEST at $5.27, and displayed $1.49 tax / $22.76 total after
selection. It advanced to payment and Stripe test card number, expiry and CVC
fields loaded. No card details entered, order placed, label bought or email sent.
Stripe developer notice was a recommendation to migrate its older Elements API,
not a payment failure. This verifies cart-to-payment, not payment completion.

Found Shopify's placeholder `Default Title` displayed in the earrings cart line.
Local `line-item-options` now omits blank/default titles while retaining real
options such as 2-inch. Storefront TypeScript check passes; this cosmetic change
has not yet been deployed. Browser test checkout remains available for follow-up.

Label fix deployment helper uploaded as `sudo sh ~/rh-label`. It preserves the
previous source and image, rebuilds only the storefront using the preview compose
configuration, waits for health, checks both sample pages and cart respond 200,
and writes `variant-label-status.txt`. VM password is required; deployment has
not yet run. After completion verify the existing mixed cart hides Default Title
but retains the claw's 2-inch variant. No catalog statuses or stocks are changed.

Label deployment verified September 21: the build log confirms storefront image
creation, container replacement and healthy startup. The original final HTTP
probe encountered a connection reset during restart, so its status marker was
not written. A fresh browser cart showed no Default Title for the earrings and
retained the 2-inch claw option. Fresh VM HTTP checks at
2026-09-21T13:55:36.010866+00:00 returned 200 for both sample product pages and
/us/cart. This establishes successful deployment despite the missing marker.
The helper now retries transient startup probe failures and releases ownership
of its private deployment log for diagnosis. No further rebuild is necessary.
The remaining 240 prepared products are still drafts, pending staging expansion.

Owner approved staging expansion after the two-product check. Prepared
`publish-prepared-preview.cjs/.sh` and uploaded shortcut `sudo sh ~/rh-catalog`.
It preflights the exact 242 IDs in the completed online setup report, sandbox
credentials, shipping mappings, photos, inventory flags and isolated online
location/channel before changing any status. Already published samples remain
published; the other 240 become staging-visible. Original statuses and each
read-back are recorded in catalog-preview-publication.json. No inventory writes
or changes to live Shopify. Syntax checks passed. Execution awaits VM password;
full-catalog staging visibility is not yet verified.

Catalog staging publication verified complete at 2026-09-21T13:59:59.302Z:
242 unique products published, including 240 previously draft products. Browser
shop page rendered new product cards but exposed a first-100-products limit in
listProductsWithSort (only nine pages). Local fix now fetches matching products
in 100-item batches before global sorting/pagination, preserving option filters
and rejecting incomplete/duplicate results. TypeScript passed. Uploaded deployment
helper `sudo sh ~/rh-pages`; not deployed yet. Verify pages beyond nine after
execution. The remaining unmapped/photo-pending products remain unpublished.

Pagination deployed at 2026-09-21T14:04:57Z. Fresh browser verification shows
21 pages instead of nine. Page 21 renders seven products, including the existing
pilot products, consistent with 242 newly enabled plus five pilot products (247
visible total at 12 per page). New arrivals appear on page one; the last-page
navigation and product cards work. This verifies the browsing limit is resolved.
