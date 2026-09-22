import { createHmac } from 'node:crypto'
import { parseEtsyWebhook, verifyEtsyWebhookSignature } from '../webhook'

const now = 1_800_000_000
const secretBytes = Buffer.from('test signing secret')
const secret = `whsec_${secretBytes.toString('base64')}`
const body = Buffer.from(JSON.stringify({
  event_type: 'order.paid',
  resource_url: 'https://api.etsy.com/v3/application/shops/37840344/receipts/12345',
  shop_id: 37840344,
}))
const signature = (id = 'msg_1', timestamp = String(now), raw = body) =>
  createHmac('sha256', secretBytes).update(Buffer.concat([Buffer.from(`${id}.${timestamp}.`), raw])).digest('base64')

test('verifies the raw body and parses a shop-bound receipt event', () => {
  expect(verifyEtsyWebhookSignature({ webhookId: 'msg_1', timestamp: String(now), signature: `v1,${signature()}`, rawBody: body, secret, nowSeconds: now })).toBe(true)
  expect(parseEtsyWebhook(body)).toEqual({
    eventType: 'order.paid', shopId: 37840344, receiptId: 12345,
    resourceUrl: 'https://api.etsy.com/v3/application/shops/37840344/receipts/12345',
  })
})

test('rejects stale, changed, or incorrectly signed deliveries', () => {
  expect(verifyEtsyWebhookSignature({ webhookId: 'msg_1', timestamp: String(now - 301), signature: `v1,${signature('msg_1', String(now - 301))}`, rawBody: body, secret, nowSeconds: now })).toBe(false)
  expect(verifyEtsyWebhookSignature({ webhookId: 'msg_1', timestamp: String(now), signature: `v1,${signature()}`, rawBody: Buffer.from('{}'), secret, nowSeconds: now })).toBe(false)
  expect(verifyEtsyWebhookSignature({ webhookId: 'msg_1', timestamp: String(now), signature: 'v1,AAAA', rawBody: body, secret, nowSeconds: now })).toBe(false)
})

test.each([
  { event_type: 'listing.updated', resource_url: 'https://api.etsy.com/v3/application/shops/37840344/receipts/12345', shop_id: 37840344 },
  { event_type: 'order.paid', resource_url: 'http://api.etsy.com/v3/application/shops/37840344/receipts/12345', shop_id: 37840344 },
  { event_type: 'order.paid', resource_url: 'https://example.com/v3/application/shops/37840344/receipts/12345', shop_id: 37840344 },
  { event_type: 'order.paid', resource_url: 'https://api.etsy.com/v3/application/shops/999/receipts/12345', shop_id: 37840344 },
  { event_type: 'order.paid', resource_url: 'https://api.etsy.com/v3/application/shops/37840344/receipts/12345?extra=1', shop_id: 37840344 },
])('rejects unsupported or unbound payload %#', value => {
  expect(() => parseEtsyWebhook(Buffer.from(JSON.stringify(value)))).toThrow()
})
