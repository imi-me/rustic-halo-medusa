import { productionCommerce } from '../production-commerce'
const base = { APP_ENV: 'production', DATABASE_URL: 'postgres://u:p@postgres-aw4sntlbsbfsukqtfvccduqm:5432/rustic_halo_production' }
const shipping = { ...base, SHIPPO_LIVE_QUOTES_ENABLED: 'true', SHIPPO_API_KEY: 'shippo_live_fake',
  SHIPPO_FROM_NAME: 'Shop', SHIPPO_FROM_STREET1: 'Street', SHIPPO_FROM_CITY: 'City',
  SHIPPO_FROM_STATE: 'NC', SHIPPO_FROM_ZIP: '27837', SHIPPO_FROM_COUNTRY: 'US' }
test('default preview needs no live credentials', () => {
  expect(productionCommerce({})).toEqual({ payment: false, shipping: false, tax: false })
})
test.each([
  { APP_ENV: 'staging' }, { DATABASE_URL: 'postgres://u:p@postgres/rustic_halo_staging' },
  { STRIPE_TEST_ENABLED: 'true' }, { SHIPPO_API_KEY: 'shippo_test_fake' }, { SHIPPO_FROM_CITY: '' },
])('rejects live quotes across environment/credential boundaries %p', patch => {
  expect(() => productionCommerce({ ...shipping, ...patch })).toThrow()
})
test('live quotes do not enable payment', () => {
  expect(productionCommerce(shipping)).toEqual({ shipping: true, payment: false, tax: false })
})
test('live payment requires acceptance and configured shipping/tax', () => {
  const env = { ...shipping, STRIPE_LIVE_ENABLED: 'true', STRIPE_API_KEY: 'sk_live_fake', STRIPE_WEBHOOK_SECRET: 'whsec_fake' }
  expect(() => productionCommerce(env)).toThrow('verified')
  expect(() => productionCommerce({ ...env, PRODUCTION_CHECKOUT_READY: 'true' })).toThrow('verified')
  const ready = { ...env, PRODUCTION_CHECKOUT_READY: 'true', STRIPE_TAX_LIVE_ENABLED: 'true', STRIPE_TAX_REPORTING_LIVE_ENABLED: 'true', TAX_COLLECTION_STATE: 'NC' }
  expect(productionCommerce(ready).payment).toBe(true)
  expect(() => productionCommerce({ ...ready, STRIPE_API_KEY: 'sk_test_fake' })).toThrow()
  expect(() => productionCommerce({ ...ready, TAX_COLLECTION_STATE: 'VA' })).toThrow()
})
