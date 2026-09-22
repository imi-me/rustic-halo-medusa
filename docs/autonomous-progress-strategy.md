# Autonomous progress strategy

Use one milestone per working batch. A `k`, `ok`, or `continue` means continue
the active milestone without pausing for routine confirmation.

## Current position: do not repeat completed setup

The following are complete for staging and should only be revisited to repair a
new failure or when preparing a public launch: the VLAN 69 VM, private HTTPS
preview, staging deployment path, Stripe sandbox checkout, North Carolina tax
testing, test refunds, CDN media storage, the initial Shopify catalog import,
the restricted read-only MarketSuite comparison route, and the authenticated
read-only Etsy order report. They are not active milestones.

The MarketSuite read-only inventory comparison received its logged-in owner
review on September 22. Fresh paired snapshots showed three exact quantity
matches, one Medusa item needing identity review, and 551 MarketSuite items
without a Copper Mill record in Medusa. No quantities changed. Further identity
mapping is deferred until its own pre-cutover milestone; inventory syncing
remains disabled.

**One active milestone:** production Gate 1, freezing a small, reviewed release
candidate. A fresh browser checkpoint confirms that the protected staging
storefront contains 247 Rustic Halo products and excludes the four Medusa sample
products assigned to the Default Sales Channel. This milestone now narrows the
opening catalog to products with complete launch fields, completes the focused
storefront review, and records policy and appearance approval. It does not
authorize a production deployment, DNS change, live provider, real transaction,
or external inventory write.

The completed local portion includes a repeatable identity-mapping proposal: it
matches preserved Shopify variant IDs between Medusa and the MarketSuite portal
before a quantity comparison. Missing or ambiguous records are review items,
never inventory updates.

The staging backend now provides both identity and quantity exports only through
the staging Cloudflare Access application. Direct public backend access remains
unavailable.

## 1. Keep staging dependable

I will use the existing SSH connection, read service status after a deployment,
and let the job-health report refresh on its five-minute schedule. I will report
only a new service failure, failed job, recovery, or a required administrator
step. I will not repeatedly poll a healthy system.

The Redis job-health report recovered after the backend rebuild: the latest
report has zero failed or waiting jobs. The MarketSuite route is deployed and
protected by both Cloudflare service authentication and its separate Medusa key.

## 2. Finish the publishable catalog in batches

I can prepare shipping rules, verify source records, run focused checks, and
publish a confirmed product family to staging as one batch. I will leave items
unpublished when packing data, a studio SKU, or a photo is missing.

Owner inputs are limited to the short list in `remaining-catalog-inputs.md`:
packaging by product family, the Turkey door-hanger studio SKU, and the Coastal
Catch photo. Once a family is supplied, I can complete its staging work without
reopening the rest of the catalog.

## 3. Build integrations without enabling external writes

I can continue developing and testing the MarketSuite adapter in read-only
mode. Its Medusa inventory route is staged, fixed to Copper Mill, and protected
by a dedicated credential and protected service route. I will not change
MarketSuite, AntiqueSoft, Shopify, Etsy, or inventory quantities until the
comparison is reviewed and a cutover is explicitly approved.

The Etsy developer app is connected. Its authenticated 30-day order report is
verified on staging with Etsy retaining fulfillment ownership. It has
`transactions_r` only; `transactions_w`, webhook intake, Medusa order creation,
email, and inventory synchronization remain disabled.

## 4. Separate storefront styling from launch settings

I can implement the chosen Rustic Halo theme direction in staging as one visual
milestone after a reference or direction is selected. I will keep payments,
email, tax, shipping labels, and public launch settings in test mode until each
is explicitly approved.

## Working rhythm

1. Start with the active milestone and its current handoff.
2. Batch related edits and focused verification.
3. Deploy once to staging only when the batch is complete and authorized.
4. Record the result and the next concrete input.

Default to GPT-5.6 Terra with low reasoning. Use GPT-5.6 Sol with medium
reasoning only for a difficult integration or deployment diagnosis.
