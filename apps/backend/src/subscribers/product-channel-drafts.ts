import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { prepareChannelDrafts, CHANNEL_DRAFT_EVENT } from '../lib/product-channel-drafts'
export default async function productChannelDrafts({event:{data},container}:SubscriberArgs<{request_id:string}>) {
  await prepareChannelDrafts(container,data.request_id)
}
export const config:SubscriberConfig={event:CHANNEL_DRAFT_EVENT,context:{subscriberId:'rustic-halo-product-channel-drafts'}}
