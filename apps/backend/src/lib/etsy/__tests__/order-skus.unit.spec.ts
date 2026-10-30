import { etsyOrderSku } from '../order-skus'
test('only explicit listing links supply original Etsy SKUs', () => {
 const variant = { sku: 'BASE-CREAM', metadata: { base_sku: 'BASE', etsy_order_skus_v1: [{ listing_id: 12, sku: 'ORIGINAL' }] } }
 expect(etsyOrderSku(variant, '12')).toBe('ORIGINAL')
 expect(etsyOrderSku(variant, '13')).toBeUndefined()
 expect(etsyOrderSku({ metadata: { base_sku: 'BASE' } }, 12)).toBeUndefined()
 variant.metadata.etsy_order_skus_v1.push({ listing_id: 12, sku: 'CONFLICT' })
 expect(() => etsyOrderSku(variant, 12)).toThrow('Review')
})
