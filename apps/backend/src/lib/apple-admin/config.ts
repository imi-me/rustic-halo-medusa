import { createHash, createPrivateKey, randomBytes } from 'node:crypto'

export const APPLE_STAFF_PROVIDER = 'apple-staff'
export const APPLE_ISSUER = 'https://appleid.apple.com'
export const BROWSER_COOKIE = '__Host-rh-apple-browser'
export const GRANT_COOKIE = '__Host-rh-apple-grant'
export const PROFILE_PATH = '/app/settings/profile'
export const secureCookie = { secure: true, httpOnly: true, sameSite: 'lax' as const, path: '/' }
export type AppleAdminConfig = { origin: string; callback: string; clientId: string; teamId: string; keyId: string; privateKey: string; redisUrl: string; namespace: string }
export const digest = (value: string) => createHash('sha256').update(value).digest('hex')
export const randomSecret = () => randomBytes(32).toString('base64url')
export function opaque(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(value)) throw new Error('Invalid Apple transaction')
  return value
}
export function appleAdminConfig(env: NodeJS.ProcessEnv = process.env): AppleAdminConfig | undefined {
  if (env.APPLE_ADMIN_ENABLED !== 'true') return undefined
  if (env.APP_ENV !== 'staging' || env.LOCAL_HTTP_ADMIN === 'true') throw new Error('Apple Admin requires HTTPS staging')
  const origin = env.APPLE_ADMIN_ORIGIN
  if (origin !== 'https://staging.rustichalo.com') throw new Error('Apple Admin origin is not approved')
  const clientId = env.APPLE_ADMIN_CLIENT_ID
  const teamId = env.APPLE_ADMIN_TEAM_ID
  const keyId = env.APPLE_ADMIN_KEY_ID
  const privateKey = env.APPLE_ADMIN_PRIVATE_KEY_PEM?.replace(/\\n/g, '\n')
  if (clientId !== 'com.rustichalo.admin.staging.web' || teamId !== '5JHR3HD6LD' || keyId !== '67K2UNT76B' || !privateKey || !env.REDIS_URL) throw new Error('Dedicated Apple Admin configuration is incomplete')
  const key = createPrivateKey(privateKey)
  if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') throw new Error('Apple Admin requires its ES256 signing key')
  return { origin, callback: origin + '/staff-apple/callback', clientId, teamId, keyId, privateKey, redisUrl: env.REDIS_URL,
    namespace: 'rh:apple-staff:' + digest('staging|' + origin + '|' + clientId) + ':' }
}
export function requireAppleAdmin() {
  const config = appleAdminConfig()
  if (!config) throw new Error('Apple sign-in is unavailable')
  return config
}
export function requireOrigin(headers: Record<string, unknown>, config: AppleAdminConfig) {
  if (headers.origin !== config.origin) throw new Error('Unapproved Apple sign-in origin')
}
export function cookieValue(headers: Record<string, unknown>, name: string): string {
  const cookie = typeof headers.cookie === 'string' ? headers.cookie : ''
  const values = cookie.split(';').map(v => v.trim()).filter(v => v.startsWith(name + '='))
  if (values.length !== 1) throw new Error('Missing Apple browser binding')
  return opaque(values[0].slice(name.length + 1))
}
