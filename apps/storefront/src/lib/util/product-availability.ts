import { HttpTypes } from "@medusajs/types"

export function isProductSoldOut(product: HttpTypes.StoreProduct) {
  return !!product.variants?.length && product.variants.every(variant =>
    variant.manage_inventory === true && !variant.allow_backorder &&
    typeof variant.inventory_quantity === "number" && variant.inventory_quantity <= 0
  )
}
