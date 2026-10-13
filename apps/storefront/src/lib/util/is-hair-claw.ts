import { HttpTypes } from "@medusajs/types"

export function isHairClaw(product: HttpTypes.StoreProduct) {
  return Boolean(product.metadata?.hair_claw_overlays_v1) ||
    /hair[\s-]*(?:claws?|clips?)/i.test(`${product.title || ""} ${product.handle || ""}`)
}
