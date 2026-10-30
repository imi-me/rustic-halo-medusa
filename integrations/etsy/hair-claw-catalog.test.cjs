const test = require('node:test')
const assert = require('node:assert/strict')
const { buildHairClawDraft, planMissingColorVariants } = require('./hair-claw-catalog.cjs')
const policy = require('./hair-claw-color-policy.json')

test('draft keeps only actual size offers and preserves base SKUs and barcodes', () => {
  const product = buildHairClawDraft({
    title: 'Test Claw', handle: 'test-claw', description: 'Draft only', shipping_profile_id: 'sp_test',
    baseVariants: [
      { baseSku: '39000-2', title: '2 inch', barcode: 'INV123', options: { Size: '2 inch' }, prices: [{ currency_code: 'usd', amount: 10 }], weight: 48 },
      { baseSku: '39000-4', title: '4 inch', options: { Size: '4 inch' }, prices: [{ currency_code: 'usd', amount: 14 }], weight: 64 },
    ],
  }, policy)
  assert.equal(product.status, 'draft')
  assert.equal(product.variants.length, 2)
  assert.equal(new Set(product.variants.map(row => row.sku)).size, 2)
  assert.ok(product.variants.some(row => row.sku === '39000-2' && !row.options.Color && row.weight === 48))
  assert.ok(product.variants.every(row => row.allow_backorder && row.manage_inventory && row.metadata.inventory_mode === 'made_to_order'))
  assert.ok(product.variants.every(row => !Object.hasOwn(row, 'baseSku')))
  assert.equal(product.variants[0].barcode, 'INV123')
  assert.ok(!product.options.some(row => row.title === 'Color'))
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

test('adding colors never generates variants or new stock identifiers', () => {
  const result = planMissingColorVariants([{id:'p',variants:[]}], policy, 'Black')
  assert.equal(result.variantCount, 0)
  assert.deepEqual(result.products, [])
})
