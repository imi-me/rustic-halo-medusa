# Local development on this Mac

Prepared September 18, 2026 in `/Users/shawnhouse/Documents/Codex/rustic-halo-medusa` on `codex/rebuild-rustic-halo-commerce`. No push, merge, or deployment was performed.

## Start and stop

From this project folder, open two terminal windows:

```bash
# Terminal 1: starts the dedicated database if necessary, then API and Admin
bash scripts/dev-local.sh backend

# Terminal 2: storefront
bash scripts/dev-local.sh storefront
```

- Storefront: http://localhost:8000 (redirects to `/us`)
- Admin: http://localhost:9000/app
- API health: http://localhost:9000/health
- Admin email: `admin@rustichalo.test`
- The random local Admin password is in `.local/admin-credentials.txt` (owner-readable, ignored by Git). Do not reuse this login outside development.

Stop each app with Control-C in its terminal. Once both have stopped, stop the database with:

```bash
bash scripts/dev-local.sh db-stop
```

These are development processes, not login services. Start them again after rebooting. All servers bind to loopback.

## Installed tools and data

The ignored `.local/` directory holds Node 22.23.2 for Apple Silicon, pnpm 10.11.1, PostgreSQL 17.11 compiled from official source, the PostgreSQL cluster, package caches, private credentials, and verification logs. Official Node and PostgreSQL release SHA-256 checksums were verified before unpacking. No system package manager or global runtime was installed.

The helper selects these project-local tools and keeps Medusa configuration and caches inside `.local/`. It assumes this Mac's installed tools exist; it is not an installer for another computer. PostgreSQL was compiled without ICU or readline for this isolated development use. Its cluster uses UTF-8 with the C locale, password authentication, host `127.0.0.1`, port `55432`, and database/user `rustic_halo_local`. The cluster administrator role is only for this private development cluster.

Backend settings are in `apps/backend/.env`; storefront settings are in `apps/storefront/.env.local`. Both are ignored and owner-readable. Fresh database, JWT, cookie, and Admin secrets were generated. No previous settings existed or were overwritten.

Preserve `.local/pgdata` and both environment files if you want to retain local changes. Do not delete `.local/` while its PostgreSQL process is running. Moving the project requires updating PostgreSQL installation paths or reinstalling its local tools.

## Database initialization

Schema migrations were run with the starter migration scripts skipped:

```bash
bash scripts/dev-local.sh pnpm --dir apps/backend exec medusa db:migrate --skip-scripts --execute-safe-links
```

`apps/backend/src/scripts/setup-local.ts` then configured the empty store, a Local Development sales channel, a temporary US/USD test region, and a linked publishable storefront key. It only accepts the dedicated loopback database above and preserves a populated storefront key. It can be rerun using:

```bash
bash scripts/dev-local.sh pnpm --dir apps/backend exec medusa exec ./src/scripts/setup-local.ts
```

This is fresh development data, not recovered business data. No products, stock levels, customers, or orders were imported. One empty cart was created during the API smoke test. Tax calculation is disabled in the test region; the system payment provider is for testing. Real shipping, taxes, payment processing, inventory locations, and catalog configuration remain to be decided. Redis is not installed; Medusa currently uses its local in-memory event and locking implementations.

Do not run `pnpm backend:seed` or remove `--skip-scripts` casually: the starter seed remains pending and creates European demo products with stock quantities of 1,000,000.

## Verification

```bash
bash scripts/dev-local.sh pnpm lint
bash scripts/dev-local.sh pnpm --dir apps/storefront typecheck
bash scripts/dev-local.sh pnpm --dir apps/storefront test
bash scripts/dev-local.sh pnpm build
```

- Frozen-lockfile dependency installation passed without changing the lockfile. pnpm's default dependency lifecycle-script restrictions were retained; no blanket approval was applied.
- Backend, Admin, and storefront builds passed. Backend and storefront lint now pass without warnings or errors.
- API checks passed: health, Admin shell, Admin authentication/current user, USD region, empty product listing, and creating/retrieving an empty USD cart.
- Browser checks passed: storefront home, empty catalog, empty cart, and Admin sign-in page. The storefront still displays the original Medusa starter branding.
- Fixed all eleven storefront TypeScript errors and the three React Hook dependency warnings. Checkout address submission now awaits the cart cookie, rejects file uploads in text fields, and submits typed shipping/billing data. Delivery price requests ignore stale responses, stop loading when no calculated rates are needed, and keep unavailable or loading rates unselectable.
- Seven checkout address regression tests pass, covering separate/shared billing, absent optional fields, missing cart, uploaded-file rejection, and API failure without advancing checkout. These tests isolate the server action from Next and the API; they are not a full checkout test.
- Storefront type checking is now mandatory during production builds, with explicit typecheck and regression-test steps added to CI. The workflow changes are local and have not run on GitHub yet.
- Checkout completion, real payment processing, customer registration, shipping, integrations, and production readiness have not been verified.

Logs are saved under `.local/logs/`. The project helper disables Medusa and Next telemetry and passes these settings through Turbo. In Codex's restricted environment, starting servers and Medusa's Admin build require local network permission.

## First theme pass

