import { createHash } from 'node:crypto'
import { Modules } from '@medusajs/framework/utils'
import { ADMIN_OPERATIONS } from '../modules/admin-operations'
import { createAdminProduct, type creationSchema } from './admin-product-create'
import { newProductIsHairClaw, validateNewClawOffers } from './new-hair-claw'
import { colorSupportsSize } from './hair-claw-colors'
import { buildClawChannelPlan, channelInventoryShape } from './claw-channel-plan'
import { readEtsyDraftSettings } from './etsy/draft-settings'
import { EtsyDraftClient, approvedDraftImage, draftCreationEnabled, draftImageBytes } from './etsy/draft-client'
import { etsyWorkspaceAccess } from './etsy/listing-workspace'
import { offerProduct } from './hair-claw-offers'
import { ETSY_DRAFT_KEY } from './product-admin'
import { readClawPalette } from './hair-claw-color-store'
import { seoText } from './product-seo-values'
export const CHANNEL_DRAFT_EVENT='product.channel-drafts.requested'
const key=(id:string)=>`product-channel-drafts:${id}`
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
type Input=ReturnType<typeof creationSchema.parse>
function result(row:any) {
  return {request_id:row.payload.input.request_id,status:row.status,message:row.payload.message??(row.status==='complete'?'Both drafts are ready for review.':'Preparing your unpublished website and Etsy drafts.'),product_id:row.payload.product_id??null,etsy_listing_id:row.payload.listing_id??null,summary:row.payload.summary??[],website_url:row.payload.product_id?`/app/products/${row.payload.product_id}`:null,etsy_url:row.payload.listing_id?`https://www.etsy.com/your/shops/me/listing-editor/edit/${row.payload.listing_id}`:null}
}
export async function channelDraftStatus(scope:any,id:string) {
  const [row]=await scope.resolve(ADMIN_OPERATIONS).listAdminOperations({operation_key:key(id)})
  if(!row)throw Error('Draft preparation was not found.')
  return result(row)
}
export async function retryChannelDrafts(scope:any,id:string) {
  if(!draftCreationEnabled())throw Error('Etsy draft preparation is disabled.')
  return scope.resolve('locking').execute('channel-request:'+id,async()=>{
    const ops=scope.resolve(ADMIN_OPERATIONS),[row]=await ops.listAdminOperations({operation_key:key(id)})
    if(!row)throw Error('Draft preparation was not found.')
    if(row.status==='complete'||row.status==='processing'&&Date.now()-Date.parse(row.payload.started_at??row.updated_at)<900000||row.status==='queued'&&Date.now()-Date.parse(row.payload.queued_at??row.updated_at)<90000)return result(row)
    const saved=await ops.updateAdminOperations({id:row.id,status:'queued',payload:{...row.payload,queued_at:new Date().toISOString(),message:'Continuing the saved draft preparation.'}})
    try{await scope.resolve(Modules.EVENT_BUS).emit({name:CHANNEL_DRAFT_EVENT,data:{request_id:id}})}catch{await ops.updateAdminOperations({id:saved.id,status:'failed',payload:{...saved.payload,message:'Your request is saved. Retry preparation to continue.'}});throw Error('Your request is saved. Retry preparation to continue.')}
    return result(saved)
  },{timeout:5,expire:120})
}
export async function queueChannelDrafts(scope:any,input:Input) {
  if(!draftCreationEnabled()||!input.channel_drafts)throw Error('Choose the combined draft preparation option.')
  return scope.resolve('locking').execute('channel-request:'+input.request_id,async()=>{
    const ops=scope.resolve(ADMIN_OPERATIONS),[saved]=await ops.listAdminOperations({operation_key:key(input.request_id)}),fingerprint=hash(input)
    if(saved&&saved.payload.hash!==fingerprint)throw Error('This draft request changed. Continue the saved preparation before starting another product.')
    if(saved?.status==='complete'||saved?.status==='processing'&&Date.now()-Date.parse(saved.payload.started_at??saved.updated_at)<900000||saved?.status==='queued'&&Date.now()-Date.parse(saved.payload.queued_at??saved.updated_at)<90000)return result(saved)
    let row=saved
    if(!row){
      const type=input.type_id?await scope.resolve(Modules.PRODUCT).retrieveProductType(input.type_id):null
      if(!newProductIsHairClaw(type,input.title))throw Error('Combined draft preparation is available for hair claws only.')
      validateNewClawOffers(input)
      if(input.inventory_mode!=='made_to_order')throw Error('Use the made-to-order policy for these website and Etsy drafts. Physical location stock is managed separately.')
      if(input.etsy.listing_id)throw Error('Use the existing-listing editor to link an existing Etsy listing; this action prepares a new draft.')
      const current=await readEtsyDraftSettings(scope),selection=input.channel_drafts!
      if(current.settings_revision!==selection.settings_revision||current.palette.revision!==selection.palette_revision)throw Error('Shared colors or Etsy settings changed. Reload the draft settings before preparing this product.')
      for(const size of ['2','4'] as const){const selected=current.palette.colors.filter(c=>c.active&&colorSupportsSize(c,size)&&!selection.excluded_by_size[size].includes(c.name));if(input.variants.some(v=>v.options.Size?.startsWith(size))&&!selected.length)throw Error('Choose at least one color for each offered size.');if(selection.excluded_by_size[size].some(name=>!current.palette.colors.some(c=>c.name===name)))throw Error('Choose colors from the current shared palette.')}
      const copy={...input.etsy,title:input.title.trim(),description:seoText(input.description),materials:input.etsy.materials.length?input.etsy.materials:input.material.split(/[,;/]/).map(value=>value.trim()).filter(Boolean)}
      if(!copy.title||Array.from(copy.title).length>140||!copy.description||copy.description.length>10000)throw Error('Enter a product name up to 140 characters and a description for both drafts.')
      if(/[^\p{L}\p{Nd}\p{P}\p{Sm}\p{Zs}™©®]/u.test(copy.title)||['%',':','&','+'].some(symbol=>copy.title.split(symbol).length>2))throw Error('Use a shorter plain product title for the Etsy draft, with each of %, :, & and + used at most once.')
      if(copy.materials.some(value=>/[^\p{L}\p{Nd}\p{Zs}]/u.test(value)))throw Error('Use plain material names, separated by commas, for the Etsy draft.')
      const products=scope.resolve(Modules.PRODUCT)
      if((await products.listProductVariants({sku:input.variants.map(v=>v.sku)},{take:1})).length)throw Error('A SKU is already in use. Open the existing product or enter the new design’s correct SKU.')
      if((await products.listProducts({handle:input.handle},{take:1})).length)throw Error('That product handle already exists. Open the existing product or choose a new name.')
      if(input.variants.some(v=>v.price<=0)||new Set(input.variants.map(v=>v.sku)).size!==input.variants.length)throw Error('Each actual size/finish needs one distinct SKU and a positive price.')
      if(new Set(input.images.map(image=>image.url)).size!==input.images.length)throw Error('Choose each product photo once for the paired drafts.')
      if(input.images.length>20)throw Error('Use up to 20 product photos for the paired drafts.')
      for(const image of input.images)approvedDraftImage(image.url)
      row=await ops.createAdminOperations({operation_key:key(input.request_id),kind:'product-channel-drafts',resource_id:'',status:'queued',payload:{hash:fingerprint,input:{...input,etsy:copy},settings:current.settings,palette:current.palette,marker:'Rustic Halo draft '+input.request_id,create_state:'new',images:[],queued_at:new Date().toISOString()}})
    }else row=await ops.updateAdminOperations({id:row.id,status:'queued',payload:{...row.payload,queued_at:new Date().toISOString(),message:'Retrying the saved draft preparation.'}})
    try{await scope.resolve(Modules.EVENT_BUS).emit({name:CHANNEL_DRAFT_EVENT,data:{request_id:input.request_id}})}catch{await ops.updateAdminOperations({id:row.id,status:'failed',payload:{...row.payload,message:'Your request is saved, but preparation could not start. Retry this same request.'}});throw Error('Your request is saved. Retry draft preparation to continue.')}
    return result(row)
  },{timeout:5,expire:120})
}
export async function prepareChannelDrafts(scope:any,id:string,request:typeof fetch=fetch) {
  if(!draftCreationEnabled())throw Error('Etsy draft preparation is disabled.')
  return scope.resolve('locking').execute('channel-preparation:'+id,async()=>{
    const ops=scope.resolve(ADMIN_OPERATIONS),[record]=await ops.listAdminOperations({operation_key:key(id)})
    if(!record)throw Error('Draft preparation request is missing.')
    if(record.status==='complete')return result(record)
    let row=record,p={...record.payload}
    const save=async(status='processing')=>{row=await ops.updateAdminOperations({id:row.id,resource_id:p.product_id??'',status,payload:p})}
    try{
      p.message='Preparing the website draft.';p.started_at=new Date().toISOString();await save()
      const input:Input=p.input
      const website=await createAdminProduct(scope,input);p.product_id=website.id;await save()
      const savedWebsite=await scope.resolve(Modules.PRODUCT).retrieveProduct(website.id)
      const product=await offerProduct(scope,website.id)
      if(savedWebsite.status!=='draft')throw Error('The website product has been published. Review it before continuing this draft preparation.')
      const plan=buildClawChannelPlan(product,p.palette,input.channel_drafts!.quantity,input.etsy,p.settings.readiness_state_id)
      const imageSignature=(value:any)=>value.images.map((image:any)=>[image.url,image.rank??null]).sort((a:any,b:any)=>a[0].localeCompare(b[0]))
      if(!same(product.images.map((i:any)=>i.url).sort(),input.images.map(i=>i.url).sort()))throw Error('The website draft photos changed. Review both drafts before continuing.')
      const planHash=hash({inventory:plan.inventory,images:imageSignature(product),title:input.etsy.title,description:input.etsy.description})
      if(p.plan_hash&&p.plan_hash!==planHash)throw Error('The saved product changed. Review both drafts before continuing.')
      p.plan_hash=planHash;p.summary=plan.summary;p.message='Preparing the Etsy draft.';await save()
      const access=await etsyWorkspaceAccess(scope);if(!access.scopes.includes('listings_w'))throw Error('Reconnect Etsy with listing-write permission.')
      const client=new EtsyDraftClient(access,request)
      if(!p.listing_id){
        const drafts=await client.listings('draft'),found=drafts.filter(l=>l.title===p.marker)
        if(found.length>1)throw Error('More than one matching Etsy draft was found. Review them in Etsy; another draft was not created.')
        if(found.length===1){p.listing_id=found[0].listing_id;p.create_state='created';await save()}
        else if(p.create_state==='creating')throw Error('Etsy has not confirmed the earlier draft creation. Retry later to check for the same draft; another listing will not be created.')
        else{
          const listings=[...drafts,...await client.listings('active'),...await client.listings('inactive'),...await client.listings('expired'),...await client.listings('sold_out')],skus=new Set(plan.summary.map(o=>o.sku.toLowerCase()))
          if(listings.some(l=>(l.skus??[]).some((sku:string)=>skus.has(sku.toLowerCase()))))throw Error('An Etsy listing already uses one of these SKUs. Link that existing listing instead of creating a duplicate.')
          const body=new URLSearchParams({quantity:String(input.channel_drafts!.quantity),title:p.marker,description:input.etsy.description,price:String(Math.min(...plan.selection.variants.map(v=>v.price))),who_made:p.settings.who_made,when_made:p.settings.when_made,taxonomy_id:String(p.settings.taxonomy_id),is_supply:String(p.settings.is_supply),should_auto_renew:'false',type:'physical'})
          for(const name of ['shipping_profile_id','return_policy_id','shop_section_id','readiness_state_id'])if(p.settings[name])body.set(name,String(p.settings[name]))
          if(input.weight) {body.set('item_weight',String(input.weight));body.set('item_weight_unit','g')}
          if(input.etsy.tags.length)body.set('tags',input.etsy.tags.join(','));if(input.etsy.materials.length)body.set('materials',input.etsy.materials.join(','))
          p.create_state='creating';await save()
          let created:any
          try{created=await client.call(`/shops/${access.shopId}/listings`,'POST',body,'application/x-www-form-urlencoded')}catch(error){if((error as any).definite){p.create_state='rejected';await save()}throw error}
          if(!Number.isSafeInteger(created.listing_id))throw Error('Etsy did not confirm the draft listing ID. Retry to check the same draft.')
          p.listing_id=created.listing_id;p.create_state='created';await save()
        }
      }
      let listing=await client.ownedDraft(p.listing_id)
      if(listing.title!==p.marker&&listing.title!==input.etsy.title)throw Error('The Etsy draft title changed outside this preparation. Review it before continuing.')
      if(listing.description!==input.etsy.description)throw Error('The Etsy draft description changed. Review it before continuing.')
      const actual=await client.inventory(p.listing_id),desired=channelInventoryShape(plan.inventory)
      if(!p.initial_inventory){p.initial_inventory=channelInventoryShape(actual);await save()}
      if(!same(channelInventoryShape(actual),desired)){
        if(!same(channelInventoryShape(actual),p.initial_inventory))throw Error('Etsy draft choices changed outside this preparation. Your draft is kept for review.')
        await client.ownedDraft(p.listing_id)
        await client.call(`/listings/${p.listing_id}/inventory?max_variations_supported=3`,'PUT',JSON.stringify(plan.inventory),'application/json')
      }
      if(!same(channelInventoryShape(await client.inventory(p.listing_id)),desired))throw Error('Etsy has not confirmed the size/finish SKUs and order colors. Retry to check the saved draft.')
      p.message='Preparing the Etsy draft photos.';await save()
      for(let index=0;index<input.images.length;index++){
        const url=input.images[index].url,alt=`${input.etsy.title} — product photo ${index+1}`.slice(0,500)
        let image=p.images[index],current=await client.images(p.listing_id)
        if(image?.image_id){if(!current.results?.some((i:any)=>i.listing_image_id===image.image_id))throw Error('An Etsy draft photo was removed. Review the saved draft before continuing.');continue}
        if(image?.state==='uploading'){
          const candidates=(current.results??[]).filter((i:any)=>!image.before_ids.includes(i.listing_image_id)&&i.rank===index+1&&i.alt_text===alt)
          if(candidates.length!==1)throw Error('Etsy has not confirmed an earlier photo upload. Review the saved draft photos before retrying; duplicate uploads are blocked.')
          p.images[index]={...image,image_id:candidates[0].listing_image_id,state:'complete'};await save();continue
        }
        if((current.results??[]).some((i:any)=>i.rank===index+1))throw Error('A photo was added to the Etsy draft outside this preparation. Review it before continuing.')
        const imageData=await draftImageBytes(url,request),form=new FormData();form.append('image',new Blob([Uint8Array.from(imageData.bytes)],{type:imageData.mime}),`hair-claw-${index+1}.${imageData.extension}`);form.append('rank',String(index+1));form.append('overwrite','false');form.append('alt_text',alt)
        p.images[index]={source:url,state:'uploading',before_ids:(current.results??[]).map((i:any)=>i.listing_image_id)};await save();await client.ownedDraft(p.listing_id)
        const uploaded=await client.call(`/shops/${access.shopId}/listings/${p.listing_id}/images`,'POST',form)
        if(!Number.isSafeInteger(uploaded.listing_image_id))throw Error('Etsy did not confirm the draft photo. Retry to check the existing upload.')
        p.images[index]={...p.images[index],state:'complete',image_id:uploaded.listing_image_id};await save()
      }
      listing=await client.ownedDraft(p.listing_id)
      if(listing.title!==input.etsy.title)await client.call(`/shops/${access.shopId}/listings/${p.listing_id}`,'PATCH',new URLSearchParams({title:input.etsy.title}),'application/x-www-form-urlencoded')
      const confirmed=await client.ownedDraft(p.listing_id)
      if(confirmed.title!==input.etsy.title||confirmed.description!==input.etsy.description)throw Error('Etsy draft copy could not be confirmed.')
      const photos=await client.images(p.listing_id)
      if(p.images.some((i:any)=>!photos.results?.some((saved:any)=>saved.listing_image_id===i.image_id)))throw Error('Etsy draft photos could not be confirmed.')
      if(!same(channelInventoryShape(await client.inventory(p.listing_id)),desired))throw Error('Etsy draft choices changed during preparation. Review them before publishing.')
      if((await readClawPalette(ops)).revision!==p.palette.revision)throw Error('Shared colors changed during preparation. Review both drafts before publishing.')
      const latest=await scope.resolve(Modules.PRODUCT).retrieveProduct(website.id)
      if(latest.status!=='draft')throw Error('The website draft was published during preparation. Review both channels.')
      const current=await offerProduct(scope,website.id),currentPlan=buildClawChannelPlan(current,p.palette,input.channel_drafts!.quantity,input.etsy,p.settings.readiness_state_id)
      if(!same(currentPlan.inventory,plan.inventory)||!same(imageSignature(current),imageSignature(product)))throw Error('Website offers changed during preparation. Review both drafts before publishing.')
      await scope.resolve(Modules.PRODUCT).updateProducts(website.id,{metadata:{...latest.metadata,[ETSY_DRAFT_KEY]:{...plan.draft,listing_id:String(p.listing_id)},etsy_draft_preparation_v1:{request_id:id,listing_id:p.listing_id,state:'draft',prepared_at:new Date().toISOString()}}})
      p.message='Both drafts are ready. Review each before publishing.';p.completed_at=new Date().toISOString();await save('complete');return result(row)
    }catch(error){p.message=(error instanceof Error&&/^(Etsy|The |An |A |Choose |Use |Save |Shared |This |Reconnect |Website)/.test(error.message))?error.message:'Draft preparation stopped. Your website draft and saved Etsy progress are kept; retry the same request.';await save('failed');throw error}
  },{timeout:5,expire:900})
}
