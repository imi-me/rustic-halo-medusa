import type { MedusaRequest, MedusaStoreRequest, MedusaResponse, MedusaNextFunction } from '@medusajs/framework/http'
import { productionCommerce } from './production-commerce'
import { validateCartTax } from './tax/validate-cart'

/** Check authoritative totals before a client receives a live payment session. */
export async function validateProductionPayment(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  if (process.env.APP_ENV !== 'production') return next()
  try {
    if (!productionCommerce(process.env).payment) throw Error('Checkout disabled')
    const channels = (req as MedusaStoreRequest).publishable_key_context?.sales_channel_ids
    if (!channels?.length) throw Error('Cart unavailable')
    const { data } = await req.scope.resolve('query').graph({
      entity: 'payment_collection', filters: { id: req.params.id },
      fields: ['id', 'amount', 'currency_code', 'cart.id', 'cart.sales_channel_id',
        'cart.total', 'cart.currency_code', 'cart.completed_at', 'cart.shipping_methods.id', 'cart.email'],
    })
    const collection = data[0]
    const cart = collection?.cart
    if (!cart?.id || cart.completed_at || !cart.sales_channel_id || !channels.includes(cart.sales_channel_id)
      || !cart.shipping_methods?.length || collection.currency_code !== 'usd'
      || cart.currency_code !== 'usd') throw Error('Cart unavailable')
    const amount = Number(collection.amount)
    const total = Number(cart.total)
    if (!Number.isFinite(amount) || !Number.isFinite(total) || amount <= 0
      || Math.round(amount * 100) !== Math.round(total * 100)) throw Error('Payment total differs')
    // Private acceptance permits only the owner-approved cart and $25 ceiling.
    // General launch requires explicitly releasing this separate gate.
    if (process.env.PRODUCTION_ACCEPTANCE_ONLY !== 'false') {
      const approved = process.env.PRODUCTION_ACCEPTANCE_CART_ID || ''
      const email = process.env.PRODUCTION_ACCEPTANCE_EMAIL || ''
      if (!/^cart_[A-Za-z0-9]+$/.test(approved) || cart.id !== approved
        || !email || cart.email !== email
        || Math.round(total * 100) > 2500) throw Error('Outside approved acceptance cart')
    }
    await validateCartTax(req.scope, cart.id, channels)
    return next()
  } catch {
    return res.status(409).json({ message: 'We could not verify your checkout total. Please refresh checkout and try again before paying.' })
  }
}
