import type { MedusaRequest, MedusaResponse, MedusaNextFunction } from '@medusajs/framework/http'
import type { IPaymentModuleService } from '@medusajs/framework/types'

/** Reject inherited Access paths and verify before Medusa queues the event. */
export async function guardStripeWebhook(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  // Express removes the mounted matcher from req.path for global middleware.
  const path = req.originalUrl.split('?')[0]
  if (path !== '/hooks/payment/stripe_stripe') return res.status(404).end()
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end()
  }
  try {
    const payment = req.scope.resolve<IPaymentModuleService>('payment')
    await payment.getWebhookActionAndData({
      provider: 'stripe_stripe',
      payload: { data: req.body as Record<string, unknown>, rawData: req.rawBody, headers: req.headers },
    })
  } catch {
    return res.status(400).end()
  }
  return next()
}
