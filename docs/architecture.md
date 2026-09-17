# Rustic Halo commerce architecture

Status: accepted baseline for implementation.

## System boundaries

- **Medusa** is the commerce system of record for catalog, channels, orders, customers, fulfillment state, and inventory availability.
- **MarketSuite** is the boundary for the legacy POS, generated kiosk barcodes, kiosk payment confirmation, and the handoff into personalization production.
- **Etsy** is an external sales channel. Its listings and orders synchronize through an adapter, not through storefront-specific business logic.
- **Storefront** is the customer-facing web channel.
- **Kiosk** is a Copper Mill client that creates a personalized item request. It cannot mark an order paid or release work to production by itself.

Every external operation must be idempotent. Store external IDs on Medusa records and accept replayed webhooks without duplicating orders, reservations, payments, or production jobs.

## Inventory model

### Shop inventory

The website, Etsy, events, and direct sales consume the same **Shop** physical inventory pool. Represent Shop as one Medusa stock location and expose it through the applicable sales channels. Synchronization adapters update or reserve this same pool; they must not create channel-specific copies of stock.

An event is represented by an event sales-channel or order tag such as `event:<event-id>`. Taking products to an event does **not** transfer inventory to another location. Event reporting is derived from the tag while availability continues to come from Shop.

### Copper Mill inventory

**Copper Mill** is a separate Medusa stock location with dedicated physical inventory. Its on-hand and reserved quantities never roll into Shop availability. Transfers between Shop and Copper Mill occur only when the business physically moves stock and records that movement.

### Made-to-order products

Made-to-order variants remain sellable when finished-goods inventory is zero. Model this explicitly with a product/variant attribute and Medusa inventory policy that permits backorders or does not manage finished stock. Raw-material or capacity constraints are a later production-planning concern and must not be simulated by fake finished-stock quantities.

## Copper Mill personalization flow

1. A kiosk session captures the base product, personalization choices, price, and non-sensitive production notes.
2. The backend creates a unique temporary POS item for that configuration. It is scoped to the session/order and is not added to the reusable public catalog.
3. MarketSuite assigns the barcode. The only accepted format is `INV#########`: the literal prefix `INV` followed by exactly nine decimal digits, for a total length of 12 characters. The application validates but does not independently invent a MarketSuite barcode.
4. The legacy POS scans the temporary item and takes payment. No card or payment credential passes through the kiosk or Medusa customization endpoints.
5. MarketSuite confirms the paid transaction back to the integration endpoint. The confirmation must match the temporary item, kiosk session, amount, currency, and external transaction ID.
6. Only an idempotently accepted MarketSuite payment confirmation may move the order from `awaiting_pos_payment` to `ready_for_production` and create the production job.

Timeouts, abandoned sessions, price mismatches, duplicate confirmations, and refunds require explicit states. A kiosk submission by itself never implies payment.

## Core records and metadata

Initial implementation should keep the model small:

- Stock locations: `shop`, `copper-mill`
- Sales context: `website`, `etsy`, `direct`, and `event:<event-id>`
- Fulfillment type: stocked or made-to-order
- Kiosk session ID and temporary POS item ID
- MarketSuite barcode and transaction ID
- Integration idempotency key and last synchronization status
- Production status, separate from payment and fulfillment status

Do not put secrets, full payment details, or unrestricted personalization uploads in metadata.

## Integration ownership

- `integrations/etsy` owns Etsy authentication, listing mapping, order ingestion, and reconciliation with Shop inventory.
- `integrations/marketsuite` owns temporary POS item creation, barcode receipt/validation, payment confirmation, refunds/cancellations, and production release.
- Medusa workflows own business transitions and transactions. Transport adapters call workflows rather than changing inventory or order state directly.
- Scheduled reconciliation detects missed webhooks and reports discrepancies without silently overwriting conflicting counts.

## Delivery sequence

1. Establish Medusa catalog, the two stock locations, sales channels, and made-to-order policy.
2. Brand and configure the storefront against Shop inventory.
3. Implement Etsy mapping and reconciliation with sandbox/test listings.
4. Implement signed MarketSuite callbacks and temporary item lifecycle.
5. Build the kiosk client against those backend contracts.
6. Add production queue UI, audit history, alerting, and operational runbooks.

Vendor credentials, exact MarketSuite API schemas, Etsy application approval, tax configuration, payment provider selection, shipping rules, and product data are deployment inputs, not assumptions made in this repository.
