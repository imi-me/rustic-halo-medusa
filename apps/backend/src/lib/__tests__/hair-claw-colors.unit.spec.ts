import { POST as saveProductColors } from '../../api/admin/products/[id]/workspace/colors/route'
import { CLAW_COLORS_KEY, clawColorAvailable, clawPaletteSchema, defaultClawColors, clawSizeExclusionsSchema } from '../hair-claw-colors'
import { readClawPalette, saveClawPalette } from '../hair-claw-color-store'
import { planClawColorSync, syncClawProduct } from '../hair-claw-color-sync'
import { createAndLinkProductOptionsToProductWorkflow, createProductVariantsWorkflow } from '@medusajs/medusa/core-flows'
jest.mock('@medusajs/medusa/core-flows', () => ({ createProductOptionsWorkflow: jest.fn(), createProductVariantsWorkflow: jest.fn(), createAndLinkProductOptionsToProductWorkflow: jest.fn() }))
jest.mock('../admin-product-create', () => ({ allocateBarcodes: jest.fn(async (_service, rows) => rows.map((_: any, i: number) => 'BC' + i)), pendingBarcodes: jest.fn(async () => []) }))
import { guardHairClawOffer, guardCartClawColors } from '../guard-hair-claw-offer'
import { visibleProductVariants, isHairClaw } from '../product-admin'
import { activeOfferVariantIds } from '../hair-claw-offers'
const black = defaultClawColors[0], rose = defaultClawColors.find(c => c.name === 'Rose')!
function fixture() {
  const product: any = { id: 'prod_test', options: [{ id: 'color', title: 'Base color', is_exclusive: true, values: [{ value: 'Black' }] }, { id: 'size', title: 'Size' }], metadata: { hair_claw_template_v2: { version: 2, offer_mode: true, palette: ['Black'], variant_ids: ['black'], color_option_id: 'color' }, hair_claw_overlays_v1: { recipes: { '4-natural': { enabled: true } }, offers: { '4-natural': { variant_ids: ['black'] } } } } }
  const variant = { id: 'black', metadata: { base_claw_color: 'Black', physical_size: '4' }, options: [{ option_id: 'color', value: 'Black' }, { option_id: 'size', value: '4 inch' }], manage_inventory: true, allow_backorder: false, weight: 28.349524, price_set: { prices: [{ currency_code: 'usd', amount: 15, min_quantity: null, max_quantity: null, price_rules: [] }] } }
  product.variants = [variant]; return { product, variant }
}
it('defaults all shared colors on; product exclusions and shared retirement both disable purchasing', () => {
  const { product, variant } = fixture()
  expect(defaultClawColors).toHaveLength(13); expect(defaultClawColors.every(c => c.active)).toBe(true)
  expect(clawColorAvailable(product, variant, defaultClawColors)).toBe(true)
  product.metadata[CLAW_COLORS_KEY] = { excluded: ['Black'] }
  expect(clawColorAvailable(product, variant, defaultClawColors)).toBe(false)
  expect(visibleProductVariants(product)).toEqual([])
  delete product.metadata[CLAW_COLORS_KEY]
  expect(clawColorAvailable(product, variant, [{ ...black, active: false }])).toBe(false)
})
it('recognizes an approved claw template despite legacy source taxonomy, while respecting an explicit current product type', () => {
  expect(isHairClaw({ metadata: { source_product_type: 'Hair Accessories', hair_claw_template_v2: { version: 2 } } })).toBe(true)
  expect(isHairClaw({ type: { value: 'Earrings' }, metadata: { hair_claw_template_v2: { version: 2 } } })).toBe(false)
})
it('restricts a migrated legacy product to its new real color variants, retaining the old SKU only for historical references', () => {
  expect([...activeOfferVariantIds({ hair_claw_template_v2: { version: 2, variant_ids: ['color-black', 'color-rose'] } })!]).toEqual(['color-black', 'color-rose'])
})
it('rejects duplicate names, unsafe swatches, mismatched identifiers, and retiring every color', () => {
  for (const colors of [[black, { ...rose, name: 'black' }], [{ ...black, hex: 'url(secret)' }], [{ ...black, slug: 'other' }], [{ ...black, active: false }]]) expect(clawPaletteSchema.safeParse(colors).success).toBe(false)
})
it('uses revisions and keeps retired records available for existing references', async () => {
  let row: any = null
  const ops = { listAdminOperations: async () => row ? [row] : [], createAdminOperations: async (value: any) => { row = { ...value, id: 'config' } }, updateAdminOperations: async (value: any) => { row = { ...row, ...value } } }
  expect((await readClawPalette(ops)).revision).toBe('default-v1')
  const saved = await saveClawPalette(ops, defaultClawColors.map(c => c.slug === 'black' ? { ...c, active: false } : c), 'default-v1')
  expect(saved.colors.find(c => c.slug === 'black')?.active).toBe(false)
  await expect(saveClawPalette(ops, defaultClawColors, 'default-v1')).rejects.toThrow('changed')
  await expect(saveClawPalette(ops, defaultClawColors.slice(1), saved.revision)).rejects.toThrow('Retire')
})
it('adds only missing colors at the existing offer price, weight and inventory policy', () => {
  const { product } = fixture(), before = JSON.stringify(product)
  const { plans } = planClawColorSync(product, [black, rose])
  expect(plans).toHaveLength(1); expect(plans[0].type.key).toBe('4-natural')
  expect(plans[0].variant).toMatchObject({ weight: 28.349524, manage_inventory: true, allow_backorder: false, options: { 'Base color': 'Rose', Size: '4 inch' }, prices: [{ currency_code: 'usd', amount: 15 }] })
  expect(JSON.stringify(product)).toBe(before)
  expect(planClawColorSync(product, [black, { ...rose, active: false }]).plans).toHaveLength(0)
})
it('fails before writes for inconsistent prices or policies and does not invent disabled offers', () => {
  const { product, variant } = fixture()
  product.variants.push({ ...variant, id: 'second', metadata: { base_claw_color: 'Other' }, price_set: { prices: [{ currency_code: 'usd', amount: 20 }] } }); product.metadata.hair_claw_overlays_v1.offers['4-natural'].variant_ids.push('second')
  expect(() => planClawColorSync(product, [black, rose])).toThrow('different or missing prices')
  product.variants[1].price_set = variant.price_set; product.variants[1].allow_backorder = true
  expect(() => planClawColorSync(product, [black, rose])).toThrow('inventory policies')
})
it('recovers an already created matching color SKU and refuses foreign collisions', () => {
  const { product } = fixture(), plan = planClawColorSync(product, [rose]).plans[0]
  product.variants.push({ ...plan.variant, id: 'recovered', metadata: { ...plan.variant.metadata } })
  expect(planClawColorSync(product, [rose]).plans[0].recovered.id).toBe('recovered')
  product.variants[1].metadata.claw_palette_offer = '2-natural'
  expect(() => planClawColorSync(product, [rose])).toThrow('different variant')
})
it('links new option values to the product before creating variants and retries without duplicates', async () => {
  const { product } = fixture(); product.metadata.unrelated = 'keep'
  const link = jest.fn(async () => ({})), create = jest.fn(async ({ input }) => { const result = input.product_variants.map((v: any, i: number) => ({ ...v, id: 'new-' + i, price_set: { prices: v.prices } })); product.variants.push(...result); return { result } })
  ;(createAndLinkProductOptionsToProductWorkflow as unknown as jest.Mock).mockReturnValue({ run: link })
  ;(createProductVariantsWorkflow as unknown as jest.Mock).mockReturnValue({ run: create })
  const products = { listProductVariants: async () => [], retrieveProduct: async () => product, updateProducts: async (_id: string, data: any) => { product.metadata = data.metadata } }
  const scope = { resolve: (name: string) => name === 'query' ? { graph: async () => ({ data: [product] }) } : name === 'product' ? products : { execute: async (_key: string, fn: () => any) => fn() } }
  expect((await syncClawProduct(scope, product.id, [black, rose])).created).toBe(1)
  expect(link).toHaveBeenCalledWith({ input: { product_id: product.id, update: [{ product_option_id: 'color', add: [{ value: 'Rose' }] }] } })
  expect(product.metadata.unrelated).toBe('keep'); expect(product.metadata.hair_claw_overlays_v1.recipes).toEqual({ '4-natural': { enabled: true } })
  expect((await syncClawProduct(scope, product.id, [black, rose])).created).toBe(0); expect(create).toHaveBeenCalledTimes(1)
})
it('blocks excluded and globally retired colors for direct adds and cart creation', async () => {
  const { product, variant } = fixture(), next = jest.fn()
  const ops = { listAdminOperations: async () => [] }
  const req: any = { body: { items: [{ variant_id: 'black', quantity: 1 }] }, scope: { resolve: (name: string) => name === 'query' ? { graph: async () => ({ data: [{ ...variant, product }] }) } : ops } }
  await guardHairClawOffer(req, {}, next); expect(next).toHaveBeenCalledTimes(1)
  product.metadata[CLAW_COLORS_KEY] = { excluded: ['Black'] }
  await expect(guardHairClawOffer(req, {}, next)).rejects.toThrow('color is not currently available')
  delete product.metadata[CLAW_COLORS_KEY]; req.body = { variant_id: 'black' }
  ops.listAdminOperations = async () => [{ payload: { colors: defaultClawColors.map(c => c.slug === 'black' ? { ...c, active: false } : c), revision: 'r' } }] as any
  await expect(guardHairClawOffer(req, {}, next)).rejects.toThrow('color is not currently available')
})
it('rejects colors disabled after a cart was created and blocks incomplete new variants', async () => {
  const { product, variant } = fixture(), next = jest.fn(); product.metadata[CLAW_COLORS_KEY] = { excluded: ['Black'] }
  const req: any = { params: { id: 'cart', line_id: 'line' }, scope: { resolve: (name: string) => name === 'query' ? { graph: async () => ({ data: [{ items: [{ id: 'line', variant: { ...variant, product } }] }] }) } : { listAdminOperations: async () => [] } } }
  await expect(guardCartClawColors(req, {}, next)).rejects.toThrow('color is not currently available'); expect(next).not.toHaveBeenCalled()
  delete product.metadata[CLAW_COLORS_KEY]; variant.metadata = { base_claw_color: 'Black', claw_palette_offer: '4-natural' } as any; product.metadata.hair_claw_template_v2.variant_ids = []
  await expect(guardCartClawColors(req, {}, next)).rejects.toThrow('still being prepared')
})

