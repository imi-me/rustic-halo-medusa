# Ask Rusty staging assistant

Admin route: http://localhost:19000/app/assistant (private staging tunnel).

## Product administration review — October 13, 2026

Reviewed current product-workspace, inline-editor, product-images, product-stock,
description-editor and assistant source against Shopify's documented product
details and creation flows. This is a design/feasibility handoff; no application
changes, deployment, catalog writes or provider requests were made.

Recommended bounded milestone: use the same Shopify-style product form for Add
product and Edit product. Main column: title/description, media, pricing,
variants/inventory and shipping. Sidebar: status, channels, product type,
organization and Etsy listing information. Keep Save/Discard visible and retain
unsaved drafts. Hide advanced fields until requested; simple products should not
require the merchant to understand a default variant or inventory-item linking.

- Existing edit infrastructure covers title/description, variant barcode text,
  images/cover/order, pricing and per-location on-hand/reserved/available stock.
  Creation parity and automatic barcode allocation still need implementation.
- ProductImages currently renders HairClawImageDialog unconditionally. Scope the
  action and server eligibility to hair-claw product type/verified existing
  metadata; keep ordinary image controls available to every product. Preserve
  original images, size/finish offers and existing pooled inventory semantics.
- Barcode at creation: generate a unique internal scanner code by default, allow
  direct entry per sellable variant, preserve leading zeroes, check duplicates
  on the server and never overwrite an entered or existing barcode. Keep internal
  codes separate from manufacturer UPC/EAN identifiers. Define safe allocation
  under concurrent creation and retries before implementation.
- Etsy: show editable listing title, description, tags, materials and existing
  listing ID/link, with inherited storefront copy as an explicit starting point.
  Inspect current integration mappings before choosing storage. Saving a draft
  must not implicitly publish or synchronize an Etsy listing. Listing sync is a
  separate milestone with verified credentials, mappings and publishing rules.
- Owner refinement: put AI-assisted Etsy tags and search guidance directly in
  this section. Offer Generate tags, Improve title, Rewrite description and
  Check search readiness. Allow locking existing tags, regenerating individual
  suggestions, explanations, editable review and Undo. Validate at most 13 tags
  and 20 characters per tag; flag duplicates and unnecessary overlap with category
  or attribute phrases. Use only accurate product facts. Show dated official Etsy
  guidance and distinguish query matching from ranking. Readiness checks are our
  checklist, not Etsy ranking scores or search-volume measurements. Assess photos,
  attributes, shipping and shop/service factors where evidence is available;
  mark missing data rather than inventing it. Performance advice should use actual
  seller-provided/authorized statistics when available, with no claim that API
  access to search terms, rankings or Marketplace Insights is already supported.
  Live tag/title/description updates are supported by Etsy's listing API but need
  verified shop OAuth permissions and save/read-back acceptance. Keep Save draft
  separate from Update Etsy, show exact differences and retain previous values.
  References: https://help.etsy.com/hc/en-gb/articles/360000336307-How-to-Use-Tags-to-Get-Found-in-Search
  https://www.etsy.com/seller-handbook/article/382774281517
  https://www.etsy.com/seller-handbook/article/366470356778
  https://developers.etsy.com/documentation/reference/
- Embed Ask Rusty beside description: generate/rewrite/shorten from entered
  facts, review and edit the suggestion, use it in the unsaved form, Undo, then
  Save. Support new-product drafts without requiring an existing product ID.
  Current assistant supports signed existing-product title/description proposals
  on its separate page; documentation reports provider activation/live answers
  still pending a separate key. Runtime readiness was not inspected in this review.
- Existing Save updates product fields/images before stock, so it is not atomic.
  Keep partial-success messages and retry only unconfirmed stock changes; verify
  save/reopen, duplicate prevention and stale inventory handling in staging.

Remaining: implement the bounded product form milestone, then verify a normal
product and hair claw, variant barcodes, image save/reopen, per-location stock,
failed/partial saves and AI draft/Undo. No deployment is authorized by this review.
Sources: https://help.shopify.com/en/manual/products/details/product-details-page
and https://help.shopify.com/en/manual/products/add-update-products and
https://help.shopify.com/en/manual/products/details/product-descriptions/shopify-magic

## Planned follow-up: Site Designer

Requested October 9, 2026. Implement after the design tweaks are complete;
this is a backlog item, not authorization to begin implementation or deploy.

- Let authenticated admin users view a desktop/mobile storefront preview beside
  an AI chat and request visual layout changes in plain language.
