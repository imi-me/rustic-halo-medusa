import { model } from '@medusajs/framework/utils'
export default model.define('admin_operation', {
  id: model.id().primaryKey(),
  operation_key: model.text().unique(),
  kind: model.text(),
  resource_id: model.text(),
  status: model.text(),
  payload: model.json(),
})
