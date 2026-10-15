import { CLAW_COLORS_KEY, clawColorAvailable, clawPaletteSchema, defaultClawColors } from '../hair-claw-colors'
import { readClawPalette, saveClawPalette } from '../hair-claw-color-store'
import { planClawColorSync } from '../hair-claw-color-sync'
import { guardHairClawOffer, guardCartClawColors } from '../guard-hair-claw-offer'
import { visibleProductVariants, isHairClaw } from '../product-admin'
const black = defaultClawColors[0], rose = defaultClawColors.find(c => c.name === 'Rose')!
function fixture() {
  const product: any = { id: 'prod_test', options: [{ id: 'color', title: 'Base color', is_exclusive: true, values: [{ value: 'Black' }] }, { id: 'size', title: 'Size' }], metadata: { hair_claw_template_v2: { version: 2, offer_mode: true, palette: ['Black'], variant_ids: ['black'], color_option_id: 'color' }, hair_claw_overlays_v1: { recipes: { '4-natural': { enabled: true } }, offers: { '4-natural': { variant_ids: ['black'] } } } } }
  const variant = { id: 'black', metadata: { base_claw_color: 'Black' }, options: [{ option_id: 'color', value: 'Black' }, { option_id: 'size', value: '4 inch' }], manage_inventory: true, allow_backorder: false, weight: 28.349524, price_set: { prices: [{ currency_code: 'usd', amount: 15, min_quantity: null, max_quantity: null, price_rules: [] }] } }
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