it('keeps product exclusions and shared colors independent for each physical size', () => {
  const { product, variant } = fixture()
  product.metadata[CLAW_COLORS_KEY] = { excluded_by_size: { '2': ['Black'], '4': [] } }
  const two = { ...variant, metadata: { ...variant.metadata, physical_size: '2' } }
  expect(clawColorAvailable(product, variant, defaultClawColors)).toBe(true)
  expect(clawColorAvailable(product, two, defaultClawColors)).toBe(false)
  product.metadata[CLAW_COLORS_KEY].excluded_by_size['2'] = []
  const restricted = [{ ...black, sizes: ['4'] as ('2' | '4')[] }]
  expect(clawColorAvailable(product, two, restricted)).toBe(false)
  expect(clawColorAvailable(product, variant, restricted)).toBe(true)
  expect(clawColorAvailable(product, { ...variant, metadata: { base_claw_color: 'Black' } }, restricted)).toBe(false)
  expect(clawPaletteSchema.safeParse([{ ...black, sizes: ['3'] }]).success).toBe(false)
  expect(clawPaletteSchema.safeParse([{ ...black, sizes: [] }]).success).toBe(false)
  expect(clawSizeExclusionsSchema.safeParse({ '2': [], '4': [], '3': [] }).success).toBe(false)
  expect(clawSizeExclusionsSchema.safeParse({ '2': ['Black', 'black'], '4': [] }).success).toBe(false)
})
it('creates new colors only in their assigned size at the existing full price', () => {
  const { product, variant } = fixture()
  product.variants.push({ ...variant, id: 'two-black', metadata: { base_claw_color: 'Black', physical_size: '2' }, options: [{ option_id: 'color', value: 'Black' }, { option_id: 'size', value: '2 inch' }] })
  product.metadata.hair_claw_overlays_v1.offers['2-natural'] = { variant_ids: ['two-black'] }
  const { plans } = planClawColorSync(product, [black, { ...rose, sizes: ['2'] }])
  expect(plans).toHaveLength(1)
  expect(plans[0].type.key).toBe('2-natural')
  expect(plans[0].variant.prices[0].amount).toBe(15)
})
it('rejects unavailable size/color combinations on cart create, add, quantity changes and completion', async () => {
  const { product, variant } = fixture(), next = jest.fn()
  product.metadata[CLAW_COLORS_KEY] = { excluded_by_size: { '2': [], '4': ['Black'] } }
  const scope = { resolve: (name: string) => name === 'query' ? { graph: async ({ entity }: any) => ({ data: entity === 'cart' ? [{ items: [{ id: 'line', variant: { ...variant, product } }] }] : [{ ...variant, product }] }) } : { listAdminOperations: async () => [] } }
  for (const body of [{ variant_id: 'black' }, { items: [{ variant_id: 'black', quantity: 1 }] }]) await expect(guardHairClawOffer({ body, scope } as any, {}, next)).rejects.toThrow('color is not currently available')
  for (const params of [{ id: 'cart', line_id: 'line' }, { id: 'cart' }]) await expect(guardCartClawColors({ params, scope } as any, {}, next)).rejects.toThrow('color is not currently available')
  variant.metadata.physical_size = '2'
  await guardHairClawOffer({ body: { variant_id: 'black' }, scope } as any, {}, next)
  expect(next).toHaveBeenCalledTimes(1)
})

