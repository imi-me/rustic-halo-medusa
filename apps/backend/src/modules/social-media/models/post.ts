import { model } from '@medusajs/framework/utils'
export default model.define('rh_social_post', {
  id: model.id().primaryKey(),
  title: model.text(),
  product_id: model.text().nullable(),
  product_title: model.text().nullable(),
  image_url: model.text().nullable(),
  platform: model.enum(['instagram', 'facebook']),
  caption: model.text(),
  planned_date: model.text().nullable(),
  status: model.enum(['draft', 'review', 'approved']).default('draft'),
  version: model.number().default(1),
  actor_id: model.text(),
})
