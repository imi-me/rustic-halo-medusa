import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { Modules } from '@medusajs/framework/utils'
import { ADMIN_OPERATIONS } from '../../../modules/admin-operations'
import { readClawPalette, saveClawPalette } from '../../../lib/hair-claw-color-store'
import { allowedOrigin } from '../assistant/route'
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (!req.auth_context?.actor_id || req.auth_context.actor_type !== 'user') return res.sendStatus(401)
  return res.json(await readClawPalette(req.scope.resolve(ADMIN_OPERATIONS)))
}
export async function POST(req: AuthenticatedMedusaRequest<any>, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (!req.auth_context?.actor_id || req.auth_context.actor_type !== 'user') return res.sendStatus(401)
  if (!allowedOrigin(req)) return res.sendStatus(403)
  if (typeof req.body?.expected_revision !== 'string') return res.status(400).json({ message: 'Reload shared colors before saving.' })
  try { return res.json(await req.scope.resolve(Modules.LOCKING).execute('rh-hair-claw-colors', () => saveClawPalette(req.scope.resolve(ADMIN_OPERATIONS), req.body.colors, req.body.expected_revision))) }
  catch (error) { return res.status(409).json({ message: (error as Error).message }) }
}
