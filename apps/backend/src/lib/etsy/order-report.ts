type EtsyMoney = { amount?: unknown, divisor?: unknown, currency_code?: unknown }

const positiveInteger = (value: unknown) => Number.isSafeInteger(value) && (value as number) > 0 ? value as number : null
const timestamp = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 946684800
  ? new Date((value as number) * 1000).toISOString()
  : null
const text = (value: unknown, maximum = 300) => typeof value === 'string' && value.length <= maximum ? value : null

function money(value: unknown) {
  if (!value || typeof value !== 'object') return null
  const input = value as EtsyMoney
  if (!Number.isSafeInteger(input.amount) || !Number.isSafeInteger(input.divisor) || (input.divisor as number) < 1 ||
      typeof input.currency_code !== 'string' || !/^[A-Z]{3}$/.test(input.currency_code)) return null
  return { amount: input.amount as number, divisor: input.divisor as number, currency: input.currency_code }
}

export type EtsyOrderReportRow = ReturnType<typeof summarizeEtsyReceipt>

export function summarizeEtsyReceipt(value: unknown) {
  if (!value || typeof value !== 'object') throw new Error('Etsy returned an invalid receipt.')
  const receipt = value as Record<string, unknown>
  const receiptId = positiveInteger(receipt.receipt_id)
  if (!receiptId) throw new Error('Etsy returned an invalid receipt.')
  const transactions = Array.isArray(receipt.transactions) ? receipt.transactions.map((entry) => {
    if (!entry || typeof entry !== 'object') throw new Error('Etsy returned an invalid receipt transaction.')
    const transaction = entry as Record<string, unknown>
    const transactionId = positiveInteger(transaction.transaction_id)
    const quantity = positiveInteger(transaction.quantity)
    if (!transactionId || !quantity) throw new Error('Etsy returned an invalid receipt transaction.')
    return {
      transactionId,
      listingId: positiveInteger(transaction.listing_id),
      title: text(transaction.title),
      sku: text(transaction.sku, 100),
      quantity,
      price: money(transaction.price),
    }
  }) : []
  return {
    receiptId,
    createdAt: timestamp(receipt.create_timestamp ?? receipt.created_timestamp),
    updatedAt: timestamp(receipt.update_timestamp ?? receipt.updated_timestamp),
    status: text(receipt.status, 50),
    paid: receipt.is_paid === true,
    shipped: receipt.is_shipped === true,
    grandTotal: money(receipt.grandtotal),
    itemCount: transactions.reduce((total, item) => total + item.quantity, 0),
    transactions,
  }
}

export function reportWindow(daysValue: unknown, nowSeconds = Math.floor(Date.now() / 1000)) {
  const supplied = Array.isArray(daysValue) ? daysValue[0] : daysValue
  const days = supplied === undefined ? 30 : Number(supplied)
  if (!Number.isSafeInteger(days) || days < 1 || days > 90) throw new Error('Order report range must be between 1 and 90 days.')
  return { days, minCreated: nowSeconds - days * 86400, maxCreated: nowSeconds }
}
