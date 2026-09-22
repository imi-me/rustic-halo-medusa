import run from '../recover-tax-test'
import { syncOrderTax } from '../../lib/tax/sync-order'
jest.mock('../../lib/shipping-test-environment', () => ({ assertShippingTestEnvironment: jest.fn() }))
jest.mock('../../lib/tax/sync-order', () => ({ syncOrderTax: jest.fn() }))
const originalKey = process.env.STRIPE_API_KEY
const originalFlag = process.env.STRIPE_TAX_REPORTING_TEST_ENABLED
beforeEach(()=>{process.env.STRIPE_API_KEY='sk_test_fixture';process.env.STRIPE_TAX_REPORTING_TEST_ENABLED='true';jest.spyOn(console,'log').mockImplementation(()=>{});jest.clearAllMocks()})
afterEach(()=>{jest.restoreAllMocks();if(originalKey===undefined)delete process.env.STRIPE_API_KEY;else process.env.STRIPE_API_KEY=originalKey;if(originalFlag===undefined)delete process.env.STRIPE_TAX_REPORTING_TEST_ENABLED;else process.env.STRIPE_TAX_REPORTING_TEST_ENABLED=originalFlag})
test('requires explicit single reviewed order',async()=>{await expect(run({container:{},args:['order_test']} as any)).rejects.toThrow('Usage');expect(syncOrderTax).not.toHaveBeenCalled()})
test('rejects live credentials',async()=>{process.env.STRIPE_API_KEY='sk_live_fixture';await expect(run({container:{},args:['order_test','reviewed']} as any)).rejects.toThrow('sandbox');expect(syncOrderTax).not.toHaveBeenCalled()})
test('delegates one reviewed order to guarded handler',async()=>{const container={};await run({container,args:['order_test','reviewed']} as any);expect(syncOrderTax).toHaveBeenCalledTimes(1);expect(syncOrderTax).toHaveBeenCalledWith(container,'order_test')})
test('propagates recovery failures without claiming completion',async()=>{(syncOrderTax as jest.Mock).mockRejectedValueOnce(Error('Expired attempt'));await expect(run({container:{},args:['order_test','reviewed']} as any)).rejects.toThrow('Expired attempt');expect(console.log).not.toHaveBeenCalled()})
