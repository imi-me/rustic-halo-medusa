import { generateKeyPairSync } from 'node:crypto'
import { container } from '@medusajs/framework'
import { appleStore } from '../store'
import { BROWSER_COOKIE, GRANT_COOKIE, randomSecret } from '../config'
import AppleStaffProvider from '../../../modules/apple-staff/service'
jest.mock('@medusajs/framework', () => ({ container: { resolve: jest.fn() } }))
jest.mock('../store', () => ({ appleStore: jest.fn() }))
describe('Apple provider delegates native authentication without provisioning', () => {
  const original = { ...process.env }
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const take = jest.fn()
  let provider: AppleStaffProvider
  beforeEach(() => {
    jest.clearAllMocks()
    Object.assign(process.env, { APP_ENV: 'staging', APPLE_ADMIN_ENABLED: 'true', LOCAL_HTTP_ADMIN: 'false', APPLE_ADMIN_ORIGIN: 'https://staging.rustichalo.com', APPLE_ADMIN_CLIENT_ID: 'com.rustichalo.admin.staging.web', APPLE_ADMIN_TEAM_ID: '5JHR3HD6LD', APPLE_ADMIN_KEY_ID: '67K2UNT76B', APPLE_ADMIN_PRIVATE_KEY_PEM: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(), REDIS_URL: 'redis://example.invalid' })
    ;(appleStore as jest.Mock).mockReturnValue({ take })
    provider = new AppleStaffProvider()
  })
  afterAll(() => { process.env = original })
  const input = () => ({ url: '/auth/user/apple-staff/callback', headers: { origin: 'https://staging.rustichalo.com', cookie: `${BROWSER_COOKIE}=${randomSecret()}; ${GRANT_COOKIE}=${randomSecret()}` } })
  it('refuses public registration and direct authentication', async () => {
    expect((await provider.register()).success).toBe(false)
    expect((await provider.authenticate()).success).toBe(false)
    expect(take).not.toHaveBeenCalled()
  })
  it('rejects a non-staff route even when the browser has grant cookies', async () => {
    expect((await provider.validateCallback({ ...input(), url: '/auth/customer/apple-staff/callback' }, {} as any)).success).toBe(false)
    expect(take).not.toHaveBeenCalled()
  })
  it('rejects a cross-origin callback before consuming any grant', async () => {
    const data = input(); data.headers.origin = 'https://evil.invalid'
    expect((await provider.validateCallback(data, {} as any)).success).toBe(false)
    expect(take).not.toHaveBeenCalled()
  })
  it('rejects a missing, wrong-browser, expired or already consumed grant', async () => {
    take.mockResolvedValue(null)
    expect((await provider.validateCallback(input(), {} as any)).success).toBe(false)
    expect(container.resolve).not.toHaveBeenCalled()
  })
  it('returns the linked auth identity for Medusa MFA processing and creates no token/user', async () => {
    const identity = { id: 'auth_staff', app_metadata: { user_id: 'staff_1' }, provider_identities: [{ provider: 'apple-staff' }] }
    const auth = { listProviderIdentities: jest.fn().mockResolvedValue([{ auth_identity_id: 'auth_staff' }]), retrieveAuthIdentity: jest.fn().mockResolvedValue(identity) }
    const users = { retrieveUser: jest.fn().mockResolvedValue({ id: 'staff_1' }) }
    ;(container.resolve as jest.Mock).mockImplementation(name => name === 'auth' ? auth : users)
    take.mockResolvedValue({ entityId: 'issuer|sub', userId: 'staff_1', authIdentityId: 'auth_staff' })
    const result = await provider.validateCallback(input(), {} as any)
    expect(result).toEqual({ success: true, authIdentity: identity })
    expect(result).not.toHaveProperty('token')
  })
})
