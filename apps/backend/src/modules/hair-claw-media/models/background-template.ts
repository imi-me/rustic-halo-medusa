import { model } from '@medusajs/framework/utils'

const BackgroundTemplate = model.define('hair_claw_background_template', {
  id: model.id().primaryKey(),
  slug: model.text().unique(),
  name: model.text(),
  kind: model.enum(['catalog', 'studio', 'lifestyle', 'seasonal']),
  source_asset_key: model.text().nullable(),
  positioning: model.json().nullable(),
  sort_order: model.number().default(0),
  version: model.number().default(1),
  status: model.enum(['draft', 'approved', 'retired']).default('draft'),
})

export default BackgroundTemplate
