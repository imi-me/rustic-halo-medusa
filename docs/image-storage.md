# Rustic Halo image storage

## Verified staging setup — September 20, 2026

- Public hostname: https://cdn.rustichalo.com (Cloudflare Active, access Enabled).
- R2 bucket: rustic-halo-images; Standard storage; Eastern North America.
- Development r2.dev URL remains disabled.
- Medusa uses its S3 file provider, R2 region auto, ACL headers disabled, and
  checksums only when required. Upload key is restricted to this bucket.
- Owner explicitly approved key creation and secure transfer to staging VM
  10.20.69.159. Backend runtime secrets are private; no values recorded here.
- Backend and storefront rebuilt and deployed; R2_STORAGE_DEPLOYED logged.
  TypeScript checks passed before deployment.
- Created one synthetic public SVG through Medusa's file service, fetched it
  from the CDN, and matched its bytes inside the VM. Recreated the backend;
  healthy again. The same image then rendered in the external in-app browser.
- Storefront and backend health endpoints returned HTTP 200 after recreation.
- The Mac command-line HTTP request returned 403; browser delivery passed.
  This is not proof that all HTTP clients or networks can retrieve the image.

Test image:
https://cdn.rustichalo.com/cdn-connection-check-01M30GKKWR5E901E3EBS911Q25.svg

## Remaining checks

- Admin UI upload verified September 20: created unpublished draft product
  prod_01M30H60CZMTH0ZYQG38HF02VA (CDN upload check — draft only). Image loaded
  in the admin with natural dimensions 480x160 from
  https://cdn.rustichalo.com/cdn-admin-upload-check-01M30H5ZYZXVP0M2B7KJSJEWG1.svg.
  Draft storefront URL returned HTTP 404. Draft retained for review; never published.
  A real catalog-image migration and storefront product-image test remain separate.
- Existing catalog images remain on their original external hosts. No migration
  occurred merely by enabling the new provider.
- Back up/export R2 originals to the NAS and verify restoration separately.
  Container recreation survival is not a backup restoration test.
- Bucket is public: only product and brand assets belong here, not private files.
- Deployment preserved old backend.env and source config in a private timestamped
  r2-backup directory on the VM. The transfer-only VM credential file is removed
  by the successful deployment helper. Owner-only local credential file remains
  ignored by Git.

Sources:
- https://developers.cloudflare.com/r2/buckets/public-buckets/
- https://docs.medusajs.com/resources/architectural-modules/file/s3

## R2 export backup verified

September 20, 2026: backup-r2.sh exported both current test objects (720 bytes)
using read-only ListObjects/GetObject requests. Host verification independently
matched sizes and SHA-256 fingerprints from manifest.json. Console reported
R2_BACKUP_VERIFIED objects=2 at image-backups/20260920T231050Z-60149 on the VM.
Original object keys, MIME types and cache-control values are retained in the
manifest; opaque hashed filenames avoid path traversal. Conditional ETag reads
reject objects changed since listing. Exports are not an atomic bucket snapshot
if new objects are added during listing.

This is an on-demand export, not a scheduled task. The export resides on the
VM disk and can be captured by a subsequent VM backup; its presence in a NAS
archive, off-site copy and R2 re-upload restore have not yet been verified.
No CDN objects were overwritten or deleted. Temporary container copies were
removed only after the host copy verified successfully.

## Daily export schedule enabled — 2026-09-20

- Verified in Proxmox Datacenter → Backup: enabled daily `21:00` job, all nodes and all guests, destination `unas`. This verifies configured coverage, not a completed NAS backup containing the new image exports.
- VM timezone confirmed `America/New_York`. Installed `rustic-halo-image-backup.service` and `.timer`: daily 20:00 Eastern, persistent catch-up after downtime, one-minute scheduling accuracy. This leaves one hour before the configured NAS job; the two jobs are not dependency-linked.
- Service runs the existing verified export with a concurrency lock and 45-minute timeout. It does not delete cloud objects or rotate existing backup copies. Retention and disk growth still need review as the image library grows.
- Installed through `install-image-backup-timer.sh`. Remote `systemd-analyze verify` and calendar validation passed.
- Manually started the installed service; fresh `systemctl show` returned `Result=success`, `ExecMainStatus=0`. Timer is enabled/active; next run was September 20, 2026 at 20:00 EDT.
- Offsite backup and restoring an R2 export remain unverified.

