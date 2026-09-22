# Rustic Halo production launch plan

Status: proposed sequence. Nothing in this plan authorizes a public launch,
live charge, label purchase, customer email, tax collection, DNS cutover, or
inventory synchronization.

## Launch scope

Launch the Medusa website for United States orders with a small, fully reviewed
opening catalog. Keep Shopify connected to Market Suite and AntiqueSoft for
Copper Mill until a later, separately approved inventory cutover. Keep Etsy as
an independent sales channel; its Medusa report remains read-only.

This separation lets the website launch without putting market inventory,
Market Suite history, AntiqueSoft, or Etsy listings at risk.

## Gate 1 — freeze a production candidate

1. Preserve the current staging deployment and create a reviewed Git release
   candidate. Commit source and documentation while keeping all credentials,
   databases, reports, and local artifacts outside Git.
2. Select the opening products. Publish only products with confirmed SKU,
   price, photo, product-only weight, packed dimensions, shipping rule, and
   customer copy. Leave the 171 measurement-pending products, the photo-pending
   product, and coaster drafts unpublished.
3. Review the storefront on phone and desktop: home, search, product options,
   cart, account, password reset, customer service, checkout, confirmation, and
   order history.
4. Approve the final privacy, terms, returns, shipping, and contact copy for
   Rustic Halo, a brand of Ebenstone Co LLC. Preserve the US-only and ships-in-
   3–5-business-days policies.

Exit evidence: one release commit/tag, an opening-catalog report with no missing
launch fields, policy approval, and a staging browser pass.

### Gate 1 checkpoint — September 22

A fresh read-only browser review found 424 total Medusa products and 251 with
published status. Four are Medusa sample products assigned only to the separate
Default Sales Channel. The protected Rustic Halo storefront still renders 21
catalog pages; page 21 contains seven products, confirming 247 storefront
products. The sample products did not appear in the storefront review.

This confirms the current staging publication and pagination state. It is not a
field-by-field launch approval for all 247 products. The opening catalog must
still be narrowed to products with complete photos, product facts, packing data,
shipping rules and customer copy. Existing records show 171 imported products
remain unpublished for measurements, one remains unpublished for a photo, and
coasters remain drafts pending packaging details.

### Gate 1 field audit — September 22

A fresh read-only Store API audit checked all 247 Rustic Halo storefront
products and 868 variants. After deploying the already approved 4-inch
hair-claw shipping rule to 528 base-color variant SKUs, all 247 products passed
the required launch-field checks: customer copy, photo, variant, SKU, positive
USD price, and explicit shipping rule. The deployed map contains 913 explicit
SKU mappings. The post-deploy background-job report was healthy with zero
failed, waiting, active, delayed, or paused jobs.

This completes the catalog-field portion of Gate 1; it does not choose the
opening assortment. The owner still needs to select the smaller launch set,
approve policies and appearance, and complete the staging browser pass. See
`docs/opening-catalog-readiness.md` and the private detailed report at
`.local/opening-catalog-readiness.json`.

### Gate 1 guest browser pass — September 22

Desktop and 390 x 844 phone checks passed for the homepage, navigation, search,
store pagination, hair-claw product options, cart, account login, password
reset, customer service, checkout entry and Stripe frame loading, plus the
existing sandbox confirmation page. No payment or order was submitted. The pass
found and fixed an imported `Default Title` placeholder that customers had to
select before choosing a real product option. The deployed product page now
hides only that placeholder, preserves Color/Size/design options, and enables
Add to Cart after a real color is selected.

Authenticated customer order history was not freshly tested because no
test-customer login was used or created. See `docs/staging-browser-pass.md`.
Gate 1 still needs owner selection of the opening assortment and approval of
the policies and visual appearance.

### Gate 1 release candidate — September 22

The accumulated staging source and documentation have been consolidated into a
local release candidate on `codex/rebuild-rustic-halo-commerce`. A focused pass
completed 213 automated checks with no failures; backend and storefront
TypeScript checks and repository whitespace validation also passed. Changed and
new text files were scanned for credentials, and every match was a synthetic
test/offline fixture. Environment files, local reports, caches, dependency
trees, generated TypeScript state, and runtime data remain excluded.

