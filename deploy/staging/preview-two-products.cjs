const fs = require('node:fs/promises')
exports.default = async function ({ container }) {
  if (process.env.APP_ENV !== 'staging' || process.env.STRIPE_TEST_ENABLED !== 'true' || !process.env.STRIPE_API_KEY?.startsWith('sk_test_') || !process.env.SHIPPO_API_KEY?.startsWith('shippo_test_')) throw Error('Staging sandbox credentials required')
  const setup = JSON.parse(await fs.readFile('/tmp/online-drafts-setup.json', 'utf8'))
  if (!setup.complete) throw Error('Online draft setup incomplete')
  const service = container.resolve('product'), query = container.resolve('query')
  const selected = []
  for (const sku of ['38081', '37146-2']) {
    const variants = await service.listProductVariants({ sku })
    if (variants.length !== 1 || !setup.updated.includes(variants[0].product_id)) throw Error('Preview variant not uniquely in prepared group')
    const { data } = await query.graph({ entity: 'product', filters: { id: variants[0].product_id }, fields: ['id', 'title', 'handle', 'status', 'metadata', 'thumbnail', 'shipping_profile.id', 'sales_channels.id', 'variants.sku', 'variants.manage_inventory', 'variants.allow_backorder'] })
    const p = data[0], catalog = require('../lib/shipping-catalog.json')
    if (!p || !['draft','published'].includes(p.status) || p.metadata?.imported_from !== 'shopify_catalog_snapshot' || !p.thumbnail?.startsWith('https://cdn.rustichalo.com/') || p.shipping_profile?.id !== setup.profileId || p.sales_channels?.length !== 1 || p.sales_channels[0].id !== setup.channelId || !p.variants?.length || p.variants.some(v => !v.manage_inventory || !v.allow_backorder || !Object.hasOwn(catalog, v.sku || ''))) throw Error('Preview readiness changed')
    selected.push(p)
  }
  if (new Set(selected.map(p => p.id)).size !== 2) throw Error('Expected two distinct products')
  const report = { startedAt: new Date().toISOString(), complete: false, before: selected.map(p => ({id:p.id,status:p.status})), products: [] }
  const save = () => fs.writeFile('/tmp/two-product-preview.json', JSON.stringify(report,null,2), {mode:0o600})
  await save()
  for (const p of selected) {
    if (p.status === 'draft') await service.updateProducts(p.id, {status:'published'})
    const saved = await service.retrieveProduct(p.id)
    if (saved.status !== 'published') throw Error('Preview status verification failed')
    report.products.push({id:saved.id,title:saved.title,handle:saved.handle,status:saved.status}); await save()
  }
  report.complete=true; report.completedAt=new Date().toISOString(); await save()
  console.log('STAGING_PREVIEW_READY 2')
}
