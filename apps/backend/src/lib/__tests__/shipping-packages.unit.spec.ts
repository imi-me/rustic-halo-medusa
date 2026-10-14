import { defaultPackages, assignmentSchema, packagesSchema, SHIPPING_KEY } from '../shipping-packages'
import { planShipping } from '../shipping-plan'
import { readPackageConfig, savePackageConfig } from '../shipping-package-store'
import { validateAssignments } from '../shipping-assignment'
import { productDraft, productUpdate } from '../../admin/lib/inline-edit'
const grams = 28.349523125
const assigned = (id = 'prod_a', extra: any = {}) => ({ id, weight: grams, metadata: { keep: 'original', [SHIPPING_KEY]: assignmentSchema.parse({ package_id: 'hair-claw-box' }) }, ...extra })
const service = (rows: any[]) => ({ listProductVariants: jest.fn().mockResolvedValue(rows) })
it('packs confirmed legacy mixed accessory orders and separate signs with packaging added once per box', async () => {
  const parcels = await planShipping([{ variant_sku: '38462-4', quantity: 3 }, { variant_sku: '38425', quantity: 4 }, { variant_sku: '38432', quantity: 2 }], defaultPackages())
  expect(parcels.filter(row => row.package_id === 'hair-claw-box').map(row => row.weight)).toEqual([5.6, 2.6])
  expect(parcels.filter(row => row.package_id === '14-inch-sign-box')).toHaveLength(2)
  expect(parcels.reduce((n, row) => n + row.weight, 0)).toBeCloseTo(102.2, 6)
  expect(parcels.reduce((n, row) => n + row.item_count, 0)).toBe(9)
})
it('uses persisted product metadata for new SKUs, product weight and capacities', async () => {
  const product = assigned()
  const products = service([{ id: 'variant_a', sku: 'NEW-SKU', product, weight: null }])
  const parcels = await planShipping([{ variant_id: 'variant_a', quantity: 4, variant: { metadata: { [SHIPPING_KEY]: { package_id: 'forged' } } } }], defaultPackages(), products)
  expect(parcels.map(row => row.item_count)).toEqual([3, 1])
  expect(parcels.map(row => row.weight)).toEqual([4.6, 2.6])
  expect(products.listProductVariants).toHaveBeenCalledWith({ id: ['variant_a'] }, { relations: ['product'], take: 100 })
})
it('honors variant package and item-weight overrides without changing product rules', async () => {
  const products = service([{ id: 'variant_a', sku: 'NEW', product: assigned(), weight: grams * 2, metadata: { [SHIPPING_KEY]: assignmentSchema.parse({ package_id: 'earring-box' }) } }])
  const [parcel] = await planShipping([{ variant_id: 'variant_a', quantity: 2 }], defaultPackages(), products)
  expect(parcel).toMatchObject({ package_id: 'earring-box', height: 1.5, weight: 5.3 })
})
it('respects product capacity overrides, ships-alone and separate-product packages', async () => {
  const product = assigned('prod_a', { metadata: { [SHIPPING_KEY]: assignmentSchema.parse({ package_id: 'hair-claw-box', units_per_box: 2 }) } })
  const products = service([{ id: 'a', sku: 'NEW', product }])
  expect((await planShipping([{ variant_id: 'a', quantity: 5 }], defaultPackages(), products)).map(row => row.item_count)).toEqual([2, 2, 1])
  product.metadata[SHIPPING_KEY].ships_alone = true
  expect(await planShipping([{ variant_id: 'a', quantity: 3 }], defaultPackages(), products)).toHaveLength(3)
  const config = defaultPackages(); config.packages[0].combine_products = false
  const rows = [{ id: 'a', sku: 'A', product: assigned('a') }, { id: 'b', sku: 'B', product: assigned('b') }]
  expect(await planShipping([{ variant_id: 'a', quantity: 1 }, { variant_id: 'b', quantity: 1 }], config, service(rows))).toHaveLength(2)
})
it('uses edited dimensions and tare weights for both legacy and explicitly assigned products', async () => {
  const config = defaultPackages(); config.packages[0].height = 4; config.packages[0].packaging_weight = 2
  expect((await planShipping([{ variant_sku: '38462-4', quantity: 1 }], config))[0]).toMatchObject({ height: 4, weight: 3 })
  expect((await planShipping([{ variant_id: 'a', quantity: 1 }], config, service([{ id: 'a', product: assigned() }])))[0]).toMatchObject({ height: 4, weight: 3 })
})
it('fails closed for missing weights, packages, variants, unknown SKUs and invalid quantities', async () => {
  for (const items of [[{ variant_sku: 'unknown', quantity: 1 }], [{ variant_sku: '38425', quantity: 101 }], [{ variant_sku: '38425', quantity: .5 }]]) await expect(planShipping(items, defaultPackages())).rejects.toThrow()
  await expect(planShipping([{ variant_id: 'a', quantity: 1 }], defaultPackages(), service([]))).rejects.toThrow('missing')
  await expect(planShipping([{ variant_id: 'a', quantity: 1 }], defaultPackages(), service([{ id: 'a', product: assigned('p', { weight: 0 }) }]))).rejects.toThrow('weight')
  const config = defaultPackages(); config.packages.shift()
  await expect(planShipping([{ variant_id: 'a', quantity: 1 }], config, service([{ id: 'a', product: assigned() }]))).rejects.toThrow('missing')
})
it('validates assignments and preserves archived packages for existing assignments', () => {
  const config = defaultPackages(); validateAssignments(config, assigned(), [{ id: 'a', weight: null }])
  config.packages[0].active = false
  expect(() => validateAssignments(config, assigned(), [{ id: 'a' }])).toThrow('active')
  expect(() => validateAssignments(config, assigned(), [{ id: 'a' }], assigned())).not.toThrow()
  expect(() => validateAssignments(defaultPackages(), assigned('p', { weight: 0 }), [{ id: 'a' }])).toThrow('weight')
})
it('keeps product, Etsy and variant metadata, IDs and prices when assigning shipping', () => {
  const product: any = { id: 'p', title: 'Fixture', handle: 'fixture', status: 'draft', weight: grams, discountable: true, metadata: { keep: 'original' }, variants: [{ id: 'a', title: 'One', sku: 'SKU', metadata: { keep: 'variant' }, prices: [{ id: 'price_a', amount: 15, currency_code: 'usd' }] }] }
  const draft = productDraft(product); draft.shipping = assignmentSchema.parse({ package_id: 'hair-claw-box' }); draft.variants[0].shipping = assignmentSchema.parse({ package_id: 'earring-box' }); draft.variants[0].fields.weight = String(grams * 2)
  const update = productUpdate(product, draft)
  expect(update.metadata.keep).toBe('original')
  expect(update.variants).toEqual([{ id: 'a', weight: grams * 2, metadata: { keep: 'variant', [SHIPPING_KEY]: assignmentSchema.parse({ package_id: 'earring-box' }) } }])
  expect(update).not.toHaveProperty('images'); expect(update.variants[0]).not.toHaveProperty('prices')
})
it('stores package settings with revision conflicts, no destructive deletes, and validation', async () => {
  let row: any
  const operations = { listAdminOperations: jest.fn(async () => row ? [row] : []), createAdminOperations: jest.fn(async (data: any) => { row = { ...data, id: 'op_one' } }), updateAdminOperations: jest.fn(async (data: any) => { row = { ...row, ...data } }) }
  const initial = await readPackageConfig(operations); const { revision, ...config } = initial
  const saved = await savePackageConfig(operations, config, revision)
  expect(saved.revision).not.toBe('initial'); expect((await readPackageConfig(operations)).packages).toEqual(initial.packages)
  await expect(savePackageConfig(operations, config, revision)).rejects.toThrow('another window')
  await expect(savePackageConfig(operations, { ...config, packages: config.packages.slice(1) }, saved.revision)).rejects.toThrow('Archive')
  expect(packagesSchema.safeParse({ ...config, packages: [{ ...config.packages[0], length: 0 }] }).success).toBe(false)
  expect(packagesSchema.safeParse({ ...config, type_defaults: { type_a: 'missing' } }).success).toBe(false)
})

