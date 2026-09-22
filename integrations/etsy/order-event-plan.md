# Etsy order-event plan

Status: disabled webhook scaffold and enabled, verified read-only order report,
September 22, 2026.

## Current boundary

The backend can validate and journal Etsy webhook envelopes, but the endpoint is
disabled unless `ETSY_WEBHOOK_INGEST_ENABLED=true`. The webhook scaffold has not
been deployed or registered with Etsy, and no webhook subscription exists. The
journal stores only Etsy's delivery ID, event type, shop ID, receipt ID,
resource URL, timestamps and processing status. It does not store the raw
payload, buyer information, address, payment details or line items.

The endpoint accepts only Etsy's documented `order.paid`, `order.canceled`,
`order.shipped` and `order.delivered` events. It verifies the signature against
the exact raw body, rejects timestamps outside five minutes, binds the resource
URL to the connected shop and receipt, and deduplicates on `webhook-id`. New
entries remain `received_unprocessed`; no handler fetches a receipt, creates a
Medusa order, changes inventory, sends email or updates Etsy.

## Read-only order report milestone

The backend now includes an authenticated Medusa Admin route at
`/admin/integrations/etsy/orders` and an **Etsy orders** admin page. It reads a
30-day window by default and limits requests to 90 days and 500 receipts. The
response includes receipt IDs, dates, paid/shipped status, totals, line titles,
SKUs and quantities. It discards buyer identity, email, shipping address,
payment details and the raw Etsy response, and stores none of those fields.

The route was enabled and verified on staging on September 22, 2026. The Etsy
OAuth reconnection succeeded with `transactions_r`; the implementation never
requests `transactions_w`. The authenticated Medusa Admin report fetched all
three receipts in its 30-day window and displayed only receipt/date/status,
item count, total and SKU information. Anonymous access returned 401. The
backend and storefront were healthy after deployment. No buyer identity, email,
address, payment detail or raw Etsy response is displayed or stored, and the
report performs no Etsy, Medusa order, email, or inventory write. Thirty-five
focused Etsy tests and both backend/admin TypeScript checks pass locally.

## Proposed processing stages

1. **Intake journal:** acknowledge each valid delivery once. Etsy delivery ID is
   the idempotency key. Duplicate deliveries return success without new work.
2. **Receipt read:** only after separate approval, add `transactions_r`,
   reauthorize the shop, and fetch the receipt named by Etsy's resource URL.
   Persist a minimal immutable snapshot keyed by receipt ID and Etsy's last
   modification marker. Do not assume address fields are available.
3. **Identity reconciliation:** match each Etsy transaction to exactly one
   Medusa variant using the reviewed SKU mapping. Missing and duplicate matches
   enter a review queue. They never become zero inventory or a guessed product.
4. **Read-only order view:** begin with an external-order record or report. Do
   not create a normal paid Medusa order until payment, tax, discounts, shipping,
   refunds, cancellations and fulfillment semantics are mapped and tested.
5. **Reconciliation:** periodically compare Etsy receipts to completed journal
   entries so a missed webhook can be detected. Recovery targets one receipt and
   reruns the same idempotent handler.
6. **Outbound actions:** shipment/tracking submission requires `transactions_w`
   and can notify the buyer. Keep it outside the first receipt-read milestone.

## Inventory ownership

Etsy online products are made to order. An Etsy sale must not decrement Copper
Mill inventory. The first order integration therefore performs no inventory
write. Any future quantity action needs a documented location, source owner,
loop-prevention marker and reconciliation rule. Market Suite remains the bridge
for Copper Mill and AntiqueSoft; Etsy order events cannot masquerade as an
AntiqueSoft sale or customer record.

## Decisions recorded for the first order-report phase

1. The first Etsy view is a read-only external-order report. It does not create
   Medusa orders.
2. Etsy owns fulfillment status and tracking. `transactions_w` remains absent.
3. The report stores no buyer or shipping data.
4. The UI defaults to 30 days and allows at most 90 days; full shop history is
   not imported.
5. Webhook intake remains a separate, disabled future milestone. Enabling it
   still requires staging signature and duplicate-delivery tests, failed-job
   visibility, receipt reconciliation and a rollback procedure.

## Verification required before any future webhook deployment

- Run the local webhook unit tests and full backend TypeScript check.
- Apply the journal migration in staging and verify the endpoint remains 503
  while disabled.
- Store the signing secret outside Git, enable intake, and use Etsy's webhook
  portal test delivery before subscribing to a commerce event.
- Verify one delivery, one duplicate, one stale delivery and one invalid
  signature. Confirm no order, inventory, email or provider request occurred.
- Disable the endpoint again until the receipt-read milestone is approved.

References: [Etsy webhooks](https://developers.etsy.com/documentation/essentials/webhooks/),
[Etsy API reference](https://developers.etsy.com/documentation/reference), and
[Medusa raw webhook bodies](https://docs.medusajs.com/learn/fundamentals/api-routes/parse-body).
