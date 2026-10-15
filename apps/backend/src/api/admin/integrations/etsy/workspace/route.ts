import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { allowedOrigin } from '../../../assistant/route'
import { readOrderWorkspace, refreshOrderWorkspace } from '../../../../../lib/etsy/order-workspace-store'
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'private, no-store')
  if (!req.auth_context?.actor_id || req.auth_context.actor_type !== 'user') return res.sendStatus(401)
  try { return res.json(await readOrderWorkspace(req.scope)) }
  catch { return res.status(503).json({ message: 'Connect Etsy with order-read permission and enable the order report to use this workspace.' }) }
}
export async function POST(req: AuthenticatedMedusaRequest<any>, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'private, no-store')
  if (!req.auth_context?.actor_id || req.auth_context.actor_type !== 'user') return res.sendStatus(401)
  if (!allowedOrigin(req)) return res.sendStatus(403)
  if (req.body?.action !== 'refresh' || Object.keys(req.body).length !== 1) return res.status(400).json({ message: 'Choose Refresh orders.' })
  try { await refreshOrderWorkspace(req.scope); return res.json(await readOrderWorkspace(req.scope)) }
  catch { return res.status(502).json({ message: 'Etsy refresh failed. Saved orders are kept; retry shortly or check the Etsy connection.' }) }
}
