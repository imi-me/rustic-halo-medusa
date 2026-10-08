import handler from '../stripe-tax-test-reporting'
import { syncOrderTax } from '../../lib/tax/sync-order'
jest.mock('../../lib/tax/sync-order', () => ({ syncOrderTax: jest.fn() }))
const env = { ...process.env }
afterEach(() => { process.env = { ...env }; jest.clearAllMocks() })
test('live order reporting runs without the sandbox flag', async () => {
  process.env.STRIPE_TAX_REPORTING_TEST_ENABLED = 'false'
  process.env.STRIPE_TAX_REPORTING_LIVE_ENABLED = 'true'
  const container = {} as any
  await handler({ event: { name: 'order.placed', data: { id: 'order_live' } }, container } as any)
  expect(syncOrderTax).toHaveBeenCalledWith(container, 'order_live')
})
test('disabled reporting does not query or report orders', async () => {
  process.env.STRIPE_TAX_REPORTING_TEST_ENABLED = 'false'
  process.env.STRIPE_TAX_REPORTING_LIVE_ENABLED = 'false'
  const container = { resolve: jest.fn() }
  await handler({ event: { name: 'order.placed', data: { id: 'order_disabled' } }, container } as any)
  expect(syncOrderTax).not.toHaveBeenCalled()
  expect(container.resolve).not.toHaveBeenCalled()
})
