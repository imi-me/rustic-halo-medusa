import { HttpTypes } from "@medusajs/types"

type Template = { version: number; variant_ids: string[]; option_ids: string[]; color_option_id: string; size_option_id: string; default_variant_id: string; option_titles?: Record<string, string> }
export function hairClawTemplate(product: HttpTypes.StoreProduct) {
  const config = product.metadata?.hair_claw_template_v2 as Template | undefined
  return config?.version === 2 && Array.isArray(config.variant_ids) && Array.isArray(config.option_ids) ? config : undefined
}

// The template exposes approved purchase combinations while preserving legacy
// records for existing orders. Cart writes always use the real Medusa variant.
export function applyHairClawTemplate(product: HttpTypes.StoreProduct): HttpTypes.StoreProduct {
  const config = hairClawTemplate(product)
  if (!config) return product
  const ids = new Set(config.variant_ids), optionIds = new Set(config.option_ids)
  const variants = (product.variants || []).filter(v => ids.has(v.id)).map(v => ({ ...v, options: v.options?.filter(o => Boolean(o.option_id) && optionIds.has(o.option_id!)) || null }))
  const options = (product.options || []).filter(o => optionIds.has(o.id)).map(o => ({
    ...o,
    title: o.id === config.color_option_id ? "Color" : o.id === config.size_option_id ? "Size" : config.option_titles?.[o.id] || o.title,
    values: o.values?.filter(value => variants.some(v => v.options?.some(vo => vo.option_id === o.id && vo.value === value.value))),
  }))
  return { ...product, options, variants }
}

export function initialProductOptions(product: HttpTypes.StoreProduct, requestedId: string | null) {
  const config = hairClawTemplate(product)
  const variant = product.variants?.find(v => v.id === requestedId) ||
    (config ? product.variants?.find(v => v.id === config.default_variant_id) : undefined) ||
    (product.variants?.length === 1 ? product.variants[0] : undefined)
  if (variant) return Object.fromEntries((variant.options || []).map(o => [o.option_id, o.value])) as Record<string, string | undefined>
  return Object.fromEntries((product.options || []).filter(o => o.title?.toLowerCase() === "title" && o.values?.length === 1 && o.values[0].value === "Default Title").map(o => [o.id, o.values?.[0].value])) as Record<string, string | undefined>
}
