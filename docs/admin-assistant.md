# Ask Rustic Halo staging assistant

Admin route: http://localhost:19000/app/assistant (private staging tunnel).

## Activation

In the Coolify **Staging - Commerce Apps** application environment, set runtime
variables (never frontend build arguments):

- `ADMIN_ASSISTANT_OPENAI_API_KEY`: the separate project API key, marked secret.
- `ADMIN_ASSISTANT_MODEL`: an available Responses API model supporting function calling.
- `ADMIN_ASSISTANT_ENABLED`: `true`.

Redeploy once after all three are set. Default is disabled. The existing
`COOKIE_SECRET` signs edit proposals. No key is returned by the status endpoint,
written in browser storage, or logged. Do not paste a key into chat or Git.
Use a separate OpenAI project with appropriate spending controls. Setting the
flag to `false` disables both chat and apply endpoints.

## Behavior and boundaries

Authenticated Medusa admin users can ask about admin workflows and read up to
10 matching products, orders or inventory items per tool call. Product search
accepts title or ID; order search accepts number/ID; inventory search accepts
exact SKU/ID. An empty search returns recent records. Inventory is per location.
These are limited samples, not full-store analytics. Order tools omit buyer
identity, addresses, payment credentials and metadata. User-entered questions
and selected record fields are sent to OpenAI, using Responses API `store:false`;
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
