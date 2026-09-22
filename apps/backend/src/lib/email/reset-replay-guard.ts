import { createHash } from 'node:crypto'
import Redis from 'ioredis'
import type { MedusaRequest, MedusaResponse, MedusaNextFunction } from '@medusajs/framework/http'

let client: Redis | undefined
function connection() {
  if (!process.env.REDIS_URL) throw Error('Reset protection unavailable')
  if (!client) {
    client = new Redis(process.env.REDIS_URL, { connectTimeout: 2000, commandTimeout: 3000, maxRetriesPerRequest: 1 })
    client.on('error', () => {})
  }
  return client
}

// Medusa still verifies the signature, actor, purpose and database token. This
// additional atomic claim prevents two successful password writes when Medusa's
// database token consumption races. Never release the claim after a failed write:
// the customer must request a fresh link, just as with Medusa's consumed token.
export async function claimResetToken(token: string, redis: Pick<Redis, 'set'> = connection(), prefix = 'rh:reset-used:') {
  const parts = token.split('.')
  if (parts.length !== 3) throw Error('Invalid reset token')
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
  if (payload.purpose !== 'reset' || typeof payload.jti !== 'string' || !Number.isSafeInteger(payload.exp)) throw Error('Invalid reset token')
  const ttl = payload.exp - Math.floor(Date.now() / 1000) + 60
  if (ttl <= 60 || ttl > 86460) throw Error('Invalid reset token lifetime')
  const key = prefix + createHash('sha256').update(payload.jti).digest('hex')
  return await redis.set(key, '1', 'EX', ttl, 'NX') === 'OK'
}

export async function guardResetReplay(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const authorization = req.headers.authorization || ''
  const token = /^Bearer (\S+)$/i.exec(authorization)?.[1]
  try {
    if (!token || !await claimResetToken(token)) {
      res.status(401).json({message: 'This reset link cannot be used. Request a new link.'})
      return
    }
  } catch {
    res.status(503).json({message: 'Password recovery is temporarily unavailable. Request a new link later.'})
    return
  }
  next()
}
