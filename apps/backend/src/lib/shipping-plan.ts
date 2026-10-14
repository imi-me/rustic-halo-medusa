import { shippingItems } from './shipping-catalog'
import { assignmentSchema, SHIPPING_KEY, type PackageConfig, type ShippingPackage } from './shipping-packages'
export type PackedParcel = { package_id: string; package_name: string; length: number; width: number; height: number; weight: number; item_count: number; distance_unit: 'in'; mass_unit: 'oz' }
type Unit = { weight: number; group: 'standard' | 'hair_claws' | 'earrings'; product: string; capacity: number; alone: boolean }
export async function planShipping(items: any[], config: PackageConfig, products?: any): Promise<PackedParcel[]> {
  if (!Array.isArray(items) || items.some(row => !Number.isSafeInteger(row.quantity) || row.quantity < 1) || items.reduce((n, row) => n + row.quantity, 0) > 100) throw new Error('Orders require 1–100 physical items for automatic packing.')
  const ids = [...new Set(items.map(row => row.variant_id ?? row.variant?.id).filter(Boolean))]
  const variants: any[] = ids.length ? await products.listProductVariants({ id: ids }, { relations: ['product'], take: 100 }) : []
  if (ids.some(id => !variants.some(row => row.id === id))) throw new Error('A product variant is missing. Review packing before requesting rates.')
  const groups = new Map<string, { box: ShippingPackage; units: Unit[] }>()
  for (const item of items) {
    const variant = variants.find(row => row.id === (item.variant_id ?? item.variant?.id))
    const product = variant?.product
    const override = variant?.metadata?.[SHIPPING_KEY] ? assignmentSchema.parse(variant.metadata[SHIPPING_KEY]) : null
    const assigned = product?.metadata?.[SHIPPING_KEY] ? assignmentSchema.parse(product.metadata[SHIPPING_KEY]) : null
    const assignment = override?.package_id ? override : assigned
    let packageId: string, weight: number, group: Unit['group'] = 'standard', capacity: number | null = null, alone = false
    if (assignment?.package_id) {
      packageId = assignment.package_id; weight = Number(Number(variant?.weight) > 0 ? variant.weight : product?.weight) / 28.349523125
      if (!Number.isFinite(weight) || weight <= 0) throw new Error('Enter a confirmed item weight in grams for each assigned product or variant.')
      group = assignment.packing_group; capacity = assignment.units_per_box; alone = assignment.ships_alone
    } else {
      const legacy = shippingItems([{ quantity: item.quantity, variant_sku: variant?.sku ?? item.variant_sku ?? item.variant?.sku }])[0]
      packageId = legacy.package_id; weight = legacy.weight_oz
      if (packageId === 'hair-claw-box' || packageId === 'earring-box') { group = packageId === 'hair-claw-box' ? 'hair_claws' : 'earrings'; packageId = 'hair-claw-box' }
    }
    const box = config.packages.find(row => row.id === packageId)
    if (!box) throw new Error('The assigned shipping package is missing. Review this product’s shipping settings.')
    if (group !== 'standard' && !box.accessory_limits.length) throw new Error('Choose standard packing or configure accessory combinations for this package.')
    const productKey = product?.id ?? variant?.product_id ?? variant?.sku ?? item.variant_sku ?? item.variant?.sku ?? 'item'
    const max = Math.min(capacity ?? box.capacity, box.capacity)
    const key = `${box.id}:${group === 'standard' || capacity !== null ? 'standard:' + max : 'accessories'}:${alone ? 'alone:' + productKey : box.combine_products ? 'combined' : productKey}`
    if (!groups.has(key)) groups.set(key, { box, units: [] })
    const target = groups.get(key)!
    for (let i = 0; i < item.quantity; i++) target.units.push({ weight, group: capacity !== null ? 'standard' : group, capacity: max, alone, product: productKey })
  }
  const parcels: PackedParcel[] = []
  const pack = (box: ShippingPackage, units: Unit[]) => {
    const weight = Math.ceil((units.reduce((n, unit) => n + unit.weight, 0) + box.packaging_weight) * 1000 - 1e-9) / 1000
    if (weight <= 0 || weight > 1120) throw new Error('Packed weight exceeds the supported parcel range. Review the shipment.')
    parcels.push({ package_id: box.id, package_name: box.name, length: box.length, width: box.width, height: box.height, weight, item_count: units.length, distance_unit: 'in', mass_unit: 'oz' })
  }
  for (const { box, units } of groups.values()) {
    if (units[0].alone) { for (const unit of units) pack(box, [unit]); continue }
    if (units[0].group === 'standard') { for (let i = 0; i < units.length; i += units[0].capacity) pack(box, units.slice(i, i + units[0].capacity)); continue }
    const claws = units.filter(row => row.group === 'hair_claws'), earrings = units.filter(row => row.group === 'earrings')
    // Match the existing approved packing preference: fullest combinations first,
    // then more claws, while still minimizing the number of boxes.
    const choices = new Map<string, [number, number]>()
    for (const limit of box.accessory_limits) for (let c = 0; c <= Math.min(claws.length, limit.hair_claws); c++) for (let e = 0; e <= Math.min(earrings.length, limit.earring_pairs); e++) if (c || e) choices.set(`${c}:${e}`, [c, e])
    const ordered = [...choices.values()].sort((a, b) => (b[0] + b[1]) - (a[0] + a[1]) || b[0] - a[0])
    const memo = new Map<string, [number, number][] | null>()
    const solve = (c: number, e: number): [number, number][] | null => {
      if (!c && !e) return []
      const key = `${c}:${e}`; if (memo.has(key)) return memo.get(key)!
      let best: [number, number][] | null = null
      for (const [pc, pe] of ordered) {
        if (pc > c || pe > e) continue
        const rest = solve(c - pc, e - pe)
        if (rest && (!best || rest.length + 1 < best.length)) best = [[pc, pe], ...rest]
      }
      memo.set(key, best); return best
    }
    const plan = solve(claws.length, earrings.length)
    if (!plan) throw new Error('No confirmed combination fits these items. Review package rules.')
    let ci = 0, ei = 0
    for (const [c, e] of plan) { pack(box, [...claws.slice(ci, ci + c), ...earrings.slice(ei, ei + e)]); ci += c; ei += e }
  }
  return parcels
}
