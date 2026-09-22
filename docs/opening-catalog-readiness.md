# Opening catalog readiness

Checked: 2026-09-22T17:05:37.831449Z

This is a read-only snapshot of products currently visible through the staging
Store API. No products, inventory, prices, publication state, Etsy listings, or
Market Suite records were changed.

## Result

- Storefront products checked: **247**
- Ready for owner selection: **247**
- Needs review before launch: **0**
- Variants checked: **868**

A product passed when it had customer-facing copy, a photo, at least one
variant, a SKU and positive USD price for every variant, and an approved
shipping rule for every SKU.

## Ready products by type

| Type | Products |
| --- | ---: |
| Dangle Earrings | 136 |
| Hair Claw | 66 |
| Stud Earrings | 21 |
| Drop Earrings | 11 |
| Uncategorized | 6 |
| Earrings | 4 |
| Dangle | 1 |
| Hair Accessories | 1 |
| Jewelry & Watches | 1 |

The 528 base-color hair-claw SKUs created during the variant rollout now use
the owner-approved 4-inch hair-claw rule: `hair-claw-box`, 1 ounce product
weight. The deployed shipping map contains 913 explicit SKU mappings. The
post-deploy background-job report was healthy with zero failed, waiting,
active, delayed, or paused jobs.

## Selection step

Choose a small opening set from these 247 eligible products. Eligibility does
not mean every product must launch. The owner selection remains a separate
commercial decision and this report did not publish or unpublish anything.

The private machine-readable evidence is stored in
`.local/opening-catalog-readiness.json`.
