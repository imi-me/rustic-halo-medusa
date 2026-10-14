import { assignmentSchema, SHIPPING_KEY, type PackageConfig } from './shipping-packages'
export function shippingAssignment(product: any) { return assignmentSchema.parse(product?.metadata?.[SHIPPING_KEY] ?? {}) }
export function validateAssignments(config: PackageConfig, product: any, variants: any[], previous?: any) {
  const base = shippingAssignment(product)
  const check = (item: any, prior: any, fallback: any) => {
    const own = shippingAssignment(item), assignment = own.package_id ? own : base
    if (!assignment.package_id) return
    const box = config.packages.find(row => row.id === assignment.package_id)
    if (!box || (!box.active && assignment.package_id !== shippingAssignment(prior ?? {}).package_id && assignment.package_id !== shippingAssignment(previous ?? {}).package_id)) throw new Error('Choose an active shipping package.')
    if (assignment.units_per_box && assignment.units_per_box > box.capacity) throw new Error('Product quantity per box cannot exceed the package capacity.')
    if (assignment.packing_group !== 'standard' && !box.accessory_limits.length) throw new Error('Accessory packing requires confirmed combinations on the package.')
    const weight = Number(Number(item.weight) > 0 ? item.weight : fallback.weight)
    if (!Number.isFinite(weight) || weight <= 0) throw new Error('Enter a confirmed item weight in grams before assigning a shipping package.')
  }
  if (!variants.length) check(product, previous, product)
  for (const variant of variants) check(variant, previous?.variants?.find((row: any) => row.id === variant.id), product)
}
