import { z } from 'zod'
import { usesClawOrderColors, orderChoiceVariant, orderChoiceColors } from './hair-claw-order-choices'
import { defaultClawColors, clawColorAvailable, type ClawColor } from './hair-claw-colors'

export const ETSY_DRAFT_KEY = 'etsy_listing_draft_v1'
export const etsyDraftSchema = z
  .object({
    listing_id: z
      .string()
      .regex(/^$|^[1-9][0-9]{0,15}$/)
      .default(''),
    title: z.string().max(140).default(''),
    description: z.string().max(10000).default(''),
    tags: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(20)
          .regex(/^[\p{L}\p{N}][\p{L}\p{N}\s'’\-]*$/u),
      )
      .max(13)
      .default([]),
    materials: z.array(z.string().trim().min(1).max(45)).max(13).default([]),
    category: z.string().max(200).default(''),
    attributes: z.string().max(2000).default(''),
    existing_finish: z.string().max(100).default(''),
    colors: z
      .array(
        z
          .object({
            variant_id: z.string().min(1).max(100),
        etsy_sku: z.string().trim().max(100).optional(),
            quantity: z.number().int().min(0).max(999),
            image_url: z.string().url().max(2000).or(z.literal('')),
          })
          .strict(),
      )
      .max(400)
      .default([]),
  })
  .strict()
  .refine(
    (value) => new Set(value.tags.map((tag) => tag.toLocaleLowerCase())).size === value.tags.length,
    'Remove duplicate Etsy tags.',
  )
  .refine(
    (value) => new Set(value.colors.map((color) => color.variant_id)).size === value.colors.length,
    'Each color variant can be shared once.',
  )
export type EtsyDraft = z.infer<typeof etsyDraftSchema>
export const emptyEtsyDraft = (): EtsyDraft => ({
  listing_id: '',
  title: '',
  description: '',
  tags: [],
  materials: [],
  category: '',
  attributes: '',
  existing_finish: '',
  colors: [],
})
export function isHairClaw(product: any) {
  const type = product?.type?.value
  if (typeof type === 'string' && type.trim()) return /^hair[ -]?claws?$/i.test(type.trim())
  if (product?.metadata?.hair_claw_template_v2) return true
  const source = product?.metadata?.source_product_type
  if (typeof source === 'string' && source.trim()) return /^hair[ -]?claws?$/i.test(source.trim())
  return Boolean(
    product?.metadata?.hair_claw_template_v2 ||
    /^rustic_halo_hair_claw_v[1-3]$/.test(product?.metadata?.product_template ?? ''),
  )
}
export function searchReadiness(draft: EtsyDraft) {
  const checks = [
    {
      ok: Boolean(draft.title.trim()),
      text: 'Use a clear title that states the item and its main traits.',
    },
    { ok: draft.tags.length === 13, text: `Use all 13 relevant tags (${draft.tags.length}/13).` },
    {
      ok: new Set(draft.tags.map((tag) => tag.toLowerCase())).size === draft.tags.length,
      text: 'Remove duplicate tags.',
    },
    {
      ok: draft.tags.every((tag) => tag.length <= 20),
      text: 'Keep every tag within 20 characters.',
    },
    {
      ok: Boolean(draft.description.trim()),
      text: 'Describe the actual product clearly and naturally.',
    },
    {
      ok: Boolean(draft.category.trim()),
      text: 'Choose a specific Etsy category in Shop Manager.',
    },
    {
      ok: Boolean(draft.attributes.trim()),
      text: 'Complete relevant Etsy attributes; avoid wasting tags on identical attribute phrases.',
    },
  ]
  return checks
}
export function visibleProductVariants(product: any, palette?: ClawColor[]): any[] {
  const config = product?.metadata?.hair_claw_template_v2
  const media = product?.metadata?.hair_claw_overlays_v1
  const ids = config?.color_mode === 'order' ? config.variant_ids : config?.offer_mode
    ? Object.entries(media?.offers ?? {}).flatMap(([key, value]: [string, any]) =>
        media?.recipes?.[key]?.enabled ? (value.variant_ids ?? []) : [],
      )
    : config?.variant_ids
  return (product?.variants ?? []).filter((variant: any) => (!ids || ids.includes(variant.id)) && (usesClawOrderColors(product) ? orderChoiceColors(product, variant, palette ?? product.metadata?.hair_claw_palette_v1?.colors ?? defaultClawColors).length > 0 : clawColorAvailable(product, variant, palette ?? product.metadata?.hair_claw_palette_v1?.colors)))
}
export function sellableColorVariants(product: any): any[] {
  if (usesClawOrderColors(product)) return visibleProductVariants(product).flatMap(original => {
    const variant = orderChoiceVariant(product, original)
    return orderChoiceColors(product, variant, product.metadata?.hair_claw_palette_v1?.colors ?? defaultClawColors).map(color => ({
      ...variant, id: `${variant.id}:${color.slug}`, title: `${variant.title} / ${color.name}`,
      metadata: { ...variant.metadata, order_variant_id: original.id, base_claw_color: color.name, inventory_mode: 'made_to_order_color_option' },
    }))
  })
  return visibleProductVariants(product).filter(
    (variant: any) =>
      variant.metadata?.base_claw_color ||
      variant.options?.some((option: any) =>
        /colou?r/i.test(
          option.option?.title ??
            product.options?.find((row: any) => row.id === option.option_id)?.title ??
            '',
        ),
      ),
  )
}
export function colorExport(product: any, draft: EtsyDraft) {
  if (!isHairClaw(product) && draft.colors.length)
    throw new Error('Color sharing is only available for hair-claw products.')
  const variants = draft.colors.map((selected) => {
    const variant = sellableColorVariants(product).find(
      (row: any) => row.id === selected.variant_id,
    )
    if (!variant?.sku) throw new Error('Each selected color needs a saved variant and SKU.')
    const options = Object.fromEntries(
      (variant.options ?? []).map((row: any) => [
        row.option?.title ??
          product.options?.find((option: any) => option.id === row.option_id)?.title,
        row.value,
      ]),
    )
    if (usesClawOrderColors(product)) {
      options.Color = variant.metadata.base_claw_color
      if (!Object.keys(options).some(name => /size/i.test(name))) options.Size = `${variant.metadata.physical_size} inch`
      if (variant.metadata.claw_finish && !Object.keys(options).some(name => /finish/i.test(name))) options.Finish = variant.metadata.claw_finish === 'cbc' ? 'Colors by Cate' : variant.metadata.claw_finish === 'natural' ? 'Natural' : variant.metadata.claw_finish
    }
    const color =
      variant.metadata?.base_claw_color ??
      Object.entries(options).find(([key]) => /color|colour/i.test(key))?.[1]
    if (!color) throw new Error('Choose saved purchasable color variants, not preview swatches.')
    const prices = variant.prices ?? variant.price_set?.prices ?? []
    const price = prices.find(
      (row: any) =>
        row.currency_code === 'usd' &&
        !row.price_list_id &&
        !row.price_rules?.length &&
        !row.rules?.length &&
        (!row.rules || !Object.keys(row.rules).length) &&
        row.min_quantity == null &&
        row.max_quantity == null,
    )
    if (!price || !Number.isFinite(Number(price.amount)))
      throw new Error('Each selected color needs an unambiguous base USD price.')
    if (
      selected.image_url &&
      !product.images?.some((image: any) => image.url === selected.image_url)
    )
      throw new Error('Choose a saved approved product image for the color.')
    return {
      variant_id: variant.metadata?.order_variant_id ?? variant.id,
      color_mode: usesClawOrderColors(product) ? 'order' : 'variant',
      sku: variant.sku,
      etsy_sku: usesClawOrderColors(product) ? variant.sku : selected.etsy_sku || variant.sku,
      color,
      options,
      price: Number(price.amount),
      currency: 'USD',
      quantity: selected.quantity,
      image_url: selected.image_url,
      inventory_mode: variant.metadata?.inventory_mode ?? 'stocked',
    }
  })
  if (!usesClawOrderColors(product) && new Set(variants.map((row) => row.etsy_sku)).size !== variants.length)
    throw new Error('Color SKUs must be unique.')
  return {
    version: 1,
    product_id: product.id,
    listing_id: draft.listing_id || null,
    title: draft.title,
    description: draft.description,
    tags: draft.tags,
    materials: draft.materials,
    variants,
    note: 'Explicit Etsy allocations only. Does not copy or multiply pooled location stock. Images are approved static product images; preview-only swatches are excluded.',
  }
}
