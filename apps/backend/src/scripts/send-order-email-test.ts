import { randomUUID } from 'node:crypto'
import ResendNotificationService from '../modules/resend/service'
import type { ConfirmationOrder } from '../lib/email/order-confirmation'

// Run only after the owner approves the recipient and this one test send.
async function sendTest() {
  const recipient = process.env.EMAIL_TEST_RECIPIENT
  if (process.env.EMAIL_TEST_APPROVED !== 'true' || !recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    throw new Error('Set EMAIL_TEST_APPROVED=true and EMAIL_TEST_RECIPIENT only after owner approval.')
  }
  const order: ConfirmationOrder = {
    number: 'TEST', customerName: 'Shawn', currency: 'usd',
    items: [{ title: 'Top Down Hair Claws — sample order', variant: '4-inch', quantity: 1, total: 12 }],
    subtotal: 12, shipping: 6.07, tax: 0, discount: 0, total: 18.07,
    addressLines: ['Sample order only — no purchase or shipment'],
    shippingMethod: 'USPS Ground Advantage — example',
  }
  const previous = process.env.EMAIL_DELIVERY_ENABLED
  // Enables only this process, never the server or private config file.
  process.env.EMAIL_DELIVERY_ENABLED = 'true'
  try {
    const result = await new ResendNotificationService().send({
      to: recipient, channel: 'email', template: 'order-confirmation',
      data: { order, orderId: process.env.EMAIL_TEST_ID || `test-${randomUUID()}` },
    })
    console.log(`Test email accepted by Resend. Message ID: ${result.id}`)
  } finally {
    if (previous === undefined) delete process.env.EMAIL_DELIVERY_ENABLED
    else process.env.EMAIL_DELIVERY_ENABLED = previous
  }
}
sendTest().catch(error => { console.error(error.message); process.exitCode = 1 })
