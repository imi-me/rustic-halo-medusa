import type { ITaxProvider, TaxTypes } from '@medusajs/framework/types'
import { productionCommerce } from '../../lib/production-commerce'

/** NC taxable physical goods. Exact discounted cart totals are checked before payment. */
export default class StripeTaxLiveService implements ITaxProvider {
  static identifier = 'stripe-tax-live'
  private key: string
  private cache = new Map<string, { expires: number; result: any }>()
  private validationCalls = 0
  constructor(_: unknown, options: { apiKey: string }) {
    if (!productionCommerce(process.env).tax || !options.apiKey?.startsWith('sk_live_')) {
      throw Error('Live tax calculation requires explicit production configuration.')
    }
    this.key = options.apiKey
  }
  getIdentifier() { return StripeTaxLiveService.identifier }
  async getTaxLines(items: TaxTypes.ItemTaxCalculationLine[], shipping: TaxTypes.ShippingTaxCalculationLine[], context: TaxTypes.TaxCalculationContext): Promise<(TaxTypes.ItemTaxLineDTO | TaxTypes.ShippingTaxLineDTO)[]> {
    const a = context.address
    if (a.country_code.toLowerCase() !== 'us') throw Error('Launch shipping is US only.')
    if (!a.province_code || a.province_code.toLowerCase() !== 'nc') return []
    if (!a.address_1 || !a.city || !a.postal_code) throw Error('Complete NC shipping address required.')
    if (!items.length) return []
    // Medusa's provider DTO supplies extended taxable inputs separately from
    // promotion totals. The independent discounted-cart preflight must match.
    const lines = [
      ...items.map(x => ({ id: x.line_item.id, amount: Number(x.line_item.unit_price) * Number(x.line_item.quantity ?? 1), currency: x.line_item.currency_code, shipping: false })),
      ...shipping.map(x => ({ id: x.shipping_line.id, amount: Number(x.shipping_line.unit_price), currency: x.shipping_line.currency_code, shipping: true })),
    ]
    if (lines.length > 100 || new Set(lines.map(l => l.id)).size !== lines.length
      || lines.some(l => !l.id || l.currency !== 'usd' || !Number.isFinite(l.amount) || l.amount < 0)) {
      throw Error('Unsupported production tax inputs.')
    }
    const params = new URLSearchParams({ currency: 'usd', 'customer_details[address_source]': 'shipping',
      'customer_details[address][country]': 'US', 'customer_details[address][state]': 'NC',
      'customer_details[address][line1]': a.address_1, 'customer_details[address][line2]': a.address_2 || '',
      'customer_details[address][city]': a.city, 'customer_details[address][postal_code]': a.postal_code,
      'expand[0]': 'line_items.data.tax_breakdown' })
    // Keep each Medusa shipping line identifiable instead of merging multiple boxes.
    lines.filter(l => !l.shipping).forEach((l, i) => {
      params.set(`line_items[${i}][amount]`, String(Math.round(l.amount * 100)))
      params.set(`line_items[${i}][reference]`, l.id)
      params.set(`line_items[${i}][tax_code]`, l.shipping ? 'txcd_92010001' : 'txcd_99999999')
      params.set(`line_items[${i}][tax_behavior]`, 'exclusive')
    })
    if (shipping.length) {
      params.set('shipping_cost[amount]', String(Math.round(lines.filter(l => l.shipping).reduce((sum, l) => sum + l.amount, 0) * 100)))
      params.set('shipping_cost[tax_code]', 'txcd_92010001')
      params.set('shipping_cost[tax_behavior]', 'exclusive')
    }
    const cacheKey = params.toString()
    let result = this.cache.get(cacheKey)
    if (!result || result.expires <= Date.now()) {
    const validationLimit = process.env.STRIPE_TAX_VALIDATION_MAX_CALLS
    if (validationLimit) {
      const limit = Number(validationLimit)
      if (!Number.isSafeInteger(limit) || limit < 1 || this.validationCalls >= limit) throw Error('Tax validation budget reached.')
      this.validationCalls++
    }
    const response = await fetch('https://api.stripe.com/v1/tax/calculations', { method: 'POST',
      headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params, signal: AbortSignal.timeout(15000) })
    if (!response.ok) throw Error('Tax calculation unavailable; payment is blocked.')
    const calculation = await response.json()
    if (calculation.livemode !== true || calculation.currency !== 'usd' || typeof calculation.id !== 'string'
      || !calculation.id.startsWith('taxcalc_') || calculation.tax_amount_inclusive !== 0 || calculation.line_items?.has_more
      || !Array.isArray(calculation.line_items?.data) || calculation.line_items.data.length !== items.length) {
      throw Error('Unexpected live tax calculation.')
    }
    result = { expires: Date.now() + 15 * 60 * 1000, result: calculation }
    }
    const calculation = result.result
    const seen = new Set<string>()
    // Stripe exposes shipping tax at calculation level, not a per-shipping
    // breakdown. All launch goods and shipping share the NC sales rate.
    const shippingBreakdown = calculation.tax_breakdown?.map((b: any) => {
      if (b.inclusive !== false) throw Error('Exclusive shipping tax required.')
      return { ...b, jurisdiction: { country: b.tax_rate_details?.country, state: b.tax_rate_details?.state } }
    })
    const calculatedLines = [...calculation.line_items.data,
      ...lines.filter(l => l.shipping).map(l => ({ reference: l.id, tax_breakdown: shippingBreakdown }))]
    const taxLines = calculatedLines.map((calculated: { reference: string; tax_breakdown: Array<{ taxability_reason: string; jurisdiction: { country: string; state: string }; tax_rate_details: { percentage_decimal: string } }> }) => {
      const line = lines.find(l => l.id === calculated.reference)
      if (!line || seen.has(line.id)) throw Error('Tax calculation line mismatch.')
      seen.add(line.id)
      const breakdown = calculated.tax_breakdown
      if (!Array.isArray(breakdown) || !breakdown.length || breakdown.some(b =>
        b.taxability_reason !== 'standard_rated' || b.jurisdiction?.country !== 'US'
        || b.jurisdiction?.state !== 'NC' || b.tax_rate_details.percentage_decimal == null)) {
        throw Error('NC tax registration or product treatment requires review.')
      }
      const rate = breakdown.reduce((sum, b) => sum + Number(b.tax_rate_details.percentage_decimal), 0)
      if (!Number.isFinite(rate) || rate <= 0 || rate > 15) throw Error('Unexpected NC tax rate.')
      const base = { rate, code: 'NC-SALES-TAX', name: 'NC sales tax', provider_id: this.getIdentifier(),
        data: { live: true, calculation_id: calculation.id } }
      return line.shipping ? { ...base, shipping_line_id: line.id } : { ...base, line_item_id: line.id }
    })
    if (this.cache.size >= 500) this.cache.clear()
    this.cache.set(cacheKey, result)
    return taxLines
  }
}
