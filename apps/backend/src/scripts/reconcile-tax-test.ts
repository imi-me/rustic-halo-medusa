import type { ExecArgs } from '@medusajs/framework/types'
import { assertShippingTestEnvironment } from '../lib/shipping-test-environment'
import { reconcileTaxRefunds, reconcileStoreRefunds, type RecordedTax } from '../lib/tax/reconcile'

export default async function reconcileTaxTest({ container, args }: ExecArgs) {
  assertShippingTestEnvironment(process.env)
  const key = process.env.STRIPE_API_KEY || ''
  if (!key.startsWith('sk_test_')) throw Error('Sandbox Stripe key required')
  const query = container.resolve('query')
  let ids: string[]
  let nextOffset: number | null = null
  const recent = args[0] === 'recent'
  if (recent) {
    if (args.length > 2 || (args[1] !== undefined && !/^(0|[1-9][0-9]{0,5})$/.test(args[1]))) throw Error('Usage: recent [offset from 0 to 999999]')
    const offset = Number(args[1] || 0)
    const { data } = await query.graph({ entity: 'order', fields: ['id'], pagination: { skip: offset, take: 101, order: { created_at: 'DESC', id: 'DESC' } } })
    ids = data.slice(0, 100).map(order => order.id)
    if (data.length > 100) nextOffset = offset + 100
  } else {
    if (!args.length || args.length > 20 || args.some(id => !/^order_[A-Za-z0-9]+$/.test(id))) throw Error('Provide 1–20 exact order IDs or recent [offset]')
    ids = [...new Set(args)]
  }
  let discrepancies = 0
  for (const id of ids) {
    try {
      const { data: [order] } = await query.graph({ entity: 'order', filters: { id }, fields: ['id', 'metadata', 'currency_code', 'tax_total', 'payment_collections.payments.provider_id', 'payment_collections.payments.data', 'payment_collections.payments.refunds.amount'] })
      if (!order) throw Error('Missing order')
      const record = order.metadata?.stripe_tax_test_reporting as RecordedTax | undefined
      if (!record && Number(order.tax_total) === 0) { console.log(JSON.stringify({ orderId: id, status: 'no_tax_record_expected', scope: 'taxed_orders_only' })); continue }
      const payments = order.payment_collections?.flatMap(c => c?.payments || []) || []
      if (order.currency_code !== 'usd' || payments.length !== 1 || payments[0]?.provider_id !== 'pp_stripe_stripe') throw Error('Unsupported payment')
      const pi = payments[0]?.data?.id
      if (typeof pi !== 'string' || !/^pi_[A-Za-z0-9]+$/.test(pi)) throw Error('Missing payment reference')
      const response = await fetch(`https://api.stripe.com/v1/payment_intents/${pi}?expand[]=latest_charge`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000) })
      if (!response.ok) throw Error('Stripe unavailable')
      const payment = await response.json()
      if (payment.livemode !== false || payment.currency !== 'usd' || payment.status !== 'succeeded') throw Error('Expected captured test payment')
      const result = reconcileTaxRefunds(record, payment.amount_received, payment.latest_charge?.amount_refunded)
      const storeRefunds = reconcileStoreRefunds((payments[0]?.refunds || []).map(refund => refund?.amount), payment.latest_charge?.amount_refunded)
      if (result.status !== 'amounts_match' || storeRefunds.status !== 'amounts_match') discrepancies++
      console.log(JSON.stringify({ orderId: id, ...result, storeRefunds }))
    } catch { discrepancies++; console.log(JSON.stringify({ orderId: id, status: 'verification_failed', action: 'Review access and payment state; no changes made' })) }
  }
  console.log(JSON.stringify({ readOnly: true, checkedOrders: ids.length, discrepancies, selection: recent ? 'recent_orders' : 'explicit_ids', nextOffset, truncated: nextOffset !== null, scope: 'Saved tax references versus Stripe payment refund amounts; tax ledger contents not independently verified' }))
  if (discrepancies) throw Error('Tax reconciliation needs review; no records changed')
}
