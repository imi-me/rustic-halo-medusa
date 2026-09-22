import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planImport, planQuantityEvent } from './plan-import.mjs'

const now = Date.parse('2026-09-21T01:47:22Z')
function inputs() {
  const common = { schemaVersion: 1, complete: true, capturedAt: new Date(now).toISOString(), sourceLocationId: 'gid://shopify/Location/79837790404' }
  return [
    { ...common, source: 'medusa', locationId: 'copper', items: [] },
    { ...common, source: 'marketsuite', accountId: 'owner', locationId: 'portal', items: [{ id: 'ms', asStockId: '00123', quantity: 0 }] },
    { schemaVersion: 1, accountId: 'owner', medusaLocationId: 'copper', marketLocationId: 'portal', items: [{ medusaItemId: 'inv', marketItemId: 'ms', asStockId: '00123' }] },
    { schemaVersion: 1, complete: true, capturedAt: common.capturedAt, source: 'medusa', locationId: 'copper', itemIds: ['inv'] },
  ]
}
test('proposes zero only for a verified existing inventory item missing its level', () => {
  const args = inputs(), before = structuredClone(args)
  const result = planImport(...args, now)
  assert.equal(result.proposals.length, 1)
  assert.equal(result.proposals[0].stockedQuantity, 0)
  assert.equal(result.proposals[0].locationId, 'copper')
  assert.equal(result.requiresReview, true)
  assert.deepEqual(args, before)
})
test('unknown items, positive quantities and AS mismatch stay in review', () => {
  for (const change of [x => { x[3].itemIds = [] }, x => { x[1].items[0].quantity = 3 }, x => { x[1].items[0].asStockId = 'other' }]) {
    const args = inputs(); change(args)
    const result = planImport(...args, now)
    assert.equal(result.proposals.length, 0)
    assert.equal(result.review.length, 1)
  }
})
test('existing level is never recreated; difference requires review', () => {
  const args = inputs()
  args[0].items.push({ id: 'inv', stocked: 2, reserved: 0, available: 2 })
  assert.equal(planImport(...args, now).review[0].status, 'quantity-review')
  args[1].items[0].quantity = 2
  assert.deepEqual(planImport(...args, now).proposals, [])
})
test('incomplete identity read cannot establish missing stock', () => {
  const args = inputs(); args[3].complete = false
  assert.throws(() => planImport(...args, now))
})
const scope = { accountId: 'owner', locationId: 'copper' }
const state = { itemId: 'inv', quantity: 4, version: 0, receipts: [] }
const sale = { ...scope, id: 'event-1', itemId: 'inv', origin: 'marketsuite', expectedVersion: 0, quantity: 3 }
test('sale signal proposes quantity only; duplicate replay creates no second write', () => {
  const result = planQuantityEvent(state, sale, scope)
  assert.equal(result.writes[0].destination, 'medusa')
  assert.equal(result.writes[0].quantity, 3)
  assert.equal(planQuantityEvent(result.next, sale, scope).status, 'duplicate')
  assert.equal(state.quantity, 4)
  assert.throws(() => planQuantityEvent(result.next, { ...sale, quantity: 2 }, scope))
})
test('concurrent restock conflicts; acknowledged echo does not bounce back', () => {
  const result = planQuantityEvent(state, sale, scope)
  assert.equal(planQuantityEvent(result.next, { ...sale, id: 'restock', origin: 'medusa', quantity: 8 }, scope).status, 'conflict')
  const echo = planQuantityEvent(result.next, { ...sale, id: 'echo', origin: 'medusa', expectedVersion: 1 }, scope)
  assert.deepEqual(echo.writes, [])
})
test('failed transport must retain old state, allowing the same proposal to retry', () => {
  const proposed = planQuantityEvent(state, sale, scope)
  // Simulate failure by discarding next; only a successful transactional executor may save it.
  assert.deepEqual(planQuantityEvent(state, sale, scope), proposed)
})
test('reject wrong account/location, invalid origin, and invalid quantities', () => {
  for (const changes of [{ accountId: 'other' }, { locationId: 'demo' }, { origin: 'AS' }, { quantity: -1 }, { quantity: null }]) {
    assert.throws(() => planQuantityEvent(state, { ...sale, ...changes }, scope))
  }
})
