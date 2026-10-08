import { guardStripeWebhook } from '../guard-stripe-webhook'
function run(path: string, method: string) {
  const res = { status: jest.fn().mockReturnThis(), end: jest.fn(), setHeader: jest.fn() }
  const next = jest.fn()
  guardStripeWebhook({ path, method } as any, res as any, next)
  return { res, next }
}
test('passes exact POST to Medusa signature verification', () => {
  expect(run('/hooks/payment/stripe_stripe', 'POST').next).toHaveBeenCalledTimes(1)
})
test.each(['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'])('rejects %s without processing payment', method => {
  const { res, next } = run('/hooks/payment/stripe_stripe', method)
  expect(res.status).toHaveBeenCalledWith(405)
  expect(next).not.toHaveBeenCalled()
})
test.each(['/hooks/payment/stripe_stripe/', '/hooks/payment/stripe_stripe/admin', '/hooks/payment/stripe_stripe_extra'])('rejects descendant/prefix %s', path => {
  const { res, next } = run(path, 'POST')
  expect(res.status).toHaveBeenCalledWith(404)
  expect(next).not.toHaveBeenCalled()
})
