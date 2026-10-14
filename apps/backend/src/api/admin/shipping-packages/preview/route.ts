import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { Modules } from '@medusajs/framework/utils'
import { z } from 'zod'
import { ADMIN_OPERATIONS } from '../../../../modules/admin-operations'
import { allowedOrigin } from '../../assistant/route'
import { readPackageConfig } from '../../../../lib/shipping-package-store'
import { planShipping } from '../../../../lib/shipping-plan'
const schema = z.object({ items: z.array(z.object({ sku: z.string().trim().min(1).max(100), quantity: z.number().int().min(1).max(100) }).strict()).min(1).max(100) }).strict()
export async function POST(req: AuthenticatedMedusaRequest<any>, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (!req.auth_context?.actor_id || req.auth_context.actor_type !== 'user') return res.sendStatus(401)
  if (!allowedOrigin(req)) return res.sendStatus(403)
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Enter saved SKUs and whole quantities from 1 to 100.' })
  try {
    const products = req.scope.resolve(Modules.PRODUCT), config = await readPackageConfig(req.scope.resolve(ADMIN_OPERATIONS))
    const items: { variant_id: string; quantity: number }[] = []
    for (const item of parsed.data.items) {
      const matches = await products.listProductVariants({ sku: item.sku }, { take: 2 })
      if (matches.length !== 1) throw new Error('Each SKU must identify one saved variant. Check missing or duplicate SKUs.')
      items.push({ variant_id: matches[0].id, quantity: item.quantity })
    }
    return res.json({ parcels: await planShipping(items, config, products), revision: config.revision })
  } catch (error) { return res.status(400).json({ message: (error as Error).message }) }
}
