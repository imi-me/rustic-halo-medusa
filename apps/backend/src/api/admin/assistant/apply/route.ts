import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { updateProductsWorkflow } from '@medusajs/medusa/core-flows'
import { consumeProposal, isReady, readProposal } from '../../../../lib/admin-assistant'
import { allowedOrigin } from '../route'

export async function POST(req: AuthenticatedMedusaRequest<{ token: unknown }>, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store')
  const actor = req.auth_context?.actor_id
  if (!actor) return res.sendStatus(401)
  if (!allowedOrigin(req)) return res.sendStatus(403)
  if (!isReady()) return res.status(503).json({ message: 'Assistant is disabled.' })
  let proposal
  try { proposal = readProposal(req.body?.token, actor) } catch (error) { return res.status(400).json({ message: (error as Error).message }) }
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({ entity: 'product', fields: ['id', 'title', 'description'], filters: { id: proposal.productId } })
    const product = data[0]
    if (!product || product.title !== proposal.before.title || (product.description ?? null) !== proposal.before.description) return res.status(409).json({ message: 'Product changed since this proposal. Ask for a fresh proposal before applying.' })
    try { consumeProposal(proposal) } catch (error) { return res.status(409).json({ message: (error as Error).message }) }
    await updateProductsWorkflow(req.scope).run({ input: { products: [{ id: proposal.productId, title: proposal.after.title, description: proposal.after.description }] } })
    req.scope.resolve('logger').info(`Admin assistant copy update: actor=${actor} product=${proposal.productId} proposal=${proposal.nonce}`)
    return res.json({ applied: true, productId: proposal.productId })
  } catch { return res.status(502).json({ message: 'The update could not be confirmed. Open the product to check it before requesting a new proposal.' }) }
}
