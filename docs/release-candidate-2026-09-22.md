# Rustic Halo staging release candidate — September 22, 2026

Branch: `codex/rebuild-rustic-halo-commerce`

This checkpoint freezes the accumulated staging application, integration,
deployment, and operating documentation as a reviewable local release
candidate. It does not authorize a production deployment, DNS change, live
provider credential, real transaction, customer email, Etsy catalog write, or
Market Suite inventory synchronization.

## Included scope

- Medusa backend and admin extensions for test payments and tax reporting,
  transactional-email preparation, Etsy review tools, protected Market Suite
  reads, background-job operations, and product-label printing.
- Next.js storefront branding, catalog/search/navigation, product-option,
  cart, account, password-reset, customer-service, checkout, and order views.
- Staging compose/deployment, recovery, catalog, media, shipping, and guarded
  integration scripts.
- Read-only Etsy and Market Suite comparison tools and their tests.
- Launch, restore, security-boundary, catalog, shipping, and operating
  documentation.

## Release checks

- 137 Medusa backend unit tests passed in 21 suites.
- 16 storefront checkout, password-reset, and tax-guard tests passed.
- 24 Market Suite identity, inventory, comparison, and import-plan tests
  passed with write authorization absent.
- 4 Etsy hair-claw catalog planning tests passed.
- 14 staging catalog/background-job tests passed.
- 18 Python shipping, publishing-review, and restricted-operations tests
  passed.
- Backend and storefront TypeScript checks passed.
- `git diff --check` passed.

Total focused automated checks: 213 passed, 0 failed.

The backend pass found and corrected an inventory-response edge case. Invalid
Copper Mill quantity data now returns one HTTP 422 review response and cannot
be embedded into a partial success payload. The associated endpoint tests pass.

## Repository hygiene

The candidate excludes environment files, credentials, databases, local
reports, dependency directories, package caches, generated TypeScript build
state, and VM/runtime data. The ignore rules explicitly cover `.pnpm-store/`
and `*.tsbuildinfo`.

An automated scan examined 354 changed or new text files. Nine potential
credential matches were reviewed; each was an intentionally synthetic unit-test
fixture or offline-test placeholder. Four binary brand assets were skipped by
the text scanner. No live credential is included in the candidate.

## Deployed staging evidence

- The explicit 4-inch hair-claw shipping update completed at
  `2026-09-22T17:00:47Z`; the map contains 913 SKU entries.
- The opening-catalog audit reports 247 storefront products and 868 variants,
  with all 247 products passing the required launch-field checks.
- The product-option UI deployment completed at `2026-09-22T17:27:37Z` and
  removed the customer-facing `Default Title` placeholder while preserving
  real Color, Size, and design choices.
- Desktop and 390 x 844 phone guest browser checks passed. No payment or order
  was submitted during that pass.
- The latest recorded queue check after the catalog update showed zero failed,
  waiting, active, delayed, or paused jobs.

The Copper Mill invalid-quantity response correction is included in this local
candidate and has passed its unit suite. It has not been deployed to staging;
the current protected endpoints remain read-only and inventory syncing remains
disabled.

## Required owner decisions

Gate 1 remains open for decisions rather than technical cleanup:

1. Select the smaller opening assortment from the fully checked catalog.
2. Approve the privacy, terms, returns, shipping, and contact copy.
3. Approve the visual appearance for launch.
4. Decide whether production waits for stable fiber or starts on a small cloud
   VM. Production must remain separate from staging VM 102.

Authenticated customer order history also remains a final acceptance check; the
guest login and existing confirmation views passed without creating a customer
or order.

The owner approved the proposed 24 products and 102 variants: 19 evergreen
products and five fall/Halloween products. The exact handle and SKU set is
frozen in `deploy/production/opening-catalog.json`. Its safety flags keep
production publication, inventory synchronization and Etsy writes unauthorized.
See `docs/opening-catalog-proposal.md`.

## Evidence files

- `docs/opening-catalog-readiness.md`
- `docs/opening-catalog-proposal.md`
- `docs/opening-catalog-proposal.csv`
- `docs/opening-catalog-candidates.csv`
- `docs/staging-browser-pass.md`
- `docs/production-launch-plan.md`
- `docs/launch-readiness.md`
- `docs/payments-and-shipping.md`
- `.local/opening-catalog-readiness.json` (private, excluded from Git)
