import { createHash, timingSafeEqual } from 'node:crypto'
import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { Modules } from '@medusajs/framework/utils'

const sourceLocationId = 'gid://shopify/Location/79837790404'
const pageSize = 100

// Dedicated read-only credential. Disabled until explicitly configured.
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
  // No caller-supplied location or account; this endpoint serves one configured location.
  const offset = req.query.offset ?? '0'
  if (Object.keys(req.query).some(k => k !== 'offset') || typeof offset !== 'string' ||
      !/^(0|[1-9][0-9]{0,6})$/.test(offset)) {
    return res.status(400).json({ message: 'Invalid inventory page.' })
  }
  try {
    const locations = req.scope.resolve(Modules.STOCK_LOCATION)
    const [location] = await locations.listStockLocations({ id: locationId })
    if (location?.metadata?.shopify_location_id !== sourceLocationId) {
      return res.status(409).json({ message: 'Copper Mill location is not mapped.' })
    }
    const inventory = req.scope.resolve(Modules.INVENTORY)
    let levels: Awaited<ReturnType<typeof inventory.listInventoryLevels>>
    try {
      levels = await inventory.listInventoryLevels({ location_id: locationId },
        { skip: Number(offset), take: pageSize + 1 })
    } catch {
      return res.status(503).json({ message: 'Copper Mill inventory is unavailable.' })
    }
    const hasMore = levels.length > pageSize
    const items: Array<{ id: string; stocked: number; reserved: number; available: number }> = []
    for (const level of levels.slice(0, pageSize)) {
      const stocked = Number(level.stocked_quantity), reserved = Number(level.reserved_quantity)
      if (!Number.isSafeInteger(stocked) || !Number.isSafeInteger(reserved) || reserved < 0 ||
          !Number.isSafeInteger(stocked - reserved)) {
        return res.status(422).json({ message: 'Copper Mill inventory needs quantity review.' })
      }
      items.push({ id: level.inventory_item_id, stocked, reserved, available: stocked - reserved })
    }
    return res.json({ schemaVersion: 1, source: 'medusa', sourceLocationId, locationId,
      capturedAt: new Date().toISOString(), consistency: 'paginated-non-atomic',
      complete: Number(offset) === 0 && !hasMore, items,
      nextOffset: hasMore ? Number(offset) + pageSize : null })
  } catch {
    // Do not expose service errors, secrets or unrelated record details.
    return res.status(503).json({ message: 'Inventory connection unavailable.' })
  }
}
