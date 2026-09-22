# Payment and shipping setup

## Confirmed business rules

- Existing Stripe account; reuse it in test mode first.
- Online products are made to order and ship in 3–5 business days. This is dispatch time, not carrier transit time.
- Shipping origin ZIP: 27837, supplied by the owner.
- Packed weights, package dimensions, and full ship-from address are still needed before accurate live carrier rates.
- Update: owner supplied the origin address, saved privately in ignored `.local/shippo.env`, and three empty-package weights/dimensions, recorded in `apps/backend/src/scripts/data/shipping-packages.json`. Product weights and mixed-order packing rules remain pending. The Shippo token field is prepared; no Shippo rate integration is active yet.
- Shippo test token saved and authenticated successfully against the carrier-account endpoint. Active carriers returned include USPS and UPS. Credentials remain in ignored `.local/shippo.env`; no labels were purchased. Authentication is verified, but checkout still uses the labeled test shipping placeholder until product weights and packing logic are connected to rate requests.
- Shippo was recommended; no Shippo account or paid service has been activated.

## Stripe sandbox preparation

The installed Medusa Stripe provider is configured conditionally in `apps/backend/medusa-config.ts`. It remains disabled without credentials. This configuration only accepts `sk_test_` secret keys; it rejects live secret keys. It captures successful test payments immediately, appropriate for the proposed pay-then-make workflow. No live charges have been attempted.

Enter credentials directly into ignored local environment files, not chat or committed files:

