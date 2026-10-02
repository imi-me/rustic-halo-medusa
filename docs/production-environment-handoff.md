# Separate production environment — preparation handoff

## Coolify protected production preview verified — 2026-10-02

Owner-approved current staging app and catalog-only copy are running in the
existing Coolify production environment. Shopify public domains, VM104 and
its old preview.rustichalo.com remain untouched. Historical VM104 notes follow.

- Preview: https://production-preview.rustichalo.com/us
- Admin: https://production-preview.rustichalo.com/app
- Environment: tw8sccnoa4xnxigzlojtnaht.
- Commerce Apps: bvfoyx363r3pky9lues4fpyk, applicationId=3.
- Data: aw4sntlbsbfsukqtfvccduqm, separate DB/Redis volumes and secrets.
- Deployed app commit: 2b4af1eb91a246dcb607d7c055e7c15edc65f8cc.
- Actual signed GitHub webhook deployment: bbqfu8ubmgk5apoywhgtqrb7,
  finished successfully 23:08:41 UTC. App/build changes on production auto-deploy.

Existing shared coolify tunnel 1cbe04cc-1a97-4110-ac0e-dab88ee2afcc routes the
new hostname to http://localhost:80. Access app 13ff8ce5-cef4-4fd4-9792-f021049e3f67
retains its old preview hostname and protects all paths of the new hostname.
Its sole policy 08a0c21b-8c91-4725-8e17-95daedaecb1d allows shawn@house.email.
Anonymous storefront/app/admin/auth/API requests redirect to Access login.
Origin HTTPS certificate validates; storefront and Admin return 200. Owner
Cloudflare session passed through the existing identity provider. Browser home
and representative product render images and prices. Staging remains healthy.

Guarded preview publication verified exactly 24 products, 102 variants and two
collections. Inventory management remains enabled, backorders disabled and no
stock quantities copied; browser purchase controls are disabled. No customer,
order or test admin data copied. Owner staff identity only was copied with the
existing staging password hash; production has one owner admin. Admin browser
sign-in/session still requires the owner's password entry and verification.
Live payment, shipping, email, R2 writes, inventory sync and Etsy remain off.

Final deployment has applicationId=3 labels and unique production service
aliases on the shared proxy. Explicit DB/Redis/backend names prevent generic
DNS collisions. Each storefront's API region IDs match its own database:
staging 2 regions, production 1. Coolify custom start command is persisted:
`docker compose -p rustic-halo-production --project-directory . -f ./deploy/coolify/production-apps.compose.yaml --env-file .env up -d --remove-orphans --wait --wait-timeout 300`
Loopback API 29000/storefront 28000 retained. DB seeds skipped. Existing Git/SSH
access and webhook reused; database/session secrets remain separate.

Final backup 20261002T231048Z was restored with no network and verified 24
published products/102 variants/one owner/zero customers/zero orders. Private
off-host archive .local/coolify-production/production-preview-verified-20261002T231048Z.tar.gz
passed archive and manifest SHA256/size checks, deployed-commit verification,
and confirmation that it includes the corrected health monitor. Archive SHA256:
fa36a62e5e001a0f091091230c0c3a1ac47c3080683f328ab825c413dc097b49.
All 117 catalog image URLs match the previously verified 1526-object off-host
archive .local/coolify-migration/staging-git-backup-20261002T195044Z.tar.gz.
Daily backup 20:30 America/New_York and five-minute read-only health timers are
enabled. Monitor now selects applicationId=3 rather than the old service name;
23:10:20 UTC report healthy, zero failed/queued/active jobs, one completed job.

Implementation: deploy/coolify/production-apps.compose.yaml, Dockerfile,
start-backend.sh, backup-production.py, publish-production-job-health.py,
production-background-jobs.cjs and production backup/health systemd units.
Private guard/report helpers: .local/coolify-production/{publish-owner-preview.cjs,
copy-owner-admin.py,verify-network-isolation.py,verify-current-restore.py,
preview-routing.json,catalog-export.json,catalog-asset-coverage.json}.
Host operations: /usr/local/lib/rustic-halo-production; backups:
/var/lib/rustic-halo-production-backups; health:
/var/lib/rustic-halo-production-health/status.json.
Proof: /private/tmp/rustic-halo-production-tunnel-configured.png and
/private/tmp/rustic-halo-production-preview-product.png.