- Start with editable page sections: colors, fonts, spacing, banners, product
  grids, and section ordering. Supply page structure and screenshot context.
- Apply proposals to a draft preview, support iterative refinement, and retain
  version history with undo/rollback.
- Separate permissions for creating drafts, approving changes, and publishing;
  require an explicit authorized publishing action.
- Keep visual editing separate from payment, inventory, security, and integration
  settings. Treat new components or unrestricted code changes as a later scope.

Remaining: agree on editable sections and permission roles after design tweaks,
then implement and verify the draft-to-publish workflow in staging.

## Activation

In the Coolify **Staging - Commerce Apps** application environment, set runtime
variables (never frontend build arguments):

- `ADMIN_ASSISTANT_PROVIDER`: `openai` (default) or `openrouter`.
- `ADMIN_ASSISTANT_OPENAI_API_KEY`: dedicated OpenAI key when using OpenAI.
- `ADMIN_ASSISTANT_OPENROUTER_API_KEY`: dedicated OpenRouter key when using OpenRouter.
- `ADMIN_ASSISTANT_MODEL`: an available Responses API model supporting function calling.
- `ADMIN_ASSISTANT_ENABLED`: `true`.

Redeploy once after the provider, its key, model and enable flag are set. Default is disabled. The existing
`COOKIE_SECRET` signs edit proposals. No key is returned by the status endpoint,
written in browser storage, or logged. Do not paste a key into chat or Git.
Use dedicated provider credentials with appropriate spending controls. Setting the
flag to `false` disables both chat and apply endpoints.

## Behavior and boundaries

Authenticated Medusa admin users can ask about admin workflows and read up to
10 matching products, orders or inventory items per tool call. Product search
accepts title or ID; order search accepts number/ID; inventory search accepts
exact SKU/ID. An empty search returns recent records. Inventory is per location.
These are limited samples, not full-store analytics. Order tools omit buyer
identity, addresses, payment credentials and metadata. User-entered questions
and selected record fields are sent to the configured AI provider, using Responses API `store:false`;
this does not imply zero provider retention. Conversations stay in page memory
and disappear on navigation/reload/new conversation.

When asked, the assistant can prepare a title/description edit for one product.
The UI shows before/after and an explicit **Apply changes** button. Only a signed,
user-bound, 15-minute proposal can be applied. The server checks current copy
before applying; stale proposals are rejected. Copy-only workflow inputs cannot
change prices, stock, publishing, payments, order fulfillment or integrations.
An audit event logs actor/product/proposal IDs only. If applying times out,
check the product before asking for another proposal. No distributed lock is
implemented for concurrent manual edits; avoid editing the same product in
another tab during apply.

Requests are bounded to 12 messages/16,000 characters, 3 provider rounds,
1,200 output tokens per round, and 10 questions/hour/admin with one in flight.
The limiter and proposal replay guard are per backend process and reset on
restart; provider spending controls remain necessary. There is no automatic
background activity or persistent chat database.

## Verification

Backend/admin TypeScript, 11 focused tests and native admin bundling pass.
Tests cover input limits, configuration gate, buyer-field filtering, per-location
inventory, signed/tampered/user-bound/expired proposals, explicit copy-only apply,
stale/replayed proposals, origin/auth restrictions and simulated provider tools.
Live model answers and actual copy mutation remain pending the separate key;
no paid provider request or product mutation was used for deployment verification.
Official integration reference: https://developers.openai.com/api/docs/guides/function-calling

Deployed release: `e54384e1129736d66c4efb5dea0836ab5373920f`; Coolify deployment
`fk7tpusxpkubndzgypi8azys` finished 2026-10-09 16:48:56 UTC. Signed-in setup
state and real Medusa read/filter queries pass. Services and fresh queue healthy.
Evidence: `.local/admin-assistant/staging-assistant.jpg`, `checks.json`.

## Product workspace milestone — October 13, 2026

Implemented locally: native Products Create opens `/catalog/new`; the shared
editor groups details, images, variants/location quantities, organization and
Etsy preparation with one Save/Discard action. New-product variants accept direct
barcodes or generate unique internal RH identifiers (not registered UPCs).
Hair-claw fitting is conditional on product type. Inline product-type creation
and draft-only product creation are included.

AI copy and Etsy title/tag suggestions are reviewable and editable before applying
to a draft, with locked tags and Undo. The search checklist explains listing
completeness; it does not predict ranking or provide search-volume data.
Etsy copy updates, color inventory and static color photos require separate review
and explicit configuration. Existing Etsy SKUs and unselected inventory/photo
links are preserved. Color quantities are explicit channel allocations for
made-to-order color variants; there is no continuous stock synchronization or
atomic protection against concurrent external Etsy sales/edits. The compositor
exports approved 4-inch fits at 2000x2000. Measured 2-inch rendering remains
pending; saved actual product photos can be used instead.

