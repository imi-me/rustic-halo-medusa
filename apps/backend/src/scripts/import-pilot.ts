import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules, ProductStatus } from "@medusajs/framework/utils"
import { createProductsWorkflow, createStockLocationsWorkflow, createInventoryLevelsWorkflow, linkSalesChannelsToStockLocationWorkflow } from "@medusajs/medusa/core-flows"
import snapshot from "./data/rustic-halo-pilot.json"

// One-time local snapshot; reruns preserve existing stock, prices, and edits.
export default async function importPilot({ container }: ExecArgs) {
  const url = new URL(process.env.DATABASE_URL || "")
  if (url.hostname !== "127.0.0.1" || url.port !== "55432" || url.pathname !== "/rustic_halo_local" || url.username !== "rustic_halo_local") throw new Error("Pilot import requires the isolated local database")
  const products = container.resolve(Modules.PRODUCT)
  const inventory = container.resolve(Modules.INVENTORY)
  const locations = container.resolve(Modules.STOCK_LOCATION)
  const sales = container.resolve(Modules.SALES_CHANNEL)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const [channel] = await sales.listSalesChannels({ name: "Local Development" })
  if (!channel) throw new Error("Run local setup first")
  const locationMap = new Map<string, string>()
  for (const item of snapshot.products.flatMap(p => p.inventory)) {
    if (locationMap.has(item.locationId)) continue
    const name = `${item.locationName} — Local Snapshot`
    let [location] = await locations.listStockLocations({ name })
    if (!location) {
      const { result } = await createStockLocationsWorkflow(container).run({ input: { locations: [{ name, metadata: { shopify_location_id: item.locationId } }] } })
      location = result[0]
    }
    locationMap.set(item.locationId, location.id)
    if (item.locationId === "gid://shopify/Location/68049862852") await linkSalesChannelsToStockLocationWorkflow(container).run({ input: { id: location.id, add: [channel.id] } })
  }
  for (const source of snapshot.products) {
    if (source.currencyCode !== "USD" || source.variants.length !== source.totalVariants) throw new Error("Incomplete or unsupported product snapshot")
    const groups: Record<string, { handle: string; title: string }> = {
      "Hair Claw": { handle: "hair-accessories-claws-and-clips", title: "Hair claws & clips" },
      "Dangle Earrings": { handle: "earrings", title: "Earrings" },
      "Round Wood Sign": { handle: "novelty-signs", title: "Signs for your space" },
    }
    const group = groups[source.productType]
    if (!group) throw new Error(`Unmapped product type: ${source.productType}`)
    const { handle } = group
    let [collection] = await products.listProductCollections({ handle })
    if (!collection) collection = await products.createProductCollections({ handle, title: group.title })
    let [product] = await products.listProducts({ handle: source.handle })
    if (product && product.metadata?.shopify_id !== source.id) throw new Error(`Handle collision: ${source.handle}`)
    if (!product) {
      const option = source.variants.length > 1 ? "Size" : "Style"
      const images = source.images.filter(i => !(source.handle === "floral-cross-dangle-earrings" && i.url.includes("highland-cow")))
      const { result } = await createProductsWorkflow(container).run({ input: { products: [{
        title: source.title, handle: source.handle, status: ProductStatus.PUBLISHED,
        description: source.descriptionHtml.replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, "").trim(),
        collection_id: collection.id, thumbnail: source.featuredImageUrl,
        images: images.map(i => ({ url: i.url })),
        metadata: { shopify_id: source.id, source_url: `https://rustichalo.com/products/${source.handle}`, imported_at: source.capturedAt || snapshot.capturedAt, inventory_mode: "local_snapshot_not_synced" },
        options: [{ title: option, values: source.variants.map(v => v.title === "Default Title" ? "Original" : v.title) }],
        variants: source.variants.map(v => ({ title: v.title === "Default Title" ? "Original" : v.title, sku: v.sku, manage_inventory: true, allow_backorder: true,
          options: { [option]: v.title === "Default Title" ? "Original" : v.title }, prices: [{ currency_code: "usd", amount: Number(v.price) }], metadata: { shopify_variant_id: v.id } })),
        sales_channels: [{ id: channel.id }],
      }] } })
      product = result[0]
    }
    for (const variant of source.variants) {
      if (!variant.sku) throw new Error("SKU required for pilot inventory mapping")
      const [item] = await inventory.listInventoryItems({ sku: variant.sku })
      if (!item) throw new Error(`Missing inventory item for ${variant.sku}`)
      for (const stock of source.inventory.filter(i => i.sku === variant.sku)) {
        const location_id = locationMap.get(stock.locationId)!
        const existing = await inventory.listInventoryLevels({ inventory_item_id: item.id, location_id })
        if (!existing.length) await createInventoryLevelsWorkflow(container).run({ input: { inventory_levels: [{ inventory_item_id: item.id, location_id, stocked_quantity: stock.available }] } })
      }
    }
    logger.info(`Pilot ready: ${source.handle}`)
  }
  logger.info("Pilot snapshot imported. Existing records preserved; Shopify was not changed.")
}
