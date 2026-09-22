import { createHmac, timingSafeEqual } from 'node:crypto'

export const EtsyWebhookEvents = ['order.paid', 'order.canceled', 'order.shipped', 'order.delivered'] as const
export type EtsyWebhookEvent = typeof EtsyWebhookEvents[number]
export type EtsyWebhookEnvelope = {
  eventType: EtsyWebhookEvent
  shopId: number
  receiptId: number
  resourceUrl: string
}

function positiveInteger(value: unknown, name: string) {
  const number = typeof value === 'number' ? value : NaN
  if (!Number.isSafeInteger(number) || number <= 0) throw new Error(`Invalid Etsy webhook ${name}.`)
  return number
}

export function parseEtsyWebhook(rawBody: Buffer): EtsyWebhookEnvelope {
  let body: unknown
  try { body = JSON.parse(rawBody.toString('utf8')) } catch { throw new Error('Invalid Etsy webhook body.') }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid Etsy webhook body.')
  const input = body as Record<string, unknown>
  if (typeof input.event_type !== 'string' || !EtsyWebhookEvents.includes(input.event_type as EtsyWebhookEvent)) {
    throw new Error('Unsupported Etsy webhook event.')
  }
  const shopId = positiveInteger(input.shop_id, 'shop ID')
  if (typeof input.resource_url !== 'string') throw new Error('Invalid Etsy webhook resource URL.')
  let url: URL
  try { url = new URL(input.resource_url) } catch { throw new Error('Invalid Etsy webhook resource URL.') }
  if (url.protocol !== 'https:' || !['api.etsy.com', 'openapi.etsy.com'].includes(url.hostname) ||
      url.username || url.password || url.search || url.hash) {
    throw new Error('Invalid Etsy webhook resource URL.')
  }
  const match = url.pathname.match(/^\/v3\/application\/shops\/(\d+)\/receipts\/(\d+)$/)
  if (!match || Number(match[1]) !== shopId) throw new Error('Invalid Etsy webhook resource URL.')
  const receiptId = positiveInteger(Number(match[2]), 'receipt ID')
  return { eventType: input.event_type as EtsyWebhookEvent, shopId, receiptId, resourceUrl: url.toString() }
}

function signatureCandidates(header: string) {
  return header.split(/\s+/).map(value => value.trim()).filter(Boolean).map(value => {
    if (value.startsWith('v1,')) return value.slice(3)
    if (value.startsWith('v1=')) return value.slice(3)
    return value
  })
}

function decodeSecret(secret: string) {
  if (!secret.startsWith('whsec_') || secret.length <= 6) throw new Error('Etsy webhook signing secret is invalid.')
  const encoded = secret.slice(6)
  if (!/^[A-Za-z0-9+/_=-]+$/.test(encoded)) throw new Error('Etsy webhook signing secret is invalid.')
  const decoded = Buffer.from(encoded, encoded.includes('-') || encoded.includes('_') ? 'base64url' : 'base64')
  if (!decoded.length) throw new Error('Etsy webhook signing secret is invalid.')
  return decoded
}

export function verifyEtsyWebhookSignature(input: {
  webhookId: string
  timestamp: string
  signature: string
  rawBody: Buffer
  secret: string
  nowSeconds?: number
  toleranceSeconds?: number
}) {
  if (!input.webhookId || !/^[\x21-\x7e]{1,255}$/.test(input.webhookId)) return false
  if (!/^\d+$/.test(input.timestamp)) return false
  const timestamp = Number(input.timestamp)
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000)
  const tolerance = input.toleranceSeconds ?? 300
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > tolerance) return false
  const content = Buffer.concat([
    Buffer.from(`${input.webhookId}.${input.timestamp}.`, 'utf8'), input.rawBody,
  ])
  const expected = createHmac('sha256', decodeSecret(input.secret)).update(content).digest()
  return signatureCandidates(input.signature).some(candidate => {
    let supplied: Buffer
    try { supplied = Buffer.from(candidate, 'base64') } catch { return false }
    return supplied.length === expected.length && timingSafeEqual(supplied, expected)
  })
}