Remaining: owner Admin browser sign-in verification. A separate launch milestone
must configure/test live payments, shipping/tax, email and inventory and obtain
public cutover approval. NAS/Proxmox coverage and recurring off-host backup
transfer remain unverified. No public Shopify DNS changes in this milestone.

Checked September 23, 2026 UTC. The owner approved running a separate production
environment before the public website changes, provided `rustichalo.com` and
`www.rustichalo.com` DNS stay on the existing Shopify site until final cutover.
Staging VM 102 remains the ongoing development/test environment. The paused
hair-claw image drafts are local, unapproved work and must not enter a
production build.

## First bounded deployment: isolated infrastructure

The deployed `deploy/production/compose.infrastructure.yaml` uses a separate
Compose project, PostgreSQL database/user, and named data volumes distinct from staging.
PostgreSQL and Redis have no published host ports. The file contains no secret.
`deploy/production/start-infrastructure.sh` installed it on VM 104 in
`/opt/rustic-halo-production`, generated a unique database password in a
root-owned mode-600 `.env` outside Git, and waited for both service health
checks. The guest-agent execution exited 0 and reported
`PRODUCTION_INFRASTRUCTURE_HEALTHY postgres=1 redis=1 published_ports=0`.
The script refuses a different host or a differing installed Compose file and
does not replace an existing password. No staging data, credentials, or volumes
were copied.

`deploy/production/test-database-restore.sh` took a compressed logical dump
of the new production database, wrote a SHA-256 checksum under the root-only
`/opt/rustic-halo-production/database-backups` directory, and restored it into
a disposable PostgreSQL container with no network. The guest-agent execution
exited 0 and reported `PRODUCTION_DATABASE_RESTORE_VERIFIED`; the disposable
container was removed by the script's cleanup trap. A second run after Medusa
migrations restored the populated schema and confirmed that the four seeded
products matched the source count. This does not prove restoration of future
order data, application files, secrets, or the VM. No recurring logical backup
or off-VM copy is configured yet.

## Private backend checkpoint

The owner approved a private backend-only deployment from pinned commit
`79639af13c9038bbe7e7b1c78435194c165928b2`. A `git archive` of that commit
was copied to VM 104 and checked against SHA-256
`6f82e48fb319497c85dfbb2c079adfc52e4c05bec48b28a237ce41a39785eff0`.
It excludes all current uncommitted storefront and hair-claw work.
`deploy/production/start-private-backend.sh` installed the source under
`/opt/rustic-halo-production/source`, generated root-owned mode-600 JWT/cookie
secrets, built the backend, ran database migrations, and started the service
using `deploy/production/compose.backend.yaml`. The guest-agent process exited
0 with `PRIVATE_PRODUCTION_BACKEND_HEALTHY`. A separate SSH check found
`/health` returning HTTP 200 and only SSH plus `127.0.0.1:19000` listening on
the guest. PostgreSQL and Redis still have no published ports.

The migration automatically ran the repository's boilerplate initial data
seed and created **four sample products**. A direct database count verified
four products and zero payments. That same seed code creates a default
publishable API key, a Europe region, euro as the default currency, and a
European warehouse. These are not the approved US opening configuration or
24-product assortment and must not be used for a storefront. Payment, tax-test, email,
password-reset, Etsy webhook/order reporting, and R2 storage flags are off in
this backend deployment. At this checkpoint, no production storefront, dedicated Rustic Halo
publishable key, tunnel, HTTPS preview, or public route was installed. Medusa Admin is not exposed; its
secure-cookie login has not been configured/tested for a production HTTPS URL.

## Private US preview setup checkpoint

