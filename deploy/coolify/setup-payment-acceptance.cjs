exports.default = async ({ container, args }) => {
  const { Modules } = require('@medusajs/framework/utils')
  const { updateRegionsWorkflow } = require('@medusajs/medusa/core-flows')
  const db = new URL(process.env.DATABASE_URL || '')
  if (process.env.APP_ENV !== 'production' || db.hostname !== 'postgres-aw4sntlbsbfsukqtfvccduqm'
    || db.pathname !== '/rustic_halo_production' || process.env.PRODUCTION_ACCEPTANCE_ONLY !== 'true'
    || !process.env.STRIPE_API_KEY?.startsWith('sk_live_')) throw Error('Isolated private acceptance required')
  const apply = args[0] === 'assign'
  if (!apply && args[0] !== 'restore') throw Error('Choose assign or restore')
  if (apply && (process.env.STRIPE_LIVE_ENABLED !== 'true' || process.env.PRODUCTION_CHECKOUT_READY !== 'true'
    || !/^cart_[A-Za-z0-9]+$/.test(process.env.PRODUCTION_ACCEPTANCE_CART_ID || '')
    || process.env.PRODUCTION_ACCEPTANCE_EMAIL !== 'shawn@house.email')) throw Error('Approved acceptance settings required')
  const query = container.resolve('query')
  const { data: regions } = await query.graph({ entity: 'region', fields: ['id', 'currency_code', 'countries.iso_2', 'payment_providers.id'] })
  if (regions.length !== 1 || regions[0].currency_code !== 'usd' || regions[0].countries.length !== 1
    || regions[0].countries[0].iso_2 !== 'us') throw Error('Expected isolated US region')
  const current = regions[0].payment_providers.map(x => x.id)
  if (current.some(x => x !== 'pp_stripe_stripe')) throw Error('Unexpected provider assignment')
  if (apply) {
    const providers = await container.resolve(Modules.PAYMENT).listPaymentProviders({ id: 'pp_stripe_stripe', is_enabled: true })
    if (providers.length !== 1) throw Error('Live Stripe provider unavailable')
    const { data: carts } = await query.graph({ entity: 'cart', filters: { id: process.env.PRODUCTION_ACCEPTANCE_CART_ID }, fields: ['id', 'region_id', 'completed_at', 'items.quantity', 'items.variant_id'] })
    const cart = carts[0]
    if (!cart || cart.completed_at || cart.region_id !== regions[0].id || cart.items.length !== 1
      || cart.items[0].quantity !== 1 || cart.items[0].variant_id !== 'variant_01M3Z4G50JS1JAKRG979Q76BRQ') throw Error('Acceptance cart changed')
  }
  await updateRegionsWorkflow(container).run({ input: { selector: { id: regions[0].id }, update: { payment_providers: apply ? ['pp_stripe_stripe'] : [] } } })
  const { data: checked } = await query.graph({ entity: 'region', filters: { id: regions[0].id }, fields: ['id', 'payment_providers.id'] })
  if (JSON.stringify(checked[0].payment_providers.map(x => x.id)) !== JSON.stringify(apply ? ['pp_stripe_stripe'] : [])) throw Error('Provider assignment verification failed')
  console.log('RH_PAYMENT_ACCEPTANCE ' + JSON.stringify({ action: args[0], assigned: apply, maxChargeUsd: 25, singleCartOnly: true, orderCreated: false }))
}
