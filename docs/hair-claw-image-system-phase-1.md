# Hair claw image and variant system — Phase 1 discovery

Checked September 22, 2026. This is an architecture review only. No catalog,
inventory, image, admin, or deployment changes were made. Catalog counts below
come from the saved read-only staging Store API snapshot at
`2026-09-22T17:05:37.831449Z`; the local backend was not reachable on port
19000 during this review, so they are not a fresh live audit.

## Existing architecture

- `apps/backend` uses Medusa v2.21.0, TypeScript, built-in Product, Inventory,
  File, and Admin capabilities. The custom Etsy module and optional Stripe,
  Shippo, tax, Resend, Redis event-bus, workflow, and locking providers are
  configured in `apps/backend/medusa-config.ts`.
- `apps/storefront` uses Next.js 15.5.24 App Router, React 19, Tailwind 3, and
  the Medusa JS SDK. Product routes live under
  `src/app/[countryCode]/(main)/products/[handle]`.
- The built-in Medusa Admin is extended by routes for product labels and Etsy
  orders. There is no hair-claw template or image-management admin page.
- Staging runs separate backend and storefront containers with PostgreSQL 17
  and Redis 7.4 on the Proxmox VM. The preview is behind a Cloudflare Tunnel;
  backend/Admin access is private. This is not the production deployment.
- Medusa's S3-compatible file provider writes to Cloudflare R2 and serves
  product media through `cdn.rustichalo.com`. Existing catalog media were
  copied and checksum-verified, but some source URLs represented resized
  editorial images rather than original full-resolution photographs.
- The storefront uses `next/image`, but `next.config.js` sets `images.unoptimized`
  to `true`. Product/gallery CSS crops with `object-fit: cover`; there is no
  hair-claw derivative generator or image-optimization pipeline in this repo.
  Sharp 0.34.5 appears transitively in the lockfile through Next.js, but is not
  an explicit backend dependency.

## Existing products and variants

- The saved staging snapshot has 247 visible products and 868 variants. Sixty-six
  products are typed `Hair Claw`, with 607 variants in total. The frozen
  24-product opening proposal contains ten hair claws and 78 of its 102
  variants. This is a snapshot, not a fresh live count.
- Products are identified through current handles, imported Shopify IDs,
  product type/collection, and selected hair-claw metadata. Title matching alone
  is insufficient. The existing `hair-accessories-claws-and-clips` collection
  and `source_product_type` metadata are useful candidate filters, followed by
  an explicit reviewed product-ID list.
- Imported records preserve Shopify product and variant IDs in metadata.
  SKUs vary by product; some encode size with `-4`/`-2`, while others include
  style tokens. Never infer Size solely from SKU text.
- A prior staging-only workflow added a Medusa `Color` option to some products,
  preserving other options such as Size/Style/Finish. Its color variants have
  metadata `base_sku`, `base_claw_color`, and
  `inventory_mode=made_to_order_color_option`; the product-creation helper uses
  `product_template=rustic_halo_hair_claw_v1`. It checks SKU collisions and
  preserves pre-existing inventory levels. New color variants have inventory
  items but no stocked levels; they allow backorders. Market Suite inventory
  synchronization remains disabled.
- The deployed color policy uses CREAM, SKY BLUE, OCEAN BLUE, MINT, SAGE,
  BLUSH, TAUPE, TERRACOTTA, ESPRESSO, SLATE, NAVY, and Black. The requested
  Black/Espresso/Mocha/Chocolate/Caramel/Khaki/Taupe/Sand/Ivory/Gray/
  Terracotta/Rose palette is a *different* twelve-color vocabulary. It cannot
  silently replace the existing option values, SKU suffixes, or Etsy mapping.
- Several products already have 2-inch and 4-inch variants, but no approved
  independent second-size image template or recolor/protected masks are present
  in this repository. The 4-inch photographed source/master described in the
  brief is also not present here as an approved layered asset. Current CDN
  product photos should not be assumed to be suitable masters.

## Current storefront behavior and gap

- `src/lib/data/products.ts` requests variant options, calculated prices,
  inventory quantities, and variant images from Medusa without caching.
- `product-actions/index.tsx` matches a variant by selected option IDs and
  updates price, availability, add-to-cart, and `v_id`. `option-select.tsx`
  renders generic text buttons for every option, including Color.
- The product page server component filters its gallery to the selected
  variant's associated Medusa images when `v_id` is present, otherwise it shows
  product images. The gallery itself does not respond directly to local option
  state; the URL/navigation path drives the image change.
- The homepage has color swatches for actual Medusa Color options and prefers
  variant images when attached. The saved appearance review notes that most
  Seashell Hair Claw colors currently share an image association. Swatches can
  therefore change the selected variant without showing a distinct color photo.
- Product options initialize independently of incoming `v_id`. The URL-sync
  effect can clear a variant deep link before options are hydrated. This should
  be fixed in the storefront phase, with regression coverage.

## Recommended model

Keep the Medusa Product as the engraving-design listing and its Size and Color
product options as the purchasable combination. Keep Medusa variants as the
source of truth for SKU, price, inventory, availability, and images. Do not
create one Product per color. For existing products, retain legitimate Style or
Finish options and map their actual combinations rather than forcing every
listing into a two-option shape.

Add an isolated `hair_claw_media` backend module only for reusable image data:

- `PhysicalTemplate`: stable ID, physical size/dimensions, approved source
  asset/version, geometry, allowed colors, active flag. A second size needs its
  own actual photographed source, mask and geometry.
- `ColorDefinition`: stable ID, display name, legacy option aliases/SKU
  mapping, provisional swatch, calibrated processing profile and reference
  photo/version, sort order, enabled flag. The catalog's current palette remains
  active until the owner approves a migration to different colors.
- `BackgroundTemplate`: source asset/version, kind, default/positioning rules,
  enabled flag. Background replacement is allowed only when the product has a
  separately approved transparent cutout and shadow treatment.
- `DesignAsset` / `ProductImageRecipe`: per-design approved photograph or
  composite, template ID and version, exact claw-body mask, protected
  wood/engraving mask, optional cutout/shadow, alignment, default size/color,
  review state, and product link. Geometry may be reusable, but a mask approved
  for one engraving photo must not automatically be reused on another.
- `GeneratedAsset`: recipe and source hashes, processing version, Size/Color/
  Background IDs, output hashes/URLs, validation result, status, and approval
  timestamp. Link approved outputs to existing Medusa product/variant media.

Use typed module models and Medusa module links for product association; reserve
metadata for compact IDs and compatibility markers. Preserve immutable original
assets in private storage; only approved public derivatives belong in R2's
public product-media bucket.

## Recommended image process

1. Intake an approved high-resolution, color-managed photograph/layered master
   for one 4-inch design. Reject files with unsupported MIME, excessive size,
   incorrect dimensions, or unapproved source. Store original bytes and hash.
2. Produce and manually review a pixel-accurate plastic-body mask and a
   protected wood/engraving mask. Reject overlap, wrong dimensions, or a mask
   touching product geometry outside the approved plastic region.
3. Use deterministic processing (Sharp is a reasonable explicit backend
   dependency) to recolor only plastic pixels while retaining the original
   luminance/detail. Keep the approved source pixels outside the mask intact
   in a lossless intermediate. Calibration must use real claw reference photos;
   arbitrary swatch hex codes are not production color targets.
4. If using a new background, composite an approved product cutout/shadow over
   it. Validate protected product pixels *before lossy encoding*. Export square
   product images plus bounded WebP/JPEG derivatives. Never resize a 4-inch
   claw to pretend it is the second physical size.
5. Key generated assets by source/mask/template/color/background hashes and
   processing version. Generate only approved combinations needed for actual
   variants; process them in a background job, not a shopper request. Stage
   each output, test exact protected-pixel equality and mask exclusion, then
   associate it with a variant after review. Failure leaves existing media.

Sharp supports compositing and channel operations; it is suitable for an
initial proof, but the four target colors must be visually checked against
physical references. No image engine can infer a faithful new physical size or
recover an untouched wood insert from a flattened, low-resolution source.

## Admin and migration sequence

1. Owner reviews this architecture, chooses the actual first 4-inch master,
   and reconciles the requested palette with currently sold colors/SKUs.
2. Add read-only inventory/shape audit for the reviewed hair-claw product IDs:
   options, variants, SKU/barcode, inventory items and levels by location,
   price, image associations, metadata, publication, and Etsy mapping. Save a
   rollback manifest; do not change source records.
3. Add versioned media module/models and authenticated Admin-only API. Build a
   product widget for hair-claw recipes plus separate Template, Color and
   Background management pages. Preview and Generate stay distinct; publishing
   remains an owner action.
4. Implement deterministic 4-inch image proof for **one** reviewed product and
   Ivory/Rose/Black/Espresso *only if real matching physical colors exist*.
   Validate protected pixels and mask overlap; keep existing images attached.
5. Add Size/Color storefront selectors and direct image response to variant
   choice, preserving other options and incoming `v_id`; cover price, SKU and
   availability behavior on mobile and keyboard.
6. Add the second physical size only after its independent approved source and
   mask exist. Then preview an idempotent, reversible migration for selected
   legacy products before any catalog-wide association or Etsy change.

The next milestone after approval is the data model and single-product proof,
not bulk generation. No existing product, SKU, inventory level, publication
state, Etsy listing, or image association changes in Phase 1.

## Owner palette decision and Phase 2 local handoff

The owner confirmed that the requested Black/Espresso/Mocha/Chocolate/Caramel/
Khaki/Taupe/Sand/Ivory/Gray/Terracotta/Rose palette **replaces** the currently
sold color palette. This is the target vocabulary, not an authorization to
guess old-to-new color mappings or change existing variants immediately.

Local, unapplied Phase 2 groundwork now includes:

- A registered `hair_claw_media` Medusa module with draft-capable physical
  templates, global colors, backgrounds, and per-design recipes. A Product-to-
  recipe module link preserves Medusa's existing product/variant system.
- A generated initial migration in
  `apps/backend/src/modules/hair-claw-media/migrations/`. It has **not** been
  applied to the local, staging, or production database.
- `replacement-palette.json` with the twelve owner-selected names and slugs.
  Swatches, image-processing values, and reference photos remain uncalibrated.
- `scripts/preview-hair-claw-palette.cjs`, a read-only comparison against the
  existing SKU policy. Four names overlap; eight target names are new and eight
  existing names will eventually retire. It performs no catalog write.

Verified locally: backend TypeScript check and read-only palette comparison.
Remaining for Phase 2/3: review a real full-resolution 4-inch master and mask,
calibrate physical colors, decide a per-variant transition map, test the
migration in an isolated database, and build the single-product image proof.
The mounted `NAS/Assets/Hair Claws` folder has LightBurn design files but no
JPEG/PNG/WebP/TIFF photo in its immediate file inventory; the approved photo
location is still needed.
Existing Medusa/Etsy option values, SKUs, inventory, media, and public pages
have not changed. No deployment occurred.

### Storefront proof sizing correction — September 27, 2026

The Healing Hearts visual-only proof had per-color, non-uniform X/Y CSS image
scales. That made the same physical claw appear to change its proportions and
size between color selections. The storefront now presents every proof asset
at its native, shared square-canvas scale in both the main gallery and its
thumbnails. No product media, catalog options, variants, pricing, inventory,
or publication state was changed.

The supplied color assets still come from separate flattened reference images.
If their source framing differs, the durable fix remains a single approved
master plus a protected plastic-body mask and deterministic derivatives, as
described above. Do not use CSS distortion to conceal source-image differences.

### Blank master color-variant proof — September 27, 2026

The owner supplied `Untitled.tiff`, a 2400 × 2400, 16-bit RGB TIFF with alpha,
as a new blank hair-claw master. The original remains in Downloads and was not
modified. Twelve transparent PNG proof derivatives are in
`apps/storefront/public/images/hair-claws/master-variants/`: Black, Espresso,
Mocha, Chocolate, Caramel, Khaki, Taupe, Sand, Ivory, Gray, Terracotta, and
Rose.

Each derivative retains the source canvas dimensions and alpha channel exactly;
the central wood-insert region is unchanged. Only the visible plastic body was
color-treated. These are local visual masters, not linked to Medusa variants,
not deployed, and not approved for catalog use until the owner reviews their
physical color match and the intended engraved design is composited.

### Per-design portrait presentation — September 27, 2026

The storefront gallery now recognizes the Product metadata value
`gallery_orientation: "portrait"`. When present, the main gallery and proof
thumbnails use the same 4:5 portrait frame for both the themed primary and the
white-background color images. Products without that metadata, including the
current Healing Hearts proof, keep the square presentation. A new design must
have its themed and catalog derivatives generated on the matching portrait
canvas; CSS changes presentation only and never crops or stretches the product.

### Physical color reference received

The owner supplied a 12-claw color chart on 2026-09-22. A byte-for-byte copy
is retained locally at `.local/hair-claw-media/references/physical-claw-colors-12.jpeg`
(git-ignored); the original Photos Library file was not changed. The JPEG is
1468 x 1380 pixels, 210,358 bytes, with SHA-256
`fa6cc66a86253b4967c119a80915bf5fb5e0a0581e28980b985c48dc2980ad0b`.
It shows three columns by four rows of undecorated physical claw colors.
The owner confirmed the left-to-right, top-to-bottom mapping:

| Row | Left | Middle | Right |
| --- | --- | --- | --- |
| 1 | Black | Espresso | Mocha |
| 2 | Chocolate | Caramel | Khaki |
| 3 | Taupe | Sand | Ivory |
| 4 | Gray | Terracotta | Rose |

