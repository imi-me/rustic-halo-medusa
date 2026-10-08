import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { syncOrderTax } from '../lib/tax/sync-order'

export default async function handler({ event, container }: SubscriberArgs<{ id: string }>) {
  if (process.env.STRIPE_TAX_REPORTING_TEST_ENABLED !== 'true'
    && process.env.STRIPE_TAX_REPORTING_LIVE_ENABLED !== 'true') return
  if (event.name === 'order.placed') return syncOrderTax(container, event.data.id)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: payments } = await query.graph({ entity: 'payment', filters: { id: event.data.id }, fields: ['id', 'payment_collection.order.id'] })
  const orderId = payments[0]?.payment_collection?.order?.id
  // Capture can precede the order link; order.placed performs the same sync.
  if (orderId) await syncOrderTax(container, orderId)
}
export const config: SubscriberConfig = {
  event: ['order.placed', 'payment.captured', 'payment.refunded'],
  context: { subscriberId: 'rustic-halo-stripe-tax-test-reporting' },
}
