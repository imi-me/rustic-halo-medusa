import { assertShippingTestEnvironment } from '../shipping-test-environment'

describe('shipping test environment boundary', () => {
  it('preserves the local pilot', () => {
    expect(() => assertShippingTestEnvironment({ DATABASE_URL: 'postgres://u:p@127.0.0.1:55432/rustic_halo_local' })).not.toThrow()
  })
  it('allows only the explicitly enabled staging database', () => {
    const env = { APP_ENV: 'staging', STRIPE_TEST_ENABLED: 'true', DATABASE_URL: 'postgres://u:p@postgres:5432/rustic_halo_staging' }
    expect(() => assertShippingTestEnvironment(env)).not.toThrow()
    for (const patch of [
      { APP_ENV: 'production' }, { STRIPE_TEST_ENABLED: 'false' },
      { DATABASE_URL: 'postgres://u:p@postgres:5432/production' },
      { DATABASE_URL: 'postgres://u:p@example.com:5432/rustic_halo_staging' },
    ]) expect(() => assertShippingTestEnvironment({ ...env, ...patch })).toThrow()
  })
})