Validation: 94 tests across 14 suites passed, backend TypeScript and full
backend/Admin build passed. Build lint reports 333 warnings. Twenty-one real
local API/database checks passed, including create/retry, generated/direct
barcodes, location quantities, image ordering, Etsy drafts and stale-edit guards;
disposable product data was removed. Browser checks covered native Create
routing and representative component flows. AI/provider/label calls in tests
were mocked; no live Etsy write, AI charge, postage purchase or deployment occurred.

Handoff: source is `src/admin/routes/catalog/new`, `src/admin/components`,
`src/api/admin/product-workspace`, `src/api/admin/products/[id]/workspace`,
`src/api/admin/products/[id]/etsy-listing`, `src/lib/product-admin.ts`,
`src/lib/admin-product-create.ts`, `src/lib/etsy`, and the new admin-operations
module/migration under `apps/backend`. Local evidence is
`.local/admin-commerce-20261013/{tests-final.log,build-final.log,local-api-checks.json}`.
Remaining: staging migration/deployment and signed-in acceptance, provider
credentials/scopes and isolated provider tests, then separately approved live
activation. Existing native Add Variant retains manual barcode entry.

### Description-editor comparison — October 14, 2026

Shopify's product rich-text editor offers paragraph/headings, bold/italic/underline,
bulleted and numbered lists, indentation, alignment, text/background colors,
links, tables, images, media embeds and HTML view. Reference:
https://help.shopify.com/en/manual/shopify-admin/productivity-tools/rich-text-editor

This staging release replaces the three-button Markdown editor with a Tiptap
visual editor: paragraphs/headings 1–6, bold/italic/underline, both list styles,
alignment, text color, links/unlink, tables with row/column tools, image URLs,
blockquote, clear formatting, Undo/Redo and HTML mode. It preserves the stored
description until an edit; old plain text and simple Markdown still render.
Supported HTML is sanitized on guarded creation/update and storefront render.
Website descriptions become plain text when starting an Etsy description or
requesting AI assistance. Scripts and video/audio embeds are unsupported.
Shopify's image-library picker/resizing, background-color chooser, indentation
controls and embedded media remain possible follow-up work rather than claimed
parity. Tests cover preservation and removal of unsafe tags/URLs/styles.

Isolated release source/evidence: `.local/admin-commerce-staging-20261014/`.
The release retains the latest size/finish editor and storefront changes from
staging; production module/provider registration was not copied from the dirty
working checkout. New integration activation flags default to disabled.


Staging acceptance completed October 14: final release
`4bb03e5ee9fecfef01bb3a4d0e07ba5cc21228be` is healthy. Real product reads and a
removed disposable draft verified the workflow; provider activation is still
pending. See `docs/staging-deployment.md` and
`.local/admin-commerce-staging-20261014/release.json` for evidence and scope.


## Compact editor and OpenRouter connection — October 14, 2026

The compact description editor is live in staging release
`3173d07fe972d2ab2d97da41b8f9b43d68d9715a`: primary formatting stays in a
single toolbar, extra tools live in More, and the initial editor height is 130px.
Desktop and 390px viewport checks passed; saved catalog copy was unchanged.

Both product writing and Ask Rusty support OpenRouter through its fixed Responses
endpoint. Staging uses `ADMIN_ASSISTANT_PROVIDER=openrouter` with
`openai/gpt-5.4-mini`. The dedicated Rustic Halo credential was retrieved from
1Password without logging its value and stored only in Coolify runtime settings.
No arbitrary provider URL is accepted; missing selected-provider credentials or
unknown providers disable requests. OpenRouter requires support for requested
parameters. Product suggestions retain strict output validation, 13 unique Etsy
tags of at most 20 characters, preserved locked tags, and explicit review.

Validation: 18 assistant/copy/apply tests, backend/admin build and admin TypeScript
passed. Two real OpenRouter requests using read-only Coffee Cup product facts
returned a description and 13 validated tags. Deployed browser acceptance follows
the staging release. Existing Etsy write/color-share and Shippo purchase gates
remain off. No production or Shopify configuration changed.

Evidence and isolated release: `.local/admin-openrouter-20261014/`, including
`provider-preflight.json`, `credential-report.json`, `tests.log`, `build.log`,
`typecheck.log` and `release.json`.