It can guide provisional swatch and color calibration, but
its screenshot origin, white background, and lack of wood veneer/engraving mean
it is **not** the approved full-resolution product master or a pixel-protection
mask. Do not derive calibrated color values or finished variant imagery from it
until a real product master and physical samples are reviewed.

### Target product-page experience reference

The owner also supplied a 1254 x 1254 PNG showing the intended presentation of
one hair-claw design in all twelve colors. A byte-for-byte, git-ignored copy is
at `.local/hair-claw-media/references/hair-claw-variant-experience-example.png`
(SHA-256 `1d7d2b9344c79a50f0b548e4fbb3b7a381d815b8b2912b6c89861a894a92d155`).
The Downloads original was not changed. The twelve small, labeled product
images are the owner's examples of how each **physical claw color should look
with the same wood veneer and engraved design**. They are color-appearance
references as well as a presentation example, not proof that production-ready
variant images already exist.

The single-product proof should preserve the same wood veneer and engraved
design while changing only the physical claw/base color. It should show a
dominant square product image; the twelve named, accessible color choices;
and corresponding variant thumbnails when actual approved images are available.
Selecting a color should update the main image and selected state without
changing the product route or the underlying engraving/design; a variant query
parameter may preserve a shareable selection. The example's
right-side swatch rail is a desktop composition; mobile should keep all colors
reachable without horizontal overflow. Use the small images to review visual
color matching, while preserving the original composite and avoiding lossy
crops as final storefront assets.

### First 4-inch proof source selected

The owner selected the **Floral Nurse Hair Claw Clip** (floral stethoscope and
flowers) as the first design for the local color proof. The attached Photos
preview is 886 x 886 pixels; its byte-for-byte local copy is
`.local/hair-claw-media/references/floral-stethoscope-photo-derivative.jpeg`
(SHA-256 `195d008d89e200c374287814de65a696561ebae06f5a4b3b3efdedfbc7ff2931`).
A visually matching 2048 x 2048 image was found in the product's public
Shopify listing and retained at
`.local/hair-claw-media/references/floral-nurse-shopify-primary.jpg`
(SHA-256 `0c88a2d853960098e3c496c505de174deecf9e3b5700112689ec377970e58a36`).
Use this larger file as the **candidate local proof master** while preserving
its original bytes. It is a CDN-served JPEG, not a verified uncompressed camera
or layered original; obtain an original export before production if the proof
reveals edge or color artifacts.

The owner-supplied `Photoroom_20260812_115647.jpg` URL resolves to a different
cat-and-dog heartbeat design. Local copies of its 2048-pixel source and
1440-pixel derivative are references only and must **not** be associated with
the floral nurse product.

The public Shopify listing's 4-inch option was SKU `39082-4` at the time of
this check. The local Medusa readiness snapshot lists existing color-specific
`39082-4-*` variants using the outgoing palette. Inspect fresh Medusa options,
SKU, prices, stock by location, and image associations before any product or
variant write. This source selection does not apply the replacement palette,
change Shopify/Etsy/Medusa records, or approve generated images for sale.

## Phase 3 local image-engine proof — draft, not approved

`apps/backend/src/modules/hair-claw-media/image-engine.ts` now contains a
deterministic Sharp-based recolor function. It requires same-size opaque binary
plastic and protected PNG masks, rejects their overlap and invalid inputs,
changes only plastic-mask pixels, retains source RGB values everywhere else,
exports a lossless PNG, and keys the result to the source, masks, color profile,
and processing version. Sharp 0.34.5 is now an explicit backend dependency.
The focused unit test covers exact untouched pixels, mask overlap, wrong-size
and nonbinary masks, and stable cache keys. Backend typecheck, focused test,
lint (no errors in the new engine), and production build passed. The full build
still reports 159 pre-existing lint warnings and zero lint errors.
The local pnpm add command exited on the repository's build-script approval
policy; the minimal explicit dependency/lockfile entry is retained and the
installed Sharp binary works locally. A clean CI/staging dependency install
still needs verification before deployment; do not relax the build policy just
to bypass that check.

For the selected Floral Nurse source, local-only draft masks and Black/Ivory/
Rose/Espresso previews are under `.local/hair-claw-media/floral-proof/`. A
separate real-image decode comparison found **zero changed pixels outside the
plastic mask and zero changed pixels in the protected region** for each draft.
These files are git-ignored and were not uploaded or attached to Medusa.

The visual proof **fails product-quality review**: the nearly black, compressed
studio source has too little visible shading information for faithful light
colors, and its dark background complicates the outer plastic edge. Ivory and
Rose drafts look flat/blocky and retain obvious black seams. The current mask
and color profiles are provisional, not approved production assets. The other
public gallery images show a backside or different painted products/designs,
so they do not replace this source for the selected proof.

Next: obtain or photograph the **same finished Floral Nurse 4-inch design** on
a lighter neutral claw, straight-on, evenly lit, preferably against a plain
background and exported at original resolution. That will provide real body
highlights and shadows for an accurate mask and lighter-color calibration.
Keep the current black photo as an existing Black variant reference. Do not
generate or publish catalog-wide colors, alter existing SKUs/inventory, or
enable syncing from these draft images.

### New Floral Nurse camera original received

The owner supplied an original 4032 x 3024 HEIC camera photo on 2026-09-22.
Its byte-for-byte local copy is
`.local/hair-claw-media/references/floral-nurse-light-original.heic` (SHA-256
`7f3194114aa085f722f579e31303d3d52f018f2d2aa64f06e8aab1e1fe772cf7`).
The Photos Library original was not changed. The local HEIC decoder could not
render its HEVC image, so a local `heif-convert` utility was used to make a
lossless PNG viewing copy. A 3024 x 3024 center-cropped preview is at
`.local/hair-claw-media/references/floral-nurse-new-photo-square.png`; the
entire claw remains in frame. Both derivatives are git-ignored and local only.

Visual inspection confirms the same floral stethoscope engraving on a physical
claw. It shows a **purple** body, which is outside the requested twelve-color
replacement palette, and a bright pearl-like insert rather than the pale
natural-wood appearance of the existing Shopify primary image. Its straight-on
detail is useful for mask and geometry research. On 2026-09-22 the owner chose
the **existing Shopify image and its wood/engraving finish as the canonical
Floral Nurse master**. The purple photo is therefore reference-only; do not
replace the Shopify insert with the pearl-like insert or composite their
different camera views. The dark purple body also does not provide the
highlight detail needed to derive accurate Ivory/Sand/light colors.

The local Espresso draft from the Shopify source was visually rechecked after
that decision. Despite exact protection of the wood/engraving pixels, the
plastic looks flat and blotchy, with dark unrecolored seams; it is **not
approved for sale**. Black can continue using the unchanged Shopify photo.
For the lighter replacement colors, obtain a straight-on, evenly lit photo of
this same finished 4-inch Floral Nurse design with the same wood insert on a
light neutral claw, or separate approved layers photographed in one aligned
setup. Then revise and review its plastic/protected masks and physical color
calibration. No recolored variant from either photo was published, and no
Medusa, Shopify, Etsy, SKU, inventory, or sync setting was changed.

### Image-generation Rose proof — review only

A review-only Rose edit was generated from the canonical Shopify Floral Nurse
master and the physical twelve-color reference on 2026-09-24. It is retained
at `.local/hair-claw-media/imagegen-proof/floral-nurse-rose-v1.png` and was not
uploaded or connected to a product variant. The 1254 x 1254 result demonstrates
the intended colored-plastic presentation, but it subtly redraws wood grain and
engraving details instead of preserving them exactly. It therefore fails the
production invariant and must not be used as catalog imagery. The required
input remains aligned finished-product photography for each base color, or an
approved high-resolution plastic layer/mask and protected wood/engraving layer.

### Healing Hearts proof product selected — 2026-09-24

The owner superseded Floral Nurse as the first picker proof and selected the
stethoscope-heart design shown in the twelve-color experience reference. It
matches the existing staging product `healing-hearts-nurse-hair-claw` (SKU
`38716`). Its four existing catalog images were retained locally, unchanged,
under `.local/hair-claw-media/healing-hearts-source/`; the primary is a genuine
4032 x 4032 source and is the canonical Black image for this proof.

A first review-only Rose edit is at
`.local/hair-claw-media/healing-hearts-proof/rose-v1.png`. It is not uploaded or
associated with the catalog. Owner visual approval of the body color and exact
wood/engraving fidelity is required before producing the remaining colors or
building the image picker.

### Healing Hearts staging gallery proof — 2026-09-24

The owner approved the Healing Hearts visual direction and set the presentation
rule for this proof: every selectable base-color image uses the same clean white
catalog background, while the product's first image uses one unique themed
background. Twelve 1254 x 1254 white-background review assets (Black, Espresso,
Mocha, Chocolate, Caramel, Khaki, Taupe, Sand, Ivory, Gray, Terracotta, and
Rose) are retained under
`.local/hair-claw-media/healing-hearts-proof/white-background/`. A separate
healthcare-themed Black primary is retained as
`.local/hair-claw-media/healing-hearts-proof/primary-themed-v1.png`.

The storefront proof uses the themed image when the page first opens and uses
only white-background images in the color picker. Selecting a color writes the
`color` query parameter and changes the main image. Black remains the only real
Medusa variant; Add to Cart is disabled for the other eleven visual previews
and identifies them as preview-only. No Medusa product, SKU, price, inventory,
variant-image association, Shopify listing, Etsy listing, or synchronization
setting was changed. Storefront typecheck and lint passed locally. Staging
deployment and browser verification must be recorded separately before this
proof is considered deployed.

Staging deployment completed through the restricted storefront helper at
2026-09-24T17:12:32Z with state `complete` and stage `verified`. Safari review
confirmed the healthcare-themed image is the default primary, all twelve picker
tiles use white backgrounds, selecting Rose updates the URL to `color=rose` and
the main image to Rose, and the non-catalog color disables Add to Cart with
`Color preview only`. The initial Black/default state retains the real $14.00
catalog variant and enabled Add to Cart. The protected preview and production
were not changed.

### Reference-style gallery layout — 2026-09-24

The Healing Hearts staging proof now follows the owner's supplied layout: a
large primary image, twelve labeled white-background thumbnails in a 4 x 3
desktop grid, and a synchronized vertical twelve-color swatch rail. The prior
duplicate image picker was removed from the purchase column. Tablet and mobile
styles collapse the rail into a compact three-column control and the thumbnail
grid into three columns while leaving the normal product details and commerce
controls intact.

Local storefront typecheck, lint, and diff checks passed. The restricted
staging deployment completed at 2026-09-24T18:08:24Z with state `complete` and
stage `verified`. Safari review confirmed the default Black state displays the
healthcare-themed primary with Add to Cart enabled; selecting Rose through the
swatch rail updates the main image, matching thumbnail and swatch states, URL
`color=rose`, preview note, and disabled `Color preview only` purchase button.
No catalog, inventory, protected-preview, or production data changed.

Swatch hover preview was added on 2026-09-24. Pointer hover and keyboard focus
temporarily replace the main image with that color; leaving or blurring restores
the committed selection. Only a click commits the color, changes the URL, and
changes the preview-only purchase guard, so browsing colors cannot accidentally
change cart state. Touch remains click-only. Typecheck, lint, and diff checks
passed, and the restricted staging deployment completed at
2026-09-24T19:59:50Z with state `complete` and stage `verified`.

The initial hover implementation briefly restored the committed image between
adjacent swatches because each `mouseleave` cleared the temporary preview. The
owner requested continuous traversal instead. The preview now remains on the
last hovered or focused color until another swatch is touched or clicked, so
moving up or down the rail changes directly from one color image to the next.
Typecheck, lint, and diff checks passed; the corrected staging deployment
completed at 2026-09-24T20:10:34Z with state `complete` and stage `verified`.

The color proofs were measured against their white canvases and differed by up
to roughly eleven percent in rendered product width. Per-color display scales
now normalize the visible claw size in both the main viewer and thumbnails
without modifying the source image files. A `Themed primary` rail control was
also added so the themed hero remains directly reachable after persistent hover
previews. Typecheck, lint, and diff checks passed; the restricted staging
deployment completed at 2026-09-24T20:16:22Z with state `complete` and stage
`verified`.

The first normalization pass animated changes between per-color scale values,
making Gray and other colors visibly resize during a swap. Transform transitions
were removed from the main and thumbnail images so each color now appears
immediately at its normalized final size. Typecheck, lint, and diff checks passed;
the staging deployment completed at 2026-09-24T21:00:09Z with state `complete`
and stage `verified`.

On 2026-09-25 the owner reported remaining differences and identified Terracotta
as the preferred size reference. The prior calibration matched image widths
only and had Terracotta slightly enlarged. Per-color horizontal and vertical
scales now match the full visible claw bounds to Terracotta at its natural
scale. This keeps the displayed object size consistent in both the main image
and thumbnail grid while retaining the original image files.

The owner-approved two-file update was deployed to staging on 2026-09-25. The
restricted storefront deploy helper reported `state=complete` and
`stage=verified` at 2026-09-25T12:58:43Z. Production was not changed. Final
visual confirmation on the owner's staging browser remains pending.

## 2026-09-27 staging follow-up

After the owner completed Cloudflare Access sign-in, the Healing Hearts page
was inspected and the existing color assets were measured. All twelve option
files and the themed primary are square 1254 x 1254 JPEGs, but the claw
silhouettes themselves differed in width by about 11%. The gallery now applies
one uniform scale per color, calibrated to Terracotta's visible width, and
keeps both primary and option-thumbnail frames square by default. Product
metadata can opt a product into portrait framing (`gallery_orientation:
"portrait"`) without changing the square default.

