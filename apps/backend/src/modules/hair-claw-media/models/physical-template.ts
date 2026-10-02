import { model } from '@medusajs/framework/utils'

// One record represents one photographed physical claw size and geometry.
// Asset keys remain empty until an approved master and masks are supplied.
const PhysicalTemplate = model.define('hair_claw_physical_template', {
  id: model.id().primaryKey(),
  slug: model.text().unique(),
  name: model.text(),
  size_label: model.text(),
  physical_dimensions: model.json().nullable(),
  master_asset_key: model.text().nullable(),
  transparent_master_key: model.text().nullable(),
  claw_body_mask_key: model.text().nullable(),
  protected_mask_key: model.text().nullable(),
  shadow_asset_key: model.text().nullable(),
  geometry: model.json().nullable(),
  version: model.number().default(1),
  status: model.enum(['draft', 'approved', 'retired']).default('draft'),
})

export default PhysicalTemplate
