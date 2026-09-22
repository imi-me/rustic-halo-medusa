const fs = require('node:fs/promises')
exports.default = async function ({ container }) {
  if (process.env.APP_ENV !== 'staging' || process.env.STRIPE_TEST_ENABLED !== 'true' || !process.env.STRIPE_API_KEY?.startsWith('sk_test_') || !process.env.SHIPPO_API_KEY?.startsWith('shippo_test_')) throw Error('Staging sandbox credentials required')
  const setup = JSON.parse(await fs.readFile('/tmp/online-drafts-setup.json', 'utf8'))
  if (!setup.complete || setup.updated?.length !== 242 || new Set(setup.updated).size !== 242) throw Error('Online draft setup incomplete')
  const service = container.resolve('product'), query = container.resolve('query')
  const selected = []
  const { data: locations } = await query.graph({ entity: 'stock_location', fields: ['id', 'sales_channels.id'] })
  const online = locations.filter(l => l.sales_channels?.some(c => c.id === setup.channelId))
  if (online.length !== 1 || online[0].id !== setup.onlineLocationId || online[0].id === setup.marketLocationId) throw Error('Online inventory isolation changed')
  for (const productId of setup.updated) {
    const { data } = await query.graph({ entity: 'product', filters: { id: productId }, fields: ['id', 'title', 'handle', 'status', 'metadata', 'thumbnail', 'shipping_profile.id', 'sales_channels.id', 'variants.sku', 'variants.manage_inventory', 'variants.allow_backorder'] })
    const p = data[0], catalog = require('../lib/shipping-catalog.json')
    if (!p || !['draft','published'].includes(p.status) || p.metadata?.imported_from !== 'shopify_catalog_snapshot' || !p.thumbnail?.startsWith('https://cdn.rustichalo.com/') || p.shipping_profile?.id !== setup.profileId || p.sales_channels?.length !== 1 || p.sales_channels[0].id !== setup.channelId || !p.variants?.length || p.variants.some(v => !v.manage_inventory || !v.allow_backorder || !Object.hasOwn(catalog, v.sku || ''))) throw Error('Preview readiness changed')
    selected.push(p)
  }
  if (new Set(selected.map(p => p.id)).size !== 242) throw Error('Expected 242 distinct prepared products')
  const report = { startedAt: new Date().toISOString(), complete: false, before: selected.map(p => ({id:p.id,status:p.status})), products: [] }
  const save = () => fs.writeFile('/tmp/catalog-preview-publication.json', JSON.stringify(report,null,2), {mode:0o600})
  await save()
  for (const p of selected) {
    if (p.status === 'draft') await service.updateProducts(p.id, {status:'published'})
    const saved = await service.retrieveProduct(p.id)
    if (saved.status !== 'published') throw Error('Preview status verification failed')
    report.products.push({id:saved.id,title:saved.title,handle:saved.handle,status:saved.status}); await save()
  }
  report.complete=true; report.completedAt=new Date().toISOString(); await save()
  console.log('CATALOG_PREVIEW_READY ' + report.products.length)
}
