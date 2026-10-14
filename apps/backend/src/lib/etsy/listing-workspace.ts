import { etsyHeaders, refreshEtsyAccessToken } from './client'
import { decryptEtsyToken, encryptEtsyToken } from './token-vault'
import { etsyReadConfig } from './oauth'
import { ETSY_MODULE } from '../../modules/etsy'
import { etsyDraftSchema } from '../product-admin'

export async function etsyWorkspaceAccess(scope: any) {
  const config = etsyReadConfig(),
    secret = process.env.ETSY_SHARED_SECRET?.trim()
  if (!config || !secret) throw new Error('Connect Etsy before reading or updating a listing.')
  const service = scope.resolve(ETSY_MODULE)
  // Serialize token rotation across the integration's new workspace requests.
  return scope.resolve('locking').execute('etsy-workspace-token', async () => {
    const connection = await service.getReadConnection()
    const refreshed = await refreshEtsyAccessToken({
      keystring: config.keystring,
      secret,
      refreshToken: decryptEtsyToken(connection.encrypted_refresh_token),
    })
    await service.recordRead({
      id: connection.id,
      encryptedRefreshToken: encryptEtsyToken(refreshed.refresh_token),
      accessExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
    })
    return {
      shopId: connection.shop_id,
      scopes: connection.scopes?.granted ?? [],
      headers: etsyHeaders(config.keystring, refreshed.access_token, secret),
    }
  })
}
export function listingCopy(listing: any) {
  return {
    listing_id: String(listing.listing_id),
    title: listing.title ?? '',
    description: listing.description ?? '',
    tags: listing.tags ?? [],
    materials: listing.materials ?? [],
  }
}
export async function getOwnedListing(
  access: Awaited<ReturnType<typeof etsyWorkspaceAccess>>,
  id: string,
  request: typeof fetch = fetch,
) {
  if (!/^[1-9][0-9]{0,15}$/.test(id)) throw new Error('Enter the existing Etsy listing ID.')
  const response = await request(`https://openapi.etsy.com/v3/application/listings/${id}`, {
    headers: access.headers,
    signal: AbortSignal.timeout(20000),
  })
  if (!response.ok)
    throw new Error('Etsy listing could not be read. Check the listing ID and shop connection.')
  const listing: any = await response.json()
  if (listing.shop_id !== access.shopId || String(listing.listing_id) !== id)
    throw new Error('This listing does not belong to the connected Etsy shop.')
  return listing
}
export async function updateEtsyCopy(
  access: Awaited<ReturnType<typeof etsyWorkspaceAccess>>,
  draft: ReturnType<typeof etsyDraftSchema.parse>,
  expected: any,
  request: typeof fetch = fetch,
) {
  if (process.env.ETSY_LISTING_WRITES_ENABLED !== 'true' || !access.scopes.includes('listings_w'))
    throw new Error(
      'Etsy listing updates are disabled or require reconnecting with listing-write permission. The local draft is saved.',
    )
  if (!draft.title.trim() || !draft.description.trim())
    throw new Error('Etsy title and description are required for an update.')
  const current = listingCopy(await getOwnedListing(access, draft.listing_id, request))
  if (JSON.stringify(current) !== JSON.stringify(expected))
    throw new Error('The Etsy listing changed. Review the latest copy before updating.')
  const body = new URLSearchParams({
    title: draft.title,
    description: draft.description,
    tags: draft.tags.join(','),
    materials: draft.materials.join(','),
  })
  const response = await request(
    `https://openapi.etsy.com/v3/application/shops/${access.shopId}/listings/${draft.listing_id}`,
    {
      method: 'PATCH',
      headers: { ...access.headers, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(20000),
    },
  )
  if (!response.ok)
    throw new Error('Etsy update could not be confirmed. Review the Etsy listing before retrying.')
  const saved = listingCopy(await getOwnedListing(access, draft.listing_id, request))
  const sameList = (a: string[], b: string[]) =>
    JSON.stringify([...a].sort()) === JSON.stringify([...b].sort())
  if (
    saved.title !== draft.title ||
    saved.description !== draft.description ||
    !sameList(saved.tags, draft.tags) ||
    !sameList(saved.materials, draft.materials)
  )
    throw new Error(
      'Etsy accepted the request but some fields did not read back as expected. Open Etsy and review before retrying.',
    )
  return saved
}
