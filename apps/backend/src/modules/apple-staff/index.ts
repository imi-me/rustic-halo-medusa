import { ModuleProvider, Modules } from '@medusajs/framework/utils'
import AppleStaffProvider from './service'
export default ModuleProvider(Modules.AUTH, { services: [AppleStaffProvider] })
