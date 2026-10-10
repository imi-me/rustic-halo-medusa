import { linkStaff, linkedStaff } from '../identities'

function setup() {
  const auth = { listProviderIdentities: jest.fn(), retrieveAuthIdentity: jest.fn(), createProviderIdentities: jest.fn() }
  const users = { retrieveUser: jest.fn().mockResolvedValue({ id: 'staff_1' }) }
  return { auth, users, a: auth as any, u: users as any }
}
describe('Apple staff account boundaries', () => {
  it('rejects an unlinked Apple identity without creating an account', async () => {
    const { auth, a, u } = setup(); auth.listProviderIdentities.mockResolvedValue([])
    await expect(linkedStaff(a, u, 'issuer|outsider')).rejects.toThrow('not linked')
    expect(auth.createProviderIdentities).not.toHaveBeenCalled()
  })
  it('rejects an identity linked only to a customer', async () => {
    const { auth, users, a, u } = setup()
    auth.listProviderIdentities.mockResolvedValue([{ auth_identity_id: 'auth_customer' }])
    auth.retrieveAuthIdentity.mockResolvedValue({ id: 'auth_customer', app_metadata: { customer_id: 'customer_1' } })
    await expect(linkedStaff(a, u, 'issuer|customer')).rejects.toThrow('not a staff')
    expect(users.retrieveUser).not.toHaveBeenCalled()
  })
  it('rechecks the invited staff record during login', async () => {
    const { auth, users, a, u } = setup()
    auth.listProviderIdentities.mockResolvedValue([{ auth_identity_id: 'auth_staff' }])
    auth.retrieveAuthIdentity.mockResolvedValue({ id: 'auth_staff', app_metadata: { user_id: 'staff_1' } })
    users.retrieveUser.mockRejectedValue(new Error('deleted'))
    await expect(linkedStaff(a, u, 'issuer|staff')).rejects.toThrow('deleted')
  })
  it('links only the authenticated staff identity and never uses email', async () => {
    const { auth, a, u } = setup()
    auth.retrieveAuthIdentity.mockResolvedValue({ id: 'auth_staff', app_metadata: { user_id: 'staff_1' } })
    auth.listProviderIdentities.mockResolvedValue([])
    await linkStaff(a, u, 'https://appleid.apple.com|verified-sub', 'staff_1', 'auth_staff')
    expect(auth.createProviderIdentities).toHaveBeenCalledWith(expect.objectContaining({ provider: 'apple-staff', entity_id: 'https://appleid.apple.com|verified-sub', auth_identity_id: 'auth_staff', user_metadata: {} }))
  })
  it('rejects switching the staff identity during linking', async () => {
    const { auth, a, u } = setup()
    auth.retrieveAuthIdentity.mockResolvedValue({ id: 'auth_other', app_metadata: { user_id: 'other' } })
    await expect(linkStaff(a, u, 'issuer|sub', 'staff_1', 'auth_other')).rejects.toThrow('mismatch')
    expect(auth.createProviderIdentities).not.toHaveBeenCalled()
  })
  it('rejects linking an Apple identity already owned by another staff member', async () => {
    const { auth, a, u } = setup()
    auth.retrieveAuthIdentity.mockResolvedValue({ id: 'auth_staff', app_metadata: { user_id: 'staff_1' } })
    auth.listProviderIdentities.mockResolvedValue([{ auth_identity_id: 'auth_other' }])
    await expect(linkStaff(a, u, 'issuer|sub', 'staff_1', 'auth_staff')).rejects.toThrow('already linked')
    expect(auth.createProviderIdentities).not.toHaveBeenCalled()
  })
  it('does not replace an existing staff Apple link with a different identity', async () => {
    const { auth, a, u } = setup()
    auth.retrieveAuthIdentity.mockResolvedValue({ id: 'auth_staff', app_metadata: { user_id: 'staff_1' } })
    auth.listProviderIdentities.mockResolvedValueOnce([]).mockResolvedValueOnce([{ entity_id: 'existing' }])
    await expect(linkStaff(a, u, 'issuer|new-sub', 'staff_1', 'auth_staff')).rejects.toThrow('already has')
  })
})