Live acceptance identified an unsupported `parallel_tool_calls` routing filter on
OpenRouter and a rejected generated tag set. The repair omits that unsupported
OpenRouter parameter while retaining the server's one-tool limit. Product-copy
JSON Schema now enforces action-specific empty unused fields, exactly 13 Etsy
tags, and 20-character tag limits at the provider as well as server validation.
A real locked-tag request and a complete two-round product lookup passed before
the repair deployment; 18 tests and the backend/Admin build passed again.

Final staging repair release `df136875b72068d2be9880fdacfcbdae2d65f356` finished
at 14:39:39 UTC. Live product-description review/apply/Undo, 13 unique Etsy tags
with locked phrase preserved, tag draft apply/Undo/Discard, and Ask Rusty product
lookup with a source link passed. Final generated copy remains an unsaved review
suggestion; existing product copy/Etsy metadata and all 424 catalog products are
unchanged. Both services are healthy and refreshed queue status is OK. Browser
evidence is in `browser-checks.json`, `description-ai-final.png`,
`etsy-ai-review.png` and `ask-rusty-lookup.png` under the OpenRouter evidence
directory. Owner can now test descriptions and tags in staging. Etsy writes,
color-sharing activation, label purchases and measured 2-inch rendering remain
separate integration work; no AI-connection blocker remains.


## Product-photo context for AI — October 14, 2026

Product creation, website description editing and Etsy title/description/tag
helpers now offer Use product photos. Up to three photos are selected with the
cover first by default; users can change the selection or turn it off for text
only. Selecting photos does not edit the product or upload an unsaved image.
Generation explicitly discloses that selected photos/facts go to the provider.

Saved public photos from `cdn.rustichalo.com` and `cdn.shopify.com` go directly
to the configured provider as Responses `input_image` content. Credentials,
private hosts, arbitrary remote sources and sensitive query parameters are
rejected, and this backend never fetches user-supplied URLs. Newly added local
photos are resized to at most 1024px and encoded as JPEG previews in the browser;
the server validates image bytes, bounds pixels/size, strips metadata and
normalizes them before sending. The three-photo limit and 5MB route body limit
bound uploads; no image data is persisted by this helper.

The prompt now specifies the requested writing task explicitly. Photos can
inform visible motifs, patterns and colors; they cannot establish material,
measurements, named finishes, construction or availability. Existing facts take
priority and unclear details should be omitted. Images may be mockups or show
multiple variants. All output remains an editable suggestion, with existing
Undo/save controls and Etsy tag/locked-phrase validation.

Validation before deployment: 22 focused tests, backend/Admin build and Admin
TypeScript passed. Real OpenRouter requests using three Coffee Cup product photos
returned a description and 13 validated Etsy tags, with three image parts in each
request. Local browser checks covered default selection, the three-photo limit,
text-only generation and an unsaved new-product upload converted to a JPEG
preview without product creation. Evidence/source/release: 
`.local/admin-photo-ai-20261014/`. Deployed acceptance is recorded below when
complete. No production/Shopify change, Etsy publication or label purchase.

Deployed photo release `03e189a95b2d601973fa1e07642bba1c3222c672`, deployment
`wjmatzyextofjcwuygryqwtt`, finished October 14 at 12:03:44 p.m. Eastern.
Both services are healthy. Native staging description generation with three
photos passed review/apply/Undo. Etsy generated 13 unique tags under the length
limit, preserved a locked phrase, and passed apply/Undo/Discard. At 390px, the
document and both photo pickers stay within the viewport. Anonymous/origin
guards returned 401/403; private image URLs and invalid 180KB image previews
returned 400 without contacting the provider. Catalog remains 424, with Coffee
Cup copy/Etsy metadata unchanged. Queue status was OK at 12:04:23 p.m. Eastern.

Final reports: `browser-checks.json`, `staging-checks.json`,
`deployed-services.json`, `release.json` and `staging-photo-description.png` in
`.local/admin-photo-ai-20261014/`. The clean product page is left open for owner
testing. No remaining blocker for photo-assisted descriptions/tags; activation
of external Etsy writes/color sharing and label purchases remains separate.


## Shared compact image gallery — October 14, 2026

The product workspace and new-product form now keep photos in one Images
section, with 76px thumbnail cards. Cover choice and a compact Manage button
preserve ordering/removal controls. The gallery owns one Use product photos for
AI switch and up to three per-photo Use for AI selections. Website and Etsy
writing helpers consume the same selected sources and show only a status and
Choose in Images link; duplicated thumbnail galleries were removed.

