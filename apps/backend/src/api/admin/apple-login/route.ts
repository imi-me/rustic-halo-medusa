import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { appleStart, appleLinkStatus } from '../../../lib/apple-admin/http'
export const GET = appleLinkStatus
export const POST = (req: MedusaRequest, res: MedusaResponse) => appleStart(req, res, 'link')
