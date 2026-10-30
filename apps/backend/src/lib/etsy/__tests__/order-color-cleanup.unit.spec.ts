import { planEtsyOrderColorCleanup } from '../order-color-cleanup'
const prop = (property_id: number, property_name: string, value: string) => ({ property_id, property_name, values: [value], value_ids: [property_id] })
const source = () => ({ products: ['2', '4'].flatMap(size => ['Black', 'Rose'].map(color => ({ sku: `${size}-${color}`, property_values: [prop(513,'Size',size), prop(514,'Color',color)], offerings: [{ price: { amount: size === '2' ? 800 : 1400, divisor: 100, currency_code: 'USD' }, quantity: 9, is_enabled: true, readiness_state_id: 42 }] }))), sku_on_property: [513,514], price_on_property: [513,514], quantity_on_property: [513,514], readiness_state_on_property: [514] })
const originals = () => ['2','4'].map(size => ({ sku: `ORIGINAL-${size}`, variant_id: `v${size}`, properties: [{ property_id: 513, values: [size] }] }))
test('restores original size SKUs, keeps colors, availability, processing and source evidence', () => {
 const inventory = source(), before = JSON.stringify(inventory), result = planEtsyOrderColorCleanup(inventory, originals())
 expect(JSON.stringify(inventory)).toBe(before)
 expect(result.products.map((p: any) => p.sku)).toEqual(['ORIGINAL-2','ORIGINAL-2','ORIGINAL-4','ORIGINAL-4'])
 expect(result.products.map((p: any) => p.offerings[0])).toEqual([8,8,14,14].map(price => ({ price, quantity: 9, is_enabled: true, readiness_state_id: 42 })))
 expect(result.sku_on_property).toEqual([513]); expect(result.quantity_on_property).toEqual([513]); expect(result.price_on_property).toEqual([513]); expect(result.readiness_state_on_property).toEqual([514])
})
test('blocks unreviewed options, shared size SKUs and color-dependent allocations', () => {
 expect(() => planEtsyOrderColorCleanup(source(), originals().slice(0,1))).toThrow('no reviewed')
 const mappings = originals(); mappings[1].sku = mappings[0].sku
 expect(() => planEtsyOrderColorCleanup(source(), mappings)).toThrow('ambiguous')
 const inventory = source(); inventory.products[1].offerings[0].quantity = 8
 expect(() => planEtsyOrderColorCleanup(inventory, originals())).toThrow('different prices or quantities')
})
