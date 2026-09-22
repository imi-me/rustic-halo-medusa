import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { writeFile } from "node:fs/promises"

// Read-only database access. Run with Medusa exec; output is a new local file.
export default async function exportMarketInventory({ container }: ExecArgs) {
  const output = process.env.MARKET_INVENTORY_EXPORT
  if (!output) throw new Error("Set MARKET_INVENTORY_EXPORT to a new output file")
  const capturedAt = new Date().toISOString()
  const locations = container.resolve(Modules.STOCK_LOCATION)
  const inventory = container.resolve(Modules.INVENTORY)
  const sourceLocationId = "gid://shopify/Location/79837790404"
  const matches: { id: string; name: string }[] = []
  for (let skip = 0; ; skip += 100) {
    const page = await locations.listStockLocations({}, { skip, take: 100, order: { id: "ASC" } })
    for (const location of page) {
      if (location.metadata?.shopify_location_id === sourceLocationId) matches.push(location)
    }
    if (page.length < 100) break
  }
  if (matches.length !== 1) throw new Error(`Expected one mapped Copper Mill location, found ${matches.length}`)
  const location = matches[0]
  const items: Record<string, unknown>[] = []
  const seen = new Set<string>()
  for (let skip = 0; ; skip += 100) {
    const page = await inventory.listInventoryLevels(
      { location_id: location.id }, { skip, take: 100, order: { id: "ASC" } }
    )
    for (const level of page) {
      if (seen.has(level.inventory_item_id)) throw new Error("Duplicate inventory level in export")
      seen.add(level.inventory_item_id)
      const [item] = await inventory.listInventoryItems({ id: level.inventory_item_id })
      if (!item) throw new Error("Inventory item disappeared during export; retry snapshot")
      const stocked = Number(level.stocked_quantity)
      const reserved = Number(level.reserved_quantity)
      if (!Number.isSafeInteger(stocked) || !Number.isSafeInteger(reserved)) throw new Error("Invalid inventory quantity")
      items.push({ id: item.id, sku: item.sku ?? null, stocked, reserved, available: stocked - reserved })
    }
    if (page.length < 100) break
  }
  await writeFile(output, JSON.stringify({
    schemaVersion: 1, source: "medusa", sourceLocationId, locationId: location.id,
    capturedAt, completedAt: new Date().toISOString(), complete: true,
    consistency: "paginated-non-atomic", items,
  }, null, 2) + "\n", { flag: "wx", mode: 0o600 })
}
