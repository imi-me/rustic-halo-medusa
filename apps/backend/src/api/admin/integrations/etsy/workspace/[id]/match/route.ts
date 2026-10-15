import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { z } from 'zod'
import { allowedOrigin } from '../../../../../assistant/route'
import { matchInput, matchOrderItem, OrderMatchError, readMatchChoices } from '../../../../../../../lib/etsy/order-item-matching-store'
const idSchema=z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER)
const querySchema=z.object({transaction_id:idSchema,product_id:z.string().startsWith('prod_')})
const staff=(req:AuthenticatedMedusaRequest)=>req.auth_context?.actor_id&&req.auth_context.actor_type==='user'
export async function GET(req:AuthenticatedMedusaRequest,res:MedusaResponse){
 res.setHeader('Cache-Control','private, no-store')
 if(!staff(req))return res.sendStatus(401)
 const id=idSchema.safeParse(req.params.id),query=querySchema.safeParse(req.query)
 if(!id.success||!query.success)return res.status(400).json({message:'Choose a product for this order item.'})
 try{return res.json(await readMatchChoices(req.scope,id.data,query.data.transaction_id,query.data.product_id))}
 catch(error){return res.status(409).json({message:error instanceof OrderMatchError?error.message:'Product choices could not be loaded. Reopen the order and retry.'})}
}
export async function POST(req:AuthenticatedMedusaRequest<any>,res:MedusaResponse){
 res.setHeader('Cache-Control','private, no-store')
 if(!staff(req))return res.sendStatus(401)
 if(!allowedOrigin(req))return res.sendStatus(403)
 const id=idSchema.safeParse(req.params.id),body=matchInput.safeParse(req.body)
 if(!id.success||!body.success)return res.status(400).json({message:'Choose a product, size and variant for the current order.'})
 try{return res.json(await matchOrderItem(req.scope,id.data,body.data,req.auth_context.actor_id))}
 catch(error){return res.status(409).json({message:error instanceof OrderMatchError?error.message:'This match could not be reviewed or saved. Check the product’s confirmed shipping settings and reopen the order.'})}
}
