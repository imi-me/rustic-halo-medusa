import type { MedusaRequest, MedusaResponse, MedusaNextFunction } from '@medusajs/framework/http'
import { MedusaError } from '@medusajs/framework/utils'
import { APPLE_STAFF_PROVIDER } from './config'
import { secureCookie, BROWSER_COOKIE, GRANT_COOKIE } from './config'
export function guardAppleStaffActor(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  if (req.params.auth_provider === APPLE_STAFF_PROVIDER && req.params.actor_type !== 'user') {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, 'Apple staff login is available only for invited staff.')
  }
  if (req.params.auth_provider === APPLE_STAFF_PROVIDER) {
    _res.setHeader('Cache-Control', 'no-store')
    _res.setHeader('Referrer-Policy', 'no-referrer')
    _res.clearCookie(BROWSER_COOKIE, secureCookie)
    _res.clearCookie(GRANT_COOKIE, secureCookie)
  }
  next()
}
