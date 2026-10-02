import { MedusaService } from '@medusajs/framework/utils'
import PhysicalTemplate from './models/physical-template'
import ClawColor from './models/claw-color'
import BackgroundTemplate from './models/background-template'
import DesignRecipe from './models/design-recipe'

class HairClawMediaService extends MedusaService({
  PhysicalTemplate,
  ClawColor,
  BackgroundTemplate,
  DesignRecipe,
}) {}

export default HairClawMediaService
