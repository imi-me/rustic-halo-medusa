import { createHash } from 'node:crypto'
import { readClawPalette } from '../hair-claw-color-store'
import { ADMIN_OPERATIONS } from '../../modules/admin-operations'
import { etsyWorkspaceAccess } from './listing-workspace'
import { EtsyDraftClient, draftCreationEnabled } from './draft-client'
export const settingsRevision = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export async function readEtsyDraftSettings(scope: any, request: typeof fetch=fetch) {
  if(!draftCreationEnabled())throw Error('Etsy draft preparation is not enabled in this environment.')
  const access=await etsyWorkspaceAccess(scope)
  if(!access.scopes.includes('listings_w'))throw Error('Reconnect Etsy with listing-write permission to prepare unpublished drafts.')
  const client=new EtsyDraftClient(access,request),active=await client.listings('active')
  const claws=active.filter(row=>/hair\s*(?:claw|clip)/i.test(row.title??''))
  if(!claws.length)throw Error('An existing hair-claw listing is needed to confirm Etsy category, shipping and processing defaults.')
  const source=claws[0],keys=['taxonomy_id','shipping_profile_id','return_policy_id','who_made','when_made','is_supply','shop_section_id']
  if(claws.some(row=>keys.some(key=>row[key]!==source[key])))throw Error('Etsy hair-claw listing settings differ. Review the shared category/shipping defaults before preparing new drafts.')
  const inventory=await client.inventory(source.listing_id),profiles=[...new Set(inventory.products.filter((p:any)=>!p.is_deleted).flatMap((p:any)=>p.offerings.filter((o:any)=>!o.is_deleted).map((o:any)=>o.readiness_state_id)))]
  if(profiles.length!==1||!Number.isSafeInteger(profiles[0])||!Number.isSafeInteger(source.taxonomy_id))throw Error('Confirm the hair-claw Etsy processing profile before preparing a draft.')
  const settings={...Object.fromEntries(keys.map(key=>[key,source[key]??null])),readiness_state_id:profiles[0] as number,source_listing_id:source.listing_id,source_title:source.title}
  const palette=await readClawPalette(scope.resolve(ADMIN_OPERATIONS))
  return {access,client,settings,settings_revision:settingsRevision(Object.fromEntries(Object.entries(settings).filter(([key])=>!key.startsWith('source_')))),palette}
}
