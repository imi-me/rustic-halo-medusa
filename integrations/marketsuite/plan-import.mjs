import { compareInventory } from './compare-inventory.mjs'

// Produces review proposals only. A separate, transactional executor is required.
// catalog is an independently read list of real Medusa inventory item IDs.
export function planImport(medusa, market, mapping, catalog, now = Date.now()) {
  const comparison = compareInventory(medusa, market, mapping, now)
  if (catalog.schemaVersion !== 1 || catalog.complete !== true ||
      catalog.source !== 'medusa' || catalog.locationId !== medusa.locationId ||
      catalog.capturedAt !== medusa.capturedAt || !Array.isArray(catalog.itemIds) ||
      catalog.itemIds.some(id => typeof id !== 'string' || !id.trim()) ||
      new Set(catalog.itemIds).size !== catalog.itemIds.length) {
    throw new Error('A complete matching Medusa inventory identity snapshot is required')
  }
  const known = new Set(catalog.itemIds)
  const proposals = [], review = []
  for (const row of comparison.rows) {
    if (row.status === 'match') continue
    if (row.status !== 'missing-item' || row.missingFrom !== 'medusa' || !known.has(row.medusaItemId)) {
      review.push(row)
      continue
    }
    const source = market.items.find(item => item.id === row.marketItemId)
    if (!source || source.asStockId !== row.asStockId || source.quantity !== 0) {
      review.push({ ...row, reason: 'Missing level requires verified AS mapping and explicit source zero; positive quantities need reconciliation' })
      continue
    }
    proposals.push({ operation: 'create-missing-zero-level', inventoryItemId: row.medusaItemId,
      locationId: medusa.locationId, stockedQuantity: 0,
      preconditions: { levelMustBeAbsent: true, marketItemId: row.marketItemId,
        marketQuantityMustEqual: 0, sourceCapturedAt: market.capturedAt } })
  }
  return { readOnly: true, requiresReview: true, proposals, review }
}

// Pure staging model for a future connector, not a live webhook handler.
// Versions and receipts must eventually be stored transactionally with inventory.
export function planQuantityEvent(state, event, scope) {
  if (event.accountId !== scope.accountId || event.locationId !== scope.locationId ||
      event.itemId !== state.itemId || !['medusa', 'marketsuite'].includes(event.origin) ||
      typeof event.id !== 'string' || !event.id.trim()) throw new Error('Invalid event scope or identity')
  if (![state.version, state.quantity, event.expectedVersion, event.quantity].every(Number.isSafeInteger) ||
      state.version < 0 || event.expectedVersion < 0 || state.quantity < 0 || event.quantity < 0 ||
      !Array.isArray(state.receipts)) throw new Error('Invalid event quantities or state')
  const receipt = state.receipts.find(r => r.origin === event.origin && r.id === event.id)
  if (receipt) {
    if (receipt.quantity !== event.quantity || receipt.expectedVersion !== event.expectedVersion) throw new Error('Event ID reused with different content')
    return { status: 'duplicate', next: state, writes: [] }
  }
  if (event.expectedVersion !== state.version) return { status: 'conflict', next: state, writes: [] }
  const nextVersion = state.version + 1
  if (!Number.isSafeInteger(nextVersion)) throw new Error('Version overflow')
  const next = { ...state, version: nextVersion, quantity: event.quantity,
    receipts: [...state.receipts, { origin: event.origin, id: event.id, quantity: event.quantity, expectedVersion: event.expectedVersion }] }
  return { status: event.quantity === state.quantity ? 'unchanged' : 'proposed', next,
    writes: event.quantity === state.quantity ? [] : [{ destination: event.origin === 'medusa' ? 'marketsuite' : 'medusa',
      accountId: scope.accountId, locationId: scope.locationId, itemId: state.itemId,
      quantity: event.quantity, causationId: event.id }] }
}
