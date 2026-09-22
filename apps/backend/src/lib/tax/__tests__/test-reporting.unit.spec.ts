import { TestTaxReporting, TaxSale } from '../test-reporting'
const sale: TaxSale = { reference: 'test-order', address: { line1: '3700 Bristolwood Ct.', city: 'Grimesland', state: 'NC', postal_code: '27837', country: 'US' }, items: [{ reference: 'earrings', netCents: 1500 }], shippingNetCents: 527, expectedTaxCents: 142, expectedTotalCents: 2169 }
const originalFetch = global.fetch
let request: jest.Mock
beforeEach(() => { request = jest.fn(); global.fetch = request })
afterEach(() => { global.fetch = originalFetch })
const response = (body: object) => ({ ok: true, json: async () => ({livemode: false, ...body}) })
test('rejects live credentials', () => expect(() => new TestTaxReporting('sk_live_no')).toThrow('test key'))
test('records actual discounted amounts and uses stable replay keys', async () => {
 request.mockResolvedValueOnce(response({id:'taxcalc_1',tax_amount_exclusive:142,amount_total:2169})).mockResolvedValueOnce(response({id:'tax_1'}))
 expect(await new TestTaxReporting('sk_test_dummy').recordSale(sale)).toEqual({calculationId:'taxcalc_1',transactionId:'tax_1'})
 expect(request.mock.calls[0][1].body.get('line_items[0][amount]')).toBe('1500')
 expect(request.mock.calls[1][1].headers['Idempotency-Key']).toBe('rh-test-tax-sale/test-order')
})
test('mismatch blocks the reporting transaction', async () => {
 request.mockResolvedValue(response({id:'taxcalc_1',tax_amount_exclusive:150,amount_total:2177}))
 await expect(new TestTaxReporting('sk_test_dummy').recordSale(sale)).rejects.toThrow('does not match')
 expect(request).toHaveBeenCalledTimes(1)
})
test('full refund references the original tax transaction', async () => {
 request.mockResolvedValue(response({id:'tax_reversal'}))
 expect(await new TestTaxReporting('sk_test_dummy').recordFullRefund('tax_1','refund_1')).toEqual({reversalId:'tax_reversal'})
 expect(request.mock.calls[0][1].body.get('original_transaction')).toBe('tax_1')
 expect(request.mock.calls[0][1].body.get('mode')).toBe('full')
})
test('rejects fractional cents before Stripe', async () => {
 await expect(new TestTaxReporting('sk_test_dummy').recordSale({...sale,shippingNetCents:527.1})).rejects.toThrow('integer cents')
 expect(request).not.toHaveBeenCalled()
})

test('partial refund passes a negative tax-inclusive amount', async () => {
 request.mockResolvedValue(response({id:'tax_partial'}))
 await new TestTaxReporting('sk_test_dummy').recordPartialRefund('tax_1','refund_partial',500)
 expect(request.mock.calls[0][1].body.get('flat_amount')).toBe('-500')
 expect(request.mock.calls[0][1].body.get('mode')).toBe('partial')
})