## Isolated image restore passed — 2026-09-20

Ran `test-r2-restore.sh` on staging using the existing VM-disk export
`image-backups/20260920T231050Z-60149`. The helper selects only the known
synthetic connection-check SVG, verifies its backup size and SHA-256 before
upload, and restores to a new random `restore-check/` key with a conditional
create. It never writes the original key.

Fresh console result: `R2_RESTORE_VERIFIED`, 365 bytes, SHA-256
`5b9a47a74ac60dc0ec75a6df542ddb4d1bc2f9ca9836f7215f40f9624bc8699e`.
The R2 read-back matched the backup bytes and content-type/cache-control
metadata. Fetching the new public CDN URL from the VM also matched the hash.
Original images were unchanged; the small restored test object remains in R2.
Temporary container input was removed after successful verification.

This verifies recovery from the VM-disk image export, not recovery of that
export from a NAS archive or an offsite copy. Those checks remain outstanding.
The earlier statement that R2 re-upload restoration was unverified is now
superseded by this isolated test.

## NAS archive coverage check — 2026-09-20 19:23 Eastern

Fresh Proxmox `pvesm list unas --content backup --vmid 102` listed only
September 19 archives (21:01:27 and 23:31:44). Both predate today's image
exports, so neither can verify NAS recovery of those exports. The next
configured all-VM NAS backup is September 20 at 21:00 Eastern, after the
20:00 image export. Check successful VM 102 backup completion and restore
its image-backups contents before claiming NAS recovery is verified.
No new VM was created and no existing archive was replaced for this check.

## Catalog migration — September 20, 2026

`migrate-catalog-images.sh` copied 24 distinct source URLs (5,830,357 bytes)
from the existing public Rustic Halo/Shopify photo hosts to Medusa-managed R2
files. Every CDN response was compared by SHA-256 against the downloaded source
before any product links were changed. Five Shopify-imported products were
updated; existing image IDs were preserved and saved product URLs re-read.
The unpublished test draft and other non-imported products were excluded.

Rollback evidence is preserved in `image-migration-report.json` on the staging
VM, with a local private copy at `.local/image-migration/report.json`. It records
original product thumbnails/image IDs/URLs, copied URLs, hashes and sizes, and
updated product IDs. Source images on the old hosts were not deleted. Copying
editorial URLs preserves the existing requested image sizes, not necessarily
original full-resolution source files.

Fresh HTTP checks for all five product pages returned 200 and rendered image
links only from cdn.rustichalo.com plus the local brand logo. Homepage source
links were updated separately in `apps/storefront/src/lib/brand/assets.ts`.

Homepage deployment completed with `CDN_EDITORIAL_DEPLOYED_AND_BACKED_UP`.
Fresh export verified 27 objects at `image-backups/20260920T233001Z-67777`.
Homepage returned HTTP 200 with 14 CDN image references and the local logo.
Browser checks confirmed the visible homepage photos, all four sample sign
images and its related thumbnail loaded successfully. NAS-archive recovery of
this newer export remains pending after the nightly backup.
# Full draft catalog image transfer — September 20, 2026

Completed at 2026-09-21T03:35:35.231Z. All 414 newly imported draft products were
organized, with 1,499 distinct Shopify image URLs copied through the Medusa file
provider to cdn.rustichalo.com and verified against source SHA-256 bytes before
product updates. Total copied: 465,454,151 bytes. Zero failed products; one
product had no source image. Existing five pilot products were excluded.

Evidence: `.local/staging-catalog-organization.json`, retrieved from VM report.
Includes original image assignments and verified source-to-CDN mapping. This
does not establish that a subsequent scheduled backup captured the new objects.
