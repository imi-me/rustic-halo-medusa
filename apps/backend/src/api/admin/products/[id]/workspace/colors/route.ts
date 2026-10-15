import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { Modules } from '@medusajs/framework/utils'
import { allowedOrigin } from '../../../../assistant/route'
import { CLAW_COLORS_KEY, clawExclusionsSchema, clawSizeExclusionsSchema } from '../../../../../../lib/hair-claw-colors'
import { readClawPalette } from '../../../../../../lib/hair-claw-color-store'
import { ADMIN_OPERATIONS } from '../../../../../../modules/admin-operations'
export async function POST(req: AuthenticatedMedusaRequest<any>, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (!req.auth_context?.actor_id || req.auth_context.actor_type !== 'user') return res.sendStatus(401)
  if (!allowedOrigin(req)) return res.sendStatus(403)
  const sized = req.body?.excluded_by_size !== undefined
  const parsed = sized ? clawSizeExclusionsSchema.safeParse(req.body.excluded_by_size) : clawExclusionsSchema.safeParse(req.body?.excluded)
  if (sized && req.body?.excluded !== undefined) return res.status(400).json({ message: 'Send color availability by size or for all sizes, not both.' })
  if (!parsed.success || typeof req.body?.expected_updated_at !== 'string') return res.status(400).json({ message: 'Check the selected colors and reload the saved product.' })
  try {
    await req.scope.resolve(Modules.LOCKING).execute('rh-admin-product-identifiers', () => req.scope.resolve(Modules.LOCKING).execute(`hair-claw-media:${req.params.id}`, async () => {
      const products = req.scope.resolve(Modules.PRODUCT), product = await products.retrieveProduct(req.params.id)
      if (!product.metadata?.hair_claw_template_v2) throw Error('Set up purchasable color variants for this hair claw first.')
      if (new Date(product.updated_at!).toISOString() !== new Date(req.body.expected_updated_at).toISOString()) throw Error('Product changed. Your color selections are kept; reload before saving.')
      const palette = await readClawPalette(req.scope.resolve(ADMIN_OPERATIONS))
      if (palette.revision !== req.body.expected_palette_revision) throw Error('Shared colors changed. Reload before saving.')
      const bySize = sized ? parsed.data as { '2': string[]; '4': string[] } : { '2': parsed.data as string[], '4': parsed.data as string[] }
      if (Object.values(bySize).flat().some(name => !palette.colors.some(c => c.name === name))) throw Error('Choose colors from the shared hair-claw palette.')
      await products.updateProducts(req.params.id, { metadata: { ...product.metadata, [CLAW_COLORS_KEY]: { ...(product.metadata?.[CLAW_COLORS_KEY] as Record<string, unknown> ?? {}), excluded: [], excluded_by_size: bySize, excluded_by_group: {} } } })
    }))
    return res.json({ id: req.params.id })
  } catch (error) { return res.status(409).json({ message: (error as Error).message }) }
}
