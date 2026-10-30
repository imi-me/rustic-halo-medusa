type IdentityPolicy = { hair_claw_template_v2?: { color_mode?: string; variant_ids?: string[] } }
export function labelVariants<T extends { id: string }>(product: { variants?: T[]; metadata?: IdentityPolicy | null }): T[] {
  const config = product.metadata?.hair_claw_template_v2
  return (product.variants ?? []).filter(variant => config?.color_mode !== 'order' || config.variant_ids?.includes(variant.id))
}
export function retailBarcode(variant: { barcode?: string | null; upc?: string | null; ean?: string | null; metadata?: Record<string, unknown> | null }, useStoredReference: boolean): string {
  const values = [variant.barcode, variant.upc, variant.ean, ...(useStoredReference ? [variant.metadata?.source_barcode] : [])]
  return values.find((value): value is string => typeof value === 'string' && Boolean(value.trim()))?.trim() ?? ''
}
