import handler from '../order-confirmation'
jest.mock('../../lib/email/settings',()=>({emailSettings:()=>({enabled:true})}))
it('includes the saved order color in the confirmation without changing the retail identity',async()=>{
 const notify=jest.fn(async(_input:any)=>({})),graph=jest.fn(async(_input:any)=>({data:[{id:'order_test',display_id:12,email:'fixture@example.test',currency_code:'usd',subtotal:30,shipping_subtotal:0,tax_total:0,discount_total:0,total:30,items:[{title:'Claw',variant_title:'4 inch',metadata:{hair_claw_color:'Black'},quantity:1,subtotal:15},{title:'Claw',variant_title:'4 inch',metadata:{hair_claw_color:'Rose'},quantity:1,subtotal:15}],shipping_address:null,shipping_methods:[]}]}))
 const container:any={resolve:(name:string)=>name==='query'?{graph}:{createNotifications:notify}}
 await handler({event:{data:{id:'order_test'}},container} as any)
 const data=notify.mock.calls[0][0] as any
 expect(data.data.order.items.map((item:any)=>item.variant)).toEqual(['4 inch · Color: Black','4 inch · Color: Rose'])
 expect(graph.mock.calls[0][0].fields).toContain('items.metadata')
})
