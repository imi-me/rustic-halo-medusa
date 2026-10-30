import sanitize from 'sanitize-html'
export const PRODUCT_SEO_KEY = 'storefront_seo_v1'
export type ProductSeo = { title: string; description: string }
export const emptyProductSeo = (): ProductSeo => ({ title: '', description: '' })
export function seoText(value: unknown): string {
  if (typeof value !== 'string') return ''
  const text = sanitize(value.slice(0, 50_000).replace(/<br\s*\/?\s*>|<\/(?:p|div|h[1-6]|li|tr|blockquote)>/gi, '\n'), { allowedTags: [], allowedAttributes: {} })
  // The parser decodes named/numeric entities; undo only its plain-text escaping.
  return text.replace(/&(amp|lt|gt|quot|#39);/g, (_, key: string) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }[key]!)).replace(/(^|\n)\s*(?:#{1,6}|[-*•])\s+/g, '$1').replace(/\*\*|__|`/g, '').replace(/\s+/g, ' ').trim()
}
export function shortSeoText(value: string, limit: number): string {
  const chars = Array.from(value)
  if (chars.length <= limit) return value
  const head = chars.slice(0, limit - 1).join(''), boundary = head.lastIndexOf(' ')
  return (boundary >= limit * .6 ? head.slice(0, boundary) : head).trimEnd() + '…'
}
export function readProductSeo(metadata: Record<string, unknown> | null | undefined): ProductSeo {
  const value = metadata?.[PRODUCT_SEO_KEY]
  if (!value || typeof value !== 'object' || Array.isArray(value)) return emptyProductSeo()
  const row = value as Record<string, unknown>
  return { title: typeof row.title === 'string' ? row.title : '', description: typeof row.description === 'string' ? row.description : '' }
}
export const hasProductSeo = (value?: ProductSeo) => Boolean(value?.title.trim() || value?.description.trim())
export function productSeoValues(product: { title?: unknown; description?: unknown; metadata?: Record<string, unknown> | null }): ProductSeo {
  const name = seoText(product.title) || 'Rustic Halo'
  const base = shortSeoText(name, 80)
  const automaticTitle = /\bRustic Halo\b/i.test(base) ? base : `${base} | Rustic Halo`
  const overrides = readProductSeo(product.metadata)
  return {
    title: shortSeoText(seoText(overrides.title), 100) || automaticTitle,
    description: shortSeoText(seoText(overrides.description), 320) || shortSeoText(seoText(product.description) || name, 160),
  }
}
