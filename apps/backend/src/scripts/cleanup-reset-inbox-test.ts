import type { ExecArgs } from '@medusajs/framework/types'
import { existsSync, readFileSync, unlinkSync } from 'node:fs'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import Redis from 'ioredis'

export default async function cleanupResetInboxTest({container}: ExecArgs) {
 assert.equal(process.env.APP_ENV,'staging')
 assert.equal(process.env.EMAIL_DELIVERY_ENABLED,'false')
 const path='/tmp/reset-inbox-test-20260920.json'
 if(!existsSync(path)) { console.log('RESET_INBOX_TEST_STATE_ABSENT'); return }
 const state=JSON.parse(readFileSync(path,'utf8'))
 assert.equal(state.sent,true)
 const auth=container.resolve('auth')
 const identities=await auth.listProviderIdentities({provider:'emailpass',entity_id:'reset-inbox-test-20260920@example.invalid'})
 assert.equal(identities.length,1)
 assert.equal(identities[0].auth_identity_id,state.identity)
 const payload=JSON.parse(Buffer.from(state.token.split('.')[1],'base64url').toString('utf8'))
 assert.equal(payload.entity_id,'reset-inbox-test-20260920@example.invalid')
 const redis=new Redis(process.env.REDIS_URL!,{maxRetriesPerRequest:1})
 redis.on('error',()=>{})
 try {
  await auth.deleteAuthIdentities([state.identity])
  await redis.del('rh:reset-used:'+createHash('sha256').update(payload.jti).digest('hex'))
  unlinkSync(path)
  assert.equal(existsSync('/tmp/reset-inbox-secret.env'),false)
  assert.equal((await auth.listProviderIdentities({provider:'emailpass',entity_id:'reset-inbox-test-20260920@example.invalid'})).length,0)
  console.log('RESET_INBOX_TEST_CLEANUP_COMPLETE; temporary identity, token state and key absent; delivery off')
 } finally { await redis.quit() }
}
