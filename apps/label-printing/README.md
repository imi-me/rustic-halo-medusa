# Rustic Halo label printing

Shared browser label engine adapted from the proven Market Suite workflow. Both
Medusa Admin and the on-site POS use this package so Avery placement, barcode
rendering, Dymo/Zebra sizing, Safari behavior, and saved defaults stay aligned.

The package only renders and opens labels for printing. It does not create or
change products, barcodes, inventory, orders, payments, or external records.

AntiqueSoft's `INV` prefix helper is available only for records already governed
by that integration. Ordinary Medusa and POS labels print the selected variant's
barcode, UPC, EAN, or SKU without inventing an `INV` identifier.
