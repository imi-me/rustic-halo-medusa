const fs = require('node:fs/promises')
exports.default = async function ({ container }) {
  if (process.env.APP_ENV !== 'staging') throw Error('Staging only')
  const plan = JSON.parse(await fs.readFile('/tmp/studio-sku-proposals.json', 'utf8'))
  const service = container.resolve('product'), inventory = container.resolve('inventory'), query = container.resolve('query')
  const products = []
  for (let skip = 0; ; skip += 100) {
    const page = await service.listProducts({}, { skip, take: 100, order: { id: 'ASC' }, relations: ['variants'] })
    products.push(...page); if (page.length < 100) break
    if (skip >= 10000) throw Error('Catalog limit')
  }
  const updates = []
  for (const row of plan.items) {
    const matches = products.filter(p => p.metadata?.shopify_id === row.product_id)
    if (matches.length !== 1) throw Error('Ambiguous product')
    const variants = matches[0].variants.filter(v => v.metadata?.shopify_variant_id === row.variant_id)
    if (variants.length !== 1) throw Error('Ambiguous variant')
    const variant = variants[0]
    if (variant.sku && variant.sku !== row.proposed_sku) throw Error('Preserving unexpected existing SKU')
    if (products.some(p => p.variants.some(v => v.id !== variant.id && v.sku === row.proposed_sku))) throw Error('SKU collision')
    const { data } = await query.graph({ entity: 'product', filters: { id: matches[0].id }, fields: ['id', 'variants.id', 'variants.inventory_items.inventory_item_id'] })
    const links = data[0]?.variants?.find(v => v.id === variant.id)?.inventory_items
    if (links?.length !== 1) throw Error('Expected one inventory item')
    const item = await inventory.retrieveInventoryItem(links[0].inventory_item_id)
    if (item.sku && item.sku !== row.proposed_sku) throw Error('Preserving unexpected inventory SKU')
    const collisions = await inventory.listInventoryItems({ sku: row.proposed_sku })
    if (collisions.some(i => i.id !== item.id)) throw Error('Inventory SKU collision')
    updates.push({ row, variant, item })
  }
  const report = { startedAt: new Date().toISOString(), complete: false,
    before: updates.map(u => ({ variant_id: u.variant.id, sku: u.variant.sku, inventory_id: u.item.id, inventory_sku: u.item.sku })), updated: [] }
  const save = () => fs.writeFile('/tmp/studio-sku-update.json', JSON.stringify(report, null, 2), { mode: 0o600 })
  await save()
  for (const { row, variant, item } of updates) {
    await inventory.updateInventoryItems({ id: item.id, sku: row.proposed_sku })
    await service.updateProductVariants(variant.id, { sku: row.proposed_sku, metadata: { ...variant.metadata, sku_review_required: false } })
    const v = await service.retrieveProductVariant(variant.id), i = await inventory.retrieveInventoryItem(item.id)
    if (v.sku !== row.proposed_sku || i.sku !== row.proposed_sku) throw Error('SKU verification failed')
    report.updated.push({ variant_id: v.id, sku: v.sku }); await save()
  }
  report.complete = true; report.completedAt = new Date().toISOString(); await save()
  console.log('STUDIO_SKUS_UPDATED ' + report.updated.length)
}
