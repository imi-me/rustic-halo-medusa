import assert from 'node:assert/strict'
import ResendNotificationService from '../modules/resend/service'
import handler from '../subscribers/order-confirmation'
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'

// Uses only synthetic data and a fake HTTP transport. Never sends email.
async function check() {
  const savedEnv = { ...process.env }
  const savedFetch = globalThis.fetch
  let calls = 0
  let lastBody: any
  let lastHeaders: any
  let status = 200
  globalThis.fetch = (async (_url, options) => {
    calls++
    lastBody = JSON.parse(String(options?.body))
    lastHeaders = options?.headers
    return new Response(JSON.stringify(status === 200 ? { id: 'email_fake' } : { message: 'failure' }), { status })
  }) as typeof fetch
  try {
    process.env.EMAIL_LOGO_URL = ''
    process.env.EMAIL_DELIVERY_ENABLED = 'false'
    process.env.RESEND_API_KEY = 're_fake_for_offline_test'
    const service = new ResendNotificationService()
    await assert.rejects(() => service.send({ to: 'test@example.com', channel: 'email', template: 'order-confirmation' }), /disabled/)
    await handler({ event: { data: { id: 'order_test' } }, container: { resolve: () => { throw new Error('Disabled handler accessed services') } } } as any)
    assert.equal(calls, 0)
    process.env.EMAIL_DELIVERY_ENABLED = 'true'
    const notificationCalls: any[] = []
    const order = {
      id: 'order_test', display_id: 7, email: 'test@example.com', currency_code: 'usd', customer_id: 'cus_test',
      subtotal: 24, shipping_subtotal: 6, tax_total: 1.8, discount_total: 3, total: 28.8,
      items: [{ title: 'Hair Claw', variant_title: '4-inch', quantity: 2, subtotal: 24 }],
      shipping_address: { first_name: '<Shawn>', last_name: 'Test', address_1: '123 Example St', city: 'Example', province: 'nc', postal_code: '27837', country_code: 'us' },
      shipping_methods: [{ name: 'USPS Ground Advantage' }],
    }
    const container = { resolve: (name: string) => {
      if (name === ContainerRegistrationKeys.QUERY) return { graph: async () => ({ data: [order] }) }
      if (name === Modules.NOTIFICATION) return { createNotifications: async (data: any) => { notificationCalls.push(data); return service.send(data) } }
      throw new Error('Unexpected service')
    } }
    await handler({ event: { data: { id: order.id } }, container } as any)
    assert.equal(calls, 1)
    assert.equal(notificationCalls[0].idempotency_key, 'order-confirmation/order_test')
    assert.equal(lastHeaders['Idempotency-Key'], notificationCalls[0].idempotency_key)
    assert.equal(lastBody.to[0], 'test@example.com')
    assert(lastBody.html.includes('&lt;Shawn&gt;'))
    assert(lastBody.text.includes('Total: $28.80') && lastBody.text.includes('Discount: -$3.00'))
    assert(lastBody.text.includes('3–5 business days'))
    assert(lastBody.html.includes('src="cid:rustic-halo-logo"'))
    assert(lastBody.html.includes('Makers of laser cut, engraved, and handpainted products.'))
    assert.equal(lastBody.attachments[0].content_id, 'rustic-halo-logo')
    assert.equal(lastBody.attachments[0].content_type, 'image/png')
    assert.equal(Buffer.from(lastBody.attachments[0].content, 'base64').subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
    status = 429
    await assert.rejects(() => service.send(notificationCalls[0]), /HTTP 429/)
    console.log('Passed: disabled delivery, order mapping, totals, escaping, idempotency keys, and API error handling. No email sent.')
  } finally {
    globalThis.fetch = savedFetch
    process.env = savedEnv
  }
}
check().catch(() => { console.error('Offline email integration check failed.'); process.exitCode = 1 })
