import { syncOrderTax } from '../sync-order'
import { TestTaxReporting } from '../test-reporting'
jest.mock('../test-reporting')
const originalFetch = global.fetch
const originalEnv = { ...process.env }
let order: any, payment: any, container: any, record: jest.Mock, reverse: jest.Mock, partial: jest.Mock, refunds: any[]
beforeEach(() => {
 process.env.STRIPE_TAX_REPORTING_TEST_ENABLED='true';process.env.STRIPE_API_KEY='sk_test_fake';process.env.DATABASE_URL='postgres://localhost@127.0.0.1:55432/rustic_halo_local'
 order={id:'order_1',currency_code:'usd',metadata:{other:'preserve'},total:21.6889,tax_total:1.4189,shipping_total:5.6389,shipping_tax_total:.3689,items:[{id:'item_1',total:16.05,tax_total:1.05}],shipping_address:{address_1:'Street',city:'Grimesland',postal_code:'27837',country_code:'us',province:'nc'},payment_collections:[{payments:[{id:'pay_1',provider_id:'pp_stripe_stripe',data:{id:'pi_1'}}]}]}
 payment={livemode:false,currency:'usd',status:'succeeded',amount_received:2169,latest_charge:{amount_refunded:0,refunded:false}}
 refunds=[]
 global.fetch=jest.fn(async(url:string)=>({ok:true,json:async()=>url.includes('/refunds?')?{data:refunds,has_more:false}:payment})) as any
 record=jest.fn(async()=>({transactionId:'tax_1',calculationId:'taxcalc_1'}));reverse=jest.fn(async()=>({reversalId:'tax_refund'}))
 partial=jest.fn(async()=>({reversalId:'tax_partial'}))
 ;(TestTaxReporting as jest.Mock).mockImplementation(()=>({recordSale:record,recordFullRefund:reverse,recordPartialRefund:partial}))
 const services:any={query:{graph:async()=>({data:[order]})},order:{retrieveOrder:async()=>order,updateOrders:async(_:string,data:any)=>Object.assign(order,data)},locking:{execute:async(_:string,fn:()=>Promise<void>)=>fn()}}
 container={resolve:(name:string)=>services[name]}
})
afterEach(()=>{global.fetch=originalFetch;process.env=originalEnv;jest.clearAllMocks()})
test('records captured order once and preserves unrelated metadata',async()=>{
 await syncOrderTax(container,'order_1');await syncOrderTax(container,'order_1')
 expect(record).toHaveBeenCalledTimes(1);expect(order.metadata.other).toBe('preserve')
 expect(record.mock.calls[0][0]).toEqual(expect.objectContaining({expectedTotalCents:2169,expectedTaxCents:142,shippingNetCents:527,items:[{reference:'item_1',netCents:1500}]}))
})
test('does not report failed or uncaptured payment',async()=>{payment.status='requires_payment_method';await syncOrderTax(container,'order_1');expect(record).not.toHaveBeenCalled()})
test('mismatched captured amount blocks reporting',async()=>{payment.amount_received=2000;await expect(syncOrderTax(container,'order_1')).rejects.toThrow('does not match');expect(record).not.toHaveBeenCalled()})
test('full refund is reversed once across event retries',async()=>{
 await syncOrderTax(container,'order_1');payment.latest_charge={amount_refunded:2169,refunded:true}
 await syncOrderTax(container,'order_1');await syncOrderTax(container,'order_1');expect(reverse).toHaveBeenCalledTimes(1)
})
test('partial refund is recorded once and never as a full reversal',async()=>{
 await syncOrderTax(container,'order_1');payment.latest_charge.amount_refunded=500
 refunds=[{id:'re_1',amount:500,status:'succeeded',currency:'usd',payment_intent:'pi_1',created:1}]
 await syncOrderTax(container,'order_1');await syncOrderTax(container,'order_1')
 expect(partial).toHaveBeenCalledTimes(1);expect(partial).toHaveBeenCalledWith('tax_1','order_1-re_1',500);expect(reverse).not.toHaveBeenCalled()
})
test('remaining balance refund does not reverse the already refunded amount again',async()=>{
 await syncOrderTax(container,'order_1');payment.latest_charge.amount_refunded=500
 refunds=[{id:'re_1',amount:500,status:'succeeded',currency:'usd',payment_intent:'pi_1',created:1}]
 await syncOrderTax(container,'order_1')
 payment.latest_charge={amount_refunded:2169,refunded:true};refunds.push({...refunds[0],id:'re_2',amount:1669,created:2})
 await syncOrderTax(container,'order_1');expect(partial).toHaveBeenCalledTimes(2);expect(partial).toHaveBeenLastCalledWith('tax_1','order_1-re_2',1669);expect(reverse).not.toHaveBeenCalled()
})
test('pending refund is not reported',async()=>{
 await syncOrderTax(container,'order_1');payment.latest_charge.amount_refunded=500
 refunds=[{id:'re_1',amount:500,status:'pending',currency:'usd',payment_intent:'pi_1',created:1}]
 await expect(syncOrderTax(container,'order_1')).rejects.toThrow('do not reconcile');expect(partial).not.toHaveBeenCalled()
})
test('stale uncertain attempt needs reconciliation instead of a new transaction',async()=>{
 record.mockRejectedValueOnce(new Error('timeout'));await expect(syncOrderTax(container,'order_1')).rejects.toThrow('timeout')
 order.metadata.stripe_tax_test_reporting.startedAt=Date.now()-24*60*60*1000
 await expect(syncOrderTax(container,'order_1')).rejects.toThrow('safe retry window');expect(record).toHaveBeenCalledTimes(1)
})
