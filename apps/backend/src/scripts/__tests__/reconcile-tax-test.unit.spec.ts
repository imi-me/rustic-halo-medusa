import run from '../reconcile-tax-test'
jest.mock('../../lib/shipping-test-environment', () => ({ assertShippingTestEnvironment: jest.fn() }))
beforeEach(() => { process.env.STRIPE_API_KEY = 'sk_test_fixture'; jest.spyOn(console, 'log').mockImplementation(() => {}) })
afterEach(() => { jest.restoreAllMocks(); delete process.env.STRIPE_API_KEY })
test('limits discovery to 100 checks and reports continuation', async () => {
 const graph = jest.fn().mockResolvedValueOnce({data:Array.from({length:101},(_,i)=>({id:`order_${i}`}))}).mockImplementation(async ({filters})=>({data:[{id:filters.id,tax_total:0}]}))
 await run({container:{resolve:()=>({graph})},args:['recent']} as any)
 expect(graph).toHaveBeenCalledTimes(101)
 expect(graph.mock.calls[0][0].pagination).toEqual({skip:0,take:101,order:{created_at:'DESC',id:'DESC'}})
 expect(JSON.parse((console.log as jest.Mock).mock.calls.at(-1)[0])).toMatchObject({checkedOrders:100,truncated:true,nextOffset:100})
})
test('empty page is explicitly complete', async()=>{
 const graph=jest.fn().mockResolvedValue({data:[]})
 await run({container:{resolve:()=>({graph})},args:['recent','100']} as any)
 expect(JSON.parse((console.log as jest.Mock).mock.calls.at(-1)[0])).toMatchObject({checkedOrders:0,truncated:false,nextOffset:null})
})
test('invalid offset cannot query orders', async()=>{
 const graph=jest.fn()
 await expect(run({container:{resolve:()=>({graph})},args:['recent','-1']} as any)).rejects.toThrow('Usage')
 expect(graph).not.toHaveBeenCalled()
})
