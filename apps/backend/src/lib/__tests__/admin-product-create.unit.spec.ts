const create = jest.fn(),
  stock = jest.fn()
jest.mock('@medusajs/medusa/core-flows', () => ({
  createProductsWorkflow: () => ({ run: create }),
  createInventoryLevelsWorkflow: () => ({ run: stock }),
}))
import { allocateBarcodes, createAdminProduct, creationSchema } from '../admin-product-create'
import { emptyEtsyDraft } from '../product-admin'
const input = () => ({
  inventory_mode: 'stocked' as const,
  request_id: 'fa742b60-d897-41b1-a39d-54e3b1018aaf',
  title: 'Fixture',
  description: 'Fixture',
  handle: 'fixture',
  type_id: null,
  collection_id: null,
  shipping_profile_id: 'sp_one',
  sales_channels: ['sc_one'],
  categories: [],
  tags: [],
  weight: 28,
  material: 'wood',
  images: [],
  thumbnail: null,
  options: [{ title: 'Style', values: ['Standard'] }],
  variants: [
    {
      title: 'Standard',
      sku: 'FIXTURE',
      barcode: '000123',
      price: 15,
      options: { Style: 'Standard' },
      stock: [{ location_id: 'sloc_one', quantity: 3 }],
    },
  ],
  etsy: emptyEtsyDraft(),
})
it('preserves direct barcode text and checks collisions including leading zeros', async () => {
  const products = { listProductVariants: jest.fn().mockResolvedValue([]) }
  expect(await allocateBarcodes(products, [{ barcode: '000123' }])).toEqual(['000123'])
  expect(products.listProductVariants).toHaveBeenCalledWith({ barcode: '000123' }, { take: 2 })
  products.listProductVariants.mockResolvedValue([{ id: 'variant_other' }])
  await expect(
    allocateBarcodes(products, [{ barcode: '000123', id: 'variant_one' }]),
  ).rejects.toThrow('already assigned')
})
it('allocates distinct internal scanner codes without pretending they are UPCs', async () => {
  const barcodes = await allocateBarcodes({ listProductVariants: async () => [] }, [
    { barcode: '' },
    { barcode: '' },
  ])
  expect(barcodes.every((barcode) => /^RH[0-9A-F]{16}$/.test(barcode))).toBe(true)
  expect(new Set(barcodes).size).toBe(2)
})
it('rejects duplicate manually entered barcodes inside one product', async () => {
  await expect(
    allocateBarcodes({ listProductVariants: async () => [] }, [
      { barcode: '001' },
      { barcode: '001' },
    ]),
  ).rejects.toThrow('already assigned')
})
it('rejects malformed creation data before any product or inventory writes', () => {
  expect(
    creationSchema.safeParse({ ...input(), variants: [{ ...input().variants[0], price: -1 }] })
      .success,
  ).toBe(false)
  expect(creationSchema.safeParse({ ...input(), publish: true }).success).toBe(false)
})
it('retries partial stock initialization without recreating a product or adding stock twice', async () => {
  let operation: any = null,
    product: any = null,
    level: any = null
  const ops = {
    listAdminOperations: async () => (operation ? [operation] : []),
    createAdminOperations: async (row: any) => (operation = { ...row, id: 'op_one' }),
    updateAdminOperations: async (row: any) => Object.assign(operation, row),
  }
  const products = {
    listProducts: async () => (product ? [product] : []),
    listProductVariants: async () => [],
  }
  const inventory = {
    listInventoryItems: async () => [{ id: 'iitem_one' }],
    listInventoryLevels: async () => (level ? [level] : []),
  }
  const scope = {
    resolve: (key: string) =>
      key === 'product'
        ? products
        : key === 'inventory'
          ? inventory
          : key === 'admin_operations'
            ? ops
            : { execute: async (_key: string, fn: any) => fn() },
  }
  create.mockImplementation(async (request: any) => {
    product = { id: 'prod_one', metadata: request.input.products[0].metadata }
    return { result: [product] }
  })
  stock
    .mockRejectedValueOnce(new Error('temporary stock failure'))
    .mockImplementationOnce(async () => {
      level = { stocked_quantity: 3 }
      return { result: [] }
    })
  await expect(createAdminProduct(scope, input())).rejects.toThrow('stock failure')
  expect(await createAdminProduct(scope, input())).toEqual({ id: 'prod_one' })
  expect(await createAdminProduct(scope, input())).toEqual({ id: 'prod_one' })
  expect(create).toHaveBeenCalledTimes(1)
  expect(stock).toHaveBeenCalledTimes(2)
  expect(create.mock.calls[0][0].input.products[0]).toMatchObject({
    status: 'draft',
    variants: [{ barcode: '000123', manage_inventory: true, allow_backorder: false }],
  })
  await expect(createAdminProduct(scope, { ...input(), title: 'Changed request' })).rejects.toThrow(
    'creation request changed',
  )
})

it('reserves entered barcodes from unconfirmed creations', async () => {
  await expect(allocateBarcodes({ listProductVariants: async () => [] }, [{ barcode: '00123' }], ['00123'])).rejects.toThrow('already assigned')
})
