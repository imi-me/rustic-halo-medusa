import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compareInventory } from './compare-inventory.mjs'

const now = Date.parse('2026-09-20T20:00:00Z')
function fixture() {
  const common = { schemaVersion: 1, complete: true, capturedAt: new Date(now).toISOString(), sourceLocationId: 'gid://shopify/Location/79837790404' }
  return [
    { ...common, source: 'medusa', locationId: 'loc', items: [{ id: 'inv', stocked: 4, reserved: 0, available: 4 }] },
    { ...common, source: 'marketsuite', locationId: 'market', accountId: 'owner', items: [{ id: 'product', asStockId: 'AS1', quantity: 4 }] },
    { schemaVersion: 1, accountId: 'owner', medusaLocationId: 'loc', marketLocationId: 'market', items: [{ medusaItemId: 'inv', marketItemId: 'product', asStockId: 'AS1' }] },
  ]
}
test('matching snapshots do not authorize cutover or mutate inputs', () => {
  const inputs = fixture(), before = structuredClone(inputs)
  const report = compareInventory(...inputs, now)
  assert.deepEqual(report.counts, { match: 1 })
  assert.equal(report.cutoverApproved, false)
  assert.deepEqual(inputs, before)
})
test('stock difference and reservations require review', () => {
  const inputs = fixture()
  inputs[1].items[0].quantity = 2
  assert.equal(compareInventory(...inputs, now).rows[0].status, 'quantity-review')
  inputs[0].items[0].reserved = 2; inputs[0].items[0].available = 2
  assert.equal(compareInventory(...inputs, now).rows[0].status, 'reservation-review')
})
test('missing and unmapped items never become zero quantities or SKU matches', () => {
  const inputs = fixture()
  inputs[0].items[0].id = 'other'
  const report = compareInventory(...inputs, now)
  assert.deepEqual(report.counts, { 'missing-item': 1, 'unmapped-medusa': 1 })
  assert.equal('medusaStocked' in report.rows[0], false)
})
test('rejects stale, incomplete, cross-account and wrong-location data', () => {
  for (const change of [
    x => { x[0].capturedAt = '2026-09-19T00:00:00Z' },
    x => { x[1].complete = false },
    x => { x[2].accountId = 'another' },
    x => { x[0].sourceLocationId = 'online' },
    x => { x[1].items[0].quantity = null },
    x => { x[1].items[0].asStockId = 'wrong' },
    x => { x[0].items.push(x[0].items[0]) },
    x => { x[2].items.push(x[2].items[0]) },
  ]) { const inputs = fixture(); change(inputs); assert.throws(() => compareInventory(...inputs, now)) }
})
