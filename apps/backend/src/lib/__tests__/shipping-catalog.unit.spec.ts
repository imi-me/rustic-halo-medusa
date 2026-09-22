import { shippingItems } from '../shipping-catalog'

describe('confirmed catalog shipping', () => {
  it('uses the higher confirmed weight for both claw sizes', () => {
    expect(shippingItems([{ quantity: 1, variant_sku: '38462-4' }, { quantity: 2, variant: { sku: '38462-2' } }]))
      .toEqual([{ package_id: 'hair-claw-box', weight_oz: 1, quantity: 1 }, { package_id: 'hair-claw-box', weight_oz: 1, quantity: 2 }])
    expect(shippingItems([{ quantity: 1, variant_sku: '38258-CREAM' }]))
      .toEqual([{ package_id: 'hair-claw-box', weight_oz: 1, quantity: 1 }])
  })
  it('maps recovered accessory SKUs but keeps the unmeasured shelf sitter blocked', () => {
    expect(shippingItems(['38511-CBC4', '38540-CBC4', '38704-RF', '38704-BR', '38704-WF'].map(sku => ({ quantity: 1, variant_sku: sku }))).map(item => item.weight_oz)).toEqual([1, 1, 0.5, 0.5, 0.5])
    expect(() => shippingItems([{ quantity: 1, variant_sku: '38709' }])).toThrow(/not confirmed/)
  })
  it('retains known earring and sign mappings', () => {
    expect(shippingItems([{ quantity: 1, variant_sku: '38425' }, { quantity: 1, variant_sku: '38432' }]).map(i => i.weight_oz)).toEqual([0.5, 40])
  })
  it('rejects unmapped products and missing SKUs without a fallback', () => {
    for (const sku of ['', 'unconfigured-coaster', '__proto__', 'constructor']) {
      expect(() => shippingItems([{ quantity: 1, variant_sku: sku }])).toThrow(/not confirmed/)
    }
  })
  it('rejects invalid quantities and oversized orders before requesting rates', () => {
    for (const quantity of [0, -1, 1.5, 101, NaN]) expect(() => shippingItems([{ quantity, variant_sku: '38425' }])).toThrow()
    expect(() => shippingItems([{ quantity: 60, variant_sku: '38425' }, { quantity: 60, variant_sku: '38462-4' }])).toThrow(/100/)
    expect(shippingItems([])).toEqual([])
  })
})