On September 23 UTC, the owner approved a guarded, one-time setup on VM 104.
The read-only `deploy/production/inspect-seed-state.cjs` confirmed the exact
four published Medusa sample products, one default channel/key/store, the
Europe region, European Warehouse, and no orders or customers. The reviewed
`deploy/production/prepare-us-preview.cjs` was staged with SHA-256
`d7f61bab5a2489679001b1b148f7b2d3f78cc60b970336739a8828678a87724d`.
`deploy/production/run-us-preview-setup.sh` first created and restore-tested
a fresh database backup, then ran the guarded Medusa workflows. The Proxmox
guest-agent command exited 0 with
`PRODUCTION_US_PREVIEW_PREPARED demos_draft=4 online_products=0 private_backend=healthy`.
An independent read-only Medusa query confirmed all four samples are now
**drafts**, the new **Rustic Halo Online — Production** sales channel has no
products, a dedicated publishable key and empty online stock location exist,
**United States — Production** covers `us`, and USD is the store default.
The US region was created without payment providers; checkout has not been
configured. A separate SSH check returned HTTP 200 for `/health` and found
only SSH plus the backend on `127.0.0.1:19000` listening.

The seed's Europe region, euro secondary currency, default sales channel/key,
and European Warehouse were preserved rather than deleted. They must be
excluded or removed in a reviewed later step before claiming a US-only public
store. The new publishable key is persisted in Medusa; its value was not
printed or placed in a storefront environment file. No storefront, tunnel,
DNS change, payment enablement, catalog import, or inventory synchronization
was performed at this checkpoint. The next bounded milestone was a protected HTTPS preview tied
only to the empty new sales channel.

## Protected HTTPS production preview checkpoint

On September 23 UTC, the owner approved a private storefront build and a
separate owner-only Cloudflare route. `deploy/production/compose.storefront.yaml`
and `deploy/production/start-private-storefront.sh` built the storefront from
the same pinned `79639af13c9038bbe7e7b1c78435194c165928b2` source archive.
The setup read the dedicated publishable key from Medusa without printing or
placing it in an environment file, checked that the new sales channel had zero
products and that the US region existed, and started Next.js on VM loopback
`127.0.0.1:18000`. The guest-agent process exited 0 with
`PRIVATE_PRODUCTION_STOREFRONT_HEALTHY products=0 bind=127.0.0.1:18000 backend=private`.
An independent temporary SSH port-forward check returned HTTP 200 for `/us`
and the Rustic Halo homepage. The port forward was then closed.

Cloudflare Access application **Rustic Halo production preview** protects
`preview.rustichalo.com` with the existing **Rustic Halo owner preview** Allow
policy, whose sole Include rule is `shawn@house.email`. It was created before
the public hostname route. A new `rustic-halo-production` Tunnel, separate
from staging's tunnel, has a healthy connector and routes that hostname to
`http://storefront:8000`. `deploy/production/compose.tunnel.yaml` puts the
connector on the storefront's preview-only Docker network; it shares no
network with the backend, PostgreSQL, or Redis. The tunnel token was copied
through hidden terminal input to a root-owned file on VM 104, installed for
the connector with mode 400, and removed from the temporary location. Its
value was not printed or committed. The checksum-guarded installer is
`deploy/production/start-preview-tunnel.sh`.

`deploy/production/verify-protected-preview.sh` exited 0 with
`PROTECTED_PREVIEW_VM_VERIFIED backend=private storefront=private connector=storefront_only`:
the backend and storefront remain bound to VM loopback, the tunnel reaches
only the storefront network, the services are healthy, and the temporary
token file is gone. An unauthenticated HTTPS request to `/us` returned 302 to
the Cloudflare Access login. An already authenticated browser session rendered
the Rustic Halo homepage through the new hostname. No `rustichalo.com` or
`www.rustichalo.com` DNS record was changed; Shopify remains the public store.

The preview is deliberately empty. No catalog was imported, payment provider
configured, live order placed, email enabled, or inventory synchronization
started. The old Europe region and default seed channel still exist. The
storefront's pinned copy includes a “Secure Checkout” trust phrase and a
best-sellers anchor even though checkout is not configured and the new channel
has no products; review that preview wording before broader distribution.
The next release gate is the guarded import of the approved 24-product opening
catalog, followed by payment, shipping, tax, email, backup, and checkout
verification before public DNS cutover.

