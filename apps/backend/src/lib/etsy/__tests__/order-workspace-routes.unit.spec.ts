jest.mock('../order-workspace-store', () => ({ readOrderWorkspace: jest.fn(), refreshOrderWorkspace: jest.fn(), readOrderDetails: jest.fn(), savePreparation: jest.fn() }))
jest.mock('../../../api/admin/assistant/route', () => ({ allowedOrigin: (req: any) => req.headers.origin === 'https://staging.rustichalo.com' }))
import { GET, POST } from '../../../api/admin/integrations/etsy/workspace/route'
import { GET as detail, POST as prepare } from '../../../api/admin/integrations/etsy/workspace/[id]/route'
import { refreshOrderWorkspace, savePreparation } from '../order-workspace-store'
function response() { const res: any = { setHeader: jest.fn(), json: jest.fn(), sendStatus: jest.fn() }; res.status = jest.fn(() => res); return res }
const actor: any = { auth_context: { actor_id: 'staff', actor_type: 'user' }, headers: { origin: 'https://staging.rustichalo.com' }, params: { id: '99' }, body: { action: 'refresh' } }
beforeEach(() => jest.clearAllMocks())
test.each([GET, POST, detail, prepare])('anonymous or non-staff actors cannot read or mutate workspace %#', async handler => {
 for (const req of [{ ...actor, auth_context: null }, { ...actor, auth_context: { actor_id: 'customer', actor_type: 'customer' } }]) {
  const res = response(); await handler(req, res); expect(res.sendStatus).toHaveBeenCalledWith(401)
 }
 expect(refreshOrderWorkspace).not.toHaveBeenCalled(); expect(savePreparation).not.toHaveBeenCalled()
})
test.each([POST, prepare])('cross-origin mutations fail before any provider or storage operation %#', async handler => {
 const res = response(); await handler({ ...actor, headers: { origin: 'https://untrusted.test' } }, res)
 expect(res.sendStatus).toHaveBeenCalledWith(403)
 expect(refreshOrderWorkspace).not.toHaveBeenCalled(); expect(savePreparation).not.toHaveBeenCalled()
})
test('unsupported stage or refresh fields fail validation', async () => {
 for (const [handler, body] of [[prepare, { stage: 'shipped', expected_revision: 'stale' }], [POST, { action: 'refresh', provider_write: true }]] as const) {
  const res = response(); await handler({ ...actor, body }, res); expect(res.status).toHaveBeenCalledWith(400)
 }
 expect(refreshOrderWorkspace).not.toHaveBeenCalled(); expect(savePreparation).not.toHaveBeenCalled()
})
