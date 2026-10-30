/** Reviewed channel identities, scoped to an existing listing. Never infer them from SKU suffixes. */
export function etsyOrderSkus(variant: any, listingId: unknown): string[] {
  const id = Number(listingId)
  if (!Number.isSafeInteger(id) || id < 1) return []
  const links = variant.metadata?.etsy_order_skus_v1
  if (!Array.isArray(links)) return []
  return links.filter(link => link?.listing_id === id && typeof link.sku === 'string' && link.sku.trim()).map(link => link.sku.trim())
}
export function etsyOrderSku(variant: any, listingId: unknown) {
  const skus = [...new Set(etsyOrderSkus(variant, listingId))]
  if (skus.length > 1) throw Error('Review the original Etsy size/finish SKU mapping.')
  return skus[0]
}
