import type { MedusaStoreRequest, MedusaResponse } from '@medusajs/framework/http'
import { validateCartTax } from '../../../../../lib/tax/validate-cart'

export async function POST(req: MedusaStoreRequest, res: MedusaResponse) {
 try {
  const channels=req.publishable_key_context?.sales_channel_ids
  if(!channels?.length) return res.status(403).json({message:'Cart unavailable.'})
  await validateCartTax(req.scope,req.params.id,channels)
  res.json({valid:true})
 } catch {
  res.status(409).json({message:'We could not verify your checkout total. Please refresh checkout and try again before paying.'})
 }
}
