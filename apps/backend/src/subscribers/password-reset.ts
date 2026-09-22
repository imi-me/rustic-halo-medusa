import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { Modules } from '@medusajs/framework/utils'
import { emailSettings } from '../lib/email/settings'
import { passwordResetKey } from '../lib/email/password-reset'

export default async function passwordResetHandler({ event: { data }, container }: SubscriberArgs<{ entity_id: string; token: string; actor_type: string }>) {
 if (data.actor_type !== 'customer' || process.env.CUSTOMER_PASSWORD_RESET_ENABLED !== 'true' || !emailSettings().enabled) return
 if (!data.entity_id || !data.token) throw Error('Incomplete reset event')
 await container.resolve(Modules.NOTIFICATION).createNotifications({
  to: data.entity_id, channel: 'email', template: 'password-reset',
  data: { token: data.token, email: data.entity_id },
  idempotency_key: passwordResetKey(data.token),
 })
}
export const config: SubscriberConfig = { event: 'auth.password_reset', context: { subscriberId: 'rustic-halo-customer-password-reset' } }
