import { z } from 'zod'
import { clawSizeExclusionsSchema, clawColorSettingsSchema } from './hair-claw-colors'
import { colorExport, emptyEtsyDraft, sellableColorVariants } from './product-admin'
export const channelDraftSchema=z.object({settings_revision:z.string().regex(/^[a-f0-9]{64}$/),palette_revision:z.string().min(1).max(100),excluded_by_size:clawSizeExclusionsSchema,quantity:z.number().int().min(1).max(999)}).strict()
export const channelColorMetadata = (input: z.infer<typeof channelDraftSchema>) => clawColorSettingsSchema.parse({excluded_by_size:input.excluded_by_size})
export function buildClawChannelPlan(product:any,palette:any,quantity:number,copy:any,readinessId:number) {
  if(product.metadata?.hair_claw_template_v2?.color_mode!=='order')throw Error('Save the real size/finish offers before preparing channel drafts.')
  const source={...product,metadata:{...product.metadata,hair_claw_palette_v1:palette}},choices=sellableColorVariants(source)
  const draft={...emptyEtsyDraft(),...copy,listing_id:'',colors:choices.map((v:any)=>({variant_id:v.id,quantity,image_url:''}))}
  const selection=colorExport(source,draft),offers=selection.order_options!.offers,colors=selection.order_options!.colors
  if(!offers.length||offers.length!==product.metadata.hair_claw_template_v2.variant_ids.length||!colors.length)throw Error('Choose at least one available color for every size and finish.')
  if(offers.length*colors.length>400)throw Error('This Etsy draft has too many color combinations. Reduce its available colors.')
  if(selection.variants.some(row=>row.price<=0))throw Error('Etsy needs a positive price for each offer.')
  const body={products:offers.flatMap(offer=>colors.map(color=>{
    const row=selection.variants.find(v=>v.variant_id===offer.variant_id&&v.color===color),base=selection.variants.find(v=>v.variant_id===offer.variant_id)!
    return {sku:offer.sku,property_values:[{property_id:513,property_name:'Size / Finish',scale_id:null,value_ids:[],values:[offer.value]},{property_id:514,property_name:'Color',scale_id:null,value_ids:[],values:[color]}],offerings:[{price:base.price,quantity,is_enabled:Boolean(row),readiness_state_id:readinessId}]}
  })),sku_on_property:[513],price_on_property:[513],quantity_on_property:[513],readiness_state_on_property:[]}
  return {draft,selection,inventory:body,summary:offers.map(offer=>({...offer,colors:selection.variants.filter(v=>v.variant_id===offer.variant_id).map(v=>v.color)}))}
}
export function channelInventoryShape(body:any) {
  return {products:body.products.filter((p:any)=>!p.is_deleted).map((p:any)=>({sku:p.sku,properties:p.property_values.map((v:any)=>({id:v.property_id,name:v.property_name,values:v.values})).sort((a:any,b:any)=>a.id-b.id),offerings:p.offerings.filter((o:any)=>!o.is_deleted).map((o:any)=>({price:typeof o.price==='number'?o.price:o.price.amount/o.price.divisor,quantity:o.quantity,enabled:o.is_enabled,readiness:o.readiness_state_id}))})).sort((a:any,b:any)=>JSON.stringify(a.properties).localeCompare(JSON.stringify(b.properties))),...Object.fromEntries(['sku_on_property','price_on_property','quantity_on_property','readiness_state_on_property'].map(key=>[key,[...(body[key]??[])].sort((a,b)=>a-b)]))}
}
