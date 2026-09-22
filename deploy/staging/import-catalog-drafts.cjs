const fs = require('node:fs/promises')
const crypto = require('node:crypto')

function plan(source, existing) {
  const ids = new Set(), variantIds = new Set(), skus = new Set(), handles = new Set()
  const result = { preserve: [], create: [] }
  for (const p of source.products) {
    if (!p.id || ids.has(p.id) || handles.has(p.handle)) throw Error('Duplicate source identity')
    ids.add(p.id); handles.add(p.handle)
    if (p.variants.pageInfo.hasNextPage || p.media.pageInfo.hasNextPage || p.variants.nodes.length !== p.variantsCount.count) throw Error('Incomplete source')
    const matches = existing.filter(e => e.metadata?.shopify_id === p.id)
    if (matches.length > 1 || existing.some(e => e.handle === p.handle && e.id !== matches[0]?.id)) throw Error('Destination identity conflict')
    for (const v of p.variants.nodes) {
      if (variantIds.has(v.id) || (v.sku && skus.has(v.sku))) throw Error('Duplicate source variant or SKU')
      variantIds.add(v.id); if (v.sku) skus.add(v.sku)
      if (v.sku && existing.some(e => e.id !== matches[0]?.id && e.variants.some(ev => ev.sku === v.sku))) throw Error('Destination SKU conflict')
    }
    if (matches.length) { result.preserve.push(matches[0].id); continue }
    const images = p.media.nodes.filter(m => m.image).map(m => ({ url: m.image.url }))
    if (images.some(i => { const u = new URL(i.url); return u.protocol !== 'https:' || u.hostname !== 'cdn.shopify.com' })) throw Error('Unexpected image origin')
    const options = p.options.map(o => ({ title: o.name, values: o.values }))
    const variants = p.variants.nodes.map(v => {
      const chosen = Object.fromEntries(v.selectedOptions.map(o => [o.name, o.value]))
      if (options.length !== Object.keys(chosen).length || options.some(o => !o.values.includes(chosen[o.title]))) throw Error('Invalid variant options')
      const price = Number(v.price)
      if (!Number.isFinite(price) || price < 0) throw Error('Invalid price')
      const w = v.inventoryItem.measurement?.weight
      const factor = { GRAMS: 1, KILOGRAMS: 1000, OUNCES: 28.349523125, POUNDS: 453.59237 }[w?.unit]
      if (w && (!factor || !Number.isFinite(w.value) || w.value < 0)) throw Error('Invalid source weight')
      return { title: v.title, ...(v.sku ? { sku: v.sku } : {}), options: chosen,
        prices: [{ currency_code: 'usd', amount: price }], manage_inventory: true, allow_backorder: false,
        ...(w ? { weight: Math.round(w.value * factor * 1000) / 1000 } : {}),
        metadata: { shopify_variant_id: v.id, shopify_inventory_item_id: v.inventoryItem.id,
          source_barcode: v.barcode, source_weight: w || null, sku_review_required: !v.sku } }
    })
    result.create.push({ title: p.title, handle: p.handle, status: 'draft',
      description: p.descriptionHtml.replace(/<\/(p|li|div)>/gi, '\n').replace(/<[^>]*>/g, '').trim(),
      ...(images.length ? { thumbnail: images[0].url, images } : {}), options, variants,
      metadata: { shopify_id: p.id, source_description_html: p.descriptionHtml, source_product_type: p.productType,
        source_vendor: p.vendor, source_tags: p.tags, source_updated_at: p.updatedAt,
        imported_from: 'shopify_catalog_snapshot', catalog_review_required: true,
        shipping_setup: /coaster/i.test(p.productType + ' ' + p.title) ? 'packaging_pending' : 'profile_mapping_pending',
        inventory_mode: 'not_synced', image_migration: 'pending' } })
  }
  return result
}
exports.plan = plan
exports.default = async function ({ container }) {
  if (process.env.APP_ENV !== 'staging' || process.env.CATALOG_IMPORT_DRAFTS !== 'yes') throw Error('Explicit staging draft import required')
  const { createProductsWorkflow } = require('@medusajs/medusa/core-flows')
  const bytes = await fs.readFile('/tmp/shopify-import-snapshot.json')
  const source = JSON.parse(bytes)
  const service = container.resolve('product'), existing = []
  for (let skip = 0; ; skip += 100) {
    const page = await service.listProducts({}, { skip, take: 100, order: { id: 'ASC' }, relations: ['variants'] })
    existing.push(...page)
    if (page.length < 100) break
    if (skip >= 10000) throw Error('Unexpected catalog size')
  }
  const planned = plan(source, existing)
  const report = { startedAt: new Date().toISOString(), sourceHash: crypto.createHash('sha256').update(bytes).digest('hex'),
    preserved: planned.preserve, planned: planned.create.length, created: [], complete: false }
  const save = () => fs.writeFile('/tmp/catalog-draft-import.json', JSON.stringify(report, null, 2), { mode: 0o600 })
  await save()
  for (const product of planned.create) {
    // Recheck identity immediately before each workflow; a rerun preserves completed imports.
    const collisions = await service.listProducts({ handle: product.handle })
    if (collisions.length) throw Error('Catalog changed during import; rerun comparison')
    const { result } = await createProductsWorkflow(container).run({ input: { products: [product] } })
    const saved = await service.retrieveProduct(result[0].id, { relations: ['variants'] })
    if (saved.status !== 'draft' || saved.metadata?.shopify_id !== product.metadata.shopify_id || saved.variants.length !== product.variants.length) throw Error('Created product verification failed')
    report.created.push({ id: saved.id, shopify_id: saved.metadata.shopify_id })
    await save()
    if (report.created.length % 25 === 0) console.log('CATALOG_PROGRESS ' + report.created.length)
  }
  report.complete = true; report.completedAt = new Date().toISOString(); await save()
  console.log('CATALOG_IMPORTED ' + JSON.stringify({ created: report.created.length, preserved: report.preserved.length, draftsOnly: true, stockChanged: false }))
}
