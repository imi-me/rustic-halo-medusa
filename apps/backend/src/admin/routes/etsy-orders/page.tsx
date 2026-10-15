import { defineRouteConfig } from '@medusajs/admin-sdk'
import EtsyOrdersWorkspace from '../../components/etsy-orders-workspace'
export const config = defineRouteConfig({ label: 'Etsy orders', rank: 70 })
export default EtsyOrdersWorkspace
