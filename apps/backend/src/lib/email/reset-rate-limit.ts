import { createHash } from 'node:crypto'
import Redis from 'ioredis'
import type { MedusaRequest, MedusaResponse, MedusaNextFunction } from '@medusajs/framework/http'

// One atomic operation across all backend replicas. The hash tag also keeps
// both keys in the same slot if Redis Cluster is introduced later.
export const RESET_LIMIT_SCRIPT = `
local account = tonumber(redis.call('GET', KEYS[1]) or '0')
local total = tonumber(redis.call('GET', KEYS[2]) or '0')
if account >= 3 or total >= 100 then return 0 end
for i = 1, 2 do
  local count = redis.call('INCR', KEYS[i])
  if count == 1 then redis.call('EXPIRE', KEYS[i], 900) end
end
return 1
`

let client: Redis | undefined
function redis() {
  if (!process.env.REDIS_URL) throw new Error('Reset limiter unavailable')
  if (!client) {
    client = new Redis(process.env.REDIS_URL, {
      connectTimeout: 2000, commandTimeout: 3000,
      maxRetriesPerRequest: 1,
    })
    // Never log Redis connection strings or raw errors containing credentials.
    client.on('error', () => {})
  }
  return client
}

export async function allowReset(identifier: string, connection: Pick<Redis, 'eval'> = redis()) {
  const hash = createHash('sha256').update(identifier.trim().toLowerCase()).digest('hex')
  return Number(await connection.eval(RESET_LIMIT_SCRIPT, 2,
    `rh:{password-reset}:account:${hash}`, 'rh:{password-reset}:total')) === 1
}

export async function limitPasswordReset(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  if (process.env.CUSTOMER_PASSWORD_RESET_ENABLED !== 'true') {
    res.status(503).json({ message: 'Password recovery is temporarily unavailable.' })
    return
  }
  const identifier = (req.body as { identifier?: unknown } | undefined)?.identifier
  if (typeof identifier !== 'string' || identifier.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier.trim())) {
    res.status(400).json({ message: 'Enter a valid email address.' })
    return
  }
  try {
    if (!await allowReset(identifier)) {
      res.setHeader('Retry-After', '900')
      res.status(429).json({ message: 'Please wait before requesting another reset.' })
      return
    }
  } catch {
    res.status(503).json({ message: 'Password recovery is temporarily unavailable.' })
    return
  }
  next()
}
