import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readMedusaInventory } from './read-medusa-inventory.mjs'

const time = Date.now()
const options = { origin: 'https://inventory.example.test', key: 'test-only-credential-00000000000000000', locationId: 'copper', now: () => time }
const item = i => ({ id: `inv_${i}`, stocked: 4, reserved: 1, available: 3 })
const page = (items = [item(1)], extra = {}) => ({ schemaVersion: 1, source: 'medusa', locationId: 'copper', sourceLocationId: 'gid://shopify/Location/79837790404', capturedAt: new Date(time).toISOString(), consistency: 'paginated-non-atomic', complete: true, items, nextOffset: null, ...extra })
const response = body => ({ ok: true, json: async () => body })

test('uses bearer header and rejects redirects; returns only inventory fields', async () => {
  const result = await readMedusaInventory({ ...options, fetchImpl: async (url, init) => {
    assert.equal(url.pathname, '/integrations/marketsuite/inventory')
    assert.equal(url.search, '?offset=0')
    assert.equal(init.headers.Authorization, `Bearer ${options.key}`)
    assert.equal(init.redirect, 'error')
    assert.equal(init.method, 'GET')
    return response(page([{ ...item(1), customer: 'must not forward' }]))
  } })
  assert.deepEqual(result.items, [item(1)])
  assert.equal(result.complete, true)
})
test('collects every page before declaring completeness', async () => {
  const pages = [page(Array.from({length:100}, (_, i) => item(i)), { complete:false, nextOffset:100 }), page([item(100)], {complete:false})]
  const offsets = []
  const result = await readMedusaInventory({ ...options, fetchImpl: async url => { offsets.push(url.searchParams.get('offset')); return response(pages.shift()) } })
  assert.deepEqual(offsets, ['0','100'])
  assert.equal(result.items.length, 101)
})
test('failed second page returns no partial snapshot and hides raw error', async () => {
  let calls = 0
  await assert.rejects(readMedusaInventory({ ...options, fetchImpl: async () => {
    if (++calls === 1) return response(page(Array.from({length:100}, (_, i) => item(i)), {complete:false,nextOffset:100}))
    throw new Error(options.key)
  } }), error => !error.message.includes(options.key) && error.message.includes('no complete snapshot'))
})
test('rejects location changes, stale data, duplicate IDs and malformed continuation', async () => {
  for (const bad of [page([], {locationId:'demo'}), page([], {capturedAt:'2000-01-01'}), page([item(1),item(1)]), page([], {nextOffset:100,complete:false}), page([{...item(1),available:8}])]) {
    await assert.rejects(readMedusaInventory({...options,fetchImpl:async()=>response(bad)}))
  }
})
test('never sends credential to insecure or credential-bearing URLs', async () => {
  for (const origin of ['http://inventory.example.test','https://user:secret@inventory.example.test','https://inventory.example.test/?key=x']) {
    await assert.rejects(readMedusaInventory({...options,origin,fetchImpl:async()=>assert.fail('must not send request')}))
  }
})
test('unauthorized response is not interpreted as an empty catalog', async () => {
  await assert.rejects(readMedusaInventory({...options,fetchImpl:async()=>({ok:false,status:401})}), /no complete snapshot/)
})
