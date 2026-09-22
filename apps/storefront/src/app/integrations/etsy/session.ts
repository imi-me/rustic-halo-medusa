import { createHmac, timingSafeEqual } from 'node:crypto'

type EtsySession = { state: string, verifier: string, expiresAt: number }

function secret() {
  const value = process.env.ETSY_OAUTH_COOKIE_SECRET
  if (!value || value.length < 32) throw new Error('Etsy connection is not configured.')
  return value
}
function signature(value: string) { return createHmac('sha256', secret()).update(value).digest('base64url') }

export function encodeEtsySession(session: EtsySession) {
  const value = Buffer.from(JSON.stringify(session)).toString('base64url')
  return `${value}.${signature(value)}`
}
export function decodeEtsySession(value: string | undefined): EtsySession | null {
  if (!value) return null
  const [payload, supplied, ...extra] = value.split('.')
  if (!payload || !supplied || extra.length) return null
  try {
    const expected = signature(payload)
    if (expected.length !== supplied.length || !timingSafeEqual(new Uint8Array(Buffer.from(expected)), new Uint8Array(Buffer.from(supplied)))) return null
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as EtsySession
    if (typeof parsed.state !== 'string' || typeof parsed.verifier !== 'string' || !Number.isSafeInteger(parsed.expiresAt)) return null
    return parsed
  } catch { return null }
}
