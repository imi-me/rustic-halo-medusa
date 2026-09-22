const fs = require('node:fs/promises')
exports.default = async function ({ container }) {
  const query = container.resolve('query')
  const plan = JSON.parse(await fs.readFile('/tmp/hair-claw-color-plan.json', 'utf8'))
  const ids = [...new Set(plan.listings.filter(l => l.status === 'planned').flatMap(l => l.baseProducts.map(b => b.medusaProductId)))]
  const rows = []
  for (const id of ids) {
    const { data } = await query.graph({ entity: 'product', filters: { id }, fields: [
      'id', 'title', 'options.id', 'options.title', 'options.values.value',
      'variants.id', 'variants.title', 'variants.sku', 'variants.options.value', 'variants.options.option.title',
    ] })
    rows.push(data[0] || { id, missing: true })
  }
  await fs.writeFile('/tmp/medusa-hair-claw-shapes.json', JSON.stringify(rows, null, 2), { mode: 0o600 })
  console.log(`MEDUSA_HAIR_CLAW_SHAPES_READY ${rows.length}`)
}
