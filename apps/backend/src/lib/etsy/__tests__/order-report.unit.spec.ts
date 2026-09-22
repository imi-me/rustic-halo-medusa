import { reportWindow, summarizeEtsyReceipt } from '../order-report'

test('receipt summary includes operations data but omits buyer and address data', () => {
  const summary = summarizeEtsyReceipt({
    receipt_id: 99,
    create_timestamp: 1700000000,
    update_timestamp: 1700000060,
    status: 'paid',
    is_paid: true,
    is_shipped: false,
    name: 'Buyer Name',
    buyer_email: 'buyer@example.com',
    first_line: '123 Private Lane',
    grandtotal: { amount: 2450, divisor: 100, currency_code: 'USD' },
    transactions: [{ transaction_id: 4, listing_id: 5, title: 'Hair Claw', sku: 'RH-1-BL', quantity: 2, price: { amount: 1225, divisor: 100, currency_code: 'USD' } }],
  })
  expect(summary).toMatchObject({ receiptId: 99, paid: true, shipped: false, itemCount: 2, grandTotal: { amount: 2450, divisor: 100, currency: 'USD' } })
  expect(summary.transactions[0]).toMatchObject({ transactionId: 4, listingId: 5, sku: 'RH-1-BL', quantity: 2 })
  expect(JSON.stringify(summary)).not.toMatch(/Buyer Name|buyer@example|Private Lane/)
})

test('report window defaults to 30 days and is capped at 90', () => {
  expect(reportWindow(undefined, 1800000000)).toEqual({ days: 30, minCreated: 1797408000, maxCreated: 1800000000 })
  expect(reportWindow('90', 1800000000).days).toBe(90)
  expect(() => reportWindow('91', 1800000000)).toThrow('between 1 and 90 days')
})

test('invalid receipt identifiers and transaction quantities are rejected', () => {
  expect(() => summarizeEtsyReceipt({ receipt_id: 0 })).toThrow('invalid receipt')
  expect(() => summarizeEtsyReceipt({ receipt_id: 1, transactions: [{ transaction_id: 2, quantity: 0 }] })).toThrow('invalid receipt transaction')
})
