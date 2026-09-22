const fs = require('node:fs/promises')
const { createProductVariantsWorkflow, updateProductOptionsWorkflow } = require('@medusajs/medusa/core-flows')
const { planMissingColorVariants } = require('/tmp/hair-claw-catalog.cjs')

const reportPath = '/tmp/hair-claw-color-change.json'
const byJson = (a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))
const levelShape = row => ({
  location_id: row.location_id,
  stocked_quantity: Number(row.stocked_quantity),
  reserved_quantity: Number(row.reserved_quantity),
})
const sameLevels = (a, b) => JSON.stringify(a.map(levelShape).sort(byJson)) === JSON.stringify(b.map(levelShape).sort(byJson))

exports.default = async function ({ container }) {
  if (process.env.APP_ENV !== 'staging') throw Error('Staging only')
  const request = JSON.parse(await fs.readFile('/tmp/hair-claw-color-request.json', 'utf8'))
  const policy = JSON.parse(await fs.readFile('/tmp/hair-claw-color-policy.json', 'utf8'))
  const mode = request.mode || 'preview'
  if (!['preview', 'apply'].includes(mode)) throw Error('Mode must be preview or apply')
  if (mode === 'apply' && (request.reviewed !== true || process.env.HAIR_CLAW_COLOR_APPLY !== 'yes')) {
    throw Error('Explicit reviewed color apply required')
  }
  const products = container.resolve('product')
  const inventory = container.resolve('inventory')
  const query = container.resolve('query')
  const targetIds = request.targetProductIds == null ? null : new Set(request.targetProductIds)
  if (targetIds && (!targetIds.size || [...targetIds].some(id => typeof id !== 'string' || !id))) {
    throw Error('targetProductIds must contain product IDs')
  }
  const ids = []
  for (let skip = 0; ; skip += 100) {
    const page = await products.listProducts({}, { skip, take: 100, order: { id: 'ASC' } })
    ids.push(...page.map(row => row.id))
    if (page.length < 100) break
    if (skip >= 10000) throw Error('Unexpected catalog size')
  }
  if (targetIds) {
    const missing = [...targetIds].filter(id => !ids.includes(id))
    if (missing.length) throw Error(`Unknown target product IDs: ${missing.join(', ')}`)
  }
  const selected = [], optionIds = new Map(), inventoryItemIds = new Map()
  for (const id of ids) {
    if (targetIds && !targetIds.has(id)) continue
    const { data } = await query.graph({ entity: 'product', filters: { id }, fields: [
      'id', 'title', 'options.id', 'options.title', 'options.values.id', 'options.values.value',
      'variants.id', 'variants.title', 'variants.sku', 'variants.allow_backorder', 'variants.manage_inventory',
      'variants.requires_shipping', 'variants.hs_code', 'variants.origin_country', 'variants.mid_code',
      'variants.material', 'variants.weight', 'variants.length', 'variants.height', 'variants.width',
      'variants.metadata', 'variants.options.value', 'variants.options.option.title',
      'variants.price_set.prices.amount', 'variants.price_set.prices.currency_code',
      'variants.price_set.prices.min_quantity', 'variants.price_set.prices.max_quantity',
      'variants.inventory_items.inventory_item_id',
    ] })
    const product = data[0]
    if (!product) throw Error(`Product query failed: ${id}`)
    selected.push(product)
    const colorOption = product.options?.find(row => row.title === 'Color')
    if (colorOption) optionIds.set(id, colorOption)
    for (const variant of product.variants || []) {
      if (variant.metadata?.inventory_mode !== 'made_to_order_color_option') continue
      if (variant.inventory_items?.length !== 1) throw Error(`Unexpected inventory item count for ${variant.sku}`)
      inventoryItemIds.set(variant.id, variant.inventory_items[0].inventory_item_id)
    }
  }
  const plan = planMissingColorVariants(selected, policy, request.color)
  if (!plan.variantCount) throw Error('No missing variants found for the approved color')
  if (targetIds && plan.products.length !== targetIds.size) throw Error('A target product is not a managed hair-claw product or already has this color')
  for (const row of plan.products) {
    if (!optionIds.has(row.productId)) throw Error(`Missing Color option on ${row.productId}`)
    for (const addition of row.additions) {
      if ((await products.listProductVariants({ sku: addition.sku })).length) throw Error(`SKU already exists: ${addition.sku}`)
    }
  }
  const report = {
    startedAt: new Date().toISOString(), complete: mode === 'preview', mode,
    color: plan.color, productCount: plan.products.length, variantCount: plan.variantCount,
    inventorySynchronizationEnabled: false, inventoryQuantitiesChanged: false,
    etsyAction: 'separate_review_required',
    products: plan.products.map(row => ({ productId: row.productId, skus: row.additions.map(item => item.sku), status: 'planned' })),
  }
  const save = () => fs.writeFile(reportPath, JSON.stringify(report, null, 2), { mode: 0o600 })
  await save()
  if (mode === 'preview') {
    console.log(`HAIR_CLAW_COLOR_PREVIEW ${plan.products.length} ${plan.variantCount}`)
    return
  }

  const beforeLevels = new Map()
  for (const itemId of inventoryItemIds.values()) {
    beforeLevels.set(itemId, await inventory.listInventoryLevels({ inventory_item_id: itemId }, { take: 100 }))
  }
  for (const row of plan.products) {
    const option = optionIds.get(row.productId)
    const values = option.values.map(value => value.value)
    if (!values.some(value => value.toLowerCase() === plan.color.name.toLowerCase())) {
      await updateProductOptionsWorkflow(container).run({
        input: { selector: { id: option.id }, update: { values: [...values, plan.color.name] } },
      })
    }
    await createProductVariantsWorkflow(container).run({ input: { product_variants: row.additions } })
    report.products.find(item => item.productId === row.productId).status = 'created'
    await save()
  }
  for (const [variantId, itemId] of inventoryItemIds) {
    const after = await inventory.listInventoryLevels({ inventory_item_id: itemId }, { take: 100 })
    if (!sameLevels(beforeLevels.get(itemId), after)) throw Error(`Existing inventory changed for ${variantId}`)
  }
  for (const row of plan.products) {
    const { data } = await query.graph({
      entity: 'product', filters: { id: row.productId },
      fields: ['id', 'variants.id', 'variants.sku', 'variants.inventory_items.inventory_item_id'],
    })
    const saved = data[0]
    if (!saved) throw Error(`Updated product could not be reloaded: ${row.productId}`)
    for (const addition of row.additions) {
      const matches = saved.variants.filter(variant => variant.sku === addition.sku)
      if (matches.length !== 1 || matches[0].inventory_items?.length !== 1) {
        throw Error(`Created variant verification failed: ${addition.sku}`)
      }
      const levels = await inventory.listInventoryLevels({ inventory_item_id: matches[0].inventory_items[0].inventory_item_id }, { take: 100 })
      if (levels.length) throw Error(`New color variant unexpectedly has stock levels: ${addition.sku}`)
    }
  }
  report.complete = true
  report.completedAt = new Date().toISOString()
  await save()
  console.log(`HAIR_CLAW_COLOR_APPLIED ${plan.products.length} ${plan.variantCount}`)
}
