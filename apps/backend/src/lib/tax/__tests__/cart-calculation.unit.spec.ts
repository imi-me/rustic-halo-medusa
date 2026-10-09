import { cartCalculationParameters, compareCartTax, type TaxCart } from '../cart-calculation'
const cart: TaxCart = { id: 'cart_test', currency_code: 'usd', total: 27.0389, tax_total: 1.7689,
 shipping_total: 5.6389, shipping_tax_total: .3689,
 shipping_address: { country_code: 'us', province: 'nc', address_1: '1 Main St', city: 'Grimesland', postal_code: '27837' },
 items: [{ id: 'item1', total: 21.4, tax_total: 1.4 }], shipping_methods: [] }
const original = global.fetch
let request: jest.Mock
beforeEach(() => { request = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'taxcalc_test', livemode: false, currency: 'usd', tax_amount_inclusive: 0, tax_amount_exclusive: 177, amount_total: 2704 }) }); global.fetch = request })
afterEach(() => { global.fetch = original })
test('uses discounted extended item and shipping net amounts without multiplying quantity again', () => {
 const p = cartCalculationParameters(cart)
 expect(p.get('line_items[0][amount]')).toBe('2000')
 expect(p.get('shipping_cost[amount]')).toBe('527')
 expect(p.has('line_items[0][quantity]')).toBe(false)
})
test('zero-cost goods and free shipping supported', () => {
 const p = cartCalculationParameters({ ...cart, items: [{id:'free',total:0,tax_total:0}], shipping_total:0,shipping_tax_total:0 })
 expect(p.get('line_items[0][amount]')).toBe('0')
 expect(p.get('shipping_cost[amount]')).toBe('0')
})
test.each([null, '', NaN, -1, true])('rejects invalid amount %p', value => {
 expect(() => cartCalculationParameters({...cart,items:[{id:'item',total:value,tax_total:0}]})).toThrow()
})
test('rejects duplicate lines and unsupported gift cards', () => {
 expect(() => cartCalculationParameters({...cart, items:[cart.items[0],cart.items[0]]})).toThrow('unique')
 expect(() => cartCalculationParameters({...cart, items:[{...cart.items[0],is_giftcard:true}]})).toThrow('physical-goods')
})
test('matches rounded cart total and tax', async () => { expect(await compareCartTax(cart,'sk_test_dummy')).toEqual(expect.objectContaining({matches:true,expectedTaxCents:177,expectedTotalCents:2704})) })
test('rounds combined fractional goods and shipping tax once, matching actual Stripe allocation', async () => {
 request.mockResolvedValue({ok:true,json:async()=>({id:'taxcalc_combined',livemode:false,currency:'usd',tax_amount_inclusive:0,tax_amount_exclusive:140,amount_total:2074})})
 const combined={...cart,total:20.74215,tax_total:1.40215,shipping_total:5.72715,shipping_tax_total:.38715,items:[{id:'item',total:15.015,tax_total:1.015}]}
 expect(await compareCartTax(combined,'sk_test_dummy')).toEqual(expect.objectContaining({matches:true,expectedTaxCents:140,expectedTotalCents:2074}))
 expect(request.mock.calls[0][1].body.get('line_items[0][amount]')).toBe('1400')
 expect(request.mock.calls[0][1].body.get('shipping_cost[amount]')).toBe('534')
})
test('reports one-cent mismatch without creating a transaction', async () => {
 expect(await compareCartTax({...cart,total:27.05},'sk_test_dummy')).toEqual(expect.objectContaining({matches:false}))
 expect(request).toHaveBeenCalledTimes(1)
 expect(request.mock.calls[0][0]).toBe('https://api.stripe.com/v1/tax/calculations')
})
test('rejects live key before request', async () => { await expect(compareCartTax(cart,'sk_live_bad')).rejects.toThrow('Sandbox'); expect(request).not.toHaveBeenCalled() })
test('outage does not return success', async () => { request.mockResolvedValue({ok:false}); await expect(compareCartTax(cart,'sk_test_dummy')).rejects.toThrow('unavailable') })
