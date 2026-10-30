import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { readEtsyDraftSettings } from '../../../../lib/etsy/draft-settings'
export async function GET(req:AuthenticatedMedusaRequest,res:MedusaResponse) {
  res.setHeader('Cache-Control','no-store')
  if(req.auth_context?.actor_type!=='user'||!req.auth_context.actor_id)return res.sendStatus(401)
  try{const {access,client,...settings}=await readEtsyDraftSettings(req.scope);return res.json(settings)}catch(error){return res.status(409).json({message:(error as Error).message})}
}