The restricted staging storefront deploy completed with state `complete` and
stage `verified` at 2026-09-27T19:20:40Z. Authenticated browser inspection
confirmed a 662 x 662 primary frame, twelve square option frames, and all
thirteen square image assets. The Black 4-inch variant and Add to Cart remained
available after page hydration. Production and catalog data were not changed.

A fresh read-only Store API check found five products with explicit 4-inch
variant option values (Top Down Hair Claws, Happy Cow Hair Claw, I Know A Name
Jesus Hair Claw, Chicken Chick Hair Claw, and Boho Gecko Hair Claw), in addition
to Healing Hearts; other listings mention 4 inches in product text but do not
encode it as an option. Their existing catalog photos are flattened images,
not isolated transparent overlays. Treat them as references only until a
human-approved plastic-body mask and protected wood/engraving mask are made for
each design. No other product images were recolored or published.

The owner then supplied two additional square photos of the 4-inch Taupe sample:
side profile (2048 x 2048) and back/clasp view (1512 x 1512). These were copied
without alteration into the Healing Hearts gallery as a clearly labeled
"Additional views · 4-inch Taupe sample" group, separate from base-color
choices. Selecting an option returns to its color-specific front image. The
restricted staging deploy completed with state `complete` and stage `verified`
at 2026-09-27T21:35:53Z. The authenticated browser loaded both new images,
confirmed both are square, verified the side/back selection behavior and
returned to the original URL with the Black variant and Add to Cart available.
Original downloads remain unchanged; production and catalog data were not
changed. A side-by-side 2-inch reference remains pending from the owner.

### Healing Hearts color-image refresh — 2026-09-28

Using the owner's existing Black front photo as the shared master, generated
square 1254 x 1254 color previews for the twelve displayed options. A first
strict dark-pixel mask left inconsistent sections along the claw's lower rim;
after the owner flagged it, the mask was expanded only through connected dark,
neutral body pixels. The corrected outputs retain the original decoded pixels
outside the plastic-body mask, including the wood and engraving. Lossless WebP
outputs are in `apps/storefront/public/images/hair-claws/healing-hearts/recolor-v2/`;
all option mappings use the same image scale. Working proofs and the rim QA
contact sheet are in ignored `.local/hair-claw-media/healing-hearts-color-proof-v1/`.

The owner's first restricted deploy completed against the VM's existing source,
before the local asset changes had been synced; the new Espresso URL returned
404. The exact updated color-map file and twelve WebPs were then copied to
`/home/shawnhouse/rustic-halo-staging/source`, with hashes verified against the
local copies, and the storefront was redeployed. The restricted helper reported
`state=complete`, `stage=verified` at 2026-09-28T00:56:05Z. Authenticated staging
checks loaded Espresso and Ivory at 1254 x 1254, selected Espresso as a
visual-only preview, and confirmed the existing Black variant's Add to Cart
control after hydration. No Medusa/Etsy catalog data, inventory, production
assets, or production services were changed. The two-inch comparison is still
pending from the owner.

### Healing Hearts approved layout and color refresh — 2026-09-28

After the owner refined the front layout (wider, smoother lower lip; centered
wood insert; softened shadow; underside bumps removed), individually generated
color outputs were rejected because their apparent product scale varied. The
final 13-color set instead uses one approved 1254 x 1254 taupe layout master
and a shared plastic-body mask, so color choices retain identical framing and
geometry. The set includes the existing twelve visual previews plus Purple,
matched to the owner's supplied color reference. Assets are in
`apps/storefront/public/images/hair-claws/healing-hearts/recolor-v5/`; the
contact sheet and rejected drafts remain in ignored `.local/hair-claw-media/`.

The storefront color map now points to `recolor-v5` and includes Purple as a
visual-only preview. No Medusa variant, price, inventory, or production data
was changed. Direct `next lint` passed with no warnings or errors. The updated
map and all 13 image hashes matched after copying to
`/home/shawnhouse/rustic-halo-staging/source`. The restricted storefront deploy
reported `state=complete`, `stage=verified` from 2026-09-28T02:13:48Z to
2026-09-28T02:15:48Z. Authenticated staging inspection loaded the product page
with Purple selected and its purchase control correctly disabled as
`COLOR PREVIEW ONLY`; the direct Purple asset loaded at 1254 x 1254. Production
was not changed.

### Healing Hearts plastic finish cleanup — 2026-09-28

The owner flagged mottled, rubbed-looking color-option images. The defect was
in the generated Taupe plastic master, not a staging synchronization issue.
After the owner approved a smoothed proof, the cleaned plastic was composited
only within the claw-body mask; the wood insert, engraving, square framing, and
approved layout remain intact. A new 13-color set was generated at 1254 x 1254
in `apps/storefront/public/images/hair-claws/healing-hearts/recolor-v6/`, and
`healing-hearts-colors.ts` now points to v6. The contact sheet and build script
are in ignored `.local/hair-claw-media/healing-hearts-layout-v3/`.

Storefront lint passed without warnings or errors. The updated map and all 13
assets were copied to staging and remote SHA-256 hashes were captured. The
storefront deploy helper was launched; its terminal session ended before its
final JSON could be retained, so completion was verified by opening the staging
product page with Purple selected and loading the v6 Purple WebP directly at
1254 x 1254. The existing `COLOR PREVIEW ONLY` purchase guard remained in place.
Production and catalog data were not changed.

### Happy Cow visual color previews — 2026-09-28

Using the existing 4-inch Happy Cow front photo as the temporary master, created
13 square 1254 x 1254 previews with one consistent crop and a deterministic
neutral-plastic mask. The wood insert and cow engraving remain visually
consistent across the set. Lossless WebP assets are in
`apps/storefront/public/images/hair-claws/happy-cow/recolor-v1/`; source photo,
build script, PNG proofs, and contact sheet are in ignored
`.local/hair-claw-media/other-4-inch/`.

Added a visual-only preview picker for the standard 4-inch Happy Cow option.
The picker is hidden for 2-inch and Colors by Cate variants and does not change
the URL, selected purchasable variant, price, availability, inventory, or cart
behavior. Storefront lint and typecheck passed; all 16 storefront tests passed.
The owner transferred the approved bundle and the restricted storefront deploy
reported `state=complete`, `stage=verified` at 2026-09-28T17:18:02Z. Authenticated
staging inspection confirmed the 13 previews render for standard 4-inch, with
Mocha selected while the 4-inch variant, $14 price, and Add to Cart remain
unchanged; selecting the preview did not add a `color` URL parameter. Selecting
2-inch removed the preview picker and showed the original gallery, $10 price,
and 2-inch variant with Add to Cart available. The Colors by Cate 4-inch choice
also remained outside the preview picker. The cart was not submitted and no
Medusa variants, pricing, inventory, or production services were changed.

### Additional 4-inch color previews — prepared for staging

Prepared square, same-framing 13-color visual preview sets from the existing
front photos for Top Down, I Know A Name Jesus, Chicken Chick, and Boho Gecko.
Each design uses its own neutral-plastic mask; wood overlays, engraving, and
Chicken Chick's colored artwork remain intact. The picker only appears on each
product's standard 4-inch size, and remains hidden for other sizes and Colors by
Cate. Preview selection does not change the URL, purchasable variant, price,
availability, inventory, or cart behavior.

Storefront lint, typecheck, and all 7 current storefront tests passed. Contact
sheets and the source-specific build script are in ignored
`.local/hair-claw-media/other-4-inch/`; deployable WebP assets are in
`apps/storefront/public/images/hair-claws/{top-down,jesus,chicken-chick,boho-gecko}/recolor-v1/`.
Initial staging deployment completed at 2026-09-28T18:29:02Z. Browser QA
confirmed the Top Down preview appears after selecting 4-inch, and color changes
preserve its 4-inch variant ID and $12 price. QA also found option labels vary:
Chicken Chick uses `size`, Jesus uses `Finishes` with `Natural 4"`, and Boho
Gecko uses `Color` with `neutral 4"` versus `Colors by Cate 4"`. The eligibility
check now examines the selected value and excludes painted/Cate values. The
corrected bundle is ready for a follow-up staging deploy; verification of all
four products and the Cate exclusion remains pending. Production and catalog
data remain unchanged.

### Consolidate standard 4-inch color previews — 2026-09-28

Decision: do not maintain separate 13-color composite preview sets for each
design. The intended reusable system is one shared set of standard 4-inch
claw-body colors with each design's wood/engraving applied as an overlay; do not
generate more per-design color composites. The four additional design-specific
preview sets and picker wiring have been removed from the local working copy.
Their local image assets and proofs were moved to the ignored
`.local/hair-claw-media/retired-four-inch-previews/` recovery folder, not
permanently deleted. Happy Cow and Healing Hearts assets remain untouched.

Staging cleanup removed the four corresponding generated asset folders and the
stale transfer bundle. No deploy was run. The staging root filesystem remains
full (0 bytes available), and read-only checks found three source files at
zero bytes in the staging checkout (`image-gallery/index.tsx`,
`product-actions/index.tsx`, and `other-four-inch-colors.ts`). The two TSX files
have verified local recovery copies in `/tmp/rh-image-gallery-index.tsx` and
`/tmp/rh-product-actions-index.tsx`; restoration and any further staging work
are pending. Diagnose disk use before building or deploying. Production and
catalog data remain unchanged.

### Cleanup and source recovery — 2026-09-28

Both damaged TSX files are restored on staging; SHA-256 checks match their
recovery copies. The unused zero-byte `other-four-inch-colors.ts` module was
removed after confirming no remaining imports. The owner completed targeted
Docker image cleanup; a fresh SSH filesystem check reports 31 GB used and
120 GB available (21% used). The cleanup command retained the running images
and latest storefront/backend rollback tags; its final Docker inventory still
requires interactive sudo output for independent tag verification.

Unused Healing Hearts `recolor-v2` and `recolor-v5` image sets were removed from
the staging source after their checksums matched the local copies and both
source trees referenced only `recolor-v6`. Local copies were moved into ignored
`.local/hair-claw-media/retired-healing-hearts-previews/` for recovery. The four
other design-specific sets remain in
`.local/hair-claw-media/retired-four-inch-previews/`. This cleanup does not
implement the future shared color-base plus wood-overlay renderer.

The cleanup source is ready for one staging storefront deployment; the running
container still has its preceding assets until that deployment completes.
Storefront lint and typecheck passed, `git diff --check` passed, and both the
existing storefront and backend local HTTP endpoints returned 200 after cleanup.
Administrator authentication is required through the fixed operations helper.
After deployment, check the source cleanup on a representative additional
4-inch product and confirm Happy Cow/Healing Hearts still render correctly.

### Cleanup deployed; shared-layer proof — 2026-09-28

The operations helper confirms the cleanup storefront deployment completed at
2026-09-28T22:16:59Z. The current Healing Hearts v6 and Happy Cow v1 assets
return HTTP 200 from the running storefront; retired Healing Hearts v2/v5 and
Boho Gecko v1 assets return HTTP 404. Both services are running, with backend
health reported healthy. Disk availability after that build is 118 GB.
The browser's Cloudflare session expired during inspection, so an authenticated
product-page visual pass remains pending.

A separate working proof now lives at
`apps/storefront/public/previews/shared-hair-claw/index.html`, with reusable
SVG composition in adjacent `compositor.js`. It reuses the existing 13 color
photos for jaw shading, uses one smooth filled front-body contour for all
designs, and clips the original Healing Hearts/Happy Cow wood photographs into
independent layers. The original photographs remain unchanged. Happy Cow needs
only one source file at `public/images/hair-claws/overlays/happy-cow-source-v1.jpg`;
Healing Hearts references its existing Taupe image. No new per-design color
image sets were generated. This is a template/alignment proof, not the Medusa
upload/on-save pipeline or a finished replacement of the product galleries.

Local browser checks passed for all 13 color mappings, unchanged wood source
across color selection, square framing, vertical rotation, layer visibility,
and wood-size adjustment. JavaScript syntax and diff whitespace checks passed.
The local proof is served from the storefront public directory on port 18765;
its staging URL is `/previews/shared-hair-claw/index.html`.

The dedicated `.local/staging-access/id_ed25519` key can invoke the fixed
operations helper with `sudo -n`; general Docker commands still require
interactive sudo. The proof deployment completed at 2026-09-28T22:35:38Z with
`state=complete`, `stage=verified`. All three files served by the running
storefront return HTTP 200 and match the checked local SHA-256 hashes. Free
disk space after this build is 116 GB (23% used). The proof was visually checked
locally; the staging browser still needs Cloudflare sign-in. The local proof
tab was retained and opening it in the Codex panel was queued.
Next: review the common outline/wood alignment, then
connect the compositor to product galleries and add the remaining design
recipes. Actual product/variant selection and purchase logic stay independent
of this visual proof.

### Solid-body and curved-end proof refinement — 2026-09-28

The shared compositor now fills the entire plastic body and handle with the
selected palette color. Removed the raster jaw shading/mask and body gradient;
wood remains an independent photo layer. The owner's IMG_1745 reference informs
slightly bowed ends and rounded corners on the Healing Hearts wood clipping
contour. This is a visual approximation, not measured manufacturing geometry.
Happy Cow retains its existing curved photographic clipping contour.

