import { historicalItemMatch, historicalMatchesSchema, historicalTransactionFingerprint, resolveHistoricalPacking, type HistoricalOrderMatch } from '../historical-order-matches'
import { summarizeWorkspaceReceipt, packingItems, preparationStatus } from '../order-workspace'
import { defaultPackages, SHIPPING_KEY, assignmentSchema } from '../../shipping-packages'
import { planShipping } from '../../shipping-plan'
const transaction = () => ({ transaction_id: 2, listing_id: 3, product_id: 4, sku: 'OLD-2', quantity: 1, title: 'Daisy', variations: [{ property_id: 513, value_id: 8, formatted_name: 'Size', formatted_value: '2”' }] })
const identity = [{ id: 'variant_a', product_id: 'prod_a', sku: 'OLD-2-BLACK', metadata: { base_sku: 'OLD-2' } }, { id: 'variant_b', product_id: 'prod_a', sku: 'OLD-2-ROSE', metadata: { base_sku: 'OLD-2' } }]
const link = (): HistoricalOrderMatch => ({ receiptId: 1, transactionId: 2, listingId: 3, etsyProductId: 4, sku: 'OLD-2', productId: 'prod_a', productTitle: 'Daisy Hair Claw', originalVariantId: 'variant_a', packingVariantIds: ['variant_a', 'variant_b'], sourceFingerprint: historicalTransactionFingerprint(1, transaction()), evidence: 'Prior exact SKU audit and current source base_sku group.' })
const product = () => ({ id: 'prod_a', weight: 28.349524, metadata: { [SHIPPING_KEY]: assignmentSchema.parse({ package_id: 'hair-claw-box', packing_group: 'hair_claws' }) } })
const service = () => ({ listProductVariants: jest.fn(async () => identity.map(v => ({ ...v, weight: 17.009714, product: product() }))) })
const receipt = () => ({ receipt_id: 1, is_paid: true, is_shipped: true, transactions: [transaction()] })
test('scoped historical match identifies product without inventing a purchased color or native variant', () => {
 const order = summarizeWorkspaceReceipt(receipt(), identity, [link()])
 expect(order.transactions[0]).toMatchObject({ match: 'historical_product', productId: 'prod_a', variantId: null, matchedProductTitle: 'Daisy Hair Claw' })
 expect(packingItems(order)).toEqual([{ packing_product_id: 'prod_a', packing_variant_ids: ['variant_a','variant_b'], legacy_sku: 'OLD-2', quantity: 1 }])
 expect(preparationStatus({ ...order, shipped: false }, 'ready_to_pack')).toBe('needs_review')
})
test('same old SKU on another receipt/transaction is not automatically linked', () => {
 expect(historicalItemMatch(9, transaction(), identity, [link()])).toBeNull()
 expect(historicalItemMatch(1, { ...transaction(), transaction_id: 9 }, identity, [link()])).toBeNull()
})
test.each([{ listing_id: 9 }, { product_id: 9 }, { sku: 'OTHER' }, { quantity: 2 }, { variations: [{ formatted_name: 'Size', formatted_value: '4 inch' }] }])('changed historical source identity requires review %#', extra => {
 expect(historicalItemMatch(1, { ...transaction(), ...extra }, identity, [link()])?.match).toBe('historical_review')
})
test('deleted or cross-product references never fall back to a reused exact SKU', () => {
 for (const variants of [identity.slice(0,1), identity.map(v => ({ ...v, product_id: 'prod_other' })), identity.map(v => ({ ...v, metadata: { base_sku: 'OTHER' } }))]) expect(historicalItemMatch(1, transaction(), variants, [link()])?.match).toBe('historical_review')
 const order = summarizeWorkspaceReceipt(receipt(), [{ id:'variant_reused',sku:'OLD-2',product_id:'prod_other' }], [link()])
 expect(order.transactions[0].variantId).toBeNull()
 expect(() => packingItems(order)).toThrow('Every physical item')
})
test('shipping references use confirmed two-inch weights and combine products in the approved box', async () => {
 const order = summarizeWorkspaceReceipt(receipt(), identity, [link()]), products = service()
 const resolved = await resolveHistoricalPacking(packingItems(order), products)
 const [parcel] = await planShipping(resolved, defaultPackages(), products)
 expect(parcel).toMatchObject({ length:6,width:4,height:3,weight:2.201,item_count:1 })
 expect(order.transactions[0].variantId).toBeNull()
})
test('different color weights/packages or deleted references block automatic packing', async () => {
 const items = packingItems(summarizeWorkspaceReceipt(receipt(), identity, [link()]))
 for (const mode of ['weight','package','deleted','wrong_product','missing_weight']) {
  const products = service(); const rows = await products.listProductVariants()
  if(mode==='weight')rows[1].weight=28.349524
  if(mode==='missing_weight')rows.forEach(v=>v.weight=0)
  if(mode==='package')rows[1].product=product(),rows[1].product.metadata[SHIPPING_KEY].package_id='earring-box'
  if(mode==='deleted')rows.pop()
  if(mode==='wrong_product')rows[1].product.id='prod_other'
  products.listProductVariants.mockResolvedValue(rows)
  await expect(resolveHistoricalPacking(items,products)).rejects.toThrow()
 }
})
test('crosswalk schema rejects duplicate source identities and duplicate/missing audited references', () => {
 const config={version:1,revision:'df287f07-0f70-4fde-8dba-84778ec63fdb',links:[link()]}
 expect(historicalMatchesSchema.parse(config).links).toHaveLength(1)
 expect(()=>historicalMatchesSchema.parse({...config,links:[link(),link()]})).toThrow()
 expect(()=>historicalMatchesSchema.parse({...config,links:[{...link(),packingVariantIds:['variant_b']}]})).toThrow()
})
