import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildIdentityMapping } from './build-identity-mapping.mjs'

const now = Date.parse('2026-09-21T18:00:00Z')
const common = { schemaVersion: 1, complete: true, sourceLocationId: 'gid://shopify/Location/79837790404', capturedAt: new Date(now).toISOString() }

function fixture() {
  return [
    { ...common, source: 'medusa', locationId: 'loc_copper', items: [{ id: 'inv_1', shopifyVariantId: 'gid://shopify/ProductVariant/46129682546884' }] },
    { ...common, source: 'marketsuite', accountId: 'rustic-halo', locationId: 'portal', items: [{ id: 'portal_1', shopifyVariantId: '46129682546884', asStockId: '08887236' }] },
  ]
}

test('builds a reviewed mapping from preserved Shopify variant IDs, never SKU', () => {
  const [medusa, market] = fixture()
  const output = buildIdentityMapping(medusa, market, now)
  assert.deepEqual(output.mapping.items, [{ medusaItemId: 'inv_1', marketItemId: 'portal_1', asStockId: '08887236', shopifyVariantId: 'gid://shopify/ProductVariant/46129682546884' }])
  assert.equal(output.readOnly, true)
  assert.equal(output.cutoverApproved, false)
})

test('missing records are review items and never inferred as zero inventory', () => {
  const [medusa, market] = fixture()
  market.items = []
  const output = buildIdentityMapping(medusa, market, now)
  assert.deepEqual(output.mapping.items, [])
  assert.deepEqual(output.review, [{ shopifyVariantId: 'gid://shopify/ProductVariant/46129682546884', status: 'missing-marketsuite' }])
})

test('rejects duplicate variant identities and noncanonical data', () => {
  const [medusa, market] = fixture()
  medusa.items.push({ id: 'inv_2', shopifyVariantId: '46129682546884' })
  assert.throws(() => buildIdentityMapping(medusa, market, now), /duplicate Shopify variant ID/)
  medusa.items = [{ id: 'inv_1', shopifyVariantId: 'not-a-variant' }]
  assert.throws(() => buildIdentityMapping(medusa, market, now), /invalid Shopify variant ID/)
})

test('rejects stale or wrongly scoped snapshots', () => {
  const [medusa, market] = fixture()
  medusa.capturedAt = '2020-01-01T00:00:00.000Z'
  assert.throws(() => buildIdentityMapping(medusa, market, now), /within the last 15 minutes/)
  medusa.capturedAt = new Date(now).toISOString()
  market.sourceLocationId = 'gid://shopify/Location/other'
  assert.throws(() => buildIdentityMapping(medusa, market, now), /incorrectly scoped/)
})
