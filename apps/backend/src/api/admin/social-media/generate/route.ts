import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { allowedOrigin } from '../../assistant/route'
import { acquire, isReady } from '../../../../lib/admin-assistant'
import { generateCaption, productSnapshot, SocialError } from '../../../../lib/social-media'
export async function POST(req: AuthenticatedMedusaRequest<any>, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store')
  const actor = req.auth_context?.actor_id
  if (!actor) return res.sendStatus(401)
  if (!allowedOrigin(req)) return res.sendStatus(403)
  if (!isReady()) return res.status(503).json({ message: 'AI drafting is waiting for admin assistant setup.' })
  const release = acquire(actor)
  if (!release) return res.status(429).json({ message: 'One AI request at a time, up to 10 per hour across admin tools.' })
  try {
    if (!/^prod_[A-Za-z0-9]+$/.test(req.body?.product_id || '')) throw new SocialError('Choose a product first.')
    const product = await productSnapshot(req.scope.resolve(ContainerRegistrationKeys.QUERY), req.body.product_id, null)
    return res.json({ caption: await generateCaption(product, req.body.platform, req.body.direction) })
  } catch (error) { return res.status(error instanceof SocialError ? error.status : 502).json({ message: error instanceof SocialError ? error.message : 'AI could not generate a caption. Try again later.' }) }
  finally { release() }
}
