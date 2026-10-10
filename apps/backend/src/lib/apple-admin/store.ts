import Redis from 'ioredis'
import { AppleAdminConfig, digest, opaque } from './config'

export type Transaction = { binding: string; nonce: string; purpose: 'login' | 'link'; userId?: string; authIdentityId?: string }
export type VerifiedTransaction = Transaction & { entityId: string }
export type LoginGrant = { binding: string; entityId: string; userId: string; authIdentityId: string }
export interface AppleStore {
  put(kind: string, id: string, record: object, ttl: number): Promise<void>
  take<T>(kind: string, id: string, binding?: string): Promise<T | null>
  limit(id: string): Promise<boolean>
}
// Compare the browser binding before deletion, then consume atomically across workers.
const TAKE = `local v=redis.call('GET',KEYS[1]); if not v then return nil end; if ARGV[1]~='' and cjson.decode(v).binding~=ARGV[1] then return nil end; redis.call('DEL',KEYS[1]); return v`
const LIMIT = `local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],600) end; return n`
export class RedisAppleStore implements AppleStore {
  constructor(private redis: Redis, private namespace: string) {}
  private key(kind: string, id: string) { return this.namespace + kind + ':' + digest(opaque(id)) }
  async put(kind: string, id: string, record: object, ttl: number) {
    if (await this.redis.set(this.key(kind, id), JSON.stringify(record), 'EX', ttl, 'NX') !== 'OK') throw new Error('Apple transaction collision')
  }
  async take<T>(kind: string, id: string, binding = ''): Promise<T | null> {
    const result = await this.redis.eval(TAKE, 1, this.key(kind, id), binding)
    return typeof result === 'string' ? JSON.parse(result) as T : null
  }
  async limit(id: string) {
    const count = await this.redis.eval(LIMIT, 1, this.namespace + 'limit:' + digest(id))
    return Number(count) <= 12
  }
}
let singleton: { url: string; redis: Redis } | undefined
export function appleStore(config: AppleAdminConfig): AppleStore {
  if (!singleton) {
    const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: 2, connectTimeout: 5000, retryStrategy: attempt => attempt <= 2 ? attempt * 200 : null })
    redis.on('error', () => {})
    singleton = { url: config.redisUrl, redis }
  }
  if (singleton.url !== config.redisUrl) throw new Error('Apple Redis configuration changed')
  return new RedisAppleStore(singleton.redis, config.namespace)
}