All 104 design/color/orientation/visibility composition checks passed; local
browser inspection passed horizontally and vertically. Original wood photos,
square framing, and product purchase behavior remain unchanged. Use the HTTP
proof on port 18765 or the staging proof URL, not a file URL with root-relative
image paths. Deployment completed at 2026-09-28T22:52:28Z with helper status
complete/verified. The served compositor returns HTTP 200 and SHA-256
f17cd4193aa301850e5d5e5fbb4c289dab6049829f972b828d07e11450ae94d6,
matching local source. Authenticated staging visual review remains pending;
the horizontal and vertical visual checks above were local.

### Healing Hearts border refinement — 2026-09-28

Tightened the upper wood crop to exclude the original taupe plastic visible
in the Purple proof. Expanded the Healing Hearts wood placement independently
in X/Y to leave approximately three-quarters of the previous plastic border,
retaining curved ends. This only adjusts the shared proof recipe, not catalog
images or source photographs. Local Purple visual check and JavaScript syntax/
diff checks passed. Deployment completed at 23:01:07Z after a necessary
cache correction: index.html imports compositor.js?v=20260928-rim2.
Authenticated staging Purple visual inspection and DOM geometry verification
passed at /previews/shared-hair-claw/index.html?v=20260928-rim2. The old taupe
strip is excluded and the narrower plastic lip is visible. Product galleries
remain unchanged; review the proof before extending this recipe further.

### Expanded wood-size control — 2026-09-28

The proof slider now spans 90–103% in 0.25% steps, retaining the 100% default.
The compositor accepts the same range; invalid/out-of-range inputs still fail.
Local maximum-size visual inspection shows Healing Hearts approaching the
placement edges with a thin plastic lip. All 208 combinations of design, color,
orientation and sampled size passed, plus invalid-range checks. Module cache
version is now 20260928-size3. Staging deployment completed at 23:28:34Z,
complete/verified. The authenticated browser confirmed slider max 103,
step 0.25 and rendered scale(1.03) at the maximum. Product galleries unchanged.

### Shading restoration and aspect-ratio review — 2026-09-28

Restored smooth neutral SVG handle highlights, recessed shading, and rim depth
over the fully opaque shared palette body. No raster recoloring or wood-source
changes. Removed Healing Hearts scale(1.008 1.06), which stretched height about
5.16% relative to width; placement now uses uniform scale(1.008), as does the
wood-size slider. This exposes more top/bottom lip instead of distorting art.

Compared IMG_1745 (light-table blank) visually with the wood crop: the reference
appears roughly 2.7:1 versus roughly 3:1 in the current crop. Perspective and
rounded/curved boundaries prevent using this as an exact physical measurement.
Need original cut SVG or measured width/maximum height for authoritative shape
matching; do not claim the current recipe matches the physical blank exactly.
156 composition checks and uniform-scaling assertions passed. Local Taupe
visual review passed. Version shade4 deployed complete/verified at 23:40:20Z;
authenticated staging Taupe visual review confirms shading and uniform wood
placement. Product galleries remain unchanged.

### Uploaded SVG sizing guide — 2026-09-28

Read owner-supplied /Users/shawnhouse/Downloads/overlay.svg. Its path bounds
are 101.524414 by 37.523926 mm in landscape, ratio 2.705594. Extracted its
line vertices into overlay-outline.js with rotation and uniform scaling only;
the source SVG is unchanged. The guide is 1080 units wide at 100%, following
the existing size/rotation controls, with a separate visibility checkbox.
It exposes the shallower existing photographic wood crop rather than stretching
artwork or claiming the photo now fits the true blank. Local visual review and
ratio/toggle assertions passed. Version svg5 deployed complete/verified at
23:57:26Z; authenticated staging visual inspection confirmed the guide.
Next: fit a wood/art layer to this authoritative contour; the current guide
does not change the photographic overlay or catalog galleries.

### Fixed physical outline and authorized force-fit — 2026-09-29

Owner explicitly authorized existing artwork distortion to fit the exact SVG,
and supplied 103 mm clip width. The target width is now clip contour width
times 101.524414/103, preserving SVG aspect ratio. Centered end allowance is
0.737793 mm each. This calibrates the preview to the owner's measurement; it
does not independently measure a physical clip. Guide geometry is fixed across
designs/colors; removed size slider. Orientation rotates the entire composition.

fit-outline.js fits source photo strips from each design's source contour to
the fixed SVG boundary. Shared shading is retained; source photos unchanged.
Happy Cow has a 4% inset crop to exclude photographed background/plastic edges.
Both existing proof designs are fitted; other catalog designs are not integrated.
52 composition checks verify finite transforms, invariant outline and physical
width/aspect ratios. Local visual checks passed for both designs. fit6 staging
deployment completed at 2026-09-29T00:11:31Z, complete/verified. Authenticated
staging visual check confirms fitted Healing Hearts and removal of size slider.

### Plastic corner refinement — 2026-09-29

Compared prior Taupe source with the proof: reduced squared-off lower plastic
corners using an outer contour following the SVG's rounded ends and bowed sides.
Retained the handle and shaded solid body. Froze the previous physical-width
calibration so this refinement cannot resize or move the wood. Overall clip
width remains 103 mm relative to the same fixed 101.524414 mm overlay.
52 composition/width/invariant-outline checks and local visual inspection passed.
Version corners7 deployed complete/verified at 2026-09-29T00:31:40Z and passed
authenticated staging visual inspection. This is a visual refinement,
not a measured tracing of the physical plastic's full outline.

### Handle shoulder fix and independent overlay slider — 2026-09-29

Removed the stepped shoulder junction introduced by corners7, blending both
handle sides into the body with curves. Added blurred side highlights/shadows
for a softer rounded handle. Restored overlay sizing at 90–101%, step 0.25%,
default 100%; only the fitted wood scales, never the SVG reference or clip.
The smaller upper limit keeps nominal wood width below the 103 mm clip width.
156 composition checks cover designs/colors/orientations/sizes and fixed guide
geometry, plus invalid range rejection. Local notch/shading visual review passed.
Version handle8 deployed complete/verified at 2026-09-29T00:45:47Z. Authenticated
staging Happy Cow/Mocha inspection confirmed the smooth junction and working
101% slider maximum. Catalog galleries unchanged.

### Natural-wood review batch 1 — 2026-09-29

Added I Know A Name Jesus and Boho Gecko to the shared proof, using the existing
local source photographs from .local/hair-claw-media/other-4-inch/sources/.
Copied each original once to public/images/hair-claws/overlays/; no color-specific
images created. Gecko uses a code-native 90-degree source rotation with matching
contour rotation. Source pixels remain unchanged. Both are visibly marked review
candidates. Jesus has source softness/glare; Gecko should also be reviewed in
vertical orientation. Local visual extraction checks passed for both.

Held Chicken Chick: saved source is visibly painted. Held Top Down: saved
source is strongly angled, requiring a better natural 4-inch photo or separate
perspective review. Neither was added. This is only the first saved-source batch;
remaining catalog photo discovery/review is not complete. Mixed 2/4-inch listings
remain eligible only for verified natural 4-inch source photographs.

312 design/color/size/orientation checks passed with invariant SVG reference.
Existing approved shape, shading, physical width and slider retained. No catalog,
variants, inventory, or product galleries changed. batch9 deployed complete/
verified at 2026-09-29T01:23:22Z. Authenticated staging inspection confirms
the four-design picker, review notices and Gecko rendering. Next milestone:
review these candidates and audit remaining catalog source photos in one batch.

### Admin overlay workflow — 2026-09-29, implementation staged; deployment blocked

Owner requested admin uploads connected to hair-claw products and a 2-inch /
4-inch choice for new products. Added a Hair-claw overlays admin route and a
product-detail editor (available even when imported product type is missing).
New drafts offer 2 inches, 4 inches, or both; no prices, stock, saleable variants,
publication, or sales-channel assignment are invented. Actual commerce variants
must still be configured in Products. No existing catalog records were changed.

Settings are versioned under product metadata `hair_claw_overlays_v1`, separately
per physical size. Authenticated upload normalizes a transparent PNG (8 MB,
6000-pixel side / 24 MP bounds), trims transparent padding, converts to sRGB,
and rotates portrait sources without deforming art. One file is retained per
upload; no per-color duplicates. Save uses a product-scoped lock, stale-editor
revision check, and preserves unrelated metadata. Remove clears the selected
recipe only, not product photos or uploaded files. Abandoned uploads currently
remain in file storage; automated orphan cleanup is not implemented.

The storefront wrapper supports configured products generically, uses explicit
Size option values to choose geometry, and retains original photos when no
approved recipe matches. Color controls are explicitly visual-only; they cannot
change variant, cart, inventory, URL, or price. The shared embed renderer uses a
single uniformly scaled image, not the legacy strip warp. The old batch proof
remains separate. 2-inch uploads may be saved as drafts, but enabling their
composite is blocked until a measured 2-inch base and outline are supplied.
Thus this is infrastructure for all claws, NOT a completed catalog conversion.

Files: backend `src/admin/components/hair-claw-editor.tsx`,
`src/admin/routes/hair-claws/page.tsx`, `src/admin/widgets/hair-claw.tsx`,
`src/api/admin/hair-claw-media/upload/route.ts`,
`src/api/admin/products/[id]/hair-claw-media/route.ts`,
`src/lib/hair-claw-settings.ts`, and upload body-limit middleware;
storefront `src/modules/products/components/shared-claw-gallery/index.tsx`,
product template wrapper, and public shared-hair-claw `compositor.js` / `embed.html`.
No database schema migration or new module registration required.

Validation: 7 focused backend unit tests passed (including normalization,
opaque-file rejection, size isolation, stale edits, and metadata preservation).
78 renderer combinations passed with one aspect-preserving image and escaped
URL attributes; unsafe protocols rejected. Both TypeScript checks passed and
storefront lint passed without warnings. Normal backend Jest configuration has
an existing unresolved `@medusajs/utils` import; focused tests used a direct SWC
Jest config. Full local Medusa build is blocked by a missing transitive
`@mikro-orm/postgresql` dependency; this is not a successful production build.

Scoped source files copied to staging. First backend build failed. Remote
backend lacked the local Sharp dependency; transferred package.json and applied
only the Sharp importer hunk via `deploy/staging/hair-claw-admin-sharp.patch`,
preserving remote ESLint lockfile differences. Retry also failed at build:
started 2026-09-29T02:14:20Z, failed 02:14:42Z. Existing backend remains healthy;
storefront was NOT deployed. Catalog unchanged; authenticated admin upload/save
and storefront visual QA are NOT verified. Operation log is root-only.

Next: owner runs `sudo tail -n 100 /var/lib/rustic-halo-ops/operation.log` and
shares the build error. Resolve that failure, deploy backend and storefront,
then verify a temporary draft end-to-end (upload, save/reload, size isolation,
original-image fallback, variant/cart behavior), followed by a reviewed real
overlay. Set `HAIR_CLAW_PREVIEW_ORIGIN` to the staging storefront origin if
STORE_CORS does not provide the correct preview address. Do not claim all
existing designs have been converted or that 2-inch geometry is ready.

### Admin build blocker resolved — 2026-09-29

Owner provided the exact two lint errors: Medusa admin route/widget exports
must be arrow-function components. Converted HairClawsPage and HairClawWidget
to arrow declarations with default exports; kept lint enforcement enabled.
Backend TypeScript check passed. Backend deployed complete/verified at
2026-09-29T13:49:37Z; storefront deployed complete/verified at 13:51:14Z.
Backend health returned 200. Unauthenticated overlay GET and upload POST both
returned 401, confirming these endpoints require admin authentication.

Established an SSH loopback forward on local port 19000. After owner sign-in,
browser verification at http://localhost:19000/app/hair-claws confirmed the
catalog picker loads, new drafts offer 2 inches / 4 inches / Both sizes, and
Healing Hearts settings load from the backend. Selecting 2 inches displayed
the measured-template-pending warning and retained disabled save without edits.
No catalog writes, uploads, new products, price/inventory changes, or overlay
activation were performed during this verification. Admin upload/save/reload
and a real composited storefront variant still need end-to-end validation with
a suitable transparent wood-only PNG. Existing 2-inch geometry remains pending.

### iPhone photo preparation — 2026-09-29, local checks passed; awaiting decoder installation

Owner authorized easier iPhone-photo uploads. Added `src/lib/hair-claw-photo.ts`,
admin `/hair-claw-media/prepare` POST, and `hair-claw-photo-upload.tsx` inside the
existing editor. Accepts still JPEG / PNG / HEIC bytes (24 MB / 60 MP bounds),
normalizes orientation and sRGB, limits working resolution to 2048 px, removes
border-connected plain background, and provides before/after review on a
checkerboard. Cleanup strength, crop percentages and rotation are adjustable.
Changes must be reapplied and edges explicitly reviewed before Use this overlay.
The existing validated PNG upload then stores the cutout; saving/enabling the
product recipe remains a separate, explicit step. No artwork is mesh-warped.
New photo processing never mutates a saved recipe. The old gallery fallback and
2-inch enable guard remain. Outline diagnostics use the supplied 48 x 30 mm
2-inch SVG dimensions, but the 2-inch plastic base is still missing.

This is plain-background color segmentation, not AI object recognition. Whole
assembled claws, patterned backgrounds, shadows, and low contrast may need a
closer crop or retake. Aspect mismatch warns about crop/tilt/size; it does not
claim to detect all perspective problems. There is no manual brush tool yet.

Privacy: originals stay in the owner's Photos library. Source bytes are sent
to the authenticated backend for temporary processing; no raw original is
archived in the public CDN. Temporary HEIC files are removed in finally. Only
the approved PNG cutout is stored, without camera metadata. The existing file
provider disables object ACLs, so `access: private` must NOT be treated as a
private archive in this deployment. No external AI/background-removal service
is used. Preparation responses have Cache-Control: no-store.

