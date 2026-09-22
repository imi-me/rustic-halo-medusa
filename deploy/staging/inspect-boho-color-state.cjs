exports.default = async function ({ container }) {
  const products = container.resolve('product')
  const inventory = container.resolve('inventory')
  const query = container.resolve('query')
  const variants = await products.listProductVariants({ product_id: 'prod_01M30YT92R4378S72RJ69W3WW6' })
  const { data } = await query.graph({
    entity: 'product',
    filters: { id: 'prod_01M30YT92R4378S72RJ69W3WW6' },
    fields: [
      'id', 'title', 'options.id', 'options.title', 'options.values.id', 'options.values.value',
      'variants.id', 'variants.title', 'variants.sku', 'variants.options.value',
      'variants.inventory_items.inventory_item_id',
    ],
  })
  const inventoryItems = []
  for (const variant of data[0]?.variants || []) {
    for (const link of variant.inventory_items || []) {
      const item = await inventory.retrieveInventoryItem(link.inventory_item_id)
      inventoryItems.push({ id: item.id, sku: item.sku, variant_id: variant.id })
    }
  }
  console.log('BOHO_STATE ' + JSON.stringify({ product: data[0], serviceVariants: variants.map(v => ({ id: v.id, sku: v.sku })), inventoryItems }))
}
