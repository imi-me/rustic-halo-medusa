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
