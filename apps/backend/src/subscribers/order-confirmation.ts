import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'
import { emailSettings } from '../lib/email/settings'
import type { ConfirmationOrder } from '../lib/email/order-confirmation'

export default async function orderConfirmationHandler({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  if (!emailSettings().enabled) return
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: 'order',
    fields: ['id', 'display_id', 'email', 'customer_id', 'currency_code', 'subtotal', 'shipping_subtotal', 'tax_total', 'discount_total', 'total', 'items.title', 'items.variant_title', 'items.quantity', 'items.subtotal', 'shipping_address.*', 'shipping_methods.name'],
    filters: { id: data.id },
  })
  const order = orders[0]
  if (!order?.email) throw new Error('Order confirmation requires an order and recipient.')
  const address = order.shipping_address
  const amount = (value: unknown) => {
    const n = Number(value)
    if (value == null || !Number.isFinite(n)) throw new Error('Order confirmation is missing an amount.')
    return n
  }
  const confirmation: ConfirmationOrder = {
    number: order.display_id ?? order.id,
    customerName: address?.first_name || 'there',
    currency: order.currency_code,
    items: (order.items || []).map(item => ({ title: item!.title, variant: item!.variant_title || undefined, quantity: item!.quantity, total: amount(item!.subtotal) })),
    subtotal: amount(order.subtotal), shipping: amount(order.shipping_subtotal), tax: amount(order.tax_total), discount: amount(order.discount_total), total: amount(order.total),
    addressLines: address ? [
      [address.first_name, address.last_name].filter(Boolean).join(' '), address.company, address.address_1, address.address_2,
      [address.city, address.province?.toUpperCase(), address.postal_code].filter(Boolean).join(', '), address.country_code?.toUpperCase(),
    ].filter((line): line is string => Boolean(line)) : [],
    shippingMethod: (order.shipping_methods || []).map(method => method!.name).join(', '),
  }
  await container.resolve(Modules.NOTIFICATION).createNotifications({
    to: order.email, channel: 'email', template: 'order-confirmation',
    data: { order: confirmation, orderId: order.id },
    trigger_type: 'order.placed', resource_id: order.id, resource_type: 'order', receiver_id: order.customer_id,
    idempotency_key: `order-confirmation/${order.id}`,
  })
}

export const config: SubscriberConfig = { event: 'order.placed', context: { subscriberId: 'rustic-halo-order-confirmation' } }
