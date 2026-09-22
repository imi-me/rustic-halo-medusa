# Staging browser pass

Checked September 22, 2026 against `https://staging.rustichalo.com` through the
owner-protected Cloudflare Access session. No payment was submitted, no order
was created, and no cart item, inventory record, customer, Etsy listing, or
Market Suite record was changed.

## Passed

- Desktop homepage loaded with the Rustic Halo logo, hero, collection links,
  featured products, story sections, and footer.
- Phone viewport at 390 x 844 showed the compact header and an operable menu
  with Home, Shop all, Collections, Our story, Account, and Cart.
- Search returned the complete streamed result grid; `Floral` returned 23
  products and pagination.
- Store pagination remained available through page 21.
- The Seashell Hair Claw page loaded its two images, customer copy, price,
  related products, and 12 color choices on desktop and phone.
- Cart displayed the existing two sandbox items, quantities, variant label,
  tax, shipping, total, and checkout link without exposing the imported
  `Default Title` placeholder.
- Account login, password-reset request, and customer-service pages rendered
  with usable controls and the approved support/returns copy.
- Existing checkout state rendered shipping address, selected USPS Ground
  Advantage test rate, totals, and the Stripe secure payment frame on phone and
  desktop. No card data was entered and Continue to review stayed disabled.
- Existing sandbox order 14 confirmation rendered its summary, address,
  shipping method, payment summary, and support links.

## Fixed during the pass

Imported multi-variant products displayed a customer-facing `Title` selector
whose only value was `Default Title`; Add to Cart remained disabled until that
placeholder was selected. The storefront now preselects this value internally,
hides only that exact placeholder option, and retains real Color, Size, and
design choices. On the deployed Seashell Hair Claw page, only Color is visible
and selecting a color enables Add to Cart.

The guarded storefront deployment completed at
`2026-09-22T17:27:37Z`. The Docker build succeeded and the storefront container
reported healthy. Local TypeScript checking and 16 focused storefront tests
passed. The most recent sanitized background-job report remained healthy with
zero failed, waiting, active, delayed, or paused jobs.

## Remaining browser evidence

Authenticated customer order history was not freshly tested because this pass
did not use or create a test-customer login. The login screen and existing
guest confirmation page passed. Final owner review of the opening assortment,
policies, and visual appearance remains separate.
