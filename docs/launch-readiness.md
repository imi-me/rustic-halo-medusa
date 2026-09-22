# Rustic Halo launch readiness

Status: staging only. This checklist summarizes recorded verification; it is not a fresh check of external accounts. Latest detailed evidence is in staging-deployment.md and payments-and-shipping.md. Historical entries in those files are superseded by their later verification notes.

## Verified in staging

- [x] VM 102 moved to Services VLAN 69; current DHCP reservation is 10.20.69.159. Private SSH preview restored.
- [x] Owner administrator setup completed and admin product/customer pages reached after the private HTTP session fix. Remove LOCAL_HTTP_ADMIN for public HTTPS hosting.
- [x] Pre-payment tax validation deployed; two unpaid carts passed and a missing cart was rejected. Local payment-handler tests prove validation precedes Stripe and blocks it on mismatch/outage. This is not an end-to-end browser charge test or authoritative tax replacement.

- [x] Stripe sandbox checkout and order completion.
- [x] NC tax applied, cleared for a Virginia address, and restored for NC; payment rounding checked.
- [x] Automatic tax transaction reporting and full/partial refund reversals for the tested uniformly taxable order.
- [x] Redis event processing, workflow engine, and shared locks configured.
- [x] Delayed order event survived a graceful Redis/backend restart and completed.
- [x] Background-event status and targeted retry tools installed; five recovery guard tests passed.
- [x] Codex check scheduled every 30 minutes, quiet unless actionable state changes. Unprivileged SSH status reading verified September 20 using a root-owned sanitized report refreshed every five minutes; stale reports over fifteen minutes are rejected. SSH availability remains a dependency.
- [x] Owner received and approved a sample transactional email; customer delivery remains off.
- [x] External sandbox refund detected; reviewed tax recovery and repeat-run protection verified. Store refund mismatch is reported separately; automatic import into Medusa remains unresolved.
- [x] Fresh NAS backup restored into separate VM 103, booted with networking disconnected, and verified: four services running, 8 orders, 9 products, 8 payments, storefront/backend HTTP 200. Test VM retained stopped with automatic boot off. See restore-test.md for limits.
- [x] After the drill, original staging homepage, customer-service page, sample sign product, empty cart, and account page returned HTTP 200 through the existing localhost tunnel. This checks page responses, not browser interaction or checkout.
- [x] September 22 guest browser pass covered desktop and 390 x 844 phone layouts: homepage, compact navigation, search, store pagination, hair-claw color selection, cart, login, password reset, customer service, existing checkout/payment frame, and existing order confirmation. The imported `Default Title` selector was removed and the deployed product page enables Add to Cart after a real color is selected. No payment or order was submitted. Authenticated customer order history remains a separate check.

## Next engineering priorities

1. **Resolve external refund store state.** Read-only detection and reviewed tax recovery are verified. Installed Medusa 2.21's normal refund workflow always calls the payment provider, so it cannot be replayed as a record-only import. Establish a supported way to import already-issued Stripe refunds into Medusa without issuing another refund. The deliberate external-refund sandbox order remains mismatched internally; normal refunds should originate in Medusa.
2. **Finish checkout tax calculation.** Actual-cart comparison now matches Stripe sandbox for three unpaid carts with shipping; real Medusa 10-percent item and free-shipping promotions also matched on the three-unit test cart; temporary promotions were deactivated and the cart restored. Mixed hair-claw/earring lines also matched with percentage, fixed-dollar, and free-shipping promotions. Exhaustive rounding boundaries and authoritative checkout integration remain unverified. Current checkout provider is a test-only rate probe. Use actual discounted cart calculations and verify rounding, discounts, shipping, and relevant product classifications before live enablement.
3. **Verify operational access.** Unattended read-only status access now passes without sudo or Docker-group access. Sanitized reporting and stale/failure detection were tested; the heartbeat was updated. Verify subsequent scheduled refresh and notification delivery. Add workflow-failure visibility separately from the event queue.
4. **Complete recovery coverage.** Isolated NAS VM restore, guest boot, database counts, and local application responses passed. September 20 audit found no backend storage mounts and no local files at the default upload path. R2 image storage is now deployed; a Medusa file-service upload survived backend recreation and rendered from cdn.rustichalo.com. Admin UI upload passed with an unpublished synthetic draft. A VM-disk R2 export and isolated re-upload restoration passed, including byte comparison through the CDN. Daily image export is enabled at 20:00 Eastern before the configured 21:00 NAS backup. The latest NAS archives checked at 19:23 September 20 predate the exports; NAS recovery of image exports remains pending. The five imported products and homepage editorial images were subsequently migrated to verified CDN copies; a fresh 27-object export passed. NAS recovery of this newer export is still pending. Configuration files are present, but restore coverage and NAS retention/off-site coverage still need verification. No power-loss test or exhaustive file comparison has been performed.
5. **Final browser checkout.** Mobile address/billing layouts and test shipping selection are verified. September 20 Safari over private localhost HTTPS completed address, shipping, and Stripe sandbox payment. The generic-decline card displayed an error and retained the cart; replacing it with the successful sandbox card completed order #13 (order_01M309302DPMHE36XMT2MSPA3R), $21.69, and cleared the cart. Customer email delivery remained disabled. Codex in-app browser certificate trust and intermittent gray payment placeholders remain unresolved; HTTPS alone is not established as their cause. Use Safari for remaining tests. Order #13 background reporting and its approved full $21.69 admin refund passed: Stripe, saved reporting, and Medusa refund amounts match; zero failed jobs. Validate mobile purchasing, additional address changes, and account/order access with the deployed persistent services.
6. **Customer password recovery activation.** Pages, request limits and replay protection are deployed. Real Redis/database and signed-token HTTP checks passed, including exactly one successful update among eight concurrent requests and rejection of the old password. Owner confirmed inbox receipt and successful browser reset; temporary identity/token/key copies were cleaned up. Customer recovery and general email remain disabled. Configure the public HTTPS reset URL and verify the subscriber/notification delivery path before activation. The unused profile password editor remains a placeholder.

