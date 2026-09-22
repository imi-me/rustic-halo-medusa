# Product label printing handoff

Status: implemented, build-verified, and deployed to staging on September 22,
2026. The Medusa Admin page loaded the staging catalog and generated a barcode
preview without changing catalog or inventory data.

## Completed

- Adapted Market Suite's proven label engine into the shared workspace package
  `@rustic-halo/label-printing`.
- Preserved Avery 5160/5195 sheet positioning, reusable-sheet start position,
  Code 128 output, saved defaults, image-load-aware printing, Dymo sizes, 2×1
  and 3×2 rolls, custom sizes, and exact-size PDF pages for Safari/roll printers.
- Added Medusa Admin's **Product labels** page. It loads product variants,
  searches by name/SKU/barcode, queues quantities, previews a label, and prints
  sheet or roll jobs.
- Barcode selection is `barcode`, then UPC, then EAN, then SKU. Missing identity
  disables printing. Printing never changes catalog or inventory data.
- Kept AntiqueSoft `INV` prefixing opt-in. Ordinary Medusa and POS labels do not
  manufacture an AS stock identity.
- Added a saved **AntiqueSoft barcode** option to Medusa Admin. When selected,
  a printable value such as `123456789` becomes `INV123456789`; values already
  beginning with `INV` are not prefixed twice. Stored Medusa data is unchanged.
- Made the package the required label engine for the planned on-site POS.

## Verification

- Admin TypeScript validation passed.
- Full Medusa backend and Admin production build passed.
- The guarded VM 102 deployment completed and returned to the shell prompt.
- The authenticated staging Admin route `/app/product-labels` loaded 1,084
  published product variants.
- Search, add-to-print-list, quantity, Avery 5160 defaults, barcode preview, and
  print-button enablement were verified with one SKU-fallback test item. The
  final print action was not invoked.
- The deployed AntiqueSoft option transformed the test value `2918677700` into
  `INV2918677700` in both the Code 128 preview and its human-readable text. The
  test print list was cleared without opening the print dialog.
- The Redis event-queue health report recovered on the next scheduled refresh:
  zero failed, waiting, active, delayed, or paused jobs.
- No external records, catalog fields, barcodes, inventory, orders, payments,
  or printers were changed during local validation.

## Remaining

- Print one test page/PDF with the owner's actual printer and label stock; adjust
  only the physical template if the printer has a measurable offset.
- The POS application itself remains a separate task. When built, it imports the
  shared package and adds its own authenticated product-search/print-list UI.
