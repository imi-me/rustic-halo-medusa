import { Module } from '@medusajs/framework/utils'
import AdminOperationsService from './service'
export const ADMIN_OPERATIONS = 'admin_operations'
export default Module(ADMIN_OPERATIONS, { service: AdminOperationsService })
