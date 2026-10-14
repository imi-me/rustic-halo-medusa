import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'
import { AdminLinkProductOptions } from '@medusajs/medusa/api/admin/products/validators'
import { createAndLinkProductOptionsToProductWorkflow } from '@medusajs/medusa/core-flows'
import { allowedOrigin } from '../../../../assistant/route'
import { optionsSnapshot } from '../../../../../../lib/product-options-edit'
export async function POST(req: AuthenticatedMedusaRequest<any>, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (!req.auth_context?.actor_id || req.auth_context.actor_type !== 'user') return res.sendStatus(401)
  if (!allowedOrigin(req)) return res.sendStatus(403)
  const parsed = AdminLinkProductOptions.safeParse(req.body?.changes)
  if (!parsed.success || typeof req.body?.expected_options !== 'string' || req.body.expected_options.length > 100_000 || typeof req.body?.expected_updated_at !== 'string') return res.status(400).json({ message: 'Invalid option update. Reload the product.' })
  try {
    await req.scope.resolve(Modules.LOCKING).execute('rh-admin-product-identifiers', async () => {
      const { data: [product] } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({ entity: 'product', filters: { id: req.params.id }, fields: ['id', 'updated_at', 'options.id', 'options.title', 'options.is_exclusive', 'options.values.id', 'options.values.value'] })
      if (!product || optionsSnapshot(product.options ?? []) !== req.body.expected_options || new Date(product.updated_at!).toISOString() !== new Date(req.body.expected_updated_at).toISOString()) throw new Error('Product options changed. Your draft is kept; reload before saving.')
      await createAndLinkProductOptionsToProductWorkflow(req.scope).run({ input: { product_id: req.params.id, ...parsed.data } })
    })
    return res.json({ id: req.params.id })
  } catch (error) { return res.status(409).json({ message: (error as Error).message }) }
}
