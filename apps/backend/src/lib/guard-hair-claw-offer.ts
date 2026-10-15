import { MedusaError } from '@medusajs/framework/utils'
import { activeOfferVariantIds } from './hair-claw-offers'
import { clawColorAvailable, variantClawColor } from './hair-claw-colors'
import { readClawPalette } from './hair-claw-color-store'
import { ADMIN_OPERATIONS } from '../modules/admin-operations'
async function check(req: any, variant: any) {
  const product = variant?.product
  if (variant?.metadata?.claw_palette_offer && !product?.metadata?.hair_claw_template_v2?.variant_ids?.includes(variant.id)) throw new MedusaError(MedusaError.Types.INVALID_DATA, 'This new hair-claw color is still being prepared. Choose a saved available color.')
  const allowed = activeOfferVariantIds(product?.metadata)
  if (allowed && !allowed.has(variant.id)) throw new MedusaError(MedusaError.Types.INVALID_DATA,'That hair-claw size and finish is not currently available. Choose an option with an enabled overlay.')
  if (variantClawColor(product ?? {}, variant ?? {})) {
    const palette = await readClawPalette(req.scope.resolve(ADMIN_OPERATIONS))
    if (!clawColorAvailable(product, variant, palette.colors)) throw new MedusaError(MedusaError.Types.INVALID_DATA, 'That hair-claw color is not currently available. Choose an available color.')
  }
}
export async function guardHairClawOffer(req:any,_res:any,next:()=>void) {
  const ids = req.body?.variant_id ? [req.body.variant_id] : (Array.isArray(req.body?.items) ? req.body.items : []).map((item: any) => item.variant_id)
  for (const id of ids) {
    if (typeof id !== 'string') continue
    const { data } = await req.scope.resolve('query').graph({ entity: 'product_variant', filters: { id }, fields: ['id', 'metadata', 'options.option_id', 'options.value', 'product.metadata'] })
    if (data[0]) await check(req, { ...data[0], id })
  }
  return next()
}
export async function guardCartClawColors(req: any, _res: any, next: () => void) {
  const { data } = await req.scope.resolve('query').graph({ entity: 'cart', filters: { id: req.params.id }, fields: ['id', 'items.id', 'items.variant.id', 'items.variant.metadata', 'items.variant.options.option_id', 'items.variant.options.value', 'items.variant.product.metadata'] })
  for (const item of data[0]?.items ?? []) {
    if (req.params.line_id && item.id !== req.params.line_id) continue
    if (item.variant) await check(req, item.variant)
  }
  return next()
}
