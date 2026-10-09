/** Sandbox comparison of Stripe's actual discounted cart amounts with Medusa totals. */
import { decimalCents } from './cents'
export type TaxCart = {
  id: string; currency_code: string; total: unknown; tax_total: unknown
  shipping_total: unknown; shipping_tax_total: unknown
  shipping_address: { country_code: string; province: string; address_1: string; address_2?: string | null; city: string; postal_code: string }
  items: { id: string; total: unknown; tax_total: unknown; is_giftcard?: boolean; is_tax_inclusive?: boolean }[]
  shipping_methods?: { is_tax_inclusive?: boolean }[]
}
function amount(value: unknown): number {
  if (value == null || value === '' || typeof value === 'boolean') throw Error('Missing cart amount')
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) throw Error('Invalid cart amount')
  return n
}
function cents(value: number) {
  const n = decimalCents(value)
  if (!Number.isSafeInteger(n) || n < 0) throw Error('Invalid cart cents')
  return n
}
export function cartCalculationParameters(cart: TaxCart) {
  const a = cart.shipping_address
  if (cart.currency_code !== 'usd' || a?.country_code?.toLowerCase() !== 'us' || a.province?.toLowerCase() !== 'nc') throw Error('Comparison requires a USD NC cart')
  if (!a.address_1 || !a.city || !a.postal_code) throw Error('Complete shipping address required')
  if (!cart.items.length || cart.items.length > 100 || new Set(cart.items.map(i => i.id)).size !== cart.items.length) throw Error('Expected 1–100 unique items')
  if (cart.items.some(i => !i.id || i.is_giftcard || i.is_tax_inclusive) || cart.shipping_methods?.some(s => s.is_tax_inclusive)) throw Error('Only exclusive physical-goods tax is supported')
  // Medusa total includes tax and discounts. Subtract tax once; quantity is
  // already included. This matches the existing order-reporting convention.
  const net = (total: unknown, tax: unknown) => cents(amount(total) - amount(tax))
  const params = new URLSearchParams({ currency: 'usd', 'customer_details[address_source]': 'shipping',
    'customer_details[address][country]': 'US', 'customer_details[address][state]': 'NC',
    'customer_details[address][line1]': a.address_1, 'customer_details[address][line2]': a.address_2 || '',
    'customer_details[address][city]': a.city, 'customer_details[address][postal_code]': a.postal_code,
    'shipping_cost[amount]': String(net(cart.shipping_total, cart.shipping_tax_total)), 'shipping_cost[tax_behavior]': 'exclusive' })
  cart.items.forEach((item, index) => {
    params.set(`line_items[${index}][amount]`, String(net(item.total, item.tax_total)))
    params.set(`line_items[${index}][reference]`, item.id)
    params.set(`line_items[${index}][tax_code]`, 'txcd_99999999')
    params.set(`line_items[${index}][tax_behavior]`, 'exclusive')
  })
  return params
}
export async function compareCartTax(cart: TaxCart, key: string) {
  if (!key.startsWith('sk_test_')) throw Error('Sandbox Stripe key required')
  return compareCartTaxInMode(cart, key, false)
}
export async function compareProductionCartTax(cart: TaxCart, key: string) {
  if (!key.startsWith('sk_live_')) throw Error('Live Stripe key required')
  return compareCartTaxInMode(cart, key, true)
}
async function compareCartTaxInMode(cart: TaxCart, key: string, live: boolean) {
  const body = cartCalculationParameters(cart)
  const response = await fetch('https://api.stripe.com/v1/tax/calculations', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body, signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw Error('Cart tax comparison unavailable')
  const result = await response.json()
  if (result.livemode !== live || result.currency !== 'usd' || typeof result.id !== 'string' || !result.id.startsWith('taxcalc_') || !Number.isSafeInteger(result.tax_amount_exclusive) || result.tax_amount_exclusive < 0 || !Number.isSafeInteger(result.amount_total) || result.amount_total < 0 || result.tax_amount_inclusive !== 0) throw Error('Unexpected tax calculation')
  const expectedTaxCents = cents(amount(cart.tax_total))
  const expectedTotalCents = cents(amount(cart.total))
  return { cartId: cart.id, calculationId: result.id, expectedTaxCents, calculatedTaxCents: result.tax_amount_exclusive,
    expectedTotalCents, calculatedTotalCents: result.amount_total,
    matches: expectedTaxCents === result.tax_amount_exclusive && expectedTotalCents === result.amount_total }
}
