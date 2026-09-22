import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

const authorizeEndpoint = 'https://www.etsy.com/oauth/connect'
// Catalog writes are only used by explicit owner-run maintenance tools. There is
// no scheduled listing or inventory synchronization.
export const EtsyCatalogScopes = ['listings_r', 'listings_w', 'shops_r'] as const
export const EtsyOrderReadScope = 'transactions_r' as const

export type EtsyAuthorization = { url: string, state: string, verifier: string, expiresAt: number }

export function etsyReadConfig(env = process.env) {
  const keystring = env.ETSY_API_KEY?.trim()
  const callbackUrl = env.ETSY_OAUTH_CALLBACK_URL?.trim()
  if (env.ETSY_READ_ENABLED !== 'true' || !keystring || !callbackUrl) return null
  let callback: URL
  try { callback = new URL(callbackUrl) } catch { return null }
  if (callback.protocol !== 'https:' || callback.username || callback.password || callback.hash) return null
  const scopes = env.ETSY_ORDER_REPORT_ENABLED === 'true'
    ? [...EtsyCatalogScopes, EtsyOrderReadScope]
    : [...EtsyCatalogScopes]
  return { keystring, callbackUrl: callback.toString(), scopes }
}

function base64url(value: Buffer) { return value.toString('base64url') }
function sha256(value: string) { return createHash('sha256').update(value).digest() }

export function createEtsyAuthorization(config: NonNullable<ReturnType<typeof etsyReadConfig>>, now = Date.now()): EtsyAuthorization {
  const verifier = base64url(randomBytes(48)), state = base64url(randomBytes(32)), challenge = base64url(sha256(verifier))
  const url = new URL(authorizeEndpoint)
  url.searchParams.set('response_type', 'code'); url.searchParams.set('redirect_uri', config.callbackUrl)
  url.searchParams.set('scope', config.scopes.join(' ')); url.searchParams.set('client_id', config.keystring)
  url.searchParams.set('state', state); url.searchParams.set('code_challenge', challenge); url.searchParams.set('code_challenge_method', 'S256')
  return { url: url.toString(), state, verifier, expiresAt: now + 10 * 60_000 }
}

export function validState(expected: string, supplied: string | undefined, expiresAt: number, now = Date.now()) {
  if (!supplied || now > expiresAt || expected.length !== supplied.length) return false
  return timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))
}
