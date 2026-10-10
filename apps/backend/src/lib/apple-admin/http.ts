import type { MedusaRequest as BaseRequest, AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import type { IAuthModuleService, IUserModuleService } from '@medusajs/framework/types'
import { Modules } from '@medusajs/framework/utils'
import { appleAdminConfig, requireAppleAdmin, requireOrigin, cookieValue, opaque, randomSecret, digest,
  BROWSER_COOKIE, GRANT_COOKIE, secureCookie, PROFILE_PATH, APPLE_STAFF_PROVIDER, APPLE_ISSUER } from './config'
import { appleStore, Transaction, VerifiedTransaction, LoginGrant } from './store'
import { exchangeAppleCode } from './tokens'
import { linkedStaff, linkStaff } from './identities'
type MedusaRequest = BaseRequest & Partial<Pick<AuthenticatedMedusaRequest, 'auth_context'>>

function noStore(res: MedusaResponse) { res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'no-referrer') }
function services(req: MedusaRequest) { return { auth: req.scope.resolve<IAuthModuleService>(Modules.AUTH), users: req.scope.resolve<IUserModuleService>(Modules.USER) } }
export async function appleStatus(req: MedusaRequest, res: MedusaResponse) {
  noStore(res)
  const config = appleAdminConfig()
  res.json({ available: !!config, origin: config?.origin })
}
export async function appleStart(req: MedusaRequest, res: MedusaResponse, purpose: 'login' | 'link') {
  noStore(res)
  try {
    const config = requireAppleAdmin()
    requireOrigin(req.headers, config)
    const store = appleStore(config)
    if (!await store.limit(req.ip || 'unknown')) return res.status(429).json({ message: 'Please wait before trying Apple sign-in again.' })
    const browser = randomSecret(), state = randomSecret(), nonce = randomSecret()
    const record: Transaction = { binding: digest(browser), nonce, purpose }
    if (purpose === 'link') {
      const context = req.auth_context
      if (context?.actor_type !== 'user' || !context.actor_id || !context.auth_identity_id) throw new Error('Staff session required')
      const { auth, users } = services(req)
      const identity = await auth.retrieveAuthIdentity(context.auth_identity_id)
      await users.retrieveUser(context.actor_id)
      if (identity.app_metadata?.user_id !== context.actor_id) throw new Error('Staff identity mismatch')
      record.userId = context.actor_id; record.authIdentityId = context.auth_identity_id
    }
    await store.put('state', state, record, 600)
    res.cookie(BROWSER_COOKIE, browser, { ...secureCookie, maxAge: 600000 })
    res.clearCookie(GRANT_COOKIE, secureCookie)
    const url = new URL(APPLE_ISSUER + '/auth/authorize')
    url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.callback,
      response_type: 'code', response_mode: 'form_post', scope: 'email', state, nonce }).toString()
    res.json({ location: url.toString() })
  } catch { res.status(400).json({ message: 'Apple sign-in could not be started.' }) }
}
export async function appleCallback(req: MedusaRequest, res: MedusaResponse) {
  noStore(res)
  const config = appleAdminConfig()
  if (!config) return res.status(503).json({ message: 'Apple sign-in is unavailable.' })
  try {
    const body = req.body as Record<string, unknown>
    const state = opaque(body?.state)
    const store = appleStore(config)
    const record = await store.take<Transaction>('state', state)
    if (!record || body.error || typeof body.code !== 'string') throw new Error('Invalid Apple callback')
    const entityId = await exchangeAppleCode(body.code, record.nonce, config)
    await store.put('verified', state, { ...record, entityId }, 120)
    // form_post cannot rely on Lax cookies. The top-level GET validates the initiating browser.
    const path = record.purpose === 'link' ? '/admin/apple-login/finish' : '/staff-apple/finish'
    res.redirect(303, config.origin + path + '?state=' + state)
  } catch { res.redirect(303, config.origin + '/app/login?apple=failed') }
}
export async function appleFinish(req: MedusaRequest, res: MedusaResponse, purpose: 'login' | 'link') {
  noStore(res)
  const config = appleAdminConfig()
  if (!config) return res.status(503).json({ message: 'Apple sign-in is unavailable.' })
  const destination = purpose === 'link' ? PROFILE_PATH : '/app/login'
  try {
    const binding = digest(cookieValue(req.headers, BROWSER_COOKIE))
    const record = await appleStore(config).take<VerifiedTransaction>('verified', opaque(req.query.state), binding)
    if (!record || record.purpose !== purpose) throw new Error('Invalid Apple browser transaction')
    const { auth, users } = services(req)
    if (purpose === 'link') {
      const context = req.auth_context
      if (context?.actor_type !== 'user' || context.actor_id !== record.userId || context.auth_identity_id !== record.authIdentityId) throw new Error('Staff session changed')
      await linkStaff(auth, users, record.entityId, record.userId!, record.authIdentityId!)
      res.clearCookie(BROWSER_COOKIE, secureCookie)
      return res.redirect(303, config.origin + destination + '?apple=linked')
    }
    const { identity, userId } = await linkedStaff(auth, users, record.entityId)
    const grant = randomSecret()
    const login: LoginGrant = { binding, entityId: record.entityId, authIdentityId: identity.id, userId }
    await appleStore(config).put('grant', grant, login, 60)
    res.cookie(GRANT_COOKIE, grant, { ...secureCookie, maxAge: 60000 })
    res.redirect(303, config.origin + destination + '?apple=finish')
  } catch {
    res.clearCookie(BROWSER_COOKIE, secureCookie); res.clearCookie(GRANT_COOKIE, secureCookie)
    res.redirect(303, config.origin + destination + '?apple=failed')
  }
}
export async function appleLinkStatus(req: MedusaRequest, res: MedusaResponse) {
  noStore(res)
  const config = appleAdminConfig()
  const { auth } = services(req)
  const identities = config && req.auth_context?.auth_identity_id
    ? await auth.listProviderIdentities({ provider: APPLE_STAFF_PROVIDER, auth_identity_id: req.auth_context.auth_identity_id }) : []
  res.json({ available: !!config, origin: config?.origin, linked: identities.length > 0 })
}
