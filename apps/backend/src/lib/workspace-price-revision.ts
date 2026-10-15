// A shared client/server snapshot closes the gap between a price-only update
// and the product's independent updated_at timestamp.
export function workspacePriceRevision(product: any) {
  const date = (value: any) => value == null ? null : new Date(value).toISOString()
  return JSON.stringify((product.variants ?? []).map((variant: any) => ({
    id: variant.id, updated_at: date(variant.updated_at),
    prices: (variant.prices ?? variant.price_set?.prices ?? []).filter((price: any) => !price.price_list_id).map((price: any) => ({
      id: price.id, amount: Number(price.amount), updated_at: date(price.updated_at), currency_code: price.currency_code,
      min_quantity: price.min_quantity ?? null, max_quantity: price.max_quantity ?? null,
      rules: Object.entries(price.rules ?? Object.fromEntries((price.price_rules ?? []).map((rule: any) => [rule.attribute, rule.value]))).sort(([a], [b]) => a.localeCompare(b)),
    })).sort((a: any, b: any) => a.id.localeCompare(b.id)),
  })).sort((a: any, b: any) => a.id.localeCompare(b.id)))
}
