import { clawSize, clawVariantGroupKey, variantClawSize, clawColorAvailable, type ClawColor } from './hair-claw-colors'

export type ClawOrderChoice = { size: '2' | '4'; finish?: string; options: { option_id: string; value: string }[]; aliases: string[] }
export const usesClawOrderColors = (product: any) => product?.metadata?.hair_claw_template_v2?.color_mode === 'order'
export function orderChoiceVariant(product: any, variant: any) {
  const choice: ClawOrderChoice | undefined = product.metadata?.hair_claw_template_v2?.order_choices?.[variant.id]
  return choice ? { ...variant, options: choice.options, metadata: { ...variant.metadata, physical_size: choice.size, ...(choice.finish ? { claw_finish: choice.finish } : {}) } } : variant
}
export function orderChoiceColors(product: any, variant: any, palette: ClawColor[]) {
  const normalized = orderChoiceVariant(product, variant)
  return palette.filter(color => clawColorAvailable(product, { ...normalized, metadata: { ...normalized.metadata, base_claw_color: color.name } }, [color]))
}
const generated = (variant: any) => Boolean(variant.metadata?.hair_claw_template || variant.metadata?.claw_palette_offer || /^RH-HC[23C]-/.test(variant.sku ?? ''))
const priceShape = (variant: any) => JSON.stringify((variant.price_set?.prices ?? variant.prices ?? []).filter((p: any) => !p.price_list_id).map((p: any) => ({ currency: p.currency_code, amount: Number(p.amount), min: p.min_quantity ?? null, max: p.max_quantity ?? null, rules: p.price_rules ?? p.rules ?? [] })).sort((a: any,b: any) => JSON.stringify(a).localeCompare(JSON.stringify(b))))

