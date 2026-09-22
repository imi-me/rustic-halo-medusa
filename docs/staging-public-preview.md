# HTTPS staging preview preparation

Owner selected `staging.rustichalo.com` on September 20, 2026. Existing
rustichalo.com website and cdn.rustichalo.com remain separate.

Prepared locally: storefront Docker build accepts configurable public storefront
and backend URLs; Compose forwards those options while retaining existing
localhost defaults. Not deployed. Diff whitespace check passed; public-origin
build and checkout verification still required.

Cloudflare account tunnel inventory was empty. Create Tunnel form prepared with
name `rustic-halo-staging`; creation not submitted. Creating it generates a
connector credential and requires confirmation at that step. Do not log tokens
or put them in tracked source.

Target design: outbound Cloudflare Tunnel from VM 102, HTTPS preview hostname,
preview access restricted to the owner initially, and no router port forwards.
Configure access protection before activating hostname routing. Expose only
required storefront/customer endpoints; never proxy Medusa admin, database,
Redis or VM management through the storefront hostname. Decide exact origin
routing after reviewing client-side API calls. Preserve the private admin path.
The current LOCAL_HTTP_ADMIN guard allows only loopback auth/admin origins;
external origin configuration must not weaken that guard.

Payments and shipping stay in test mode; customer email remains disabled.
No public DNS, tunnel, access policy, credentials, or VM networking was changed
in this preparation. Public preview is not approval for public commerce launch.

References:
- https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/

## Tunnel created — September 20

Owner explicitly approved creating the named tunnel and connector credential.
Cloudflare confirmed tunnel `rustic-halo-staging`, ID
`0c263bf0-660a-49ed-b442-515fe3c67d48`. Docker connector instructions displayed;
status is waiting for a connection. No hostname route or access policy has been
created. Prepared Git-ignored owner-only local command file for credential
handoff; do not echo its contents. Tunnel creation supersedes the pending-create
note above. VM installation and external preview protection remain pending.

## Connector connected — September 20

Installed the separate `rustic-halo-preview` Compose connector on VM 102.
Console reported `PREVIEW_CONNECTOR_STARTED`; Cloudflare then confirmed
“Tunnel connected successfully.” The installer pins the pulled official image
by digest and mounts a private token file, with no host ports or application
network attachment. No hostname route has been activated.

Cloudflare One already has team `shawnhouse` on Zero Trust Free. Preparing
owner-only Access protection before hostname routing; public origin build,
customer API routing and external checkout verification are still pending.

## Owner access protection saved — September 20

After explicit owner confirmation, created Cloudflare Access application
`Rustic Halo staging preview` for the entire `staging.rustichalo.com` hostname.
Application ID: `e2d101d8-c420-445d-a134-b303f5b489cf`.
Its only associated policy is `Rustic Halo owner preview`, ID
`08a0c21b-8c91-4725-8e17-95daedaecb1d`, action Allow, with one Include rule:
Emails exactly `shawn@house.email`. Reopened the saved policy and verified this
value. Application session duration is 24 hours, existing identity providers
accepted, and Cloudflare One Client authentication remains off.

This verifies saved configuration, not end-to-end access enforcement. Hostname
routing and origin deployment are still pending; no public preview is live yet.

## Preview storefront deployed — September 20

Moved the sole direct browser Medusa call (product option filtering) to a fixed
server action; SDK config now imports `server-only` to prevent future accidental
browser imports. Local storefront TypeScript check passed.

Deployed storefront using `compose.preview.yaml` with the HTTPS staging build
URLs. Only storefront joins `rustic-halo-preview_default`, alias
`rustic-halo-storefront`; live Docker inspection confirmed backend, Postgres and
Redis remain solely on `rustic-halo-staging_default`. Backend configuration and
its loopback-only admin/auth guard are unchanged. No backend route is needed.

Initial post-build readiness request raced Next.js startup and disconnected;
a fresh unprivileged check returned HTTP 200 for storefront `/us` and backend
`/health`. Deployment script now retries readiness (local change; not yet copied
to VM). Previous storefront image tagged and source archived by deployment.

Future storefront rebuilds/recreates MUST include `-f compose.preview.yaml`
after compose.yaml and compose.apps.yaml to retain hostname build args and
network attachment. Existing older deployment scripts do not include it.

Cloudflare route form is prepared but NOT submitted:
`staging.rustichalo.com` -> `http://rustic-halo-storefront:8000` (no path filter).
Awaiting at-action owner approval for protected external hostname activation.
External Access enforcement and checkout are not verified yet.

