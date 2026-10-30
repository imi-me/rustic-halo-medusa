import { createHash } from 'node:crypto'
import { itemMatch, type ItemMatches } from './order-item-matches'
import { summarizeEtsyReceipt } from './order-report'
import { historicalItemMatch, type HistoricalOrderMatch } from './historical-order-matches'
import { etsyOrderSkus } from './order-skus'

const text = (value: unknown, max = 500) => typeof value === 'string' ? value.slice(0, max) : ''
const time = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 946684800 && Number(value) < 253402300800 ? new Date(Number(value) * 1000).toISOString() : null
export type PreparationStage = 'needs_making' | 'ready_to_pack'
export type VariantIdentity = { id: string; sku?: string | null; product_id?: string | null; metadata?: any; options?: any[] }
export function summarizeWorkspaceReceipt(raw: any, variants: VariantIdentity[], historicalMatches: HistoricalOrderMatch[] = [], manualMatches: ItemMatches | null = null) {
  const summary = summarizeEtsyReceipt(raw)
  const transactions = summary.transactions.map((item, i) => {
    const source = raw.transactions[i]
    const exact = item.sku ? variants.filter(v => v.sku?.trim().toLowerCase() === item.sku!.trim().toLowerCase()) : []
    const matches = exact.length || !item.sku ? exact : variants.filter(v => etsyOrderSkus(v, source.listing_id).some(sku => sku.toLowerCase() === item.sku!.trim().toLowerCase()))
    const digital = source.is_digital === true
    const manual = !digital ? itemMatch(summary.receiptId,source,variants,manualMatches) : null
    const historical = manual ?? (!digital ? historicalItemMatch(summary.receiptId, source, variants, historicalMatches) : null)
    return { ...item, digital, shippedAt: time(source.shipped_timestamp), shipBy: time(source.expected_ship_date), variantId: manual?.manualVariantId ?? (!digital && !historical && matches.length === 1 ? matches[0].id : null), productId: historical?.productId ?? null, matchedProductTitle: historical?.matchedProductTitle ?? null, packingVariantIds: historical?.packingVariantIds ?? [], matchedGroupLabel:manual?.matchedGroupLabel??null, matchedVariantLabel:manual?.matchedVariantLabel??null, match: historical?.match ?? (digital ? 'digital' : matches.length === 1 ? 'matched' : matches.length > 1 ? 'duplicate_sku' : item.sku ? 'unmatched_sku' : 'missing_sku') }
  })
  const dates = transactions.filter(t => !t.digital).map(t => t.shipBy).filter((v): v is string => Boolean(v)).sort()
  return { ...summary, contentRevision: createHash('sha256').update(JSON.stringify(receiptDetails(raw))).digest('hex'), transactions, shipBy: dates[0] ?? null, canceled: /cancel(?:led|ed)/i.test(summary.status ?? ''), hasRefunds: Array.isArray(raw.refunds) && raw.refunds.length > 0 }
}
export type WorkspaceReceipt = ReturnType<typeof summarizeWorkspaceReceipt>
export function preparationStatus(order: WorkspaceReceipt, stage: PreparationStage) {
  if (order.canceled) return 'canceled'
  if (order.hasRefunds) return 'needs_review'
  if (order.shipped) return 'shipped'
  if (!order.paid) return 'awaiting_payment'
  if (order.transactions.some(t => !t.digital && t.shippedAt)) return 'needs_review'
  if (!order.transactions.length || order.transactions.some(t => !['matched', 'manual_variant', 'digital'].includes(t.match))) return 'needs_review'
  if (order.transactions.every(t => t.digital)) return 'digital'
  return stage
}
export function assertPreparationAllowed(order: WorkspaceReceipt) {
  const status = preparationStatus(order, 'needs_making')
  if (!['needs_making', 'ready_to_pack'].includes(status)) throw new Error('Only paid, unshipped physical orders with matched SKUs and no refunds can change preparation stage. Refresh and review this order.')
}
export function receiptDetails(raw: any) {
  const address = { name: text(raw.name, 200), line1: text(raw.first_line, 300), line2: text(raw.second_line, 300), city: text(raw.city, 150), state: text(raw.state, 150), postalCode: text(raw.zip, 40), country: text(raw.country_iso, 2).toUpperCase() }
  return {
    address,
    addressAvailable: Boolean(address.name && address.line1 && address.city && address.country && (address.postalCode || !['US', 'CA', 'GB', 'AU'].includes(address.country))),
    buyerNote: text(raw.message_from_buyer, 5000),
    giftMessage: text(raw.gift_message, 5000), giftSender: text(raw.gift_sender, 300), gift: raw.is_gift === true,
    selections: (Array.isArray(raw.transactions) ? raw.transactions as any[] : []).map((item: any) => ({ transactionId: item.transaction_id, options: Array.isArray(item.variations) ? (item.variations as any[]).slice(0, 30).map((v: any) => ({ name: text(v.formatted_name, 200), value: text(v.formatted_value, 4000) })) : [], shippingMethod: text(item.shipping_method, 300), shippingUpgrade: text(item.shipping_upgrade, 300) })),
    shipments: (Array.isArray(raw.shipments) ? raw.shipments as any[] : []).slice(0, 100).map((s: any) => ({ id: Number.isSafeInteger(s.receipt_shipping_id) ? s.receipt_shipping_id : null, carrier: text(s.carrier_name, 100), tracking: text(s.tracking_code, 200), notifiedAt: time(s.shipment_notification_timestamp) })),
  }
}
export function packingItems(order: WorkspaceReceipt) {
  if (order.canceled || order.hasRefunds) throw new Error('Review cancellation or refunds in Etsy before packing.')
  const physical = order.transactions.filter(t => !t.digital)
  if (!order.shipped && physical.some(t => t.shippedAt)) throw new Error('This order is partly shipped. Review the remaining items in Etsy before packing.')
  if (!physical.length) throw new Error('This order has no physical items to pack.')
  if (physical.some(t => ['historical_product','manual_product'].includes(t.match) ? !t.productId || !t.packingVariantIds.length : !['matched','manual_variant'].includes(t.match) || !t.variantId)) throw new Error('Every physical item must match exactly one saved SKU before suggesting boxes. Review missing or duplicate SKUs.')
  return physical.map(t => ['historical_product','manual_product'].includes(t.match) ? { packing_product_id: t.productId!, packing_variant_ids: t.packingVariantIds, legacy_sku: t.match==='historical_product'?t.sku!:undefined, quantity: t.quantity } : { variant_id: t.variantId!, quantity: t.quantity })
}
export function safeWorkspaceError(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  return /^Etsy (?:order|orders|refresh) (?:read |unavailable )?\(HTTP \d{3}\)\.$/.test(message) ? message : 'Etsy orders could not be refreshed. Check the connection and retry; saved orders are kept.'
}
