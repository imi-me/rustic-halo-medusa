import { inventoryBody } from './color-sharing'
export type OriginalEtsyOffer = { sku: string; properties: { property_id: number; values: string[] }[]; variant_id: string }
const key = (properties: any[]) => JSON.stringify(properties.map(p => [p.property_id, p.values]).sort((a,b) => Number(a[0]) - Number(b[0])))

/** Change SKU dependencies only after every existing size/finish has an explicit original identity. */
export function planEtsyOrderColorCleanup(inventory: any, originals: OriginalEtsyOffer[]) {
  const body = inventoryBody(inventory)
  const colors = [...new Set<number>(body.products.flatMap((p: any) => p.property_values.filter((v: any) => /^(?:(?:primary|base|claw) )?colou?r$/i.test(v.property_name)).map((v: any) => v.property_id)))]
  if (colors.length !== 1 || !originals.length) throw Error('Review the existing Color option and original SKU mappings.')
  const colorId = colors[0], offers = new Map(originals.map(o => [key(o.properties), o]))
  if (offers.size !== originals.length || new Set(originals.map(o => o.sku)).size !== originals.length || originals.some(o => !o.sku.trim() || !o.variant_id)) throw Error('Original size/finish SKU mappings are ambiguous.')
  const grouped = new Map<string, string>(), seen = new Set<string>(), combinations = new Set<string>()
  for (const product of body.products) {
    const color = product.property_values.filter((v: any) => v.property_id === colorId)
    if (color.length !== 1 || product.offerings.length !== 1) throw Error('Review the Etsy offering structure.')
    const group = key(product.property_values.filter((v: any) => v.property_id !== colorId)), original = offers.get(group)
    if (!original) throw Error('An existing size/finish has no reviewed original SKU.')
    const offer = product.offerings[0], allocation = JSON.stringify([offer.price, offer.quantity, offer.is_enabled])
    if (grouped.has(group) && grouped.get(group) !== allocation) throw Error('Existing colors have different prices or quantities. Review before sharing a SKU.')
    grouped.set(group, allocation); seen.add(group)
    const combination = key(product.property_values)
    if (combinations.has(combination)) throw Error('Duplicate Etsy color combination.')
    combinations.add(combination)
    product.sku = original.sku
  }
  if (seen.size !== offers.size) throw Error('A reviewed size/finish was not found in Etsy.')
  body.sku_on_property = body.sku_on_property.filter((id: number) => id !== colorId)
  body.price_on_property = body.price_on_property.filter((id: number) => id !== colorId)
  body.quantity_on_property = body.quantity_on_property.filter((id: number) => id !== colorId)
  return body
}
