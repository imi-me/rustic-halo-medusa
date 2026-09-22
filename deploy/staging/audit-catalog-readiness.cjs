const fs = require('node:fs/promises')

// Read only: no workflows, product updates, inventory writes or external calls.
exports.default = async function ({ container }) {
  if (process.env.APP_ENV !== 'staging') throw Error('Staging only')
  const query = container.resolve('query')
  const catalog = require('./../lib/shipping-catalog.json')
  const products = []
  for (let skip = 0; ; skip += 100) {
    const { data } = await query.graph({ entity: 'product', fields: [
      'id', 'title', 'status', 'metadata', 'thumbnail', 'shipping_profile.id',
      'sales_channels.id', 'sales_channels.name', 'variants.id', 'variants.sku',
      'variants.manage_inventory', 'variants.allow_backorder',
      'variants.inventory_items.inventory_item_id',
    ], pagination: { skip, take: 100, order: { id: 'ASC' } } })
    products.push(...data)
    if (data.length < 100) break
    if (skip >= 10000) throw Error('Catalog limit')
  }
  const { data: locations } = await query.graph({ entity: 'stock_location', fields: [
    'id', 'name', 'sales_channels.id', 'sales_channels.name', 'fulfillment_sets.id',
  ] })
  const imported = products.filter(p => p.metadata?.imported_from === 'shopify_catalog_snapshot')
  const rows = imported.map(p => {
    const reasons = []
    if (p.status !== 'draft') reasons.push('not_draft')
    if (!p.thumbnail || !p.thumbnail.startsWith('https://cdn.rustichalo.com/')) reasons.push('photo_pending')
    if (!p.variants?.length || p.variants.some(v => !Object.hasOwn(catalog, v.sku || ''))) reasons.push('shipping_measurements_pending')
    return { id: p.id, title: p.title, status: p.status, reasons,
      shipping_profile: p.shipping_profile || null, sales_channels: p.sales_channels || [],
      variants: p.variants.map(v => ({ id: v.id, sku: v.sku, manage_inventory: v.manage_inventory,
        allow_backorder: v.allow_backorder, inventory_items: v.inventory_items })) }
  })
  const report = { checkedAt: new Date().toISOString(), readOnly: true,
    counts: { imported: rows.length, eligibleForSetupReview: rows.filter(p => !p.reasons.length).length },
    locations, products: rows }
  await fs.writeFile('/tmp/catalog-readiness.json', JSON.stringify(report, null, 2), { mode: 0o600 })
  console.log('CATALOG_READINESS ' + JSON.stringify(report.counts))
}
