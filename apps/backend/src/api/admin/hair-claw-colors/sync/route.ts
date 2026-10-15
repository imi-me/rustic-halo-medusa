import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { Modules } from '@medusajs/framework/utils'
import { allowedOrigin } from '../../assistant/route'
import { ADMIN_OPERATIONS } from '../../../../modules/admin-operations'
import { readClawPalette } from '../../../../lib/hair-claw-color-store'
import { syncClawProduct } from '../../../../lib/hair-claw-color-sync'
import { isHairClaw } from '../../../../lib/product-admin'
export async function POST(req: AuthenticatedMedusaRequest<any>, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (!req.auth_context?.actor_id || req.auth_context.actor_type !== 'user') return res.sendStatus(401)
  if (!allowedOrigin(req)) return res.sendStatus(403)
  const offset = req.body?.offset ?? 0, ids = req.body?.product_ids
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000 || (ids !== undefined && (!Array.isArray(ids) || !ids.length || ids.length > 5 || ids.some((id: any) => typeof id !== 'string' || !/^prod_[A-Za-z0-9]+$/.test(id))))) return res.status(400).json({ message: 'Invalid color update batch.' })
  try {
    return res.json(await req.scope.resolve(Modules.LOCKING).execute('rh-hair-claw-colors', async () => {
      const palette = await readClawPalette(req.scope.resolve(ADMIN_OPERATIONS))
      if (palette.revision !== req.body.expected_revision) throw Error('Shared colors changed. Reload before applying variants.')
      const service = req.scope.resolve(Modules.PRODUCT)
      const [rows, count] = await service.listAndCountProducts(ids ? { id: ids } : {}, { take: 1000, select: ['id', 'title', 'metadata'], order: { id: 'ASC' } })
      if (count > 1000) throw Error('This catalog needs a larger batch review before applying shared colors.')
      const products = rows.filter(isHairClaw), batch = ids ? products : products.slice(offset, offset + 5)
      const results: any[] = []
      for (const product of batch) {
        try { results.push(await syncClawProduct(req.scope, product.id, palette.colors)) }
        catch (error) { results.push({ id: product.id, title: product.title, status: 'review', message: (error as Error).message }) }
      }
      return { results, total: products.length, next_offset: !ids && offset + 5 < products.length ? offset + 5 : null, revision: palette.revision }
    }, { timeout: 5, expire: 300 }))
  } catch (error) { return res.status(409).json({ message: (error as Error).message }) }
}
