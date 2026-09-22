const fs = require('node:fs/promises')
const { ETSY_MODULE } = require('../modules/etsy')
const { getEtsyListingInventories, refreshEtsyAccessToken, etsyHeaders } = require('../lib/etsy/client')
const { etsyReadConfig } = require('../lib/etsy/oauth')
const { decryptEtsyToken, encryptEtsyToken } = require('../lib/etsy/token-vault')
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

async function getVariationImages(endpoint, headers) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(endpoint, { headers, signal: AbortSignal.timeout(20000) })
    if (response.ok) return response.json()
    if (response.status !== 429) throw Error(`Variation images unavailable (HTTP ${response.status})`)
    await wait(1000 * (attempt + 1))
  }
  throw Error('Variation images unavailable after rate-limit retries')
}

exports.default = async function ({ container }) {
  const config = etsyReadConfig(), secret = process.env.ETSY_SHARED_SECRET?.trim()
  if (!config || !secret) throw Error('Etsy connection is not configured')
  const plan = JSON.parse(await fs.readFile('/tmp/hair-claw-color-plan.json', 'utf8'))
  const listingIds = plan.listings.filter(l => l.status === 'planned').map(l => l.listingId)
  if (listingIds.length !== 19 || new Set(listingIds).size !== listingIds.length) throw Error('Unexpected listing plan')
  const service = container.resolve(ETSY_MODULE)
  const connection = await service.getReadConnection()
  const refreshed = await refreshEtsyAccessToken({ keystring: config.keystring, secret, refreshToken: decryptEtsyToken(connection.encrypted_refresh_token) })
  await service.recordRead({ id: connection.id, encryptedRefreshToken: encryptEtsyToken(refreshed.refresh_token), accessExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000) })
  const rows = await getEtsyListingInventories({ keystring: config.keystring, secret, accessToken: refreshed.access_token, listingIds })
  const byId = new Map(rows.map(row => [row.listing_id, row]))
  const listings = []
  for (const listingId of listingIds) {
    const row = byId.get(listingId)
    if (!row?.inventory?.products) throw Error(`Inventory missing for ${listingId}`)
    const endpoint = `https://openapi.etsy.com/v3/application/shops/${connection.shop_id}/listings/${listingId}/variation-images`
    const variationImages = await getVariationImages(endpoint, etsyHeaders(config.keystring, refreshed.access_token, secret))
    listings.push({ listingId, inventory: row.inventory, variationImages })
    await fs.writeFile('/tmp/etsy-hair-claw-inventory-preflight.partial.json', JSON.stringify({ checkedAt: new Date().toISOString(), shopId: connection.shop_id, listings }, null, 2), { mode: 0o600 })
    await wait(750)
  }
  await fs.writeFile('/tmp/etsy-hair-claw-inventory-preflight.json', JSON.stringify({ checkedAt: new Date().toISOString(), shopId: connection.shop_id, listings }, null, 2), { mode: 0o600 })
  console.log(`ETSY_HAIR_CLAW_PREFLIGHT_READY ${listings.length}`)
}
