# Rustic Halo staging

Local-network storefront review is documented in `docs/staging-lan-access.md`.
It publishes only the storefront on the VM's VLAN address; Admin, PostgreSQL,
and Redis remain private.

## Verified host

- Proxmox VM 102, `rustic-halo-staging`, on `pve-0`.
- Debian 13; 4 cores and 8 GB RAM.
- Local SSD disk; current guest address `10.20.69.159` assigned by DHCP on Services VLAN 69 after the serial-port restart on September 20. Earlier entries refer to its previous address.
- SSH works as `shawnhouse` using the dedicated ignored key in `.local/staging-access/`.
- Current local control connection: `/Users/shawnhouse/.ssh/rustic-halo.sock`.
  It is started from a local Mac Terminal with `ControlMaster=yes` and an
  eight-hour persist period; do not start it from a shell already logged into
  the VM. Reuse that socket for follow-up commands rather than opening fresh
  SSH sessions.
- Docker service is active; its hello-world container passed. Compose 2.26.1-4 is installed.
- PostgreSQL and Redis were started on September 19, 2026; both passed their
  container health checks. Compose showed no published host ports.
- SSH does not have passwordless sudo. Run administrator steps interactively.

## Infrastructure preparation

### VLAN 69 move — September 20, 2026

VM 102 net0 now uses `virtio=BC:24:11:87:9B:A3,bridge=vmbr0,firewall=1,tag=69`.
The guest remains DHCP on `ens18`, with gateway `10.20.69.1`.
Proxmox management remains at `10.20.42.10`; VM 103 remains stopped and isolated.
SSH and guest storefront/backend health checks passed after the move. The
initial VLAN-69 forwarding session used `/tmp/rustic-halo-staging-vlan69.sock`
and `shawnhouse@10.20.69.160`; that session is obsolete after the DHCP address
change. The current connection details are recorded above. The historical
connection used `HostKeyAlias=10.20.42.160` with strict host-key checking to
verify the existing saved VM identity.
Older entries below referencing `10.20.42.160` describe pre-migration history.
Rollback, if required: remove only net0's VLAN tag and renew guest DHCP.

`deploy/staging/compose.yaml` defines PostgreSQL 17 (matching the local major version)
and Redis 7.4. Both have named persistent volumes, restart policies, bounded logs,
and health checks. Neither publishes a host port. Keep the same Compose project
name when adding application services so they can reach `postgres` and `redis`.

The server copy lives in `/home/shawnhouse/rustic-halo-staging`.
Its `.env` contains a separately generated staging database password, mode 600.
Never commit or print this file. To start the prepared infrastructure on the VM:

```sh
sh /home/shawnhouse/rustic-halo-staging/start-infrastructure.sh
```

Enter the Debian password when sudo asks. Startup waits for both health checks.
Do not run `docker compose down -v`: that removes the database volumes.

## Verified application deployment

- Source and test-only settings have been transferred; the local test database
  was imported successfully into the previously empty staging database.
- Medusa backend, admin, and storefront production builds passed. Migrations
  completed. Backend health returns `OK`; all four containers are running.
- The Compose backend command explicitly points to the workspace executable.
  Migrations run as root in a disposable container because Medusa creates
  migration directories inside dependencies; the running application uses `node`.
- The PostgreSQL URL uses `sslmode=disable` only for the private Docker network;
  the database container has no host port. Medusa otherwise assumes remote TLS.
- SSH temporarily timed out, then recovered without a configuration change.
  Cause remains unconfirmed. The guest gateway and Mac ping tests succeeded.
- Shipping now supports the explicit staging database and environment-based
  test settings. Two environment-guard tests and nine packing tests passed;
  storefront type checking passed.
- The staging API returns five pilot products. Browser checks passed for the
  homepage, product page, adding one earring to cart, the $15 cart total, and
  US-only checkout address selection.
- A subsequent staging API checkout test completed order
  `order_01M2Y6MBRBW14RDE9T1ZNPBDKH` (display number 7): one $15 earring,
  $5.27 Shippo TEST shipping, $20.27 total. Stripe `livemode` was verified false,
  the amount/currency matched, and `pm_card_visa` succeeded. Medusa completed
  the order and its confirmation page displayed the matching paid total.
  Automatic store email remained disabled. No shipping label was purchased.
  This validates synchronous API payment completion, not Stripe Elements,
  3DS/redirect behavior, or delivery of asynchronous webhooks to staging.
- Follow-up decline test: Stripe returned `card_declined`; the payment intent
  remained `requires_payment_method`. Medusa rejected completion with HTTP 400,
  and the cart remained incomplete. This was an API test, not a browser error-message test.
- Follow-up webhook test: the Stripe CLI listener forwarded
  `payment_intent.succeeded` event `evt_3UHZYGEMgbttdK3X0FdHr6H3` to
  `http://127.0.0.1:19000/hooks/payment/stripe_stripe`; staging returned HTTP 200.
  The signing secrets were compared privately and matched. Test order
  `order_01M2Y6VE5TFQFJYW20434VGRTW` completed at $20.27.
  The temporary listener runs on the Mac and depends on the staging SSH tunnel;
  this is not a persistent production webhook endpoint. Downstream webhook-only
  order completion and duplicate-event handling remain separate tests.

## Before publishing

- Configure Redis-backed event, workflow, and locking providers for production;
  this staging deployment still uses the existing shared-process providers.
- Keep Stripe and Shippo in test mode and automatic email delivery disabled.
- Add persistent uploaded-file storage before testing uploads; current product
  images use external URLs. Test Stripe Elements, declines/3DS, and webhook
  delivery separately before launch. Tax is not configured; this test showed $0.
- Verify this VM is included in the NAS backup job, add database-aware backups,
  and test a restore before publishing.
- Reserve the DHCP address before relying on it in service configuration.

`deploy-apps.sh` imports only into an empty database and records a marker before
building, migrating, and starting the applications. On a failed import, inspect
the database manually; it deliberately refuses to overwrite a partial import.
The runtime files `backend.env`, `.env`, `catalog.dump`, and `deployment.log`
stay private on the VM. Automatic email is disabled; only test payment and
shipping credentials were copied.

Application ports bind only to VM loopback. After deployment, run
`sh scripts/staging-tunnel.sh` on the Mac to access the storefront at
`http://localhost:18000` and backend at `http://localhost:19000`. This avoids
public or LAN exposure and preserves secure-cookie behavior on localhost.
The local development site on port 8000 is separate.

The staging application is running privately. No public endpoint has been deployed.

