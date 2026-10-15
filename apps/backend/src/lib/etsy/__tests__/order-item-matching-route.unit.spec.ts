jest.mock('../order-item-matching-store',()=>({matchInput:jest.requireActual('../order-item-matching-store').matchInput,OrderMatchError:jest.requireActual('../order-item-matching-store').OrderMatchError,matchOrderItem:jest.fn(),readMatchChoices:jest.fn()}))
jest.mock('../../../api/admin/assistant/route',()=>({allowedOrigin:(req:any)=>req.headers.origin==='https://staging.rustichalo.com'}))
import { GET, POST } from '../../../api/admin/integrations/etsy/workspace/[id]/match/route'
import { matchOrderItem, readMatchChoices } from '../order-item-matching-store'
const actor:any={auth_context:{actor_id:'staff',actor_type:'user'},headers:{origin:'https://staging.rustichalo.com'},params:{id:'99'},query:{transaction_id:'1',product_id:'prod_a'}}
function response(){const res:any={setHeader:jest.fn(),json:jest.fn(),sendStatus:jest.fn()};res.status=jest.fn(()=>res);return res}
beforeEach(()=>jest.clearAllMocks())
test.each([GET,POST])('requires staff identity %#',async handler=>{for(const auth_context of [null,{actor_id:'customer',actor_type:'customer'}]){const res=response();await handler({...actor,auth_context},res);expect(res.sendStatus).toHaveBeenCalledWith(401)}expect(matchOrderItem).not.toHaveBeenCalled();expect(readMatchChoices).not.toHaveBeenCalled()})
test('rejects cross origin, unsupported fields and invalid identifiers before storage/provider use',async()=>{
 const res=response();await POST({...actor,headers:{origin:'https://untrusted.test'}},res);expect(res.sendStatus).toHaveBeenCalledWith(403)
 for(const body of [{action:'save',provider_write:true},{action:'review',transaction_id:-1}]){const next=response();await POST({...actor,body},next);expect(next.status).toHaveBeenCalledWith(400)}
 const next=response();await GET({...actor,params:{id:'bad'}},next);expect(next.status).toHaveBeenCalledWith(400);expect(matchOrderItem).not.toHaveBeenCalled();expect(readMatchChoices).not.toHaveBeenCalled()
})
test('does not expose private errors',async()=>{(readMatchChoices as jest.Mock).mockRejectedValue(Error('secret provider token'));const res=response();await GET(actor,res);expect(res.json).toHaveBeenCalledWith({message:expect.not.stringContaining('secret')})})
