import { createHash, timingSafeEqual } from 'node:crypto'
import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'

const sourceLocationId = 'gid://shopify/Location/79837790404'
const pageSize = 100

function canonicalShopifyVariantId(value: unknown) {
  if (typeof value !== 'string') return null
  return /^gid:\/\/shopify\/ProductVariant\/[1-9][0-9]*$/.test(value) ? value : null
}

// Dedicated read-only identity export. Disabled until explicitly configured.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store')
  const key = process.env.MARKETSUITE_INVENTORY_READ_KEY
  const locationId = process.env.MARKETSUITE_COPPER_MILL_LOCATION_ID
  if (process.env.MARKETSUITE_INVENTORY_READ_ENABLED !== 'true' || !key || key.length < 32 || !locationId) {
    return res.status(503).json({ message: 'Inventory connection unavailable.' })
  }
  const header = req.headers.authorization
  const supplied = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : ''
  const digest = (value: string) => createHash('sha256').update(value).digest()
  if (supplied.length > 512 || !timingSafeEqual(digest(supplied), digest(key))) {
    return res.status(401).json({ message: 'Unauthorized.' })
  }
  const offset = req.query.offset ?? '0'
  if (Object.keys(req.query).some(k => k !== 'offset') || typeof offset !== 'string' ||
      !/^(0|[1-9][0-9]{0,6})$/.test(offset)) {
    return res.status(400).json({ message: 'Invalid inventory page.' })
  }
  try {
    const locations = req.scope.resolve(Modules.STOCK_LOCATION)
    const inventory = req.scope.resolve(Modules.INVENTORY)
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const [location] = await locations.listStockLocations({ id: locationId })
    if (location?.metadata?.shopify_location_id !== sourceLocationId) {
      return res.status(409).json({ message: 'Copper Mill location is not mapped.' })
    }

    const identityByInventoryItem = new Map<string, string>()
    for (let skip = 0; ; skip += pageSize) {
      const { data } = await query.graph({
        entity: 'product',
        fields: ['id', 'variants.id', 'variants.metadata', 'variants.inventory_items.inventory_item_id'],
        pagination: { skip, take: pageSize, order: { id: 'ASC' } },
      })
      for (const product of data) for (const variant of product.variants ?? []) {
        const variantId = canonicalShopifyVariantId(variant.metadata?.shopify_variant_id)
        if (!variantId) continue
        if (!Array.isArray(variant.inventory_items) || variant.inventory_items.length !== 1 ||
            typeof variant.inventory_items[0]?.inventory_item_id !== 'string') throw new Error('Invalid inventory identity')
        const inventoryItemId = variant.inventory_items[0].inventory_item_id
        if (identityByInventoryItem.has(inventoryItemId)) throw new Error('Shared inventory identity')
        identityByInventoryItem.set(inventoryItemId, variantId)
      }
      if (data.length < pageSize) break
      if (skip >= 10000) throw new Error('Catalog limit exceeded')
    }

    const levels = await inventory.listInventoryLevels({ location_id: locationId },
      { skip: Number(offset), take: pageSize + 1 })
    const hasMore = levels.length > pageSize
    const items = levels.slice(0, pageSize).map(level => {
      const id = level.inventory_item_id
      const shopifyVariantId = identityByInventoryItem.get(id)
      if (!shopifyVariantId) throw new Error('Unmapped Copper Mill inventory item')
      return { id, shopifyVariantId }
    })
    return res.json({ schemaVersion: 1, source: 'medusa', sourceLocationId, locationId,
      capturedAt: new Date().toISOString(), consistency: 'paginated-non-atomic',
      complete: Number(offset) === 0 && !hasMore, items,
      nextOffset: hasMore ? Number(offset) + pageSize : null })
  } catch {
    return res.status(503).json({ message: 'Inventory connection unavailable.' })
  }
}
