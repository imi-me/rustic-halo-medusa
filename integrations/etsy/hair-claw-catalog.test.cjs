const test = require('node:test')
const assert = require('node:assert/strict')
const { buildHairClawDraft, planMissingColorVariants } = require('./hair-claw-catalog.cjs')
const policy = require('./hair-claw-color-policy.json')

test('draft template generates all color SKUs while preserving base facts', () => {
  const product = buildHairClawDraft({
    title: 'Test Claw', handle: 'test-claw', description: 'Draft only', shipping_profile_id: 'sp_test',
    baseVariants: [
      { baseSku: '39000-2', title: '2 inch', options: { Size: '2 inch' }, prices: [{ currency_code: 'usd', amount: 10 }], weight: 48 },
      { baseSku: '39000-4', title: '4 inch', options: { Size: '4 inch' }, prices: [{ currency_code: 'usd', amount: 14 }], weight: 64 },
    ],
  }, policy)
  assert.equal(product.status, 'draft')
  assert.equal(product.variants.length, 24)
  assert.equal(new Set(product.variants.map(row => row.sku)).size, 24)
  assert.ok(product.variants.some(row => row.sku === '39000-2-SKY-BL' && row.options.Color === 'SKY BLUE' && row.weight === 48))
  assert.ok(product.variants.every(row => row.allow_backorder && row.manage_inventory && row.metadata.inventory_mode === 'made_to_order_color_option'))
  assert.ok(product.variants.every(row => !Object.hasOwn(row, 'baseSku')))
})

test('draft template rejects duplicate generated SKUs and existing Color options', () => {
  const base = { title: 'Bad', handle: 'bad', shipping_profile_id: 'sp_test', baseVariants: [
    { baseSku: '39000', options: { Style: 'One' }, prices: [{ currency_code: 'usd', amount: 10 }] },
    { baseSku: '39000', options: { Style: 'Two' }, prices: [{ currency_code: 'usd', amount: 10 }] },
  ] }
  assert.throws(() => buildHairClawDraft(base, policy), /unique/)
  base.baseVariants = [{ baseSku: '39000', options: { Color: 'Cream' }, prices: [{ currency_code: 'usd', amount: 10 }] }]
  assert.throws(() => buildHairClawDraft(base, policy), /already contains Color/)
  assert.throws(() => buildHairClawDraft({ title: 'Bad', handle: 'bad', baseVariants: [] }, policy), /Shipping profile/)
})

test('new color planner creates only missing combinations', () => {
  const colors = { ...policy, colors: [...policy.colors, { name: 'LAVENDER', suffix: 'LAV' }] }
  const source = color => ({
    id: `v_${color}`, title: color, sku: `39000-${color}`, options: [{ value: color, option: { title: 'Color' } }],
    price_set: { prices: [{ currency_code: 'usd', amount: 12 }] }, weight: 64,
    metadata: { base_sku: '39000', base_claw_color: color, inventory_mode: 'made_to_order_color_option' },
  })
  const first = { id: 'p1', variants: [source('CREAM'), source('Black')] }
  const completeCream = source('CREAM')
  completeCream.sku = '39001-CREAM'
  completeCream.metadata = { ...completeCream.metadata, base_sku: '39001' }
  const completeLavender = source('LAVENDER')
  completeLavender.sku = '39001-LAV'
  completeLavender.metadata = { ...completeLavender.metadata, base_sku: '39001' }
  const complete = { id: 'p2', variants: [completeCream, completeLavender] }
  const result = planMissingColorVariants([first, complete], colors, 'LAVENDER')
  assert.equal(result.variantCount, 1)
  assert.equal(result.products[0].additions[0].sku, '39000-LAV')
  assert.equal(result.products[0].additions[0].options.Color, 'LAVENDER')
  assert.equal(result.products[0].additions[0].weight, 64)
})

test('new color planner rejects a base SKU reused across products', () => {
  const colors = { ...policy, colors: [...policy.colors, { name: 'LAVENDER', suffix: 'LAV' }] }
  const source = productId => ({
    id: `v_${productId}`, title: 'CREAM', sku: '39000-CREAM',
    options: [{ value: 'CREAM', option: { title: 'Color' } }],
    price_set: { prices: [{ currency_code: 'usd', amount: 12 }] },
    metadata: { base_sku: '39000', base_claw_color: 'CREAM', inventory_mode: 'made_to_order_color_option' },
  })
  assert.throws(() => planMissingColorVariants([
    { id: 'p1', variants: [source('p1')] }, { id: 'p2', variants: [source('p2')] },
  ], colors, 'LAVENDER'), /collision/)
})
