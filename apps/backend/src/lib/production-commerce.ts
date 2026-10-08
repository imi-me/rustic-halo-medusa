/** Explicit production boundary; staging and local sandbox guards stay separate. */
export function assertProductionEnvironment(env: NodeJS.ProcessEnv) {
  const url = new URL(env.DATABASE_URL || '')
  if (env.APP_ENV !== 'production' || url.pathname !== '/rustic_halo_production'
    || url.hostname !== 'postgres-aw4sntlbsbfsukqtfvccduqm'
    || (url.port && url.port !== '5432') || env.STRIPE_TEST_ENABLED === 'true'
    || env.STRIPE_TAX_TEST_ENABLED === 'true') {
    throw Error('Production commerce requires the isolated production database and no sandbox providers.')
  }
}

export function productionCommerce(env: NodeJS.ProcessEnv) {
  const payment = env.STRIPE_LIVE_ENABLED === 'true'
  const shipping = env.SHIPPO_LIVE_QUOTES_ENABLED === 'true'
  const tax = env.STRIPE_TAX_LIVE_ENABLED === 'true'
  if (payment || shipping || tax) assertProductionEnvironment(env)
  if (tax && (!env.STRIPE_API_KEY?.startsWith('sk_live_') || env.TAX_COLLECTION_STATE !== 'NC'
    || env.STRIPE_TAX_REPORTING_LIVE_ENABLED !== 'true')) {
    throw Error('Production tax requires live Stripe, confirmed NC collection and transaction reporting.')
  }
  if (shipping) {
    if (!env.SHIPPO_API_KEY?.startsWith('shippo_live_')) throw Error('Production shipping requires a live Shippo token.')
    for (const field of ['NAME', 'STREET1', 'CITY', 'STATE', 'ZIP', 'COUNTRY']) {
      if (!env[`SHIPPO_FROM_${field}`]?.trim()) throw Error(`Production shipping requires SHIPPO_FROM_${field}.`)
    }
    if (env.SHIPPO_FROM_COUNTRY?.toUpperCase() !== 'US') throw Error('Production shipping requires a US origin.')
  }
  if (payment) {
    if (!env.STRIPE_API_KEY?.startsWith('sk_live_') || !env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_')) {
      throw Error('Production payments require live Stripe credentials and a webhook signing secret.')
    }
    if (env.PRODUCTION_CHECKOUT_READY !== 'true' || !shipping || !tax) {
      throw Error('Production payments require verified tax, shipping, webhook and checkout acceptance.')
    }
  }
  return { payment, shipping, tax }
}
