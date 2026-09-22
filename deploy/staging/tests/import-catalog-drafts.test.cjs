const { test } = require('node:test')
const assert = require('node:assert/strict')
const { plan } = require('../import-catalog-drafts.cjs')
function fixture() { return { products: [{ id: 'source1', title: 'Coasters', handle: 'coasters', productType: 'coasters',
  descriptionHtml: '<p>Sample</p>', options: [{ name: 'Color', values: ['Blue'] }],
  media: { pageInfo: { hasNextPage: false }, nodes: [] }, variantsCount: { count: 1 },
  variants: { pageInfo: { hasNextPage: false }, nodes: [{ id: 'variant1', title: 'Blue', sku: 'C1', price: '18.00',
    selectedOptions: [{ name: 'Color', value: 'Blue' }], inventoryItem: { id: 'inventory1', measurement: { weight: { unit: 'OUNCES', value: 1 } } } }] } }] } }
test('new coasters are drafts without sales channels or inventory levels', () => {
  const p = plan(fixture(), []).create[0]
  assert.equal(p.status, 'draft'); assert.equal(p.metadata.shipping_setup, 'packaging_pending')
  assert.equal(p.sales_channels, undefined); assert.equal(p.variants[0].inventory_items, undefined)
  assert.equal(p.variants[0].weight, 28.35); assert.equal(p.variants[0].prices[0].amount, 18)
})
test('source identity preserves existing edits and makes reruns no-ops', () => {
  const existing = [{ id: 'p1', handle: 'edited-handle', metadata: { shopify_id: 'source1' }, variants: [{ sku: 'C1' }] }]
  assert.deepEqual(plan(fixture(), existing), { preserve: ['p1'], create: [] })
})
test('unrelated handle and SKU collisions fail before creation', () => {
  assert.throws(() => plan(fixture(), [{ id: 'p2', handle: 'coasters', variants: [] }]), /identity conflict/)
  assert.throws(() => plan(fixture(), [{ id: 'p2', handle: 'other', variants: [{ sku: 'C1' }] }]), /SKU conflict/)
})
test('truncated source fails and missing SKU remains blank with review flag', () => {
  const source = fixture(); source.products[0].variants.pageInfo.hasNextPage = true
  assert.throws(() => plan(source, []), /Incomplete/)
  source.products[0].variants.pageInfo.hasNextPage = false
  source.products[0].variants.nodes[0].sku = ''
  const v = plan(source, []).create[0].variants[0]
  assert.equal(v.sku, undefined); assert.equal(v.metadata.sku_review_required, true)
})
