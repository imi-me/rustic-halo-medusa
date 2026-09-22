import type { ExecArgs } from '@medusajs/framework/types'
import { generateJwtToken, ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { randomUUID, randomBytes, createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import Redis from 'ioredis'

/** Full local HTTP route test. Only creates/removes its own staging auth identity. */
export default async function testResetHttp({container}: ExecArgs) {
  assert.equal(process.env.APP_ENV, 'staging')
  assert.equal(process.env.EMAIL_DELIVERY_ENABLED, 'false')
  assert.notEqual(process.env.CUSTOMER_PASSWORD_RESET_ENABLED, 'true')
  const email = `reset-http-${randomUUID()}@example.invalid`
  const password = randomBytes(32).toString('hex')
  const replacement = randomBytes(32).toString('hex')
  const auth = container.resolve('auth')
  const {http} = container.resolve(ContainerRegistrationKeys.CONFIG_MODULE).projectConfig
  const redis = new Redis(process.env.REDIS_URL!, {maxRetriesPerRequest: 1})
  redis.on('error', () => {})
  const keys: string[] = []
  let identity: string | undefined
  const issue = async (expiresIn = '900s', purpose = 'reset', actor = 'customer') => {
    const token = await auth.createPasswordResetToken({provider:'emailpass',entity_id:email,ttl_seconds:900})
    keys.push('rh:reset-used:' + createHash('sha256').update(token.jti).digest('hex'))
    return generateJwtToken({entity_id:email,provider:'emailpass',actor_type:actor,purpose}, {
      secret:http.jwtSecret,expiresIn,jwtOptions:{...http.jwtOptions,jwtid:token.jti},
    })
  }
  const update = async (token: string) => {
    const response = await fetch('http://127.0.0.1:9000/auth/customer/emailpass/update', {
      method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
      body:JSON.stringify({email,password:replacement}), signal:AbortSignal.timeout(10000),
    })
    await response.arrayBuffer()
    return response.status
  }
  try {
    const registration = await auth.register('emailpass',{body:{email,password}})
    assert.equal(registration.success,true)
    assert.ok(registration.authIdentity)
    identity = registration.authIdentity.id
    const signed = await issue()
    const pieces = signed.split('.')
    pieces[2] = (pieces[2][0] === 'a' ? 'b' : 'a') + pieces[2].slice(1)
    assert.equal(await update(pieces.join('.')),401,'Forged signature must be rejected')
    assert.ok([401,503].includes(await update(await issue('-1s'))),'Expired JWT must be rejected')
    assert.ok([401,503].includes(await update(await issue('900s','session'))),'Session token must be rejected')
    assert.equal(await update(await issue('900s','reset','user')),401,'Admin actor must be rejected')
    const old = await issue()
    const current = await issue()
    assert.equal(await update(old),401,'Superseded token must be rejected')
    assert.equal((await auth.authenticate('emailpass',{body:{email,password}})).success,true)
    console.log('PASS HTTP: forged, expired, wrong-purpose, wrong-actor and superseded tokens rejected')
    const results = await Promise.all(Array.from({length:8},()=>update(current)))
    assert.equal(results.filter(code=>code===200).length,1,`Expected one success; statuses ${results.join(',')}`)
    assert.ok(results.every(code=>code===200||code===401))
    assert.equal(await update(current),401,'Completed reset must not be replayed')
    assert.equal((await auth.authenticate('emailpass',{body:{email,password:replacement}})).success,true)
    assert.equal((await auth.authenticate('emailpass',{body:{email,password}})).success,false)
    console.log('PASS HTTP: one of eight concurrent updates succeeded; replay rejected; only new password works')
  } finally {
    if(identity) await auth.deleteAuthIdentities([identity])
    if(keys.length) await redis.del(...keys)
    await redis.quit()
  }
  console.log('PASSWORD_RECOVERY_HTTP_TEST_COMPLETE')
}
