import { model } from '@medusajs/framework/utils'

const ClawColor = model.define('hair_claw_color', {
  id: model.id().primaryKey(),
  slug: model.text().unique(),
  name: model.text(),
  sort_order: model.number(),
  swatch_hex: model.text().nullable(),
  reference_asset_key: model.text().nullable(),
  processing_parameters: model.json().nullable(),
  version: model.number().default(1),
  status: model.enum(['draft', 'approved', 'retired']).default('draft'),
})

export default ClawColor
