import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { MedusaError, Modules } from '@medusajs/framework/utils'
import { IProductModuleService, IFileModuleService } from '@medusajs/framework/types'
import { HAIR_CLAW_KEY, saveSchema, templates } from '../../../../../lib/hair-claw-settings'
import { randomUUID } from 'node:crypto'

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const products: IProductModuleService = req.scope.resolve(Modules.PRODUCT)
  const product = await products.retrieveProduct(req.params.id, { relations: ['images'] })
  res.setHeader('Cache-Control', 'no-store')
  res.json({ settings: product.metadata?.[HAIR_CLAW_KEY] || { revision: null, recipes: {} }, templates,
    images: (product.images || []).map(image => ({id:image.id, url:image.url})),
    preview_origin: process.env.HAIR_CLAW_PREVIEW_ORIGIN || process.env.STORE_CORS?.split(',')[0] || null })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = saveSchema.safeParse(req.body)
  if (!parsed.success) throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Invalid overlay settings.')
  const { size, recipe, revision } = parsed.data
  if (size === '2' && recipe?.enabled) throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Save the 2-inch overlay as a draft until its physical template is approved.')
  const products: IProductModuleService = req.scope.resolve(Modules.PRODUCT)
  const files: IFileModuleService = req.scope.resolve(Modules.FILE)
  const file = recipe?.file_id ? await files.retrieveFile(recipe.file_id) : null
  // Serialize our media saves and reject stale editors. Other product metadata is preserved.
  const locking = req.scope.resolve(Modules.LOCKING)
  await locking.execute(`hair-claw-media:${req.params.id}`, async () => {
    const product = await products.retrieveProduct(req.params.id, { relations: ['images'] })
    const previous = product.metadata?.[HAIR_CLAW_KEY] as { revision?: string; recipes?: Record<string, unknown>; drafts?: Record<string, unknown> } | undefined
    if ((previous?.revision || null) !== revision) throw new MedusaError(MedusaError.Types.CONFLICT, 'Overlay settings changed in another editor. Reload before saving.')
    const recipes = { ...previous?.recipes }
    const drafts = { ...previous?.drafts }
    const source = recipe?.image_id ? product.images?.find(image => image.id === recipe.image_id) : file
    if (recipe && !source) throw new MedusaError(MedusaError.Types.INVALID_DATA, 'That photo no longer belongs to this product. Reload and choose another.')
    if (source) {
      try {
        const url = new URL(source.url)
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw Error('url')
      } catch { throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Choose a saved HTTP image.') }
    }
    if (recipe && source) {
      const fitted = { ...recipe, url: source.url, template: `${size}-inch-v1` }
      if (recipe.enabled) { recipes[size] = fitted; delete drafts[size] }
      else drafts[size] = fitted
    } else { delete recipes[size]; delete drafts[size] }
    const settings = { revision: randomUUID(), recipes, drafts }
    await products.updateProducts(req.params.id, { metadata: { ...product.metadata, [HAIR_CLAW_KEY]: settings } })
    res.json({ settings })
  })
}