## Approved opening catalog imported as hidden drafts — September 23

The current staging Store API was freshly audited read-only: 247 products were
checked, 247 were ready, and none failed the readiness rules. The approved
`deploy/production/opening-catalog.json` still matched 24 products and 102
variants. The older Shopify snapshot did **not** match the later hair-claw
color variants, so `deploy/production/export-approved-catalog.py` exported
the current staging Medusa records instead. Its ignored local output is
`.local/approved-opening-catalog-export.json` (SHA-256
`2be9e25ad5feed718dbc2f266ead7bec847b2f0366f379fe11031964047f4d58`).
It contains 118 existing CDN image references, no stock quantities, and only
two collection groups: 10 hair claws and 14 earrings. All 102 source variants
lack barcodes; do not invent them as part of this import. The owner has been
asked whether to add signs and gifts to the preview assortment later.

The checksum-guarded `deploy/production/run-approved-draft-import.sh` first
made and restore-tested a fresh production database backup under
`/opt/rustic-halo-production/database-backups/20260923T142321Z`, then ran
`deploy/production/import-approved-drafts.cjs` against VM 104. An initial
wrapper invocation stopped before the backup or import because its manifest
filename was wrong; the path was corrected before retrying. The successful
guest-agent execution exited 0 with `PRODUCTION_DRAFTS_PREPARED products=24
variants=102 published=0 inventory_sync=off`. Independent read-only SQL and
Store API checks from `deploy/production/verify-approved-drafts.sh` exited 0:
24 imported drafts, 102 associated variants, 28 total products including the
four starter drafts, zero published products, and zero products visible through
the dedicated production storefront key. The private backend and storefront
both returned HTTP 200. Shopify, staging, Etsy, Market Suite, payments,
inventory levels, and public DNS were not changed.

The owner-only preview remains visually sparse because the 24 products are
drafts. The storefront also caches collections with `force-cache`; a local
change in `apps/storefront/src/lib/data/collections.ts` changes these reads to
`no-store`, and its TypeScript check passed, but this change is **not deployed**.
The pinned VM 104 release is still `79639af13c9038bbe7e7b1c78435194c165928b2`.
Before making products visible even in the owner-only preview, review the
assortment decision, publish/link only the approved products through a guarded
step, release the collection-cache fix from a clean commit, and verify that
checkout remains disabled. Do not infer public-launch readiness from this
private draft import.

### Signs and gifts supplement imported as hidden drafts — September 23

Staging's current Store API has 247 visible products: 68 hair accessories, 177
earrings, two signs, zero gifts, and zero coasters. That explains why the
owner-only preview cannot yet show the intended four-category assortment.
Three existing, active Shopify products were selected as a small supplement:
`wildflower-round-welcome-sign-14in`,
`home-sweet-home-birds-round-wood-sign-14in`, and
`decorative-wooden-gift-boxes`. Their live Shopify records were read-only
checked against the saved catalog for status, SKU and USD price. Existing
Rustic Halo CDN copies cover all four source images; no stock is being copied.

`deploy/production/prepare-preview-supplement.py` generated an ignored,
mode-600 `.local/production-preview-supplement.json` with three products and
six variants. `deploy/production/import-preview-supplement.cjs` and
`deploy/production/run-preview-supplement-draft-import.sh` enforce exact
handles/SKUs, checksum matching, isolated backup restore verification, and
draft-only creation. `deploy/production/verify-preview-supplement.sh` is the
independent post-import check. These files passed syntax and negative guard
checks and were transferred to VM 104 with matching checksums. After owner
approval, the VM script exited 0 through the Proxmox console. It first made
and restore-tested a new backup under
`/opt/rustic-halo-production/database-backups/20260923T151256Z`, then returned
`PREVIEW_SUPPLEMENT_DRAFTS_PREPARED products=3 variants=6 published=0
inventory_sync=off`. The independent read-only verifier exited 0 with
`PREVIEW_SUPPLEMENT_INDEPENDENTLY_VERIFIED products=3 variants=6 published=0
storefront_visible=0`. The private-preview isolation check still reported a
private backend, private storefront, and storefront-only connector. VM 104 now
has 31 products total: four starter drafts, 24 opening-assortment drafts, and
three sign/gift drafts; no published products. The owner-only preview remains
visually sparse until a separate, reviewed visibility step. Product
availability and shipping remain unconfigured in production; do not infer
checkout readiness.

