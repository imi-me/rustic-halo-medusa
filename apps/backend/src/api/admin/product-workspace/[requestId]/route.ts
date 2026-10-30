import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { z } from 'zod'
import { channelDraftStatus, retryChannelDrafts } from '../../../../lib/product-channel-drafts'
import { allowedOrigin } from '../../assistant/route'
export async function GET(req:AuthenticatedMedusaRequest,res:MedusaResponse) {
  res.setHeader('Cache-Control','no-store')
  if(req.auth_context?.actor_type!=='user'||!req.auth_context.actor_id)return res.sendStatus(401)
  if(!z.string().uuid().safeParse(req.params.requestId).success)return res.sendStatus(400)
  try{return res.json({preparation:await channelDraftStatus(req.scope,req.params.requestId)})}catch(error){return res.status(404).json({message:(error as Error).message})}
}
export async function POST(req:AuthenticatedMedusaRequest,res:MedusaResponse) {
  res.setHeader('Cache-Control','no-store')
  if(req.auth_context?.actor_type!=='user'||!req.auth_context.actor_id)return res.sendStatus(401)
  if(!allowedOrigin(req))return res.sendStatus(403)
  if(!z.string().uuid().safeParse(req.params.requestId).success)return res.sendStatus(400)
  try{return res.json({preparation:await retryChannelDrafts(req.scope,req.params.requestId)})}catch(error){return res.status(409).json({message:(error as Error).message})}
}
