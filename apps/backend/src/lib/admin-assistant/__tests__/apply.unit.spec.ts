jest.mock('@medusajs/framework/utils', () => ({ ContainerRegistrationKeys: { QUERY: 'query' } }))
const run = jest.fn().mockResolvedValue({ result: [] })
jest.mock('@medusajs/medusa/core-flows', () => ({ updateProductsWorkflow: () => ({ run }) }))
import { POST } from '../../../api/admin/assistant/apply/route'
import { signProposal, type Proposal } from '..'

describe('explicit assistant apply endpoint', () => {
  const original = { title: 'Original', description: 'Before' }
  const graph = jest.fn()
  const info = jest.fn()
  const scope = { resolve: (key: string) => key === 'query' ? { graph } : { info } }
  const response = () => { const res: any = { status: jest.fn(), json: jest.fn(), sendStatus: jest.fn(), setHeader: jest.fn() }; res.status.mockReturnValue(res); return res }
  const proposal = (): Proposal => ({ productId: 'prod_123', actor: 'user_123', before: original, after: { title: 'Updated', description: 'After' }, nonce: Math.random().toString(), expires: Date.now() + 10000 })
  const request = (token: string): any => ({ body: { token }, headers: { origin: 'http://localhost:19000' }, auth_context: { actor_id: 'user_123' }, scope })
  beforeEach(() => { run.mockClear(); graph.mockReset().mockResolvedValue({ data: [{ id: 'prod_123', ...original }] }); process.env.COOKIE_SECRET = 'test-signing-secret'; process.env.ADMIN_ASSISTANT_ENABLED = 'true'; process.env.ADMIN_ASSISTANT_OPENAI_API_KEY = 'test-only'; process.env.ADMIN_ASSISTANT_MODEL = 'test-model'; process.env.ADMIN_CORS = 'http://localhost:19000' })
  it('applies only signed title/description after explicit request', async () => {
    const token = signProposal(proposal()); const req = request(token); req.body.price = 1
    const res = response(); await POST(req, res)
    expect(run).toHaveBeenCalledWith({ input: { products: [{ id: 'prod_123', title: 'Updated', description: 'After' }] } })
    expect(res.json).toHaveBeenCalledWith({ applied: true, productId: 'prod_123' })
    await POST(request(token), response()); expect(run).toHaveBeenCalledTimes(1)
  })
  it('rejects stale products without writing', async () => {
    graph.mockResolvedValue({ data: [{ title: 'Someone else edited this', description: 'Before' }] })
    const res = response(); await POST(request(signProposal(proposal())), res)
    expect(res.status).toHaveBeenCalledWith(409); expect(run).not.toHaveBeenCalled()
  })
  it('rejects unauthenticated, wrong origin, expired and disabled requests', async () => {
    const token = signProposal(proposal()); let req = request(token); req.auth_context = {}; let res = response(); await POST(req, res); expect(res.sendStatus).toHaveBeenCalledWith(401)
    req = request(token); req.headers.origin = 'https://evil.example'; res = response(); await POST(req, res); expect(res.sendStatus).toHaveBeenCalledWith(403)
    res = response(); await POST(request(signProposal({ ...proposal(), expires: 1 })), res); expect(res.status).toHaveBeenCalledWith(400)
    process.env.ADMIN_ASSISTANT_ENABLED = 'false'; res = response(); await POST(request(token), res); expect(res.status).toHaveBeenCalledWith(503)
    expect(run).not.toHaveBeenCalled()
  })
})
