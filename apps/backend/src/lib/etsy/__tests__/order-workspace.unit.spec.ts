import { assertPreparationAllowed, packingItems, preparationStatus, receiptDetails, summarizeWorkspaceReceipt } from '../order-workspace'
const receipt = (extra: any = {}) => ({ receipt_id: 99, create_timestamp: 1780000000, update_timestamp: 1780000100, status: 'paid', is_paid: true, is_shipped: false, name: 'Private Buyer', buyer_email: 'secret@example.test', first_line: 'Private Street', city: 'Raleigh', zip: '27601', country_iso: 'US', message_from_buyer: 'Private note', gift_message: 'Private gift', grandtotal: { amount: 3000, divisor: 100, currency_code: 'USD' }, shipments: [{ receipt_shipping_id: 9, carrier_name: 'usps', tracking_code: 'Private tracking', shipment_notification_timestamp: 1780000200 }], transactions: [{ transaction_id: 7, listing_id: 8, sku: 'CLAW-NATURAL-BLACK', title: 'Claw', quantity: 2, expected_ship_date: 1780000300, is_digital: false, variations: [{ formatted_name: 'Size / finish', formatted_value: '4 inch Natural' }, { formatted_name: 'Personalization', formatted_value: 'Private engraving' }] }], ...extra })
const identities = [{ id: 'variant_1', sku: 'claw-natural-black', product_id: 'prod_1' }]
test('reviewed original Etsy SKU matches only its listing and keeps the order color', () => {
 const raw = receipt(); raw.transactions[0].sku = 'CLAW'; raw.transactions[0].variations.push({ formatted_name: 'Color', formatted_value: 'Rose' })
 const linked = [{ ...identities[0], metadata: { etsy_order_skus_v1: [{ listing_id: 8, sku: 'CLAW' }] } }]
 const order = summarizeWorkspaceReceipt(raw, linked)
 expect(order.transactions[0]).toMatchObject({ match: 'matched', variantId: 'variant_1', choices: [{ name: 'Color', value: 'Rose' }] })
 raw.transactions[0].listing_id = 9
 expect(summarizeWorkspaceReceipt(raw, linked).transactions[0].match).toBe('unmatched_sku')
 raw.transactions[0].listing_id = 8
 expect(summarizeWorkspaceReceipt(raw, [...linked, { ...linked[0], id: 'other' }]).transactions[0].match).toBe('duplicate_sku')
 expect(summarizeWorkspaceReceipt(raw, [...linked, { id: 'exact', sku: 'CLAW' }]).transactions[0].variantId).toBe('exact')
})
test('cache keeps operational fields and native identity while excluding customer and personalization data', () => {
 const order = summarizeWorkspaceReceipt(receipt(), identities)
 expect(order.transactions[0]).toMatchObject({ match: 'matched', variantId: 'variant_1', digital: false })
 expect(order.shipBy).toBe(new Date(1780000300 * 1000).toISOString())
 expect(JSON.stringify(order)).not.toMatch(/Private|secret@example|variations|formatted_value|tracking_code|buyer_email/)
 expect(packingItems(order)).toEqual([{ variant_id: 'variant_1', quantity: 2 }])
})
test('live details include address, notes, personalization and tracking without a raw response', () => {
 const details = receiptDetails(receipt())
 expect(details.addressAvailable).toBe(true)
 expect(details.selections[0].options[1].value).toBe('Private engraving')
 expect(details.shipments[0].tracking).toBe('Private tracking')
 expect(details).not.toHaveProperty('buyer_email')
 expect(receiptDetails({ transactions: [] }).addressAvailable).toBe(false)
})
test.each([
 [{ is_shipped: true }, 'shipped'], [{ is_paid: false }, 'awaiting_payment'], [{ status: 'Canceled' }, 'canceled'], [{ refunds: [{}] }, 'needs_review'],
])('provider state overrides local ready-to-pack stage %#', (extra, expected) => {
 const order = summarizeWorkspaceReceipt(receipt(extra), identities)
 expect(preparationStatus(order, 'ready_to_pack')).toBe(expected)
 expect(() => assertPreparationAllowed(order)).toThrow()
})
test('missing or duplicate SKU blocks whole-order packing and preparation', () => {
 for (const candidates of [[], [...identities, { id: 'variant_2', sku: 'CLAW-NATURAL-BLACK' }]]) {
  const order = summarizeWorkspaceReceipt(receipt(), candidates)
  expect(preparationStatus(order, 'needs_making')).toBe('needs_review')
  expect(() => packingItems(order)).toThrow('Every physical item')
  expect(() => assertPreparationAllowed(order)).toThrow()
 }
})
test('partly shipped order cannot receive a complete-order packing suggestion', () => {
 const raw = receipt(); raw.transactions[0].shipped_timestamp = 1780000400
 const order = summarizeWorkspaceReceipt(raw, identities)
 expect(preparationStatus(order, 'ready_to_pack')).toBe('needs_review')
 expect(() => packingItems(order)).toThrow('partly shipped')
})
test('digital items need no SKU and are excluded from physical packing', () => {
 const raw = receipt(); raw.transactions.push({ transaction_id: 10, quantity: 1, is_digital: true })
 expect(packingItems(summarizeWorkspaceReceipt(raw, identities))).toHaveLength(1)
 raw.transactions = [raw.transactions[1]]
 const order = summarizeWorkspaceReceipt(raw, [])
 expect(preparationStatus(order, 'ready_to_pack')).toBe('digital')
 expect(() => assertPreparationAllowed(order)).toThrow()
})
