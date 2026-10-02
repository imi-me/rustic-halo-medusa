import { defineLink } from '@medusajs/framework/utils'
import ProductModule from '@medusajs/medusa/product'
import HairClawMediaModule from '../modules/hair-claw-media'

// A design can have an independently approved recipe for each physical size.
export default defineLink(
  ProductModule.linkable.product,
  { linkable: HairClawMediaModule.linkable.hairClawDesignRecipe, isList: true }
)