HEIC decoding uses fixed `/usr/bin/heif-convert` under `/usr/bin/prlimit`, with
2 GiB address-space, 30-second CPU, 300 MB output-file and 40-second wall limits.
Two preparations maximum per backend process; no URL fetching or user command
arguments. Multi-image/unsupported HEIC decode failures request a JPEG export.
`deploy/staging/ops/Dockerfile` adds libheif-examples and util-linux in the backend
stage only. These are NOT installed in staging yet. The protected operations
Dockerfile requires the owner to apply `/tmp/rh-enable-heic.patch` using:
`sudo patch --forward /usr/local/lib/rustic-halo-ops/Dockerfile /tmp/rh-enable-heic.patch`.
Patch source: `deploy/staging/ops/enable-heic.patch`. This changes no permissions
or services. Scoped application sources have been transferred but NOT deployed.

Validation: backend TypeScript passes; 14 tests pass across photo and existing
media suites (JPEG, transparent PNG, orientation/proportions, metadata stripping,
connected background vs enclosed engraving, failed segmentation, malformed
input/control bounds, and recipe safety). HEIC execution, browser review/upload,
and save/reload are pending deployed end-to-end tests; do not claim completion.
Next: owner confirms the protected Dockerfile patch, then deploy backend once,
verify health/authentication and photo review with a disposable fixture (no
catalog activation), test HEIC with a real supported sample, and record results.

### Resumption brief — 2026-10-10

Owner revisited page layout, image framing, overlays, and color changes and asked to recover the remaining photo-dependent work. Current brief reviewed; no catalog recipes, storefront source, or deployment changed in this review.

Remaining milestone: obtain straight-on, evenly lit source photos suitable for extracting natural wood overlays; pilot one verified 4-inch design through background/crop review, upload, alignment, save/reload and staging gallery verification. Keep source artwork proportional, the plastic outline stable across colors, and commerce selections/prices/inventory separate from visual previews. Then review remaining designs as a batch.

The 2-inch plastic template/outline still lacks recorded physical approval; do not enable that composite by resizing the 4-inch master. iPhone/HEIC preparation was recorded as locally validated but undeployed in the September 29 handoff; inspect the current staging runtime before assuming this blocker is still present or resolved.

A separate exploratory layout draft exists at `.local/hair-claw-layout-20261010/index.html`; it uses existing prepared photos, does not modify overlays, and is not applied. Its temporary preview server was stopped after the owner redirected work to this brief.

### Golden Love existing-photo trial — 2026-10-10

Reviewed four live gallery sources; the 4032px front photo supports a trial. Built-in ImageGen isolated a wood-only transparent overlay candidate; mild perspective was rectified. Candidate is not pixel-identical to the photo and needs engraving/border review before fitting or activation. No recipes or catalog assets changed. Files: `.local/golden-love-overlay-20261010/original-2.jpg`, `golden-love-overlay-draft-v1.png`, `sources.json`, `review.md`. Next: artwork review and fixed-geometry 4-inch color proof.

### Original Prompt Studio templates received — 2026-10-10

Shared original 2-inch and 4-inch SVGs copied byte-for-byte to `docs/reference-assets/hair-claws/`; hashes and source paths in provenance.json. Preserve red cut paths and black inset artwork boundaries. SVG physical dimensions: 2-inch 30.000 × 48.000 mm; 4-inch 37.524 × 101.524 mm. Use these supplied paths for overlay fit and shape review rather than a generated replacement silhouette. These wood/cut outlines do not independently verify the missing 2-inch plastic-body geometry. No storefront or deployment changes. Golden Love draft v2 remains a review candidate; template fitting and comparison still required.

### Golden Love 4-inch staging pilot completed — 2026-10-10

Applied owner-approved v2 artwork to Golden Love with all 13 visual claw colors and a 1.5875 mm (1/16-inch) reveal. Uses the original supplied 4-inch cut path rotated 180 degrees, uniformly fitted wood length 99.825 mm inside a 103 mm front. Source artwork and original gallery photos retained. This is a Golden Love-specific gallery branch; generic Admin recipes are unchanged.

Scoped staging commit `4f5f75655cfbc160a2e330a96a27fa669e942e06`, deployment `2mjzyvri3phsccfrsfzxpoc9` finished 2026-10-10 21:50:29 UTC; application running:healthy. Production build, typecheck, focused lint and diff checks passed. Active staging Golden Love tab verified all 13 selections, stable geometry and purchase URL, $14 price, enabled Add to cart, four original photos and no console errors. Before/after Store API catalog response identical. Phone visual check remains unverified because viewport override stayed at desktop width.

Files: `apps/storefront/src/modules/products/components/golden-love-gallery/index.tsx`, `apps/storefront/src/lib/brand/golden-love-overlay.ts`, `apps/storefront/public/images/hair-claws/golden-love/wood-overlay-v2.png`, and the Golden Love branch in `shared-claw-gallery/index.tsx`. Reports and screenshot: `.local/golden-love-apply-20261010/{release.json,verification.json,live-color-checks.json,product-before.json,product-after.json,staging-golden-love.png}`.

Remaining: connect this fitted rim renderer to saved per-product Admin overlay settings so new artwork/alignment can be published without a code build per claw; verify upload/save/reload with one design, then batch remaining products. Colors in this pilot are previews only, not new purchasable variants. Obtain physical approval of the separate 2-inch plastic body before enabling that size.

### Golden Love engraved-border fit correction — 2026-10-10

Owner accepted the claw shape/rim but identified uneven engraving alignment. Replaced centered whole-image fitting with per-height horizontal mapping of the source engraved perimeter to the original SVG black inset. Source PNG, outer cut path, plastic body and 1/16-inch rim unchanged. This correction intentionally adjusts horizontal artwork fit to follow the supplied outline. Local visual review and isolated production build passed. Scoped commit `2f8e60e26e87db9ceee5b2578f4d20f0821bce0a`; staging verification pending. Files: `golden-love-gallery/index.tsx` and `src/lib/brand/golden-love-border-fit.ts`. Fit-generation source, report, build log and screenshots in `.local/golden-love-border-fit-20261010/`.

Border-fit staging verification completed: deployment `zbvszg5kf5yctuevi9bwvasx` finished 2026-10-10 22:05:19 UTC, application running:healthy. Active Golden Love tab displays the corrected engraved perimeter; all 13 color selections preserve fit and the settled original purchase variant URL, Add to cart enabled, no browser errors. Screenshot: `.local/golden-love-border-fit-20261010/staging-border-fit.png`; release and color reports alongside. Reusable Admin integration and phone visual review remain pending.

### Golden Love exact engraved frame — 2026-10-10

Owner identified remaining upper-right/lower-right border inconsistency. Previous scan fit clamped near the ends, and photographed frame thickness remained variable. Traced the connected engraved perimeter through its full 67–1452 pixel height, fitted the artwork inside the supplied original SVG black inset, and rendered that exact inset path as a constant 0.6 mm dark engraving stroke. The outer wood margin uses the existing wood-tone fill; the artwork image is clipped inside the inset. Original source PNG, approved cut path, claw body and colored rim unchanged. Local visual check and production build passed; no browser errors.

Scoped commit `0cad82add30b093f9331747f57b197e92eb207e1` preserves the concurrent Admin catalog-search release. Deployment `hnyjoo1a98y4brleri8d28c0` pending verification. Same two storefront files as prior fit correction. Reports, source-border trace, generator and screenshots: `.local/golden-love-corner-fit-20261010/`.

Exact-frame staging verification: deployment `hnyjoo1a98y4brleri8d28c0` finished 2026-10-10 22:23:06 UTC; application running:healthy. Staging Golden Love page verified the exact original SVG inset frame, stable across all 13 colors, with no browser errors. Screenshot: `.local/golden-love-corner-fit-20261010/staging-corners.png`; frame/color report alongside. Phone visual review and reusable Admin integration remain pending.

### Country Skies trial preview — 2026-10-10

Owner selected Country Skies as the next artwork trial. Preserved source gallery photo 2, created a transparent wood-only ImageGen extraction retaining four right-facing waterfowl, and prepared a local interactive 13-color proof using the approved 4-inch cut geometry, SVG inset and 1/16-inch plastic rim. This is an AI-assisted extraction, not pixel-identical source artwork. Original product price/options/gallery unchanged; no storefront code or deployment change for this trial.

Preview `http://localhost:8005/`, temporary server session `94294` remains running for review. All 13 color controls verified; frame geometry stable; no browser errors. Files in `.local/country-skies-overlay-20261010/`: `original-2.jpg`, `wood-overlay-v1.png`, `index.html`, `make-preview.py`, `source-border.json`, `sources.json`, `fit-report.json`, `color-checks.json`, `preview-purple.png`. Remaining: owner artwork/fit review, then connect approved extraction to the reusable storefront/Admin workflow.

### Country Skies approved staging release — 2026-10-10

Owner explicitly authorized publishing the trial to staging. Added approved `wood-overlay-v1.png` and per-height fit data to the existing fitted gallery renderer via a Country Skies design parameter. Uses the same approved cut path, SVG engraved frame and 1/16-inch rim. Original product photos remain expandable; colors remain visual previews. No catalog prices, purchase variants or inventory changes.

Production build and all 13 local color controls passed; no console errors. Golden Love retains its original title and asset. Scoped commit `5bc775332ef9872a184408aacc3c3d05fa4a59cb`, deployment `75yltcijua8wrjt1f89d3v8y` pending verification. Four release files: fitted gallery renderer, shared-claw gallery Country branch, `src/lib/brand/country-skies-overlay.ts`, and `public/images/hair-claws/country-skies/wood-overlay-v1.png`. Isolated build/release report: `.local/country-skies-publish-20261010/`; approved trial/source evidence: `.local/country-skies-overlay-20261010/`. Reusable Admin data integration remains pending; the renderer now supports both approved designs.

Country Skies staging verified: deployment `75yltcijua8wrjt1f89d3v8y` finished 2026-10-10 22:41:31 UTC; backend and storefront both present and healthy. Active Country Skies page verified all 13 colors with stable geometry, original variant URL and enabled Add to cart; $14 price, four original photos and unchanged Store API catalog response. No browser console errors. Collection route also loaded its heading without proxy error. Screenshot and reports: `.local/country-skies-publish-20261010/{staging-country-skies.png,live-color-checks.json,product-after.json,release.json}`. Remaining: generic Admin data integration and phone visual review.

### Country Skies perimeter-only correction — 2026-10-10

Owner identified an uneven perimeter after publishing. The photographed engraving frame remained partly visible inside the exact SVG stroke. Revised the interior image fit to exclude the photo frame (35 px side inset, source vertical span 146–1878), retaining all four birds and rendering the perimeter solely with the unchanged 0.6 mm SVG stroke. Source PNG, plastic outline and 1/16-inch rim unchanged. Local visual review and production build passed. Only `apps/storefront/src/lib/brand/country-skies-overlay.ts` changed. Scoped commit `05827b64532631c50cd6a17c1941e5653679a455`; deployment `iziom7sesqndsfoyfnvhmghq` pending verification. Evidence: `.local/country-skies-perimeter-20261010/`.

Perimeter correction deployed and visually verified on Country Skies staging. Exact revised image height 116.97354733256353 and unchanged 0.6 mm SVG line confirmed; all four birds visible, no duplicate photo frame, no console errors. Screenshot: `.local/country-skies-perimeter-20261010/staging-perimeter.png`.

### Engraved perimeter standard — 2026-10-10

Owner requested twice the previous border width, expanding outward, and specified this for every hair claw with an engraved border. Fitted bordered overlays now use a uniform 1.2 mm visible band (previously 0.6 mm), preserving the original inner edge. A 1.8 mm centered stroke is masked to exclude everything more than 0.3 mm inside the original SVG perimeter; the outer edge grows by 0.6 mm. Apply this rule to future bordered designs. Borderless designs retain their artwork without adding a frame.

Shared renderer applies this to both currently fitted designs, Country Skies and Golden Love, across all 13 color previews. Original product photos and source artwork are preserved. Other catalog photos require their own approved extraction/fitting before this frame treatment can be applied; do not alter original photos or infer border geometry. File: `apps/storefront/src/modules/products/components/golden-love-gallery/index.tsx`. Release/build evidence: `.local/country-skies-thicker-20261010/`; staging verification pending.

Owner also requested a symmetrical handle and original-photo shading. Mirrored the handle's upper curve around its horizontal center for the lower curve, retaining its projection and placement. Reference `original-2.jpg` shows a soft lower-left cast shadow, tighter contact shadow and darker handle attachment; the renderer now uses layered SVG shadows, handle shading and rim highlights informed by that photograph. This is a rendered approximation, not a pixel-identical photo extraction. Both fitted designs share this geometry and lighting. Local visual evidence: `.local/country-skies-thicker-20261010/local-handle-shading.png`; production build passed (`handle-shading-build.log`). Commit `97dff50f94afb7841836c393fed56fb62cd01c26`; staging verification pending.

Owner approval is required before using this revised handle/lighting as the standard for remaining designs. Once approved, propagate the same geometry, border and lighting across every color preview from the shared template; vary only plastic color. Current staging trial supports review across its existing 13 preview colors. No purchasable color variants or inventory records are created by this visual work.

