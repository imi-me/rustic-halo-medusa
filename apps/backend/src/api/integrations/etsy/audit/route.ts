import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { ETSY_MODULE } from '../../../../modules/etsy'
import { getEtsyListingInventories, listEtsyListings, refreshEtsyAccessToken } from '../../../../lib/etsy/client'
import { etsyReadConfig } from '../../../../lib/etsy/oauth'
import { decryptEtsyToken, encryptEtsyToken } from '../../../../lib/etsy/token-vault'

const pageSize = 100
const maximumListings = 1_000
const inventoryBatchSize = 100

type EtsyService = {
  getReadConnection(): Promise<{ id: string, shop_id: number, encrypted_refresh_token: string }>
  recordRead(input: { id: string, encryptedRefreshToken: string, accessExpiresAt: Date }): Promise<unknown>
}

type MedusaCatalogRow = {
  id?: unknown
  title?: unknown
  status?: unknown
  variants?: unknown
}

const normalizedSku = (value: unknown) => typeof value === 'string' ? value.trim().toUpperCase() : ''

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store')
  const config = etsyReadConfig(), secret = process.env.ETSY_SHARED_SECRET?.trim()
  if (!config || !secret) return res.status(503).json({ message: 'Etsy read connection is not configured.' })
  try {
    const service = req.scope.resolve(ETSY_MODULE) as EtsyService
    const connection = await service.getReadConnection()
    const refreshed = await refreshEtsyAccessToken({ keystring: config.keystring, secret, refreshToken: decryptEtsyToken(connection.encrypted_refresh_token) })
    await service.recordRead({ id: connection.id, encryptedRefreshToken: encryptEtsyToken(refreshed.refresh_token), accessExpiresAt: new Date(Date.now() + refreshed.expires_in * 1_000) })

    let offset = 0, total = 0, listings: unknown[] = []
    do {
      const page = await listEtsyListings({ keystring: config.keystring, secret, accessToken: refreshed.access_token, shopId: connection.shop_id, offset, limit: pageSize })
      total = page.total
      listings = listings.concat(page.listings)
      offset += page.listings.length
      if (page.listings.length === 0) break
    } while (offset < total && offset < maximumListings)

    const summary = listings.map((listing) => {
      const item = listing as { listing_id?: unknown, title?: unknown, state?: unknown, quantity?: unknown, url?: unknown }
      return {
        id: typeof item.listing_id === 'number' ? item.listing_id : null,
        title: typeof item.title === 'string' ? item.title : null,
        state: typeof item.state === 'string' ? item.state : null,
        quantity: typeof item.quantity === 'number' ? item.quantity : null,
        url: typeof item.url === 'string' ? item.url : null,
      }
    })
    const listingIds = summary.map(item => item.id)
    if (listingIds.some((id): id is null => id === null)) throw new Error('Etsy returned invalid listing data.')
    const inventories: unknown[] = []
    for (let index = 0; index < listingIds.length; index += inventoryBatchSize) {
      inventories.push(...await getEtsyListingInventories({
        keystring: config.keystring,
        secret,
        accessToken: refreshed.access_token,
        listingIds: listingIds.slice(index, index + inventoryBatchSize) as number[],
      }))
    }
    const inventorySummary = inventories.map((entry) => {
      const row = entry as { listing_id?: unknown, inventory?: unknown }
      const inventory = row.inventory && typeof row.inventory === 'object'
        ? row.inventory as { products?: unknown }
        : null
      const products = Array.isArray(inventory?.products) ? inventory.products : []
      return {
        listingId: typeof row.listing_id === 'number' ? row.listing_id : null,
        inventoryAvailable: inventory !== null,
        products: products.map((product) => {
          const item = product as { product_id?: unknown, sku?: unknown, property_values?: unknown, offerings?: unknown }
          const properties = Array.isArray(item.property_values) ? item.property_values : []
          const offerings = Array.isArray(item.offerings) ? item.offerings : []
          return {
            productId: typeof item.product_id === 'number' ? item.product_id : null,
            sku: typeof item.sku === 'string' ? item.sku.trim() : '',
            properties: properties.map((property) => {
              const value = property as { property_id?: unknown, property_name?: unknown, values?: unknown }
              return {
                propertyId: typeof value.property_id === 'number' ? value.property_id : null,
                name: typeof value.property_name === 'string' ? value.property_name : null,
                values: Array.isArray(value.values) ? value.values.filter((item): item is string => typeof item === 'string') : [],
              }
            }),
            offerings: offerings.map((offering) => {
              const value = offering as { offering_id?: unknown, quantity?: unknown, is_enabled?: unknown }
              return {
                offeringId: typeof value.offering_id === 'number' ? value.offering_id : null,
                quantity: typeof value.quantity === 'number' ? value.quantity : null,
                enabled: value.is_enabled === true,
              }
            }),
          }
        }),
      }
    })
    const query = req.scope.resolve('query') as {
      graph(input: unknown): Promise<{ data: MedusaCatalogRow[] }>
    }
    const medusaProducts: Array<{
      id: string
      title: string
      status: string | null
      variants: Array<{ id: string, sku: string }>
    }> = []
    for (let skip = 0; ; skip += 100) {
      const { data } = await query.graph({
        entity: 'product',
        fields: ['id', 'title', 'status', 'variants.id', 'variants.sku'],
        pagination: { skip, take: 100, order: { id: 'ASC' } },
      })
      medusaProducts.push(...data.map((product) => ({
        id: typeof product.id === 'string' ? product.id : '',
        title: typeof product.title === 'string' ? product.title : '',
        status: typeof product.status === 'string' ? product.status : null,
        variants: (Array.isArray(product.variants) ? product.variants : []).map((variant) => {
          const value = variant as { id?: unknown, sku?: unknown }
          return {
            id: typeof value.id === 'string' ? value.id : '',
            sku: typeof value.sku === 'string' ? value.sku.trim() : '',
          }
        }),
      })))
      if (data.length < 100) break
      if (skip >= 10_000) throw new Error('Medusa catalog exceeds the comparison limit.')
    }
    const etsyProducts = inventorySummary.flatMap((inventory) => inventory.products
      .filter(product => product.offerings.some(offering => offering.enabled))
      .map((product) => ({
      listingId: inventory.listingId,
      listingTitle: summary.find(listing => listing.id === inventory.listingId)?.title ?? null,
      productId: product.productId,
      sku: product.sku,
      properties: product.properties,
      availableQuantity: product.offerings.filter(offering => offering.enabled).reduce((total, offering) => total + (offering.quantity ?? 0), 0),
    })))
    const medusaVariants = medusaProducts.flatMap((product) => product.variants.map((variant) => ({
      productId: product.id,
      productTitle: product.title,
      productStatus: product.status,
      variantId: variant.id,
      sku: variant.sku,
    })))
    const etsyBySku = new Map<string, typeof etsyProducts>()
    for (const product of etsyProducts) {
      const key = normalizedSku(product.sku)
      if (key) etsyBySku.set(key, [...(etsyBySku.get(key) ?? []), product])
    }
    const medusaBySku = new Map<string, typeof medusaVariants>()
    for (const variant of medusaVariants) {
      const key = normalizedSku(variant.sku)
      if (key) medusaBySku.set(key, [...(medusaBySku.get(key) ?? []), variant])
    }
    const matches: Array<{ etsy: typeof etsyProducts[number], medusa: typeof medusaVariants[number] }> = []
    const unresolved: Array<{ reason: string, etsy: typeof etsyProducts[number] }> = []
    for (const product of etsyProducts) {
      const key = normalizedSku(product.sku)
      if (!key) {
        unresolved.push({ reason: 'etsy_sku_missing', etsy: product })
        continue
      }
      if ((etsyBySku.get(key) ?? []).length !== 1) {
        unresolved.push({ reason: 'etsy_sku_duplicate', etsy: product })
        continue
      }
      const candidates = medusaBySku.get(key) ?? []
      if (candidates.length === 0) unresolved.push({ reason: 'medusa_sku_not_found', etsy: product })
      else if (candidates.length > 1) unresolved.push({ reason: 'medusa_sku_ambiguous', etsy: product })
      else matches.push({ etsy: product, medusa: candidates[0] })
    }
    const medusaOnly = medusaVariants.filter(variant => {
      const key = normalizedSku(variant.sku)
      return key && !etsyBySku.has(key)
    })
    const medusaWithoutSku = medusaVariants.filter(variant => !normalizedSku(variant.sku))
    return res.json({
      shopId: connection.shop_id,
      totalActiveListings: total,
      fetchedListings: summary.length,
      fetchedInventories: inventorySummary.length,
      truncated: total > maximumListings,
      listings: summary,
      inventories: inventorySummary,
      comparison: {
        readOnly: true,
        matchBasis: 'case-insensitive exact SKU',
        counts: {
          etsyProducts: etsyProducts.length,
          etsyProductsWithSku: etsyProducts.filter(product => normalizedSku(product.sku)).length,
          medusaProducts: medusaProducts.length,
          medusaVariants: medusaVariants.length,
          matched: matches.length,
          unresolved: unresolved.length,
          medusaOnlyVariants: medusaOnly.length,
          medusaVariantsWithoutSku: medusaWithoutSku.length,
        },
        matches,
        unresolved,
        medusaOnly,
        medusaWithoutSku,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const reason = /^Etsy (?:refresh|listings unavailable|inventory unavailable) \(HTTP \d{3}\)\.$/.test(message) ? message : 'Etsy audit could not be completed.'
    console.error(`Etsy audit failed: ${reason}`)
    return res.status(502).json({ message: reason })
  }
}