Before owner approval, the owner-only release was prepared but not run. Clean storefront
commit `77dbcb31e9c9086f258535cfd19ee216162f83bb` changes collection
reads to `no-store` and removes an inaccurate checkout claim; TypeScript and
focused lint checks passed. `deploy/production/publish-owner-preview.cjs`
selects exactly the 24 approved opening products plus the three sign/gift
supplements (27 products, 108 variants). It refuses catalog or SKU drift,
unexpected inventory/backorder settings, provider enablement, existing orders,
or another sales channel. `deploy/production/run-owner-preview-publication.sh`
checks the owner-only Cloudflare Access challenge, restores a fresh database
backup, builds the storefront before changing visibility, then publishes and
starts the new preview. `deploy/production/verify-owner-preview-catalog.sh`
independently checks the resulting Store API and product counts. The scripts
and two clean storefront files were transferred to VM 104 with verified
checksums. The original assortment manifest has
`productionPublishAuthorized: false`; separate owner approval was required
and is recorded in the next checkpoint.
Product inventory is still zero, so any visible products should remain
unavailable for purchase. Public Shopify DNS, checkout, payments, Etsy writes,
email, and inventory syncing are outside this release.

### Owner-only opening catalog published — September 23

The owner separately approved publication to the protected preview. The
checksum-guarded release ran on VM 104 after a fresh restore-tested database
backup under
`/opt/rustic-halo-production/database-backups/20260923T153250Z`.
The release built the clean `77dbcb31e9c9086f258535cfd19ee216162f83bb`
storefront before linking and publishing the 27 selected products, then
started the new storefront. It exited 0 with
`OWNER_PREVIEW_PUBLICATION_APPLIED products=27 variants=108 checkout=off
inventory_sync=off public_dns_unchanged=1`. The independent SQL and Store API
check exited 0 with 27 visible products, 108 variants, four demo drafts, and
private backend/storefront bindings. Browser checks showed the homepage's
Hair Claws, Earrings, Signs, and Gifts category links and real product cards;
the signs page had two sold-out products and the gifts page had one sold-out
product.

The first browser pass exposed a shared HTTP 500 on product detail pages.
Production logs reported `DYNAMIC_SERVER_USAGE`: the storefront image had
been built while products were still drafts, but the route needed on-demand
rendering for newly published products. In isolated clean commit
`492202fe6e169fbdd771c86322b915cadec386ed`, the product route now
declares `dynamic = "force-dynamic"`. TypeScript and focused lint passed. The
checksum-guarded preview-only rebuild exited 0 with
`OWNER_PREVIEW_PRODUCT_PAGES_VERIFIED samples=2 backend_private=1
storefront_private=1`; browser checks then loaded both the Seashell Hair Claw
and Wildflower Welcome Sign detail pages. Their selection/purchase buttons
were disabled; selecting the CREAM hair-claw variant showed a disabled
`Out of stock` button. The homepage still
showed four category cards and Best Sellers. An unauthenticated request to
`preview.rustichalo.com/us` still received HTTP 302 to the Cloudflare Access
owner login. Shopify public DNS was not changed.

This completes the protected opening-catalog preview milestone. Before public
launch, configure and verify production stock/availability, shipping,
checkout/payments, owner content review, and launch DNS in separate gated
milestones. The hair-claw imagery/color work is also separate; no photos or
variant images were invented in this release.

### Owner-preview inventory made explicitly unavailable — September 23

The owner approved a provisional initial quantity of zero for the protected
preview assortment. `deploy/production/owner-preview-zero-inventory.json`
pins the scope to the 27 published products and 108 variants in **Rustic Halo
Online — Production**, with `manageInventory: true`, `allowBackorder: false`,
and quantity zero. Its safeguards keep checkout, inventory synchronization,
Etsy writes, and public DNS unauthorized.