Staging verification completed: deployment `qyppsiuo4w6jkuxwdksmofbi` finished; active Country Skies page tested all 13 colors with one unchanged handle path and lighting definition, consistent outward border, original variant URL and enabled Add to cart. Golden Love also renders the same new handle, border and shadow definition. No Country Skies console errors. Evidence: `.local/country-skies-thicker-20261010/{release.json,live-colors.json,staging-black.png,staging-ivory.png,staging-golden-love.png}`. Owner visual approval remains pending before processing remaining catalog artwork; phone visual review and generic Admin integration also remain outstanding.

### Approved template with flat plastic rim — 2026-10-10

Owner approved the preview and requested no gradients in the claw color surrounding the wooden overlay; slight outer-edge softness is permitted to suggest rounded plastic. Removed the rim gradient layer from the shared fitted renderer. The rim now uses only the selected solid color, with a narrow 0.12-unit silhouette blur at the outer edge. Handle shading, symmetrical geometry, cast shadows, thicker engraved border and artwork fit remain as approved. This standard applies across all preview colors and future approved fitted artwork. Original source photos, variants and inventory remain unchanged. Production build passed; one-file commit `b7901e90b5996abd5861e227541e630f019cdd4e`; staging verification pending. Evidence: `.local/claw-flat-rim-20261010/`.

Flat-rim staging verification complete: webhook deployment `4wwmkxmmjmumpqjot7gje2o8` finished at the scoped commit; both staging services healthy. Manual duplicate deployment `g99jldniofhbjjjhntlddkla` failed with backend container-name conflict during overlap. No manual recovery/restart was needed. Active Country Skies tested all 13 colors: a single rim path has solid matching hex fill/stroke, no plastic gradient definition, and only the 0.12-unit outer-edge blur. Add to cart enabled. Screenshot/report: `.local/claw-flat-rim-20261010/{staging-taupe.png,live-colors.json,release.json}`. Remaining: batch-fit other usable 4-inch artwork, phone review and generic Admin integration.

### Handle attachment blend — 2026-10-10

Owner marked the dark vertical handle/body join. Handle shading now fades to zero before the attachment instead of ending at 42% black. The hidden end extends 2 units farther behind the body, preserving the exposed symmetrical handle shape, and uses the same narrow silhouette softness. Flat rim, engraved frame and artwork fit remain approved. Shared renderer updates both fitted designs across their preview colors. Production build and local visual review passed; scoped commit `7b2a397d35966611247f517530675df9622ddf79`. Follow the automatic webhook deployment, without queuing a duplicate. Evidence: `.local/claw-handle-join-20261010/{local-join.png,build.log,release.json}`; staging verification pending.

Handle-join staging verification completed: webhook deployment `dlbdaamcebnoxk0vbjn16zzo` finished. Black, Ivory and Taupe show the same blended attachment path/shading, solid rim and enabled Add to cart. Evidence: `.local/claw-handle-join-20261010/{staging-join.png,original-comparison.png,compare.html,release.json}`.

At owner request, reviewed all four original photos for accuracy: front lifestyle/white-background views, hinge/top view and side/teeth view. Smooth molded handle/body attachment supports the seam correction. The preview is approximate, not a faithful pixel reproduction: photographed front views show the handle to the right while the approved preview places it to the left; generated extraction has differences in some duck contours/spacing and wood grain; source white-background photo has a broader cast shadow. Perspective prevents exact physical-dimension verification. Retain originals. For exact artwork fidelity, use original design files or a faithful rectified photo extraction instead of regenerating the engraving. Owner has not requested flipping the approved orientation or replacing artwork in this milestone. Remaining: fidelity decision before mass-fitting additional catalog designs; phone review and generic Admin integration.

### Every Paw Matters conversion trial — 2026-10-10

Owner requested another workable product-image conversion. Selected the clean, nearly front-facing white-background second photo from the active Every Paw Matters product. Built-in imagegen isolated the wooden face with alpha; source JPG preserved. Creative Production board tools were unavailable, so the trial is delivered through a local browser preview. Extraction preserves recognizable cat, dog, heart, stethoscope and ECG composition but is AI-assisted and not pixel-identical; artwork approval remains necessary.

Fitted to the approved 4-inch SVG with horizontal orientation and handle above the face. Shared visual rules retained: symmetrical blended handle, solid plastic rim, narrow edge softness, cast shadows and doubled outward engraved frame. SVG strip mapping excludes the extracted photograph frame and draws the uniform SVG frame; some artwork proportions can change during fitting. All 13 color controls verified with invariant geometry. Original images/variants/inventory and staging storefront are unchanged.

Review preview `http://localhost:8009/`, server session `54621` remains running. Files: `.local/every-paw-overlay-20261010/{original-2.jpg,wood-overlay-v1.png,prompt.md,sources.json,make-preview.py,index.html,fit-report.json,color-checks.json,preview-black.png}`. Remaining: owner artwork/fit approval, then connect approved asset to reusable storefront/Admin recipe workflow; do not publish this trial automatically.

Every Paw Matters artwork review: owner confirmed the isolated wood artwork looks good; the prior converted comparison has errors. Preserved `wood-overlay-v1.png` unchanged and archived the first warped comparison as `comparison-v1.html`/`make-preview-v1.py`. Revised local preview uses one uniform SVG transform of the full extraction, removing strip warping and artwork cropping. Black and Ivory controls checked; original photo preserved; staging unchanged. Evidence: `.local/every-paw-overlay-20261010/preview-preserved-art.png`; preview remains `http://localhost:8009/`. Remaining: fit the plastic rim evenly around the approved wood without distorting artwork, and resolve native engraved-frame alignment with the standard perimeter treatment before publishing. Revised proof retains the native extracted frame for review; it does not yet certify uniform rim or standard frame geometry.

Every Paw Matters initial-size correction: owner identified the same undersized overlay issue as earlier trials. Replaced free proportional placement with a full-silhouette fit from the preserved extraction's opaque wood bounds to the exact shared 4-inch cut path. The source PNG stays unchanged; complete artwork is retained, with shape adjustment in the SVG fitting step. Wood now reaches the template edge and the plastic stroke supplies a consistent 1.5875 mm reveal. All 13 colors verified with invariant cut geometry. Native extracted engraving remains visible; final standard engraved-border treatment and owner fit review remain pending. Local only, no deployment. Evidence: `.local/every-paw-overlay-20261010/{preview-sized.png,sizing-color-checks.json,fit-report.json}`; previous proportional proof archived as `comparison-uniform.html` and `make-preview-uniform.py`. Preview: `http://localhost:8009/`.

Every Paw Matters engraved-frame/margin correction: owner identified the native extracted frame and outside wood margin as uneven. Traced the extraction's inner frame, smoothing across its ECG join, and fitted the interior artwork to the supplied SVG inset. Replaced the photographed perimeter with the established uniform 1.2 mm outward-expanded SVG band; the outside wood now occupies the fixed region between this band and the unchanged cut path. Source PNG/JPG remain untouched. Representative Black/Ivory browser checks confirm the same inset, 1.8 mm stroke/.6 mm mask and art clip. Evidence: `.local/every-paw-overlay-20261010/{source-inner-frame.json,preview-standard-border.png,frame-check.json,fit-report.json}`. Local preview only at `http://localhost:8009/`; owner fit review and staging publication remain pending. Original artwork motifs retained, with proportions adjusted by fitting; no claim of pixel-identical photo reproduction.

Every Paw Matters end-skew correction: owner rejected nonlinear fitting because it bends the left/right motifs. Removed all SVG strip mapping. The approved extraction now renders as ONE image with one similarity transform (equal x/y scale, rotation only); its photographed frame is separately excluded by a source-interior clip. Template border, cut outline and plastic reveal remain independently controlled. Browser verified one image and equal transform magnitudes 0.06011530134474328. Evidence: `.local/every-paw-overlay-20261010/{preview-no-skew.png,uniform-art-check.json,make-preview.py}`; previous warped proof archived as `comparison-frame-warp.html`/`make-preview-frame-warp.py`. Do not reintroduce strip fitting for motifs. Remaining visual detail: ECG lower stem now stops short of the independently placed template border after photographed-frame removal; artwork/border junction needs review. Local only; original extraction unchanged; no staging publication.

### Recorded fitting settings — Every Paw Matters, 2026-10-10

Owner requested these settings be saved for reuse. Treat this as the current local fitting recipe, not staging/publication approval.

- Preserve approved `wood-overlay-v1.png` (1904 × 826 RGBA) and original product photo unchanged.
- Render artwork as ONE image with equal horizontal/vertical scaling. No strip mapping, nonlinear warping, or independent stretching of the ends.
- Current source interior range: x = 132–1768 px; centering reference y = 434.5 px. Uniform scale = 0.06011530134474328. Artwork transform: `matrix(0 -0.06011530134474328 0.06011530134474328 0 -7.358135434290954 107.87189577750611)`.
- Use the original 4-inch SVG cut path and engraving inset independently of artwork. Keep the outside wood margin between those fixed paths; exclude the photographed frame with the separate source-interior clip.
- Engraved border standard: 1.2 mm visible band, expanding outward from the original inner edge; implementation uses 1.8 stroke with .6 mask stroke. These are existing template units before its shared display scale.
- Plastic reveal: 1.5875 mm (1/16 inch). Solid selected color around the wood; only narrow .12-unit outer-edge softness. Retain symmetrical handle, blended attachment, and approved cast/contact shadows.
- Horizontal orientation, handle above the face. All 13 color previews share geometry; color changes affect plastic only.
- Remaining: reconnect/refine the ECG lower stem at the separate engraved border without warping the artwork, then owner visual review and explicitly authorized staging publication. Other fitted products have not been migrated to this no-warp recipe.

Exact recipe: `.local/every-paw-overlay-20261010/make-preview.py`. Reference proof: `preview-no-skew.png`; numeric check: `uniform-art-check.json`; source clip trace: `source-inner-frame.json`, all in the same directory.

### Every Paw Matters completed local comparison — 2026-10-10

Owner requested finishing and comparison to the original. Corrected the source-frame trace at the ECG junction by interpolating the border across the stem; previously its dark artwork contaminated the border trace and clipped the stem too high. Added a small source-coordinate SVG bridge from the two existing lower stems to the independent template engraving. The artwork PNG remains unchanged and uses the same ONE image/equal-axis transform; no end skew or nonlinear fitting. Fixed border, outside wood margin and 1/16-inch plastic reveal retained. Black, Ivory and Taupe checks confirm invariant transform/frame/ECG bridge.

Original photo 2 is enlarged with CSS to a similar displayed wood width for direct side-by-side inspection; the photo file is unchanged. Motif sequence and overall layout agree: stethoscope, standing cat, heart, ECG, reclining dog and circular stethoscope end. The approved AI extraction still differs in fine animal/line contours, wood grain and engraving texture; it is not pixel-identical. The template's uniform border/rim and modeled shading are intentional preview treatments rather than measured reproduction of photographed margins.

Current recipe: `.local/every-paw-overlay-20261010/make-preview.py`; proof `preview-final-comparison.png`; representative checks `final-checks.json`; numeric settings `fit-report.json`; corrected source trace `source-inner-frame.json`. Local review at `http://localhost:8009/`. ECG junction is now finished; remaining gate is owner review and explicitly requested staging publication. No storefront code, catalog data, original files or staging deployment changed.

### Every Paw Matters staging publication — 2026-10-11

Owner approved the finished comparison and explicitly requested publishing. Connected the approved PNG/uniform-transform source clip/ECG bridge to the shared fitted gallery as `design="every-paw"`, with horizontal orientation and Black default. Original photos remain expandable; all 13 plastic colors are visual previews only. Country Skies and Golden Love retain existing fitting behavior. No catalog, price, purchase variant or inventory mutations.

Isolated production build passed; scoped commit `dbb8e42db0deb0a94ff1a88c6c400e84d1390b03` preserves latest Admin staging work. Four files: `src/modules/products/components/golden-love-gallery/index.tsx`, `src/modules/products/components/shared-claw-gallery/index.tsx`, `src/lib/brand/every-paw-overlay.ts`, `public/images/hair-claws/every-paw/wood-overlay-v1.png`, relative to `apps/storefront`. Automatic webhook deployment `jlprxb2kvxf9eq8erkudkahu` is pending live verification; do not issue a duplicate manual deployment. Build/commit/baseline evidence: `.local/every-paw-publish-20261011/`. Approved source recipe/proofs remain in `.local/every-paw-overlay-20261010/`.

Every Paw Matters staging verified 2026-10-11: webhook `jlprxb2kvxf9eq8erkudkahu` finished at the scoped commit; backend and storefront both healthy. Active owner product/variant URL refreshed and visually matches the approved preview. All 13 colors have ONE image with invariant equal-axis transform, unchanged $14 price and enabled Add to cart after normal page hydration. Five original gallery photos remain available. No browser console errors. Country Skies representative regression retains its existing 256-band gallery and appearance. Evidence: `.local/every-paw-publish-20261011/{staging-approved.png,live-colors.json,before-live.json,build.log,release.json}`. Current milestone complete; remaining broader work: reusable Admin recipe integration, other catalog artwork conversions and phone visual review. Production Shopify unchanged.

### Remaining gallery source review — 2026-10-11

Owner requested review of other 4-inch claws and examples not usable for the overlay process. Read current staging catalog (247 products, 68 claw designs), excluded the three already converted designs, and visually reviewed all 299 images across 65 remaining galleries. Larger inspection of questionable candidates included Trees, Christmas Tree, Nordic Christmas, Funny Birds and Coffee Cup. This is visual triage, not a conversion/extraction test.

