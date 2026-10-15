import type { MedusaContainer } from '@medusajs/framework/types'
import { refreshOrderWorkspace } from '../lib/etsy/order-workspace-store'
export default async function etsyOrdersSync(container: MedusaContainer) {
  if (process.env.ETSY_ORDER_REPORT_ENABLED !== 'true') return
  try { await refreshOrderWorkspace(container) }
  catch { container.resolve('logger').warn('Etsy order refresh failed; review the Etsy orders workspace sync status.') }
}
export const config = { name: 'etsy-order-workspace-refresh', schedule: '*/15 * * * *' }
