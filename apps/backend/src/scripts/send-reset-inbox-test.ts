import type { ExecArgs } from '@medusajs/framework/types'
import { generateJwtToken, ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { emailSettings } from '../lib/email/settings'
import { passwordResetEmail, passwordResetKey } from '../lib/email/password-reset'

/** Owner-approved single delivery; never enables background notification delivery. */
export default async function sendResetInboxTest({container}: ExecArgs) {
 assert.equal(process.env.APP_ENV,'staging')
 assert.equal(process.env.EMAIL_DELIVERY_ENABLED,'false')
 assert.notEqual(process.env.CUSTOMER_PASSWORD_RESET_ENABLED,'true')
 const statePath='/tmp/reset-inbox-test-20260920.json'
 const recipient='shawn@house.email'
 const email='reset-inbox-test-20260920@example.invalid'
 const auth=container.resolve('auth')
 for(const line of readFileSync('/tmp/reset-inbox-secret.env','utf8').split(/\r?\n/)) {
  const match=/^(RESEND_API_KEY|RESEND_FROM|RESEND_REPLY_TO)=(.*)$/.exec(line)
  if(match) process.env[match[1]]=match[2].trim().replace(/^(['"])(.*)\1$/, '$2')
 }
 const settings=emailSettings()
 assert.ok(settings.apiKey.startsWith('re_'),'Email key unavailable')
 let state: {identity:string;token:string;sent?:boolean}
 if(existsSync(statePath)) state=JSON.parse(readFileSync(statePath,'utf8'))
 else {
  const registration=await auth.register('emailpass',{body:{email,password:randomBytes(32).toString('hex')}})
  assert.equal(registration.success,true)
  assert.ok(registration.authIdentity)
  const reset=await auth.createPasswordResetToken({provider:'emailpass',entity_id:email,ttl_seconds:900})
  const {http}=container.resolve(ContainerRegistrationKeys.CONFIG_MODULE).projectConfig
  const token=generateJwtToken({entity_id:email,provider:'emailpass',actor_type:'customer',purpose:'reset'}, {
   secret:http.jwtSecret,expiresIn:'900s',jwtOptions:{...http.jwtOptions,jwtid:reset.jti},
  })
  state={identity:registration.authIdentity.id,token}
  writeFileSync(statePath,JSON.stringify(state),{mode:0o600})
 }
 if(state.sent) { console.log('RESET_INBOX_TEST_ALREADY_SENT'); return }
 const message=passwordResetEmail(state.token,email,'http://localhost:18000/us/reset-password')
 const note='This is your requested staging test for a temporary test account. It does not change your Medusa admin password. Open the link on the Mac running the store preview.'
 const response=await fetch('https://api.resend.com/emails',{
  method:'POST',headers:{Authorization:`Bearer ${settings.apiKey}`,'Content-Type':'application/json','Idempotency-Key':passwordResetKey(state.token)},
  body:JSON.stringify({from:settings.from,to:[recipient],reply_to:settings.replyTo,...message,
   subject:'[Staging test] '+message.subject,text:note+'\n\n'+message.text,html:'<p>'+note+'</p>'+message.html}),
  signal:AbortSignal.timeout(20000),
 })
 assert.ok(response.ok,`Email service returned HTTP ${response.status}`)
 const result=await response.json() as {id?:string}
 assert.ok(result.id,'Email service did not confirm acceptance')
 state.sent=true
 writeFileSync(statePath,JSON.stringify(state),{mode:0o600})
 console.log('RESET_INBOX_TEST_ACCEPTED; general delivery remains disabled')
}
