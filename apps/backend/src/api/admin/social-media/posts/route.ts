import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { allowedOrigin } from '../../assistant/route'
import { TABLE, savePost, SocialError } from '../../../../lib/social-media'
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (!req.auth_context?.actor_id) return res.sendStatus(401)
  const db = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const page = Number(req.query.page || 0)
  if (!Number.isInteger(page) || page < 0 || page > 10000) return res.status(400).json({ message: 'Invalid page.' })
  const posts = await db(TABLE).whereNull('deleted_at').orderBy('created_at','desc').limit(101).offset(page * 100)
  return res.json({ posts: posts.slice(0,100), has_more: posts.length > 100 })
}
export async function POST(req: AuthenticatedMedusaRequest<any>, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store')
  const actor = req.auth_context?.actor_id
  if (!actor) return res.sendStatus(401)
  if (!allowedOrigin(req)) return res.sendStatus(403)
  try { return res.json({ post: await savePost(req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION), req.scope.resolve(ContainerRegistrationKeys.QUERY), actor, req.body) }) }
  catch (error) { return res.status(error instanceof SocialError ? error.status : 500).json({ message: error instanceof SocialError ? error.message : 'Post could not be saved. Reload saved posts before retrying.' }) }
}
