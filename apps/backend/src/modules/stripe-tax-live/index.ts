import { ModuleProvider, Modules } from '@medusajs/framework/utils'
import StripeTaxLiveService from './service'
export default ModuleProvider(Modules.TAX, { services: [StripeTaxLiveService] })