it('saves size availability separately with stale and invalid-input protection, preserving other metadata', async () => {
  const { product } = fixture(); product.updated_at = '2026-10-15T00:00:00.000Z'; product.metadata.unrelated = 'keep'
  const update = jest.fn(async (_id: string, input: any) => { product.metadata = input.metadata })
  const scope = { resolve: (name: string) => name === 'product' ? { retrieveProduct: async () => product, updateProducts: update } : name === 'locking' ? { execute: async (_key: string, fn: any) => fn() } : { listAdminOperations: async () => [] } }
  const req: any = { auth_context: { actor_id: 'staff', actor_type: 'user' }, headers: {}, params: { id: product.id }, scope, body: { excluded_by_size: { '2': ['Black'], '4': [] }, expected_updated_at: product.updated_at, expected_palette_revision: 'default-v1' } }
  const res: any = { setHeader: jest.fn(), sendStatus: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() }
  await saveProductColors(req, res)
  expect(update).toHaveBeenCalledTimes(1)
  expect(product.metadata[CLAW_COLORS_KEY]).toEqual({ excluded: [], excluded_by_size: { '2': ['Black'], '4': [] } })
  expect(product.metadata.unrelated).toBe('keep')
  req.body.expected_updated_at = '2020-01-01'
  await saveProductColors(req, res); expect(res.status).toHaveBeenLastCalledWith(409)
  req.body.expected_updated_at = product.updated_at; req.body.excluded_by_size['2'] = ['Unknown']
  await saveProductColors(req, res); expect(res.status).toHaveBeenLastCalledWith(409)
  req.body.excluded_by_size = { '2': [], '4': [], '3': [] }
  await saveProductColors(req, res); expect(res.status).toHaveBeenLastCalledWith(400)
  expect(update).toHaveBeenCalledTimes(1)
})
it('keeps catalog-approved styles and prices independent, ignoring hidden 2-inch and legacy rows', () => {
  const { product, variant } = fixture()
  product.metadata.hair_claw_template_v2 = { ...product.metadata.hair_claw_template_v2, offer_mode: false, option_ids: ['size','style','color'], variant_ids: ['black','painted'] }
  product.metadata.hair_claw_overlays_v1.offers = {}
  product.options.push({ id: 'style', title: 'Design finish' })
  variant.options.push({ option_id: 'style', value: 'Natural' })
  product.variants.push({ ...variant, id: 'painted', options: variant.options.map(o => o.option_id === 'style' ? { ...o, value: 'Colors by Cate' } : o), price_set: { prices: [{ currency_code: 'usd', amount: 19 }] } }, { ...variant, id: 'hidden-two', metadata: { ...variant.metadata, physical_size: '2' } })
  const plans = planClawColorSync(product, [black, rose]).plans
  expect(plans).toHaveLength(2)
  expect(new Set(plans.map(p => p.type.key)).size).toBe(2)
  expect(plans.map(p => p.variant.options['Design finish'])).toEqual(['Natural','Colors by Cate'])
  expect(plans.map(p => p.variant.prices[0].amount)).toEqual([15,19])
  expect(plans.every(p => p.type.size === '4')).toBe(true)
})
it('publishes a new color only into the approved catalog combinations and retries without duplicates', async () => {
  const { product } = fixture()
  product.metadata.hair_claw_template_v2 = { ...product.metadata.hair_claw_template_v2, offer_mode: false, option_ids: ['size','color'] }
  product.metadata.hair_claw_overlays_v1.offers = {}
  const link = jest.fn(async () => ({})), create = jest.fn(async ({ input }) => { const result = input.product_variants.map((v: any, i: number) => ({ ...v, options: Object.entries(v.options).map(([title, value]) => ({ option_id: product.options.find((o: any) => o.title === title).id, value })), id: 'catalog-new-' + i, price_set: { prices: v.prices } })); product.variants.push(...result); return { result } })
  ;(createAndLinkProductOptionsToProductWorkflow as unknown as jest.Mock).mockReturnValue({ run: link })
  ;(createProductVariantsWorkflow as unknown as jest.Mock).mockReturnValue({ run: create })
  const products = { listProductVariants: async () => [], retrieveProduct: async () => product, updateProducts: async (_id: string, data: any) => { product.metadata = data.metadata } }
  const scope = { resolve: (name: string) => name === 'query' ? { graph: async () => ({ data: [product] }) } : name === 'product' ? products : { execute: async (_key: string, fn: () => any) => fn() } }
  const fitBefore = JSON.stringify(product.metadata.hair_claw_overlays_v1.recipes)
  expect((await syncClawProduct(scope, product.id, [black,rose])).created).toBe(1)
  expect(product.metadata.hair_claw_template_v2.variant_ids).toEqual(['black','catalog-new-0'])
  expect(product.metadata.hair_claw_template_v2.offer_mode).toBe(false)
  expect(JSON.stringify(product.metadata.hair_claw_overlays_v1.recipes)).toBe(fitBefore)
  expect((await syncClawProduct(scope, product.id, [black,rose])).created).toBe(0)
})
