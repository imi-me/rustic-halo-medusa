import { Module } from '@medusajs/framework/utils'
import EtsyModuleService from './service'

export const ETSY_MODULE = 'etsy'
export default Module(ETSY_MODULE, { service: EtsyModuleService })
