import type { ExecArgs } from '@medusajs/framework/types'
import { assertShippingTestEnvironment } from '../lib/shipping-test-environment'
import { compareCartTax, type TaxCart } from '../lib/tax/cart-calculation'

/** Creates only a sandbox calculation; never changes cart, payment, or tax transactions. */
export default async function compareCartTaxTest({ container, args }: ExecArgs) {
  assertShippingTestEnvironment(process.env)
  if (args.length !== 1 || !/^cart_[A-Za-z0-9]+$/.test(args[0])) throw Error('Provide one exact cart ID')
  const query = container.resolve('query')
  const { data: [cart] } = await query.graph({ entity: 'cart', filters: { id: args[0] }, fields: [
    'id', 'currency_code', 'total', 'tax_total', 'shipping_total', 'shipping_tax_total', 'shipping_address.*',
    'items.id', 'items.total', 'items.tax_total', 'items.is_giftcard', 'items.is_tax_inclusive', 'shipping_methods.is_tax_inclusive',
  ] })
  if (!cart) throw Error('Cart not found')
  const result = await compareCartTax(cart as unknown as TaxCart, process.env.STRIPE_API_KEY || '')
  console.log(JSON.stringify({ ...result, sandboxOnly: true, cartUnchanged: true }))
  if (!result.matches) throw Error('Checkout tax differs from actual-cart calculation; review before payment')
}
