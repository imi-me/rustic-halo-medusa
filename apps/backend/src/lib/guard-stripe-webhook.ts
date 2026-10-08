import type { MedusaRequest, MedusaResponse, MedusaNextFunction } from '@medusajs/framework/http'

/** Access path exceptions may inherit to descendants; reject those at origin. */
export function guardStripeWebhook(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  if (req.path !== '/hooks/payment/stripe_stripe') return res.status(404).end()
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end()
  }
  return next()
}
