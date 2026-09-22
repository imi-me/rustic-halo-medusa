import { reconcileTaxRefunds as check } from '../reconcile'
const sale = { transactionId: 'tax_test', sale: { expectedTotalCents: 2169 } }
test('detects dashboard refund missing from saved records', () => expect(check(sale,2169,500).status).toBe('unreported_refund'))
test('accepts recorded partial refund', () => expect(check({...sale,refunds:{r:{amount:500,reversalId:'rev'}}},2169,500).status).toBe('amounts_match'))
test('accepts full reversal', () => expect(check({...sale,reversalId:'rev'},2169,2169).status).toBe('amounts_match'))
test('flags missing sale and incomplete attempts', () => { expect(check(undefined,2169,0).status).toBe('missing_tax_sale');expect(check({...sale,refunds:{r:{amount:500}}},2169,500).status).toBe('unreported_refund') })
test('rejects invalid totals and overreporting', () => { expect(check(sale,2169,NaN).status).toBe('invalid_payment_amounts');expect(check({...sale,reversalId:'rev'},2169,500).status).toBe('recorded_refund_exceeds_stripe') })
test('flags conflicting and mismatched records', () => { expect(check({...sale,reversalId:'rev',refunds:{r:{amount:500,reversalId:'rev2'}}},2169,2169).status).toBe('conflicting_reversal_records');expect(check(sale,3000,0).status).toBe('payment_total_mismatch') })

import { reconcileStoreRefunds } from '../reconcile'
test('flags external refund missing in store despite tax recovery',()=>expect(reconcileStoreRefunds([],2169).status).toBe('store_refund_mismatch'))
test('compares internal fractional cents at payment precision',()=>expect(reconcileStoreRefunds([5,16.6889],2169).status).toBe('amounts_match'))
test('rejects invalid internal amounts',()=>expect(reconcileStoreRefunds([undefined],2169).status).toBe('invalid_store_refund_amounts'))
