export type SearchSuggestion = { id: string; title: string; detail: string; thumbnail?: string | null }
type RecordRow = Record<string, string | number | null | undefined>
type SearchSource = {
  endpoint: string
  collection: string
  label: string
  route: string
  fields: string
  selector?: string
  describe: (row: RecordRow) => SearchSuggestion
}
const humanize = (value: unknown) => String(value ?? '').replace(/_/g, ' ')
export const searchSources: Record<string, SearchSource> = {
  '/orders': {
    endpoint: '/admin/orders', collection: 'orders', label: 'Orders', route: '/orders',
    fields: 'id,display_id,email,status',
    describe: row => ({ id: String(row.id), title: `Order #${row.display_id}`, detail: [row.email, humanize(row.status)].filter(Boolean).join(' · ') }),
  },
  '/inventory': {
    endpoint: '/admin/inventory-items', collection: 'inventory_items', label: 'Inventory', route: '/inventory',
    fields: 'id,title,sku,thumbnail',
    describe: row => ({ id: String(row.id), title: String(row.title || row.sku || 'Inventory item'), detail: row.sku ? `SKU: ${row.sku}` : 'Inventory item', thumbnail: row.thumbnail as string | null }),
  },
  '/customers': {
    endpoint: '/admin/customers', collection: 'customers', label: 'Customers', route: '/customers',
    fields: 'id,first_name,last_name,email',
    describe: row => ({ id: String(row.id), title: [row.first_name, row.last_name].filter(Boolean).join(' ') || String(row.email || 'Customer'), detail: String(row.email || 'Customer') }),
  },
  '/price-lists': {
    endpoint: '/admin/price-lists', collection: 'price_lists', label: 'Price lists', route: '/price-lists',
    fields: 'id,title,status,type',
    describe: row => ({ id: String(row.id), title: String(row.title || 'Price list'), detail: [humanize(row.status), humanize(row.type)].filter(Boolean).join(' · ') }),
  },
  '/promotions': {
    endpoint: '/admin/promotions', collection: 'promotions', label: 'Promotions', route: '/promotions',
    fields: 'id,code,status,type',
    describe: row => ({ id: String(row.id), title: String(row.code || 'Automatic promotion'), detail: [humanize(row.status), humanize(row.type)].filter(Boolean).join(' · ') }),
  },
}
searchSources['/orders-workspace'] = { ...searchSources['/orders'], selector: 'main input[aria-label="Search orders"]' }

export const suggestionParams = (source: SearchSource, value: string) => new URLSearchParams({
  q: source.collection === 'orders' ? value.trim().replace(/^#/, '') : value.trim(),
  limit: '8', fields: source.fields,
})
