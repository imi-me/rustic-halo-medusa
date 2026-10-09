jest.mock('@medusajs/framework/utils', () => ({ContainerRegistrationKeys:{PG_CONNECTION:'pg',QUERY:'query'}}))
import { GET, POST } from '../../../api/admin/social-media/posts/route'
const response = () => { const res:any={setHeader:jest.fn()};res.sendStatus=jest.fn().mockReturnValue(res);res.status=jest.fn().mockReturnValue(res);res.json=jest.fn().mockReturnValue(res);return res }
describe('social draft API access',()=>{
  it('rejects unauthenticated reads and writes before touching storage',async()=>{
    const res=response(),req:any={headers:{},scope:{resolve:jest.fn()}}
    await GET(req,res);await POST(req,res)
    expect(res.sendStatus).toHaveBeenCalledWith(401);expect(req.scope.resolve).not.toHaveBeenCalled()
  })
  it('rejects a foreign origin before touching storage',async()=>{
    process.env.ADMIN_CORS='http://localhost:19000'
    const res=response(),req:any={auth_context:{actor_id:'user_1'},headers:{origin:'https://foreign.example'},scope:{resolve:jest.fn()}}
    await POST(req,res);expect(res.sendStatus).toHaveBeenCalledWith(403);expect(req.scope.resolve).not.toHaveBeenCalled()
  })
  it('rejects invalid page offsets',async()=>{
    const res=response(),req:any={auth_context:{actor_id:'user_1'},headers:{},query:{page:'-1'},scope:{resolve:jest.fn()}}
    await GET(req,res);expect(res.status).toHaveBeenCalledWith(400)
  })
})