- `apps/backend/.env`: `STRIPE_API_KEY` (test secret key), `STRIPE_WEBHOOK_SECRET` (test webhook signing secret), then `STRIPE_TEST_ENABLED=true`.
- `apps/storefront/.env.local`: `NEXT_PUBLIC_STRIPE_KEY` (matching account's `pk_test_` publishable key).

Local webhook forwarding is required because Stripe cannot reach a loopback server. Once Stripe CLI is installed and authenticated to the intended sandbox, forward its events to `http://127.0.0.1:9000/hooks/payment/stripe_stripe` and use the signing secret returned by that listener. Do not substitute an unrelated endpoint's signing secret.

Restart backend and storefront after changing environment variables. Then run:

```sh
bash scripts/dev-local.sh pnpm --dir apps/backend exec medusa exec ./src/scripts/setup-stripe-test.ts
```

The script requires the isolated local database and expected local region; it checks Stripe's provider is enabled and replaces manual payment for that region with Stripe. It was successfully executed on September 19, 2026.

## Local connection verified September 19, 2026

Both test keys are saved in ignored environment files. Stripe accepted the secret key, and the publishable key successfully retrieved a test payment intent created through Medusa, confirming they match. Stripe is enabled for the isolated US test region. No live payments are enabled.

The official `@stripe/cli` package is installed under `.local/stripe-cli`. Start local forwarding with `python3 scripts/stripe-listen-local.py`. This helper uses the saved test key, rejects live keys, forwards payment-intent events from this account only, and saves the listener signing secret privately without printing it. Leave it running during payment tests; restart the backend if the signing secret changes. No dashboard webhook endpoint was created.

The unused test intent was canceled without a charge or order. Stripe forwarded `payment_intent.canceled` to the local Medusa webhook and received HTTP 200. This verifies delivery and acceptance, not successful order completion. A test cart remains from this verification. Full success, decline, authentication, duplicate-order checks, and shipping remain pending.

Before calling checkout ready, verify payment success, decline, authentication, webhook completion, and no duplicate orders. Shipping options must also be configured. No end-to-end Stripe test order has been placed yet.

## Checkout verification — September 19, 2026

### Package calculation preparation

Owner confirmed item-only weights: 4-inch claw 1 oz, 2-inch claw 0.6 oz, earrings 0.5 oz per pair, 14-inch sign 40 oz. Saved in `shipping-item-weights.json`. Earring box capacity was corrected to four pairs. Packaging is added once per box. Mixed hair-claw/earring orders are packed together by the owner; capacity rules are still pending, so do not assume separate boxes or issue a mixed-order quote yet.

Shippo sandbox rate checks returned USPS and UPS services for all four single-item cases (packed weights 2.6, 2.2, 1.8, and 47 oz). Direct multi-parcel requests returned no rates in this account, so the preview now requests each box separately and totals only carrier/service/currency combinations available for every box. The two-box four-claw check returned combined rates, with totals verified against the individual box rates. No labels were purchased. These are sandbox quotes, not validated live postage. Checkout remains on its labeled test placeholder pending catalog mapping and mixed packing rules.

`scripts/shipping_parcels.py` adds verified per-item weights to the owner-supplied packaging weight once per box and splits same-category quantities at box capacity. It rejects missing/nonpositive weights, unknown packages, and mixed categories. Six unit tests cover weight arithmetic, capacity boundaries, multiple boxes, and invalid input; synthetic test weights are not product measurements. The sign package must only be selected for confirmed 14-inch signs. Earring quantities count sellable pairs.

`scripts/shippo-test-rates.py` is a test-token-only preview command taking item JSON and destination-address JSON. It requests USPS/UPS rates without any label-purchase endpoint. It is not wired into Medusa checkout. Actual rate requests remain pending verified product weights. Shopify's product connector and public product responses did not expose weights for the pilot variants; this does not establish that Shopify Admin weights are absent. Ask the owner for the stored weights or a product export containing them. Mixed orders and other product classes remain unconfigured.

Run packing checks with `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s scripts -p test_shipping_parcels.py`. Preview input items have `package_id`, integer `quantity`, and verified `weight_oz`; keep destination JSON in ignored `.local/`. Run `python3 scripts/shippo-test-rates.py ITEMS_JSON DESTINATION_JSON` once weights are available. Live-rate and multi-parcel carrier coverage still need verification.

Superseding the pending checks above: `setup-test-shipping.ts` creates a $0 option named `TEST ONLY — Shipping placeholder` in the isolated local database. It links only the imported online location and pilot products, restricts delivery to the US, requires Stripe test credentials, and preserves existing shipping profiles. A rerun completed without duplicates. This is not a real rate or a free-shipping policy; no carrier account, label, or live storefront was changed.

API checks passed for successful test payment and order creation, repeated completion returning the same order, decline rejection, and rejection of an order while authentication is required. Authentication challenge completion itself remains untested.

The browser test also completed successfully: order #5 (`order_01M2XNHQSW9HQD9CBTGRZGGMRJ`), one $12 Top Down Hair Claw, test shipping $0, Stripe sandbox card, dummy address and `checkout-test@example.com`. Confirmation showed payment and the cart cleared. Test orders and stock reservations remain local. The Stripe form initially loaded slowly, then rendered and completed without a code change; investigate loading performance before launch.

Confirmation copy no longer claims an email was sent before delivery is configured. Help links use the business email instead of the missing contact page. Starter legal acceptance text referring to Medusa and nonexistent policies was replaced with order review and the confirmed dispatch policy. Approved terms, privacy and returns pages, email delivery, real postage, taxes, and live payment configuration remain launch work.

Owner correction: hair-claw box exterior dimensions are 6 × 4 × 3 inches, with 1.6 oz empty packaging weight. Earlier hair-claw rate previews used 1.5-inch height and must be refreshed before use. Earring-only box dimensions remain 6 × 4 × 1.5 inches.

### Live box comparison

### Standard accessory packing update

### Medusa checkout integration

The local Stripe-test configuration now registers a `shippo-test_shippo` fulfillment provider. `setup-shippo-shipping.ts` adds a calculated `USPS Ground Advantage — TEST` option and hides the old $0 placeholder using its store-enabled rule. The provider reads only `.local/shippo.env` test credentials, requires the isolated loopback database, invokes the same Python packing calculator, requests each box separately, and sums USPS Ground Advantage rates in USD. It cannot purchase labels or create fulfillments. This implementation intentionally depends on the local Python runtime and `.local` settings and is not production deployment configuration.

Verified checkout APIs calculate a $6.34 sandbox quote for two full-size claws and four earring pairs, accept the shipping selection, and update the cart total to $90.34. Backend and storefront type checks passed. Shipping-option listing no longer uses persistent storefront caching. Unknown SKUs fail closed; Goat Hi is not mapped because its catalog description does not confirm a 14-inch size. Confirm its dimensions before adding a rule. Known claw and earring SKUs and the explicitly 14-inch Welcome Succas sign are mapped. Quote errors do not substitute free shipping. Existing saved carts with earlier placeholder selections should reselect shipping during testing.

Following the owner's instruction to proceed, the packing preview now uses the 6 × 4 × 3 inch, 1.6 oz box for all hair-claw and earring orders. The old short earring box is retained as reference only. Confirmed capacities are 3 claws alone, 2 claws with 4 earring pairs, 1 claw with 6 pairs, or 8 pairs alone. Smaller combinations fit; 3 claws plus earrings is not assumed to fit. The calculator minimizes box count within these limits, adds packaging per box, and keeps every 14-inch sign in its own box. This optimizes box count, not guaranteed lowest postage. Nine tests pass, including mixed capacities and quantity conservation across many combinations. A Shippo sandbox quote for 2 full-size claws plus 4 pairs succeeded at 5.6 oz in one standard box. Checkout is not yet using these calculated rates; the test placeholder remains active.

The owner saved a separate live token in ignored `.local/shippo-live.env`, authorized for quote comparisons only. `scripts/compare-shipping-boxes.py` uses only carrier-account lookup and shipment quote creation; it has no label-purchase operation. Live checkout remains disabled.

Live quotes to the sample San Francisco destination ZIP 94117 returned USPS Ground Advantage at $6.07 for all four comparisons: one earring pair in the short box (1.8 oz), one in the tall box (2.1 oz), four pairs in the short box (3.3 oz), and four in the tall box (3.6 oz). USPS Priority Mail was $13.48 and Express $47.63 across all four. No UPS rates were returned; its availability is not verified. This supports the taller box for these examples only, not a universal price guarantee. No labels were purchased. Detailed comparison results remain in `.local/shipping-tests/live-box-comparison.json`. Standardizing on one box still needs the owner's decision; existing package rules were preserved.

Owner confirmed Goat Hi is also a 14-inch sign. SKU 38409 now uses the 40 oz item + 7 oz box rule (14 × 14 × 2 inches). Checkout sandbox verification returned $11.30 shipping and a $59.30 cart total for one sign to the sample destination. No label or order was purchased. This supersedes the earlier unmapped-Goat-Hi note.

### Paid shipping regression check

Browser shipping check also passed: a new cart with a 4-inch claw showed USPS Ground Advantage — TEST at $6.07; selecting it updated the displayed checkout total to $18.07. Changing cart quantity to four showed $12.41 shipping and $60.41 total. Restoring quantity to one returned checkout to $6.07 shipping and $18.07 total. Browser error logs were empty. The tab was left at the payment step with synthetic customer/address data; no additional order or payment was submitted during this UI check.

The checkout API was exercised with a 4-inch claw and selected calculated shipping. Changing quantity from 1 to 4 automatically changed shipping from $6.07 to $12.41 (two boxes); changing back to 1 restored $6.07. Stripe sandbox charged 1807 cents for the $12 product plus $6.07 shipping. Local order #6 (`order_01M2XS9HCW4Y9SRZ3CM6Z05AC1`) preserved these totals, and a repeated cart-completion request returned the same order. The dummy customer is `checkout-test@example.com`; no real charge or label purchase occurred. Results are in ignored `.local/shipping-tests/paid-shipping-checkout.json`. This verifies API completion with calculated shipping; full browser checkout after the new shipping integration remains a separate UI check.


## Order confirmation email draft

The provider-independent template lives in `apps/backend/src/lib/email/order-confirmation.ts`. It includes order items, totals, delivery address, shipping method, and the owner-approved “Ships in 3–5 business days” dispatch policy. Carrier transit time is additional.

Generate a local HTML and plain-text preview without database access or email delivery:

```sh
bash scripts/dev-local.sh pnpm --dir apps/backend exec ts-node --transpile-only -e "require('./src/scripts/preview-order-email').default()"
```

Outputs are `.local/order-email-preview.html` and `.local/order-email-preview.txt`. The preview checks totals and HTML escaping. No notification subscriber or sending provider is connected yet, and no email has been sent.

Next: select the sending service (Resend is the proposed option), verify a sending domain, configure a private server-side API key and sender address, then connect order notifications and test delivery to an owner-approved address. Keep replies directed to contact@rustichalo.com. Do not enable real customer email delivery until the test has been reviewed.


## Resend integration prepared

`send.rustichalo.com` and API access were verified on September 19. The `order.placed` subscriber now maps an order into the confirmation template and calls the Medusa notification module. The Resend provider sends HTML and plain text, with replies to contact@rustichalo.com. Medusa stores notification status and an order-specific idempotency key; the same key is passed to Resend for protection against concurrent retries. Resend idempotency retention is limited, so retain Medusa notification records.

Delivery defaults to disabled. Development reads the ignored `.local/resend.env`; production requires server environment variables. No customer email has been sent. Offline checks cover disabled delivery, order mapping, totals, escaping, stable idempotency keys, and API failures. Backend typecheck passed and the development server loaded the integration.

An owner-approved one-off test can use `src/scripts/send-order-email-test.ts` with EMAIL_TEST_APPROVED=true, EMAIL_TEST_RECIPIENT set to the approved inbox, and a fixed EMAIL_TEST_ID (reuse it if a response is uncertain). This enables only the test process; it does not switch on customer delivery. Review inbox rendering and delivery before enabling EMAIL_DELIVERY_ENABLED for the server.


## Email logo at launch

The owner approved the separate deer-circle and Rustic Halo wordmark. The transparent PNG is at `apps/storefront/public/brand/rustic-halo-email-logo.png`. After publishing, verify its public HTTPS URL and set EMAIL_LOGO_URL in the backend environment. The email template then displays it at 258 × 44 on a light background with Rustic Halo alt text. An empty or invalid URL retains the olive text header. The public image URL is intentionally unset until hosting is available.

The owner received and approved the text-header sample email. Automatic order email delivery remains off pending activation; adding the logo does not enable it.


## Remaining customer policy work

Customer service now has a working route and footer/order-help links. Removed starter registration copy naming Medusa Store and linking to missing policy routes, and removed the account claim that shoppers can create returns/exchanges. Product help now uses contact@rustichalo.com consistently. This cleanup does not replace the need for approved privacy, terms, and returns policies before launch. Owner return terms have been requested and are pending.


## Owner-approved return approach

The owner rejected returns solely because a customer no longer wants an item. Customer service now explains that exclusion (including personalized items), covers damaged/defective/incorrect orders and personalization errors made by the shop, invites other concerns for individual review without guaranteeing approval, and requires contact before returning an item. The shop covers resolving damage, defects, and its own mistakes; any other approved return-shipping costs are explained individually. No 14-day discretionary return window was adopted. Product Shipping & Returns links to these guidelines.


## Business identity and launch shipping scope

Owner confirmed Rustic Halo is a brand owned by Ebenstone Co LLC. Launch shipping is United States only. Policy drafts and customer-service copy reflect this. The current Shippo test provider rejects non-US destinations and the shipping setup script defines a US-only service zone; live shipping remains a separate launch task.


## Initial communication scope

Owner agreed to defer newsletters and advertising tracking. Initial launch scope is checkout, customer accounts, and transactional order emails. Keep any future marketing opt-in separate from ordering/account creation and update disclosures when marketing tools are introduced. Hosting has not yet been selected in the project configuration.

## Staging catalog shipping coverage — September 20, 2026

Fresh read-only Store API audit returned 5 published/available products with 6
variants; every variant SKU matches an explicit shipping weight/package rule.
Zero unmapped variants were returned. This checks the current Store API catalog,
not drafts, other sales channels, or future products. Local provider source SHA256
matched staging build source. The provider rejects unmapped SKUs before requesting
rates; no default parcel or weight is guessed. No carts, quotes, orders, or labels
were created during this audit. Private detailed report:
`.local/staging-deploy/shipping-catalog-audit.json`.

Coaster measurements remain outstanding and must be supplied before adding a
coaster shipping rule. Live-provider readiness and representative live-rate checks
remain separate launch requirements.

## Current storefront shipping coverage — September 22, 2026

A fresh read-only Store API audit checked 247 storefront products and all 868
of their variants. The 528 base-color SKUs added to 20 hair-claw products now
use the previously approved 4-inch hair-claw mapping: `hair-claw-box` and 1
ounce product weight. The deployed catalog now contains 913 explicit SKU
mappings, and the audit returned zero storefront products with missing shipping
rules. The guarded staging deploy completed at `2026-09-22T17:00:47Z`; the
sanitized queue report at `2026-09-22T17:03:57.908Z` had zero failed, waiting,
active, delayed, or paused jobs.

This expands explicit coverage for the published storefront only. It does not
add a fallback for unknown SKUs, enable inventory synchronization, purchase a
label, or constitute a live-rate comparison. Coasters and other unpublished
unmeasured products remain blocked.
