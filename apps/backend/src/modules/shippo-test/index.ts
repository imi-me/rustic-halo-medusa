import { ModuleProvider, Modules } from '@medusajs/framework/utils'
import ShippoTestService from './service'
export default ModuleProvider(Modules.FULFILLMENT, { services: [ShippoTestService] })