The homepage, shared header/footer, and menu branding now use Rustic Halo's cream/olive palette, serif display headings, existing logo, and product photography. Verified at desktop width and 390px mobile width with no horizontal overflow; the account page also renders with the shared navigation. Storefront type checking and lint pass.

Image sources live in `apps/storefront/src/lib/brand/assets.ts` and currently load from the existing rustichalo.com CDN. Collection cards explicitly open the current shop in a new tab because the local catalog is still empty. These are editorial links, not imported products. Migrate images and connect collection cards to Medusa before replacing the live site. Existing promotions and shipping claims were not copied into the development store. The header now uses a local horizontal SVG derived from the supplied original deer and outlined logo lettering; source/adaptation notes are in `apps/storefront/public/brand/README.md`. Desktop navigation and the cream mobile menu were checked at 390px, including opening, closing through a collection link, and horizontal overflow. The logo no longer depends on the live shop CDN.

## Reference-inspired homepage

Implemented the supplied visual reference as a compact responsive header with product search, wide photographic hero, category tiles, editorial product picks, and three story panels. Kept the circled original deer/Gilroy wordmark. Images and product links use the existing Rustic Halo shop; no mock ratings, prices, inventory, shipping promises, or personalization functionality were invented. Local product search passes `q` through to Medusa and renders an empty-results message while this catalog is empty. Verified the search form and empty results in-browser, desktop and 390px mobile layouts, and type checking/lint. Positive search results still require local catalog data.

## Three-product pilot — September 19, 2026

Imported Top Down Hair Claws (two sizes), Floral Cross Dangle Earrings, and Round Medallion Cutout Earring from the connected Rustic Halo Shopify store into the isolated local database. The captured source is `apps/backend/src/scripts/data/rustic-halo-pilot.json`; run `bash scripts/dev-local.sh pnpm --dir apps/backend exec medusa exec ./src/scripts/import-pilot.ts` to reproduce. The importer refuses any other database and preserves existing products, prices, and inventory levels on rerun. This is a one-time snapshot, not inventory synchronization. Available quantities are copied into separate local snapshot locations; only the Shopify On-line Store location is linked to the local sales channel. Backorders are disabled. Source descriptions are converted to plain text. Original source IDs and capture time are retained.

The Floral Cross source contains a Highland Cow image; that mismatched image is excluded. Photos remain hosted on Shopify's CDN; file migration is still pending. Source collection membership beyond the pilot hair-claw/earring grouping, taxes, fulfillment, shipping rates, payment configuration, and the rest of the catalog are not imported. No Shopify mutations were made.

Homepage links for these products and the two collections now resolve locally; their price labels come from Medusa. Other editorial products still link to the current shop. Product pages use the Rustic Halo styling, responsive galleries, actual variant prices, and inventory checks. Removed starter delivery/exchange/return promises and starter page branding.

Validation: importer rerun succeeded without duplicates; `python3 scripts/verify-pilot.py` checks SKU/variant counts, USD amounts, online-only availability and positive search. Browser verified the earrings collection, size selection, a $12 hair-claw cart addition, local homepage destinations, and mobile product layout without horizontal overflow. One test item remains in the browser's local cart; no order was placed. Frontend/backend type checks and the seven existing checkout-address tests passed. Use `http://127.0.0.1:8000/us` for the explicitly loopback-bound development server.

## Featured catalog expansion — September 19, 2026

Added Goat Hi and Welcome Succas Door Hanger Sign to the same local-only snapshot importer and created the Signs for your space collection. Explicit product-type mapping rejects unsupported types instead of silently classifying them as earrings. New source records retain individual capture times. All five featured product links, the three category links, Gifts & more, and Shop all now stay in the local store. Homepage titles/prices use Medusa data, multi-price items say From, and sold-out badges appear on homepage and collection cards.

Welcome Succas has zero online availability and one retail unit in the source snapshot. It is correctly unavailable online, with its retail quantity preserved separately. The optional `python3 scripts/verify-pilot.py --check-sold-out-cart` check verifies the backend rejects it with `insufficient_inventory` and leaves an empty test cart; no order is placed. Two empty test carts were created during this check. The five-product SKU/price/location checks and repeat import passed. Product lists now use uncached reads so local imports and inventory edits appear immediately; production caching requires product and inventory invalidation. Shipping, payments, and live stock synchronization remain pending.

## Owner correction: online is made to order

The owner clarified that all online products are made to order and ship in 3–5 business days. This supersedes the earlier zero-stock/sold-out assumptions above. Imported variants now allow backorders while retaining tracked physical quantities and separate locations. New imports use that policy; `enable-made-to-order.ts` applies it explicitly to existing pilot products after checking their source identity and the isolated database. The header, homepage feature strip, product detail notice, and shipping text state “Made to order · Ships in 3–5 business days.” The timeframe is shipping/dispatch, not arrival, and uses business days as confirmed by the owner.

Verification: `python3 scripts/verify-pilot.py --check-made-to-order-cart` confirms all five products' variant prices, backorder flags, online-only physical quantities, and search. It also adds the zero-stock Welcome Succas variant successfully at $48, removes the test item, and confirms the cart is empty. No order was placed. The former sold-out rejection check was replaced with this owner-approved behavior. Live Shopify settings were not changed.
