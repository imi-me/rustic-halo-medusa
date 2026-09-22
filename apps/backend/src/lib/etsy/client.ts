import { EtsyCatalogScopes } from './oauth'
const apiBase = 'https://openapi.etsy.com/v3/application'
type EtsyFetch = typeof fetch
export function etsyHeaders(keystring: string, accessToken?: string, secret?: string) {
  const headers: Record<string, string> = { 'x-api-key': secret ? `${keystring}:${secret}` : keystring, Accept: 'application/json' }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  return headers
}
export async function exchangeEtsyCode(input: { keystring: string, secret: string, code: string, verifier: string, redirectUri: string }, fetcher: EtsyFetch = fetch) {
  if (!input.secret || !input.code || !input.verifier) throw new Error('Etsy authorization response is incomplete.')
  const body = new URLSearchParams({ grant_type: 'authorization_code', client_id: input.keystring, redirect_uri: input.redirectUri, code: input.code, code_verifier: input.verifier })
  const response = await fetcher('https://openapi.etsy.com/v3/public/oauth/token', { method: 'POST', headers: { ...etsyHeaders(input.keystring, undefined, input.secret), 'Content-Type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(20_000) })
  if (!response.ok) throw new Error(`Etsy authorization failed (HTTP ${response.status}).`)
  const result = await response.json() as { access_token?: string, refresh_token?: string, expires_in?: number }
  if (!result.access_token || !result.refresh_token || !Number.isSafeInteger(result.expires_in)) throw new Error('Etsy did not return complete authorization data.')
  const userPrefix = result.access_token.split('.', 1)[0]
  const userId = Number(userPrefix)
  if (!/^[1-9][0-9]*$/.test(userPrefix) || !Number.isSafeInteger(userId)) throw new Error('Etsy did not return an account ID.')
  return { access_token: result.access_token, refresh_token: result.refresh_token, expires_in: result.expires_in, user_id: userId }
}
export async function refreshEtsyAccessToken(input: { keystring: string, secret: string, refreshToken: string }, fetcher: EtsyFetch = fetch) {
  if (!input.secret || !input.refreshToken || input.refreshToken.length > 4096) throw new Error('Etsy refresh token is invalid.')
  const body = new URLSearchParams({ grant_type: 'refresh_token', client_id: input.keystring, refresh_token: input.refreshToken })
  const response = await fetcher('https://openapi.etsy.com/v3/public/oauth/token', { method: 'POST', headers: { ...etsyHeaders(input.keystring, undefined, input.secret), 'Content-Type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(20_000) })
  if (!response.ok) throw new Error(`Etsy refresh failed (HTTP ${response.status}).`)
  const result = await response.json() as { access_token?: string, refresh_token?: string, expires_in?: number }
  const expiresIn = result.expires_in
  if (!result.access_token || !result.refresh_token || !Number.isSafeInteger(expiresIn)) throw new Error('Etsy did not return complete refresh data.')
  return { access_token: result.access_token, refresh_token: result.refresh_token, expires_in: expiresIn as number }
}
export async function listEtsyListings(input: { keystring: string, secret: string, accessToken: string, shopId: number, offset?: number, limit?: number }, fetcher: EtsyFetch = fetch) {
  const offset = input.offset ?? 0, limit = input.limit ?? 100
  if (!Number.isInteger(input.shopId) || input.shopId < 1 || !Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Invalid Etsy listing page.')
  const endpoint = new URL(`${apiBase}/shops/${input.shopId}/listings/active`)
  endpoint.searchParams.set('limit', String(limit)); endpoint.searchParams.set('offset', String(offset))
  const response = await fetcher(endpoint, { headers: etsyHeaders(input.keystring, input.accessToken, input.secret), signal: AbortSignal.timeout(20_000) })
  if (!response.ok) throw new Error(`Etsy listings unavailable (HTTP ${response.status}).`)
  const result = await response.json() as { results?: unknown[], count?: number }
  const count = result.count
  if (!Array.isArray(result.results) || typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) throw new Error('Etsy returned an invalid listing page.')
  return { listings: result.results, total: count, nextOffset: offset + result.results.length < count ? offset + result.results.length : null, scopes: EtsyCatalogScopes }
}

export async function listEtsyShopReceipts(input: {
  keystring: string
  secret: string
  accessToken: string
  shopId: number
  minCreated: number
  maxCreated: number
  offset?: number
  limit?: number
}, fetcher: EtsyFetch = fetch) {
  const offset = input.offset ?? 0
  const limit = input.limit ?? 100
  if (!Number.isSafeInteger(input.shopId) || input.shopId < 1 ||
      !Number.isSafeInteger(input.minCreated) || input.minCreated < 946684800 ||
      !Number.isSafeInteger(input.maxCreated) || input.maxCreated < input.minCreated ||
      !Number.isSafeInteger(offset) || offset < 0 ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('Invalid Etsy receipt page.')
  }
  const endpoint = new URL(`${apiBase}/shops/${input.shopId}/receipts`)
  endpoint.searchParams.set('min_created', String(input.minCreated))
  endpoint.searchParams.set('max_created', String(input.maxCreated))
  endpoint.searchParams.set('limit', String(limit))
  endpoint.searchParams.set('offset', String(offset))
  const response = await fetcher(endpoint, {
    headers: etsyHeaders(input.keystring, input.accessToken, input.secret),
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) throw new Error(`Etsy receipts unavailable (HTTP ${response.status}).`)
  const result = await response.json() as { results?: unknown[], count?: number }
  if (!Array.isArray(result.results) || !Number.isSafeInteger(result.count) || (result.count as number) < 0) {
    throw new Error('Etsy returned an invalid receipt page.')
  }
  return {
    receipts: result.results,
    total: result.count as number,
    nextOffset: offset + result.results.length < (result.count as number) ? offset + result.results.length : null,
  }
}

export async function getEtsyListingInventories(input: { keystring: string, secret: string, accessToken: string, listingIds: number[] }, fetcher: EtsyFetch = fetch) {
  const listingIds = input.listingIds
  if (!Array.isArray(listingIds) || listingIds.length < 1 || listingIds.length > 100 || new Set(listingIds).size !== listingIds.length || listingIds.some(id => !Number.isSafeInteger(id) || id < 1)) {
    throw new Error('Invalid Etsy inventory batch.')
  }
  const endpoint = new URL(`${apiBase}/listings/batch/inventory`)
  endpoint.searchParams.set('listing_ids', listingIds.join(','))
  const response = await fetcher(endpoint, { headers: etsyHeaders(input.keystring, input.accessToken, input.secret), signal: AbortSignal.timeout(30_000) })
  if (!response.ok) throw new Error(`Etsy inventory unavailable (HTTP ${response.status}).`)
  const result = await response.json() as { results?: unknown[] }
  if (!Array.isArray(result.results)) throw new Error('Etsy returned an invalid inventory batch.')
  return result.results
}

export async function listEtsyShops(input: { keystring: string, secret: string, accessToken: string, userId: number }, fetcher: EtsyFetch = fetch) {
  if (!Number.isInteger(input.userId) || input.userId < 1) throw new Error('Invalid Etsy account.')
  const response = await fetcher(`${apiBase}/users/${input.userId}/shops`, { headers: etsyHeaders(input.keystring, input.accessToken, input.secret), signal: AbortSignal.timeout(20_000) })
  if (!response.ok) throw new Error(`Etsy shops unavailable (HTTP ${response.status}).`)
  const result = await response.json() as { shop_id?: unknown, shop_name?: unknown, results?: unknown[] } | unknown[]
  const candidates = Array.isArray(result) ? result : Array.isArray(result.results) ? result.results : [result]
  const shops = candidates.map((shop) => {
    if (!shop || typeof shop !== 'object') return null
    const value = shop as { shop_id?: unknown, shop_name?: unknown }
    return Number.isSafeInteger(value.shop_id) && (value.shop_id as number) > 0 && typeof value.shop_name === 'string'
      ? { shop_id: value.shop_id as number, shop_name: value.shop_name }
      : null
  }).filter((shop): shop is { shop_id: number, shop_name: string } => shop !== null)
  if (shops.length === 0) throw new Error('Etsy returned invalid shop data.')
  return shops
}

export async function getEtsyOwnedShopByName(input: { keystring: string, secret: string, shopName: string, userId: number }, fetcher: EtsyFetch = fetch) {
  const shopName = input.shopName.trim()
  if (!shopName) throw new Error('Invalid Etsy shop name.')
  if (!Number.isSafeInteger(input.userId) || input.userId < 1) throw new Error('Invalid Etsy account.')
  const endpoint = new URL(`${apiBase}/shops`)
  endpoint.searchParams.set('shop_name', shopName)
  const response = await fetcher(endpoint, { headers: etsyHeaders(input.keystring, undefined, input.secret), signal: AbortSignal.timeout(20_000) })
  if (!response.ok) throw new Error(`Etsy public shop lookup unavailable (HTTP ${response.status}).`)
  const result = await response.json() as { results?: unknown[] } | null
  const candidates = Array.isArray(result?.results) ? result.results : []
  const matches = candidates.filter((shop): shop is { shop_id?: unknown, shop_name: string, user_id?: unknown } => {
    if (!shop || typeof shop !== 'object') return false
    const value = shop as { shop_name?: unknown }
    return typeof value.shop_name === 'string' && value.shop_name.toLowerCase() === shopName.toLowerCase()
  })
  if (matches.length !== 1) throw new Error('Etsy shop identity needs review.')
  const shop = matches[0]
  // A public name match alone does not authorize associating an OAuth token with a shop.
  if (!Number.isSafeInteger(shop.shop_id) || (shop.shop_id as number) < 1 || shop.user_id !== input.userId) {
    throw new Error('Etsy shop identity needs review.')
  }
  return { shop_id: shop.shop_id as number, shop_name: shop.shop_name }
}
