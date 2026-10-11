import { defineWidgetConfig } from '@medusajs/admin-sdk'
import type { AdminOrder, DetailWidgetProps } from '@medusajs/framework/types'
import { InlineEditor } from '../components/inline-editor'

const OrderInlineEdit = ({ data: order }: DetailWidgetProps<AdminOrder>) => <InlineEditor kind="orders" id={order.id}/>
export const config = defineWidgetConfig({ zone: 'order.details.before', id: 'rustic-halo:order-inline-edit' })
export default OrderInlineEdit
