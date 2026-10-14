import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { creationSchema, createAdminProduct } from '../../../lib/admin-product-create'
import { ADMIN_OPERATIONS } from '../../../modules/admin-operations'
import { allowedOrigin } from '../assistant/route'
export async function POST(req: AuthenticatedMedusaRequest<any>, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (!req.auth_context?.actor_id || req.auth_context.actor_type !== 'user')
    return res.sendStatus(401)
  if (!allowedOrigin(req)) return res.sendStatus(403)
  const parsed = creationSchema.safeParse(req.body)
  if (!parsed.success)
    return res
      .status(400)
      .json({
        code: 'creation_preflight',
        message: parsed.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; '),
      })
  try {
    return res.json({ product: await createAdminProduct(req.scope, parsed.data) })
  } catch (error) {
    let submitted = true
    try {
      submitted = Boolean(
        (
          await (req.scope.resolve(ADMIN_OPERATIONS) as any).listAdminOperations({
            operation_key: `product-create:${parsed.data.request_id}`,
          })
        )[0],
      )
    } catch {
      /* An unavailable journal is uncertain. */
    }
    return res
      .status(409)
      .json({
        code: submitted ? 'creation_unconfirmed' : 'creation_preflight',
        message: (error as Error).message,
      })
  }
}
