import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { appleFinish } from '../../../../lib/apple-admin/http'
export const GET = (req: MedusaRequest, res: MedusaResponse) => appleFinish(req, res, 'link')
