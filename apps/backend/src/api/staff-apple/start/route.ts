import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { appleStart } from '../../../lib/apple-admin/http'
export const POST = (req: MedusaRequest, res: MedusaResponse) => appleStart(req, res, 'login')
