import { guardStripeWebhook } from '../guard-stripe-webhook'
async function run(path: string, method: string, valid = true) {
  const res = { status: jest.fn().mockReturnThis(), end: jest.fn(), setHeader: jest.fn() }
  const next = jest.fn()
  const verify = jest.fn().mockImplementation(async () => { if (!valid) throw Error('Invalid signature'); return { action: 'not_supported' } })
  const body = { id: 'evt_probe' }, rawBody = Buffer.from('{}'), headers = { 'stripe-signature': 'probe' }
  await guardStripeWebhook({ path: '/', originalUrl: path, method, body, rawBody, headers, scope: { resolve: () => ({ getWebhookActionAndData: verify }) } } as any, res as any, next)
  return { res, next, verify, body, rawBody, headers }
}
test('verifies exact POST before allowing queue processing', async () => {
  const result = await run('/hooks/payment/stripe_stripe', 'POST')
  expect(result.next).toHaveBeenCalledTimes(1)
  expect(result.verify).toHaveBeenCalledWith({ provider: 'stripe_stripe', payload: { data: result.body, rawData: result.rawBody, headers: result.headers } })
})
test('rejects invalid signature before queue processing', async () => {
  const { res, next } = await run('/hooks/payment/stripe_stripe', 'POST', false)
  expect(res.status).toHaveBeenCalledWith(400)
  expect(next).not.toHaveBeenCalled()
})
test.each(['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'])('rejects %s without processing payment', async method => {
  const { res, next, verify } = await run('/hooks/payment/stripe_stripe', method)
  expect(res.status).toHaveBeenCalledWith(405)
  expect(next).not.toHaveBeenCalled()
  expect(verify).not.toHaveBeenCalled()
})
test.each(['/hooks/payment/stripe_stripe/', '/hooks/payment/stripe_stripe/admin', '/hooks/payment/stripe_stripe_extra'])('rejects descendant/prefix %s', async path => {
  const { res, next, verify } = await run(path, 'POST')
  expect(res.status).toHaveBeenCalledWith(404)
  expect(next).not.toHaveBeenCalled()
  expect(verify).not.toHaveBeenCalled()
})
test('accepts query strings using the original mounted URL', async () => {
  expect((await run('/hooks/payment/stripe_stripe?probe=1', 'POST')).next).toHaveBeenCalledTimes(1)
})
