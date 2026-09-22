const fs = require('node:fs/promises')
const { ETSY_MODULE } = require('../modules/etsy')
const { getEtsyListingInventories, refreshEtsyAccessToken, etsyHeaders } = require('../lib/etsy/client')
const { etsyReadConfig } = require('../lib/etsy/oauth')
const { decryptEtsyToken, encryptEtsyToken } = require('../lib/etsy/token-vault')

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const sortNumber = values => [...new Set(values)].sort((a, b) => a - b)
const addVariationProperty = (values, propertyId) => values?.length ? sortNumber([...values, propertyId]) : []
const cleanProperties = values => values.map(value => ({ property_id: value.property_id, property_name: value.property_name, scale_id: value.scale_id ?? null, value_ids: value.value_ids || [], values: value.values }))
const comparableProperties = values => cleanProperties(values).map(({ value_ids: _valueIds, ...value }) => value)
const money = price => ({ amount: Number(price.amount), divisor: Number(price.divisor), currency_code: price.currency_code })
const offeringShape = offering => ({ quantity: Number(offering.quantity), is_enabled: offering.is_enabled === true, price: money(offering.price), readiness_state_id: Number(offering.readiness_state_id) })
const inventoryShape = inventory => ({
  products: inventory.products.map(product => ({ sku: product.sku, property_values: comparableProperties(product.property_values), offerings: product.offerings.map(offeringShape) })).sort((a, b) => a.sku.localeCompare(b.sku)),
  price_on_property: sortNumber(inventory.price_on_property || []),
  quantity_on_property: sortNumber(inventory.quantity_on_property || []),
  sku_on_property: sortNumber(inventory.sku_on_property || []),
  readiness_state_on_property: sortNumber(inventory.readiness_state_on_property || []),
})
const imageShape = data => (data.results || []).map(row => ({ property_id: row.property_id, value_id: row.value_id, value: row.value, image_id: row.image_id })).sort((a, b) => a.property_id - b.property_id || a.value_id - b.value_id)
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)

async function etsyRequest(url, options) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(url, { ...options, signal: AbortSignal.timeout(30000) })
    if (response.status === 429) { await wait(1000 * (attempt + 1)); continue }
    return response
  }
  throw Error('Etsy rate limit did not clear')
}

function desiredInventory(source, listingPlan, colors) {
  const baseBySku = new Map(listingPlan.baseProducts.map(row => [row.baseSku, row]))
  if (source.products.length !== baseBySku.size) throw Error(`Product count changed for ${listingPlan.listingId}`)
  const products = []
  for (const product of source.products) {
    const base = baseBySku.get(product.sku)
    if (!base || product.offerings.length !== 1 || product.property_values.some(value => value.property_id === listingPlan.colorPropertyId)) throw Error(`Inventory changed for ${listingPlan.listingId}`)
    for (const child of base.children) {
      products.push({
        sku: child.sku,
        property_values: [...cleanProperties(product.property_values), { property_id: listingPlan.colorPropertyId, property_name: 'Color', scale_id: null, value_ids: [], values: [child.color] }],
        offerings: product.offerings.map(offeringShape),
      })
    }
  }
  return {
    products: products.sort((a, b) => a.sku.localeCompare(b.sku)),
    price_on_property: addVariationProperty(source.price_on_property, listingPlan.colorPropertyId),
    quantity_on_property: addVariationProperty(source.quantity_on_property, listingPlan.colorPropertyId),
    sku_on_property: sortNumber([...(source.sku_on_property || []), listingPlan.colorPropertyId]),
    readiness_state_on_property: addVariationProperty(source.readiness_state_on_property, listingPlan.colorPropertyId),
  }
}

function updatePayload(desired) {
  return {
    products: desired.products.map(product => ({
      sku: product.sku,
      property_values: product.property_values.map(value => ({
        property_id: value.property_id, property_name: value.property_name, scale_id: value.scale_id,
        ...(value.value_ids.length ? { value_ids: value.value_ids } : {}), values: value.values,
      })),
      offerings: product.offerings.map(offering => ({
        quantity: offering.quantity, is_enabled: offering.is_enabled,
        price: offering.price.amount / offering.price.divisor, readiness_state_id: offering.readiness_state_id,
      })),
    })),
    price_on_property: desired.price_on_property,
    quantity_on_property: desired.quantity_on_property,
    sku_on_property: desired.sku_on_property,
    readiness_state_on_property: desired.readiness_state_on_property,
  }
}

