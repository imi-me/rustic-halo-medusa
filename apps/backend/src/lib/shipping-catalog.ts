import catalog from './shipping-catalog.json'

export type ShippingItem = { package_id: string; weight_oz: number; quantity: number }
type CartItem = { quantity: number; variant_sku?: string | null; variant?: { sku?: string | null } | null }

// Explicit owner-approved SKU mappings. Unknown products must never receive a fallback rate.
export function shippingItems(items: CartItem[]): ShippingItem[] {
  const mappings = catalog as Record<string, { package_id: string; weight_oz: number }>
  let count = 0
  return items.map(item => {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 100) {
      throw new Error('A valid item quantity is required for shipping.')
    }
    count += item.quantity
    if (count > 100) throw new Error('Orders over 100 items require a packing review.')
    const sku = item.variant_sku || item.variant?.sku || ''
    if (!Object.prototype.hasOwnProperty.call(mappings, sku)) {
      throw new Error('Shipping measurements are not confirmed for one of these items. Contact Rustic Halo.')
    }
    return { ...mappings[sku], quantity: item.quantity }
  })
}
