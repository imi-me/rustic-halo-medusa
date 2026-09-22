import ShippoTestService from '../service'

describe('empty cart shipping recalculation', () => {
  const originalEnv = process.env
  beforeEach(() => {
    process.env = { ...originalEnv, APP_ENV: 'staging', STRIPE_TEST_ENABLED: 'true', DATABASE_URL: 'postgres://postgres/rustic_halo_staging', SHIPPO_API_KEY: 'shippo_test_fixture' }
  })
  afterEach(() => { process.env = originalEnv; jest.restoreAllMocks() })

  const calculate = (items: unknown[]) => ShippoTestService.prototype.calculatePrice.call(
    { root: '/unused', cache: new Map() } as any, {}, {},
    { currency_code: 'usd', shipping_address: { country_code: 'us', address_1: '123 Example St', city: 'Grimesland', province: 'NC', postal_code: '27837' }, items } as any
  )

  it('returns zero without requesting an external quote when the last item is removed', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No external calls expected'))
    await expect(calculate([])).resolves.toEqual({ calculated_amount: 0, is_calculated_price_tax_inclusive: false })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('still rejects a nonempty cart containing an unconfigured product', async () => {
    await expect(calculate([{ quantity: 1, variant_sku: 'unconfigured' }])).rejects.toThrow('Shipping measurements are not confirmed')
  })

  it('preserves test credential restrictions for empty carts', async () => {
    process.env.SHIPPO_API_KEY = 'shippo_live_fixture'
    await expect(calculate([])).rejects.toThrow('Shippo test token required')
  })
})
