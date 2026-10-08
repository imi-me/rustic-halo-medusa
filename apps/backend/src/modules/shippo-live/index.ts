import { ModuleProvider, Modules } from '@medusajs/framework/utils'
import ShippoLiveService from './service'
export default ModuleProvider(Modules.FULFILLMENT, { services: [ShippoLiveService] })
