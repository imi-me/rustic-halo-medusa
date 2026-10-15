import type { ProductDraft } from './inline-edit'
import { baseRow } from './product-prices'
export function changeClawGroupPrice(draft: ProductDraft, ids: Set<string>, currency: string, amount: string): ProductDraft {
  return { ...draft, variants: draft.variants.map(variant => {
    if (!ids.has(variant.id)) return variant
    const rows = variant.priceRows.filter(price => baseRow(price) && price.currency_code === currency)
    if (rows.length !== 1) throw Error('Review each variant’s base price before using group pricing.')
    return { ...variant, prices: { ...variant.prices, [rows[0].key]: amount } }
  }) }
}
