import Service from '../service'
const address = { country_code: 'us', province_code: 'nc', address_1: '3700 Bristolwood Ct.', city: 'Grimesland', postal_code: '27837' }
const items = [{ line_item: { id: 'item', product_id: 'product', currency_code: 'usd', unit_price: 15, quantity: 1 }, rates: [] }]
const shipping = [{ shipping_line: { id: 'shipping', shipping_option_id: 'option', currency_code: 'usd', unit_price: 5.27 }, rates: [] }]
const calculation = { id: 'taxcalc_test', livemode: false, tax_breakdown: [{ inclusive: false, taxability_reason: 'standard_rated', tax_rate_details: { country: 'US', state: 'NC', percentage_decimal: '7.0' } }] }
const originalFetch = global.fetch
let request: jest.Mock
beforeEach(() => { request = jest.fn().mockResolvedValue({ ok: true, json: async () => calculation }); global.fetch = request })
afterEach(() => { global.fetch = originalFetch })
test('rejects live credentials', () => { expect(() => new Service({}, { apiKey: 'sk_live_invalid' })).toThrow('test key') })
test('NC rate applies to both goods and shipping, cached for repeated checkout updates', async () => {
 const service = new Service({}, { apiKey: 'sk_test_dummy' })
 const lines = await service.getTaxLines(items, shipping, { address })
 expect(lines).toEqual([expect.objectContaining({ line_item_id: 'item', rate: 7 }), expect.objectContaining({ shipping_line_id: 'shipping', rate: 7 })])
 await service.getTaxLines(items, shipping, { address })
 expect(request).toHaveBeenCalledTimes(1)
})
test('out-of-state address clears tax without an API call', async () => {
 expect(await new Service({}, { apiKey: 'sk_test_dummy' }).getTaxLines(items, shipping, { address: { ...address, province_code: 'va' } })).toEqual([])
 expect(request).not.toHaveBeenCalled()
})
test('incomplete NC address blocks calculation', async () => {
 await expect(new Service({}, { apiKey: 'sk_test_dummy' }).getTaxLines(items, shipping, { address: { ...address, postal_code: '' } })).rejects.toThrow('complete shipping address')
})
test('Stripe outage cannot silently yield zero tax', async () => {
 request.mockResolvedValue({ ok: false })
 await expect(new Service({}, { apiKey: 'sk_test_dummy' }).getTaxLines(items, shipping, { address })).rejects.toThrow('unavailable')
})
test('missing registration cannot silently yield zero tax', async () => {
 request.mockResolvedValue({ ok: true, json: async () => ({ ...calculation, tax_breakdown: [{ ...calculation.tax_breakdown[0], taxability_reason: 'not_collecting' }] }) })
 await expect(new Service({}, { apiKey: 'sk_test_dummy' }).getTaxLines(items, shipping, { address })).rejects.toThrow('registration')
})