AI preferences are transient workspace state, separate from the persisted
product draft. They do not enable Save or change gallery membership/order/cover.
Removing a photo prunes it from both helpers; default selection uses the cover
first, and new unsaved uploads remain supported. Hair-claw fitting remains
conditional on product type. Backend photo validation/provider configuration
and manual suggestion review/apply/save behavior are unchanged.

Local validation: backend/Admin build and Admin TypeScript passed. Browser
fixture verified identical photo sources for description and Etsy requests, the
shared text-only switch, no duplicate helper images, selection without product
dirtiness, cover/reorder/remove, pruning, Discard, and the shared new-product
gallery. Provider requests were mocked for this UI-only change. Evidence and
isolated release: `.local/admin-shared-gallery-20261014/`. Live staging
acceptance is recorded after deployment.

Shared-gallery release `fdb06b2035e438970ae6937d77413788ec10151c`, deployment
`ajweydh54waugv2hvpatbdok`, finished at 1:00:59 p.m. Eastern. The owner's clean
existing staging preview was refreshed to bundle `index-DUecS4u-.js`. Native
Coffee Cup shows one gallery, 74x64px photo contents in 76px cards, and no
helper photo galleries. Both helpers used the same two-photo selection for
successful live description and 13 unique valid Etsy tags. Shared text-only
status and 390px gallery/management layout passed. Default three-photo selection
was restored, temporary notes/suggestions cleared, and Save stayed disabled.
The final staging tab is left open with the compact gallery visible.

Both services healthy; queue OK at 1:01:15 p.m. Eastern. Catalog remains 424
and product copy/Etsy metadata unchanged. Protected endpoints/photo-source
checks still return expected 401/403/400 responses. Final evidence is in
`browser-checks.json`, `staging-checks.json`, `deployed-services.json`,
`release.json` and `staging-shared-gallery.png` under the shared-gallery
directory. No remaining shared-gallery blocker. Production, Shopify, external
Etsy writes/color sharing and label purchases were unchanged.


### 2026-10-14: Product workspace interactions

Product sections now collapse without discarding fields, including Images,
shipping, publishing and Etsy. Validation opens all containing disclosures.
The shared compact gallery uses pointer dragging (mouse/touch) and keyboard
arrow keys for ordering, with cover/remove controls retained. Both writing
helpers accept none, any subset or all product photos; the default is all.
There is no three-photo count cap. Newly added previews are still resized,
with a 4.5 MB aggregate photo payload budget within the existing 5 MB route
limit; approved CDN URL and credential protections remain. Sharp previews
process sequentially to bound memory use.

Options now has an inline collapsible editor: add product-specific options
and values, link shared options and select their existing values. Option
changes save separately before other product edits. The authenticated,
origin-checked workspace/options route checks the product timestamp and
canonical option/value snapshot under the existing product lock, then uses
Medusa's native create/link workflow and protection for values used by
variants. Shared catalog names remain managed in the catalog. Variant
creation and the specialized image-fitting studio still use their dedicated
editors; converting those is remaining work, not part of the Options editor.

Scoped source and validation: `.local/admin-workspace-flow-20261014/`.
Local Admin TypeScript and backend/Admin build passed; photo aggregate bounds,
option payload preservation and shared-option safety have focused unit tests.
Browser checks cover real mouse dragging, keyboard ordering, shared all/none
photo selection, collapse/draft preservation, option draft isolation and local
option saves preserving variant SKU and price. Staging acceptance is recorded
in the release/report files after deployment. Production and Shopify untouched.


Staging acceptance (2026-10-14, 1:34:44 p.m. Eastern): commit
`386bbe3cba001f4bef735c048c65f457c477665d`, Coolify
`rdioacvr9bgixjqb6khcmqou`, finished; backend and storefront healthy. Native
Coffee Cup preview refreshed to the new gallery and inline Options editor.
Actual mouse drag moved the cover photo from first to third; Discard restored
its first position without saving. Live description and Etsy tag generation
both used all five selected photos; Etsy returned 13 unique tags within 20
characters. Suggestions were dismissed and temporary notes cleared. Product
and option Save buttons remain disabled, indicating no pending edits. The
424-product catalog and full Coffee Cup record stayed unchanged. Option-route
authentication (401), origin (403), stale snapshot (409), and aggregate photo
payload (400) checks passed. Seven focused tests, Admin TypeScript, and the
backend/Admin build passed. Evidence and exact scoped release:
`.local/admin-workspace-flow-20261014/{release.json,live-browser-checks.json,options-checks.json,staging-checks.json,deployed-services.json,staging-workspace.png}`.
Remaining UI work: variant creation, shared catalog option renaming, metadata
and image fitting retain their dedicated editors; Options management itself
is now inline. No credentials or blockers remain for testing this milestone.
Production/Shopify and Etsy/label purchase gates were not changed.


