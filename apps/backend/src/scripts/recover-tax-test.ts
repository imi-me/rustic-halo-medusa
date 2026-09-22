import type { ExecArgs } from '@medusajs/framework/types'
import { assertShippingTestEnvironment } from '../lib/shipping-test-environment'
import { syncOrderTax } from '../lib/tax/sync-order'

/** Explicit, single-order recovery. Review reconciliation and Stripe records first. */
export default async function recoverTaxTest({ container, args }: ExecArgs) {
  assertShippingTestEnvironment(process.env)
  if (!process.env.STRIPE_API_KEY?.startsWith('sk_test_') || process.env.STRIPE_TAX_REPORTING_TEST_ENABLED !== 'true') throw Error('Enabled sandbox tax reporting required')
  if (args.length !== 2 || !/^order_[A-Za-z0-9]+$/.test(args[0]) || args[1] !== 'reviewed') throw Error('Usage: recover-tax-test ORDER_ID reviewed; inspect reconciliation and Stripe records first')
  const orderId = args[0]
  // The shared handler verifies captured/refunded Stripe amounts, holds a distributed
  // lock, persists immutable sale data, and rejects expired uncertain attempts.
  await syncOrderTax(container, orderId)
  console.log(JSON.stringify({ orderId, status: 'recovery_handler_completed', next: 'Run read-only reconciliation to verify the result', scope: 'Sandbox tax reporting only; no payment or refund issued' }))
}
