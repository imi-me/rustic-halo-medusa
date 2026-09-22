import { ModuleProvider, Modules } from '@medusajs/framework/utils'
import StripeTaxTestService from './service'
export default ModuleProvider(Modules.TAX, { services: [StripeTaxTestService] })
