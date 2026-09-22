import { model } from '@medusajs/framework/utils'

const EtsyWebhookDelivery = model.define('etsy_webhook_delivery', {
  id: model.id().primaryKey(),
  webhook_id: model.text(),
  event_type: model.text(),
  shop_id: model.number(),
  receipt_id: model.number(),
  resource_url: model.text(),
  emitted_at: model.dateTime(),
  received_at: model.dateTime(),
  status: model.text(),
})

export default EtsyWebhookDelivery
