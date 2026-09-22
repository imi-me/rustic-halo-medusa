import { model } from '@medusajs/framework/utils'

const EtsyConnection = model.define('etsy_connection', {
  id: model.id().primaryKey(),
  shop_id: model.number(),
  encrypted_refresh_token: model.text(),
  access_expires_at: model.dateTime(),
  scopes: model.json(),
  connected_at: model.dateTime(),
  last_read_at: model.dateTime().nullable(),
})

export default EtsyConnection