exports.default = async function ({ container }) {
  if (process.env.APP_ENV !== 'staging') throw Error('Staging only')
  const config = etsyReadConfig(), secret = process.env.ETSY_SHARED_SECRET?.trim()
  if (!config || !secret || !config.scopes.includes('listings_w')) throw Error('Etsy catalog scope is not configured')
  const plan = JSON.parse(await fs.readFile('/tmp/hair-claw-color-plan.json', 'utf8'))
  const preflight = JSON.parse(await fs.readFile('/tmp/etsy-hair-claw-inventory-preflight.json', 'utf8'))
  const listings = plan.listings.filter(row => row.status === 'planned')
  const colors = plan.colors.map(row => row.name)
  if (listings.length !== 19 || colors.length !== 12 || preflight.listings.length !== 19) throw Error('Unexpected Etsy hair-claw plan')
  const service = container.resolve(ETSY_MODULE)
  const connection = await service.getReadConnection()
  const granted = connection.scopes?.granted
  if (!Array.isArray(granted) || !granted.includes('listings_w')) throw Error('Etsy listing-write authorization is not granted')
  const refreshed = await refreshEtsyAccessToken({ keystring: config.keystring, secret, refreshToken: decryptEtsyToken(connection.encrypted_refresh_token) })
  await service.recordRead({ id: connection.id, encryptedRefreshToken: encryptEtsyToken(refreshed.refresh_token), accessExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000) })
  const headers = { ...etsyHeaders(config.keystring, refreshed.access_token, secret), 'Content-Type': 'application/json' }
  const listingIds = listings.map(row => row.listingId)
  const liveRows = await getEtsyListingInventories({ keystring: config.keystring, secret, accessToken: refreshed.access_token, listingIds })
  const liveById = new Map(liveRows.map(row => [row.listing_id, row.inventory]))
  const preflightById = new Map(preflight.listings.map(row => [row.listingId, row]))
  const report = { startedAt: new Date().toISOString(), complete: false, inventorySynchronizationEnabled: false, listings: [] }
  const save = () => fs.writeFile('/tmp/etsy-hair-claw-colors.json', JSON.stringify(report, null, 2), { mode: 0o600 })
  await save()
  for (const listing of listings) {
    const source = preflightById.get(listing.listingId)
    const live = liveById.get(listing.listingId)
    if (!source?.inventory || !live) throw Error(`Missing inventory for ${listing.listingId}`)
    const desired = desiredInventory(source.inventory, listing, colors)
    const currentShape = inventoryShape(live)
    let status = 'already_complete'
    const desiredShape = inventoryShape(desired)
    if (!equal(currentShape, desiredShape)) {
      if (!equal(currentShape, inventoryShape(source.inventory))) throw Error(`Inventory drift for ${listing.listingId}`)
      const endpoint = `https://openapi.etsy.com/v3/application/listings/${listing.listingId}/inventory?legacy=false`
      const response = await etsyRequest(endpoint, { method: 'PUT', headers, body: JSON.stringify(updatePayload(desired)) })
      if (!response.ok) throw Error(`Etsy inventory update failed for ${listing.listingId} (HTTP ${response.status}): ${await response.text()}`)
      const updated = await response.json()
      if (!equal(inventoryShape(updated), desiredShape)) throw Error(`Etsy response verification failed for ${listing.listingId}`)
      status = 'updated'
    }
    const expectedImages = imageShape(source.variationImages)
    if (expectedImages.length) {
      const imageUrl = `https://openapi.etsy.com/v3/application/shops/${connection.shop_id}/listings/${listing.listingId}/variation-images`
      let response = await etsyRequest(imageUrl, { headers })
      if (!response.ok) throw Error(`Variation image verification failed for ${listing.listingId} (HTTP ${response.status})`)
      let currentImages = imageShape(await response.json())
      if (!equal(currentImages, expectedImages)) {
        response = await etsyRequest(imageUrl, { method: 'POST', headers, body: JSON.stringify({ variation_images: expectedImages.map(({ property_id, value_id, image_id }) => ({ property_id, value_id, image_id })) }) })
        if (!response.ok) throw Error(`Variation image restore failed for ${listing.listingId} (HTTP ${response.status})`)
        currentImages = imageShape(await response.json())
        if (!equal(currentImages, expectedImages)) throw Error(`Variation image restore verification failed for ${listing.listingId}`)
      }
    }
    report.listings.push({ listingId: listing.listingId, status, productCount: desired.products.length, pricesChanged: false, quantitiesChanged: false, variationImagesPreserved: expectedImages.length })
    await save(); await wait(750)
  }
  const verifyRows = await getEtsyListingInventories({ keystring: config.keystring, secret, accessToken: refreshed.access_token, listingIds })
  const verifyById = new Map(verifyRows.map(row => [row.listing_id, row.inventory]))
  for (const listing of listings) {
    const desired = desiredInventory(preflightById.get(listing.listingId).inventory, listing, colors)
    if (!equal(inventoryShape(verifyById.get(listing.listingId)), inventoryShape(desired))) throw Error(`Final Etsy verification failed for ${listing.listingId}`)
  }
  const total = report.listings.reduce((sum, row) => sum + row.productCount, 0)
  if (report.listings.length !== 19 || total !== 372) throw Error('Final Etsy product count changed')
  report.complete = true; report.completedAt = new Date().toISOString(); report.totalColorProducts = total; await save()
  console.log(`ETSY_HAIR_CLAW_COLORS_READY ${report.listings.length} ${total}`)
}