### 2026-10-14: Direct Etsy listing fields

Removed the redundant nested Prepare Etsy listing / Manage Etsy listing
disclosure. Opening the existing Etsy listing section now reveals the listing
ID, copy, tags, materials and writing helper directly. The outer section still
collapses; category guidance, search readiness and color-sharing subsections
retain their existing controls. No data or integration behavior changed.
Scoped source and validation evidence: `.local/admin-etsy-expander-20261014/`
(`release.json`, `typecheck.log`, `build.log`, `browser-checks.json`,
`deployed-services.json`, `staging-etsy-listing.png`). Staging acceptance is
recorded in the release and browser reports after deployment.

Etsy expander staging acceptance: commit
`f57fe9113d1b04c759ea6c0c8adc1824b3430b9f`, deployment
`jyqaembuhkmxkoly4g0gtqp6`, finished 2026-10-15T01:55:49Z. Direct fields and
outer-section collapse/draft preservation passed in the browser; temporary
input was restored and Save disabled. Both services healthy; catalog count
419 and full Coffee Cup record unchanged. No blocker remains.


### 2026-10-14: Shared hair-claw colors and product availability

Options now shows storefront-style color swatches with availability checkboxes;
all shared colors are selected by default. Product exclusions save separately
with product timestamp and palette revision guards, preserve variant records,
and participate in the workspace draft/navigation guard. The shared Hair-claw
colors page adds, retires/restores and edits swatches for the entire catalog.
Retirement keeps existing names, SKUs, inventory and order references intact.

Shared additions apply in small resumable batches, creating only missing native
color variants with generated barcodes, existing size/finish prices, inventory
policies and shipping fields. Price/policy ambiguity is reported per product.
Existing offers/overlays and unconfigured sizes remain unchanged; deterministic
SKUs support recovery after interrupted native writes. A legacy single-source
product can gain color variants only with an explicit physical size in its
description and a saved base USD price; its original variant is retained.

Storefront choices, preview swatches and available variants read the shared
palette; excluded/retired colors are also rejected for cart creation, direct
adds, quantity updates and completion. Etsy color export/sharing validates the
same availability. No external Etsy write gate or label gate is enabled.

Local checks: 28 focused backend tests, three storefront offer/color tests, Admin
and storefront TypeScript, full backend/Admin build and storefront build. A
local browser fixture verified default checks, product-only save, draft guards,
shared add/retire/save and blocked navigation with pending edits. Exact scope,
source, logs and staging acceptance: `.local/admin-claw-colors-20261014/`.
Staging verification is pending deployment and recorded in its release/report
files; do not treat local checks as deployed acceptance.

Color acceptance repair: the first staging fixture exposed that native global
option values also require product-specific links. Color sync now uses Medusa's
create-and-link workflow before creating variants. A regression checks those
links and duplicate-free retries. Legacy template cart guards also restrict
requests to exposed color variant IDs, preserving old SKUs for references.
Options labels shared colors whose variants are still pending. 30 focused
backend tests and the final backend/Admin build and type check passed. Final
staging acceptance is recorded in `.local/admin-claw-colors-20261014/`.

Final shared-color staging acceptance: feature commit
`bb31caf2431ed7337bc64001dd026cc1b21cfe30`, permission correction
`e950cc3c832916780fcc8a91877ad45da97a43b9`, final native-link/legacy-guard repair
`e891a4df998ccec18d22f8f6eb915536c0cfcf46`. Deployment
`nryhpsv7yhng4dgjycgeid31` finished 2026-10-15T02:29:09Z. Both services healthy;
queue report at 02:34:54Z is OK with zero failed/waiting/active/delayed/paused.

Verified actual Medusa variant creation (12 missing colors), unique generated
barcodes, inherited prices/weights/inventory policy, preserved source variant,
and a zero-creation retry. Product exclusion save, stale revision, origin and
invalid-input guards passed. Excluded colors were rejected on cart creation,
direct adds, quantity changes and completion. Real Admin uncheck/save removed
Purple from the storefront; Select all/save restored it. Selecting generated
Rose preserved the real variant in the URL. A separate legacy fixture added
13 colors, preserved its original variant and blocked the old uncolored SKU.
All disposable products were soft-deleted and test cart lines removed.

