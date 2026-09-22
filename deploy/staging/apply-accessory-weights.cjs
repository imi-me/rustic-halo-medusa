const fs = require('node:fs/promises')
exports.default = async function ({ container }) {
  if (process.env.APP_ENV !== 'staging') throw Error('Staging only')
  const source = JSON.parse(await fs.readFile('/tmp/confirmed-accessory-weights.json', 'utf8'))
  const service = container.resolve('product'), products = []
  for (let skip = 0; ; skip += 100) {
    const page = await service.listProducts({}, { skip, take: 100, order: { id: 'ASC' }, relations: ['variants'] })
    products.push(...page)
    if (page.length < 100) break
    if (skip >= 10000) throw Error('Unexpected catalog size')
  }
  const planned = [], seen = new Set()
  for (const row of source.approved) {
    if (seen.has(row.shopify_variant_id)) throw Error('Duplicate plan variant')
    seen.add(row.shopify_variant_id)
    if (![0.5, 0.6, 1].includes(row.weight_oz) || Math.abs(row.weight_grams - row.weight_oz * 28.349523125) > 0.000001) throw Error('Invalid approved weight')
    const matches = products.filter(p => p.metadata?.shopify_id === row.shopify_product_id)
    if (matches.length !== 1) throw Error('Product mapping missing or ambiguous')
    const variants = matches[0].variants.filter(v => v.metadata?.shopify_variant_id === row.shopify_variant_id)
    if (variants.length !== 1) throw Error('Variant mapping missing or ambiguous')
    planned.push({ row, variant: variants[0] })
  }
  const path = '/tmp/accessory-weight-update.json'
  const report = { startedAt: new Date().toISOString(), complete: false, planned: planned.length,
    before: planned.map(({ variant }) => ({ id: variant.id, weight: variant.weight, metadata: variant.metadata })), updated: [] }
  const save = () => fs.writeFile(path, JSON.stringify(report, null, 2), { mode: 0o600 })
  await save()
  for (const { row, variant } of planned) {
    const current = await service.retrieveProductVariant(variant.id)
    if (current.metadata?.shopify_variant_id !== row.shopify_variant_id || current.weight !== variant.weight || JSON.stringify(current.metadata) !== JSON.stringify(variant.metadata)) throw Error('Variant changed during update')
    await service.updateProductVariants(variant.id, { weight: row.weight_grams,
      metadata: { ...current.metadata, confirmed_item_weight_oz: row.weight_oz,
        item_weight_basis: 'owner_confirmed_item_only', proposed_package_id: row.package_id } })
    const saved = await service.retrieveProductVariant(variant.id)
    if (Math.abs(Number(saved.weight) - row.weight_grams) > 0.000001 || Number(saved.metadata?.confirmed_item_weight_oz) !== row.weight_oz) throw Error('Weight verification failed')
    report.updated.push(variant.id); await save()
  }
  report.complete = true; report.completedAt = new Date().toISOString(); await save()
  console.log('ACCESSORY_WEIGHTS_UPDATED ' + report.updated.length)
}
