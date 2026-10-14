import { defaultPackages, assignmentSchema, SHIPPING_KEY } from '../../../lib/shipping-packages'
import ShippoTestService from '../service'

describe('empty cart shipping recalculation', () => {
  const originalEnv = process.env
  beforeEach(() => {
    process.env = { ...originalEnv, APP_ENV: 'staging', STRIPE_TEST_ENABLED: 'true', DATABASE_URL: 'postgres://postgres@postgres/rustic_halo_staging', SHIPPO_API_KEY: 'shippo_test_fixture' }
  })
  afterEach(() => { process.env = originalEnv; jest.restoreAllMocks() })

  const calculate = (items: unknown[]) => new ShippoTestService().calculatePrice({}, {},
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

describe('saved package checkout integration', () => {
  const originalEnv = process.env
  afterEach(() => { process.env = originalEnv; jest.restoreAllMocks() })
  it('quotes each box using the shared packing plan and invalidates cache when package settings change', async () => {
    process.env = { ...originalEnv, APP_ENV: 'staging', STRIPE_TEST_ENABLED: 'true', DATABASE_URL: 'postgres://postgres@postgres/rustic_halo_staging', SHIPPO_API_KEY: 'shippo_test_fixture' }
    let config = defaultPackages()
    const operations = { listAdminOperations: jest.fn(async () => [{ payload: { config: { packages: config.packages, type_defaults: {} }, revision: config.revision } }]) }
    const product = { id: 'product_one', weight: 28.349523125, metadata: { [SHIPPING_KEY]: assignmentSchema.parse({ package_id: 'hair-claw-box' }) } }
    const products = { listProductVariants: jest.fn().mockResolvedValue([{ id: 'variant_one', sku: 'NEW-SHIPPING-SKU', product }]) }
    const provider = new ShippoTestService({ admin_operations: operations, product: products })
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ rates: [{ currency: 'USD', servicelevel: { token: 'usps_ground_advantage' }, amount: '5.00' }] }) } as any)
    const context = { currency_code: 'usd', shipping_address: { country_code: 'us', address_1: '123 Example St', city: 'Grimesland', province: 'NC', postal_code: '27837' }, items: [{ variant_id: 'variant_one', quantity: 4 }] } as any
    expect(await provider.calculatePrice({}, {}, context)).toMatchObject({ calculated_amount: 10 })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(JSON.parse((fetchSpy.mock.calls[0][1] as any).body).parcels[0]).toEqual({ length: '6', width: '4', height: '3', weight: '4.6', distance_unit: 'in', mass_unit: 'oz' })
    await provider.calculatePrice({}, {}, context); expect(fetchSpy).toHaveBeenCalledTimes(2)
    config = { ...defaultPackages(), revision: 'edited' }; config.packages[0].height = 4
    await provider.calculatePrice({}, {}, context); expect(fetchSpy).toHaveBeenCalledTimes(4)
    expect(JSON.parse((fetchSpy.mock.calls[2][1] as any).body).parcels[0].height).toBe('4')
    expect(fetchSpy.mock.calls.every(([url]) => String(url).endsWith('/shipments/'))).toBe(true)
  })
})
