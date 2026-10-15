jest.mock('../listing-workspace',()=>({etsyWorkspaceAccess:jest.fn(async()=>({shopId:77,headers:{Authorization:'Bearer test'}}))}))
import { randomUUID } from 'node:crypto'
import { matchingGroups, selectionSignature, targetSignature, itemMatch, digest, itemMatchesSchema } from '../order-item-matches'
import { readMatchChoices, matchOrderItem } from '../order-item-matching-store'
import { readOrderDetails, readOrderWorkspace, savePreparation } from '../order-workspace-store'
import { summarizeWorkspaceReceipt, preparationStatus } from '../order-workspace'
import { SHIPPING_KEY, assignmentSchema } from '../../shipping-packages'
const txn=()=>({transaction_id:1,listing_id:2,product_id:3,title:'Old Etsy claw',sku:'OLD',quantity:2,variations:[{property_id:4,value_id:5,formatted_name:'Size',formatted_value:'2 inch'}]})
function fixture(){
 const records:any[]=[],product:any={id:'prod_a',title:'Daisy Hair Claw',options:[{id:'size_old',title:'Size'},{id:'color',title:'Color'}],metadata:{hair_claw_template_v2:{size_option_id:'size_new',color_option_id:'color',unlabelled_size:'4'},[SHIPPING_KEY]:assignmentSchema.parse({package_id:'hair-claw-box',packing_group:'hair_claws'})}}
 const variants:any[]=['a','b'].map((v,i)=>({id:'variant_'+v,product_id:product.id,sku:'NEW-'+v,title:i?'Rose':'Black',metadata:{},weight:17.009714,product,options:[{option_id:'size_old',value:'2”'},{option_id:'color',value:i?'Rose':'Black'}]}));product.variants=variants
 const ops={listAdminOperations:jest.fn(async(filter:any)=>JSON.parse(JSON.stringify(records.filter(r=>Object.entries(filter).every(([k,v])=>r[k]===v))))),createAdminOperations:jest.fn(async(data:any)=>{const row={id:randomUUID(),...data};records.push(row);return row}),updateAdminOperations:jest.fn(async(data:any)=>{const row=records.find(r=>r.id===data.id);Object.assign(row,data);return row})}
 const products={listProductVariants:jest.fn(async(filter:any)=>variants.filter(v=>!filter.id||filter.id.includes(v.id))),retrieveProduct:jest.fn(async()=>product)}
 const services:any={admin_operations:ops,product:products,etsy:{getReadConnection:async()=>({shop_id:77,scopes:{granted:['transactions_r']}})},locking:{execute:async(_key:string,fn:any)=>fn()}}
 const scope={resolve:(key:string)=>{if(!services[key])throw Error('Unexpected service '+key);return services[key]}}
 const raw:any={receipt_id:99,shop_id:77,status:'paid',is_paid:true,is_shipped:false,transactions:[txn()],name:'Private buyer',message_from_buyer:'Private note'}
 const request=jest.fn(async(url:any,options:any)=>{if(options.method&&options.method!=='GET')throw Error('No writes');return{ok:true,json:async()=>raw}}) as any
 const input=async()=>{const detail=await readOrderDetails(scope,99,request),choices=await readMatchChoices(scope,99,1,product.id);return{action:'review' as const,transaction_id:1,product_id:product.id,group_key:choices.groups[0].key,variant_id:null as string|null,expected_revision:detail.order.revision,matching_revision:choices.matchingRevision,remember:false}}
 return{records,ops,products,product,variants,scope,raw,request,input}
}
beforeEach(()=>{process.env.ETSY_ORDER_REPORT_ENABLED='true'})
test('groups old two-inch options separately from new four-inch fallback and excludes inherent color',()=>{
 const f=fixture();f.product.variants.push({...f.variants[0],id:'variant_4',options:[{option_id:'color',value:'Black'}]})
 const groups=matchingGroups(f.product);expect(groups.map(g=>g.label)).toEqual(['2-inch','4-inch']);expect(groups[0].variants).toHaveLength(2)
})
test('review/save roundtrip preserves unknown color and local privacy, and produces packing',async()=>{
 const f=fixture(),input=await f.input(),review=await matchOrderItem(f.scope,99,input,'staff',f.request)
 expect(review.parcels[0]).toMatchObject({weight:2.801,item_count:2});expect(f.records.filter(r=>r.kind==='etsy-order-item-matches')).toHaveLength(0)
 await matchOrderItem(f.scope,99,{...input,action:'save',confirm_match:true,review_hash:review.reviewHash},'staff',f.request)
 const detail=await readOrderDetails(f.scope,99,f.request)
 expect(detail.order.transactions[0]).toMatchObject({match:'manual_product',variantId:null,productId:'prod_a',matchedGroupLabel:'2-inch'});expect(detail.order.fulfillment).toBe('needs_review');expect(detail.parcels[0].weight).toBe(2.801)
 expect(JSON.stringify(f.records)).not.toMatch(/Private|formatted_value|Authorization/);expect(f.request.mock.calls.every(([,o]:any)=>!o.method)).toBe(true)
})
test('explicit selected color can prepare and reused rules remain listing/SKU/options scoped',async()=>{
 const f=fixture(),input={...await f.input(),variant_id:'variant_a',remember:true},review=await matchOrderItem(f.scope,99,input,'staff',f.request)
 await matchOrderItem(f.scope,99,{...input,action:'save',confirm_match:true,review_hash:review.reviewHash},'staff',f.request)
 const detail=await readOrderDetails(f.scope,99,f.request);expect(detail.order.transactions[0].variantId).toBe('variant_a');expect(detail.order.fulfillment).toBe('needs_making')
 await savePreparation(f.scope,99,{stage:'ready_to_pack',expected_revision:detail.order.revision},'staff',f.request)
 const config=f.records.find(r=>r.kind==='etsy-order-item-matches').payload
 expect(itemMatch(100,{...txn(),transaction_id:9,quantity:3},f.variants,config)?.match).toBe('manual_variant')
 for(const extra of [{listing_id:9},{product_id:9},{sku:'OTHER'},{variations:[{formatted_name:'Size',formatted_value:'4 inch'}]}])expect(itemMatch(100,{...txn(),...extra},f.variants,config)).toBeNull()
})
test('stale revision, changed selections, cross-group variants, bad review/actor and config CAS cannot save',async()=>{
 const f=fixture(),input=await f.input(),review=await matchOrderItem(f.scope,99,input,'staff',f.request)
 for(const extra of [{expected_revision:randomUUID()},{matching_revision:randomUUID()},{variant_id:'variant_else'},{group_key:'else'},{review_hash:'0'.repeat(64)}])await expect(matchOrderItem(f.scope,99,{...input,action:'save',confirm_match:true,review_hash:review.reviewHash,...extra},'staff',f.request)).rejects.toThrow()
 await expect(matchOrderItem(f.scope,99,{...input,action:'save',confirm_match:true,review_hash:review.reviewHash},'other',f.request)).rejects.toThrow('Review the current')
 f.raw.transactions[0].quantity=3;await expect(matchOrderItem(f.scope,99,input,'staff',f.request)).rejects.toThrow('Etsy order details changed')
 expect(f.records.filter(r=>r.kind==='etsy-order-item-matches')).toHaveLength(0)
})
test('packing rejects divergent or unconfirmed colors; changed shipping invalidates reviewed save',async()=>{
 const f=fixture(),input=await f.input(),review=await matchOrderItem(f.scope,99,input,'staff',f.request)
 f.variants.forEach(v=>v.weight=28.349524)
 await expect(matchOrderItem(f.scope,99,{...input,action:'save',confirm_match:true,review_hash:review.reviewHash},'staff',f.request)).rejects.toThrow('Review the current')
 f.variants[1].weight=17.009714;await expect(matchOrderItem(f.scope,99,input,'staff',f.request)).rejects.toThrow('different shipping settings')
})
test('changed source or native identity does not silently fall back to SKU; hashes survive JSONB key order',async()=>{
 const f=fixture(),input=await f.input(),review=await matchOrderItem(f.scope,99,input,'staff',f.request)
 await matchOrderItem(f.scope,99,{...input,action:'save',confirm_match:true,review_hash:review.reviewHash},'staff',f.request)
 const c=f.records.find(r=>r.kind==='etsy-order-item-matches').payload
 expect(itemMatch(99,{...txn(),quantity:3},f.variants,c)?.match).toBe('manual_review')
 f.variants[0].sku='OLD';const order=summarizeWorkspaceReceipt(f.raw,f.variants,[],c);expect(order.transactions[0].match).toBe('manual_review');expect(order.transactions[0].variantId).toBeNull();expect(preparationStatus(order,'ready_to_pack')).toBe('needs_review')
 expect(digest({b:2,a:1})).toBe(digest({a:1,b:2}));expect(()=>itemMatchesSchema.parse({...c,links:[...c.links,...c.links]})).toThrow()
})
test('incomplete Etsy identity cannot create a future rule but permits an order-only match',async()=>{
 const f=fixture();delete f.raw.transactions[0].sku;const input=await f.input()
 expect(selectionSignature(f.raw.transactions[0])).toBeNull();await expect(matchOrderItem(f.scope,99,{...input,remember:true},'staff',f.request)).rejects.toThrow('order only')
 expect((await matchOrderItem(f.scope,99,input,'staff',f.request)).packingOnly).toBe(true)
})
