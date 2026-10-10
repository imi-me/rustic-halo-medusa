export type SearchProduct = {
  id: string
  title: string
  thumbnail?: string | null
  variants?: Array<{ sku?: string | null; barcode?: string | null; ean?: string | null; upc?: string | null }>
}

// Display the matching variant's identifier, rather than always the first SKU.
export const productSearchDetail = (product: SearchProduct, query: string) => {
  const term = query.trim().toLocaleLowerCase()
  for (const variant of product.variants ?? []) {
    for (const [label, value] of [['SKU', variant.sku], ['Barcode', variant.barcode], ['EAN', variant.ean], ['UPC', variant.upc]]) {
      if (value && term && value.toLocaleLowerCase().includes(term)) return `${label}: ${value}`
    }
  }
  const sku = product.variants?.find(variant => variant.sku)?.sku
  return sku ? `SKU: ${sku}` : 'Product'
}

export const productSearchParams = (query: string) => new URLSearchParams({
  q: query.trim(), limit: '8', is_giftcard: 'false',
  fields: 'id,title,thumbnail,variants.id,variants.sku,variants.barcode,variants.ean,variants.upc',
})
