import { MedusaError } from '@medusajs/framework/utils'
import { activeOfferVariantIds } from './hair-claw-offers'
export async function guardHairClawOffer(req:any,_res:any,next:()=>void) {
  const id=req.body?.variant_id
  if (!id || typeof id!=='string') return next()
  const {data}=await req.scope.resolve('query').graph({entity:'product_variant',filters:{id},fields:['id','product.metadata']})
  const allowed=activeOfferVariantIds(data[0]?.product?.metadata)
  if (allowed && !allowed.has(id)) throw new MedusaError(MedusaError.Types.INVALID_DATA,'That hair-claw size and finish is not currently available. Choose an option with an enabled overlay.')
  return next()
}
