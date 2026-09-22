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
  const listInventoryLevels = jest.fn().mockResolvedValue([{ inventory_item_id: 'inv_1', stocked_quantity: 4, reserved_quantity: 1 }])
  const resolve = jest.fn((name: string) => name === 'stock_location' ? { listStockLocations } : { listInventoryLevels })
  const req = { headers: { authorization: `Bearer ${key}` }, query: {} as Record<string, unknown>, scope: { resolve } }
  const res = { setHeader: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() }
  return { req, res, resolve, listStockLocations, listInventoryLevels }
}
async function run(f: ReturnType<typeof fixture>) { await GET(f.req as any, f.res as any) }

test('returns only configured location quantities, never aggregate or customer data', async () => {
  const f = fixture(); await run(f)
  expect(f.listInventoryLevels).toHaveBeenCalledWith({ location_id: 'loc_copper' }, { skip: 0, take: 101 })
  expect(f.res.json.mock.calls[0][0].items).toEqual([{ id: 'inv_1', stocked: 4, reserved: 1, available: 3 }])
  expect(f.res.json.mock.calls[0][0].complete).toBe(true)
  expect(f.res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store')
})
test('disabled and unauthenticated requests never access services', async () => {
  const disabled = fixture(); delete process.env.MARKETSUITE_INVENTORY_READ_ENABLED
  await run(disabled); expect(disabled.res.status).toHaveBeenCalledWith(503); expect(disabled.resolve).not.toHaveBeenCalled()
  process.env.MARKETSUITE_INVENTORY_READ_ENABLED = 'true'
  const invalid = fixture(); invalid.req.headers.authorization = 'Bearer incorrect'
  await run(invalid); expect(invalid.res.status).toHaveBeenCalledWith(401); expect(invalid.resolve).not.toHaveBeenCalled()
})
test('caller cannot choose a different location or malformed page', async () => {
  for (const query of [{ location_id: 'demo' }, { offset: '-1' }, { offset: ['0'] }]) {
    const f = fixture(); f.req.query = query
    await run(f); expect(f.res.status).toHaveBeenCalledWith(400); expect(f.resolve).not.toHaveBeenCalled()
  }
})
test('misconfigured location cannot expose demo stock', async () => {
  const f = fixture(); f.listStockLocations.mockResolvedValue([{ metadata: {} }])
  await run(f); expect(f.res.status).toHaveBeenCalledWith(409); expect(f.listInventoryLevels).not.toHaveBeenCalled()
})
test('pagination reports continuation and never calls a last page a full snapshot', async () => {
  const f = fixture(); f.listInventoryLevels.mockResolvedValue(Array.from({ length: 101 }, (_, i) => ({ inventory_item_id: `inv_${i}`, stocked_quantity: 0, reserved_quantity: 0 })))
  await run(f); expect(f.res.json.mock.calls[0][0]).toMatchObject({ complete: false, nextOffset: 100 })
  expect(f.res.json.mock.calls[0][0].items).toHaveLength(100)
  const last = fixture(); last.req.query = { offset: '100' }; await run(last)
  expect(last.res.json.mock.calls[0][0]).toMatchObject({ complete: false, nextOffset: null })
})
test('service failure and invalid quantities return no partial data', async () => {
  const f = fixture(); f.listInventoryLevels.mockRejectedValue(new Error('private detail'))
  await run(f); expect(f.res.json).toHaveBeenCalledWith({ message: 'Copper Mill inventory is unavailable.' })
  const invalid = fixture(); invalid.listInventoryLevels.mockResolvedValue([{ inventory_item_id: 'inv', stocked_quantity: 'bad', reserved_quantity: 0 }])
  await run(invalid); expect(invalid.res.status).toHaveBeenCalledWith(422)
  expect(invalid.res.json).toHaveBeenCalledTimes(1)
  expect(invalid.res.json).toHaveBeenCalledWith({ message: 'Copper Mill inventory needs quantity review.' })
})
