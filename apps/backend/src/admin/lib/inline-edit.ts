import { priceRows, pricePayload, type PriceRow } from './product-prices'
import { emptyEtsyDraft, etsyDraftSchema, ETSY_DRAFT_KEY, type EtsyDraft } from '../../lib/product-admin'
import { adminFetch } from './admin-fetch'
export type Entity = Record<string, any>
export type Price = { id: string; amount: number; currency_code: string; min_quantity?: number | null; max_quantity?: number | null; rules?: Record<string, string> }
export type ProductDraft = {
  etsy: EtsyDraft
  images: Array<{ key: string; id?: string; url: string }>
  thumbnail: string
  fields: Record<string, string | boolean>
  relations: Record<string, string[]>
  variants: Array<{ id: string; fields: Record<string, string | boolean>; prices: Record<string, string>; priceRows: PriceRow[] }>
}
export const productTextFields = ['title', 'subtitle', 'handle', 'description', 'material', 'status', 'weight', 'length', 'width', 'height', 'origin_country', 'hs_code', 'mid_code', 'collection_id', 'type_id', 'shipping_profile_id']
export const variantTextFields = ['title', 'sku', 'barcode', 'ean', 'upc']
export const addressFields = ['first_name', 'last_name', 'company', 'address_1', 'address_2', 'city', 'province', 'postal_code', 'country_code', 'phone']
const dimensions = new Set(['weight', 'length', 'width', 'height'])
const nullable = new Set(productTextFields.filter(key => !['title', 'handle', 'status'].includes(key)))
const text = (value: unknown) => value == null ? '' : String(value)
const ids = (values?: Entity[]) => (values ?? []).map(item => item.id).sort()
export const isBasePrice = (price: Price) => !Object.keys(price.rules ?? {}).length && price.min_quantity == null && price.max_quantity == null

export function productDraft(product: Entity): ProductDraft {
  return {
    etsy: product.metadata?.[ETSY_DRAFT_KEY] ? etsyDraftSchema.parse(product.metadata[ETSY_DRAFT_KEY]) : emptyEtsyDraft(),
    images: (product.images ?? []).map((image: Entity) => ({ key: image.id ?? image.url, ...(image.id ? { id: image.id } : {}), url: image.url })),
    thumbnail: product.thumbnail ?? '',
    fields: { ...Object.fromEntries(productTextFields.map(key => [key, text(key === 'shipping_profile_id' ? product.shipping_profile?.id ?? product[key] : product[key])])), discountable: Boolean(product.discountable) },
    relations: Object.fromEntries(['categories', 'tags', 'sales_channels'].map(key => [key, ids(product[key])])),
    variants: (product.variants ?? []).map((variant: Entity) => ({ id: variant.id,
      fields: { ...Object.fromEntries(variantTextFields.map(key => [key, text(variant[key])])), manage_inventory: Boolean(variant.manage_inventory), allow_backorder: Boolean(variant.allow_backorder) },
      prices: Object.fromEntries((variant.prices ?? []).map((price: Price) => [price.id, text(price.amount)])),
      priceRows: priceRows(variant.prices),
    })),
  }
}
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
export const hasChanges = (initial: unknown, draft: unknown) => !equal(initial, draft)
export function productUpdate(product: Entity, draft: ProductDraft): Entity {
  const initial = productDraft(product)
  const update: Entity = {}
  if (!equal(initial.etsy, draft.etsy)) update.metadata = { ...product.metadata, [ETSY_DRAFT_KEY]: etsyDraftSchema.parse(draft.etsy) }
  if (!equal(initial.images, draft.images)) {
    if (draft.images.some(image => !/^https?:\/\//.test(image.url))) throw new Error('Image upload is incomplete. Your draft is kept.')
    update.images = draft.images.map(({ id, url }) => ({ ...(id ? { id } : {}), url }))
  }
  if (draft.thumbnail !== initial.thumbnail) update.thumbnail = draft.thumbnail || null
  for (const key of productTextFields.concat('discountable')) {
    if (draft.fields[key] === initial.fields[key]) continue
    let value: string | boolean | number | null = draft.fields[key]
    if (typeof value === 'string' && key !== 'description') value = value.trim()
    if ((key === 'title' || key === 'handle') && !value) throw new Error(`${key === 'title' ? 'Title' : 'Handle'} is required.`)
    if (key === 'handle' && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value))) throw new Error('Handle must use lowercase letters, numbers and hyphens.')
    if (key === 'status' && !['draft', 'proposed', 'published', 'rejected'].includes(String(value))) throw new Error('Choose a valid product status.')
    if (key === 'shipping_profile_id' && !value) throw new Error('Choose a shipping profile.')
    if (key === 'origin_country' && value && !/^[a-zA-Z]{2}$/.test(String(value))) throw new Error('Origin country must be a two-letter code, such as US.')
    if (key === 'origin_country') value = String(value).toLowerCase()
    if (dimensions.has(key)) {
      if (value === '') value = null
      else { value = Number(value); if (!Number.isFinite(value) || value < 0) throw new Error(`${key} must be zero or a positive number.`) }
    } else if (nullable.has(key) && value === '') value = null
    update[key] = value
  }
  for (const key of ['categories', 'tags', 'sales_channels']) {
    if (!equal(initial.relations[key], [...draft.relations[key]].sort())) update[key] = draft.relations[key].map(id => ({ id }))
  }
  // Updating a product's nested variants is a replacement operation. Always retain
  // every existing variant ID, even when only one variant was edited.
  if (!equal(ids(product.variants), draft.variants.map(v => v.id).sort())) throw new Error('Variants changed. Reload this product before editing.')
  let variantChanged = false
  const variants = (product.variants ?? []).map((variant: Entity, index: number) => {
    const edited = draft.variants.find(item => item.id === variant.id)!
    const before = initial.variants[index]
    const patch: Entity = { id: variant.id }
    for (const key of variantTextFields) {
      if (edited.fields[key] === before.fields[key]) continue
      const value = String(edited.fields[key]).trim()
      if (key === 'title' && !value) throw new Error('Every variant needs a title.')
      patch[key] = value || null
      variantChanged = true
    }
    for (const key of ['manage_inventory', 'allow_backorder']) {
      if (edited.fields[key] !== before.fields[key]) { patch[key] = Boolean(edited.fields[key]); variantChanged = true }
    }
    if (!equal(before.prices, edited.prices) || !equal(before.priceRows, edited.priceRows)) {
      // The price array replaces normal variant prices; retain every untouched
      // regional and tier row, with its existing ID and rules.
      patch.prices = pricePayload(variant.prices ?? [], edited.priceRows, edited.prices)
      variantChanged = true
    }
    return patch
  })
  if (variantChanged) update.variants = variants
  return update
}

