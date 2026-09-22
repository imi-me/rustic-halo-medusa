import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const copperMill = 'gid://shopify/Location/79837790404'
function index(rows, label) {
  if (!Array.isArray(rows)) throw new Error(`${label}: missing items`)
  const result = new Map()
  for (const row of rows) {
    if (!row || typeof row.id !== 'string' || !row.id || result.has(row.id)) {
      throw new Error(`${label}: missing or duplicate item ID`)
    }
    result.set(row.id, row)
  }
  return result
}

// Offline only. No network, database writes, customer data, or inferred SKU links.
export function compareInventory(medusa, market, mapping, now = Date.now()) {
  for (const [snapshot, source] of [[medusa, 'medusa'], [market, 'marketsuite']]) {
    if (snapshot.schemaVersion !== 1 || snapshot.source !== source || snapshot.complete !== true ||
        snapshot.sourceLocationId !== copperMill || !snapshot.locationId) {
      throw new Error(`${source}: incomplete or incorrectly scoped snapshot`)
    }
    const captured = Date.parse(snapshot.capturedAt)
    if (!Number.isFinite(captured) || captured > now || now - captured > 15 * 60 * 1000) {
      throw new Error(`${source}: snapshot must be captured within the last 15 minutes`)
    }
  }
  if (!market.accountId || mapping.accountId !== market.accountId ||
      mapping.medusaLocationId !== medusa.locationId || mapping.marketLocationId !== market.locationId ||
      mapping.schemaVersion !== 1 || !Array.isArray(mapping.items)) throw new Error('Mapping scope mismatch')
  const left = index(medusa.items, 'medusa')
  const right = index(market.items, 'marketsuite')
  for (const row of left.values()) {
    if (![row.stocked, row.reserved, row.available].every(Number.isSafeInteger) ||
        row.reserved < 0 || row.available !== row.stocked - row.reserved) throw new Error('Invalid Medusa quantities')
  }
  for (const row of right.values()) if (!Number.isSafeInteger(row.quantity)) throw new Error('Invalid MarketSuite quantity')
  const usedLeft = new Set(), usedRight = new Set(), usedAS = new Set()
  const rows = []
  for (const link of mapping.items) {
    if (![link.medusaItemId, link.marketItemId, link.asStockId].every(v => typeof v === 'string' && v.trim()) ||
        usedLeft.has(link.medusaItemId) || usedRight.has(link.marketItemId) || usedAS.has(link.asStockId)) {
      throw new Error('Missing or duplicate mapping IDs')
    }
    usedLeft.add(link.medusaItemId); usedRight.add(link.marketItemId); usedAS.add(link.asStockId)
    const a = left.get(link.medusaItemId), b = right.get(link.marketItemId)
    if (!a || !b) {
      rows.push({ ...link, status: 'missing-item', missingFrom: !a ? 'medusa' : 'marketsuite' })
      continue
    }
    if (b.asStockId !== link.asStockId) throw new Error('AS stock ID does not match reviewed mapping')
    rows.push({ ...link, status: a.reserved !== 0 ? 'reservation-review' : a.stocked === b.quantity ? 'match' : 'quantity-review',
      medusaStocked: a.stocked, medusaReserved: a.reserved, medusaAvailable: a.available, marketQuantity: b.quantity })
  }
  for (const id of left.keys()) if (!usedLeft.has(id)) rows.push({ medusaItemId: id, status: 'unmapped-medusa' })
  for (const id of right.keys()) if (!usedRight.has(id)) rows.push({ marketItemId: id, status: 'unmapped-marketsuite' })
  return { readOnly: true, cutoverApproved: false, note: 'Snapshot comparison only; not a live AS observation or atomic cutover baseline.',
    counts: rows.reduce((counts, row) => { counts[row.status] = (counts[row.status] ?? 0) + 1; return counts }, {}), rows }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 5) throw new Error('Usage: node compare-inventory.mjs medusa.json marketsuite.json mapping.json')
    const files = await Promise.all(process.argv.slice(2).map(async p => JSON.parse(await readFile(p, 'utf8'))))
    process.stdout.write(JSON.stringify(compareInventory(...files), null, 2) + '\n')
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
