import { GET } from '../route'

const key = 'test-only-key-not-a-real-secret-0000000000'
const originalEnv = { ...process.env }
beforeEach(() => {
  process.env.MARKETSUITE_INVENTORY_READ_ENABLED = 'true'
  process.env.MARKETSUITE_INVENTORY_READ_KEY = key
  process.env.MARKETSUITE_COPPER_MILL_LOCATION_ID = 'loc_copper'
})
afterAll(() => { process.env = originalEnv })

function fixture() {
  const listStockLocations = jest.fn().mockResolvedValue([{ id: 'loc_copper', metadata: { shopify_location_id: 'gid://shopify/Location/79837790404' } }])
  const listInventoryLevels = jest.fn().mockResolvedValue([{ inventory_item_id: 'inv_1' }])
  const graph = jest.fn().mockResolvedValue({ data: [{ id: 'prod_1', variants: [{ id: 'var_1', metadata: { shopify_variant_id: 'gid://shopify/ProductVariant/46129682546884' }, inventory_items: [{ inventory_item_id: 'inv_1' }] }] }] })
  const resolve = jest.fn((name: string) => name === 'stock_location' ? { listStockLocations } : name === 'inventory' ? { listInventoryLevels } : { graph })
  const req = { headers: { authorization: `Bearer ${key}` }, query: {} as Record<string, unknown>, scope: { resolve } }
  const res = { setHeader: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() }
  return { req, res, resolve, listStockLocations, listInventoryLevels, graph }
}
async function run(f: ReturnType<typeof fixture>) { await GET(f.req as any, f.res as any) }

test('exports only Copper Mill inventory IDs with preserved Shopify variant identities', async () => {
  const f = fixture(); await run(f)
  expect(f.res.json.mock.calls[0][0].items).toEqual([{ id: 'inv_1', shopifyVariantId: 'gid://shopify/ProductVariant/46129682546884' }])
  expect(f.graph).toHaveBeenCalledWith(expect.objectContaining({ entity: 'product' }))
  expect(f.res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store')
})
test('disabled or unauthorized requests do not query catalog or inventory', async () => {
  const disabled = fixture(); delete process.env.MARKETSUITE_INVENTORY_READ_ENABLED
  await run(disabled); expect(disabled.resolve).not.toHaveBeenCalled()
  process.env.MARKETSUITE_INVENTORY_READ_ENABLED = 'true'
  const invalid = fixture(); invalid.req.headers.authorization = 'Bearer incorrect'
  await run(invalid); expect(invalid.resolve).not.toHaveBeenCalled()
})
test('unmapped or malformed Copper Mill identities fail closed', async () => {
  const unmapped = fixture(); unmapped.graph.mockResolvedValue({ data: [] })
  await run(unmapped); expect(unmapped.res.status).toHaveBeenCalledWith(503)
  const malformed = fixture(); malformed.graph.mockResolvedValue({ data: [{ id: 'prod', variants: [{ metadata: { shopify_variant_id: 'gid://shopify/ProductVariant/1' }, inventory_items: [] }] }] })
  await run(malformed); expect(malformed.res.status).toHaveBeenCalledWith(503)
})
test('rejects caller-selected locations and keeps continuation incomplete', async () => {
  const invalid = fixture(); invalid.req.query = { location_id: 'demo' }
  await run(invalid); expect(invalid.resolve).not.toHaveBeenCalled()
  const paged = fixture(); paged.listInventoryLevels.mockResolvedValue(Array.from({ length: 101 }, (_, i) => ({ inventory_item_id: 'inv_1' + i })))
  paged.graph.mockResolvedValueOnce({ data: Array.from({ length: 101 }, (_, i) => ({ id: `p_${i}`, variants: [{ metadata: { shopify_variant_id: `gid://shopify/ProductVariant/${i + 1}` }, inventory_items: [{ inventory_item_id: `inv_1${i}` }] }] })) }).mockResolvedValue({ data: [] })
  await run(paged); expect(paged.res.json.mock.calls[0][0]).toMatchObject({ complete: false, nextOffset: 100 })
})