export type OrderDraft = { email: string; shipping_address: Record<string, string>; billing_address: Record<string, string> }
export const orderDraft = (order: Entity): OrderDraft => ({ email: text(order.email),
  shipping_address: Object.fromEntries(addressFields.map(key => [key, text(order.shipping_address?.[key])])),
  billing_address: Object.fromEntries(addressFields.map(key => [key, text(order.billing_address?.[key])])),
})
export function orderUpdate(order: Entity, draft: OrderDraft): Entity {
  const initial = orderDraft(order)
  const update: Entity = {}
  if (draft.email !== initial.email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) throw new Error('Enter a valid customer email.')
    update.email = draft.email.trim()
  }
  for (const key of ['shipping_address', 'billing_address'] as const) {
    if (equal(initial[key], draft[key])) continue
    if (!draft[key].address_1.trim()) throw new Error(`${key === 'shipping_address' ? 'Shipping' : 'Billing'} street address is required.`)
    if (!/^[a-zA-Z]{2}$/.test(draft[key].country_code.trim())) throw new Error('Country must be a two-letter code, such as US.')
    update[key] = Object.fromEntries(addressFields.map(field => [field, field === 'country_code' ? draft[key][field].trim().toLowerCase() : draft[key][field].trim()]))
  }
  return update
}

export async function adminRequest(url: string, body?: Entity, method: 'POST' | 'DELETE' = 'POST') {
  return adminFetch(url, { cache: 'no-store',
    ...(body ? { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  })
}

export const inlineRecordUrl = (kind: 'products' | 'orders', id: string) => `/admin/${kind}/${id}?${new URLSearchParams({ fields: kind === 'products' ? '*categories,*shipping_profile' : '+email' })}`

export async function saveInline(kind: 'products' | 'orders', initial: Entity, draft: ProductDraft | OrderDraft) {
  const normalize = kind === 'products' ? productDraft : orderDraft
  const update = kind === 'products' ? productUpdate(initial, draft as ProductDraft) : orderUpdate(initial, draft as OrderDraft)
  if (!Object.keys(update).length) return initial
  const url = inlineRecordUrl(kind, initial.id)
  const key = kind === 'products' ? 'product' : 'order'
  const fresh = (await adminRequest(url))[key]
  const priceRevision = (product: Entity) => (product.variants ?? []).map((variant: Entity) => ({ id: variant.id, updated_at: variant.updated_at,
    prices: (variant.prices ?? []).map((price: Entity) => ({ id: price.id, amount: price.amount, updated_at: price.updated_at, currency_code: price.currency_code, min_quantity: price.min_quantity, max_quantity: price.max_quantity, rules: Object.entries(price.rules ?? {}).sort() })).sort((a: Entity, b: Entity) => a.id.localeCompare(b.id)),
  })).sort((a: Entity, b: Entity) => a.id.localeCompare(b.id))
  if (!fresh || !equal(normalize(initial), normalize(fresh)) || String(initial.updated_at) !== String(fresh.updated_at) || (kind === 'products' && !equal(priceRevision(initial), priceRevision(fresh)))) throw new Error('This record changed since you started editing. Your draft is kept; cancel and reopen Edit all to load the latest values.')
  if (kind === 'products') {
    await adminRequest(`/admin/products/${initial.id}/workspace`, { update, expected_updated_at: initial.updated_at })
    return (await adminRequest(url))[key]
  }
  return (await adminRequest(url, update))[key]
}
