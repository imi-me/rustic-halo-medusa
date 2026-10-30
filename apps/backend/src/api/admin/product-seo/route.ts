import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { z } from 'zod'
import { allowedOrigin } from '../assistant/route'
import { isReady } from '../../../lib/admin-assistant'
import { applyBulkSeo, bulkSeoCatalog, bulkSeoView, controlBulkSeo, readBulkSeo, startBulkSeo } from '../../../lib/bulk-product-seo'
import { readProductSeo } from '../../../lib/product-seo-values'
const id=z.string().regex(/^prod_[A-Za-z0-9]+$/)
const input=z.discriminatedUnion('action',[
  z.object({action:z.literal('start'),revision:z.string(),product_ids:z.array(id).min(1).max(1000).optional()}).strict(),
  z.object({action:z.enum(['stop','discard','retry']),revision:z.string()}).strict(),
  z.object({action:z.literal('apply'),run_id:z.string().uuid(),products:z.array(z.object({id,title:z.string().max(100),description:z.string().max(320)}).strict()).min(1).max(20)}).strict(),
])
export async function GET(req:AuthenticatedMedusaRequest,res:MedusaResponse) {
  res.setHeader('Cache-Control','no-store')
  if(!req.auth_context?.actor_id||req.auth_context.actor_type!=='user')return res.sendStatus(401)
  try{
    const state=await readBulkSeo(req.scope),products=state.run?undefined:await bulkSeoCatalog(req.scope)
    return res.json({ready:isReady(),...bulkSeoView(state),...(products?{catalog:{total:products.length,needsWording:products.filter(p=>['published','draft','proposed'].includes(p.status)&&(!readProductSeo(p.metadata).title.trim()||!readProductSeo(p.metadata).description.trim())).length}}:{})})
  }catch{return res.status(502).json({message:'Product search wording could not load. Refresh to try again.'})}
}
export async function POST(req:AuthenticatedMedusaRequest,res:MedusaResponse) {
  res.setHeader('Cache-Control','no-store')
  if(!req.auth_context?.actor_id||req.auth_context.actor_type!=='user')return res.sendStatus(401)
  if(!allowedOrigin(req))return res.sendStatus(403)
  const parsed=input.safeParse(req.body);if(!parsed.success)return res.status(400).json({message:'Choose a supported bulk action and bounded search fields.'})
  const value=parsed.data
  if(['start','retry'].includes(value.action)&&!isReady())return res.status(503).json({message:'Ask Rusty needs its configured provider before generation.'})
  try{
    const state=value.action==='start'?await startBulkSeo(req.scope,req.auth_context.actor_id,value.revision,value.product_ids):value.action==='apply'?await applyBulkSeo(req.scope,value.run_id,value.products):await controlBulkSeo(req.scope,value.revision,value.action)
    return res.json({ready:isReady(),...bulkSeoView(state)})
  }catch(error){return res.status(409).json({message:(error as Error).message})}
}
