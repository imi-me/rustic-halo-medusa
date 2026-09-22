const fs = require('node:fs/promises')
const { createProductOptionsWorkflow, createProductVariantsWorkflow, updateProductOptionsWorkflow, updateProductVariantsWorkflow } = require('@medusajs/medusa/core-flows')

const reportPath = '/tmp/medusa-hair-claw-colors.json'
const sameLevels = (a, b) => JSON.stringify(a.map(levelShape).sort(byJson)) === JSON.stringify(b.map(levelShape).sort(byJson))
const byJson = (a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))
const levelShape = row => ({ location_id: row.location_id, stocked_quantity: Number(row.stocked_quantity), reserved_quantity: Number(row.reserved_quantity) })

exports.default = async function ({ container }) {
  if (process.env.APP_ENV !== 'staging') throw Error('Staging only')
  const plan = JSON.parse(await fs.readFile('/tmp/hair-claw-color-plan.json', 'utf8'))
  const colors = plan.colors.map(row => [row.name, row.suffix])
  const planned = plan.listings.filter(row => row.status === 'planned')
  if (colors.length !== 12 || planned.length !== 19) throw Error('Unexpected hair-claw color plan')
  const productPlans = new Map()
  for (const listing of planned) for (const base of listing.baseProducts) {
    const entry = productPlans.get(base.medusaProductId) || { productId: base.medusaProductId, title: listing.title, bases: [] }
    entry.bases.push(base); productPlans.set(base.medusaProductId, entry)
  }
  const products = container.resolve('product'), inventory = container.resolve('inventory'), query = container.resolve('query')
  const report = { startedAt: new Date().toISOString(), complete: false, inventorySynchronizationEnabled: false, products: [] }
  const save = () => fs.writeFile(reportPath, JSON.stringify(report, null, 2), { mode: 0o600 })
  await save()

  for (const productPlan of productPlans.values()) {
    const plannedSkus = productPlan.bases.flatMap(base => base.children.map(child => child.sku))
    const plannedMatches = []
    for (const sku of plannedSkus) plannedMatches.push(...await products.listProductVariants({ sku }))
    if (plannedMatches.length === plannedSkus.length && new Set(plannedMatches.map(v => v.product_id)).size === 1 && plannedMatches[0].product_id === productPlan.productId) {
      report.products.push({ productId: productPlan.productId, status: 'already_complete', variantCount: plannedMatches.length }); await save(); continue
    }
    if (plannedMatches.length) throw Error(`Partial color variants need review for ${productPlan.productId}`)
    const { data } = await query.graph({ entity: 'product', filters: { id: productPlan.productId }, fields: [
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
    if (!product || !product.variants.length || !product.options?.length) throw Error(`Unexpected product shape for ${productPlan.productId}`)
    const plannedById = new Map(productPlan.bases.map(base => [base.medusaVariantId, base]))
    if (productPlan.bases.some(base => !product.variants.some(v => v.id === base.medusaVariantId && v.sku === base.baseSku))) throw Error(`Planned variant changed for ${product.id}`)
    const baseRows = product.variants.map(row => {
      if (!row.sku || row.inventory_items?.length !== 1 || !row.manage_inventory || row.requires_shipping === false) throw Error(`Unexpected base variant on ${product.id}`)
      const plannedBase = plannedById.get(row.id)
      const base = plannedBase || { baseSku: row.sku, medusaVariantId: row.id, children: colors.map(([color, suffix]) => ({ color, sku: `${row.sku}-${suffix}` })) }
      const prices = (row.price_set?.prices || []).map(p => ({ currency_code: p.currency_code, amount: p.amount, min_quantity: p.min_quantity, max_quantity: p.max_quantity }))
      if (!prices.length) throw Error(`Missing prices for ${base.baseSku}`)
      return { plan: base, row, prices }
    })
    const expectedSkus = baseRows.flatMap(base => base.plan.children.map(child => child.sku))
    const collisions = []
    for (const sku of expectedSkus) collisions.push(...await products.listProductVariants({ sku }))
    if (collisions.length) throw Error(`Color SKU collision for ${product.id}`)
    const existingOptionTitles = product.options.map(o => o.title)
    const singleton = product.options.find(o => o.values?.length === 1 && o.values[0].value === 'Default Title')
    if (existingOptionTitles.includes('Color')) {
      const existingColor = product.options.find(o => o.title === 'Color')
      const replacement = singleton?.id === existingColor?.id ? 'Style' : 'Finish'
      if (!existingColor || existingOptionTitles.includes(replacement)) throw Error(`Existing Color option needs review for ${product.id}`)
      await updateProductOptionsWorkflow(container).run({ input: { selector: { id: existingColor.id }, update: { title: replacement } } })
      for (const base of baseRows) {
        const option = base.row.options.find(o => o.option?.title === 'Color')
        if (!option) throw Error(`Missing existing Color option for ${base.plan.baseSku}`)
        option.option.title = replacement
      }
    }
    const { result: createdOptions } = await createProductOptionsWorkflow(container).run({ input: { product_options: [{
      title: 'Color', values: colors.map(([color]) => color), is_exclusive: true, metadata: { purpose: 'base_claw_color' },
    }] } })
    await products.addProductOptionToProduct({ product_id: product.id, product_option_id: createdOptions[0].id })
    const beforeLevels = new Map()
    for (const base of baseRows) {
      const itemId = base.row.inventory_items[0].inventory_item_id
      const item = await inventory.retrieveInventoryItem(itemId)
      if (item.sku !== base.plan.baseSku) throw Error(`Inventory SKU changed for ${base.plan.baseSku}`)
      beforeLevels.set(itemId, await inventory.listInventoryLevels({ inventory_item_id: itemId }, { take: 100 }))
      const optionValues = Object.fromEntries(base.row.options.map(o => [o.option.title, o.value]))
      const creamSku = base.plan.children.find(child => child.color === 'CREAM')?.sku
      if (!creamSku) throw Error(`Missing CREAM SKU for ${base.plan.baseSku}`)
      await inventory.updateInventoryItems({ id: itemId, sku: creamSku })
      await updateProductVariantsWorkflow(container).run({ input: { product_variants: [{
        id: base.row.id, title: base.row.title === 'Default Title' ? 'CREAM' : `${base.row.title} / CREAM`, sku: creamSku,
        options: { ...optionValues, Color: 'CREAM' }, allow_backorder: true,
        metadata: { ...base.row.metadata, base_sku: base.plan.baseSku, base_claw_color: 'CREAM', inventory_mode: 'made_to_order_color_option' },
      }] } })
      const children = base.plan.children.filter(child => child.color !== 'CREAM')
      await createProductVariantsWorkflow(container).run({ input: { product_variants: children.map(child => ({
        product_id: product.id, title: base.row.title === 'Default Title' ? child.color : `${base.row.title} / ${child.color}`,
        sku: child.sku, allow_backorder: true, manage_inventory: true, requires_shipping: true,
        hs_code: base.row.hs_code, origin_country: base.row.origin_country, mid_code: base.row.mid_code,
        material: base.row.material, weight: base.row.weight, length: base.row.length, height: base.row.height, width: base.row.width,
        options: { ...optionValues, Color: child.color }, prices: base.prices,
        metadata: { ...base.row.metadata, base_sku: base.plan.baseSku, base_claw_color: child.color, inventory_mode: 'made_to_order_color_option' },
      })) } })
      const after = await inventory.listInventoryLevels({ inventory_item_id: itemId }, { take: 100 })
      if (!sameLevels(beforeLevels.get(itemId), after)) throw Error(`Inventory quantity changed for ${base.plan.baseSku}`)
    }
    const saved = []
    for (const sku of expectedSkus) saved.push(...await products.listProductVariants({ sku }))
    if (saved.length !== expectedSkus.length || saved.some(v => v.product_id !== product.id)) throw Error(`Variant verification failed for ${product.id}`)
    report.products.push({ productId: product.id, status: 'created', baseVariantCount: baseRows.length, variantCount: saved.length, inventoryQuantitiesChanged: false })
    await save()
  }
  const total = report.products.reduce((sum, row) => sum + row.variantCount, 0)
  if (report.products.length !== productPlans.size || total !== 516) throw Error('Final hair-claw variant count changed')
  report.complete = true; report.completedAt = new Date().toISOString(); report.totalColorVariants = total; await save()
  console.log(`MEDUSA_HAIR_CLAW_COLORS_READY ${report.products.length} ${total}`)
}