The catalog still contains 419 products. All 69 hair claws were reviewed against
the shared 13-color palette. Coffee Cup and Giraffe Kisses were already
configured. Autumn Leaf Claw Clip gained 13 color variants using its explicit
4-inch description, existing $14 price, inventory policy, confirmed 1 oz weight
and assigned accessory box. Its original SKU, barcode, prices and inventory
record remain unchanged. The other 418 products match their fresh snapshots.
66 templated claws have no approved size/finish offers; they are reported for
review and stay disabled. Their color defaults remain selected, but approving
size/finish offers is still required before selling or applying new color
variants. Do not bypass those approval/physical-template checks.

Six packing previews and four actual Shippo sandbox checkout quotes still pass
($6.07 single claw/pair, $12.41 four claws, $6.34 two claws plus four pairs to
synthetic ZIP 94105). No payments, orders or labels were created. Etsy write/color
and label gates remain off; production and Shopify were untouched.

Evidence: `.local/admin-claw-colors-20261014/` contains `release.json`,
`initial-release.json`, `permission-release.json`, `staging-checks.json`,
`security-checks.json`, `legacy-checks.json`, `browser-checks.json`,
`renderer-checks.json`, `cleanup-report.json`, `catalog-before-palette-apply.json`,
`catalog-palette-apply.json`, `catalog-palette-verified.json`, full legacy product
before/after snapshots, `legacy-product-shipping.json`, `packing-verification.json`,
`sandbox-rates.json`, `deployed-services.json`, `staging-product-colors.png`, scoped
source and build/typecheck/test logs. The clean Coffee Cup preview is open with
Options expanded; the owner's original unsaved tab was preserved. Remaining work
is owner testing and the 66 pre-existing offer approvals; no code blocker remains.

Owner clarification: base hair-claw color is included in the product price, with
no additional color charge. Each color uses the full existing price for its
size/finish; adding a shared color must never add a surcharge. Color checkboxes
control availability only. The color-sync planner already copies that price.

### 2026-10-15: Color availability by physical size

Hair-claw Options replaces the generic imported Option name editor with the
dedicated swatches; historical option and variant records are retained. Other
product types keep their normal option editor. Separate 2-inch and 4-inch
controls save product exclusions independently. Shared colors also have size
checkboxes, including when adding a new color. Existing palettes without a
size setting retain availability in both sizes; existing product exclusions
apply to both until edited. No catalog migration or offer activation is needed.

Storefront purchase choices, selected-size previews, Etsy exports, native color
sync and cart create/add/update/complete checks honor size-specific availability.
Changing size selects a compatible saved variant if the prior color is absent.
Offer price updates support different color counts per size and preserve the
full size/finish price without a color surcharge. Unapproved 2-inch artwork
and the 66 pre-existing unconfigured offers remain disabled.

Local validation: 35 backend tests in four suites, four storefront tests,
backend/Admin/storefront TypeScript, backend/Admin build and storefront build
passed. Local UI verified zero Option name rows, independent size selections,
save payloads, and a new shared color assigned to only one size. Staging
acceptance and exact release scope are recorded in
`.local/admin-claw-sizes-20261015/`; deployment verification is pending.

Staging acceptance complete: `a4a39a7f2133d58d676f2af76963e014f58f6f11`,
Coolify `3lqxn3gkbgzhbnvrpnygiwsg`, finished 2026-10-15T13:55:54Z with both
services healthy. Coffee Cup shows zero Option name rows and both size controls.
A disposable two-size product verified independent save, actual storefront size
switching to a compatible real variant, unchanged full prices ($1/$2 fixture),
and rejected unavailable cart creation/add/quantity/completion. A real Admin
2-inch exclusion save preserved 4-inch availability; removing all 2-inch colors
removed that size from storefront choices. Shared size checkboxes were present.
The fixture was soft-deleted and its cart cleared. Catalog count remains 419;
Coffee Cup and the shared palette match their pre-test snapshots. No real
product availability, prices, inventory, Etsy writes, paid labels or production
settings changed. Latest queue report read at acceptance was OK (13:51:27Z).

Evidence and handoff: `release.json`, `browser-checks.json`, `staging-checks.json`,
`cleanup-report.json`, `deployed-services.json`, `staging-size-colors.png`, scoped
source and validation logs in `.local/admin-claw-sizes-20261015/`. Owner testing
and the existing 66 size/finish approvals remain; no code/deployment blocker.

### 2026-10-15: Remaining existing 4-inch catalog approved for staging tests

