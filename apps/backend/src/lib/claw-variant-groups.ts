import { usesClawOrderColors, orderChoiceVariant } from './hair-claw-order-choices'
import { clawVariantGroupKey, variantClawSize } from './hair-claw-colors'

export function clawVariantGroups(product: any): {key:string;label:string;size?:'2'|'4';offered:boolean;variants:any[]}[] {
  const config = product.metadata?.hair_claw_template_v2
  if (!config) return []
  if (usesClawOrderColors(product)) return (product.variants ?? []).filter((v:any)=>config.variant_ids.includes(v.id)).map((original:any)=>{
    const variant=orderChoiceVariant(product,original),size=variantClawSize(product,variant)
    const labels=variant.options.filter((o:any)=>o.option_id!==config.size_option_id).map((o:any)=>o.value)
    return {key:clawVariantGroupKey(product,variant),label:`${size}-inch · ${labels.join(' · ') || 'Standard finish'}`,size,offered:true,variants:[variant]}
  })
  const ids = new Set<string>(config.variant_ids ?? [])
  if (config.offer_mode) for (const offer of Object.values(product.metadata?.hair_claw_overlays_v1?.offers ?? {}) as any[]) for (const id of offer.variant_ids ?? []) ids.add(id)
  const media = product.metadata?.hair_claw_overlays_v1
  const active = new Set<string>(config.offer_mode ? Object.entries(media?.offers ?? {}).flatMap(([key, offer]: [string, any]) => media?.recipes?.[key]?.enabled ? offer.variant_ids ?? [] : []) : config.variant_ids)
  const groups = new Map<string, { key: string; label: string; size?: '2' | '4'; offered: boolean; variants: any[] }>()
  for (const variant of product.variants ?? []) {
    if (!ids.has(variant.id)) continue
    const key = clawVariantGroupKey(product, variant), size = variantClawSize(product, variant)
    const values = (variant.options ?? []).filter((o: any) => config.option_ids?.includes(o.option_id) && ![config.size_option_id, config.color_option_id].includes(o.option_id)).map((o: any) => o.value)
    const label = `${size ? size + '-inch' : 'Size unconfirmed'} · ${values.join(' · ') || 'Standard finish'}`
    const group = groups.get(key) ?? { key, label, size, offered: false, variants: [] }
    group.variants.push(variant); group.offered ||= Boolean(active?.has(variant.id)); groups.set(key, group)
  }
  return [...groups.values()].sort((a, b) => Number(b.offered) - Number(a.offered) || a.label.localeCompare(b.label))
}