it('treats historical zero variant weights as inheritance, keeping unrelated edits valid', async () => {
  const product: any = { ...assigned(), title: 'Fixture', handle: 'fixture', status: 'draft', discountable: true, variants: [{ id: 'a', title: 'One', sku: 'SKU', weight: 0, prices: [] }] }
  const draft = productDraft(product); expect(draft.variants[0].fields.weight).toBe(''); expect(productUpdate(product, draft)).toEqual({})
  validateAssignments(defaultPackages(), product, product.variants)
  expect((await planShipping([{ variant_id: 'a', quantity: 1 }], defaultPackages(), service([{ ...product.variants[0], product }])))[0].weight).toBe(2.6)
})
it('validates product package defaults even when every variant overrides them, while allowing variant-only weights', () => {
  const variants = [{ id: 'a', weight: grams, metadata: { [SHIPPING_KEY]: assignmentSchema.parse({ package_id: 'earring-box' }) } }]
  expect(() => validateAssignments(defaultPackages(), assigned('p', { weight: null }), variants)).not.toThrow()
  const invalid = assigned('p', { metadata: { [SHIPPING_KEY]: assignmentSchema.parse({ package_id: 'missing-package' }) } })
  expect(() => validateAssignments(defaultPackages(), invalid, variants)).toThrow('active shipping package')
})
