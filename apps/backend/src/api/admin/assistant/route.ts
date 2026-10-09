import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { acquire, configuration, isReady, runAssistant, validateMessages } from '../../../lib/admin-assistant'

export function allowedOrigin(req: AuthenticatedMedusaRequest) {
  const origin = req.headers.origin
  return !origin || (process.env.ADMIN_CORS || '').split(',').map(value => value.trim()).includes(origin)
}
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (!req.auth_context?.actor_id) return res.sendStatus(401)
  const config = configuration()
  return res.json({ ready: isReady(), enabled: config.enabled, capabilities: ['Read products, orders and inventory', 'Propose product title and description changes for review'], message: isReady() ? 'Ready to help.' : 'Your assistant is waiting for its separate project key and model configuration.' })
}
export async function POST(req: AuthenticatedMedusaRequest<{ messages: unknown }>, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store')
  const actor = req.auth_context?.actor_id
  if (!actor) return res.sendStatus(401)
  if (!allowedOrigin(req)) return res.sendStatus(403)
  if (!isReady()) return res.status(503).json({ message: 'Assistant is not configured. Add the separate project key, model and enable flag on the staging backend.' })
  let messages
  try { messages = validateMessages(req.body?.messages) } catch (error) { return res.status(400).json({ message: (error as Error).message }) }
  const release = acquire(actor)
  if (!release) { res.setHeader('Retry-After', '3600'); return res.status(429).json({ message: 'One question at a time, up to 10 per hour. Please try later.' }) }
  try { return res.json(await runAssistant(req.scope.resolve(ContainerRegistrationKeys.QUERY), actor, messages)) }
  catch { return res.status(502).json({ message: 'The assistant could not answer. Check the project key, model access and usage limits, then try again. No changes were made.' }) }
  finally { release() }
}
