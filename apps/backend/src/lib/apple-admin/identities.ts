import { IAuthModuleService, IUserModuleService } from '@medusajs/framework/types'
import { APPLE_STAFF_PROVIDER } from './config'

export async function linkedStaff(auth: IAuthModuleService, users: IUserModuleService, entityId: string) {
  const identities = await auth.listProviderIdentities({ provider: APPLE_STAFF_PROVIDER, entity_id: entityId })
  if (identities.length !== 1 || !identities[0].auth_identity_id) throw new Error('Apple identity is not linked to invited staff')
  const identity = await auth.retrieveAuthIdentity(identities[0].auth_identity_id, { relations: ['provider_identities'] })
  const userId = identity.app_metadata?.user_id
  if (typeof userId !== 'string' || !userId) throw new Error('Apple identity is not a staff identity')
  const user = await users.retrieveUser(userId)
  if (!user || user.deleted_at) throw new Error('Staff account is unavailable')
  return { identity, userId }
}
export async function linkStaff(auth: IAuthModuleService, users: IUserModuleService, entityId: string, userId: string, authIdentityId: string) {
  const user = await users.retrieveUser(userId)
  if (!user || user.deleted_at) throw new Error('Staff account is unavailable')
  const identity = await auth.retrieveAuthIdentity(authIdentityId)
  if (identity.app_metadata?.user_id !== userId) throw new Error('Staff identity mismatch')
  const existing = await auth.listProviderIdentities({ provider: APPLE_STAFF_PROVIDER, entity_id: entityId })
  if (existing.length) {
    if (existing.length !== 1 || existing[0].auth_identity_id !== authIdentityId) throw new Error('Apple identity is already linked')
    return
  }
  const own = await auth.listProviderIdentities({ provider: APPLE_STAFF_PROVIDER, auth_identity_id: authIdentityId })
  if (own.length) throw new Error('Staff account already has an Apple identity')
  await auth.createProviderIdentities({ provider: APPLE_STAFF_PROVIDER, entity_id: entityId, auth_identity_id: authIdentityId,
    provider_metadata: { issuer: 'https://appleid.apple.com' }, user_metadata: {} })
}
