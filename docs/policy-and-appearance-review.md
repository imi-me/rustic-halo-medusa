# Gate 1 policy and appearance review

Date: September 22, 2026  
Status: approved by owner; local only

## Policy decision

The final-review customer pages now reflect the approved Rustic Halo launch
facts:

- Ebenstone Co LLC owns and operates the Rustic Halo brand.
- The launch serves United States delivery addresses only.
- Made-to-order products normally ship in 3–5 business days, with carrier
  transit time added afterward.
- Change-of-mind returns are not accepted. Damage, defects, incorrect items,
  and mistakes by Rustic Halo are resolved; other requests receive individual
  review; approval is required before a return.
- Placing an order or creating an account does not subscribe a customer to a
  newsletter.
- The contact address is `contact@rustichalo.com`.

The pages are available locally at `/privacy`, `/terms`, and
`/customer-service`. Footer links make each policy easy to find. Nothing was
published or deployed as part of this review.

## Appearance decision

The current launch appearance uses the approved filled Rustic Halo deer logo,
the green and warm-neutral palette, serif display headings, and the tagline
“Nature-inspired. Uniquely you.” The announcement bar says that products are
made to order and ship in 3–5 business days.

The existing staging browser pass covered desktop and 390 x 844 phone views for
the home page, navigation, search, store, product options, cart, account,
password reset, customer service, checkout entry, Stripe frame loading, and a
sandbox confirmation page. The current appearance is suitable for the initial
launch candidate. A broader theme redesign can remain a later, independent
milestone.

## Owner approval

The owner approved the policy pages and current storefront appearance for the
initial launch on September 22, 2026. This closes the policy and appearance
portion of Gate 1. The approval does not authorize deployment, a public launch,
live payments, DNS changes, or inventory synchronization.

## Local homepage refinement (subsequent milestone)

The homepage has a new local, brand-preserving layout: one announcement bar,
category-led navigation, split hero, four Medusa collection cards, a six-product
Medusa grid, compact value strip, personalization feature, and factual trust
content. The product grid uses a `best-sellers` Medusa collection if one is
created; until then it uses six existing product handles as an editorial
selection. It is not calculated from sales. No review quotes were invented.

The 1:1 product cards show base-color swatches only for hair claws with a real
Color option. Selection links to the matching Medusa variant and uses its
associated image when present. Staging's Seashell Hair Claw has twelve color
variants, but most currently share the same image association. Distinct
color-specific photos must be attached to those variants in Medusa before the
card can show every color accurately; the engraving/design should remain the
same across those photos.

Verified locally: the real Medusa collection/product requests, mobile menu,
swatch selection, 375px and 390px overflow checks, tablet layout, storefront
type check, focused ESLint, 16 storefront tests, and a production build against
the staging backend. The changes are local only and need an owner visual review
before any staging deployment. Files: `apps/storefront/src/app/[countryCode]/(main)/page.tsx`,
`apps/storefront/src/modules/home/components/hero/`,
`apps/storefront/src/modules/home/components/product-card/`,
`apps/storefront/src/modules/layout/`, `apps/storefront/src/lib/brand/home-collections.ts`,
and `apps/storefront/src/styles/globals.css`.

## Footer and product-sharing follow-up

The existing Instagram and Facebook footer destinations now appear as
keyboard-accessible, touch-sized buttons in the Rustic Halo palette. Product
pages offer Share this product for the device share sheet, plus a separate Copy
link action with visible feedback and a selectable-link fallback. Links use the
current storefront origin and retain the selected Medusa `v_id` only; they do
not carry unrelated URL parameters.

Verified locally on desktop and a 390px phone width: footer layout, no
horizontal overflow, a real product page, Copy link feedback, focused lint and
type checks, 16 storefront tests, and a production build against the staging
backend. Files: `apps/storefront/src/modules/layout/templates/footer/index.tsx`,
`apps/storefront/src/modules/products/components/product-share/index.tsx`,
`apps/storefront/src/modules/products/templates/index.tsx`, and
`apps/storefront/src/styles/globals.css`. This remains a local change; no
staging or production deployment was performed.
