import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { ADMIN_OPERATIONS } from '../../../modules/admin-operations'
import { readClawPalette } from '../../../lib/hair-claw-color-store'
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store')
  return res.json(await readClawPalette(req.scope.resolve(ADMIN_OPERATIONS)))
}
