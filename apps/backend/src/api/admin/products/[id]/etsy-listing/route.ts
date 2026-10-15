import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { Modules } from '@medusajs/framework/utils'
import { readClawPalette } from '../../../../../lib/hair-claw-color-store'
import { ADMIN_OPERATIONS } from '../../../../../modules/admin-operations'
import { allowedOrigin } from '../../../assistant/route'
import { etsyDraftSchema, colorExport, ETSY_DRAFT_KEY } from '../../../../../lib/product-admin'
import { reviewColorImages, shareColorImages } from '../../../../../lib/etsy/color-images'
import { reviewColorSharing, applyColorSharing } from '../../../../../lib/etsy/color-sharing'
import { etsyWorkspaceAccess, getOwnedListing, listingCopy, updateEtsyCopy } from '../../../../../lib/etsy/listing-workspace'
export async function POST(req: AuthenticatedMedusaRequest<any>, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (!req.auth_context?.actor_id || req.auth_context.actor_type !== 'user') return res.sendStatus(401)
  if (!allowedOrigin(req)) return res.sendStatus(403)
  const parsed = etsyDraftSchema.safeParse(req.body?.draft)
  if (!parsed.success || !['preview', 'update-copy', 'export', 'review-colors', 'share-colors', 'review-images', 'share-images'].includes(req.body?.action)) return res.status(400).json({ message: 'Check Etsy fields: up to 13 unique tags, 20 characters each, and valid selected variants.' })
  try {
    const result = await req.scope.resolve(Modules.LOCKING).execute(`etsy-product:${req.params.id}`, async () => {
      const product = await req.scope.resolve(Modules.PRODUCT).retrieveProduct(req.params.id, { relations: ['type', 'variants', 'variants.options', 'variants.options.option', 'images', 'options'] })
      const saved = etsyDraftSchema.parse(product.metadata?.[ETSY_DRAFT_KEY] ?? {})
      if (JSON.stringify(saved) !== JSON.stringify(parsed.data)) throw new Error('Save the current Etsy draft with the product before sharing it.')
      if (['export', 'review-colors', 'share-colors', 'review-images', 'share-images'].includes(req.body.action)) {
        const query = req.scope.resolve('query')
        const { data } = await query.graph({ entity: 'product', filters: { id: req.params.id }, fields: ['id', 'handle', 'metadata', 'type.*', 'options.*', 'images.*', 'variants.*', 'variants.options.*', 'variants.options.option.*', 'variants.price_set.prices.*', 'variants.price_set.prices.price_rules.*'] })
        const palette = await readClawPalette(req.scope.resolve(ADMIN_OPERATIONS))
        const selection = colorExport({ ...data[0], metadata: { ...data[0].metadata, hair_claw_palette_v1: palette } }, saved)
        if (req.body.action === 'export') return { export: selection }
        const access = await etsyWorkspaceAccess(req.scope)
        return req.scope.resolve(Modules.LOCKING).execute(`etsy-listing:${saved.listing_id}`, async (): Promise<any> => req.body.action === 'review-colors' ? reviewColorSharing(access, selection, saved.existing_finish) : req.body.action === 'review-images' ? reviewColorImages(access, selection) : req.body.action === 'share-images' ? shareColorImages(req.scope, access, selection, req.body.expected_links) : applyColorSharing(req.scope, access, selection, saved.existing_finish, req.body.expected_inventory), { timeout: 5, expire: 300 })
      }
      const access = await etsyWorkspaceAccess(req.scope)
      if (req.body.action === 'preview') return { current: listingCopy(await getOwnedListing(access, saved.listing_id)), writesEnabled: process.env.ETSY_LISTING_WRITES_ENABLED === 'true' && access.scopes.includes('listings_w') }
      return req.scope.resolve(Modules.LOCKING).execute(`etsy-listing:${saved.listing_id}`, async () => ({ listing: await updateEtsyCopy(access, saved, req.body.expected) }))
    })
    return res.json(result)
  } catch (error) { return res.status(409).json({ message: (error as Error).message || 'Etsy request could not be confirmed; check Etsy before retrying.' }) }
}
