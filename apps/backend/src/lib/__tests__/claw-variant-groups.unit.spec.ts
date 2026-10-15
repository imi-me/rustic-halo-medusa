import { clawVariantGroups } from '../claw-variant-groups'
import { CLAW_COLORS_KEY, clawColorAvailable, clawVariantGroupKey, defaultClawColors } from '../hair-claw-colors'
import { productDraft, productUpdate } from '../../admin/lib/inline-edit'
import { changeClawGroupPrice } from '../../admin/lib/product-group-prices'
import { workspacePriceRevision } from '../workspace-price-revision'
import { POST } from '../../api/admin/products/[id]/workspace/route'
import { updateProductsWorkflow } from '@medusajs/medusa/core-flows'
jest.mock('@medusajs/medusa/core-flows', () => ({ updateProductsWorkflow: jest.fn() }))
function fixture() {
 const variants=['2','4'].flatMap(size=>['Natural','Colors by Cate'].flatMap(finish=>['Black','Rose'].map(color=>({id:size+finish+color,title:`${size} / ${finish} / ${color}`,sku:size+finish+color,updated_at:'2026-10-15T00:00:00Z',metadata:{physical_size:size,base_claw_color:color},options:[{option_id:'size',value:size+' inch'},{option_id:'finish',value:finish},{option_id:'color',value:color}],prices:[{id:size+finish+color+'usd',currency_code:'usd',amount:finish==='Natural'?12:14,updated_at:'2026-10-15T00:00:00Z'},{id:size+finish+color+'eur',currency_code:'eur',amount:10},{id:size+finish+color+'tier',currency_code:'usd',amount:9,min_quantity:5,max_quantity:10,rules:{region_id:'r'}}]}))))
 const product:any={id:'p',updated_at:'2026-10-15T00:00:00Z',title:'Test claw',handle:'test-claw',description:'',images:[],variants,options:[{id:'size',title:'Claw size'},{id:'finish',title:'Claw finish'},{id:'color',title:'Base color'}],metadata:{unrelated:'keep',hair_claw_palette_v1:{colors:defaultClawColors,revision:'default-v1'},hair_claw_template_v2:{version:2,offer_mode:false,option_ids:['size','finish','color'],size_option_id:'size',color_option_id:'color',variant_ids:variants.filter(v=>v.metadata.physical_size==='4').map(v=>v.id)}}}
 product.variants.push({id:'legacy',title:'Legacy',sku:'old',metadata:{},options:[],prices:[]});return product
}
it('groups only configured size/finish records, preserving styles and excluding legacy/hidden sizes',()=>{
 const p=fixture(),groups=clawVariantGroups(p)
 expect(groups.map(g=>g.label)).toEqual(['4-inch · Colors by Cate','4-inch · Natural'])
 expect(groups.every(g=>g.variants.length===2&&g.offered)).toBe(true)
 const id=groups.find(g=>g.label.endsWith('Natural'))!.key
 expect(clawVariantGroupKey(p,{...groups[1].variants[0],options:[...groups[1].variants[0].options].reverse()})).toBe(id)
})
it('one group edit changes all its USD bases, retaining every other group, IDs, currencies and tiers',()=>{
 const p=fixture(),before=JSON.stringify(p),group=clawVariantGroups(p).find(g=>g.label==='4-inch · Natural')!
 const draft=changeClawGroupPrice(productDraft(p),new Set(group.variants.map(v=>v.id)),'usd','17')
 const payload=productUpdate(p,draft);expect(payload.variants).toHaveLength(p.variants.length)
 for(const patch of payload.variants){const old=p.variants.find(v=>v.id===patch.id);if(group.variants.some(v=>v.id===patch.id)){expect(patch.prices[0].amount).toBe(17);expect(patch.prices[0].id).toBe(old.prices[0].id);expect(patch.prices[1].amount).toBe(10);expect(patch.prices[2]).toMatchObject({amount:9,min_quantity:5,max_quantity:10,rules:{region_id:'r'}})}else expect(patch).toEqual({id:old.id})}
 expect(JSON.stringify(p)).toBe(before)
 const missing=productDraft(p);missing.variants.find(v=>v.id===group.variants[0].id)!.priceRows=[]
 expect(()=>changeClawGroupPrice(missing,new Set(group.variants.map(v=>v.id)),'usd','9')).toThrow('base price')
})
it('finish-specific colors override inherited size defaults without changing the other finish or its price',()=>{
 const p=fixture(),natural=p.variants.find(v=>v.id==='4NaturalBlack'),painted=p.variants.find(v=>v.id==='4Colors by CateBlack')
 p.metadata[CLAW_COLORS_KEY]={excluded_by_size:{'2':[],'4':['Black']},excluded_by_group:{[clawVariantGroupKey(p,natural)]:[]}}
 expect(clawColorAvailable(p,natural,defaultClawColors)).toBe(true);expect(clawColorAvailable(p,painted,defaultClawColors)).toBe(false)
 p.metadata[CLAW_COLORS_KEY].excluded_by_group[clawVariantGroupKey(p,natural)]=['Rose']
 const d=productDraft(p);d.clawColors!.excluded_by_group[clawVariantGroupKey(p,painted)]=[]
 expect(productUpdate(p,d).metadata[CLAW_COLORS_KEY].excluded_by_group[clawVariantGroupKey(p,painted)]).toEqual([])
})
it('normalizes API and native price snapshots and detects changes even when product timestamp is unchanged',()=>{
 const p=fixture(),native={variants:p.variants.map(v=>({...v,prices:undefined,price_set:{prices:v.prices.map(price=>({...price,rules:undefined,price_rules:Object.entries(price.rules??{}).map(([attribute,value])=>({attribute,value}))}))}}))}
 expect(workspacePriceRevision(p)).toBe(workspacePriceRevision(native))
 native.variants[0].price_set.prices[0].amount=99;expect(workspacePriceRevision(p)).not.toBe(workspacePriceRevision(native))
})
it('saves grouped price and colors together, preserving metadata and rejecting stale, foreign and invalid group saves',async()=>{
 const p=fixture(),group=clawVariantGroups(p).find(g=>g.label==='4-inch · Natural')!,draft=changeClawGroupPrice(productDraft(p),new Set(group.variants.map(v=>v.id)),'usd','17')
 draft.clawColors!.excluded_by_group[group.key]=['Black']
 const run=jest.fn(async(_input:any)=>({}));(updateProductsWorkflow as unknown as jest.Mock).mockReturnValue({run})
 const req:any={auth_context:{actor_id:'staff',actor_type:'user'},headers:{},params:{id:'p'},body:{update:productUpdate(p,draft),expected_updated_at:p.updated_at,expected_pricing_revision:workspacePriceRevision(p),expected_palette_revision:'default-v1'},scope:{resolve:(name:string)=>name==='locking'?{execute:async(_key:string,fn:any)=>fn()}:name==='product'?{retrieveProduct:async()=>p}:name==='query'?{graph:async()=>({data:[p]})}:{listAdminOperations:async()=>[]}}}
 const res:any={setHeader:jest.fn(),sendStatus:jest.fn(),status:jest.fn().mockReturnThis(),json:jest.fn()}
 await POST(req,res);expect(run).toHaveBeenCalledTimes(1);expect(run.mock.calls[0][0].input.update.metadata.unrelated).toBe('keep');expect(run.mock.calls[0][0].input.update.metadata[CLAW_COLORS_KEY].excluded_by_group[group.key]).toEqual(['Black'])
 req.body.expected_pricing_revision='stale';await POST(req,res);expect(res.status).toHaveBeenLastCalledWith(409);expect(run).toHaveBeenCalledTimes(1)
 req.body.expected_pricing_revision=workspacePriceRevision(p);req.body.update.metadata[CLAW_COLORS_KEY].excluded_by_group['unknown']=[];await POST(req,res);expect(res.status).toHaveBeenLastCalledWith(409);expect(run).toHaveBeenCalledTimes(1)
 req.headers.origin='https://foreign.example';await POST(req,res);expect(res.sendStatus).toHaveBeenLastCalledWith(403)
 req.auth_context=null;await POST(req,res);expect(res.sendStatus).toHaveBeenLastCalledWith(401)
})
