import type { ITaxProvider, TaxTypes } from '@medusajs/framework/types'

/** Test-only rate adapter for the current taxable physical-goods catalog.
 * Live use requires tax transaction/refund recording and reconciliation first.
 */
export default class StripeTaxTestService implements ITaxProvider {
  static identifier = 'stripe-tax-test'
  private key: string
  private cache = new Map<string, { expires: number; rate: number; calculation: string }>()
  constructor(_: unknown, options: { apiKey: string }) {
    if (!options.apiKey?.startsWith('sk_test_')) throw new Error('Stripe Tax pilot requires a test key.')
    this.key = options.apiKey
  }
  getIdentifier() { return StripeTaxTestService.identifier }

  async getTaxLines(items: TaxTypes.ItemTaxCalculationLine[], shipping: TaxTypes.ShippingTaxCalculationLine[], context: TaxTypes.TaxCalculationContext): Promise<(TaxTypes.ItemTaxLineDTO | TaxTypes.ShippingTaxLineDTO)[]> {
    const address = context.address
    const state = address.province_code?.toUpperCase()
    // The merchant has confirmed registration in NC only.
    if (address.country_code.toUpperCase() !== 'US' || (state && state !== 'NC')) return []
    if (!state) return [] // A new cart has no shipping address yet.
    if (!address.address_1 || !address.city || !address.postal_code) throw new Error('Enter a complete shipping address to calculate North Carolina tax.')
    for (const line of [...items.map(x => x.line_item), ...shipping.map(x => x.shipping_line)]) {
      if (line.currency_code?.toLowerCase() !== 'usd') throw new Error('Stripe Tax pilot supports USD only.')
    }
    // A fixed taxable-goods probe obtains the destination rate. Medusa applies
    // this rate to its own discounted amounts; this is not a reportable sale.
    const params = new URLSearchParams({
      currency: 'usd',
      'customer_details[address][country]': 'US',
      'customer_details[address][state]': 'NC',
      'customer_details[address][line1]': address.address_1,
      'customer_details[address][line2]': address.address_2 || '',
      'customer_details[address][city]': address.city,
      'customer_details[address][postal_code]': address.postal_code,
      'customer_details[address_source]': 'shipping',
      'line_items[0][amount]': '10000',
      'line_items[0][reference]': 'nc-physical-goods-rate-test',
      'line_items[0][tax_code]': 'txcd_99999999',
      'line_items[0][tax_behavior]': 'exclusive',
    })
    const cacheKey = params.toString()
    let result = this.cache.get(cacheKey)
    if (!result || result.expires <= Date.now()) {
      const response = await fetch('https://api.stripe.com/v1/tax/calculations', {
        method: 'POST', headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params, signal: AbortSignal.timeout(15000),
      })
      if (!response.ok) throw new Error('Tax calculation is unavailable. Please try again before paying.')
      const calculation = await response.json()
      if (calculation.livemode !== false) throw new Error('Expected a test tax calculation.')
      const breakdown = calculation.tax_breakdown as Array<{ inclusive: boolean; taxability_reason: string; tax_rate_details: { percentage_decimal: string | null; country: string; state: string } }>
      if (!breakdown?.length || breakdown.some(x => x.inclusive || x.taxability_reason !== 'standard_rated' || x.tax_rate_details.country !== 'US' || x.tax_rate_details.state !== 'NC' || x.tax_rate_details.percentage_decimal === null)) {
        throw new Error('NC tax registration or product tax treatment needs review before payment.')
      }
      const rate = breakdown.reduce((sum, x) => sum + Number(x.tax_rate_details.percentage_decimal), 0)
      if (!Number.isFinite(rate) || rate <= 0 || rate > 15) throw new Error('Unexpected North Carolina tax rate.')
      result = { rate, calculation: calculation.id, expires: Date.now() + 15 * 60 * 1000 }
      if (this.cache.size >= 500) this.cache.clear()
      this.cache.set(cacheKey, result)
    }
    const base = { rate: result.rate, code: 'NC-SALES-TAX', name: 'NC sales tax', provider_id: this.getIdentifier(), data: { test_only: true, rate_calculation_id: result.calculation } }
    return [
      ...items.map(x => ({ ...base, line_item_id: x.line_item.id })),
      ...shipping.map(x => ({ ...base, shipping_line_id: x.shipping_line.id })),
    ]
  }
}