## Protected hostname activated — September 20

Owner approved activating the external staging route. Cloudflare confirmed
“Route added successfully” and created CNAME `staging.rustichalo.com` pointing to
`0c263bf0-660a-49ed-b442-515fe3c67d48.cfargotunnel.com`, with service
`http://rustic-halo-storefront:8000`.

Fresh browser navigation to `https://staging.rustichalo.com/us` successfully
used HTTPS and redirected to Cloudflare Access, displaying “Log in to Rustic
Halo staging preview” with email login-code authentication. Unauthenticated
access is gated. Owner login and storefront delivery through the tunnel still
need verification; no claim of external checkout success. Left the login page
open for the owner; no login email was sent by the agent.

## Signed-in preview verified — September 20

Owner signed in through Access in a separate browser tab. Verified actual
`https://staging.rustichalo.com/us` storefront delivery through the tunnel:
all 15 homepage image elements loaded (brand image on staging, product/editorial
images on cdn.rustichalo.com). Floral Cross product page loaded, selected its
variant, and enabled Add to cart. Added one $15 earring to a previously empty
cart; cart persisted through full navigation and the checkout address form
loaded over HTTPS. No captured browser errors during these checks. No address
submitted, payment created or order placed in this verification. Shipping,
Stripe fields, payment completion, and customer email on the public origin
remain unverified. Left owner on the checkout address page with the test item.

## HTTPS shipping and Stripe fields verified — September 20

Verified staging secret-key prefixes indicate Stripe and Shippo test mode and
email delivery flag remains false (no secret values recorded). Used synthetic
Preview Test / preview-test@example.invalid checkout identity with the public
1000 Bank Street, Richmond VA 23219 test destination. Delivery returned USPS
Ground Advantage — TEST $5.34; selecting it updated $15 subtotal + $5.34 shipping
+ $0 tax = $20.34. Proceeded to payment and selected Credit card.

Stripe's actual secure payment iframe loaded on staging.rustichalo.com in the
in-app browser. Expanded Card and verified editable Card number, Expiration
date, Security code and ZIP inputs. This resolves the gray-field blocker for
this HTTPS preview; it does not establish the exact cause of the older local
origin failure. No card data entered, payment confirmed, or order placed.

Stripe console warnings: optional link/cashapp/klarna/amazon_pay methods shown
in sandbox are not activated for live mode; Apple Pay domain not registered;
SDK recommends newer Checkout Sessions integration. These did not prevent card
fields loading. Optional live payment methods and Apple Pay remain launch work.

## Sandbox payment review reached — September 20

Entered Stripe's synthetic test card in the secure iframe (no real card data),
with test expiry/CVC and destination ZIP. Card completeness enabled Continue to
review. Identified agent-assisted testing using Stripe's AI-agent checkbox.
Verified storefront's Continue handler only navigates to review with the active
sandbox payment session; then used it and reached `?step=review` with Credit card
and Place order visible. Did NOT click Place order or confirm a payment.
Shipping total remains from the preceding $20.34 test cart. End-to-end order
completion on the external hostname is still untested.

## External sandbox checkout completed — September 20 (local)

Owner requested continuation after review, authorizing the remaining sandbox
order test. Clicked Place order once with the previously verified Stripe test
card/session. The HTTPS preview returned Order Confirmed for order number 14,
`order_01M30NJVSJJZS6223ARGX5PCZQ`. Confirmation shows $15 subtotal, $5.34 USPS
Ground Advantage — TEST shipping, $0 VA tax, $20.34 paid, and Cart (0).
Synthetic email preview-test@example.invalid; customer email remained disabled.
No live charge or shipping label purchase. Confirmation left open for owner.
This supersedes earlier notes that public-origin order completion was untested.
Live checkout, Apple Pay, NC production tax configuration, and customer email
remain separately unverified for launch.

## Deployment persistence maintenance — September 20

Updated the seven maintained deploy-* helpers (apps, CDN editorial, checkout
tax, tax-address guard, tax test, tax reporting test, password recovery) locally
and on the VM to conditionally include compose.preview.yaml. Original VM
scripts backed up before exact-match patches; shell syntax passed remotely.
Local stub-command checks passed both preview-present and absent cases with
argument boundaries preserved (14 cases). No deployments/restarts performed.
Earlier warning about these seven helpers omitting the preview overlay is now
resolved. Other historical VM-only scripts still require review before reuse.
