import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { createEtsyAuthorization, etsyReadConfig } from '../../../../lib/etsy/oauth'

// Backend is private in staging; the owner-only storefront relay sets the browser cookie.
export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store')
  const config = etsyReadConfig()
  if (!config) return res.status(503).json({ message: 'Etsy read connection is not configured.' })
  const authorization = createEtsyAuthorization(config)
  return res.json(authorization)
}
