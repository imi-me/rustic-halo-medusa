import { validateCartTax } from '../validate-cart'
import { compareCartTax } from '../cart-calculation'
import type { MedusaContainer } from '@medusajs/framework/types'

jest.mock('../cart-calculation', () => ({ compareCartTax: jest.fn() }))
const compare = compareCartTax as jest.Mock
const originalEnv = process.env
const graph = jest.fn()
const container = { resolve: () => ({ graph }) } as unknown as MedusaContainer
const cart = { id: 'cart_test', sales_channel_id: 'sc_test', currency_code: 'usd', tax_total: 0, shipping_tax_total: 0, items: [{ id:'item_test',tax_total:0 }], shipping_address: { country_code: 'us', province: 'nc' } }
beforeEach(() => {
 process.env = { ...originalEnv, STRIPE_TAX_TEST_ENABLED: 'true', DATABASE_URL: 'postgres://localhost@127.0.0.1:55432/rustic_halo_local', STRIPE_API_KEY: 'sk_test_placeholder' }
 graph.mockReset().mockResolvedValue({ data: [cart] })
 compare.mockReset().mockResolvedValue({ matches: true })
})
afterEach(() => { process.env = originalEnv })
test('matching North Carolina cart passes', async () => {
 await expect(validateCartTax(container, 'cart_test', ['sc_test'])).resolves.toBeUndefined()
 expect(compare).toHaveBeenCalledWith(cart, 'sk_test_placeholder')
})
test.each([{ channels: [] }, { channels: ['sc_other'] }])('rejects carts outside the allowed sales channels %p', async ({ channels }) => {
 await expect(validateCartTax(container, 'cart_test', channels)).rejects.toThrow('Cart unavailable')
 expect(compare).not.toHaveBeenCalled()
})
test('missing sales channel cannot bypass channel checks', async () => {
 graph.mockResolvedValue({ data: [{ ...cart, sales_channel_id: null }] })
 await expect(validateCartTax(container, 'cart_test', ['sc_test'])).rejects.toThrow('Cart unavailable')
})
test('tax mismatch blocks checkout', async () => {
 compare.mockResolvedValue({ matches: false })
 await expect(validateCartTax(container, 'cart_test')).rejects.toThrow('Tax totals differ')
})
test('provider outage blocks checkout', async () => {
 compare.mockRejectedValue(new Error('unavailable'))
 await expect(validateCartTax(container, 'cart_test')).rejects.toThrow('unavailable')
})
test('does not compare states outside NC registration', async () => {
 graph.mockResolvedValue({ data: [{ ...cart, shipping_address: { country_code: 'us', province: 'va' } }] })
 await validateCartTax(container, 'cart_test')
 expect(compare).not.toHaveBeenCalled()
})
test('requires a shipping address', async () => {
 graph.mockResolvedValue({ data: [{ ...cart, shipping_address: null }] })
 await expect(validateCartTax(container, 'cart_test')).rejects.toThrow('Shipping address required')
})
test.each([
 {tax_total:1.42},
 {shipping_tax_total:0.37},
 {items:[{id:'item_test',tax_total:1.05}]},
 {tax_total:null},
 {tax_total:'invalid'},
 {tax_total:-1},
 {tax_total:0.001},
])('blocks stale or invalid tax after moving outside NC: %p', async (taxes) => {
 graph.mockResolvedValue({data:[{...cart,...taxes,shipping_address:{country_code:'us',province:'va'}}]})
 await expect(validateCartTax(container,'cart_test')).rejects.toThrow('Unexpected tax outside North Carolina')
 expect(compare).not.toHaveBeenCalled()
})
test.each([
 {currency_code:'cad'},
 {shipping_address:{country_code:'ca',province:'on'}},
])('rejects unsupported checkout geography or currency: %p', async (changes) => {
 graph.mockResolvedValue({data:[{...cart,...changes}]})
 await expect(validateCartTax(container,'cart_test')).rejects.toThrow('US address and USD')
 expect(compare).not.toHaveBeenCalled()
})
test('does not run test validation against a production database', async () => {
 process.env.DATABASE_URL = 'postgres://localhost@production:5432/store'
 await expect(validateCartTax(container, 'cart_test')).rejects.toThrow('isolated test database')
 expect(graph).not.toHaveBeenCalled()
})
