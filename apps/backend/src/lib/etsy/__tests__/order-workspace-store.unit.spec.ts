jest.mock('../listing-workspace', () => ({ etsyWorkspaceAccess: jest.fn(async () => ({ shopId: 77, scopes: ['transactions_r'], headers: { Authorization: 'Bearer test' } })) }))
import { randomUUID } from 'node:crypto'
import { readOrderWorkspace, refreshOrderWorkspace, savePreparation } from '../order-workspace-store'
const raw = () => ({ receipt_id: 99, is_paid: true, is_shipped: false, status: 'paid', create_timestamp: Math.floor(Date.now()/1000), update_timestamp: 1780000100, name: 'Do not persist me', first_line: 'Private address', transactions: [{ transaction_id: 1, title: 'Claw', sku: 'CLAW', quantity: 1, expected_ship_date: 1780000300, variations: [{ formatted_name: 'Personalization', formatted_value: 'Private engraving' }] }] })
// PostgreSQL JSONB does not retain object insertion order. Model that roundtrip.
function databaseRoundtrip(value: any): any {
 if (Array.isArray(value)) return value.map(databaseRoundtrip)
 if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, databaseRoundtrip(value[key])]))
 return value
}
function fixture() {
 const records: any[] = []
 const ops = {
  listAdminOperations: jest.fn(async (filter: any) => records.filter(row => Object.entries(filter).every(([k,v]) => row[k] === v)).map(databaseRoundtrip)),
  createAdminOperations: jest.fn(async (data: any) => { const row = { id: randomUUID(), ...data }; records.push(row); return row }),
  updateAdminOperations: jest.fn(async (data: any) => { const row = records.find(r => r.id === data.id); Object.assign(row, data); return row }),
 }
 const products = { listProductVariants: jest.fn(async () => [{ id: 'variant_1', sku: 'CLAW', product_id: 'prod_1' }]) }
 const locks: string[] = []
 const services: any = { admin_operations: ops, etsy: { getReadConnection: async () => ({ shop_id: 77, scopes: { granted: ['transactions_r'] } }) }, product: products, locking: { execute: async (key: string, fn: any) => { locks.push(key); return fn() } } }
 const scope = { resolve: (key: string) => { if (!services[key]) throw Error('Unexpected service '+key); return services[key] } }
 const current = raw()
 const request = jest.fn(async (url: any, options: any) => { if (options.method) throw Error('Provider writes prohibited'); return { ok: true, json: async () => String(url).includes('/receipts/99?') ? current : { count: 1, results: [current] } } }) as any
 return { records, ops, products, scope, current, request, locks }
}
beforeEach(() => { process.env.ETSY_ORDER_REPORT_ENABLED = 'true' })
test('refresh is idempotent, preparation survives JSONB key ordering, and no private data is cached', async () => {
 const f = fixture()
 await refreshOrderWorkspace(f.scope, f.request)
 const report = await readOrderWorkspace(f.scope), order = report.orders[0]
 expect(report.orders).toHaveLength(1)
 expect(order.fulfillment).toBe('needs_making')
 await savePreparation(f.scope, 99, { stage: 'ready_to_pack', expected_revision: order.revision }, 'staff_1', f.request)
 await refreshOrderWorkspace(f.scope, f.request)
 expect((await readOrderWorkspace(f.scope)).orders[0].fulfillment).toBe('ready_to_pack')
 expect(f.records.filter(r => r.kind === 'etsy-order')).toHaveLength(1)
 expect(JSON.stringify(f.records)).not.toMatch(/Private|Do not persist|Authorization|transactions_w/)
 expect(f.locks.every(k => k === 'etsy-order-workspace:77')).toBe(true)
 expect(f.request.mock.calls.every(([,o]: any) => !o.method)).toBe(true)
})
test('stale local revision rejects before an Etsy request', async () => {
 const f = fixture(); await refreshOrderWorkspace(f.scope, f.request); f.request.mockClear()
 await expect(savePreparation(f.scope, 99, { stage: 'ready_to_pack', expected_revision: randomUUID() }, 'staff', f.request)).rejects.toThrow('This order changed')
 expect(f.request).not.toHaveBeenCalled()
})
test('Etsy shipment or item edits refresh snapshot and prevent stale preparation changes', async () => {
 const f = fixture(); await refreshOrderWorkspace(f.scope, f.request)
 const [order] = (await readOrderWorkspace(f.scope)).orders; f.current.is_shipped = true
 await expect(savePreparation(f.scope, 99, { stage: 'ready_to_pack', expected_revision: order.revision }, 'staff', f.request)).rejects.toThrow('Etsy order details changed')
 expect((await readOrderWorkspace(f.scope)).orders[0].fulfillment).toBe('shipped')
})
test('failed refresh keeps saved orders and a visible safe error', async () => {
 const f = fixture(); await refreshOrderWorkspace(f.scope, f.request)
 f.request.mockRejectedValue(Error('Secret token / private response'))
 await expect(refreshOrderWorkspace(f.scope, f.request)).rejects.toThrow('could not be refreshed')
 const report = await readOrderWorkspace(f.scope)
 expect(report.orders).toHaveLength(1)
 expect(report.sync.error).toContain('could not be refreshed')
 expect(JSON.stringify(f.records)).not.toContain('Secret token')
})
test('older open orders absent from recent/open pages are fetched by ID for reconciliation', async () => {
 const f = fixture(); await refreshOrderWorkspace(f.scope, f.request)
 f.current.is_shipped = true
 f.request.mockImplementation(async (url: any) => ({ ok: true, json: async () => String(url).includes('/receipts/99?') ? f.current : { count: 0, results: [] } }))
 await refreshOrderWorkspace(f.scope, f.request)
 expect((await readOrderWorkspace(f.scope)).orders[0].fulfillment).toBe('shipped')
})
test('invalid provider receipt fails validation before overwriting saved order snapshots', async () => {
 const f = fixture(); await refreshOrderWorkspace(f.scope, f.request)
 const before = JSON.stringify(f.records.find(r => r.kind === 'etsy-order'))
 f.current.transactions[0].quantity = 0
 await expect(refreshOrderWorkspace(f.scope, f.request)).rejects.toThrow()
 expect(JSON.stringify(f.records.find(r => r.kind === 'etsy-order'))).toBe(before)
})
test('changed personalization invalidates preparation even if the provider timestamp is unchanged', async () => {
 const f = fixture(); await refreshOrderWorkspace(f.scope, f.request)
 const [order] = (await readOrderWorkspace(f.scope)).orders
 f.current.transactions[0].variations[0].formatted_value = 'Changed private engraving'
 await expect(savePreparation(f.scope, 99, { stage: 'ready_to_pack', expected_revision: order.revision }, 'staff', f.request)).rejects.toThrow('Etsy order details changed')
 expect((await readOrderWorkspace(f.scope)).orders[0].stage).toBe('needs_making')
 expect(JSON.stringify(f.records)).not.toContain('Changed private')
})
