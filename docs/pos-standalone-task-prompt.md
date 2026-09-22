# Standalone task prompt — Rustic Halo mobile on-site POS

Work in the existing Rustic Halo Medusa project at
`/Users/shawnhouse/Documents/Codex/rustic-halo-medusa`. Design and build the
first bounded milestone for a native or cross-platform mobile sales app used by
Rustic Halo at markets. Do not implement it as a browser-only POS. Read
`AGENTS.md`, `docs/architecture.md`, `apps/kiosk/README.md`,
`docs/production-launch-plan.md`, and the Market Suite integration documents
before changing code.

Start by auditing the existing kiosk/POS-related code and documenting the
current data boundaries. Recommend a mobile stack and supported device target
before scaffolding; React Native with Expo is the default candidate unless a
device, printer SDK, or card-reader SDK requires a different choice. Then create
a reviewable, non-production mobile prototype for the recommended POS workflow.
It should support fast product search and
barcode/SKU lookup, a touch-friendly cart, quantity changes, discounts with an
audit trail, tax and total display, and clear cash/card/offline states. Reuse the
Medusa catalog and identities rather than creating a second catalog. Preserve
the rules and templates in `@rustic-halo/label-printing` for barcode and price
labels. First verify whether the selected mobile runtime and printer can use its
browser renderer directly; otherwise add a mobile print adapter around the same
label data, `INV` option, sizes, and Code 128 rules rather than creating a second
set of business rules. Choose the mobile printer path only after the device and
printer SDK are known.

Treat payments, inventory changes, receipts, refunds, and customer data as
separate consequential capabilities. Do not enable live payments, Stripe
Terminal, customer email, inventory writes, Market Suite synchronization,
AntiqueSoft writes, or production deployment in the first milestone. AntiqueSoft
does not provide customer information, and an AS inventory reduction is not
proof of a paid order. Copper Mill inventory must remain separate from online
made-to-order availability.

The first milestone should deliver:

1. A concise requirements and architecture note covering device choice,
   connectivity loss, authentication, payment options, receipt handling,
   inventory ownership, and recovery after an interrupted sale.
2. A touch-friendly mobile prototype using staging or fixtures, with no
   external writes or real transactions.
3. A clear decision list for the owner, especially supported devices, card
   reader/provider, cash handling, receipt method, offline expectations, and
   whether the tool is only for Rustic Halo or may later support other vendors.
4. Focused tests for cart totals, duplicate scans, discounts, interruption and
   retry behavior.
5. A short handoff that states what is verified, what remains mocked, and the
   next separately approved milestone.

Preserve all existing storefront, Medusa, Market Suite, Etsy, and staging work.
Do not create or update real orders, payments, inventory, customers, or external
accounts while producing the prototype.
