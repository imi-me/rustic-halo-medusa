# MarketSuite integration

## Initial scope: replace Shopify's connector role

Medusa replaces Shopify on the Rustic Halo side of the existing MarketSuite →
AntiqueSoft (AS) bridge. Items assigned to Copper Mill mirror through MarketSuite
to AS; sales-related inventory reductions and adjustments sync back. Reporting
stays in MarketSuite. Preserve its existing AS behavior and other accounts.

AS does not provide customer information. Do not require customer fields, create
placeholder customer accounts, or associate market activity with website
customers. An AS quantity reduction is the existing sales-detection signal, not
proof of a paid transaction: do not invent Medusa paid orders, payment records,
or customer emails from inventory changes.

Keep stable Medusa, legacy Shopify, MarketSuite and AS item mappings, scoped to
the Rustic Halo account and Copper Mill location. Deduplicate repeated changes,
prevent changes from echoing back through the bridge, and reconcile discrepancies
without overwriting newer activity with an old snapshot. Confirm the current
MarketSuite sale/adjustment classification in code before implementing it.

MarketSuite source: `/Users/shawnhouse/Documents/ChatGPT/Market Suite`.
Inspect its existing connector before choosing payloads and authentication.
Shopify remains the initial migration source; only one active inventory writer
should serve this connector role after an explicitly planned cutover.

## Read-only Medusa endpoint (local implementation)

`GET /integrations/marketsuite/inventory` accepts a dedicated bearer credential
and optional numeric `offset`. It returns up to 100 inventory levels with
stocked, reserved and available quantities, a timestamp and `nextOffset`.
It exposes neither customers nor orders and performs no database writes.

Disabled by default. Configuration, still unset for this feature:

- `MARKETSUITE_INVENTORY_READ_ENABLED=true`
- `MARKETSUITE_INVENTORY_READ_KEY`: dedicated random secret of at least 32 characters
- `MARKETSUITE_COPPER_MILL_LOCATION_ID`: verified Medusa stock-location ID

The configured location must preserve Shopify location metadata
`gid://shopify/Location/79837790404`. Request parameters cannot override it.
Missing config or mapping, invalid quantities and service failures fail closed.
Responses use `Cache-Control: no-store`. Never use a storefront/public key here,
put the key in a URL, or expose it in browser code.

The inventory and identity endpoints are deployed to the staging backend but are
available only through the staging Cloudflare Access application and are not
available on the public site. They return 503 while their
configuration remains unset.
Before enabling, choose restricted service-to-service transport and protected
secret storage; preserve the private admin boundary. Add request throttling at
that transport boundary and verify HTTP-level auth/routing in staging.

For multi-page reads, only a successful collection of every page can be marked
complete by the caller. A final page is not itself a complete export. Reads are
non-atomic and cannot authorize cutover. The endpoint lists existing levels, not
all variants or inventory identities; the full catalog/identity reader and the
identity reader remains to be implemented.

`read-medusa-inventory.mjs` is a portable server-side HTTP reader prepared for
MarketSuite. The matching read-only function is installed in the MarketSuite
app. It requires an explicitly configured HTTPS origin and dedicated
read key, refuses redirects, enforces page/time bounds and location identity,
and only returns a snapshot after all pages succeed. Output fields are
allowlisted. Never supply its origin or credential from an untrusted request.
An empty catalog and a failed/authentication-denied read are distinct outcomes.

`GET /integrations/marketsuite/catalog` and `read-medusa-identities.mjs` apply
the same disabled-by-default credential and Copper Mill location boundary to
the identity snapshot. They return only Medusa inventory-item IDs and preserved
Shopify variant IDs. This snapshot feeds the offline mapping proposal before a
quantity comparison; it does not expose SKU, product details, customers, orders
or inventory changes.

The reader uses a single dedicated bearer credential. It cannot yet authenticate
through Cloudflare Access service-token protection. The existing staging URL is
a protected storefront, not this backend endpoint: do not point the reader there
and assume it is connected, expose admin routes, or bypass the Access policy.
Staging deployment needs an authenticated VM administrator session and an agreed
restricted service route (including Access service-token support if used).
No new credentials, network routes, or live configuration were created.

## Identity mapping proposal

`build-identity-mapping.mjs` is an offline-only step between the two complete
identity snapshots and the quantity comparison. It creates a *proposal* by
matching the preserved Shopify variant identity, not SKU, title, barcode, or
quantity. Shopify's numeric variant ID is accepted only as the canonical
`gid://shopify/ProductVariant/<id>` form. It requires each MarketSuite record
to carry its reviewed AS stock ID, rejects duplicate identities and puts any
one-sided record into a review list. It does not create missing products or
inventory levels, infer zero quantity, persist a mapping, or authorize cutover.

The resulting `mapping` object is the input to `compare-inventory.mjs` after a
separate fresh quantity snapshot is collected. This makes the first real
comparison repeatable and reviewable without trusting a hand-built SKU map.

Twenty-four local comparison/planning/client tests pass, plus ten backend route
tests. Client tests use a fake transport; a real HTTPS request from MarketSuite
and installation into its app remain outstanding.

Six mocked route tests cover authentication, location isolation, pagination,
response fields, invalid quantities and service failures. They are not a live
HTTP or deployment test.

## Deferred

See [connector-map.md](connector-map.md) for the reviewed source paths, cutover
risks, proposed Medusa contract and staging acceptance cases.

Kiosk personalization, temporary barcodes, payment confirmation, production
release and deeper reporting integrations are future work. Earlier kiosk designs
do not imply AS currently provides transaction or customer data.
