import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { z } from 'zod'
import { allowedOrigin } from '../../../../assistant/route'
import { readOrderDetails, savePreparation } from '../../../../../../lib/etsy/order-workspace-store'
const idSchema = z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER)
const preparation = z.object({ stage: z.enum(['needs_making', 'ready_to_pack']), expected_revision: z.string().uuid() }).strict()
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'private, no-store')
  if (!req.auth_context?.actor_id || req.auth_context.actor_type !== 'user') return res.sendStatus(401)
  const id = idSchema.safeParse(req.params.id)
  if (!id.success) return res.status(400).json({ message: 'Invalid Etsy receipt ID.' })
  try { return res.json(await readOrderDetails(req.scope, id.data)) }
  catch { return res.status(502).json({ message: 'This Etsy order could not be opened. Refresh or view it in Etsy.' }) }
}
export async function POST(req: AuthenticatedMedusaRequest<any>, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'private, no-store')
  if (!req.auth_context?.actor_id || req.auth_context.actor_type !== 'user') return res.sendStatus(401)
  if (!allowedOrigin(req)) return res.sendStatus(403)
  const id = idSchema.safeParse(req.params.id), body = preparation.safeParse(req.body)
  if (!id.success || !body.success) return res.status(400).json({ message: 'Choose a preparation stage for the current saved order.' })
  try { return res.json({ order: await savePreparation(req.scope, id.data, body.data, req.auth_context.actor_id) }) }
  catch (error) { const message = error instanceof Error && /^(This order changed|Etsy order details changed|Only paid, unshipped)/.test(error.message) ? error.message : 'Preparation could not be saved. Reopen the order and retry.'; return res.status(409).json({ message }) }
}
