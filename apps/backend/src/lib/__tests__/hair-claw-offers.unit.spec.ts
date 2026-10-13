import {activeOfferVariantIds,offerPrices,priceRevision,saveTypeOffer} from '../hair-claw-offers'
import {guardHairClawOffer} from '../guard-hair-claw-offer'
import {POST} from '../../api/admin/products/[id]/hair-claw-media/route'
import {updateProductVariantsWorkflow,createProductVariantsWorkflow,createProductOptionsWorkflow} from '@medusajs/medusa/core-flows'
jest.mock('@medusajs/medusa/core-flows',()=>({updateProductVariantsWorkflow:jest.fn(),createProductVariantsWorkflow:jest.fn(),createProductOptionsWorkflow:jest.fn()}))
const fit={image_id:'owned',editor_version:2,width:300,height:110,scale:1,x:0,y:0,vertical:false,enabled:true}
function setup(){
 const variants=Array.from({length:13},(_,i)=>({id:'v'+i,price_set:{prices:[{id:'usd'+i,currency_code:'usd',amount:10,updated_at:'old',min_quantity:null,max_quantity:null,price_rules:[]},{id:'eur'+i,currency_code:'eur',amount:8,updated_at:'old',min_quantity:5,max_quantity:10,price_rules:[{attribute:'region_id',value:'europe'}]}]}}))
 const product:any={id:'p',images:[{id:'owned',url:'https://cdn.example.com/photo.jpg'}],variants,metadata:{unrelated:'keep',hair_claw_template_v2:{offer_mode:true,palette:Array(13).fill('color'),variant_ids:variants.map(v=>v.id)},hair_claw_overlays_v1:{revision:'r',recipes:{'4-natural':fit,'4-cbc':{...fit,x:10}},offers:{'4-natural':{variant_ids:variants.map(v=>v.id)}}}}}
 const products={retrieveProduct:jest.fn(async()=>product),updateProducts:jest.fn(async(_id,update)=>{product.metadata=update.metadata})}
 const native=jest.fn(async({input})=>{for(const update of input.product_variants){const variant=product.variants.find((v:any)=>v.id===update.id);for(const p of update.prices){const old=variant.price_set.prices.find((x:any)=>x.id===p.id);old.amount=p.amount;old.updated_at='new'}}return{result:[]}})
 ;(updateProductVariantsWorkflow as unknown as jest.Mock).mockReturnValue({run:native})
 const scope={resolve:(name:string)=>name==='query'?{graph:async()=>({data:[product]})}:name==='product'?products:name==='locking'?{execute:async(_key,fn)=>fn()}:null}
 const input:any={size:'4',finish:'natural',price:20,revision:'r',pricing_revision:priceRevision(variants),recipe:fit}
 return{product,products,scope,input,native}
}
beforeEach(()=>jest.clearAllMocks())
it('filters each size and finish by its own enabled overlay, ignoring old size-only fits',()=>{
 const metadata={hair_claw_template_v2:{offer_mode:true},hair_claw_overlays_v1:{recipes:{'4':fit,'4-natural':fit,'2-natural':{...fit,enabled:false}},offers:{'4-natural':{variant_ids:['natural']},'4-cbc':{variant_ids:['painted']},'2-natural':{variant_ids:['two']}}}}
 expect([...activeOfferVariantIds(metadata)!]).toEqual(['natural'])
 expect(activeOfferVariantIds({})).toBeNull()
})
it('publishes a price to all colors of only the selected type, retaining other prices and IDs',async()=>{
 const x=setup();const result=await saveTypeOffer(x.scope,'p',x.input)
 expect(x.native).toHaveBeenCalledTimes(1)
 const rows=x.native.mock.calls[0][0].input.product_variants
 expect(rows).toHaveLength(13)
 expect(rows[0].prices).toEqual([{id:'usd0',currency_code:'usd',amount:20,min_quantity:null,max_quantity:null,rules:{}},{id:'eur0',currency_code:'eur',amount:8,min_quantity:5,max_quantity:10,rules:{region_id:'europe'}}])
 expect(result.settings.recipes['4-cbc'].x).toBe(10)
 expect(x.product.metadata.unrelated).toBe('keep')
 expect(result.offer_prices['4-natural'].amount).toBe(20)
})
it('saves an independent draft fit and draft price without touching live prices',async()=>{
 const x=setup();x.input.recipe={...fit,x:25,enabled:false};x.input.price=99
 const result=await saveTypeOffer(x.scope,'p',x.input)
 expect(x.native).not.toHaveBeenCalled()
 expect(result.settings.recipes['4-natural']).toEqual(fit)
 expect(result.settings.drafts['4-natural'].x).toBe(25)
 expect(result.settings.draft_prices['4-natural']).toBe(99)
 expect(x.product.variants[0].price_set.prices[0].amount).toBe(10)
})
it('keeps a missing 2-inch option as a hidden draft, without creating inventory or purchase variants',async()=>{
 const x=setup();x.input.size='2';x.input.recipe={...fit,enabled:false};x.input.pricing_revision=priceRevision([])
 const result=await saveTypeOffer(x.scope,'p',x.input)
 expect(result.settings.drafts['2-natural']).toBeDefined()
 expect(result.settings.recipes['2-natural']).toBeUndefined()
 expect(createProductVariantsWorkflow).not.toHaveBeenCalled()
 expect(createProductOptionsWorkflow).not.toHaveBeenCalled()
})
it('rejects changed price and fit revisions before writing',async()=>{
 for(const field of ['pricing_revision','revision']){const x=setup();x.input[field]='stale';await expect(saveTypeOffer(x.scope,'p',x.input)).rejects.toThrow();expect(x.native).not.toHaveBeenCalled();expect(x.products.updateProducts).not.toHaveBeenCalled()}
})
it('removes only the chosen fit, hides it and preserves its variants and other fits',async()=>{
 const x=setup();x.input.recipe=null;const result=await saveTypeOffer(x.scope,'p',x.input)
 expect(result.settings.recipes['4-natural']).toBeUndefined();expect(result.settings.recipes['4-cbc']).toBeDefined();expect(result.settings.offers['4-natural'].variant_ids).toHaveLength(13);expect(x.native).not.toHaveBeenCalled()
})
it('rejects foreign photos and unequal price groups remain explicit',async()=>{
 const x=setup();x.input.recipe={...fit,image_id:'foreign'};await expect(saveTypeOffer(x.scope,'p',x.input)).rejects.toThrow('photo');expect(x.native).not.toHaveBeenCalled();x.product.variants[1].price_set.prices[0].amount=11;expect(offerPrices(x.product)['4-natural'].amount).toBeNull()
})
it('rejects cart adds for hidden options while preserving non-hair-claw behavior',async()=>{
 const next=jest.fn();const metadata={hair_claw_template_v2:{offer_mode:true},hair_claw_overlays_v1:{recipes:{'4-natural':fit},offers:{'4-natural':{variant_ids:['allowed']}}}}
 const req:any={body:{variant_id:'hidden'},scope:{resolve:()=>({graph:async()=>({data:[{product:{metadata}}]})})}}
 await expect(guardHairClawOffer(req,{},next)).rejects.toThrow('not currently available');expect(next).not.toHaveBeenCalled();req.body.variant_id='allowed';await guardHairClawOffer(req,{},next);expect(next).toHaveBeenCalledTimes(1);req.scope.resolve=()=>({graph:async()=>({data:[{product:{metadata:{}}}]})});await guardHairClawOffer(req,{},next);expect(next).toHaveBeenCalledTimes(2)
})

it('requires authenticated staff and an allowed origin for price-capable saves',async()=>{
 const response:any={sendStatus:jest.fn(),json:jest.fn()}
 const req:any={params:{id:'p'},body:{size:'4',finish:'natural',price:15,pricing_revision:'hash',revision:null,recipe:fit},headers:{},scope:{resolve:jest.fn()}}
 await POST(req,response);expect(response.sendStatus).toHaveBeenCalledWith(401);expect(req.scope.resolve).not.toHaveBeenCalled()
 req.auth_context={actor_id:'staff',actor_type:'user'};req.headers.origin='https://foreign.example';await POST(req,response);expect(response.sendStatus).toHaveBeenCalledWith(403);expect(req.scope.resolve).not.toHaveBeenCalled()
})
