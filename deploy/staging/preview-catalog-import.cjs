const fs = require('node:fs/promises')

// Read-only staging comparison. No workflows, stock changes or external requests.
exports.default = async function ({ container }) {
  if (process.env.APP_ENV !== 'staging') throw Error('Staging only')
  const source = JSON.parse(await fs.readFile('/tmp/shopify-import-snapshot.json', 'utf8'))
  const service = container.resolve('product')
  const existing = []
  for (let skip = 0; ; skip += 100) {
    const page = await service.listProducts({}, { skip, take: 100, order: { id: 'ASC' }, relations: ['variants', 'images'] })
    existing.push(...page)
    if (page.length < 100) break
    if (skip >= 10000) throw Error('Unexpected catalog size')
  }
  const results = source.products.map(p => {
    const matches = existing.filter(e => e.metadata?.shopify_id === p.id)
    const collisions = existing.filter(e => e.handle === p.handle && e.metadata?.shopify_id !== p.id)
    const reasons = []
    if (matches.length > 1) reasons.push('duplicate_source_mapping')
    if (collisions.length) reasons.push('handle_collision')
    for (const v of p.variants.nodes) {
      if (v.sku && existing.some(e => e.id !== matches[0]?.id && e.variants.some(ev => ev.sku === v.sku))) reasons.push('sku_collision')
    }
    return {
      shopify_id: p.id, title: p.title, handle: p.handle,
      action: reasons.length ? 'blocked' : matches.length ? 'preserve' : 'create_draft',
      reasons: [...new Set(reasons)], existing_id: matches[0]?.id || null,
      missing_skus: p.variants.nodes.filter(v => !v.sku).map(v => v.id),
      packaging_pending: /coaster/i.test(p.productType + ' ' + p.title),
    }
  })
  const counts = results.reduce((a, r) => { a[r.action] = (a[r.action] || 0) + 1; return a }, {})
  const report = { checkedAt: new Date().toISOString(), readOnly: true, destinationProducts: existing.length,
    counts, products: results, existing: existing.map(p => ({ id: p.id, handle: p.handle, metadata: p.metadata,
      thumbnail: p.thumbnail, images: p.images.map(i => ({ id: i.id, url: i.url })),
      variants: p.variants.map(v => ({ id: v.id, sku: v.sku, metadata: v.metadata })) })) }
  await fs.writeFile('/tmp/catalog-import-preview.json', JSON.stringify(report, null, 2), { mode: 0o600 })
  console.log('CATALOG_PREVIEW ' + JSON.stringify({ destinationProducts: existing.length, ...counts }))
}
