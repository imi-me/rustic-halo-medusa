import { AbstractNotificationProviderService } from '@medusajs/framework/utils'
import type { ProviderSendNotificationDTO, ProviderSendNotificationResultsDTO } from '@medusajs/framework/types'
import { emailSettings } from '../../lib/email/settings'
import { orderConfirmation, type ConfirmationOrder } from '../../lib/email/order-confirmation'
import { passwordResetEmail, passwordResetKey } from '../../lib/email/password-reset'

export default class ResendNotificationService extends AbstractNotificationProviderService {
  static identifier = 'rustic-resend'

  async send(notification: ProviderSendNotificationDTO): Promise<ProviderSendNotificationResultsDTO> {
    const settings = emailSettings()
    if (!settings.enabled) throw new Error('Email delivery is disabled.')
    if (!settings.apiKey.startsWith('re_')) throw new Error('Resend key is not configured.')
    const reset = notification.template === 'password-reset'
    if (reset && (process.env.CUSTOMER_PASSWORD_RESET_ENABLED !== 'true' || typeof notification.data?.token !== 'string' || notification.data?.email !== notification.to)) {
      throw new Error('Password reset delivery is disabled or incomplete.')
    }
    if (!reset && (notification.template !== 'order-confirmation' || !notification.data?.order || !notification.data?.orderId)) {
      throw new Error('Unsupported or incomplete email notification.')
    }
    const email = reset
      ? passwordResetEmail(notification.data!.token as string, notification.to, process.env.CUSTOMER_PASSWORD_RESET_URL || '')
      : orderConfirmation(notification.data!.order as ConfirmationOrder, { logoUrl: settings.logoUrl })
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': reset ? passwordResetKey(notification.data!.token as string) : `order-confirmation/${notification.data!.orderId}`,
      },
      body: JSON.stringify({ from: settings.from, to: [notification.to], reply_to: settings.replyTo, ...email }),
      signal: AbortSignal.timeout(20_000),
    })
    // Do not log response bodies, which can contain customer information.
    if (!response.ok) throw new Error(`Resend rejected the notification (HTTP ${response.status}).`)
    const result = await response.json() as { id?: string }
    if (!result.id) throw new Error('Resend did not return a message ID.')
    return { id: result.id }
  }
}
