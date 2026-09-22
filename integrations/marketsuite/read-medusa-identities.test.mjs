import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readMedusaIdentities } from './read-medusa-identities.mjs'

const time = Date.now()
const options = { origin: 'https://inventory.example.test', key: 'test-only-credential-00000000000000000', locationId: 'copper', now: () => time }
const item = i => ({ id: `inv_${i}`, shopifyVariantId: `gid://shopify/ProductVariant/${i + 1}` })
const page = (items = [item(1)], extra = {}) => ({ schemaVersion: 1, source: 'medusa', locationId: 'copper', sourceLocationId: 'gid://shopify/Location/79837790404', capturedAt: new Date(time).toISOString(), consistency: 'paginated-non-atomic', complete: true, items, nextOffset: null, ...extra })
const response = body => ({ ok: true, json: async () => body })

test('uses the catalog endpoint and only returns approved identity fields', async () => {
  const result = await readMedusaIdentities({ ...options, fetchImpl: async (url, init) => {
    assert.equal(url.pathname, '/integrations/marketsuite/catalog')
    assert.equal(init.headers.Authorization, `Bearer ${options.key}`)
    return response(page([{ ...item(1), sku: 'must-not-forward' }]))
  } })
  assert.deepEqual(result.items, [item(1)])
})
test('collects every identity page and rejects malformed or failed reads', async () => {
  const pages = [page(Array.from({ length: 100 }, (_, i) => item(i)), { complete: false, nextOffset: 100 }), page([item(100)], { complete: false })]
  const result = await readMedusaIdentities({ ...options, fetchImpl: async () => response(pages.shift()) })
  assert.equal(result.items.length, 101)
  await assert.rejects(readMedusaIdentities({ ...options, fetchImpl: async () => ({ ok: false }) }), /no complete snapshot/)
  await assert.rejects(readMedusaIdentities({ ...options, fetchImpl: async () => response(page([{ id: 'inv', shopifyVariantId: 'bad' }])) }))
})
