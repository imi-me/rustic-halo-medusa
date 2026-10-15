import { HttpTypes } from "@medusajs/types"
import { healingHeartsColors } from '@lib/brand/healing-hearts-colors'

export type ClawSize = '2' | '4'
export type ClawColor = { name: string; slug: string; hex: string; active: boolean; sizes?: ClawSize[] }
export function clawSize(value: unknown): ClawSize | undefined {
  return String(value ?? '').trim().match(/^([24])(?:\s*(?:["“”″]|in(?:ch(?:es)?)?\.?))?$/i)?.[1] as ClawSize | undefined
}
export function variantClawSize(product: HttpTypes.StoreProduct, variant: HttpTypes.StoreProductVariant): ClawSize | undefined {
  const config = hairClawTemplate(product)
  return clawSize(variant.metadata?.physical_size ?? variant.options?.find(o => o.option_id === config?.size_option_id)?.value ?? config?.unlabelled_size)
}
export function productClawColors(product: HttpTypes.StoreProduct, size?: ClawSize): ClawColor[] {
  const palette: ClawColor[] = (product.metadata?.hair_claw_palette_v1 as { colors?: ClawColor[] } | undefined)?.colors ?? healingHeartsColors.map(c => ({ ...c, active: true }))
  const settings = product.metadata?.hair_claw_colors_v1 as { excluded?: string[]; excluded_by_size?: Record<ClawSize, string[]> } | undefined
  return palette.filter(c => c.active && (size ? [size] : ['2', '4'] as ClawSize[]).some(key =>
    (!c.sizes || c.sizes.includes(key)) && !(settings?.excluded_by_size?.[key] ?? settings?.excluded ?? []).some(n => n.toLowerCase() === c.name.toLowerCase())))
}

type Template = { version: number; variant_ids: string[]; option_ids: string[]; color_option_id: string; size_option_id: string; finish_option_id?: string; offer_mode?: boolean; default_variant_id: string; option_titles?: Record<string, string>; unlabelled_size?: string }
export function hairClawTemplate(product: HttpTypes.StoreProduct) {
  const config = product.metadata?.hair_claw_template_v2 as Template | undefined
  return config?.version === 2 && Array.isArray(config.variant_ids) && Array.isArray(config.option_ids) ? config : undefined
}

// The template exposes approved purchase combinations while preserving legacy
// records for existing orders. Cart writes always use the real Medusa variant.
export function applyHairClawTemplate(product: HttpTypes.StoreProduct): HttpTypes.StoreProduct {
  const config = hairClawTemplate(product)
  if (!config) return product
  const media = product.metadata?.hair_claw_overlays_v1 as {recipes?:Record<string,{enabled?:boolean}>;offers?:Record<string,{variant_ids?:string[]}>} | undefined
  const exposedIds = config.offer_mode ? Object.entries(media?.offers || {}).flatMap(([key,offer]) => media?.recipes?.[key]?.enabled ? offer.variant_ids || [] : []) : config.variant_ids
  const ids = new Set(exposedIds), optionIds = new Set(config.option_ids)
  const variants = (product.variants || []).filter(v => {
    const size = variantClawSize(product, v)
    const available = size ? productClawColors(product, size) : productClawColors(product, '2').filter(c => productClawColors(product, '4').some(other => other.name === c.name))
    return ids.has(v.id) && available.some(c => c.name.toLowerCase() === String(v.metadata?.base_claw_color ?? v.options?.find(o => o.option_id === config.color_option_id)?.value).toLowerCase())
  }).map(v => ({ ...v, options: v.options?.filter(o => Boolean(o.option_id) && optionIds.has(o.option_id!)) || null }))
  const options = (product.options || []).filter(o => optionIds.has(o.id)).map(o => ({
    ...o,
    title: o.id === config.color_option_id ? "Color" : o.id === config.size_option_id ? "Size" : o.id === config.finish_option_id ? "Finish" : config.option_titles?.[o.id] || o.title,
    values: o.values?.filter(value => variants.some(v => v.options?.some(vo => vo.option_id === o.id && vo.value === value.value))),
  })).filter(o => Boolean(o.values?.length))
  return { ...product, options, variants }
}

export function initialProductOptions(product: HttpTypes.StoreProduct, requestedId: string | null) {
  const config = hairClawTemplate(product)
  const variant = product.variants?.find(v => v.id === requestedId) ||
    (config ? product.variants?.find(v => v.id === config.default_variant_id) : undefined) ||
    (config?.offer_mode ? product.variants?.find(v => v.options?.some(o=>o.option_id===config.color_option_id && o.value==='Taupe')) || product.variants?.[0] : undefined) ||
    (product.variants?.length === 1 ? product.variants[0] : undefined)
  if (variant) return Object.fromEntries((variant.options || []).map(o => [o.option_id, o.value])) as Record<string, string | undefined>
  return Object.fromEntries((product.options || []).filter(o => o.title?.toLowerCase() === "title" && o.values?.length === 1 && o.values[0].value === "Default Title").map(o => [o.id, o.values?.[0].value])) as Record<string, string | undefined>
}
