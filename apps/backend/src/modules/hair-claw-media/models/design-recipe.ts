import { model } from '@medusajs/framework/utils'
import PhysicalTemplate from './physical-template'
import BackgroundTemplate from './background-template'

// A design recipe is attached to a Medusa Product through a module link.
// Keeping its photographed design asset separate from the physical template
// permits the same design to be reviewed against a different real claw size.
const DesignRecipe = model.define('hair_claw_design_recipe', {
  id: model.id().primaryKey(),
  design_name: model.text(),
  design_asset_key: model.text().nullable(),
  source_image_key: model.text().nullable(),
  claw_body_mask_key: model.text().nullable(),
  protected_mask_key: model.text().nullable(),
  cutout_asset_key: model.text().nullable(),
  shadow_asset_key: model.text().nullable(),
  physical_template: model.belongsTo(() => PhysicalTemplate),
  background_template: model.belongsTo(() => BackgroundTemplate).nullable(),
  option_selector: model.json().nullable(),
  alignment: model.json().nullable(),
  version: model.number().default(1),
  status: model.enum(['draft', 'approved', 'retired']).default('draft'),
})

export default DesignRecipe
