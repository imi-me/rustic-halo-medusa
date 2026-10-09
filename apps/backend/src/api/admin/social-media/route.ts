import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { isReady } from '../../../lib/admin-assistant'
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (!req.auth_context?.actor_id) return res.sendStatus(401)
  res.json({ ai_ready: isReady(), publishing_enabled: false })
}
