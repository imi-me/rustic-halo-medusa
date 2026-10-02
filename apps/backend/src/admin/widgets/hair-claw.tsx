import { defineWidgetConfig } from '@medusajs/admin-sdk'
import { DetailWidgetProps, AdminProduct } from '@medusajs/framework/types'
import HairClawEditor from '../components/hair-claw-editor'

// Available on every product so imported products without a reliable type are not excluded.
const HairClawWidget = ({ data }: DetailWidgetProps<AdminProduct>) => {
  return <details><summary>Configure hair-claw overlay (2″ / 4″)</summary><HairClawEditor key={data.id} productId={data.id} /></details>
}
export const config = defineWidgetConfig({ zone: 'product.details.after' })
export default HairClawWidget
