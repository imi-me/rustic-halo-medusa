import { container } from '@medusajs/framework'
import { AbstractAuthModuleProvider, Modules } from '@medusajs/framework/utils'
import type { AuthenticationInput, AuthenticationResponse, AuthIdentityProviderService, IAuthModuleService, IUserModuleService } from '@medusajs/framework/types'
import { APPLE_STAFF_PROVIDER, requireAppleAdmin, requireOrigin, cookieValue, BROWSER_COOKIE, GRANT_COOKIE, digest } from '../../lib/apple-admin/config'
import { appleStore, LoginGrant } from '../../lib/apple-admin/store'
import { linkedStaff } from '../../lib/apple-admin/identities'

export default class AppleStaffProvider extends AbstractAuthModuleProvider {
  static identifier = APPLE_STAFF_PROVIDER
  static DISPLAY_NAME = 'Apple (invited staff)'
  async authenticate(): Promise<AuthenticationResponse> { return { success: false, error: 'Start Apple sign-in from the Admin login page.' } }
  async register(): Promise<AuthenticationResponse> { return { success: false, error: 'Admin access is invitation-only.' } }
  async validateCallback(data: AuthenticationInput, _identityService: AuthIdentityProviderService): Promise<AuthenticationResponse> {
    try {
      const config = requireAppleAdmin()
      if (!data.url || new URL(data.url, config.origin).pathname !== '/auth/user/apple-staff/callback') throw new Error('Invalid staff callback route')
      requireOrigin(data.headers || {}, config)
      const binding = digest(cookieValue(data.headers || {}, BROWSER_COOKIE))
      const grant = cookieValue(data.headers || {}, GRANT_COOKIE)
      const login = await appleStore(config).take<LoginGrant>('grant', grant, binding)
      if (!login) throw new Error('Expired Apple sign-in')
      const auth = container.resolve<IAuthModuleService>(Modules.AUTH)
      const users = container.resolve<IUserModuleService>(Modules.USER)
      const { identity, userId } = await linkedStaff(auth, users, login.entityId)
      if (identity.id !== login.authIdentityId || userId !== login.userId) throw new Error('Staff link changed')
      // Medusa's auth service applies MFA and verification before its native route issues a token.
      return { success: true, authIdentity: identity }
    } catch { return { success: false, error: 'Apple sign-in failed. Sign in with your password and link Apple in your profile.' } }
  }
}
