import { assignmentSchema, SHIPPING_KEY } from '../../../../../lib/shipping-packages'
import { readPackageConfig } from '../../../../../lib/shipping-package-store'
import { validateAssignments } from '../../../../../lib/shipping-assignment'
import { ADMIN_OPERATIONS } from '../../../../../modules/admin-operations'
import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { cleanDescription, richDescription } from '../../../../../lib/product-description'
import { Modules } from '@medusajs/framework/utils'
import { AdminUpdateProduct } from '@medusajs/medusa/api/admin/products/validators'
import { updateProductsWorkflow } from '@medusajs/medusa/core-flows'
import { allowedOrigin } from '../../../assistant/route'
import { allocateBarcodes, pendingBarcodes } from '../../../../../lib/admin-product-create'
import { ETSY_DRAFT_KEY, etsyDraftSchema } from '../../../../../lib/product-admin'
export async function POST(req: AuthenticatedMedusaRequest<any>, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (!req.auth_context?.actor_id || req.auth_context.actor_type !== 'user') return res.sendStatus(401)
  if (!allowedOrigin(req)) return res.sendStatus(403)
  const parsed = AdminUpdateProduct().safeParse(req.body?.update)
  if (!parsed.success || typeof req.body?.expected_updated_at !== 'string') return res.status(400).json({ message: 'Invalid product update. Reload the current product.' })
  try {
    await req.scope.resolve(Modules.LOCKING).execute('rh-admin-product-identifiers', async () => {
      const products = req.scope.resolve(Modules.PRODUCT)
      const product = await products.retrieveProduct(req.params.id, { relations: ['variants'] })
      if (new Date(product.updated_at!).toISOString() !== new Date(req.body.expected_updated_at).toISOString()) throw new Error('Product changed. Your draft is kept; reload current fields before saving.')
      const update: any = parsed.data
      if (typeof update.description === "string" && update.description !== product.description && richDescription(update.description)) update.description = cleanDescription(update.description)
      if (update.variants && JSON.stringify(update.variants.map((variant: any) => variant.id).sort()) !== JSON.stringify((product.variants ?? []).map(row => row.id).sort())) throw new Error('Variant membership changed. Reload the product.')
      const changed = (update.variants ?? []).filter(row => row.barcode)
      if (changed.length) await allocateBarcodes(products, changed.map(row => ({ id: row.id, barcode: row.barcode! })), await pendingBarcodes(req.scope))
      if (update.metadata) update.metadata = { ...product.metadata,
        ...(Object.prototype.hasOwnProperty.call(update.metadata, ETSY_DRAFT_KEY) ? { [ETSY_DRAFT_KEY]: etsyDraftSchema.parse(update.metadata[ETSY_DRAFT_KEY]) } : {}),
        ...(Object.prototype.hasOwnProperty.call(update.metadata, SHIPPING_KEY) ? { [SHIPPING_KEY]: assignmentSchema.parse(update.metadata[SHIPPING_KEY]) } : {}),
      }
      for (const patch of update.variants ?? []) if (patch.metadata) {
        const original = product.variants?.find(row => row.id === patch.id)
        patch.metadata = { ...original?.metadata, [SHIPPING_KEY]: assignmentSchema.parse(patch.metadata[SHIPPING_KEY] ?? original?.metadata?.[SHIPPING_KEY] ?? {}) }
      }
      if (update.metadata?.[SHIPPING_KEY] || update.weight !== undefined || (update.variants ?? []).some(row => row.metadata || row.weight !== undefined)) {
        const variants = (product.variants ?? []).map(row => ({ ...row, ...(update.variants ?? []).find(patch => patch.id === row.id) }))
        validateAssignments(await readPackageConfig(req.scope.resolve(ADMIN_OPERATIONS)), { ...product, ...update }, variants, product)
      }
      await updateProductsWorkflow(req.scope).run({ input: { selector: { id: req.params.id }, update } })
    })
    return res.json({ id: req.params.id })
  } catch (error) { return res.status(409).json({ message: (error as Error).message }) }
}