`deploy/production/run-owner-preview-zero-inventory.sh` checksum-verified the
reviewed script, manifest, approved opening export, and supplement on VM 104.
It first rechecked the private Access route and completed a fresh isolated
database restore test under
`/opt/rustic-halo-production/database-backups/20260923T163933Z`. It then
created missing zero-stock inventory records only. Any existing nonzero stock,
reservation, extra inventory location, catalog drift, production-channel drift,
provider enablement, or non-private binding would have stopped the release
without overwriting inventory. The guest-agent execution exited 0 with
`OWNER_PREVIEW_ZERO_INVENTORY_RELEASE_VERIFIED variants=108 quantity=0
checkout=off inventory_sync=off`.

The 27 product pages remain owner-only behind Cloudflare Access and are now
explicitly unavailable for purchase while still visible for content review.
An unauthenticated fresh browser session reached the owner-login challenge; no
Access code was requested or used. No public DNS, payment, shipping, email,
Etsy, staging, Market Suite, or inventory-synchronization change was made.

The reviewed `deploy/production/install-docker.sh` uses Docker's official
Debian 13 Apt repository, refuses to run outside VM 104 or over conflicting Docker packages,
and leaves `shawnhouse` outside the Docker group. It was copied to
`/home/shawnhouse/install-rustic-halo-docker.sh` on VM 104; local and guest
SHA-256 both match
`4088a62d60ca88ce20809f17858ac9cda98b4f35b200bf1b5b8c66735db1e135`.
After owner approval, it ran through VM 104's guest agent and exited 0.
A separate Mac SSH check confirmed Docker Engine 29.8.1, Compose 5.5.1,
Docker active and enabled, `shawnhouse` outside the Docker group, and only
SSH listening on host TCP ports at that pre-deployment checkpoint.

Proxmox VM 104 (`rustic-halo-production`) has been created on `pve-0`, separate
from staging VM 102 and restore-test VM 103. Debian 13 has been installed and
the guest booted successfully. Docker and the private backend are installed.
The VM has a 200 GiB `ssd` disk, 4 vCPUs, 8 GiB RAM, QEMU Guest Agent
enabled, and VirtIO
networking on `vmbr0` tagged VLAN 69 with its firewall flag enabled. Start at
boot is off. The Proxmox task `VM 104 - Create` completed `OK` and the saved
hardware/options were inspected. At creation, `ssd` reported 940.86 GB total
and 153.36 GB used; the 200 GiB disk is thin-provisioned, so monitor actual
capacity as data grows.

The scripts and Compose file were copied only to VM 104; their VM-side SHA-256
hashes matched the local files before execution. The guest's VLAN address and
UniFi reservation are verified. `pvesm status` showed `unas`
active on `pve-0`; the enabled 21:00 Proxmox backup job targets `unas` with
`all: 1`, and `pvesm list unas --content backup --vmid 104` showed a VM 104
backup archive dated September 22. That archive has not been restore-tested.
A VM snapshot alone is not a full application backup.

The staging guest was freshly checked read-only over its existing SSH control
socket: its 157 GiB filesystem has 110 GiB used and 41 GiB available; it has
4 vCPUs and 8 GiB RAM. The used space includes build/runtime artifacts and is
not a production database size estimate. Do not copy staging's disk contents
to the new VM.

## Protected application release after infrastructure

Build from a reviewed, pinned Git commit, not this working tree: it contains
uncommitted hair-claw module experiments. Configure production-only backend,
storefront, database, Redis, R2, and tunnel credentials outside Git. Keep the
Medusa Admin private; the protected temporary storefront hostname may be
used for testing while the current website stays on Shopify. A production
Tunnel must be separate from staging's Tunnel and must not route Proxmox,
PostgreSQL, Redis, SSH, or Admin publicly.

The current backend only registers the Stripe and Shippo providers behind
their **test** enable flags, and the current Stripe Tax provider is a test
pilot. Running infrastructure or a protected storefront is not permission to
take live orders. Before enabling checkout, complete the Gate 3 live provider,
tax, shipping, webhook, email, and restore checks in
`docs/production-launch-plan.md`. Keep Etsy writes and Market Suite inventory
synchronization disabled.