The pass also fixed the protected Copper Mill read endpoint so invalid quantity
data produces one review response rather than a partial success payload. That
read-only correction is locally tested and remains undeployed. See
`docs/release-candidate-2026-09-22.md`. Gate 1 still awaits the owner decisions
listed below; no production or public change was made.

## Gate 2 — create production beside staging

1. Create a separate production VM and production database. Do not convert VM
   102 or reuse its database, Redis data, test orders, or test credentials.
2. Run application services on the VM's local SSD. Continue backing up the VM
   to the NAS; do not run the live application from the NAS.
3. Use a separate Cloudflare Tunnel for the public storefront/backend routes.
   Keep Medusa Admin, Proxmox, PostgreSQL, Redis, and SSH private. Protect admin
   access with the existing private-network approach or an owner-only Access
   application.
4. Continue using Cloudflare R2 at `cdn.rustichalo.com` for product media, with
   production-scoped credentials. Add an encrypted off-site database/config
   backup in addition to the daily NAS backup.
5. Keep `staging.rustichalo.com` and its sandbox services intact for future
   releases.

Recommended hosting decision: use a new Proxmox production VM after the fiber
connection is stable. A 2 Gbps symmetric connection is ample for this store.
If launch must happen before reliable fiber, use a small cloud VM for the same
container stack rather than depending on the DOCSIS connection.

Exit evidence: healthy production services, private admin access, HTTPS on a
temporary protected production hostname, fresh backup, and a successful
isolated restore check.

## Gate 3 — configure live commerce without switching it on

1. Create production-only Stripe, shipping, Resend, R2, database, Redis,
   session, and webhook credentials. Store them outside Git and keep staging
   keys separate.
2. Replace the current test-only tax comparison with the approved production
   tax calculation path. Verify North Carolina collection and a non-North-
   Carolina US address before enabling checkout.
3. Verify live shipping quotes for representative addresses and packing
   combinations. Do not purchase a label during rate verification.
4. Verify the public password-reset URL and send owner-approved transactional
   tests for password reset and order confirmation, including the HTTPS logo.
5. Register and verify Stripe's production webhook endpoint. Establish the
   operating rule that refunds originate in Medusa Admin so Stripe and Medusa
   remain consistent; importing an externally issued refund remains deferred.
6. Leave newsletters, advertising tracking, Etsy writes, Etsy webhook intake,
   and Market Suite inventory synchronization disabled.

Exit evidence: provider mode report shows production credentials in production
only; tax, rate, webhook, and owner email tests pass without a customer order.

## Gate 4 — final acceptance and cutover

1. Take a production backup and record the previous website DNS/hosting values
   for rollback.
2. With explicit owner approval, place one real US order through the public
   hostname using an opening-catalog item. Verify payment, tax, shipping,
   confirmation email, Admin order state, queue health, and customer order
   access. Refund it from Medusa Admin if the test is to be reversed.
3. Point `rustichalo.com` and `www.rustichalo.com` to the production Cloudflare
   route. Preserve the previous site and DNS values until the rollback window
   closes.
4. Recheck homepage, product, cart, checkout, account, password reset, contact,
   policies, images, admin privacy, and provider webhooks from outside the home
   network.
5. Monitor service health, failed jobs, payment/webhook errors, order email, and
   backups closely for the first 72 hours. Roll back DNS if checkout, payment,
   order persistence, or admin isolation fails.

Exit evidence: approved live order, all smoke checks pass, no failed jobs, and
the first post-launch backup completes.

## After launch

Expand the catalog in reviewed product-family batches. Resolve the Top Down
2-inch AntiqueSoft identity and the remaining Copper Mill identity coverage,
then run another read-only comparison. Design and test Market Suite writes only
after the comparison is complete and a separate cutover is explicitly approved.
Etsy fulfillment and inventory remain independent until their own reviewed
milestone.

## Owner decisions needed before Gate 1 closes

- Choose the small opening catalog; the recommended default is only products
  whose shipping and photos are already verified.
- Approve the policy drafts and current storefront appearance for launch.
- Decide whether launch waits for stable fiber or uses a temporary cloud VM.
- Provide the original Turkey Football Round Door Hanger studio SKU when found;
  otherwise leave that product unpublished.
