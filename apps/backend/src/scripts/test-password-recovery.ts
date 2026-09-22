import type { ExecArgs } from '@medusajs/framework/types'
import { randomUUID, randomBytes, createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import Redis from 'ioredis'
import { claimResetToken } from '../lib/email/reset-replay-guard'
import { RESET_LIMIT_SCRIPT } from '../lib/email/reset-rate-limit'

/** Isolated staging fixtures only; no workflow events, emails or customer rows. */
export default async function testPasswordRecovery({container}: ExecArgs) {
  assert.equal(process.env.APP_ENV, 'staging')
  assert.equal(process.env.EMAIL_DELIVERY_ENABLED, 'false')
  assert.notEqual(process.env.CUSTOMER_PASSWORD_RESET_ENABLED, 'true')
  const run = randomUUID()
  const email = `reset-test-${run}@example.invalid`
  const auth = container.resolve('auth')
  const redis = new Redis(process.env.REDIS_URL!, {maxRetriesPerRequest: 1})
  redis.on('error', () => {})
  const keys = [`rh:{reset-test-${run}}:account`, `rh:{reset-test-${run}}:total`]
  let identity: string | undefined
  try {
    const results = await Promise.all(Array.from({length: 12}, () => redis.eval(RESET_LIMIT_SCRIPT, 2, ...keys)))
    assert.equal(results.filter(x => Number(x) === 1).length, 3)
    assert.ok((await redis.ttl(keys[0])) > 0)
    assert.ok((await redis.ttl(keys[1])) > 0)
    await redis.del(keys[0])
    await redis.set(keys[1], '100', 'EX', 900)
    assert.equal(Number(await redis.eval(RESET_LIMIT_SCRIPT, 2, ...keys)), 0)
    console.log('PASS shared limiter: concurrent account cap, expiry, total cap')
    const registration = await auth.register('emailpass', {body: {email, password: randomBytes(32).toString('hex')}})
    assert.equal(registration.success, true)
    assert.ok(registration.authIdentity)
    identity = registration.authIdentity.id
    const create = (ttl_seconds = 900) => auth.createPasswordResetToken({provider: 'emailpass', entity_id: email, ttl_seconds})
    const consume = (jti: string, entity_id = email) => auth.consumePasswordResetToken({provider: 'emailpass', entity_id, jti})
    const old = await create()
    const current = await create()
    await assert.rejects(() => consume(old.jti))
    await assert.rejects(() => consume(current.jti, 'different@example.invalid'))
    await consume(current.jti)
    await assert.rejects(() => consume(current.jti))
    console.log('PASS reset tokens: replacement, account binding, single use')
    const expired = await create(1)
    await new Promise(resolve => setTimeout(resolve, 1200))
    await assert.rejects(() => consume(expired.jti))
    console.log('PASS reset tokens: expiration')
    const concurrent = await create()
    const prefix = `rh:reset-test-${run}:used:`
    keys.push(prefix + createHash('sha256').update(concurrent.jti).digest('hex'))
    const token = 'fixture.' + Buffer.from(JSON.stringify({purpose: 'reset', jti: concurrent.jti, exp: Math.floor(Date.now()/1000)+900})).toString('base64url') + '.fixture'
    const attempts = await Promise.allSettled(Array.from({length: 8}, async () => {
      await consume(concurrent.jti)
      assert.equal(await claimResetToken(token, redis, prefix), true)
    }))
    assert.equal(attempts.filter(x => x.status === 'fulfilled').length, 1, 'Concurrent reset token reuse must have exactly one success')
    console.log('PASS reset tokens: concurrent single use')
  } finally {
    if (identity) await auth.deleteAuthIdentities([identity])
    await redis.del(...keys)
    await redis.quit()
  }
  console.log('PASSWORD_RECOVERY_SECURITY_TEST_COMPLETE')
}