## Current access and verification

The Proxmox host at `10.20.42.10` was network-reachable from this task, but
the existing `root` and `shawnhouse` SSH attempts did not authenticate. The
signed-in Safari Proxmox session was used to create and inspect VM 104. The
new VM was started and Debian 13 installed with English, United States,
American keyboard, DHCP, Eastern time, and hostname `rustic-halo-production`.
The installer was configured for a disabled direct root login and created
`shawnhouse` with a password
entered privately by the owner, and formatted only VM 104's new virtual disk
with an ext4 root and swap partition. It installed SSH server and standard
system utilities without a desktop environment, then installed GRUB to the
VM's `/dev/sda` and rebooted successfully. The owner logged into the guest as
`shawnhouse`; `systemctl is-active ssh` returned `active`. `ip -br addr` and
`ip route` showed `ens18` up with DHCP address `10.20.69.220/24` and a default
route via `10.20.69.1`; `/etc/network/interfaces` configures `ens18` for DHCP.
The earlier `hostname -i` returned loopback because it looked up the hostname,
not because the NIC was unconfigured. Initially `id -nG` returned
only `shawnhouse`, and `command -v sudo` found no sudo program. The owner
approved installing `sudo` and adding `shawnhouse` to the sudo group. Proxmox's
working QEMU Guest Agent ran both commands inside **VM 104** as root, avoiding
installer recovery. `apt-get update` and `apt-get install -y sudo` each exited
0; `usermod -aG sudo shawnhouse` exited 0. A fresh `id shawnhouse` and
`getent group sudo` both showed `shawnhouse` in the sudo group. The owner
approved authorizing a dedicated Mac SSH public key on VM 104. The key was
installed in `shawnhouse`'s `authorized_keys` with mode 600, and a fresh
passwordless SSH login from the Mac succeeded using that key. The login
reported hostname `rustic-halo-production`, `shawnhouse` in the `sudo` group,
`/usr/bin/sudo` present, and `ssh` active. Sudo still requires the guest
password; an interactive sudo invocation has not yet been tested. The root
lock state has not yet been independently verified.

The previously attached installer ISO lived on unavailable `unas` storage,
which blocked VM startup during recovery. Only VM 104's CD drive was set to
no media, and its boot order was restored to the `scsi0` system disk alone.
Proxmox reported the next VM 104 start `OK`, and the guest booted to Debian
login. The guest uses DHCP with the address reserved in UniFi. The
dedicated Mac SSH private key is at `~/.ssh/rustic-halo-production` and stays
on the Mac.

A fresh SSH host-readiness check showed `ens18` still using
`10.20.69.220/24` by DHCP, 188 GiB for the root filesystem with 178 GiB
available, and no Docker or Compose executable installed. The guest NIC is
`bc:24:11:01:2f:cc`; its SSH directory and `authorized_keys` have mode 700
and 600 respectively and belong to `shawnhouse`. UniFi's client list matches
`rustic-halo-production` at `10.20.69.220` on VLAN 69. With the owner's
approval, UniFi's **Fixed IP Address** setting was saved as `10.20.69.220`
for this VM's client record. Closing and reopening the settings showed the
setting still enabled with the same address. A fresh Mac SSH connection
confirmed the VM remained reachable at that address with its DHCP default
route through `10.20.69.1`.

The database, Redis, private backend, and protected production storefront now
run on VM 104. Only `preview.rustichalo.com` received a new Cloudflare DNS
record, behind Access; the live apex/www records were not changed. No secret
was copied from staging. The four starter products remain drafts. The production
US sales channel has 27 owner-preview products / 108 variants, all with explicit
zero stock and backorders disabled. US-only storefront filtering must be
addressed before calling the store public-ready.
The unapproved working-tree hair-claw drafts remain excluded. Before taking
live orders, set up recurring database-aware backups with an off-VM copy,
test a restore that includes real application data, and complete the payment,
tax, shipping, email, and integration gates.
