import { compareProductionCartTax, type TaxCart } from '../cart-calculation'
import Service from '../../../modules/stripe-tax-live/service'
const original = process.env
const originalFetch = global.fetch
const address = { country_code: 'us', province_code: 'nc', address_1: 'Street', city: 'City', postal_code: '27837' }
const items = [{ line_item: { id: 'item', product_id: 'p', currency_code: 'usd', unit_price: 12, quantity: 2 }, rates: [] }]
const breakdown = [{ taxability_reason: 'standard_rated', jurisdiction: { country: 'US', state: 'NC' }, tax_rate_details: { percentage_decimal: '7' } }]
beforeEach(() => {
  process.env = { ...original, APP_ENV: 'production', DATABASE_URL: 'postgres://u:p@postgres-aw4sntlbsbfsukqtfvccduqm/rustic_halo_production',
    STRIPE_API_KEY: 'sk_live_fake', STRIPE_TAX_LIVE_ENABLED: 'true', STRIPE_TAX_REPORTING_LIVE_ENABLED: 'true', TAX_COLLECTION_STATE: 'NC', STRIPE_TEST_ENABLED: 'false', STRIPE_TAX_TEST_ENABLED: 'false' }
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'taxcalc_fake', currency: 'usd', livemode: true, tax_amount_inclusive: 0,
    line_items: { has_more: false, data: [{ reference: 'item', tax_breakdown: breakdown }] } }) })
})
afterEach(() => { process.env = original; global.fetch = originalFetch })
test('calculates real extended goods inputs rather than a fixed rate probe', async () => {
  const lines = await new Service({}, { apiKey: 'sk_live_fake' }).getTaxLines(items, [], { address })
  expect(lines).toEqual([expect.objectContaining({ line_item_id: 'item', rate: 7 })])
  const body = (global.fetch as jest.Mock).mock.calls[0][1].body as URLSearchParams
  expect(body.get('line_items[0][amount]')).toBe('2400')
  expect(body.get('line_items[0][reference]')).toBe('item')
})
test('VA removes NC taxes without requesting a calculation', async () => {
  expect(await new Service({}, { apiKey: 'sk_live_fake' }).getTaxLines(items, [], { address: { ...address, province_code: 'va' } })).toEqual([])
  expect(global.fetch).not.toHaveBeenCalled()
})
test('shipping uses its dedicated tax field and identical requests are cached', async () => {
  ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ id: 'taxcalc_fake', currency: 'usd', livemode: true, tax_amount_inclusive: 0,
    line_items: { has_more: false, data: [{ reference: 'item', tax_breakdown: breakdown }] }, shipping_cost: { amount: 500, amount_tax: 35 },
    tax_breakdown: [{ inclusive: false, taxability_reason: 'standard_rated', tax_rate_details: { country: 'US', state: 'NC', percentage_decimal: '7' } }] }) })
  const service = new Service({}, { apiKey: 'sk_live_fake' })
  const shipping = [{ shipping_line: { id: 'shipping', shipping_option_id: 'option', currency_code: 'usd', unit_price: 5 }, rates: [] }]
  const lines = await service.getTaxLines(items, shipping, { address })
  await service.getTaxLines(items, shipping, { address })
  expect(global.fetch).toHaveBeenCalledTimes(1)
  expect(lines).toEqual([expect.objectContaining({ line_item_id: 'item', rate: 7 }), expect.objectContaining({ shipping_line_id: 'shipping', rate: 7 })])
  const body = (global.fetch as jest.Mock).mock.calls[0][1].body as URLSearchParams
  expect(body.get('shipping_cost[amount]')).toBe('500')
  expect(body.get('line_items[1][amount]')).toBeNull()
})
test('validation usage cap blocks additional requests', async () => {
  process.env.STRIPE_TAX_VALIDATION_MAX_CALLS = '1'
  const service = new Service({}, { apiKey: 'sk_live_fake' })
  await service.getTaxLines(items, [], { address })
  await expect(service.getTaxLines(items, [], { address: { ...address, city: 'Other' } })).rejects.toThrow('budget')
  expect(global.fetch).toHaveBeenCalledTimes(1)
})
test('missing registration, wrong mode and API failures block taxes', async () => {
  const service = new Service({}, { apiKey: 'sk_live_fake' })
  for (const result of [{ livemode: false }, { livemode: true, currency: 'usd', id: 'taxcalc_x', tax_amount_inclusive: 0, line_items: { has_more: false, data: [{ reference: 'item', tax_breakdown: [{ ...breakdown[0], taxability_reason: 'not_collecting' }] }] } }]) {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => result })
    await expect(service.getTaxLines(items, [], { address })).rejects.toThrow()
  }
  ;(global.fetch as jest.Mock).mockResolvedValue({ ok: false })
  await expect(service.getTaxLines(items, [], { address })).rejects.toThrow('unavailable')
})
test('production cart preflight rejects sandbox keys before any request', async () => {
  await expect(compareProductionCartTax({} as TaxCart, 'sk_test_fake')).rejects.toThrow('Live')
  expect(global.fetch).not.toHaveBeenCalled()
})
