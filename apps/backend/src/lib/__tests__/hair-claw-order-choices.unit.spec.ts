import { planClawOrderChoices, orderChoiceColors } from '../hair-claw-order-choices'
import { syncClawProduct } from '../hair-claw-color-sync'
import { defaultClawColors } from '../hair-claw-colors'
import { guardHairClawOffer, guardCartClawColors } from '../guard-hair-claw-offer'
import { colorExport, emptyEtsyDraft, sellableColorVariants, visibleProductVariants } from '../product-admin'
import { activeOfferVariantIds } from '../hair-claw-offers'
const prices = [{currency_code:'usd',amount:15,price_rules:[]}]
function fixture() {
 const source:any={id:'variant_original',sku:'HC38737',barcode:'INV386710259',options:[{option_id:'legacy',value:'Default Title'}],manage_inventory:true,allow_backorder:true,price_set:{prices}}
 const colors=['Black','Rose'].map(color=>({id:'variant_'+color,sku:'RH-HC2-p-'+color,barcode:'EXTRA-'+color,metadata:{hair_claw_template:'rustic_halo_hair_claw_v2',source_variant_id:source.id,physical_size:'4',base_claw_color:color},options:[{option_id:'size',value:'4 inch'},{option_id:'color',value:color}],price_set:{prices}}))
 const product:any={id:'prod_one',title:'Country Skies Hair Claw',type:{value:'Hair Claw'},metadata:{unrelated:'keep',hair_claw_template_v2:{version:2,variant_ids:colors.map(c=>c.id),option_ids:['size','color'],size_option_id:'size',color_option_id:'color',default_variant_id:colors[0].id},hair_claw_overlays_v1:{recipes:{},offers:{}}},options:[{id:'size',title:'Size',values:[{value:'4 inch'}]},{id:'color',title:'Base color',values:[{value:'Black'},{value:'Rose'}]}],variants:[source,...colors]}
 return {product,source,colors}
}
it('restores original identities and only existing size/finish choices without modifying any variant',()=>{
 const x=fixture(), before=JSON.stringify(x.product.variants), plan=planClawOrderChoices(x.product)
 expect(plan.retained).toEqual(['variant_original']); expect(plan.retired).toHaveLength(2)
 expect(plan.metadata.hair_claw_template_v2.option_ids).toEqual(['size'])
 expect(plan.metadata.hair_claw_template_v2.default_variant_id).toBe('variant_original')
 expect(JSON.stringify(x.product.variants)).toBe(before)
 expect(plan.metadata.unrelated).toBe('keep')
 expect(plan.metadata.hair_claw_template_v2.order_choices.variant_original.size).toBe('4')
 x.product.metadata=plan.metadata
 expect(planClawOrderChoices(x.product).current).toBe(true)
 expect(visibleProductVariants(x.product).map(v=>v.sku)).toEqual(['HC38737'])
 expect([...activeOfferVariantIds(x.product.metadata)!]).toEqual(['variant_original'])
})
it('refuses conflicting prices and missing or ambiguous source identities',()=>{
 const x=fixture(); x.colors[0].price_set={prices:[{currency_code:'usd',amount:99,price_rules:[]}]}
 expect(()=>planClawOrderChoices(x.product)).toThrow('prices differ')
 const y=fixture(); delete y.colors[0].metadata.source_variant_id; delete y.colors[1].metadata.source_variant_id
 expect(()=>planClawOrderChoices(y.product)).toThrow('no unique original')
})
it('synchronizes only product metadata, preserving original identifiers and historical color rows',async()=>{
 const x=fixture(),before=JSON.stringify(x.product.variants)
 const service={updateProducts:jest.fn(async(_id,data)=>{x.product.metadata=data.metadata})}
 const scope={resolve:(name:string)=>name==='query'?{graph:async()=>({data:[x.product]})}:name==='product'?service:{execute:async(_key,fn)=>fn()}}
 expect((await syncClawProduct(scope,'prod_one',defaultClawColors)).created).toBe(0)
 expect((await syncClawProduct(scope,'prod_one',defaultClawColors)).status).toBe('current')
 expect(service.updateProducts).toHaveBeenCalledTimes(1);expect(JSON.stringify(x.product.variants)).toBe(before)
})
it('requires a valid color on direct adds, cart creation, quantity updates and checkout',async()=>{
 const x=fixture();x.product.metadata=planClawOrderChoices(x.product).metadata
 const next=jest.fn(), item:any={id:'line',variant:{...x.source,product:x.product},metadata:{hair_claw_color:'Rose'}}
 const scope={resolve:(name:string)=>name==='query'?{graph:async({entity})=>({data:entity==='cart'?[{items:[item]}]:[item.variant]})}:{listAdminOperations:async()=>[]}}
 for(const body of [{variant_id:x.source.id},{items:[{variant_id:x.source.id,metadata:{hair_claw_color:'bad'}}]}]) await expect(guardHairClawOffer({body,scope} as any,{},next)).rejects.toThrow('Choose an available')
 const req:any={body:{variant_id:x.source.id,metadata:{hair_claw_color:'rose'}},scope}
 await guardHairClawOffer(req,{},next); expect(req.body.metadata.hair_claw_color).toBe('Rose')
 await guardCartClawColors({params:{id:'cart'},scope} as any,{},next)
 x.product.metadata.hair_claw_colors_v1={excluded:['Rose']}
 await expect(guardCartClawColors({params:{id:'cart',line_id:'line'},scope} as any,{},next)).rejects.toThrow('Choose an available')
 expect(orderChoiceColors(x.product,x.source,defaultClawColors).some(c=>c.name==='Rose')).toBe(false)
})
it('exports several Etsy colors using the original SKU and barcode without stock variants',()=>{
 const x=fixture();x.product.metadata=planClawOrderChoices(x.product).metadata
 const choices=sellableColorVariants(x.product).filter(v=>['Black','Rose'].includes(v.metadata.base_claw_color))
 expect(choices).toHaveLength(2); expect(choices.every(v=>v.sku==='HC38737'&&v.barcode==='INV386710259')).toBe(true)
 const draft={...emptyEtsyDraft(),colors:choices.map(v=>({variant_id:v.id,quantity:5,image_url:''}))}
 const result=colorExport(x.product,draft)
 expect(result.variants.map(v=>v.sku)).toEqual(['HC38737','HC38737'])
 expect(result.variants.map(v=>v.variant_id)).toEqual(['variant_original','variant_original'])
 expect(result.variants[0].options.Color).toBe('Black')
})
it('preserves the explicit imported source even when a previous migration labeled it CREAM',()=>{
 const x=fixture();x.source.metadata={base_sku:'HC38737',base_claw_color:'CREAM',inventory_mode:'made_to_order_color_option'}
 const plan=planClawOrderChoices(x.product)
 expect(plan.retained).toEqual([x.source.id]);expect(x.source.sku).toBe('HC38737');expect(x.source.barcode).toBe('INV386710259')
})
it('keeps separate real size/finish offers and their prices without creating other combinations',()=>{
 const x=fixture();const second={...x.source,id:'variant_painted',sku:'HC38738',barcode:'INV123',price_set:{prices:[{currency_code:'usd',amount:19,price_rules:[]}]}}
 const painted:any={...x.colors[0],id:'variant_painted_rose',metadata:{...x.colors[0].metadata,source_variant_id:second.id,claw_finish:'cbc',physical_size:'2'},options:[{option_id:'size',value:'2 inch'},{option_id:'finish',value:'Colors by Cate'},{option_id:'color',value:'Rose'}],price_set:second.price_set}
 for(const v of x.colors)v.options.push({option_id:'finish',value:'Natural'})
 x.product.variants.push(second,painted);x.product.options.push({id:'finish',title:'Finish',values:[{value:'Natural'},{value:'Colors by Cate'}]})
 x.product.metadata.hair_claw_template_v2.option_ids.push('finish');x.product.metadata.hair_claw_template_v2.variant_ids.push(painted.id)
 const plan=planClawOrderChoices(x.product);expect(plan.retained).toEqual([x.source.id,second.id]);expect(Object.values(plan.metadata.hair_claw_template_v2.order_choices).map((c:any)=>[c.size,c.finish])).toEqual([['4','natural'],['2','cbc']])
})
it('checkout cannot substitute request metadata for the color actually saved on a cart line',async()=>{
 const x=fixture();x.product.metadata=planClawOrderChoices(x.product).metadata
 const scope={resolve:(name:string)=>name==='query'?{graph:async()=>({data:[{items:[{id:'line',variant:{...x.source,product:x.product},metadata:{}}]}]})}:{listAdminOperations:async()=>[]}}
 await expect(guardCartClawColors({params:{id:'cart'},body:{metadata:{hair_claw_color:'Rose'}},scope} as any,{},jest.fn())).rejects.toThrow('Choose an available')
})
it('recovers a sole original imported variant only when its one physical size is confirmed',()=>{
 const x=fixture();for(const v of x.colors)delete v.metadata.source_variant_id
 x.source.metadata={shopify_variant_id:'gid://shopify/ProductVariant/123'};x.product.description='A 4-inch hair claw.'
 expect(planClawOrderChoices(x.product).retained).toEqual([x.source.id])
 x.product.description='Available in 2-inch and 4-inch sizes.'
 expect(()=>planClawOrderChoices(x.product)).toThrow('no unique original')
})
it('produces the same reviewed metadata regardless of bulk/single relation ordering',()=>{
 const a=fixture(),b=fixture();b.product.variants.reverse();b.product.options.reverse();for(const v of b.product.variants)v.options.reverse()
 expect(planClawOrderChoices(a.product).metadata).toEqual(planClawOrderChoices(b.product).metadata)
})
