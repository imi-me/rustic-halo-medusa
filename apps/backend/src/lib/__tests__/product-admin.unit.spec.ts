import {
  emptyEtsyDraft,
  etsyDraftSchema,
  colorExport,
  searchReadiness,
  isHairClaw,
  sellableColorVariants,
} from '../product-admin'
const product = () => ({
  id: 'prod_one',
  type: { value: 'Hair Claw' },
  images: [{ url: 'https://cdn.rustichalo.com/rose.png' }],
  options: [
    { id: 'opt_color', title: 'Color' },
    { id: 'opt_size', title: 'Size' },
  ],
  variants: [
    {
      id: 'variant_one',
      title: 'Rose 4 inch',
      sku: 'RH-ROSE',
      metadata: { base_claw_color: 'Rose', inventory_mode: 'made_to_order_color_option' },
      options: [
        { option_id: 'opt_color', value: 'Rose' },
        { option_id: 'opt_size', value: '4 inch' },
      ],
      prices: [{ amount: 16, currency_code: 'usd', rules: {} }],
    },
  ],
})
it('detects hair-claw eligibility without guessing from product titles', () => {
  expect(isHairClaw({ title: 'Hair claw shaped earrings', type: { value: 'Earrings' } })).toBe(
    false,
  )
  expect(isHairClaw(product())).toBe(true)
  expect(isHairClaw({ type: { value: 'Earrings' }, metadata: { hair_claw_template_v2: {} } })).toBe(
    false,
  )
  expect(isHairClaw({ metadata: { source_product_type: 'Hair Claw' } })).toBe(true)
})
it('enforces tag limits, uniqueness and allowed characters', () => {
  for (const tags of [
    ['a'.repeat(21)],
    ['claw', 'CLAW'],
    ['invalid!'],
    Array.from({ length: 14 }, (_, i) => `tag ${i}`),
  ])
    expect(etsyDraftSchema.safeParse({ ...emptyEtsyDraft(), tags }).success).toBe(false)
  expect(
    etsyDraftSchema.parse({ ...emptyEtsyDraft(), tags: ['hair claw', 'gift for her'] }).tags,
  ).toHaveLength(2)
})
it('exports saved color variants with explicit channel allocations and preserved prices', () => {
  const draft = emptyEtsyDraft()
  draft.colors = [
    { variant_id: 'variant_one', quantity: 3, image_url: 'https://cdn.rustichalo.com/rose.png' },
  ]
  const result = colorExport(product(), draft)
  expect(result.variants[0]).toMatchObject({
    sku: 'RH-ROSE',
    color: 'Rose',
    quantity: 3,
    price: 16,
    options: { Color: 'Rose', Size: '4 inch' },
  })
})
it('rejects preview-only colors and images not attached to the product', () => {
  const draft = emptyEtsyDraft()
  draft.colors = [{ variant_id: 'preview_purple', quantity: 1, image_url: '' }]
  expect(() => colorExport(product(), draft)).toThrow('saved variant')
  draft.colors = [
    { variant_id: 'variant_one', quantity: 1, image_url: 'https://example.invalid/injected.png' },
  ]
  expect(() => colorExport(product(), draft)).toThrow('approved product image')
})
it('excludes hidden legacy variants and disabled size/finish offers', () => {
  const source: any = product()
  source.metadata = {
    hair_claw_template_v2: { offer_mode: true },
    hair_claw_overlays_v1: {
      recipes: { '4-natural': { enabled: false } },
      offers: { '4-natural': { variant_ids: ['variant_one'] } },
    },
  }
  expect(sellableColorVariants(source)).toEqual([])
  source.metadata.hair_claw_overlays_v1.recipes['4-natural'].enabled = true
  expect(sellableColorVariants(source)).toHaveLength(1)
})
it('does not confuse regional/tier prices with the base export price', () => {
  const source: any = product()
  source.variants[0].prices.unshift({
    amount: 8,
    currency_code: 'usd',
    rules: { region_id: 'region_one' },
  })
  const draft = emptyEtsyDraft()
  draft.colors = [{ variant_id: 'variant_one', quantity: 0, image_url: '' }]
  expect(colorExport(source, draft).variants[0].price).toBe(16)
})
it('returns explainable readiness checks rather than ranking claims', () => {
  const checks = searchReadiness(emptyEtsyDraft())
  expect(checks.find((row) => row.text.includes('0/13'))?.ok).toBe(false)
  expect(checks.every((row) => typeof row.ok === 'boolean')).toBe(true)
})