References: [Medusa deployment](https://docs.medusajs.com/learn/deployment/general)
and [Compose health checks](https://docs.docker.com/compose/how-tos/startup-order/).

### NC tax pilot — 2026-09-19

Owner confirmed sales-tax registration in North Carolina only and approved Stripe Tax testing. Stripe test settings now use the supplied Grimesland business address, exclusive tax, generic tangible goods (`txcd_99999999`), and an active NC state-sales-tax test registration. No live registration or live tax setting was changed.

Direct Stripe test calculation: $15 goods + $5.27 shipping to Grimesland yields $1.42 tax ($0.37 shipping tax), total $21.69. Virginia control returns zero with `not_collecting`.

A gated `STRIPE_TAX_TEST_ENABLED` Medusa provider obtains the NC destination rate from Stripe and applies it to Medusa item/shipping tax lines. It rejects live keys and fails closed on missing NC address, API failure, or missing registration. Six focused unit tests and backend TypeScript checks pass. Backend compilation passed; the local admin build hit sandbox port-binding EPERM. Staging build will validate the complete image.

This is a **rate-calculation pilot, not a complete Stripe Tax reporting integration**. Before live use, replace the rate probe with actual discounted cart calculations, record/reconcile tax transactions and refund reversals, verify rounding, classifications/exemptions and address changes, and test checkout end to end. Do not enable with a live key.

Prepared on VM: `/home/shawnhouse/rustic-halo-staging/deploy-tax-test.sh`; requires sudo to build/restart the backend and select the provider. Deployment and checkout verification are pending. Existing completed orders retain their original zero tax.

Deployment follow-up: excluded macOS AppleDouble files (`**/._*`) from Docker context after those metadata files caused lint parsing errors. Retried deployment via VM console; `tax-deployment.log` visibly reports backend/postgres/redis healthy and `TAX_TEST_DEPLOYMENT_COMPLETE`. The NC-only test provider is deployed. Checkout verification remains blocked by renewed Mac-to-VM SSH timeouts and the unavailable localhost tunnel; do not describe end-to-end tax testing as passed. Prepared `.local/staging-deploy/check-tax.py` checks NC item/shipping tax and clearing/restoring tax when the shipping state changes. Live tax/reporting remains disabled/incomplete as above.

Tax follow-up: initial deployed checkout returned $0 because the commerce region retained `automatic_taxes: false`. Updated the repository setup script to enable it for the US commerce region. Applied equivalent guarded `enable-tax.js` on the running staging backend; VM console verified `NC_TEST_AUTOMATIC_TAX_ENABLED` and successful script completion. The script uses `exports.default` (Medusa exec requires a default export). Repeated SSH timeouts again terminated the preview tunnel, preventing post-fix checkout validation. Next: restore tunnel, run `.local/staging-deploy/check-tax.py`, fix any errors, then verify UI. The test assertion now correctly uses cart subtotal, which already includes shipping. Sync the updated setup script into staging source on the next successful connection.

Post-fix verification PASSED: staging checkout for the Grimesland address returns $15 goods + $5.27 shipping, item tax $1.05 and shipping tax $0.3689 (Medusa internal precision), aggregate tax $1.4189 and total $21.6889. Stripe test PaymentIntent receives exactly 2169 USD cents ($21.69), `livemode=false`. Switching that cart to Virginia clears tax to zero; switching back to NC restores $1.4189. No charge was confirmed in this test. Updated setup script synced into staging source. This verifies the rate pilot and payment-session rounding, not tax transaction/refund reporting or live readiness. Preview tunnel restarted successfully.

### Stripe Tax reporting helper sandbox validation

Added `apps/backend/src/lib/tax/test-reporting.ts`: test-key-only actual-item calculation, exact cent reconciliation against expected collected totals before recording, stable idempotency keys, and full reversal referencing the original tax transaction. Five unit checks and TypeScript validation pass. A synthetic $15 + $5.27 shipping record produced a $1.42 tax/$21.69 total transaction in the Stripe sandbox, followed by its full tax reversal. Replaying both operations returned the same IDs (no duplicate records). No payment was charged/refunded in this reporting smoke test. Private evidence: `.local/staging-deploy/tax-reporting-smoke.json` and runner `test-tax-reporting.ts`.

NOT yet wired to order/payment/refund events or deployed to staging. Before wiring: persist the tax calculation/transaction and refund IDs durably with the original order snapshot, confirm successful capture/refund before reporting, reconcile rounding/discounts, handle partial refunds by actual allocation, and add recovery for failures beyond Stripe's idempotency retention. The helper alone is not automated reporting, filing, or live readiness.

### Automatic tax reporting handlers prepared

Added `src/subscribers/stripe-tax-test-reporting.ts` for `order.placed`, `payment.captured`, and `payment.refunded`. Gated separately with `STRIPE_TAX_REPORTING_TEST_ENABLED=true`, isolated test DB guard, and test Stripe key. `src/lib/tax/sync-order.ts` verifies successful captured payment directly with Stripe, saves the immutable original sale snapshot and transaction/reversal IDs in order metadata under a per-order lock, and preserves unrelated metadata. Uncertain attempts older than 23 hours require manual reconciliation rather than risking a duplicate after idempotency expiry. Full refunds are verified against Stripe before reversal. Partial refunds deliberately error for allocation review; they are not automatically reported. Direct Stripe-dashboard refunds do not emit Medusa events, so still need a reconciliation mechanism. Single-backend staging only (local lock/event providers).

11 reporting/synchronization unit tests and TypeScript checks passed. Files uploaded into staging source; prepared `deploy-tax-reporting-test.sh` builds backend, enables the test reporting flag, and restarts it. Console command has been entered and is awaiting the user's sudo password. No automatic event integration test has run yet. After deployment, complete a new tax-bearing test order, inspect persisted metadata/Stripe report, then perform a full Medusa test refund and inspect reversal; verify event relation traversal and retry behavior against the real services.

### Automatic order/full-refund verification PASSED

Completed sandbox order `order_01M2Y9RTBFA1CCRF2Q8RKDSTVK` at $21.69 charged ($1.42 tax). The order.placed handler automatically saved its original amount snapshot, calculation `taxcalc_1UHaLfEMgbttdK3X9Y8GpU3f`, and transaction `tax_1UHaLfEMgbttdK3Xsccnvziv` in backend order metadata. Store order API omits this metadata, so verified using a server-side query; missing store metadata was not a reporting failure. Payment captured event also processed without duplicate errors.

Issued the full sandbox refund through Medusa `refundPaymentWorkflow` for this specific test payment, guarded by test key, staging environment, exact PaymentIntent match, and existing tax transaction. The loaded payment.refunded subscriber automatically saved a reversal ID. VM console `tax-refund-test.log` showed `AUTOMATIC_TAX_REFUND_VERIFIED` and successful script completion. This was a real test-mode payment/refund lifecycle, not real funds. Evidence scripts remain under `.local/staging-deploy/` and on staging; no customer email delivery enabled.

Remaining launch boundaries: partial refund allocation, direct-dashboard refund reconciliation, durable event/lock infrastructure, retry/manual reconciliation tooling, and live configuration. Full-refund verification ran through the Medusa workflow in a CLI process with subscribers loaded; browser admin refund UI was not tested. SSH remains intermittently unreliable, so final verification used the VM console.

### Partial-refund code and direct Stripe sandbox validation

Added refund-by-refund reporting for amount-based refunds of the current uniformly taxable catalog. Uses Stripe `flat_amount` (negative tax-inclusive cents) and each actual succeeded Stripe refund ID as its stable reference, reconciles the paginated succeeded-refund total against the charge, stores per-refund attempt/record IDs, and handles a later remaining-balance refund without issuing a second full reversal. Existing full-refund records remain compatible. Pending/failed or mismatched refunds are not reported. This is proportional amount-based allocation, not item-specific return allocation for mixed tax classifications.

14 unit tests and TypeScript checks passed. Direct Stripe sandbox smoke: $5 partial reversal followed by $16.69 remainder reverses exactly $20.27 net plus $1.42 tax = $21.69; repeating first reversal returns the same record ID. Evidence `.local/staging-deploy/tax-partial-reporting-smoke.json` and runner `test-tax-partial-reporting.ts`. No payment/refund funds moved in this synthetic reporting test.

Staging upload failed due to SSH timeout. The running VM still has the previously verified full-refund-only implementation. Next: upload `/tmp/rh-partial-tax.tgz`, extract under staging source, run existing `deploy-tax-reporting-test.sh`, then run a new completed-order/partial-refund workflow test. Partial refund event integration is NOT yet verified on staging.

Connection diagnosis during partial-refund deployment retry: Mac route to 10.20.42.160 is via 192.168.1.1/en0. Three ICMP replies were around 4ms; Proxmox 10.20.42.10:8006 TCP connected immediately, while VM port 22 timed out. Guest SSH journal shows earlier successful sessions and an authentication timeout, no clear service failure. A bounded 15-second guest tcpdump on ens18/port22 captured an outbound SYN-ACK from 10.20.42.160:22 to 192.168.1.152, but the probe did not establish SSH. This suggests a connection-path/return-traffic issue but does not establish the cause; no firewall or network settings changed. Partial-refund upload/deployment remains blocked. Next investigate UniFi inter-network routing/security and IP uniqueness rather than repeatedly rebuilding or changing the app.

### Persistent connection and partial-refund deployment

UniFi flow details identified intrusion-prevention signature 2003068, ET SCAN Potential SSH Scan OUTBOUND, blocking Mac 192.168.1.152 to staging. Detection exclusions UI offered IP-wide exclusions; cancelled without changing protections. Established SSH ControlMaster at /tmp/rustic-halo-staging-ssh.sock with 30-minute ControlPersist and keepalives. Multiple commands and file transfer succeeded over this single connection. Restored localhost 18000/19000 forwarding; storefront returned HTTP 200. This is a successful workaround, not a permanent network-fix claim.

Uploaded and extracted /tmp/rh-partial-tax.tgz into staging source. Ran existing deploy-tax-reporting-test.sh through the VM console. Backend and frontend builds passed; postgres, redis, backend healthy and TAX_REPORTING_TEST_DEPLOYED verified in deployment log. Partial-refund implementation is now deployed in test mode. New-order partial-refund event lifecycle verification remains pending; earlier synthetic validation does not substitute for it.

### Automatic partial-refund lifecycle verified

New sandbox order order_01M2YB2HCRQKX9AJ90EWDCQ0AT charged 2169 cents including 142 cents tax. NC/VA/NC address checks passed. Ran Medusa refund workflow for $5, verified the automatic 500-cent reversal was saved, then refunded the remaining Medusa amount (16.6889 internally, Stripe 1669 cents). Both payment.refunded events produced separate saved reversals. Read-only Stripe reconciliation of expanded line items plus shipping verified exactly -2169 total and -142 tax across two reversals, with no extra full-reversal record. AUTOMATIC_PARTIAL_TAX_REFUNDS_VERIFIED logged on staging.

The initial verification script incorrectly read aggregate fields absent from Tax Transaction responses; corrected verification to sum line_items and shipping_cost, without issuing any additional refunds. This was a verifier issue, not a refund/reporting defect. Private partial-test.js is now read-only reconciliation. Test used Medusa workflow CLI with subscribers loaded, not admin UI; no real funds or customer email. Remaining live-readiness boundaries include durable event/locking infrastructure, direct-dashboard refund reconciliation, recovery tooling, actual-cart tax calculations and classifications.

### Redis-backed background processing deployed and restart-tested

Enabled PERSISTENT_JOBS_ENABLED for staging: Redis Event Bus, Redis Workflow Engine, and default Redis Locking provider. Local development remains opt-in; enabling without REDIS_URL fails configuration. Event jobs get five attempts with exponential 5-second backoff, bounded completed-job retention (1 day/1000) and failed-job retention (7 days/1000). Existing Redis AOF and persistent volume remain in use. TypeScript and staging image builds passed; deployment healthy.

Queued delayed order.placed replay for already-refunded sandbox order order_01M2YB2HCRQKX9AJ90EWDCQ0AT with customer emails explicitly disabled. Restarted Redis and backend before the 60-second delay expired. Backend logs confirm all three Redis providers connected and processed order.placed after restart (02:50:18 UTC). Redis completed set contains staging-restart-tax-check-1, returnvalue [null,null], and no failedReason. Both subscribers completed successfully. Initial inspection used BullMQ's generic prefix; corrected to installed provider prefix RedisEventBusService. No new payments/refunds were created by this replay.

This validates graceful Redis/backend restart persistence of a delayed event, not abrupt power-loss guarantees or interrupted workflow recovery. Failed-job monitoring/manual recovery, direct-dashboard refund reconciliation, and live-readiness work remain.

### Background-event status and targeted recovery

Installed deploy/staging/background-jobs.cjs and background-jobs.sh on VM. Run from deployment directory with administrator privileges: `sudo sh background-jobs.sh status`. Reports counts and up to 50 failed job IDs/event names/attempt counts/timestamps; never prints payloads, credentials, or potentially sensitive raw exception text. Exit 0 healthy, 2 failed jobs present, 1 check/configuration error. On-demand only: no scheduled monitor or external notifications configured.

After reviewing the failure and correcting its cause, `sudo sh background-jobs.sh retry JOB_ID` requeues exactly one failed order.placed/payment.captured/payment.refunded job. Rejects completed jobs, missing IDs, and unsupported event types. This replays subscribers, not the original payment or refund workflow; still review subscriber idempotency and external Stripe state first. Tax attempts older than 23 hours require manual reconciliation, not blind retry. No queue purges or automatic bulk retries. Failed jobs expire after the configured 7-day/1000-job retention, so this is not an audit archive.

Verified staging status: zero failed/waiting/active/delayed, one completed event. Five local tests passed covering failed status, exact retry, completed-job rejection, unsupported-event rejection, and required ID. No actual failed commerce job was retried in this validation. Redis event queue only; workflow-engine failures and external-provider reconciliation are separate checks.

### Read-only sandbox refund reconciliation

Added src/scripts/reconcile-tax-test.ts with src/lib/tax/reconcile.ts. Accepts 1–20 exact order IDs and reads Stripe PaymentIntents only; compares confirmed refund amounts to saved tax reversal references. Flags missing sales, unreported refund differences, inconsistent totals, overreporting, and conflicting full/partial records. Test database and sk_test key required. Outputs IDs and amounts, no customer payloads or credentials. Does not repair records, issue refunds, or independently validate the tax-ledger contents behind the saved references. Untaxed orders without reporting metadata are explicitly out of scope.

Six helper tests and backend typecheck passed. Compiled scripts copied into running staging container for execution, and TypeScript sources saved in staging build source (full image rebuild not performed). Checked both existing full/partial refunded sandbox orders: each shows 2169 cents refunded and 2169 cents recorded, zero difference; summary 2 checked, 0 discrepancies. Missing-refund scenario verified with unit tests, not by issuing a new dashboard refund. No new funds or tax records changed.

Run after a normal backend build with `medusa exec ./src/scripts/reconcile-tax-test.js ORDER_ID [ORDER_ID ...]`. This is an on-demand report, not an automatic all-order scan or repair mechanism. Next implement bounded discovery of candidate orders and reviewed recovery, keeping expired idempotency attempts manual.

### Bounded recent-order discovery verified

`reconcile-tax-test.js recent [offset]` now discovers up to 100 newest orders per run, querying 101 IDs to detect continuation. Stable created_at/id descending ordering; explicit nextOffset/truncated output. Explicit 1–20 order-ID mode remains supported. Offset pagination is a bounded operational tool, not a snapshot: new orders between pages can shift results; use exact IDs for follow-up and do not interpret one batch as all-history coverage when truncated.

Nine tests passed (including boundary/continuation/empty page/invalid offset). Copied compiled script into running staging and saved source for future builds. Read-only staging scan found seven orders: two tax-bearing orders matched refunded amounts, five historical zero-tax orders were explicitly skipped, zero discrepancies, no remaining page. No refunds or tax records changed. This is automatic discovery on invocation, not a new recurring scan. Existing Codex heartbeat still checks background jobs only.

### Reviewed single-order tax recovery command

Added `medusa exec ./src/scripts/recover-tax-test.js ORDER_ID reviewed`. Requires isolated test database, test Stripe key, enabled test reporting, and one exact order ID plus explicit reviewed marker. Delegates to the existing locked/idempotent sync handler; does not issue payments or refunds. Review reconciliation plus Stripe tax records before invoking, especially missing transaction IDs or expired uncertain attempts. Handler completion must be followed by read-only reconciliation; it is not itself proof that a discrepancy was repaired.

Four guard tests and backend typecheck passed. Uploaded compiled script to staging container and source for future builds. Invoked against already-reconciled partial-refund sandbox order order_01M2YB2HCRQKX9AJ90EWDCQ0AT; command completed and follow-up comparison still returned 2169 cents refunded/recorded, zero discrepancy. This verifies the already-reconciled recovery path, not repair of an injected missing record or a fresh dashboard refund. No automatic/bulk recovery enabled.

### External-refund detection and recovery end-to-end

Created sandbox order order_01M2YD7W9XQZA7GXTEDD9Z7R7R, paid 2169 cents including 142 cents tax. Refunded all 2169 cents directly through the Stripe sandbox API (outside the Medusa workflow), simulating the reporting gap from an external/dashboard refund. Report correctly returned unreported_refund, Stripe 2169 versus recorded 0. Ran reviewed single-order tax recovery. Direct Stripe Tax ledger inspection verified -2027 net, -142 tax, -2169 total. Replaying sync retained the same reversal ID. EXTERNAL_REFUND_RECOVERY_VERIFIED logged. No real funds or customer emails.

This validates an API-origin external refund, not browser dashboard UI. Recovery repairs tax reporting only; it does not import an external refund into Medusa payment/refund records or change the order's internal payment status. That separate commerce-state reconciliation remains open. Automated discovery is on-demand and repair remains manual.

### External refund commerce-state gap identified

Inspected installed Medusa 2.21 payment service: public refundPayment always invokes refundPaymentFromProvider_ after creating its internal record; no skip-provider option was found in its public DTO. Do not use that workflow to import already-issued Stripe refunds or patch private services/database rows casually.

Extended local reconciliation source to compare Medusa refund amounts separately against Stripe, so matching tax reversal amounts no longer imply matching store refund state. Compares aggregate decimal currency amounts at Stripe cent precision (e.g. 5 + 16.6889 -> 2169 cents); invalid amounts fail review. Twelve reconciliation/discovery tests passed. Updated comparison not yet copied into running staging container. External sandbox order remains intentionally unsynchronized in Medusa; its Stripe refund and tax reversal are correct. Next: establish a supported provider-aware import design before any commerce-state mutation. For normal operations, originate refunds in Medusa so its existing workflow tracks them.

### Store-refund mismatch check deployed and verified

Copied updated reconciliation helper/script into running staging container and saved TypeScript sources for future image builds. Recent scan examined eight orders: external-refund test order order_01M2YD7W9XQZA7GXTEDD9Z7R7R correctly shows matching tax records but store_refund_mismatch (Medusa 0, Stripe 2169 cents). Both Medusa-origin refund orders match in both comparisons. Five legacy zero-tax orders skipped. Summary reports exactly one expected discrepancy and exits with review-required error; this is the deliberately created test mismatch, not a new refund or outage. No records changed. Automatic commerce-state import remains unsupported/unimplemented.

### Logical database restore drill passed

Added deploy/staging/test-database-restore.sh. Creates restricted timestamped custom-format pg_dump and SHA256 file in the staging VM deployment directory, restores with pg_restore --exit-on-error into a disposable PostgreSQL 17 container with --network none and no published ports, and removes only that temporary container and its anonymous volume afterward. The original database is read for backup only. Backup remains restricted on the VM; no independent off-host copy or retention schedule added.

Executed successfully: DATABASE_RESTORE_VERIFIED, backup database-backups/20260920T032744Z/staging.dump. Restored database queries returned 8 orders, 9 products, and 8 payments. This validates logical dump restoration and those table queries, not full VM/NAS restore, application operation against the restored database, uploads, environment secrets, or interrupted Redis jobs. Full disaster-recovery drill and backup retention review remain outstanding.

### Full VM restore preparation

Reverified VM 102 NAS backup through Proxmox: unas, vzdump-qemu-102-2026_09_19-21_01_27.vma.zst, 1.74 GB. It predates the later changes. Added docs/restore-test.md for an isolated new-ID restore with networking disconnected before boot. Target storage free space and unused cluster-wide VM ID not yet verified. Safari backup toolbar controls are absent from AX and coordinate clicks fail noWindowsAvailable; restore not initiated. No original VM or backup changed.

### Fresh NAS VM backup succeeded

After the owner opened Backup now, started VM 102 snapshot backup to unas using ZSTD. Proxmox task status verified stopped: OK, start 2026-09-19 23:31:44, duration 2m 26.9s. Archive path shown: /mnt/pve/unas/dump/vzdump-qemu-102-2026_09_19-23_31_44.vma.zst. Source VM remained running. Log notes guest filesystem freeze disabled; this does not replace the separately verified logical database backup. New archive has not yet been restore-tested. Next: confirm spare storage/unused VM ID and restore with auto-start off, then disconnect networking before boot.

### Full NAS archive restore and isolated boot verified

Restored fresh 23:31:44 unas archive (3.90 GiB) into NEW VM 103 rustic-halo-restore-test on pve-0 SSD. Restore task 23:41:47–23:43:53 returned TASK OK. Separate 80 GiB disk vm-103-disk-0 created; Unique enabled and automatic start/HA disabled. Before first boot verified sole net0 adapter link_down=1 and Start at boot No. Started VM103 successfully and observed Debian13 console login. Original VM102 remains running. Owner password needed at VM103 console to inspect recovered services/data; those checks and final shutdown remain pending. Keep clone disconnected. No original VM, backup, or integration records deleted.

### Isolated restore application checks completed

Owner logged into VM103. Four restored containers running; backend/PostgreSQL/Redis healthy. Saved database restore script completed on clone: 8 orders, 9 products, 8 payments, DATABASE_RESTORE_VERIFIED. Local storefront /us port18000 and backend /health port19000 each returned HTTP200 through wget. No external integrations exercised. VM103 shut down and Proxmox stopped controls verified; retained disconnected with automatic boot off. Source VM102 was not modified by these clone checks. See docs/restore-test.md for scope and limits.

### Actual-cart tax comparison prepared locally

Inspected installed Medusa2.21 get-item-tax-lines step: provider receives undiscounted unit prices and separate item/shipping calls. Replacing only the fixed probe would not handle cart discounts correctly. Added lib/tax/cart-calculation.ts and scripts/compare-cart-tax-test.ts CART_ID. Reads discounted extended totals minus tax, includes shipping, requests a Stripe sandbox calculation, and compares rounded tax/total cents. No cart, payment, or reportable tax transaction writes. Logs only IDs and amounts. Twelve unit tests passed. Existing provider unchanged; helper not deployed or exercised against staging. Generic physical-goods classification and NC/USD/exclusive-only scope remain explicit limitations. Next validate representative real sandbox carts, then integrate authoritative totals through a supported cart workflow with pre-payment reconciliation.

### Actual-cart sandbox comparison verified

Owner specifically approved sending configured business address and unpaid cart data to Stripe sandbox and Shippo test shipping. Ran the local comparison helper against VM102 Store API through localhost19000. Three new unpaid carts (SKU38425, quantities1/2/3) with test shipping matched Stripe tax/total cents exactly: 142/2169, 247/3774, 352/5379. Synthetic 10-percent item-discount fixtures based on those carts also matched: 131/2008, 226/3453, 320/4897. Discount fixtures did not apply a Medusa promotion and are not proof of promotion workflow integration. Results in ignored .local/staging-deploy/cart-comparison-results.json. No payment collections, completed orders, reportable tax transactions, or labels created by this runner. Initial runner attempts failed because the environment-name parser omitted STREET1 and the default cart response omitted item totals; fixed parser, added address presence guard, and explicitly requested totals. Early failed attempts may leave unpaid test carts. Comparison code remains local, not deployed into checkout. Next verify actual Medusa promotions and multiple distinct lines, then implement authoritative checkout integration and rounding reconciliation.

### Real Medusa promotion tax comparison passed

Ran test-cart-promotion-tax.js on explicit unpaid staging cart cart_01M2YFT0PKW88MSR56DGBBP0DZ (three units of SKU38425), via VM102 console after owner sudo authentication. Used supported createPromotionsWorkflow and updateCartPromotionsWorkflow. Real 10-percent item promotion matched Stripe sandbox: tax320 cents, total4897 cents. Real free-shipping promotion matched: tax315 cents, total4815 cents. Both temporary promotions deactivated; removal recalculated cart back to original totals, verified cartRestored=true and mismatches=0. Script finished 2026-09-20 04:10:03 UTC. No order or payment created. Compiled comparison/helper scripts copied into running container; this is not a checkout provider replacement or full image deployment. Multiple distinct lines, fixed discounts, half-cent rounding boundaries, and authoritative checkout integration remain outstanding.

### Mixed-product and fixed-discount sandbox checks passed

Created unpaid mixed carts with one hair claw SKU38462-4 and one/two earrings SKU38425. Actual cart tax/total matched Stripe: 226/3453 cents and 331/5058 cents. Ran supported Medusa promotion workflows on second cart cart_01M2YG80F5CFSBSCZTD11MPXED: 10-percent item discount matched301/4608 cents; free shipping294/4494; one-dollar across-items discount324/4951. Temporary promotions inactive, cart restored, zero mismatches, finished2026-09-20 04:14:00UTC. Backend typecheck passed. No payments/orders created. Existing rate-probe provider unchanged; these checks do not establish all rounding-boundary behavior. Next integrate actual-cart verification into checkout before payment, and resolve any discovered rounding mismatches without silently changing charged amounts.

### Checkout tax preflight deployed — September 20, 2026

Built backend and storefront with `deploy-checkout-tax.sh`; console log showed
`CHECKOUT_TAX_DEPLOYMENT_COMPLETE`, backend/PostgreSQL/Redis healthy and storefront
started. The storefront cart page reloaded successfully afterward.
The Stripe payment button now requests a server-side tax comparison before
confirmation, with another validation hook on cart completion. This remains gated
by STRIPE_TAX_TEST_ENABLED and isolated test-environment checks; the existing rate
provider is unchanged. This is a mismatch guard, not authoritative tax replacement
or a guarantee against concurrent cart changes between validation and payment.

The deployed POST tax-validation endpoint returned 200/valid=true for existing
unpaid carts `cart_01M2YFT0PKW88MSR56DGBBP0DZ` and
`cart_01M2YG80F5CFSBSCZTD11MPXED`; a nonexistent cart returned 409. No payment or
order was created. Local 21 focused tests and backend/storefront type checks
passed. Actual browser payment-button execution and mismatch injection on staging
have not been tested. Administrator deployment logs remain restricted to root.

### Private HTTP admin sessions

The production Medusa runtime defaults to Secure session cookies. The private
HTTP SSH preview can therefore return to login without retaining a session.
Owner approved LOCAL_HTTP_ADMIN for staging on September 20, 2026. The config
permits this only with APP_ENV=staging and loopback HTTP admin/auth CORS origins;
cookies retain HttpOnly and SameSite=Lax. Compose still binds backend/admin to
127.0.0.1:19000. Remove LOCAL_HTTP_ADMIN when moving to public HTTPS hosting.
A CORS check does not enforce listener isolation; preserve those loopback binds.
Deployment script is prepared on the VM as deploy-admin-session.sh, with prior
config/compose backups and restricted admin-session-deployment.log. Deployment
and actual login verification are pending until recorded below.

Deployment verified: VM console reported ADMIN_SESSION_DEPLOYMENT_COMPLETE,
backend/PostgreSQL/Redis healthy, and backend still bound to 127.0.0.1:19000.
Admin login page reloaded successfully. Owner must retry sign-in to verify
session persistence; no password was read or entered by the assistant.

Payment-handler verification: added storefront tests that execute the production
Stripe payment-button handler with React/service boundaries replaced. They verify
that pending tax validation prevents Stripe confirmation, success permits the
confirmation call, and mismatch/outage rejection prevents both payment and order
calls while resetting the loading state. All 10 storefront tests passed, including
three new payment guard tests. These are local component-handler checks, not an
end-to-end browser charge test; no payment or order was created. Owner subsequently
reached the admin products page after the local HTTP session fix.

### External refund import audit — September 20, 2026

Inspected installed Medusa 2.21 payment-module service and refund workflow step.
The public refundPayment path creates a local refund, then unconditionally invokes
refundPaymentFromProvider_; that calls the payment provider with a new local refund
ID as its idempotency key. The workflow step delegates to this method. Therefore
replaying the normal refund workflow is not a record-only import of an existing
Stripe refund and must not be used to reconcile the deliberate external-refund
mismatch. No refund or database mutation was executed during this audit.

A supported external-refund import path has not been established. Keep normal
refunds in Medusa. If one was already issued in Stripe, use the read-only mismatch
report and investigate before any further refund action. A future importer needs
verified Stripe refund IDs/status/amount/currency, durable deduplication, concurrent
refund protection, payment-collection and order accounting updates, and tests
proving that no second provider refund request occurs. Direct SQL edits are not an
approved substitute. Reference: https://docs.medusajs.com/resources/commerce-modules/payment/payment-flow

### Customer password recovery prepared locally — September 20, 2026

Added customer forgot/reset password pages and server actions using Medusa SDK
resetPassword/updateProvider. Request responses do not disclose whether an account
exists. The reset form validates matching 12–128 character passwords; Medusa
validates and consumes the token. Reset page is noindex with no-referrer policy.
Added customer-only auth.password_reset subscriber and Resend template with encoded
trusted-config URLs and hashed-token idempotency keys. Admin reset events are not
handled by this customer-only subscriber. Tokens must never be logged or shared.

Delivery remains off. Backend requires both EMAIL_DELIVERY_ENABLED and
CUSTOMER_PASSWORD_RESET_ENABLED; storefront also needs the latter runtime flag.
CUSTOMER_PASSWORD_RESET_URL must be a full trusted reset page URL. HTTPS is required
except localhost/127.0.0.1 for SSH preview. Storefront request action displays an
unavailable message while disabled instead of claiming an email was sent.

Six new storefront action tests and seven email-template tests passed; all sixteen
storefront tests passed, as did backend/storefront type checks before test additions.
This is local implementation, not deployed or inbox-tested. Before activation:
add/verify shared rate limits for public auth reset requests, deploy both applications,
verify real token expiration/reuse behavior, and obtain owner approval for an inbox
test. Keep order email activation separate from a process-scoped delivery test.

### Password recovery request limits prepared — September 20, 2026

Added shared Redis request limits to POST /auth/customer/emailpass/reset-password:
three requests per normalized email and 100 total per 15-minute fixed window.
Atomic Lua counters use expiring keys and SHA-256 email identifiers; no forwarded
IP headers are trusted. Disabled recovery and unavailable Redis fail closed.
Added direct ioredis 5.11.1 dependency, with only three lockfile lines added.
Ten targeted email/limiter unit tests and backend type checking passed. Actual Lua
execution, middleware behavior on staging, and token lifecycle remain unverified.

Uploaded password-recovery-source.tgz (12 explicit source files, no environment
files) and deploy-password-recovery.sh into the staging directory using the existing
VLAN 69 SSH socket. They have NOT been executed. Remote sudo requires a password.
The helper backs up source privately, builds both images, then restarts backend and
storefront. Recovery flags remain off by default, and compose keeps email off.
Next: run `sudo sh /home/shawnhouse/rustic-halo-staging/deploy-password-recovery.sh`
on VM 102, then verify the deployment log and disabled reset page/endpoint before
any owner-approved email test. Safari control was interrupted by user activity;
no console command was entered.

### Password recovery deployed with delivery disabled — September 20, 2026

Owner entered VM sudo password. The prepared deployment completed; console log
showed PASSWORD_RECOVERY_DEPLOYMENT_COMPLETE, backend healthy, storefront started,
and PostgreSQL/Redis healthy. Fresh local-forward requests returned HTTP 200 for
/us/reset-password and HTTP 503 with the expected unavailable message for a
synthetic POST /auth/customer/emailpass/reset-password. Browser form submission
also showed the disabled-recovery contact message. No reset email or password
change occurred. Recovery remains disabled; real Redis-limit behavior and token
expiration/reuse validation plus an approved inbox test remain before activation.

Prepared test-password-recovery.ts and uploaded it with a sudo wrapper to staging.
The test uses a random example.invalid auth identity (no customer record), direct
auth token service calls (no workflow email event), and isolated Redis keys. It
checks concurrent rate limits, expiry, total cap, token replacement/account binding,
sequential reuse, expiration and concurrent reuse, then cleans its own fixtures.
Backend type checking passed. The test has NOT run: Safari control was interrupted
by user activity before the console command was entered. Next console command:
`sudo sh /home/shawnhouse/rustic-halo-staging/test-password-recovery.sh`.

### Staging reset-token concurrency finding and protection — September 20, 2026

The real Redis/database security test ran with delivery disabled. Rate-limit
concurrency/expiry/total cap, token replacement, binding, sequential reuse and
expiration passed. Eight simultaneous calls to Medusa 2.21's token-consumption
service all succeeded: its database read/delete sequence is not atomic under this
load. Recovery must remain disabled until protected.

Added reset-replay-guard.ts and customer emailpass update middleware. Redis SET NX
claims the hashed reset jti through token expiration plus 60 seconds (maximum
24-hour token lifetime); failures do not release it, and Redis outage fails closed.
Medusa still verifies token signature, purpose, actor and database association.
Six local guard tests and type checking passed. Repeated staging service test with
the guard passed all cases, including exactly one of eight concurrent attempts;
PASSWORD_RECOVERY_SECURITY_TEST_COMPLETE appeared and fixtures were cleaned.
This is service-level validation, not yet a signed-token HTTP/password-change test.

Uploaded and started deploy-reset-replay.sh to build/restart backend with the new
middleware. Completion remains to be checked. No email sent; recovery disabled.

Replay-protection deployment completed: fresh console tail showed
RESET_REPLAY_DEPLOYMENT_COMPLETE and backend healthy. Reset recovery remains off.
The next activation prerequisite is a signed-token HTTP test of the complete
password-update endpoint, followed by an owner-approved inbox test. Service-level
concurrency testing alone does not establish the full HTTP middleware ordering.

### Full signed-token HTTP reset test passed — September 20, 2026

Ran test-password-recovery-http.ts inside the staging backend against the actual
/auth/customer/emailpass/update endpoint. Used a random example.invalid auth
identity and random passwords, with no customer row or email event. Confirmed:
forged signatures, expired JWTs, session-purpose tokens, admin-actor tokens and
superseded links rejected; exactly one of eight concurrent updates returned 200;
remaining requests and subsequent reuse rejected; only the new password could
authenticate. The synthetic identity and its Redis claims were removed in finally.
Fresh console log showed PASSWORD_RECOVERY_HTTP_TEST_COMPLETE.

Initial test expected 401 for expired JWT but the replay middleware returned 503.
Adjusted expired/wrong-purpose expectations to allow 401 or 503; both reject the
operation. This is a response-semantics limitation, not permission to accept a
reset. Other rejection cases require 401, successful reset requires 200, and
concurrent losers require 401. Recovery/email delivery remain disabled. An explicit
owner-approved real inbox test remains before activation.

### Owner-approved reset inbox test accepted — September 20, 2026

Owner explicitly approved one reset test email to shawn@house.email and temporary
transfer of the saved Resend key to staging, with removal afterward. Initial run
failed before identity creation because the staging key was absent; no email sent
then. Supplied only Resend API/from/reply-to settings via a private temporary file.
Second run used a process-scoped direct Resend request with the shared reset email
template; general EMAIL_DELIVERY_ENABLED stayed false and recovery stayed off.
Console confirmed RESET_INBOX_TEST_ACCEPTED around 17:09:41 UTC. This confirms API
acceptance, not inbox receipt. Subject: [Staging test] Reset your Rustic Halo password.

The link targets localhost:18000 on the preview Mac and a separate synthetic auth
identity reset-inbox-test-20260920@example.invalid, not the owner's admin account.
Token lifetime is 15 minutes. State including token is private mode 0600 inside
backend /tmp/reset-inbox-test-20260920.json; never print it. After owner completes
or abandons the test, remove that synthetic identity and private state file.
The send wrapper trap removes container /tmp/reset-inbox-secret.env and the VM
transfer file. SSH confirmed VM transfer file absent; temporary local transfer
file removed, original .local/resend.env preserved. No general customer email
activation, no admin credential change. Await owner receipt and manual form test.

### Owner confirmed inbox and browser reset success — September 20, 2026

Owner answered yes to both receipt and seeing the password-updated success message.
Ran cleanup-reset-inbox-test.ts with strict staging/delivery-off and exact synthetic
identity checks. Fresh console log confirmed RESET_INBOX_TEST_CLEANUP_COMPLETE:
temporary auth identity, private token state and Redis claim removed; temporary
container key absent. Original owner/admin credentials unchanged. General email
and password recovery remain disabled. Inbox test exercised shared email rendering
and the real browser update flow; subscriber/notification queue delivery was not
enabled by this process-scoped test. Public-domain reset URL and normal delivery
configuration still need activation/validation at launch.

### Mobile shopping fixes — September 20, 2026

At 390px the store page placed unrelated global color/clothing-size filters above
products. Store now hides that picker like collections already do, and sorting is
a compact native select. Local price-ascending navigation reordered products
correctly; storefront type checking passed. Shop update deployed and the new select
is visible on staging /us/store.

Mobile cart inspection found horizontal overflow. Converted full cart rows to
stacked mobile grids, retained desktop table layout, reduced desktop column gaps,
stacked the sign-in prompt, added accessible remove/quantity names, disabled
quantity during updates, and removed duplicate quantity=1 option. Local browser
checks at 390px and 1280px showed page width equal viewport; quantity 1->2 updated
$15 to $30, and deleting the local test item returned an empty cart. No checkout or
payment. Note localhost ports share cookies: local cart testing replaced the
browser cart cookie; it did not delete the earlier staging cart from its database.
Cart staging deployment started; completion and final deployed check pending.

### Mobile cart deployment verified — September 20, 2026

Fresh VM console output confirmed MOBILE_CART_DEPLOYMENT_COMPLETE and the
storefront container restarted. Verified staging /us/cart with a temporary unpaid
Floral Cross Dangle Earrings line: page width matched the viewport at both 390px
and 1280px, with stacked mobile rows and the desktop table intact. Quantity 1->2
updated the total from $15 to $30; removing the test line returned the empty-cart
screen. No order, payment, or email was created. Mobile shop and cart changes are
now deployed and browser-verified; this does not constitute a full checkout test.

### Responsive checkout and input labels — September 20, 2026

Deployed full-width phone shipping/billing fields, stacked address summaries,
and a checkout summary that stays beside the form only at wide desktop sizes.
Connected shared input labels through unique IDs, named the country selectors
and password visibility controls, and used telephone inputs for phone numbers.
Storefront type checking and focused diff whitespace checks passed.

Fresh staging browser reload showed the new layout and named input fields.
With separate billing enabled, no horizontal overflow at 390, 768 or 1440px;
all visible input fields had associated labels. Desktop screenshot confirmed
the form and order summary side by side. Temporary unpaid test item removed
and empty cart verified. No address was submitted, order placed, payment made,
or email sent. Delivery/payment/review interaction remains a separate check.

### Delivery verified; payment frame loading unresolved — September 20, 2026

Used an unpaid staging cart with synthetic Checkout Test / 123 Example St,
Grimesland NC 27837, checkout-layout@example.invalid. Test USPS Ground Advantage
rate loaded at $5.27 and selection updated totals to $15 items + $5.27 shipping +
$1.42 test tax = $21.69. Continue to payment navigated correctly. This verifies
the UI/test-provider path, not live shipping or authoritative tax readiness.

Fixed narrow mobile delivery summary, mobile payment padding, payment-summary
stacking, and delivery prompt grammar. TypeScript passed. Deployed storefront
and fresh browser reload confirmed the widened summary with no horizontal
overflow at 390px.

Selecting Credit card created an unpaid payment session, but Stripe Payment
Element remained a loading skeleton across reloads in the in-app browser.
Observed Stripe iframe DOM nodes with 2px heights and about:blank AX content;
console showed only the expected HTTP sandbox warning, no explicit load error.
Root cause is not established. Card entry, review, decline, and completion are
NOT verified by this run. No card data entered, order placed, email sent, label
purchased, or payment confirmed. Keep the unpaid test cart for loading diagnosis.

### Stripe payment-frame recovery verified — September 20, 2026

On the next inspection, the existing frame had loaded without a code/config
change. Expanded Card and verified number, expiration, security code, country
and ZIP inputs. Stripe developer inbox showed the expected HTTP test warning
and an API migration recommendation, not a loading error. At 390px the page was
390px wide and the loaded secure frame was 316px wide; screenshot confirmed
card fields fit. A fresh reload also loaded the Card option successfully.
Earlier delay's cause remains unconfirmed; do not describe this as a proven
store-code fix or evidence that it cannot recur. No card details or payment
were submitted. Payment completion and decline handling remain separate tests.

Cleanup attempt exposed another issue: removing the sole line from this cart
after shipping/payment-session selection returned to the enabled remove button
with the line still present. No browser console error. DeleteButton currently
swallows the server-action error. Unpaid diagnostic cart retained; investigate
last-item removal with selected calculated shipping before claiming cleanup.

### Last-item removal fixed and verified — September 20, 2026

Filtered backend errors confirmed "Unable to pack this order automatically."
The selected calculated shipping method was being recalculated with zero items;
the parcel builder correctly rejects empty shipments. Shippo test provider now
returns zero for an explicitly empty items array before attempting packing or
external quoting, while preserving environment/token guards. Nonempty carts
still follow the existing packing and rate path. The storefront remove button
now displays an accessible generic failure message instead of silently failing.

Three regression tests passed: empty cart returns zero without fetch, nonempty
unknown SKU is still rejected, and live credentials are still rejected. Backend
and storefront TypeScript checks passed. Rebuilt/deployed both staging services.
Retried the SAME previously failing cart with shipping and unpaid payment session
already selected: removal succeeded and browser displayed Cart (0) and the empty
cart screen. The diagnostic item is now removed. No payment or order submitted.

### Refill-after-empty regression — September 20, 2026

Added the same earring back to the now-empty diagnostic cart. Existing selected
shipping recalculated from zero to $5.27; subtotal $15, test tax $1.42, total
$21.69. No stale free-shipping value persisted. Checkout correctly required
payment-method selection again. An unpaid Stripe session was initialized, but
the new browser tab again initially showed gray payment-loading placeholders.
Asked owner to focus the checkout test tab and report whether fields appear;
payment-to-review check remains pending. No test card details submitted yet.

Owner confirmed gray placeholders persist after focusing the checkout tab.
A new explicitly visible in-app tab also showed about:blank Stripe frame AX
content and placeholders. Public Stripe frame HTML connectivity check from
the Mac returned HTTP 200 in 0.15 seconds without credentials; this does not
prove that iframe scripts or Stripe API calls succeed inside the browser.
Console showed only HTTP sandbox warning. Safari comparison could add an item
but navigation/reload at checkout returned Page not found, so no valid
cross-browser payment comparison was obtained. Source sets Secure cart cookies
in production; Safari cookie behavior is a hypothesis, not a verified cause.
No security flags were changed. Review-step verification remains blocked by
reproducible payment-frame loading; earlier successful load is insufficient
to call the issue resolved. Unpaid diagnostic cart retained, no card entered.

### Private HTTPS preview prepared — September 20, 2026

Prepared .local/staging-https/proxy.cjs listening only on 127.0.0.1:18443 and
forwarding to the existing localhost:18000 staging tunnel. No public listener,
DNS change, VM security change, or certificate trust change made. Generated
a 30-day self-signed localhost server certificate (CA:FALSE, serverAuth;
SAN localhost/127.0.0.1/::1), private key mode 0600 in directory mode 0700.
Certificate expires October 20, 2026. SHA256 fingerprint:
58:8B:22:38:DB:E4:0F:74:0C:24:94:FD:F6:76:F7:39:BB:ED:8B:C6:D1:CB:7C:F0:A5:91:7A:82:11:A2:A5:9E.
Node syntax check passed; curl with this exact certificate as its explicit
trust anchor returned HTTP 200 for https://localhost:18443/us. Browser trust
is not yet installed; ask explicit permission for the local certificate trust
change before installing. Browser HTTPS/Stripe verification remains pending.

### Local certificate approved and Safari HTTPS verified — September 20, 2026

Owner explicitly approved adding the localhost certificate and completed macOS
authorization. security add-trusted-cert succeeded in the login keychain with
SSL policy limited to localhost. Unsandboxed security verify-cert confirmed
successful verification. Safari opened https://localhost:18443/us with
IsSecure=true and no warning. Adding a test earring and navigating to HTTPS
checkout successfully retained its cart, unlike the earlier HTTP Safari test.

Codex in-app browser rejected the new certificate with ERR_CERT_AUTHORITY_INVALID.
No browser warning bypassed. A Codex restart may refresh trust, but this is not
yet proven. /usr/bin/curl default trust also failed, while explicit certificate
validation and macOS verification succeed; do not claim all trust stores agree.
Safari test form was being populated with synthetic data when native observation
became unavailable; payment-form and review verification remain incomplete.
No payment submitted. HTTPS proxy process remains on loopback port 18443.

### Post-restart trust check — September 20, 2026

Codex restart stopped the foreground HTTPS proxy; restarted it on loopback
18443. New in-app browser attempt still returned ERR_CERT_AUTHORITY_INVALID,
so restart did not resolve its trust behavior. No warning bypassed. Safari
initial accessibility state resumed the secure checkout address page, but
subsequent state was empty and screenshots unavailable, blocking further
native interaction. Need visible/unlocked Safari to finish comparison.

### Safari HTTPS Stripe form confirmed — September 20, 2026

Resumed Safari secure checkout, corrected synthetic address fields and submitted
checkout-https@example.invalid. Test USPS rate $5.27 selected; total $21.69.
Stripe payment options loaded over HTTPS, Card expanded, and a screenshot
confirmed card-number/expiry/CVC inputs. Dismissed 1Password's save-identity
prompt without saving or updating anything. Began entering Stripe sandbox-only
4242 card details; native Safari screenshots/state became unavailable again
before ZIP and Continue to review could be verified. No order or payment was
submitted. HTTPS Safari rendering is verified; review step remains unverified.
This narrows the preview-browser issue but does not prove HTTPS alone resolved
all loading delays or establish that the in-app browser trusts the certificate.

### Safari HTTPS checkout review verified — September 20, 2026

Owner finished the sandbox card ZIP and Continue to review. Fresh Safari
accessibility state confirmed IsSecure=true and the URL
https://localhost:18443/us/checkout?step=review. Address, USPS Ground Advantage
TEST shipping, credit-card selection, and the 3–5 business day production
message appeared on review. Totals were $15.00 merchandise, $5.27 shipping,
and $1.42 test tax, totaling $21.69. Place order was available but was not
clicked: no order or payment was submitted.

Safari HTTPS address-to-shipping-to-sandbox-card-to-review is now verified.
Codex in-app certificate trust and intermittent payment-frame loading remain
unresolved. Payment completion and declined-payment behavior were not tested
in this check. Leave the unpaid Safari review page available for the owner.

### Safari payment edit check — September 20, 2026

Fresh Safari state confirmed the same unpaid review total of $21.69. Editing
payment returned to the payment step, and a screenshot confirmed that the
sandbox card fields retained their values. Dismissed the 1Password save-card
prompt without saving. Attempted to clear the sandbox CVC and blur the field
to check incomplete-payment validation; subsequent accessibility state was
empty and screenshots unavailable, including after reacquiring Safari.
Therefore the resulting field value and disabled-button behavior are not
verified. Checkout may now need its sandbox CVC restored to 123. No Place
order action was taken. Resume with fresh visible browser state before typing.

### Incomplete payment validation confirmed — September 20, 2026

On resuming Safari, fresh accessibility state showed Continue to review
disabled after the preceding CVC-clear attempt. The owner then changed the
form; refreshed state and screenshot showed the sandbox CVC restored to 123,
ZIP 27837, and Continue to review enabled. Clicking Continue successfully
returned to review with the same $21.69 total and Place order available.
Dismissed the test-card save prompt without saving. No order or payment was
submitted. This verifies the incomplete-to-complete button transition and
payment editing back to review, not issuer declines or payment completion.

### Serial text console configured — September 20, 2026

Owner requested paste-capable Proxmox console. Added VM102 serial0=socket using
Hardware > Add > Serial Port, preserving default VGA. Enabled
serial-getty@ttyS0.service via the existing authenticated VM console. Cleanly
powered off VM102 and started it; Proxmox start task showed OK and the guest
booted. VM menu xterm.js remained disabled, so used pve-0 Shell (xterm.js) and
`qm terminal 102` to attach to the same VM serial console. Return displayed
rustic-halo-staging login. Clipboard paste of shawnhouse visibly arrived
(despite a clipboard-tool timeout); submitted username and left Password:
for owner entry. No automatic login or password changes.

To reopen: pve-0 > Shell, run `qm terminal 102`; Ctrl+O exits to the host shell.
Existing VM noVNC console remains available. QEMU guest agent was installed
but inactive before this work and was not enabled by this serial-only change.
Two bounded post-boot SSH attempts to 10.20.69.160 timed out; local storefront
forwarding is not yet restored. Need verify guest IP/network and application
health after owner login; do not claim preview recovery. No VM network settings
were changed.

### Serial login and preview recovery verified — September 20, 2026

Owner logged into the serial console as shawnhouse. Guest diagnostics showed
ens18 UP at 10.20.69.159/24, gateway 10.20.69.1; SSH and serial-getty@ttyS0
both active. Reconnected using the saved key and strict HostKeyAlias
10.20.42.160, preserving the known VM identity. Existing socket path remains
/tmp/rustic-halo-staging-vlan69.sock. Storefront localhost:18000/us, backend
localhost:19000/health, and certificate-validated HTTPS localhost:18443/us
all returned HTTP 200. Updated staging-tunnel.sh for the current VLAN address
and control socket. No DHCP reservation or network policy was changed.
Serial console remains available through pve-0 Shell > qm terminal 102;
the normal VM noVNC console is retained. Direct VM xterm.js menu remains
disabled while its display remains Default; do not claim that shortcut works.

### UniFi DHCP reservation saved — September 20, 2026

Enabled and saved Fixed IP Address 10.20.69.159 for the existing UniFi client
rustic-halo-staging, MAC bc:24:11:87:9b:a3, Services VLAN69. Closed and reopened
the client settings: Fixed IP remained checked and address remained .159.
Guest DHCP remains unchanged. No local DNS record or firewall changes made.

### Safari HTTPS decline and successful checkout verified — September 20, 2026

After the VM console check confirmed stripeTest=true and emailDisabled=true,
tested the existing synthetic checkout in Safari at https://localhost:18443.
Stripe's documented generic-decline card returned "Your card has been declined"
on review; the cart and $21.69 total remained available and Place order recovered.
Edited payment to the 4242 sandbox card and submitted once. Browser navigated to
/us/order/order_01M309302DPMHE36XMT2MSPA3R/confirmed, displayed order number 13,
successful placement, $21.69 paid, and Cart (0). Totals: $15 goods, $5.27 shipping,
$1.42 tax. Optional Link enrollment fields were blank. Used synthetic checkout
details and sandbox cards only; no live payment, shipping label, or customer
email delivery enabled. This verifies browser decline-to-success recovery;
background reporting, capture reconciliation, and refund checks for this new
order have not yet been performed. Codex in-app browser issues remain open.

### Order 13 read-only verification passed — September 20, 2026

Fresh VM console results at 20:53:18 UTC: event queue failed/waiting/active/
delayed/paused all zero, completed six. Explicit order reconciliation for
order_01M309302DPMHE36XMT2MSPA3R returned amounts_match, storeRefunds
amounts_match, all refunded amounts zero, checkedOrders=1, discrepancies=0.
Both check exit codes were zero. The reconciliation validates a succeeded
Stripe sandbox payment and saved reporting/refund amounts; it does not
independently inspect the Stripe Tax ledger contents.

Initial monitoring attempt failed because the helper copied into the previous
container was absent after image replacement. Corrected background-jobs.sh
locally and on staging to stream the host helper into node via stdin with
explicit backend server working directory. That invocation produced the fresh
successful queue report above. Shell syntax and five existing helper tests
passed. No orders, payments, refunds, emails, or jobs were changed/retried.
Unattended checks still require administrator access; this interactive console
success does not establish passwordless monitor access.

### Order 13 admin refund verified — September 20, 2026

Owner explicitly approved the full $21.69 sandbox refund after the approval
review requested exact-action authorization. Submitted once through Medusa
Admin; order 13 shows Refunded, paid total zero, outstanding zero, and a $21.69
refund activity entry. No real funds moved.

Fresh read-only VM console check at 21:02:24 UTC reported seven completed jobs,
zero failed/waiting/active/delayed/paused jobs. Order reconciliation returned
Stripe refunded 2169 cents, saved reporting refunded 2169 cents, and Medusa
refunded 2169 cents; both comparisons amounts_match, discrepancies=0, both
exit codes zero. This comparison does not independently inspect the Stripe Tax
ledger. No jobs retried or additional transactions created during verification.

### Signed-out account review — September 20, 2026

Cookie-free staging requests confirmed the synthetic order 13 confirmation URL
returns its email and address. Installed Medusa explicitly treats possession of
the order ID as guest authorization. Owner choice on stronger guest verification
is pending; no order-access policy was changed.

A separate signed-out /us/account/orders request rendered an empty account
area. The account layout relied on an unmatched parallel login slot. Changed
local layout to render LoginTemplate directly when no customer is authenticated.
Storefront TypeScript check passed. This fix is not deployed or browser-verified
yet; deploy the storefront and test direct nested account URLs next.

### Signed-out account fix deployed — September 20, 2026

Uploaded only the account layout change, rebuilt and recreated the storefront
service with deploy-account-fix.sh. Console log ended ACCOUNT_FIX_DEPLOYED;
container started successfully. Fresh cookie-free requests to /us/account/orders,
/us/account/profile, and /us/account/addresses all returned HTTP 200 with the
sign-in form and email field. Browser inspection of /us/account/orders confirmed
Welcome back, email/password inputs, Sign in, and Forgot your password.
Guest-order retrieval behavior remains unchanged pending owner choice.

### Guest-order access decision — September 20, 2026

Owner chose the simplest option and confirmed retaining private confirmation-link
access after being told that anyone with the link can view the order details.
No sign-in or emailed verification code is added for guest confirmation pages.
This resolves the pending owner choice above; no application change or deployment
is needed. Signed-in account pages retain their existing authentication behavior.

### Mobile account and cart review — September 20, 2026

At a 390 by 844 browser viewport, deployed signed-out /us/account/orders and
/us/account showed the sign-in form with no horizontal overflow (document
scroll width and viewport both 390). Existing one-item test cart rendered its
item, quantity selector, removal control, and summary without horizontal
overflow. Cart badge became Cart (1) after hydration. Mobile menu opened,
Account navigation reached /us/account and closed the menu. No quantity,
payment, or account mutations were performed; viewport reset afterward.
This verifies layout and navigation, not mobile payment completion.

### Payment loading guidance deployed — September 20, 2026

Added a 20-second loading message to the selected Stripe option while awaiting
PaymentElement readiness. The timer cleans up on readiness, deselection or
unmount. Existing completion requirements and payment submission stay unchanged.
Storefront TypeScript check passed; VM deployment log PAYMENT_LOADING_DEPLOYED
and recreated storefront verified after owner sudo authentication. Fresh in-app
browser checkout load showed the new guidance after the delay with Continue to
review still disabled. Gray Stripe frames persist in this browser; this change
provides guidance, not a fix for the underlying loading issue. No order or
payment submitted. Mobile payment completion remains unverified.

### Tax-inclusive item labels deployed — September 20, 2026

Shared line-item total and unit-price components now show Includes tax when
tax_total is positive. Amount calculations and tax behavior are unchanged.
Storefront TypeScript check passed. Uploaded only the two components and
rebuilt/recreated the staging storefront using deploy-price-labels.sh.
Fresh browser cart showed $16.05 Includes tax alongside the explicitly
pre-tax $15 subtotal, $5.27 shipping, $1.42 taxes, and unchanged $21.69 total.
At 390px width the label was visible and document scrollWidth remained 390;
viewport restored afterward. No payment, order, or cart quantity changed.

### Upload storage coverage audit — September 20, 2026

Read-only VM console check at 21:55:02 UTC: running backend has no mounts;
default upload directory /app/apps/backend/.medusa/server/static does not exist
(zero entries). Host .env, backend.env, compose.yaml and compose.apps.yaml are
present and nonempty; no values printed. Current file provider defaults were
inspected in installed Medusa 2.21 source. Future local uploads would be stored
in the replaceable backend container unless persistent storage is configured.
No existing local upload files were found at the default path to preserve.

Configuration presence is not a backup restore verification. External catalog
image content is not covered merely by backing up image URLs in the database.
Add durable image storage and verify an upload survives backend recreation
and backup restoration before relying on admin uploads. NAS retention and
off-site coverage remain unverified. No infrastructure settings changed.

### R2 image storage deployed and verified — September 20, 2026

Owner authenticated sudo; deployment completed with healthy backend/storefront.
Medusa file service uploaded one synthetic SVG to rustic-halo-images and verified
CDN bytes. Backend force-recreation completed healthy; the same CDN image then
rendered in the in-app browser. Local health endpoints both returned HTTP 200.
A separate Mac Python HTTP request received 403, while browser delivery passed.
See image-storage.md for exact test URL, scope, remaining admin UI and backup
checks. Existing product images unchanged; no commerce transactions or emails.

### Admin R2 upload verified — September 20, 2026

Uploaded synthetic SVG using Medusa Admin Create Product media control and
Save as draft. Created prod_01M30H60CZMTH0ZYQG38HF02VA, explicitly Draft.
Admin image DOM confirmed cdn.rustichalo.com URL loaded at 480x160.
Storefront /us/products/cdn-upload-check-draft-only returned HTTP 404.
Draft remains for review; existing products were not edited or published.

### First CDN image export verified — September 20, 2026

Installed backup-r2.sh and backup-r2.cjs. Shell/Node syntax checks passed.
Executed export via authenticated VM console: two objects, 720 bytes,
R2_BACKUP_VERIFIED at image-backups/20260920T231050Z-60149. Host files
matched manifest SHA-256 and size values. No cloud mutations or automation
created. NAS inclusion and restore-to-R2 still unverified; see image-storage.md.

### Daily CDN image export enabled — 2026-09-20

Installed and tested `rustic-halo-image-backup.service` and `.timer` on VM 102 (`10.20.69.159`). Daily run is 20:00 America/New_York, ahead of the Proxmox all-guests/all-nodes `unas` backup configured for 21:00. Service manual test returned success/exit 0; timer is enabled and active. See `docs/image-storage.md` for limits: NAS capture of these new exports and R2 restore are not yet verified, and local export retention remains unconfigured.

### Isolated R2 restore verified — 2026-09-20

Executed `deploy/staging/test-r2-restore.sh` on VM 102 through its authenticated
serial console. Restored the synthetic 365-byte image from the existing VM-disk
export into a new R2 restore-check object. Backup integrity, R2 read-back metadata
and bytes, and CDN response bytes all passed (`R2_RESTORE_VERIFIED`). No original
object or product was changed. NAS-archive recovery of this export remains a
separate outstanding check; see `docs/image-storage.md`.

### Catalog and editorial CDN migration completed — 2026-09-20

24 source URLs copied and byte-verified, five imported products updated with
image IDs preserved, homepage image links rebuilt and deployed. Original
product image mapping retained in VM `image-migration-report.json` and local
`.local/image-migration/report.json`. All five product pages/homepage HTTP 200;
sample gallery and visible homepage images loaded in browser. Immediate
27-object export verified at `image-backups/20260920T233001Z-67777`. Original
external images remain intact. Nightly NAS coverage is not yet verified.

### Background monitor access audit — September 20, 19:32 Eastern

Existing heartbeat configuration uses the correct VM address 10.20.69.159 and
control socket. A fresh noninteractive SSH status attempt failed with
`sudo: a password is required`; unattended privileged checks remain blocked.
The authenticated serial console successfully ran the existing status tool:
checkedAt 2026-09-20T23:32:38.221Z, failed/waiting/active/delayed/paused all zero,
completed seven, no failed jobs. This is fresh manual evidence, not proof the
heartbeat can check autonomously. No jobs were retried or modified.

Proposed next fix: have the VM periodically publish a timestamped, sanitized
status report (counts and failed job IDs only) readable by the existing SSH
user, with stale-report detection. This avoids granting that user general
passwordless Docker or administrator access. Not installed yet.

### Unattended sanitized job-health reporting enabled — September 20, 19:35 Eastern

Installed root-owned publisher, reader, and collector under
`/usr/local/lib/rustic-halo-job-health`. The systemd service selects only the
running `rustic-halo-staging` Compose backend and invokes the collector with a
fixed `status` argument. No sudoers or Docker-group permissions were granted.
A five-minute timer refreshes `/var/lib/rustic-halo-job-health/status.json` via
atomic replacement. The directory is root:root 0755 and the report 0644;
non-root users may read only sanitized counts, failed IDs and collection time.
Raw subprocess output, event payloads and credentials are never published.
Collection failures publish a generic failure status. The reader rejects reports
older than 15 minutes or more than one minute in the future, and reports missing
or invalid files as unavailable.

Fresh unprivileged SSH invocation of
`python3 /usr/local/lib/rustic-halo-job-health/read-job-health.py` succeeded:
checkedAt 2026-09-20T23:35:27.602Z, zero failed/waiting/active/delayed/paused,
seven completed. Service Result=success, ExecMainStatus=0; timer enabled.
Root ownership and file modes verified remotely. Local checks passed for
secret stripping, failed jobs, stale timestamps, collection failures, and
malformed negative counts. Existing 30-minute Codex heartbeat updated to use
the unprivileged reader and preserve quiet-unless-actionable behavior.

Limits: this is Redis event-queue coverage only, not workflow-engine failures or
provider reconciliation. Later scheduled refresh and notification delivery are
not proven by the first successful run. SSH availability remains a dependency.

### Scheduled monitor refresh verified — September 20, 19:40 Eastern

A later unprivileged SSH read returned checkedAt 2026-09-20T23:40:40.752Z,
newer than the initial manual report at 23:35:27.602Z. No manual publisher run
was issued between reads. The five-minute timer refreshed successfully; counts
remain zero failed/waiting/active/delayed/paused, seven completed. Alert delivery
for a real failure remains untested.

### Checkout address/tax guard deployed — September 20, 19:42 Eastern

Review found that validateCartTax returned immediately for non-NC destinations,
without checking whether stale NC tax remained after an address change. The
sandbox guard now rejects non-US addresses/non-USD carts and requires zero
aggregate, shipping and item tax for destinations outside NC. Missing, invalid,
negative or fractional nonzero amounts are rejected. NC carts continue to use
the existing actual-cart Stripe sandbox comparison.

Thirty tax-validation/calculation unit tests passed; backend TypeScript check
passed. Deployed using deploy-tax-address-guard.sh, preserving prior source.
Executed the compiled deployed validator with five synthetic in-memory cases
(zero-tax VA, stale total, stale item, international address, non-USD currency):
DEPLOYED_TAX_ADDRESS_GUARD_VERIFIED cases=5. No carts, orders, payments or external
Stripe calls were created by this smoke test. Backend health and storefront
homepage returned HTTP 200. This is not a new end-to-end address-change payment
test or a live tax-provider implementation; existing test-only limits remain.

### Address-change tax regression passed — September 20, 2026

Created one synthetic unpaid staging cart `cart_01M30KAEGH1Y42GFNA4F171MY0`
with one earring SKU 38425. Exercised the deployed Store API through NC → VA →
NC, reselecting the test shipping option and calling the tax-validation endpoint
after each change. Initial/restored NC tax 1.4189 and total 21.6889 matched
exactly (displayed $1.42/$21.69). Virginia aggregate/item/shipping tax all zero;
total 20.34. All three preflight calls accepted their recalculated totals.

Verified the cart remained unpaid with no payment collection or completed
order. No payment, refund, label purchase or customer email occurred. This is
an actual cart/API regression, not browser form interaction or payment testing.
Results saved locally in `.local/staging-deploy/address-tax-transition.json`.
