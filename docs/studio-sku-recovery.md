# Studio SKU recovery

## Approved and applied in Shopify

Owner approved six codes: 38511-CBC4, 38540-CBC4, 38704-RF, 38704-BR,
38704-WF and 38709. Fresh Shopify read verified targets were blank and there
were no matching existing SKUs. Four productVariantsBulkUpdate operations
completed without userErrors; a subsequent fresh read verified all six codes
and unchanged existing barcodes. Staging synchronization is prepared, not yet
executed: `sudo sh ~/rh-skus` updates variant and linked inventory-item SKU
without changing stock quantities. Check studio-sku-update.json afterward.
The five newly coded accessories still need addition to the checkout SKU map.

Owner will provide Turkey Football's original SKU at finish-up. Reminder is
pending, not delivered: added to the existing thread heartbeat without changing
job-health monitoring. Mention it once when final cleanup/publication begins.

Historical investigation follows; earlier no-change statements predate approval.

Read-only search of `/Volumes/NAS/Assets` on September 21, 2026. No NAS files,
Shopify records, Medusa records or barcodes were changed. Earlier `RH-<barcode>`
SKU proposals are superseded: the owner wants studio design SKUs, and only
missing barcodes may be generated uniquely.

| Product | Recovered base | Evidence / remaining check |
| --- | --- | --- |
| Merry and Bright Hair Claw | 38540 | `Hair Claws/HC38540-4.lbrn2` preview visibly says Merry and Bright; both 2-inch and 4-inch make files exist. Shopify default variant does not establish which size suffix to use. |
| Wildflower Hearts Dangle Earrings | 38704 | `Earrings/EA38704.lbrn2` preview shows floral heart dangles; original folder `Z-Originals/38704` contains HeartShapedFolkArtWildFlowerEarring.svg. Three color suffixes still need studio convention confirmation. |
| Christian Faith Hair Claw, Colors by Cate 4-inch | 38511 | Existing Shopify sibling variants already use 38511-4 and 38511-2. `Z-Originals/38511/FaithHairClip.svg` and `38511.lbrn2` establish studio base. Painted suffix not independently recovered. |
| You Are Loved Faith Shelf Sitter | 38709 | `Door Hangers/DH38709.lbrn2` and `Z-Originals/38709/YouAreBibleVerse/YouAreBibleVerse.png`; original design visually matches Shopify product photo, including wording and verse ring. |
| Turkey Football Round Door Hanger | unresolved | Shopify photo is turkey holding football on football-field background. `DH38127` is turkey/hi base design only, not enough to establish football variation SKU. No exact match found among 116 main door-hanger previews. |

Local evidence: `.local/nas-assets-file-index.txt` and `.local/nas-sku-review/`.
Embedded LightBurn thumbnails were extracted for inspection only. No cutting or
engraving paths were edited. All seven missing-SKU variants already have barcodes.
Do not infer SKU suffixes from barcode numbers or overwrite existing barcodes.

Further review: Merry and Bright Shopify description explicitly says 4-inch,
Color by Cate. Proposed studio-based SKUs: 38540-CBC4, 38511-CBC4,
38704-RF (Red Floral), 38704-BR (Brown), 38704-WF (White Floral), and 38709.
No collisions in the saved catalog. CBC4/RF/BR/WF are proposed descriptive
suffixes, not suffixes recovered from the manufacturing filenames. Six proposals
saved in `.local/studio-sku-proposals.json`; no Shopify or staging writes yet.
Turkey Football remains unresolved and must not be assigned the plain turkey/hi
design number based on resemblance alone.

## Approved corrections and staging follow-up — September 21

The owner approved the six proposed SKUs above. Shopify updates were applied
and read back successfully; existing barcodes were preserved. The historical
Shopify export remains unchanged. `scripts/studio-sku-overrides.json` supplies
the approved variant-specific corrections when generating shipping mappings.

The current staging check found no `studio-sku-update.json` report, and
non-interactive administrator access requires a password. Staging application
therefore remains unverified. Five accessory corrections are prepared locally:
385 total shipping mappings, zero accessories missing a mapping. Seven focused
tests pass, including rejection of the unmeasured shelf sitter (38709).
Run the prepared `sudo sh ~/rh-finish-skus` command in the VM terminal to apply
the six SKU corrections and deploy the updated shipping map; then inspect both
reports before marking deployment complete. Coaster packaging and the Turkey
Football SKU remain unresolved.

Staging follow-up: the update report now confirms all six variant and linked
inventory SKUs were applied and verified at 2026-09-21T13:17:09.752Z.
The subsequent shipping backend build was observed running; its previous
03:59 completion marker does not verify this new deployment.

Shipping deployment completed at 2026-09-21T13:18:57Z after its running-container
check verified 385 mappings and the 1 oz claw weight. The backend health endpoint
returned HTTP 200 afterward. This confirms deployment, not a new checkout or
publication of the imported drafts.
