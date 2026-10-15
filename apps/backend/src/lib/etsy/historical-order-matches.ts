import { createHash } from 'node:crypto'
import { z } from 'zod'
import { assignmentSchema, SHIPPING_KEY } from '../shipping-packages'
const positiveId = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
export const historicalMatchesSchema = z.object({
  version: z.literal(1), revision: z.string().uuid(),
  links: z.array(z.object({ receiptId: positiveId, transactionId: positiveId, listingId: positiveId, etsyProductId: positiveId, sku: z.string().min(1).max(100), productId: z.string().startsWith('prod_'), productTitle: z.string().min(1).max(300), originalVariantId: z.string().startsWith('variant_'), packingVariantIds: z.array(z.string().startsWith('variant_')).min(1).max(100), sourceFingerprint: z.string().regex(/^[a-f0-9]{64}$/), evidence: z.string().min(1).max(500) }).strict()).max(1000),
}).strict().superRefine((value, context) => {
  const keys = value.links.map(row => `${row.receiptId}:${row.transactionId}`)
  if (new Set(keys).size !== keys.length) context.addIssue({ code: 'custom', message: 'Historical order matches must be unique per receipt and transaction.' })
  for (const row of value.links) if (new Set(row.packingVariantIds).size !== row.packingVariantIds.length || !row.packingVariantIds.includes(row.originalVariantId)) context.addIssue({ code: 'custom', message: 'Packing references must be unique and include the original audited variant.' })
})
export type HistoricalOrderMatch = z.infer<typeof historicalMatchesSchema>['links'][number]
export const historicalMatchesKey = (shop: number) => `etsy-order-matches:${shop}`
export async function readHistoricalMatches(operations: any, shop: number) {
  const [saved] = await operations.listAdminOperations({ operation_key: historicalMatchesKey(shop) })
  return saved ? historicalMatchesSchema.parse(saved.payload).links : []
}
export function historicalTransactionFingerprint(receiptId: number, transaction: any) {
  const options = (Array.isArray(transaction.variations) ? transaction.variations as any[] : []).map(v => [v.property_id ?? null, v.value_id ?? null, v.formatted_name ?? '', v.formatted_value ?? '']).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  return createHash('sha256').update(JSON.stringify([receiptId, transaction.transaction_id, transaction.listing_id, transaction.product_id, String(transaction.sku ?? '').trim().toLowerCase(), transaction.quantity, options])).digest('hex')
}
export function historicalItemMatch(receiptId: number, transaction: any, variants: Array<{ id: string; sku?: string | null; product_id?: string | null; metadata?: any }>, links: HistoricalOrderMatch[]) {
  const relevant = links.filter(row => row.receiptId === receiptId && row.transactionId === transaction.transaction_id)
  if (!relevant.length) return null
  const invalid = { match: 'historical_review', productId: null, matchedProductTitle: null, packingVariantIds: [] as string[] }
  if (relevant.length !== 1) return invalid
  const link = relevant[0]
  if (link.listingId !== transaction.listing_id || link.etsyProductId !== transaction.product_id || link.sku.trim().toLowerCase() !== String(transaction.sku ?? '').trim().toLowerCase() || historicalTransactionFingerprint(receiptId, transaction) !== link.sourceFingerprint) return invalid
  const references = link.packingVariantIds.map(id => variants.find(v => v.id === id))
  if (references.some(v => !v || v.product_id !== link.productId || String(v.metadata?.base_sku ?? '').trim().toLowerCase() !== link.sku.trim().toLowerCase())) return invalid
  return { match: 'historical_product', productId: link.productId, matchedProductTitle: link.productTitle, packingVariantIds: link.packingVariantIds }
}
export async function resolveHistoricalPacking(items: any[], products: any) {
  const resolved: { variant_id: string; quantity: number }[] = []
  for (const item of items) {
    if (!item.packing_variant_ids) { resolved.push(item); continue }
    const ids: string[] = item.packing_variant_ids
    if (!ids.length || ids.length > 100 || new Set(ids).size !== ids.length) throw new Error('Historical packing references need review.')
    const candidates: any[] = await products.listProductVariants({ id: ids }, { relations: ['product'], take: 100 })
    if (candidates.length !== ids.length || ids.some(id => !candidates.some(v => v.id === id))) throw new Error('A historical packing reference is missing. Review the product match.')
    const fingerprints = candidates.map(variant => {
      const product = variant.product
      if (product?.id !== item.packing_product_id || String(variant.metadata?.base_sku ?? '').trim().toLowerCase() !== String(item.legacy_sku).trim().toLowerCase()) throw new Error('Historical packing references no longer match the approved product and size.')
      const override = variant.metadata?.[SHIPPING_KEY] ? assignmentSchema.parse(variant.metadata[SHIPPING_KEY]) : null
      const assigned = product.metadata?.[SHIPPING_KEY] ? assignmentSchema.parse(product.metadata[SHIPPING_KEY]) : null
      const assignment = override?.package_id ? override : assigned
      const weight = Number(variant.weight)
      if (!assignment?.package_id || !Number.isFinite(weight) || weight <= 0) throw new Error('Historical products need confirmed package and item weight settings.')
      return JSON.stringify([product.id, assignment.package_id, assignment.units_per_box, assignment.ships_alone, assignment.packing_group, weight])
    })
    if (new Set(fingerprints).size !== 1) throw new Error('This historical product has different shipping settings across colors. Review its packing match before suggesting boxes.')
    // Every approved candidate has identical shipping settings. This reference is
    // used only by the packing calculator; it is never the purchased color/variant.
    resolved.push({ variant_id: candidates[0].id, quantity: item.quantity })
  }
  return resolved
}
