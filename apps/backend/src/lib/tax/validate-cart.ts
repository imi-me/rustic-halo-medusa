import type { MedusaContainer } from '@medusajs/framework/types'
import { assertShippingTestEnvironment } from '../shipping-test-environment'
import { compareCartTax, type TaxCart } from './cart-calculation'

export async function validateCartTax(container: MedusaContainer, cartId: string, salesChannels?: string[]) {
 if (process.env.STRIPE_TAX_TEST_ENABLED !== 'true') return
 assertShippingTestEnvironment(process.env)
 if (!/^cart_[A-Za-z0-9]+$/.test(cartId)) throw Error('Invalid cart')
 const query=container.resolve('query')
 const {data:[cart]}=await query.graph({entity:'cart',filters:{id:cartId},fields:[
  'id','sales_channel_id','currency_code','total','tax_total','shipping_total','shipping_tax_total','shipping_address.*',
  'items.id','items.total','items.tax_total','items.is_giftcard','items.is_tax_inclusive','shipping_methods.is_tax_inclusive',
 ]})
 if(!cart || (salesChannels && (!cart.sales_channel_id || !salesChannels.includes(cart.sales_channel_id)))) throw Error('Cart unavailable')
 const address=cart.shipping_address
 if(!address?.country_code || !address.province) throw Error('Shipping address required')
 if(address.country_code.toLowerCase()!=='us' || cart.currency_code?.toLowerCase()!=='usd') throw Error('Checkout requires a US address and USD')
 if(address.province.toLowerCase()!=='nc') {
  // Changing the destination must remove NC tax before accepting payment.
  // Check components too: an aggregate zero must not hide stale line taxes.
  const taxes: unknown[]=[cart.tax_total,cart.shipping_tax_total,...(cart.items || []).map(item=>item?.tax_total)]
  if(taxes.some(value=>value==null || value==='' || typeof value==='boolean' || !Number.isFinite(Number(value)) || Number(value)!==0)) throw Error('Unexpected tax outside North Carolina')
  return
 }
 const result=await compareCartTax(cart as unknown as TaxCart,process.env.STRIPE_API_KEY || '')
 if(!result.matches) throw Error('Tax totals differ')
}
