import { validateProductionPayment } from '../validate-production-payment'
import { productionCommerce } from '../production-commerce'
import { validateCartTax } from '../tax/validate-cart'
jest.mock('../production-commerce', () => ({ productionCommerce: jest.fn() }))
jest.mock('../tax/validate-cart', () => ({ validateCartTax: jest.fn() }))
const original = { ...process.env }
afterAll(() => {
  for (const key of ['APP_ENV', 'PRODUCTION_ACCEPTANCE_ONLY', 'PRODUCTION_ACCEPTANCE_CART_ID', 'PRODUCTION_ACCEPTANCE_EMAIL']) {
    if (original[key] === undefined) delete process.env[key]
    else process.env[key] = original[key]
  }
})
beforeEach(() => {
  jest.clearAllMocks()
  process.env.APP_ENV = 'production'
  process.env.PRODUCTION_ACCEPTANCE_ONLY = 'false'
  delete process.env.PRODUCTION_ACCEPTANCE_CART_ID
  delete process.env.PRODUCTION_ACCEPTANCE_EMAIL
  ;(productionCommerce as jest.Mock).mockReturnValue({ payment: true })
  ;(validateCartTax as jest.Mock).mockResolvedValue(undefined)
})
function request(patch = {}) {
  const collection = { amount: 12, currency_code: 'usd', cart: {
    id: 'cart_example', total: 12, currency_code: 'usd', sales_channel_id: 'sc_owner',
    email: 'owner@example.invalid',
    completed_at: null, shipping_methods: [{ id: 'sm_example' }],
  }, ...patch }
  const graph = jest.fn().mockResolvedValue({ data: [collection] })
  const req = { params: { id: 'paycol_example' }, publishable_key_context: { sales_channel_ids: ['sc_owner'] },
    scope: { resolve: () => ({ graph }) } }
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() }
  const next = jest.fn()
  return { req, res, next, graph, collection }
}
test('validates tax before allowing a matching live payment session', async () => {
  const { req, res, next } = request()
  await validateProductionPayment(req as any, res as any, next)
  expect(validateCartTax).toHaveBeenCalledWith(req.scope, 'cart_example', ['sc_owner'])
  expect(next).toHaveBeenCalledTimes(1)
  expect(res.status).not.toHaveBeenCalled()
})
test.each([{ amount: 11 }, { amount: NaN }, { cart: null }, { currency_code: 'eur' }])('blocks invalid collection %p', async patch => {
  const { req, res, next } = request(patch)
  await validateProductionPayment(req as any, res as any, next)
  expect(res.status).toHaveBeenCalledWith(409)
  expect(next).not.toHaveBeenCalled()
})
test.each([{ sales_channel_id: 'sc_other' }, { completed_at: new Date() }, { shipping_methods: [] }])('blocks unavailable cart %p', async patch => {
  const { req, res, next, collection } = request()
  Object.assign(collection.cart, patch)
  await validateProductionPayment(req as any, res as any, next)
  expect(res.status).toHaveBeenCalledWith(409)
  expect(next).not.toHaveBeenCalled()
})
test('disabled checkout cannot create a payment session', async () => {
  ;(productionCommerce as jest.Mock).mockReturnValue({ payment: false })
  const { req, res, next, graph } = request()
  await validateProductionPayment(req as any, res as any, next)
  expect(res.status).toHaveBeenCalledWith(409)
  expect(graph).not.toHaveBeenCalled()
  expect(next).not.toHaveBeenCalled()
})
test('tax verification failure blocks payment', async () => {
  ;(validateCartTax as jest.Mock).mockRejectedValue(Error('Tax outage'))
  const { req, res, next } = request()
  await validateProductionPayment(req as any, res as any, next)
  expect(res.status).toHaveBeenCalledWith(409)
  expect(next).not.toHaveBeenCalled()
})
test('sandbox keeps its existing behavior', async () => {
  process.env.APP_ENV = 'staging'
  const { req, res, next, graph } = request()
  await validateProductionPayment(req as any, res as any, next)
  expect(next).toHaveBeenCalledTimes(1)
  expect(graph).not.toHaveBeenCalled()
})
test.each([undefined, '', 'cart_other', 'invalid'])('private acceptance rejects unapproved cart %p before tax calls', async id => {
  delete process.env.PRODUCTION_ACCEPTANCE_ONLY
  if (id) process.env.PRODUCTION_ACCEPTANCE_CART_ID = id
  const { req, res, next } = request()
  await validateProductionPayment(req as any, res as any, next)
  expect(res.status).toHaveBeenCalledWith(409)
  expect(validateCartTax).not.toHaveBeenCalled()
  expect(next).not.toHaveBeenCalled()
})
test.each([25, 25.01])('private acceptance enforces $25 ceiling at total %p', async total => {
  process.env.PRODUCTION_ACCEPTANCE_ONLY = 'true'
  process.env.PRODUCTION_ACCEPTANCE_CART_ID = 'cart_example'
  process.env.PRODUCTION_ACCEPTANCE_EMAIL = 'owner@example.invalid'
  const { req, res, next, collection } = request({ amount: total })
  collection.cart!.total = total
  await validateProductionPayment(req as any, res as any, next)
  if (total <= 25) expect(next).toHaveBeenCalledTimes(1)
  else {
    expect(res.status).toHaveBeenCalledWith(409)
    expect(validateCartTax).not.toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()
  }
})
test.each([undefined, 'other@example.invalid'])('private acceptance rejects unapproved email %p', async email => {
  process.env.PRODUCTION_ACCEPTANCE_ONLY = 'true'
  process.env.PRODUCTION_ACCEPTANCE_CART_ID = 'cart_example'
  if (email) process.env.PRODUCTION_ACCEPTANCE_EMAIL = email
  const { req, res, next } = request()
  await validateProductionPayment(req as any, res as any, next)
  expect(res.status).toHaveBeenCalledWith(409)
  expect(validateCartTax).not.toHaveBeenCalled()
  expect(next).not.toHaveBeenCalled()
})