/** Restore existing catalog identities through explicit provenance. Never infer an identity from a SKU suffix. */
export function planClawOrderChoices(product: any) {
  if (usesClawOrderColors(product)) return { metadata: product.metadata, retained: product.metadata.hair_claw_template_v2.variant_ids, retired: [], current: true }
  const config = product.metadata?.hair_claw_template_v2
  const variants: any[] = [...(product.variants ?? [])].sort((a,b)=>a.id.localeCompare(b.id)), options: any[] = [...(product.options ?? [])].sort((a,b)=>a.id.localeCompare(b.id))
  const sourceIds = new Set(variants.map(v => v.metadata?.source_variant_id).filter(Boolean))
  const originals = variants.filter(v => !generated(v) && (v.metadata?.inventory_mode !== 'made_to_order_color_option' || sourceIds.has(v.id)))
  if (!originals.length) throw Error('The original catalog SKU could not be confirmed. Review its source mapping; no identifiers were changed.')
  const byId = new Map(variants.map(v => [v.id, v]))
  const colorId = config?.color_option_id ?? options.find(o => /^(?:base )?colou?r$/i.test(o.title) && o.metadata?.purpose === 'base_claw_color')?.id
  const choices: Record<string, ClawOrderChoice> = {}
  const approved = new Set(config?.variant_ids ?? [])
  const groups = new Map<string, any[]>()
  for (const v of variants.filter(v => approved.has(v.id))) {
    const key = clawVariantGroupKey(product, v)
    groups.set(key, [...(groups.get(key) ?? []), v])
  }
  const resolveOriginal = (v: any, seen = new Set<string>()): any => {
    if (!v || seen.has(v.id)) return undefined
    if (originals.some(o => o.id === v.id)) return v
    seen.add(v.id)
    if (v.metadata?.source_variant_id) return resolveOriginal(byId.get(v.metadata.source_variant_id), seen)
    if (v.metadata?.base_sku) {
      const matches = originals.filter(o => o.sku === v.metadata.base_sku)
      if (matches.length === 1) return matches[0]
    }
  }
  for (const group of groups.values()) {
    const sources = [...new Set(group.map(v => resolveOriginal(v)?.id).filter(Boolean))]
    // Early single-variant imports did not save source_variant_id. A sole imported
    // identity plus one confirmed physical size is unambiguous; multiple offers still require provenance.
    const descriptionSizes = [...String(product.description ?? '').matchAll(/\b([24])(?:-|\s*)inch/gi)].map(m=>m[1])
    if (!sources.length && groups.size===1 && originals.length===1 && originals[0].metadata?.shopify_variant_id && new Set(descriptionSizes).size===1 && descriptionSizes[0]===variantClawSize(product,group[0])) sources.push(originals[0].id)
    if (sources.length !== 1) throw Error('A size/finish group has no unique original catalog mapping. Review before simplifying.')
    const source = byId.get(sources[0])!, sample = group[0]
    if (!source.sku?.trim()) throw Error('Restore the original SKU before simplifying this design.')
    if (group.some(v => priceShape(v) !== priceShape(source))) throw Error('Original and color prices differ. Review the intended size/finish price before simplifying.')
    const size = variantClawSize(product, sample)
    if (!size) throw Error('Confirm the actual physical size before simplifying this design.')
    const shown = (sample.options ?? []).filter((o: any) => config.option_ids.includes(o.option_id) && o.option_id !== colorId).map((o: any) => ({ option_id: o.option_id, value: o.value })).sort((a:any,b:any)=>a.option_id.localeCompare(b.option_id))
    const finishValue = shown.find((o:any) => /finish/i.test(config.option_titles?.[o.option_id] ?? options.find(p => p.id === o.option_id)?.title ?? ''))?.value
    const finish = sample.metadata?.claw_finish ?? (finishValue === 'Colors by Cate' ? 'cbc' : finishValue === 'Natural' ? 'natural' : finishValue)
    const choice = { size, ...(finish ? { finish } : {}), options: shown, aliases: group.map(v => v.id) }
    if (choices[source.id] && JSON.stringify(choices[source.id].options) !== JSON.stringify(shown)) throw Error('Several size/finish offers share one original variant. Confirm which offers are actually sold.')
    choices[source.id] = choice
  }
  // Products without a generated template use their actual catalog variants, never a size/finish cross product.
  if (!config) for (const source of originals) {
    if (!source.sku?.trim()) throw Error('Restore the original SKU before simplifying this design.')
    const sizeOption = source.options?.find((o: any) => /size/i.test(options.find(p => p.id === o.option_id)?.title ?? ''))
    const descriptionSizes = [...String(product.description ?? '').matchAll(/\b([24])(?:-|\s*)inch/gi)].map(m => m[1])
    const size = clawSize(source.metadata?.physical_size) ?? clawSize(sizeOption?.value) ?? (new Set(descriptionSizes).size === 1 ? descriptionSizes[0] as '2' | '4' : undefined)
    if (!size) throw Error('Confirm the actual physical size before simplifying this design.')
    choices[source.id] = { size, ...(source.metadata?.claw_finish ? {finish:source.metadata.claw_finish} : {}), options: (source.options ?? []).filter((o: any) => o.option_id !== colorId).map((o: any) => ({ option_id: o.option_id, value: o.value })).sort((a:any,b:any)=>a.option_id.localeCompare(b.option_id)), aliases: [] }
  }
  if (!Object.keys(choices).length) throw Error('No confirmed existing size/finish offers were found.')
  const retained = Object.keys(choices), retired = variants.filter(v => !retained.includes(v.id)).map(v => v.id)
  for (const sourceId of retained) {
    const source = byId.get(sourceId)!
    for (const variant of variants) if (variant.id !== sourceId && !generated(variant) && variant.metadata?.base_sku && variant.metadata.base_sku === source.metadata?.base_sku) choices[sourceId].aliases = [...new Set([...choices[sourceId].aliases, variant.id])]
  }
  const optionIds = [...new Set(Object.values(choices).flatMap(c => c.options.map(o => o.option_id)))]
  const oldDefault = config?.default_variant_id
  const nextConfig = { ...config, size_option_id:config?.size_option_id ?? options.find(o=>/^(?:claw )?size$/i.test(o.title))?.id, finish_option_id:config?.finish_option_id ?? options.find(o=>/finish/i.test(o.title))?.id, version: 2, color_mode: 'order', order_choices: choices, variant_ids: retained, option_ids: optionIds, color_option_id: colorId, default_variant_id: retained.find(id => id === oldDefault || choices[id].aliases.includes(oldDefault)) ?? retained[0] }
  return { retained, retired, current: false, metadata: { ...product.metadata, hair_claw_template_v2: nextConfig, hair_claw_identity_archive_v1: { template: config ?? null, retired_variant_ids: retired } } }
}