Hold three designs for replacement source photos before faithful conversion: Trees Hair Claw Clips (only lifestyle photo; small face/fine-detail limitation), Christmas Tree Hair Claw (no clean isolated frontal 4-inch source, perspective/lighting), Nordic Christmas Hair Claw (oblique view and handle shadow across upper engraving). These images remain usable for merchandising; this is a reliability judgment for accurate extraction, not a claim they are impossible to recover.

60 galleries have a workable candidate, subject to extraction review. Funny Birds and Brush. Floss. Repeat. have visible candidate artwork but catalog title/description/options do not explicitly establish 4-inch size. Boho Tribal and Cow Print OPEN have usable photos but require custom cutout outlines/masks. Painted images are candidates for preserving painted artwork, not reconstructing an unpainted version. Per-design candidate photo numbers and reasons are saved in `.local/hair-claw-source-review-20261011/review.json`; catalog snapshots and contact sheets alongside. User-facing report: `http://localhost:8012/`, server session `11416`; proof `photos-to-replace.png`. No product/gallery changes, generation, or deployment. Remaining: new source photos/size confirmation, then bounded approved extraction trials.

### First remaining-design conversion batch — 2026-10-11

Prepared local proofs for Playful Cat (photo 2), Sunflower Skull (photo 2), and Paw Prints in the Sand (photo 1). Originals and built-in ImageGen isolated PNGs preserved in `.local/claw-batch-20261011/<product-handle>/`; each folder contains `prompt.md`, `recipe.json`, and `source-interior.json`. All PNGs are 1024 × 1536 with alpha. One uniform artwork matrix per design, source-interior clipping and shared SVG cut/frame, solid 1.5875 mm plastic reveal, outward engraving, blended symmetrical handle and shadows. No strip mapping or nonlinear deformation. Source-interior clipping is a first reviewed proof and still needs owner corner/contact review.

Browser verified 39 color selections (13 per design), one image per preview and unchanged matrices. Main counts retained: cat + two butterflies; three skull flowers; eighteen paw prints. AI-generated fine motif contours, spacing and grain differ from originals; do not claim exact artwork reproduction. Paw prints touching the engraved frame need closer owner review. No catalog writes, storefront code changes or deployment.

Review: `http://localhost:8013/` (server session 96408). Evidence: `.local/claw-batch-20261011/{sources.json,fit-report.json,color-checks.json,review-notes.json,comparisons.png,make-preview.py,index.html}`. Remaining: owner artwork/fit review, then integrate approved assets/recipes and deploy one scoped batch when authorized; three reshoot holds and two size checks from the source review remain unchanged.

### Batch vector-orientation correction — 2026-10-11

Owner flagged that the conversions did not follow the vector outline. Found that the upright batch inherited the Every Paw horizontal recipe's 180-degree template reversal. Removed that rotation from all cut, clip, rim and engraved-border transforms; the batch now uses the supplied SVG's native orientation. Verified config cut path and transform equal the SVG red cut path exactly. A blue guide checkbox uses the same normalized vector path; DOM checks confirm guide/cut/rim match for all three and artwork remains one equal-axis matrix. Added a source-coordinate SVG alpha mask to blend wood seams; original/generated PNG bytes remain unchanged, no raster editing or artwork warping.

Previous preview/script archived as `comparison-v1.html` and `make-preview-v1.py`. Current local review remains `http://localhost:8013/`; evidence `.local/claw-batch-20261011/vector-checks.json` and `overview-vector.png`. No staging or catalog changes. Remaining: owner visual review of artwork and edge-contact details before publication.

### Sunflower source fidelity and paired handle reversal — 2026-10-11

Owner rejected Sunflower visual and confirmed that the face must reverse when the handle moves to the opposite side. Replaced its AI redraw in the active proof with the original photo pixels, one uniform SVG scale and source-interior clipping; three original skull flowers/petals are retained without regeneration. The rejected generated PNG is preserved. Camera perspective remains in the original photo; this is not exact perspective rectification.

Corrected the prior assumption that native SVG orientation must always be used upright: choose vector orientation to match the photographed handle side. Default left-handle view uses upright source artwork and the exact vector rotated to the matching face orientation. Opposite view rotates the ENTIRE assembly 180 degrees, including artwork, frame, cut path, rim, handle and guide; no mirroring or independent end stretching. Left/right controls added to all three local proofs. Browser verified both sides for all three; Sunflower's 13 color controls retain the original photo source and unchanged matrix. Evidence: `.local/claw-batch-20261011/{orientation-checks.json,sunflower-rework-checks.json,sunflower-reworked.png,make-sunflower-review.py}`. Review `http://localhost:8013/sunflower-review.html`; full controls `http://localhost:8013/`. No publication, catalog or storefront code changes. Remaining: owner Sunflower artwork/fit review before integration/publication.

### Upright opposite-handle correction — 2026-10-11

Owner clarified that the right-handle artwork was inverted. Replaced the incorrect 180-degree opposite-view rotation with horizontal reflection of the whole assembly: `translate(36.895884 0) scale(-1 1)`. Top/bottom remain upright; handle, wood face, engraving frame, plastic rim and vector guide mirror together. This supersedes the previous paired-rotation instruction. All three controls verified; Sunflower original/left/right screenshot confirms upright skulls. Evidence `.local/claw-batch-20261011/{mirror-checks.json,sunflower-upright.png}`. Local only; owner visual review pending.

### Three-design visual approval — 2026-10-11

Owner approved the corrected Playful Cat, Sunflower Skull and Paw Prints in the Sand previews ("those are good"). Approved orientation rule: mirror the whole assembly horizontally for the opposite handle, keeping artwork upright. Sunflower uses original photo pixels; the other two use preserved generated extractions. Approval recorded in `.local/claw-batch-20261011/review-notes.json` and each design's `recipe.json`. Local visual milestone complete; remaining: storefront recipe integration and one authorized batch publication. No staging/production deployment performed on this approval turn.

### Approved three-design staging publication — 2026-10-11

Integrated Playful Cat, Sunflower Skull and Paw Prints in the Sand through the new `approved-claw-gallery` and bundled `approved-claw-previews.ts`, dispatched from `shared-claw-gallery`. Approved assets copied byte-for-byte to `apps/storefront/public/images/hair-claws/approved-batch/`. Source art remains one uniformly scaled image; opposite handle mirrors the whole assembly horizontally with upright artwork, solid 1/16-inch rim, reviewed engraved frame and handle shading. Sunflower retains original photo pixels; Cat and Paw retain the approved generated extractions. Color controls remain visual-only and originals remain accessible.

Scoped release commit `9a04932732b1c0a7db0a7561aee9f3a1cf1e4e35`, parent `dbb8e42db0deb0a94ff1a88c6c400e84d1390b03`; six files only. Isolated storefront production build passed. One staging push triggered webhook deployment `vk2krdqiwkhgbh2we13dp25l`, finished 2026-10-11 19:20:48 UTC. Old-container cleanup timeout recovered automatically; backend and storefront confirmed healthy. Browser verified all 13 Sunflower colors with one unchanged source and solid plastic fills, both handle views, Cat/Paw ivory mirrored views, original galleries, $14 prices and enabled cart after required Cat option selection. No console errors on these three pages. Existing Every Paw Matters retains one-image preview, working color selection and enabled cart. No live Shopify changes.

Evidence and release source: `.local/claw-batch-publish-20261011/{release.json,asset-checks.json,color-checks.json,build.log,source/,sunflower-staging-right.png,cat-staging.png,paw-staging.png}`. Staging product handles: `playful-cat-hair-claw`, `sunflower-skull-hair-claw`, `paw-prints-in-the-sand-hair-claw`. Milestone complete. Remaining: process a subsequent bounded design batch; source-photo holds, size confirmations and custom-cutout designs from triage remain pending.

### Second remaining-design conversion batch — 2026-10-11

Prepared local original-photo SVG conversions for Giraffe Kisses (photo 2), Boxer Love (photo 2) and Boho Gecko (photo 1). Originals preserved byte-for-byte; no AI redraw or raster editing. One similarity transform per photo (equal-axis scale, rotation and source-side reflection for the right-handled Giraffe), source-interior SVG clip and feather mask, independent shared vector perimeter, 1.2 mm outward engraving and solid 1.5875 mm plastic reveal. Photographic camera perspective remains; template frame/wood edge is reconstructed separately. Giraffe's painted face stays colored; its photographed yellow outer perimeter is replaced by the standard wood margin/template engraving.

Browser checked 39 color selections, both handle controls for all three, exact guide/cut path agreement and no console errors. Geometry checks prove one image, equal axis scales and perpendicular matrix axes. Original/converted comparisons visually reviewed; transitions refined using SVG masks without changing source pixels or warping artwork. These are local proofs for owner review, not published or approved.

Review: `http://localhost:8014/` (server session 6357). Evidence `.local/claw-batch-2-20261011/{sources.json,fit-report.json,color-checks.json,geometry-checks.json,make-preview.py,index.html,overview.html,overview.png}` plus per-handle `original.jpg`, `preview.svg`, `recipe.json`. Remaining: owner fit/accuracy review, then integrate and publish this batch when approved. Existing staging batch remains unchanged.

### Boxer/Giraffe border-contact refinement — 2026-10-11

Owner identified unclear Boxer art and missing engraving connection into the perimeter; Giraffe painted ears should meet the engraved border. Removed feather masks from these two images so border-contact details retain full opacity. Increased the complete artwork uniformly about the face center (Boxer ×1.12; Giraffe ×1.10); equal-axis scale verified, no nonlinear/end stretching. Boho Gecko unchanged. Source photos and v1 generator/page/report preserved. Independent vector frame and solid plastic rim retained.

Compared refined views directly with original photos; Boxer engraved background now meets the template border and Giraffe ears/neck meet the perimeter. Representative Black/Ivory controls and both mirrored handle views checked; each retains one unmasked source image. Camera perspective remains. Evidence `.local/claw-batch-2-20261011/{border-contact.html,border-contact-v2.png,border-contact-checks-v2.json,fit-report.json}` and updated per-product recipes. Review `http://localhost:8014/border-contact.html`, full controls `http://localhost:8014/`. Local refinement complete, pending owner accuracy review; no staging publication.

### Boxer/Giraffe revision 3 — 2026-10-11

Owner rejected v2 size/position and border contact and required Giraffe color preservation. Reduced uniform enlargement to Boxer ×1.09 and Giraffe ×1.08 and changed vertical anchor to 25 mm, keeping head positions closer to original while filling the border contact region. Full-opacity original art retained. Restored Giraffe yellow painted perimeter (`#e1b827`) in independent cut geometry; original yellow/pink/brown face pixels remain unchanged. No warping, recoloring of source art, or staging publication. v2 generator/page/report archived.

Current proof `http://localhost:8014/border-contact.html`; controls `http://localhost:8014/`. Updated recipes and fit-report in `.local/claw-batch-2-20261011/`; screenshot `border-contact-v3.png`. This is a revised approximation with original camera perspective, pending owner visual review; do not treat as approved.

### Border-corner and groove appearance revision — 2026-10-11

Owner flagged upper/lower left interior distortion and flat-looking engraved border. Replaced angular source polygon with smooth cubic clipping contour and removed old photographed frame fragments (20px Boxer, 12px Giraffe source-side boundary inset in the 1600px inspection coordinate system). Selective feather applies to blank wood seams; engraving and Giraffe painted contacts remain opaque. Artwork matrices unchanged and uniform. Added fine procedural grain plus dark/light groove lip shading to template engraving; engraved width and vector geometry unchanged, plastic remains solid. Giraffe original face colors and yellow perimeter retained. Added a small separate triangular continuation at Boxer's right engraved-background contact; this is an approximate geometric bridge requiring owner accuracy review, not recovered original pixels.

Local proof/control pages updated; evidence `.local/claw-batch-2-20261011/{border-contact-v4.png,fit-report.json,make-preview.py}` and per-design recipes. No staging publication or owner approval. Remaining: review corner transitions, groove appearance and Boxer background contact against originals.

### Left wood/engraving blend refinement — 2026-10-11

Owner said left side still did not blend into engraved outline. Sampled median RGB from original blank wood near left edges (1600-view x615–645 Giraffe / x755–785 Boxer, y340–430). Matched fallback wood fill to `#e8d6ba` / `#ebd0a8`; increased blank-wood-only SVG mask feather from 8 to 14 source pixels. Engraving/contact areas stay opaque, border remains sharp/textured, source matrices and original image bytes unchanged, Giraffe paint/yellow perimeter retained. Local comparison visually checked; evidence `.local/claw-batch-2-20261011/{border-contact-v5.png,sample-wood.swift,make-preview.py,fit-report.json}`. Prior generator archived as `make-preview.py.v4`. Local only, pending owner review.

### Giraffe left-ear border-contact correction — 2026-10-11

Owner flagged recurrent gap at the left ear. Found source-edge cleanup was also clipping the photographed ear/border junction. Exempted source window x565–640, y600–745 (1600px inspection coordinates) from boundary trimming, keeping original painted/contact pixels fully opaque. Translated whole Giraffe artwork +1.5mm in base coordinates (leftward in photographed right-handle view); existing scale/rotation unchanged. No redrawn ear, strip warp, color changes or global enlargement. Boxer/Gecko unchanged. Updated local comparison visually inspected; evidence `.local/claw-batch-2-20261011/{border-contact-v6.png,fit-report.json,make-preview.py}` and Giraffe recipe. Prior generator `make-preview.py.v5` preserved. Local only, awaiting owner accuracy review. Treat artwork-to-frame contact zones as protected from future blank-wood trimming/blending.

### Annotated Giraffe ear/filler-strip correction — 2026-10-11

