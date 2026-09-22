export function assertShippingTestEnvironment(env: NodeJS.ProcessEnv) {
  const url = new URL(env.DATABASE_URL || '')
  const local = url.hostname === '127.0.0.1' && url.port === '55432' && url.pathname === '/rustic_halo_local'
  const staging = env.APP_ENV === 'staging' && env.STRIPE_TEST_ENABLED === 'true'
    && url.hostname === 'postgres' && (!url.port || url.port === '5432')
    && url.pathname === '/rustic_halo_staging'
  if (!local && !staging) throw new Error('An isolated test database is required')
}
