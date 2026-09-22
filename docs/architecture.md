# Rustic Halo commerce architecture

Status: baseline updated with September 20 connector scope. The current rollout
is specified in `integration-rollout.md`; kiosk work below is deferred.

## System boundaries

- **Medusa** is the commerce system of record for catalog, channels, orders, customers, fulfillment state, and inventory availability.
- **MarketSuite** bridges Copper Mill inventory to AntiqueSoft (AS). Medusa
  replaces Shopify's existing connector role for Rustic Halo; reporting stays
  in MarketSuite. AS provides no customer information. Inventory reductions are
  the existing sales signal, not verified payment or customer records.
- **Etsy** is an external sales channel. Its listings and orders synchronize through an adapter, not through storefront-specific business logic.
- **Storefront** is the customer-facing web channel.
- **Kiosk** is a Copper Mill client that creates a personalized item request. It cannot mark an order paid or release work to production by itself.

Every external operation must be idempotent. Store external IDs on Medusa records and accept replayed webhooks without duplicating orders, reservations, payments, or production jobs.

## Inventory model

### Shop inventory

Represent **Shop** as a separate physical stock location. Rustic Halo website
orders are made to order and must not be limited by Copper Mill finished stock.
Confirm stocked versus made-to-order handling per Etsy listing before syncing
availability. Channels selling physical Shop stock share that pool rather than
creating channel-specific copies.

An event is represented by an event sales-channel or order tag such as `event:<event-id>`. Taking products to an event does **not** transfer inventory to another location. Event reporting is derived from the tag while availability continues to come from Shop.

### Copper Mill inventory

**Copper Mill** is a separate Medusa stock location with dedicated physical inventory. Its on-hand and reserved quantities never roll into Shop availability. Transfers between Shop and Copper Mill occur only when the business physically moves stock and records that movement.

### Made-to-order products

Made-to-order variants remain sellable when finished-goods inventory is zero. Model this explicitly with a product/variant attribute and Medusa inventory policy that permits backorders or does not manage finished stock. Raw-material or capacity constraints are a later production-planning concern and must not be simulated by fake finished-stock quantities.

## Copper Mill personalization flow — deferred design

This proposed flow is not the initial connector contract. AS customer data is
unavailable, and inventory reductions cannot satisfy payment confirmation.
Any future transaction confirmation requires a separately verified source.

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
- `integrations/marketsuite` initially owns Copper Mill item mirroring and
  inventory synchronization through MarketSuite to AS, with stable mappings,
  deduplication and loop prevention. Customer ingestion and paid-order creation
  from AS inventory changes are excluded. Kiosk capabilities remain deferred.
- Medusa workflows own business transitions and transactions. Transport adapters call workflows rather than changing inventory or order state directly.
- Scheduled reconciliation detects missed webhooks and reports discrepancies without silently overwriting conflicting counts.

## Delivery sequence

1. Establish Medusa catalog, the two stock locations, sales channels, and made-to-order policy.
2. Import the Shopify catalog and location inventory with a reviewed staging diff.
3. Replace Shopify's MarketSuite connector role for Rustic Halo in staging;
   verify item mirroring, inventory changes, replay and reconciliation.
4. Implement Etsy mapping and reconciliation with sandbox/test listings.
5. Plan cutover before enabling external writes; continue theme work independently.
6. Consider kiosk, production queue and deeper reporting as a later scope.

Vendor credentials, exact MarketSuite API schemas, Etsy application approval, tax configuration, payment provider selection, shipping rules, and product data are deployment inputs, not assumptions made in this repository.
