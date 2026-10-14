import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { ADMIN_OPERATIONS } from '../../../../../modules/admin-operations'
import { allowedOrigin } from '../../../assistant/route'
import { labelConfiguration, labelOrder, assertWebsiteOrder, parcelSchema, quoteLabel, purchaseLabel, reconcileLabel, attachPurchasedLabel, dispatchPurchasedLabel } from '../../../../../lib/shippo-labels'
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (!req.auth_context?.actor_id || req.auth_context.actor_type !== 'user') return res.sendStatus(401)
  const order = await labelOrder(req.scope, req.params.id)
  if (!order) return res.status(404).json({ message: 'Order not found.' })
  const [operation] = await (req.scope.resolve(ADMIN_OPERATIONS) as any).listAdminOperations({ operation_key: `shippo-purchase:${req.params.id}` })
  let config: any = null, message = ''
  try { config = labelConfiguration(); if (!operation) assertWebsiteOrder(order, config.channels) } catch (error) { config = null; message = (error as Error).message }
  return res.json({ enabled: Boolean(config), test: config?.test ?? false, message, status: operation?.status ?? null, label: operation?.status === 'purchased' ? { id: operation.id, ...operation.payload.label, fulfillment_id: operation.payload.fulfillment_id ?? null, test: operation.payload.mode === 'test' } : null })
}
export async function POST(req: AuthenticatedMedusaRequest<any>, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store')
  const actor = req.auth_context?.actor_id
  if (!actor || req.auth_context.actor_type !== 'user') return res.sendStatus(401)
  if (!allowedOrigin(req)) return res.sendStatus(403)
  try {
    const body = req.body
    if (body?.action === 'quote') return res.json(await quoteLabel(req.scope, req.params.id, parcelSchema.parse(body.parcel), actor))
    if (body?.action === 'purchase' && typeof body.quote_id === 'string' && typeof body.rate_id === 'string' && body.confirm_purchase === true) return res.json({ label: await purchaseLabel(req.scope, req.params.id, body.quote_id, body.rate_id, actor) })
    if (body?.action === 'reconcile') return res.json(await reconcileLabel(req.scope, req.params.id))
    if (body?.action === 'fulfill') return res.json(await attachPurchasedLabel(req.scope, req.params.id, actor))
    if (body?.action === 'dispatch' && body.confirm_handoff === true) return res.json(await dispatchPurchasedLabel(req.scope, req.params.id))
    return res.status(400).json({ message: 'Choose a supported shipping action and confirm paid purchase or carrier handoff explicitly.' })
  } catch (error) { return res.status(409).json({ message: (error as Error).message || 'Label status could not be confirmed. Check Shippo before retrying.' }) }
}