## Owner inputs and launch steps

- [ ] At finish-up, remind Shawn once to provide the original studio SKU for
  Turkey Football Round Door Hanger. Owner is locating it; reminder pending.

- [x] Guest-order privacy: owner chose the simplest option, retaining private confirmation-link access without sign-in or an emailed code. Anyone given that link can view the order details, including email and address. Existing behavior verified on synthetic order 13 with a cookie-free request; no access-policy change needed.

- [x] Original pilot shipping audit: 5 exposed products / 6 variants have confirmed mappings; 9 packing tests passed. This does not cover the full imported catalog.
- [ ] Finish the remaining catalog measurements: 242 imported products are
  staging-visible after shipping, storefront, and checkout verification. The
  test provider now has 385 confirmed SKU mappings. Keep the 171
  measurement-pending products and one photo-pending product unpublished until
  their information is confirmed. See `catalog-review-checklist.md`.
- [ ] Coasters are now included: all 25 imported as drafts. Packaging measurements and shipping rules remain pending; owner reversed the earlier deferral.
- [ ] Review final privacy, terms, and returns drafts for Ebenstone Co LLC / Rustic Halo. US-only launch; made to order, ships in 3–5 business days, transit additional.
- [ ] Choose the public hosting/domain path and verify HTTPS, private admin access, public webhook delivery, and availability.
- [ ] Configure and separately verify live Stripe and shipping credentials. Existing test-only providers must not simply be switched to live keys.
- [ ] Verify live shipping quotes for representative destinations and packing combinations; no label purchase is implied.
- [ ] Verify Resend domain/sender in the deployed environment, public HTTPS logo URL, and owner-approved delivery test before enabling customer email.
- [ ] Review opening catalog, prices, photos, availability, and US shipping coverage.
- [ ] Approve public launch and any explicitly chosen live transaction test.

## Boundaries

No public launch, live tax activation, real payment/refund, label purchase, or customer email is authorized by this checklist. Marketing/newsletters remain deferred. Tax reporting is not tax filing/remittance. The restart test covered graceful service restarts, not power loss or every interrupted workflow.

## Image follow-up — September 20, 19:24 Eastern

Fresh staging HTTP checks returned 200 for the homepage and sample sign product. Rendered homepage image sources included 14 references to rustichalo.com; the sample sign page included five cdn.shopify.com image references. These are page references, not unique asset or catalog totals. Enabling R2 did not migrate existing images. Inventory and migrate those assets before claiming the opening catalog is covered by R2 exports. No product data was changed by this check.

### Image migration completed — September 20, 19:30 Eastern

Copied and byte-verified 24 source images (5,830,357 bytes), updated all five imported products while preserving image IDs, and rebuilt/deployed the homepage editorial links. All five product pages and homepage returned HTTP 200 with CDN photo URLs and the local logo. Browser checks passed for the sample sign gallery, related thumbnail and visible homepage photography. Immediate export verified 27 R2 objects at `image-backups/20260920T233001Z-67777`. Original external assets and rollback URL mapping are preserved. This supersedes the earlier old-host photo gap; tonight's NAS archive coverage is still pending.

### Checkout guard follow-up — September 20

Closed a validation bypass for addresses outside NC: stale item/shipping/aggregate tax now blocks checkout; US/USD restrictions are enforced by the sandbox guard. Thirty local tax tests, backend type checking and five deployed synthetic guard checks passed; health endpoints returned 200. Live tax activation and full browser address-change testing remain separate. The monitor also completed its first automatic five-minute refresh successfully.

### Actual-cart address transition verified — September 20

A new unpaid cart passed NC → Virginia → NC through the deployed Store API. Tax cleared completely in VA and the original NC totals returned exactly. All three tax preflights passed. No payment collection/order was created. Browser address-form interaction remains distinct from this API regression.

### Protected HTTPS preview and checkout — September 20

`staging.rustichalo.com` now routes through Cloudflare Tunnel to the storefront
only. Cloudflare Access restricts the full hostname to shawn@house.email.
Unauthenticated redirect and owner sign-in were verified. Admin, database, and
Redis remain private; LOCAL_HTTP_ADMIN still applies only to private loopback
admin/auth origins, not to the externally exposed storefront.

In-app browser HTTPS checkout passed end to end with Stripe sandbox order #14
(`order_01M30NJVSJJZS6223ARGX5PCZQ`), $20.34 including $5.34 test shipping and $0
VA tax. Card fields loaded, review and confirmation passed, and cart cleared.
This supersedes the in-app payment-placeholder blocker for the staging HTTPS
origin; the exact cause on localhost was not established. Customer email stays
off. Production tax calculation, live shipping/payment setup, Apple Pay domain
registration, public webhook delivery and production launch remain pending.

Seven maintained deployment scripts now include compose.preview.yaml when it
exists, preserving the staging URL and storefront tunnel network on later
updates. Local shell syntax and 14 argument-selection checks passed; the VM
scripts were patched in place with backups and syntax-verified. No services were
restarted for this maintenance fix. Historical ad hoc scripts on the VM were
not changed and should not be reused without review.
