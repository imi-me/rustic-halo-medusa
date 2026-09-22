const fs = require('node:fs/promises')
const { createProductsWorkflow } = require('@medusajs/medusa/core-flows')
const { buildHairClawDraft } = require('/tmp/hair-claw-catalog.cjs')

const reportPath = '/tmp/hair-claw-product-create.json'

exports.default = async function ({ container }) {
  if (process.env.APP_ENV !== 'staging' || process.env.HAIR_CLAW_PRODUCT_CREATE !== 'yes') {
    throw Error('Explicit staging hair-claw product creation required')
  }
  const request = JSON.parse(await fs.readFile('/tmp/hair-claw-product-request.json', 'utf8'))
  const policy = JSON.parse(await fs.readFile('/tmp/hair-claw-color-policy.json', 'utf8'))
  if (request.reviewed !== true || !request.product) throw Error('Reviewed product request required')
  const product = buildHairClawDraft(request.product, policy)
  const products = container.resolve('product')
  const inventory = container.resolve('inventory')
  const query = container.resolve('query')
  const report = {
    startedAt: new Date().toISOString(), complete: false, mode: 'create_draft',
    inventorySynchronizationEnabled: false, inventoryQuantitiesChanged: false,
    title: product.title, handle: product.handle, plannedVariantCount: product.variants.length,
  }
  const save = () => fs.writeFile(reportPath, JSON.stringify(report, null, 2), { mode: 0o600 })
  await save()

  if ((await products.listProducts({ handle: product.handle })).length) throw Error(`Product handle already exists: ${product.handle}`)
  for (const variant of product.variants) {
    if ((await products.listProductVariants({ sku: variant.sku })).length) throw Error(`SKU already exists: ${variant.sku}`)
  }

  const { result } = await createProductsWorkflow(container).run({ input: { products: [product] } })
  const { data } = await query.graph({
    entity: 'product', filters: { id: result[0].id }, fields: [
      'id', 'status', 'metadata', 'variants.id', 'variants.sku',
      'variants.inventory_items.inventory_item_id',
    ],
  })
  const saved = data[0]
  if (!saved) throw Error('Created draft could not be reloaded')
  const expectedSkus = product.variants.map(row => row.sku).sort()
  const actualSkus = saved.variants.map(row => row.sku).sort()
  if (saved.status !== 'draft' || saved.metadata?.product_template !== 'rustic_halo_hair_claw_v1' ||
      JSON.stringify(actualSkus) !== JSON.stringify(expectedSkus)) {
    throw Error('Created draft verification failed')
  }
  let inventoryItemCount = 0
  for (const variant of saved.variants) {
    if (variant.inventory_items?.length !== 1) throw Error(`Unexpected inventory item count for ${variant.sku}`)
    const itemId = variant.inventory_items[0].inventory_item_id
    const levels = await inventory.listInventoryLevels({ inventory_item_id: itemId }, { take: 100 })
    if (levels.length) throw Error(`New draft unexpectedly has stock levels: ${variant.sku}`)
    inventoryItemCount++
  }
  report.complete = true
  report.completedAt = new Date().toISOString()
  report.productId = saved.id
  report.status = saved.status
  report.createdVariantCount = saved.variants.length
  report.inventoryItemCount = inventoryItemCount
  report.stockLevelCount = 0
  await save()
  console.log(`HAIR_CLAW_DRAFT_CREATED ${saved.id} ${saved.variants.length}`)
}
