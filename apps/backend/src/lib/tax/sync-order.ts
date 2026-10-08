import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'
import { assertShippingTestEnvironment } from '../shipping-test-environment'
import { TaxSale, TestTaxReporting } from './test-reporting'
import { LiveTaxReporting } from './live-reporting'
import { productionCommerce } from '../production-commerce'

const cents = (value: unknown) => {
  const amount = Number(value)
  if (value == null || !Number.isFinite(amount) || amount < 0) throw new Error('Missing or invalid tax reporting amount.')
  return Math.round(amount * 100)
}
type RecordState = { sale: TaxSale; startedAt: number; transactionId?: string; calculationId?: string; refundStartedAt?: number; reversalId?: string; refunds?: Record<string, { amount: number; startedAt: number; reversalId?: string }> }
const assertRetryWindow = (started: number) => {
  if (Date.now() - started > 23 * 60 * 60 * 1000) throw new Error('Tax reporting requires manual reconciliation: the safe retry window has expired.')
}

/** Single-backend staging pilot. Amount-based refunds proportionally include tax for the current uniformly taxable catalog. */
export async function syncOrderTax(container: MedusaContainer, orderId: string) {
  const live = process.env.STRIPE_TAX_REPORTING_LIVE_ENABLED === 'true'
  if (!live && process.env.STRIPE_TAX_REPORTING_TEST_ENABLED !== 'true') return
  if (live) productionCommerce(process.env)
  else assertShippingTestEnvironment(process.env)
  const reporting = live ? new LiveTaxReporting(process.env.STRIPE_API_KEY || '') : new TestTaxReporting(process.env.STRIPE_API_KEY || '')
  const metadataKey = live ? 'stripe_tax_live_reporting' : 'stripe_tax_test_reporting'
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const orders = container.resolve(Modules.ORDER)
  const lock = container.resolve(Modules.LOCKING)
  await lock.execute(`stripe-tax-report/${orderId}`, async () => {
    const { data: rows } = await query.graph({ entity: 'order', filters: { id: orderId }, fields: [
      'id', 'currency_code', 'metadata', 'total', 'tax_total', 'shipping_total', 'shipping_tax_total',
      'items.id', 'items.total', 'items.tax_total', 'shipping_address.*',
      'payment_collections.payments.id', 'payment_collections.payments.provider_id', 'payment_collections.payments.data',
    ] })
    const order = rows[0]
    if (!order) throw new Error('Tax reporting order was not found.')
    let state = order.metadata?.[metadataKey] as RecordState | undefined
    if (!state && order.shipping_address?.province?.toLowerCase() !== 'nc') return
    if (order.currency_code !== 'usd') throw new Error('Tax reporting pilot supports USD only.')
    const payments = order.payment_collections?.flatMap(collection => collection?.payments || []) || []
    if (payments.length !== 1 || payments[0]?.provider_id !== 'pp_stripe_stripe') throw new Error('Tax reporting pilot requires one Stripe payment.')
    const paymentIntent = payments[0]?.data?.id
    if (typeof paymentIntent !== 'string' || !paymentIntent.startsWith('pi_')) throw new Error('Stripe payment reference is missing.')
    const response = await fetch(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(paymentIntent)}?expand[]=latest_charge`, {
      headers: { Authorization: `Bearer ${process.env.STRIPE_API_KEY}` }, signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) throw new Error('Unable to verify payment before tax reporting.')
    const payment = await response.json()
    if (payment.livemode !== live || payment.currency !== 'usd') throw new Error('Unexpected USD payment mode.')
    if (payment.status !== 'succeeded') return
    if (payment.amount_received !== (state?.sale.expectedTotalCents ?? cents(order.total))) throw new Error('Captured payment does not match order total.')
    const save = async () => {
      const current = await orders.retrieveOrder(orderId)
      await orders.updateOrders(orderId, { metadata: { ...current.metadata, [metadataKey]: state } })
    }
    if (!state) {
      const address = order.shipping_address!
      if (!address.address_1 || !address.city || !address.postal_code || address.country_code !== 'us') throw new Error('Tax reporting needs the complete NC address.')
      state = { startedAt: Date.now(), sale: {
        reference: orderId,
        address: { line1: address.address_1, city: address.city, state: 'NC', postal_code: address.postal_code, country: 'US' },
        items: order.items!.map(item => ({ reference: item!.id, netCents: cents(Number(item!.total) - Number(item!.tax_total)) })),
        shippingNetCents: cents(Number(order.shipping_total) - Number(order.shipping_tax_total)),
        expectedTaxCents: cents(order.tax_total), expectedTotalCents: cents(order.total),
      } }
      await save() // Preserve the original amounts before making a reportable record.
    }
    if (!state.transactionId) {
      assertRetryWindow(state.startedAt)
      Object.assign(state, await reporting.recordSale(state.sale))
      await save()
    }
    const refunded = payment.latest_charge?.amount_refunded
    if (!Number.isSafeInteger(refunded) || refunded < 0) throw new Error('Unable to verify refund amount.')
    if (refunded === 0 || state.reversalId) return
    // Keep the existing all-at-once path, including its saved retry identity.
    if (refunded === state.sale.expectedTotalCents && !state.refunds) {
      if (!payment.latest_charge.refunded) throw new Error('Full refund is not confirmed.')
      if (!state.refundStartedAt) { state.refundStartedAt = Date.now(); await save() }
      assertRetryWindow(state.refundStartedAt)
      Object.assign(state, await reporting.recordFullRefund(state.transactionId!, `${orderId}-full-refund`))
      await save()
      return
    }
    type Refund = { id: string; amount: number; status: string; currency: string; payment_intent: string; created: number }
    const refunds: Refund[] = []
    let cursor = ''
    for (;;) {
      const params = new URLSearchParams({ payment_intent: paymentIntent, limit: '100' })
      if (cursor) params.set('starting_after', cursor)
      const response = await fetch(`https://api.stripe.com/v1/refunds?${params}`, {
        headers: { Authorization: `Bearer ${process.env.STRIPE_API_KEY}` }, signal: AbortSignal.timeout(15000),
      })
      if (!response.ok) throw new Error('Unable to verify individual refunds.')
      const page = await response.json()
      if (!Array.isArray(page.data)) throw new Error('Invalid refund response.')
      refunds.push(...page.data)
      if (!page.has_more) break
      const next = page.data.at(-1)?.id
      if (!next || next === cursor || refunds.length >= 1000) throw new Error('Refund history needs manual review.')
      cursor = next
    }
    const succeeded = refunds.filter(refund => refund.status === 'succeeded')
    if (succeeded.some(refund => refund.currency !== 'usd' || refund.payment_intent !== paymentIntent || !Number.isSafeInteger(refund.amount) || refund.amount <= 0)) throw new Error('Refund details do not match the payment.')
    if (succeeded.reduce((total, refund) => total + refund.amount, 0) !== refunded || refunded > state.sale.expectedTotalCents) throw new Error('Successful refunds do not reconcile to the charge.')
    state.refunds ||= {}
    // Oldest first gives stable handling when several events arrive together.
    for (const refund of succeeded.sort((a, b) => a.created - b.created || a.id.localeCompare(b.id))) {
      let saved = state.refunds[refund.id]
      if (saved && saved.amount !== refund.amount) throw new Error('Saved refund amount changed.')
      if (saved?.reversalId) continue
      if (!saved) { saved = state.refunds[refund.id] = { amount: refund.amount, startedAt: Date.now() }; await save() }
      assertRetryWindow(saved.startedAt)
      Object.assign(saved, await reporting.recordPartialRefund(state.transactionId!, `${orderId}-${refund.id}`, refund.amount))
      await save()
    }
  })
}
