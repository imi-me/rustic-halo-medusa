export type RecordedTax = {
  transactionId?: string
  reversalId?: string
  sale?: { expectedTotalCents: number }
  refunds?: Record<string, { amount: number; reversalId?: string }>
}
/** Compare saved reporting references with confirmed Stripe amounts. Never repairs data. */
export function reconcileTaxRefunds(record: RecordedTax | undefined, received: number, refunded: number) {
  if (![received, refunded].every(n => Number.isSafeInteger(n) && n >= 0) || refunded > received) return { status: 'invalid_payment_amounts' }
  if (!record?.transactionId) return { status: 'missing_tax_sale', stripeRefundedCents: refunded }
  if (record.sale?.expectedTotalCents !== received) return { status: 'payment_total_mismatch' }
  if (record.reversalId && Object.keys(record.refunds || {}).length) return { status: 'conflicting_reversal_records' }
  const refunds = Object.values(record.refunds || {})
  if (refunds.some(r => !Number.isSafeInteger(r.amount) || r.amount <= 0)) return { status: 'invalid_saved_refund' }
  const recorded = record.reversalId ? received : refunds.filter(r => r.reversalId).reduce((n, r) => n + r.amount, 0)
  const status = recorded < refunded ? 'unreported_refund' : recorded > refunded ? 'recorded_refund_exceeds_stripe' : refunds.some(r => !r.reversalId) ? 'unfinished_reporting_attempt' : 'amounts_match'
  return { status, stripeRefundedCents: refunded, recordedRefundedCents: recorded, differenceCents: refunded - recorded }
}

/** Medusa keeps decimal currency amounts; compare their sum at Stripe cent precision. */
export function reconcileStoreRefunds(amounts: unknown[], stripeRefundedCents: number) {
  if (!Number.isSafeInteger(stripeRefundedCents) || stripeRefundedCents < 0 || amounts.some(a => a == null || !Number.isFinite(Number(a)) || Number(a) < 0)) return { status: 'invalid_store_refund_amounts' }
  const storeRefundedCents = Math.round(amounts.reduce<number>((sum, amount) => sum + Number(amount), 0) * 100)
  return { status: storeRefundedCents === stripeRefundedCents ? 'amounts_match' : 'store_refund_mismatch', storeRefundedCents, stripeRefundedCents }
}
