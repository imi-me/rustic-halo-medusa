import { Modules } from '@medusajs/framework/utils'
import { offerProduct } from './hair-claw-offers'
import { planClawOrderChoices } from './hair-claw-order-choices'
import type { ClawColor } from './hair-claw-colors'

// Color availability is order data. Applying the palette never creates stock identities.
export function planClawColorSync(product: any, _palette: ClawColor[]) {
  return { ...planClawOrderChoices(product), plans: [] }
}
export async function syncClawProduct(scope: any, id: string, palette: ClawColor[]) {
  return scope.resolve(Modules.LOCKING).execute(`hair-claw-media:${id}`, async () => {
    const product = await offerProduct(scope, id)
    const plan = planClawColorSync(product, palette)
    if (!plan.current) await scope.resolve(Modules.PRODUCT).updateProducts(id, { metadata: plan.metadata })
    return { id, title: product.title, created: 0, retained: plan.retained.length, retired: plan.retired.length, status: plan.current ? 'current' : 'updated' }
  }, { timeout: 5, expire: 300 })
}
