import { orderConfirmation, ConfirmationOrder } from '../lib/email/order-confirmation'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'

export default async function previewOrderEmail() {
  const sample: ConfirmationOrder = {
    number: 6, customerName: 'Shipping Test', currency: 'usd',
    items: [{ title: 'Top Down Hair Claws', variant: '4-inch', quantity: 1, total: 12 }],
    subtotal: 12, shipping: 6.07, tax: 0, discount: 0, total: 18.07,
    addressLines: ['Shipping Test', '215 Clayton St.', 'San Francisco, CA 94117', 'United States'],
    shippingMethod: 'USPS Ground Advantage — TEST',
  }
  const email = orderConfirmation(sample)
  assert(email.html.includes('$18.07') && email.text.includes('Shipping: $6.07'))
  const escaped = orderConfirmation({ ...sample, customerName: '<script>alert(1)</script>', addressLines: ['A & B'], items: [{ title: '<img src=x>', quantity: 1, total: 12 }] })
  assert(!escaped.html.includes('<script>') && !escaped.html.includes('<img src=x>') && escaped.html.includes('A &amp; B'))
  const target = resolve(process.cwd(), '../../.local/order-email-preview.html')
  writeFileSync(target, email.html)
  writeFileSync(target.replace('.html', '.txt'), email.text)
  console.log('Email preview generated; totals and HTML escaping checked. Nothing sent.')
}
