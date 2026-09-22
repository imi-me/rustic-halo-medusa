const copperMill = 'gid://shopify/Location/79837790404'

function requireSnapshot(snapshot, source, now) {
  if (!snapshot || snapshot.schemaVersion !== 1 || snapshot.source !== source || snapshot.complete !== true ||
      snapshot.sourceLocationId !== copperMill || typeof snapshot.locationId !== 'string' || !snapshot.locationId ||
      !Array.isArray(snapshot.items)) {
    throw new Error(`${source}: incomplete or incorrectly scoped identity snapshot`)
  }
  const captured = Date.parse(snapshot.capturedAt)
  if (!Number.isFinite(captured) || captured > now || now - captured > 15 * 60 * 1000) {
    throw new Error(`${source}: identity snapshot must be captured within the last 15 minutes`)
  }
}

function canonicalShopifyVariantId(value) {
  if (typeof value !== 'string' || !value.trim()) return null
  const text = value.trim()
  if (/^gid:\/\/shopify\/ProductVariant\/[1-9][0-9]*$/.test(text)) return text
  if (/^[1-9][0-9]*$/.test(text)) return `gid://shopify/ProductVariant/${text}`
  return null
}

function indexByVariant(snapshot, source, fields) {
  const result = new Map()
  for (const item of snapshot.items) {
    if (!item || typeof item.id !== 'string' || !item.id.trim()) throw new Error(`${source}: missing item ID`)
    for (const field of fields) if (typeof item[field] !== 'string' || !item[field].trim()) {
      throw new Error(`${source}: missing ${field}`)
    }
    const variantId = canonicalShopifyVariantId(item.shopifyVariantId)
    if (!variantId) throw new Error(`${source}: invalid Shopify variant ID`)
    if (result.has(variantId)) throw new Error(`${source}: duplicate Shopify variant ID`)
    result.set(variantId, item)
  }
  return result
}

// Offline-only proposal builder. It never reads a network, persists data, or creates mappings.
export function buildIdentityMapping(medusa, market, now = Date.now()) {
  requireSnapshot(medusa, 'medusa', now)
  requireSnapshot(market, 'marketsuite', now)
  if (typeof market.accountId !== 'string' || !market.accountId.trim()) throw new Error('marketsuite: missing account ID')

  const medusaByVariant = indexByVariant(medusa, 'medusa', ['shopifyVariantId'])
  const marketByVariant = indexByVariant(market, 'marketsuite', ['shopifyVariantId', 'asStockId'])
  const variants = [...new Set([...medusaByVariant.keys(), ...marketByVariant.keys()])].sort()
  const items = [], review = []
  const usedMedusa = new Set(), usedMarket = new Set(), usedAs = new Set()

  for (const shopifyVariantId of variants) {
    const medusaItem = medusaByVariant.get(shopifyVariantId)
    const marketItem = marketByVariant.get(shopifyVariantId)
    if (!medusaItem || !marketItem) {
      review.push({ shopifyVariantId, status: !medusaItem ? 'missing-medusa' : 'missing-marketsuite' })
      continue
    }
    if (usedMedusa.has(medusaItem.id) || usedMarket.has(marketItem.id) || usedAs.has(marketItem.asStockId)) {
      throw new Error('Identity collision in proposed mapping')
    }
    usedMedusa.add(medusaItem.id); usedMarket.add(marketItem.id); usedAs.add(marketItem.asStockId)
    items.push({ medusaItemId: medusaItem.id, marketItemId: marketItem.id, asStockId: marketItem.asStockId,
      shopifyVariantId })
  }

  return {
    readOnly: true,
    requiresReview: true,
    cutoverApproved: false,
    mapping: { schemaVersion: 1, accountId: market.accountId, medusaLocationId: medusa.locationId,
      marketLocationId: market.locationId, items },
    review,
  }
}
