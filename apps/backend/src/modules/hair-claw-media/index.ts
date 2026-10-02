import { Module } from '@medusajs/framework/utils'
import HairClawMediaService from './service'

export const HAIR_CLAW_MEDIA_MODULE = 'hair_claw_media'

export default Module(HAIR_CLAW_MEDIA_MODULE, { service: HairClawMediaService })
