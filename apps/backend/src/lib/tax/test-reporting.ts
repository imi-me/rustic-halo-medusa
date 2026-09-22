/** Test-only Stripe Tax reporting. Never accepts live credentials. */
export type TaxSale = {
  reference: string
  address: { line1: string; city: string; state: string; postal_code: string; country: string }
  items: { reference: string; netCents: number }[]
  shippingNetCents: number
  expectedTaxCents: number
  expectedTotalCents: number
}
export class TestTaxReporting {
  constructor(private key: string) {
    if (!key.startsWith('sk_test_')) throw new Error('Tax reporting pilot requires a test key.')
  }
  private async request(path: string, parameters: Record<string, string>, idempotencyKey: string) {
    const response = await fetch(`https://api.stripe.com/v1/tax/${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': idempotencyKey },
      body: new URLSearchParams(parameters), signal: AbortSignal.timeout(20000),
    })
    if (!response.ok) throw new Error(`Stripe Tax reporting failed (HTTP ${response.status}); retry with the same reference.`)
    const result = await response.json()
    if (result.livemode !== false) throw new Error('Expected a test tax record.')
    return result
  }
  async recordSale(sale: TaxSale) {
    if (!sale.reference || !sale.items.length || sale.items.length > 100) throw new Error('A sale reference and 1–100 items are required.')
    if (sale.address.country !== 'US' || sale.address.state !== 'NC') throw new Error('This reporting pilot covers NC sales only.')
    const amounts = [sale.shippingNetCents, sale.expectedTaxCents, sale.expectedTotalCents, ...sale.items.map(item => item.netCents)]
    if (amounts.some(amount => !Number.isSafeInteger(amount) || amount < 0)) throw new Error('Use nonnegative integer cents.')
    if (new Set(sale.items.map(item => item.reference)).size !== sale.items.length) throw new Error('Item references must be unique.')
    const params: Record<string, string> = { currency: 'usd', 'customer_details[address_source]': 'shipping', 'shipping_cost[amount]': String(sale.shippingNetCents), 'shipping_cost[tax_behavior]': 'exclusive' }
    for (const [field, value] of Object.entries(sale.address)) params[`customer_details[address][${field}]`] = value
    sale.items.forEach((item, index) => {
      params[`line_items[${index}][amount]`] = String(item.netCents)
      params[`line_items[${index}][reference]`] = item.reference
      params[`line_items[${index}][tax_code]`] = 'txcd_99999999'
      params[`line_items[${index}][tax_behavior]`] = 'exclusive'
    })
    const calculation = await this.request('calculations', params, `rh-test-tax-calc/${sale.reference}`)
    if (calculation.tax_amount_exclusive !== sale.expectedTaxCents || calculation.amount_total !== sale.expectedTotalCents) {
      throw new Error('Stripe tax does not match the collected order amounts. Do not record this sale until reconciled.')
    }
    const transaction = await this.request('transactions/create_from_calculation', {
      calculation: calculation.id, reference: sale.reference,
    }, `rh-test-tax-sale/${sale.reference}`)
    return { calculationId: calculation.id as string, transactionId: transaction.id as string }
  }
  async recordPartialRefund(transactionId: string, refundReference: string, grossCents: number) {
    if (!transactionId.startsWith('tax_') || !refundReference || !Number.isSafeInteger(grossCents) || grossCents <= 0) throw new Error('A tax transaction, refund reference and positive integer cents are required.')
    const reversal = await this.request('transactions/create_reversal', {
      mode: 'partial', original_transaction: transactionId, reference: refundReference,
      flat_amount: String(-grossCents),
    }, `rh-test-tax-refund/${refundReference}`)
    return { reversalId: reversal.id as string }
  }
  async recordFullRefund(transactionId: string, refundReference: string) {
    if (!transactionId.startsWith('tax_') || !refundReference) throw new Error('Original tax transaction and unique refund reference are required.')
    const reversal = await this.request('transactions/create_reversal', {
      mode: 'full', original_transaction: transactionId, reference: refundReference,
    }, `rh-test-tax-refund/${refundReference}`)
    return { reversalId: reversal.id as string }
  }
}