Owner annotated opposing arrows at the ear and groove and marked the extra wood strip along that side as unwanted. Previous translated fit still left a filler seam on the opposite side; blending was insufficient. Refitted Giraffe uniformly using contact/width (×1.16 base transform), removed the v6 +1.5mm translation and source boundary inset, and removed Giraffe alpha feather. Whole original photo art stays opaque and uniformly scaled; exact template art clip governs visible perimeter. Top/end blank margins are clipped independently; original camera perspective remains. Yellow perimeter and face paints retained. No strip warping or independent end stretching. Boxer/Gecko unchanged.

Focused original/revised review `http://localhost:8014/giraffe-contact.html`; full controls and existing comparison updated. Evidence `.local/claw-batch-2-20261011/{giraffe-contact-v7.png,giraffe-contact.html,fit-report.json,make-preview.py}` and per-design recipe. v6 generator archived. Local only, pending owner approval.

### Annotated Boxer strip / Giraffe lower-left corner — 2026-10-11

Owner supplied marked close-ups: Boxer extra right wood strip and synthetic triangle were incorrect; Giraffe lower-left still contained its original photographic engraved edge inside the template groove. Removed Boxer background bridge entirely, changed Boxer to uniform contact-width fit ×1.16 and eliminated old 20px inset/wood alpha mask. Artwork and original engraved-background contacts now come from the photo alone. Giraffe ear/paint fit unchanged; trimmed original lower-left blank-wood border fragment by 18px in source inspection coordinates, sampled lower wood tone `#d8b28b`, and applied corner-only feather with gradual vertical onset. Independent template groove and yellow paint rim retained; no motif warping/recoloring.

High-magnification verification page `http://localhost:8014/annotated-details.html`; full comparison and controls updated. Geometry check: equal-axis matrices and exactly one source image per design; no synthetic contact patch. Evidence `.local/claw-batch-2-20261011/{annotated-details-v8.png,annotated-details.html,geometry-checks-v8.json,fit-report.json,sample-lower-wood.swift,make-preview.py}` plus recipes. Prior generator `make-preview.py.v7` preserved. Local only and awaiting owner accuracy review.

### Natural engraved grain / Boxer bottom-right contact — 2026-10-11

Owner requested natural engraving rather than solid-filled border and corrected Boxer bottom-right contact. Replaced solid-color stroke with a separate photo-sampled engraved-grain SVG pattern from each original; kept groove edge lighting but removed synthetic noise modulation. Pattern samples engraved burn areas, not painted portions or pale cut margins. Border width/path unchanged. First narrow frame sample showed repeated bands at magnification and was superseded by clean engraved-area texture samples; current texture is an approximation of natural grain on template groove, not recovery of every original perimeter pixel. Main artwork still has one image and one equal-axis transform; independent perimeter pattern adds one texture image reference.

Boxer uniform contact fit increased to ×1.20 with same 25mm vertical anchor so lower-right engraved background/foot meets template line; no synthetic connector or end warping. Giraffe source paint/colors and cleaned corner retained. Focused close-up visually inspected. Evidence `.local/claw-batch-2-20261011/{annotated-details-v9.png,geometry-checks-v9.json,fit-report.json,sample-engraving.swift,update-review-pages.py,make-preview.py}`; comparison/control/detail pages updated. Prior generator `make-preview.py.v8` retained. Local only, owner accuracy review pending.

### Admin fitting workflow research — 2026-10-11

Owner proposed using Prompt Studio Step 4 image adjustments in Medusa Admin with access to current product pictures. Read-only source review confirms Prompt Studio already supports drag placement, uniform scaling, rotation, original SVG clipping, reset and saved placement. Rustic Halo already has upload/preparation and basic uniform scale/X/Y admin controls, but no existing-product-photo chooser or direct manipulation controls. Its approved batch and Golden Love/Every Paw/Country Skies galleries currently bypass the generic admin recipe renderer, so saving settings alone would not adjust those previews.

Proposed next milestone: extend the existing admin editor with current-photo selection, prepared-overlay selection, drag/scale/rotate handles, fixed template/border/rim, original-versus-preview comparison and saved per-product/per-size placement; connect approved storefront galleries to the saved recipe. Keep arc/nonlinear deformation disabled, preserve originals and painted colors, and share placement across all visual color previews. Once wired, routine fitting should save as data without a storefront build per product. Angled photos may still require extraction or a better source. No implementation, product media writes, deployment or owner approval occurred on this research turn. Current v9 Boxer/Giraffe previews remain local and pending accuracy review.

Relevant files: Prompt Studio `public/index.html`; Rustic Halo `apps/backend/src/admin/components/{hair-claw-editor,hair-claw-photo-upload}.tsx`, `apps/backend/src/api/admin/products/[id]/hair-claw-media/route.ts`, and `apps/storefront/src/modules/products/components/shared-claw-gallery/index.tsx`.

### Admin photo fitting with optional skew — 2026-10-11

Owner authorized the Step 4-style admin editor and explicitly requested skew. This supersedes the earlier proposal to disable distortion controls for this editor: uniform scaling remains the default; optional global horizontal/vertical affine skew is available from −35° to +35°, starts at zero and has its own reset. No automatic strip/nonlinear warping was introduced, and existing approved extraction assets were not rewritten.

Implemented current-product-photo selection, existing saved overlay/draft access, source crop controls, drag placement, corner scaling, rotation handle and precise numeric controls, 90° photo turns, mirrored handle views, original comparison and a sticky preview beside the adjustment controls. The shared editor/storefront SVG keeps the supplied cut/border geometry independent of image transforms and retains the solid 1/16-inch plastic reveal. Photographic engraving is kept by default; adding a template groove is optional. Upload/background preparation remains available. Source photos are referenced by owned product image ID; no arbitrary client URL is saved or fetched by the server. Original photos/files, paint colors and commerce records are preserved.

Saved recipes use editor_version=2 and per-size metadata. Separate drafts preserve the last enabled recipe; review/enabling moves the draft into the active recipe and clears it. Revision checks reject stale saves. Enabled admin recipes now override bundled approved/Golden Love/Every Paw/Country Skies galleries; disabled drafts or preview failure retain the prior approved gallery/originals. For products without a Size option, the admin's explicit reviewed 4-inch recipe supplies the physical size; a selected 2-inch variant never receives a 4-inch fallback. The 2-inch editor remains draft-only pending measured plastic geometry. Routine fitting saves as data without a per-product storefront build; product queries already use no-store.

Verified locally: 18 backend photo/media tests, focused backend type check, storefront type check, real Medusa admin build and storefront production build passed. Browser tested actual editor/component code with isolated sample APIs: save/reopen of crop/rotation/skew, failed-save retry, mirrored keyboard movement, drag (2.119/1.271 mm), corner scale (1.084), rotation handle (4.821°), draft retaining the enabled storefront fit, reviewed draft activation, color selection and preserved original-photo access. Static renderer checks cover all 13 colors, one artwork image, URL escaping, crop/skew bounds and identical fixed cut/frame geometry before/after image edits. Browser automation cannot drag through its nested iframe hit-testing surface, so drag handles were verified on a direct canvas using the same renderer/event code; iframe-to-admin placement messages were verified with keyboard input. Full backend type check has three pre-existing unresolved jose module declarations in apple-admin/tokens.ts; changed files pass the focused check.

Local review: http://localhost:19034/ (Vite sample-data server session 37630). Exact files/reports: .local/claw-admin-editor-20261011/{implementation-report.json,browser-checks.json,renderer-checks.json,backend-tests.log,focused-types.log,storefront-types.log,storefront-build.log,admin-build/,admin-editor.png}; source manifest is in implementation-report.json. Application files: apps/backend/src/admin/components/hair-claw-editor.tsx, src/lib/hair-claw-settings.ts, src/api/admin/products/[id]/hair-claw-media/route.ts, src/lib/__tests__/hair-claw-media.unit.spec.ts; apps/storefront/src/modules/products/components/shared-claw-gallery/index.tsx and public/previews/shared-hair-claw/{compositor.js,embed.html,editor-claw.js,editor-geometry.js,editor-embed.js}. Prompt Studio was read only. No real catalog/media writes, staging/production publication, or approval of current Boxer/Giraffe v9 art occurred. Remaining: owner editor review and an authorized scoped staging release; verify actual admin save and the exact staging product page after deployment.

### Independent four-corner fitting and artwork mirroring — 2026-10-12

Owner explicitly requested four independent resize/skew corners: place one corner, keep it pinned, then place the others. Added four square handles with persistent `corners` in the unmirrored assembly's mm coordinates. Each corner drag changes only that point; dragging the image moves the complete fitted quadrilateral without changing its shape. Arrow keys also nudge the focused corner. A continuous projective transform maps the one original cropped image to the four corners; no strip fitting or synthetic replacement artwork. The fixed supplied cut, frame, handle and plastic reveal stay independent. This explicit interactive fitting request supersedes the earlier restriction against distortion for this editor; approved extraction assets remain unchanged.

Added horizontal and vertical artwork-only mirror toggles, visibly highlighted when selected. They preserve fitted corners and handle side. Existing whole-claw handle mirroring remains separate. Once a corner is placed, affine scale/rotation/skew controls are disabled to avoid moving pinned corners inadvertently; Reset corner fit restores those controls. Crop and whole-image position remain available. Backend validation requires exactly four finite bounded points in a convex ordered quadrilateral, rejects collapsed/folded fits and requires the current editor version. Saved drafts, activation/review and revision protections remain in place. Storefront rendering uses the same saved corner fit and artwork mirrors without editor handles.

Verified locally: all 20 backend photo/media tests, focused backend and storefront types, real Medusa admin bundle and storefront production build passed. Actual browser drags of all four corners left the other three exactly unchanged; whole-image dragging translated every corner equally. Checked both mirror axes, fixed cut geometry, saved/reopened draft, corner reset, repeated keyboard nudging through the admin iframe, draft retaining the enabled storefront fit and enabling the sample recipe in the actual storefront gallery component. Algebraic checks prove the projective matrix maps each source corner exactly; renderer checks cover all 13 colors and one source image. Source-photo hashes match prior proof. Testing used isolated sample APIs only. The sample Giraffe fit is a controls demonstration, not approval of production art.

Files changed: apps/backend/src/admin/components/hair-claw-editor.tsx, src/lib/hair-claw-settings.ts, src/lib/__tests__/hair-claw-media.unit.spec.ts; apps/storefront/public/previews/shared-hair-claw/{editor-transform.js,editor-claw.js,editor-embed.js,embed.html,compositor.js}; apps/storefront/src/modules/products/components/shared-claw-gallery/index.tsx (preview version). Evidence: .local/claw-admin-editor-20261011/{implementation-report-corners.json,browser-checks-corners.json,renderer-checks-corners.json,backend-tests-corners.log,focused-types-corners.log,storefront-types-corners.log,storefront-build-corners.log,admin-build-corners.log,admin-editor-corners.png}. Local review http://localhost:19034/; server session 22999. Full backend types retain the prior unrelated missing jose declarations. Remaining: owner editor review, authorized coordinated backend/storefront staging release and actual product/save verification after deployment. No real catalog/media writes or staging/production deployment occurred.

### Structured image editor with tooltip help — 2026-10-12

Owner requested a pleasing, simple visual layout with explanatory text in tooltips. Replaced the stacked controls with a large preview canvas, Preview/Original tabs, compact Photo and Layout cards, expandable Crop/Fine tune/Upload/Connection panels and a sticky save bar. Added styled source thumbnails, selected mirror states, color swatch, guide toggle, clear short labels and consistent blue/neutral controls. Canvas height adapts to the viewport so its four corners and bottom tools remain clear of the save bar. Long instructions, draft/enabling explanations, upload guidance and cleanup warnings now live behind help icons or action tooltips. Tooltips work with focus, click/tap and Escape. Short status/error labels remain visible; detailed messages stay available in tooltips and live regions. Existing explicit review/enabling gate remains.

The owner's then-current local Giraffe fit (handle left, horizontal artwork mirror, no added border, crop, position and independent corners) was preserved as a sample draft before refreshing the component. Verified saved fit and draft data remained identical after UI checks, apart from revision changes caused by sample save/retry. Original photos and fixed geometry were not modified. Retained all placement, crop, skew, source quarter-turn, mirroring, saved fit/draft, upload preparation and two-inch draft-only controls. Malformed preview origins no longer crash rendering. Original comparison and guide toggling do not alter placement.

Verified real Medusa admin bundle and focused backend types. Browser checked tooltip opening/Escape, original comparison, guide visibility with four handles retained, crop numeric edit/discard, visible save failure with details in tooltip, successful retry, saved corner restoration, two-inch enable lock, default canvas clearance and 390x844 layout with no horizontal overflow; viewport reset after testing. No backend/schema or storefront renderer change in this UI milestone, so their already-passed corner milestone suites/build were not repeated. Full backend types retain the previously documented missing jose declarations.

Files: apps/backend/src/admin/components/{hair-claw-editor.tsx,hair-claw-photo-upload.tsx,hair-claw-ui.tsx,hair-claw-editor.css}. Reports: .local/claw-admin-editor-20261011/{implementation-report-ui.json,browser-checks-ui.json,focused-types-ui.log,admin-build-ui.log,admin-editor-ui.png,admin-editor-ui-mobile.png,fixture-before-ui.json,editor-before-ui.tsx}; updated local sample wrapper main.tsx. Review http://localhost:19034/, server session 22999. Remaining: owner review and the previously pending coordinated backend/storefront staging release, followed by actual product/save verification. No real catalog writes, staging/production deployment or production-art approval occurred.
