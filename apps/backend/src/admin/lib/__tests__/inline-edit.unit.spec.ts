import { hasChanges, orderDraft, orderUpdate, productDraft, productUpdate, saveInline } from '../inline-edit'

const product = () => ({ id: 'prod_one', title: 'Claw', handle: 'claw', status: 'draft', discountable: true, updated_at: '2026-10-10', metadata: { artwork: 'preserve' }, categories: [{ id: 'cat_one' }],
  variants: [
    { id: 'var_one', title: 'Small', sku: '123', barcode: '00123', manage_inventory: true, prices: [
      { id: 'price_base', amount: 14, currency_code: 'usd', rules: {} },
      { id: 'price_region', amount: 12, currency_code: 'usd', rules: { region_id: 'reg_one' } },
      { id: 'price_tier', amount: 10, currency_code: 'usd', min_quantity: 5, max_quantity: 10, rules: {} },
    ] },
    { id: 'var_two', title: 'Large', sku: '456', prices: [{ id: 'price_two', amount: 16, currency_code: 'usd', rules: {} }] },
  ],
})
afterEach(() => jest.restoreAllMocks())
it('does not send untouched product fields, variants, metadata or inventory settings', () => {
  const source = product(), draft = productDraft(source)
  expect(productUpdate(source, draft)).toEqual({})
  draft.fields.description = 'New description'
  expect(productUpdate(source, draft)).toEqual({ description: 'New description' })
})
it('preserves every variant when changing one SKU and keeps barcode leading zeroes', () => {
  const source = product(), draft = productDraft(source)
  draft.variants[0].fields.sku = '00012'
  draft.variants[0].fields.barcode = '000987'
  expect(productUpdate(source, draft)).toEqual({ variants: [{ id: 'var_one', sku: '00012', barcode: '000987' }, { id: 'var_two' }] })
})
it('changes base price while preserving regional prices, quantity tiers and other variants', () => {
  const source = product(), draft = productDraft(source)
  draft.variants[0].prices.price_base = '15.25'
  const update = productUpdate(source, draft)
  expect(update.variants).toHaveLength(2)
  expect(update.variants[0].prices).toEqual([
    { id: 'price_base', amount: 15.25, currency_code: 'usd', rules: {}, min_quantity: undefined, max_quantity: undefined },
    { id: 'price_region', amount: 12, currency_code: 'usd', rules: { region_id: 'reg_one' }, min_quantity: undefined, max_quantity: undefined },
    { id: 'price_tier', amount: 10, currency_code: 'usd', min_quantity: 5, max_quantity: 10, rules: {} },
  ])
  expect(update.variants[1]).toEqual({ id: 'var_two' })
})
it.each(['', '-1', 'oops', 'Infinity'])('rejects invalid price %s before any mutation', value => {
  const source = product(), draft = productDraft(source)
  draft.variants[0].prices.price_base = value
  expect(() => productUpdate(source, draft)).toThrow('Each price')
})
it('supports zero dimensions, explicit relation clearing, and null optional text', () => {
  const source = product(), draft = productDraft(source)
  draft.fields.weight = '0'; draft.fields.origin_country = 'US'; draft.relations.categories = []
  expect(productUpdate(source, draft)).toEqual({ weight: 0, origin_country: 'us', categories: [] })
  draft.fields.weight = '-1'
  expect(() => productUpdate(source, draft)).toThrow('weight')
})
it('prevents losing variants and deleting base prices through the draft', () => {
  const source = product(), draft = productDraft(source)
  draft.variants.pop()
  expect(() => productUpdate(source, draft)).toThrow('Variants changed')
  const next = productDraft(source)
  delete next.variants[0].prices.price_base
  expect(() => productUpdate(source, next)).toThrow('Prices changed')
})
it('updates order contact and addresses without payment, items or fulfillment mutations', () => {
  const source = { id: 'order_one', email: 'test@example.invalid', shipping_address: { id: 'addr_one', address_1: 'First', country_code: 'us', postal_code: '00120' }, billing_address: null, total: 30, items: [{ id: 'item_one' }] }
  const draft = orderDraft(source)
  expect(hasChanges(orderDraft(source), draft)).toBe(false)
  expect(orderUpdate(source, draft)).toEqual({})
  draft.email = 'next@example.invalid'; draft.shipping_address.address_1 = 'Second'
  const update = orderUpdate(source, draft)
  expect(update.email).toBe('next@example.invalid')
  expect(update.shipping_address.postal_code).toBe('00120')
  expect(Object.keys(update)).toEqual(['email', 'shipping_address'])
  expect(update.shipping_address).not.toHaveProperty('id')
})
it('validates modified addresses but allows absent unchanged billing addresses', () => {
  const source = { email: 'test@example.invalid', shipping_address: { address_1: 'First', country_code: 'us' } }, draft = orderDraft(source)
  draft.email = 'bad'; expect(() => orderUpdate(source, draft)).toThrow('email')
  draft.email = source.email; draft.billing_address.city = 'City'; expect(() => orderUpdate(source, draft)).toThrow('Billing street')
})
it('rejects a concurrent price change, including hidden regional prices, without POSTing', async () => {
  const source = product(), fresh = product(), draft = productDraft(source)
  draft.fields.title = 'Edited title'; fresh.variants[0].prices[1].amount = 11
  const request = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ product: fresh }) } as Response)
  await expect(saveInline('products', source, draft)).rejects.toThrow('changed since')
  expect(request).toHaveBeenCalledTimes(1)
  expect(request.mock.calls[0][1]).not.toHaveProperty('method')
})
it('uses one native product update request after checking the current record', async () => {
  const source = product(), draft = productDraft(source)
  draft.fields.title = 'Updated'; draft.variants[1].fields.sku = '00789'
  const request = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ product: source }) } as Response)
  await saveInline('products', source, draft)
  expect(request).toHaveBeenCalledTimes(2)
  expect(JSON.parse(request.mock.calls[1][1]!.body as string)).toEqual({ title: 'Updated', variants: [{ id: 'var_one' }, { id: 'var_two', sku: '00789' }] })
})
it('keeps the draft unchanged on failed save and surfaces the server message', async () => {
  const source = product(), draft = productDraft(source), before = JSON.stringify(draft)
  draft.fields.title = 'Updated'
  const edited = JSON.stringify(draft)
  jest.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: true, json: async () => ({ product: source }) } as Response).mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ message: 'SKU already exists' }) } as Response)
  await expect(saveInline('products', source, draft)).rejects.toThrow('SKU already exists')
  expect(JSON.stringify(draft)).toBe(edited)
  expect(edited).not.toBe(before)
})
