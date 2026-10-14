import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { CopyPhotoError } from '../../../../lib/admin-assistant/photos'
import { allowedOrigin } from '../route'
import { acquire, isReady } from '../../../../lib/admin-assistant'
import { copyInputSchema, generateProductCopy } from '../../../../lib/admin-assistant/product-copy'
export async function POST(req: AuthenticatedMedusaRequest<any>, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store')
  const actor = req.auth_context?.actor_id
  if (!actor || req.auth_context.actor_type !== 'user') return res.sendStatus(401)
  if (!allowedOrigin(req)) return res.sendStatus(403)
  if (!isReady()) return res.status(503).json({ message: 'Ask Rusty needs its backend project key and model before AI suggestions are available.' })
  const parsed = copyInputSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues.some(issue => issue.message.includes('photo previews are too large')) ? 'Selected photo previews are too large together. Use smaller photos or select fewer newly added images.' : 'Provide a title and bounded product facts; no buyer information or credentials.' })
  const release = acquire(actor)
  if (!release) return res.status(429).json({ message: 'One AI request at a time, up to 10 per hour.' })
  try { return res.json({ suggestion: await generateProductCopy(parsed.data) }) }
  catch (error) { if (error instanceof CopyPhotoError) return res.status(400).json({ message: error.message }); return res.status(502).json({ message: 'AI could not produce a valid suggestion. Your draft is unchanged.' }) }
  finally { release() }
}