The owner authorized the remaining 4-inch hair claws using their existing saved
prices and color choices. This supersedes the earlier pending approval for those
4-inch variants only. The bounded setup script
`deploy/staging/configure-existing-four-inch-claws.cjs` selected 1,209 existing
4-inch variants across 66 products and changed only template availability.
No variants, prices, stock, shipping weights, images, fits or product statuses
were rewritten. Original/hidden variant records remain saved. Two-inch choices
stay hidden; no geometry or new artwork fit was synthesized.

Catalog products use their approved real variant IDs directly, so purchasing
from original photos does not require enabling an unfinished overlay. Existing
style/finish options and prices ($12, $14, $15, $16) remain distinct. Shared-color
sync now groups these approved combinations by their saved size/style/finish,
copying the full existing price and policy for new colors without adding hidden
sizes or flattening finishes. Existing Coffee Cup/Giraffe offer setup is intact.

Coffee Cup has 50 saved variants and 13 active 4-inch color variants. Active
records carry the selected color through cart/orders/inventory/Etsy; historical
and hidden records are retained and excluded from normal editing by default.

Local validation: 37 focused backend tests, four storefront tests, backend
TypeScript and backend/Admin build passed. Catalog execution backups, snapshots,
plan, exact scoped source and verification reports are in
`.local/staging-four-inch-catalog-20261015/`. Coastal Catch remains an existing
draft because its source image is missing. Final deployment/cart/browser
acceptance is recorded in this milestone's release and handoff reports.

Final acceptance complete: compatibility commit
`629b1bef11c61ee8dd575026ece1c89331ae5c23`, deployment
`4rsflao8kikfqbu5fc0lf7lk` finished 2026-10-15T14:31:32Z; both services healthy.
The catalog still has 419 products. All 69 claws have configured 4-inch choices
(1,248 variants total); 68 are published and Coastal Catch remains draft.
Snapshot comparisons verify all existing variant records/prices/weights/images
and statuses, 353 unrelated products, and Coffee Cup are unchanged. Nine actual
cart combinations across five products matched saved prices; hidden 2-inch and
legacy IDs were rejected, and all test cart items were removed. Browser checks
verified Mandala $12 Natural / $14 Colors by Cate with real Rose variant URL,
and Seashell Admin's 13 active / 25 saved variants with no duplicate option rows.

A disposable shared-color test created 24 native variants across two preserved
style prices, added no hidden 2-inch variants, and retried with zero additions.
Original variant fields/prices stayed unchanged; Medusa's native option linking
refreshes option-value timestamps as expected. The fixture was soft-deleted and
catalog/palette/Coffee Cup rechecked. All 69 color plans have no missing current
colors. Evidence and exact file paths are in
`.local/staging-four-inch-catalog-20261015/final-handoff.md`, with snapshots,
`catalog-verification.json`, `checkout-checks.json`, `cart-cleanup.json`,
`color-sync-checks.json`, `color-fixture-cleanup.json`, `catalog-color-plans.json`,
`browser-checks.json`, `deployed-services.json`, `staging-mandala-colors.png` and
`release.json`. Queue report at 14:27:38Z was OK with no failed/waiting jobs.
External Etsy writes and label purchases remain gated off; production/Shopify
were untouched. Remaining: owner testing, Coastal Catch's missing photo, and
the separate measured/approved 2-inch setup.

### 2026-10-15: Grouped size/finish prices and color checkboxes

Hair-claw Variants, pricing & stock now shows collapsible size/finish (or saved
style) groups, one base price per currency applying to every saved color in the
group, and per-group color checkboxes. Prices and color availability share the
main Save changes action and draft/navigation guard. Individual SKUs, stock,
advanced prices and legacy rows remain behind Individual variants, stock &
identifiers. Unoffered configured groups start collapsed and saving their price
does not enable their size/artwork. Non-claw option editing is unchanged.

Group overrides preserve old size-wide exclusions until a group is edited.
Storefront variant filtering, compatible finish/size switching, cart guards and
Etsy exports honor the selected group's color availability. Group prices retain
other currencies/regions/tiers and native IDs. The workspace route now verifies
a shared native/API price revision under both product locks before price writes;
color updates validate group identities and the shared palette revision.

Local checks: 50 backend tests in five focused suites, five storefront tests,
backend/Admin/storefront TypeScript and builds. Browser verification: one price
field produced 13 price patches, other finish price/color stayed unchanged,
combined main save persisted, individual rows stayed collapsed, and navigation
kept an unsaved group draft. Exact source, logs and staging acceptance live in
`.local/admin-grouped-claws-20261015/`. Final deployment acceptance is pending.
