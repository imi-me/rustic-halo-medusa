const fs = require('node:fs/promises')
const { createProductOptionsWorkflow, createProductVariantsWorkflow, updateProductOptionsWorkflow, updateProductVariantsWorkflow } = require('@medusajs/medusa/core-flows')

const colors = [
  ['CREAM', '38316-CREAM'], ['SKY BLUE', '38316-SKY-BL'],
  ['OCEAN BLUE', '38316-OCEAN-BL'], ['MINT', '38316-MINT'],
  ['SAGE', '38316-SAGE'], ['BLUSH', '38316-BLUSH'],
  ['TAUPE', '38316-TAUPE'], ['TERRACOTTA', '38316-TERRACOTTA'],
  ['ESPRESSO', '38316-ESPRESSO'], ['SLATE', '38316-SLATE'],
  ['NAVY', '38316-NAVY'], ['Black', '38316-BLK'],
]

exports.default = async function ({ container }) {
  if (process.env.APP_ENV !== 'staging') throw Error('Staging only')
  const products = container.resolve('product'), inventory = container.resolve('inventory'), query = container.resolve('query')
  const childMatches = []
  for (const [, sku] of colors) childMatches.push(...await products.listProductVariants({ sku }))
  const baseMatches = await products.listProductVariants({ sku: '38316' })
  if (!baseMatches.length && childMatches.length === 12 && new Set(childMatches.map(v => v.product_id)).size === 1) {
    console.log('BOHO_COLOR_VARIANTS_READY 12'); return
  }
  if (baseMatches.length !== 1 || childMatches.length) throw Error('Partial or ambiguous Boho color variant set needs review')
  const base = baseMatches[0]
  const { data } = await query.graph({ entity: 'product', filters: { id: base.product_id }, fields: [
    'id', 'title', 'options.id', 'options.title', 'options.values.id', 'options.values.value',
    'variants.id', 'variants.title', 'variants.sku', 'variants.allow_backorder', 'variants.manage_inventory',
    'variants.requires_shipping', 'variants.hs_code', 'variants.origin_country', 'variants.mid_code',
    'variants.material', 'variants.weight', 'variants.length', 'variants.height', 'variants.width',
    'variants.metadata', 'variants.options.value', 'variants.options.option.title',
    'variants.price_set.prices.amount', 'variants.price_set.prices.currency_code',
    'variants.price_set.prices.min_quantity', 'variants.price_set.prices.max_quantity',
    'variants.inventory_items.inventory_item_id',
  ] })
  const product = data[0], baseRow = product?.variants?.find(v => v.id === base.id)
  if (!product || !/birds/i.test(product.title || '') || !baseRow || product.variants.length !== 1 || ![1, 2].includes(product.options?.length)) throw Error('Unexpected Boho product shape')
  if (!baseRow.allow_backorder || !baseRow.manage_inventory || baseRow.requires_shipping === false) throw Error('Base inventory policy changed')
  const prices = baseRow.price_set?.prices || []
  await fs.writeFile('/tmp/boho-color-preflight.json', JSON.stringify({ checkedAt: new Date().toISOString(), productId: product.id,
    productTitle: product.title, baseVariantId: baseRow.id, baseSku: baseRow.sku,
    prices: prices.map(p => ({ amount: p.amount, currency_code: p.currency_code, min_quantity: p.min_quantity, max_quantity: p.max_quantity })) }, null, 2), { mode: 0o600 })
  if (prices.length !== 1 || prices[0].currency_code?.toLowerCase() !== 'usd' || prices[0].amount !== 12 || prices[0].min_quantity != null || prices[0].max_quantity != null) throw Error('Expected one 12 USD base price')
  const singleton = product.options.find(o => o.values?.length === 1 && o.values[0].value === 'Default Title')
  let colorOption = product.options.find(o => o.title === 'Color' && o.values?.length === colors.length && colors.every(([color]) => o.values.some(v => v.value === color)))
  if (!singleton?.id) throw Error('Unexpected base option')
  const links = baseRow.inventory_items || []
  if (links.length !== 1) throw Error('Expected one base inventory item')
  const item = await inventory.retrieveInventoryItem(links[0].inventory_item_id)
  if (!['38316', '38316-CREAM'].includes(item.sku)) throw Error('Base inventory SKU changed')

  const report = { startedAt: new Date().toISOString(), complete: false, productId: product.id,
    baseVariantId: baseRow.id, baseSku: baseRow.sku, created: [], inventoryQuantitiesChanged: false }
  const save = () => fs.writeFile('/tmp/boho-color-variants.json', JSON.stringify(report, null, 2), { mode: 0o600 })
  await save()
  if (singleton.title !== 'Style') {
    await updateProductOptionsWorkflow(container).run({ input: { selector: { id: singleton.id }, update: { title: 'Style' } } })
  }
  if (!colorOption) {
    const { result } = await createProductOptionsWorkflow(container).run({ input: { product_options: [{
      title: 'Color', values: colors.map(([color]) => color), is_exclusive: true,
      metadata: { purpose: 'base_claw_color' },
    }] } })
    colorOption = result[0]
    await products.addProductOptionToProduct({ product_id: product.id, product_option_id: colorOption.id })
  }
  if (item.sku !== '38316-CREAM') await inventory.updateInventoryItems({ id: item.id, sku: '38316-CREAM' })
  await updateProductVariantsWorkflow(container).run({ input: { product_variants: [{ id: baseRow.id, title: 'CREAM', sku: '38316-CREAM',
    options: { Style: 'Default Title', Color: 'CREAM' }, metadata: { ...baseRow.metadata, base_sku: '38316', base_claw_color: 'CREAM', inventory_mode: 'made_to_order_color_option' } }] } })

  const { result } = await createProductVariantsWorkflow(container).run({ input: { product_variants: colors.slice(1).map(([color, sku]) => ({
    product_id: product.id, title: color, sku, allow_backorder: true, manage_inventory: true, requires_shipping: true,
    hs_code: baseRow.hs_code, origin_country: baseRow.origin_country, mid_code: baseRow.mid_code, material: baseRow.material,
    weight: baseRow.weight, length: baseRow.length, height: baseRow.height, width: baseRow.width,
    options: { Style: 'Default Title', Color: color }, prices: [{ currency_code: 'usd', amount: 12 }],
    metadata: { base_sku: '38316', base_claw_color: color, inventory_mode: 'made_to_order_color_option' },
  })) } })
  report.created = [{ id: baseRow.id, sku: '38316-CREAM', title: 'CREAM' }, ...result.map(v => ({ id: v.id, sku: v.sku, title: v.title }))]
  const savedItem = await inventory.retrieveInventoryItem(item.id)
  if (report.created.length !== 12 || new Set(report.created.map(v => v.sku)).size !== 12 || savedItem.sku !== '38316-CREAM') throw Error('Final verification failed')
  report.complete = true; report.completedAt = new Date().toISOString(); await save()
  console.log('BOHO_COLOR_VARIANTS_READY 12')
}
