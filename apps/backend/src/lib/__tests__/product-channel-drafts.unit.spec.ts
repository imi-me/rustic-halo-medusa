jest.mock('../admin-product-create',()=>({createAdminProduct:jest.fn()}))
jest.mock('../etsy/draft-settings',()=>({readEtsyDraftSettings:jest.fn()}))
jest.mock('../etsy/listing-workspace',()=>({etsyWorkspaceAccess:jest.fn()}))
jest.mock('../hair-claw-offers',()=>({offerProduct:jest.fn()}))
import { queueChannelDrafts, prepareChannelDrafts, retryChannelDrafts, channelDraftStatus } from '../product-channel-drafts'
import { createAdminProduct } from '../admin-product-create'
import { readEtsyDraftSettings } from '../etsy/draft-settings'
import { etsyWorkspaceAccess } from '../etsy/listing-workspace'
import { offerProduct } from '../hair-claw-offers'
import { planClawOrderChoices } from '../hair-claw-order-choices'
import { emptyEtsyDraft } from '../product-admin'
const clone=(v:any)=>JSON.parse(JSON.stringify(v))
const palette={revision:'p1',colors:[{name:'Black',slug:'black',hex:'#222222',active:true},{name:'Rose',slug:'rose',hex:'#cc9999',active:true,sizes:['4']}]}
function fixture(withPhoto=false){
 const input:any={request_id:'c831e36c-befc-411c-a639-1679bc9d27c3',title:'New Hair Claw',description:'A new wooden hair claw.',handle:'new-hair-claw',type_id:null,collection_id:null,shipping_profile_id:'sp_one',sales_channels:[],categories:[],tags:[],weight:28,material:'wood',images:withPhoto?[{url:'https://cdn.rustichalo.com/test.png'}]:[],thumbnail:null,inventory_mode:'made_to_order',options:[{title:'Size',values:['2 inch','4 inch']},{title:'Finish',values:['Natural']}],variants:['2','4'].map(size=>({title:size+' inch',sku:'NEW-'+size,barcode:'00012'+size,price:size==='2'?8:14,options:{Size:size+' inch',Finish:'Natural'},stock:[]})),etsy:emptyEtsyDraft(),channel_drafts:{settings_revision:'a'.repeat(64),palette_revision:'p1',quantity:3,excluded_by_size:{'2':[],'4':[]}}}
 const settings={taxonomy_id:220,shipping_profile_id:11,return_policy_id:12,readiness_state_id:42,shop_section_id:13,who_made:'i_did',when_made:'made_to_order',is_supply:false}
 let product:any={id:'prod_new',status:'draft',title:input.title,description:input.description,metadata:{source_product_type:'Hair Claw',hair_claw_colors_v1:{excluded:[],excluded_by_size:input.channel_drafts.excluded_by_size,excluded_by_group:{}}},images:input.images,options:[{id:'z-size',title:'Size',values:[{value:'2 inch'},{value:'4 inch'}]},{id:'a-finish',title:'Finish',values:[{value:'Natural'}]}],variants:input.variants.map((v:any,i:number)=>({...v,id:'variant_'+i,metadata:{physical_size:i?'4':'2',claw_finish:'natural'},options:[{option_id:'z-size',value:i?'4 inch':'2 inch'},{option_id:'a-finish',value:'Natural'}],prices:[{currency_code:'usd',amount:v.price}]}))};product.metadata=planClawOrderChoices(product).metadata
 const rows:any[]=[],events:any[]=[],writes:any[]=[];let listing:any=null,inventory:any=null,images:any[]=[];let createCount=0,inventoryWrites=0,imageWrites=0,nativeCount=0,loseCreation=false,loseInventory=false,loseImage=false
 const ops={listAdminOperations:jest.fn(async(filter:any)=>filter.operation_key==='hair-claw-colors:v1'?[{payload:palette}]:rows.filter(row=>Object.entries(filter).every(([key,value])=>row[key]===value)).map(clone)),createAdminOperations:jest.fn(async(data:any)=>{const row={id:'op_'+rows.length,...clone(data)};rows.push(row);return clone(row)}),updateAdminOperations:jest.fn(async(data:any)=>{const row=rows.find(r=>r.id===data.id);Object.assign(row,clone(data));return clone(row)})}
 const services:any={admin_operations:ops,product:{listProductVariants:async()=>[],listProducts:async()=>[],retrieveProductType:async()=>({value:'Hair Claw'}),retrieveProduct:async()=>clone(product),updateProducts:jest.fn(async(_id:string,data:any)=>{product={...product,...data}})},event_bus:{emit:jest.fn(async(event:any)=>{events.push(event)})},locking:{execute:jest.fn(async(_key:string,fn:any)=>fn())}}
 const scope={resolve:(key:string)=>{if(!services[key])throw Error('Unexpected service '+key);return services[key]}}
 ;(createAdminProduct as jest.Mock).mockImplementation(async()=>{nativeCount=1;return{id:product.id}})
 ;(readEtsyDraftSettings as jest.Mock).mockResolvedValue({settings,settings_revision:'a'.repeat(64),palette})
 ;(etsyWorkspaceAccess as jest.Mock).mockResolvedValue({shopId:77,scopes:['listings_r','listings_w'],headers:{Authorization:'Bearer test'}})
 ;(offerProduct as jest.Mock).mockImplementation(async()=>clone(product))
 const response=(data:any,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}})
 const request=jest.fn(async(url:any,options:any={})=>{
  const u=new URL(String(url)),method=options.method??'GET',body=options.body
  if(u.hostname==='cdn.rustichalo.com')return new Response(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lT0AAAAASUVORK5CYII=','base64'),{headers:{'content-type':'image/png'}})
  if(method!=='GET')writes.push({method,path:u.pathname,body})
  if(method==='GET'&&u.pathname==='/v3/application/shops/77/listings'){const found=listing&&listing.state===u.searchParams.get('state')?[listing]:[];return response({count:found.length,results:found})}
  if(method==='POST'&&u.pathname==='/v3/application/shops/77/listings'){createCount++;listing={listing_id:9001,shop_id:77,state:'draft',title:body.get('title'),description:body.get('description'),skus:[]};inventory={products:[{sku:'',property_values:[],offerings:[{quantity:3,is_enabled:true,price:{amount:800,divisor:100,currency_code:'USD'},readiness_state_id:42}]}],sku_on_property:[],price_on_property:[],quantity_on_property:[],readiness_state_on_property:[]};if(loseCreation){loseCreation=false;throw Error('Lost create response')}return response(listing,201)}
  if(method==='GET'&&u.pathname==='/v3/application/listings/9001')return response(listing)
  if(method==='GET'&&u.pathname==='/v3/application/listings/9001/inventory')return response(inventory)
  if(method==='PUT'&&u.pathname==='/v3/application/listings/9001/inventory'){inventoryWrites++;inventory=JSON.parse(body);for(const p of inventory.products)for(const offer of p.offerings)offer.price={amount:Math.round(offer.price*100),divisor:100,currency_code:'USD'};listing.skus=[...new Set(inventory.products.map((p:any)=>p.sku))];if(loseInventory){loseInventory=false;throw Error('Lost inventory response')}return response(inventory)}
  if(method==='GET'&&u.pathname==='/v3/application/listings/9001/images')return response({count:images.length,results:images})
  if(method==='POST'&&u.pathname==='/v3/application/shops/77/listings/9001/images'){imageWrites++;const image={listing_image_id:700+images.length,rank:Number(body.get('rank')),alt_text:body.get('alt_text')};images.push(image);if(loseImage){loseImage=false;throw Error('Lost upload response')}return response(image,201)}
  if(method==='PATCH'&&u.pathname==='/v3/application/shops/77/listings/9001'){listing.title=body.get('title');return response(listing)}
  throw Error('Unexpected provider request '+method+' '+u.pathname)
 }) as any
 return{input,scope,rows,ops,events,writes,services,request,get product(){return product},get listing(){return listing},get inventory(){return inventory},get counts(){return{createCount,inventoryWrites,imageWrites,nativeCount}},dropListing:()=>{listing=null},loseCreate:()=>{loseCreation=true},loseInventory:()=>{loseInventory=true},loseImage:()=>{loseImage=true}}
}
beforeEach(()=>{jest.clearAllMocks();process.env.APP_ENV='staging';let time=Date.now();jest.spyOn(Date,'now').mockImplementation(()=>time+=2000)})
afterEach(()=>jest.restoreAllMocks())
test('one request queues once, makes two unpublished drafts, and shares each native SKU across order colors',async()=>{
 const f=fixture();expect((await queueChannelDrafts(f.scope,f.input)).status).toBe('queued');await queueChannelDrafts(f.scope,f.input);expect(f.events).toHaveLength(1)
 const ready=await prepareChannelDrafts(f.scope,f.input.request_id,f.request)
 expect(ready.status).toBe('complete');expect(f.product.status).toBe('draft');expect(f.listing.state).toBe('draft');expect(f.product.variants).toHaveLength(2);expect(f.product.variants.map((v:any)=>v.barcode)).toEqual(['000122','000124'])
 expect(new Set(f.inventory.products.map((p:any)=>p.sku))).toEqual(new Set(['NEW-2','NEW-4']));expect(f.inventory.sku_on_property).toEqual([513]);expect(f.inventory.products.find((p:any)=>p.sku==='NEW-2'&&p.property_values[1].values[0]==='Rose').offerings[0].is_enabled).toBe(false)
 expect(f.product.metadata.etsy_listing_draft_v1.listing_id).toBe('9001');expect(ready.summary.map((s:any)=>s.colors)).toEqual([['Black'],['Black','Rose']])
 expect(f.writes.some(w=>w.body instanceof URLSearchParams&&w.body.has('state'))).toBe(false)
 await prepareChannelDrafts(f.scope,f.input.request_id,f.request);expect(f.counts).toEqual({createCount:1,inventoryWrites:1,imageWrites:0,nativeCount:1})
 expect((await channelDraftStatus(f.scope,f.input.request_id)).etsy_url).toContain('9001')
 await expect(queueChannelDrafts(f.scope,{...f.input,title:'Changed'})).rejects.toThrow('request changed')
})
test('a lost creation response recovers the existing marked draft without creating a second listing',async()=>{
 const f=fixture();await queueChannelDrafts(f.scope,f.input);f.loseCreate();await expect(prepareChannelDrafts(f.scope,f.input.request_id,f.request)).rejects.toThrow('Lost create response');expect(f.counts.createCount).toBe(1)
 await retryChannelDrafts(f.scope,f.input.request_id);await prepareChannelDrafts(f.scope,f.input.request_id,f.request);expect(f.counts.createCount).toBe(1);expect(f.rows[0].status).toBe('complete')
})
test('an unconfirmed inventory write is reconciled before retrying',async()=>{
 const f=fixture();await queueChannelDrafts(f.scope,f.input);f.loseInventory();await expect(prepareChannelDrafts(f.scope,f.input.request_id,f.request)).rejects.toThrow('Lost inventory response');await prepareChannelDrafts(f.scope,f.input.request_id,f.request);expect(f.counts.inventoryWrites).toBe(1);expect(f.counts.createCount).toBe(1)
})
test('an unconfirmed photo upload is found by its saved slot without duplicate uploads',async()=>{
 const f=fixture(true);await queueChannelDrafts(f.scope,f.input);f.loseImage();await expect(prepareChannelDrafts(f.scope,f.input.request_id,f.request)).rejects.toThrow('Lost upload response');await prepareChannelDrafts(f.scope,f.input.request_id,f.request);expect(f.counts.imageWrites).toBe(1);expect(f.rows[0].status).toBe('complete')
})
test('a listing published outside this flow is never overwritten',async()=>{
 const f=fixture();await queueChannelDrafts(f.scope,f.input);f.loseInventory();await expect(prepareChannelDrafts(f.scope,f.input.request_id,f.request)).rejects.toThrow();f.listing.state='active';const writes=f.writes.length;await expect(prepareChannelDrafts(f.scope,f.input.request_id,f.request)).rejects.toThrow('no longer an unpublished draft');expect(f.writes).toHaveLength(writes)
})
test('changed settings, no colors, stocked allocation and unsafe images fail before native product creation',async()=>{
 const f=fixture();for(const input of [{...f.input,channel_drafts:{...f.input.channel_drafts,palette_revision:'old'}},{...f.input,channel_drafts:{...f.input.channel_drafts,excluded_by_size:{'2':['Black'],'4':[]}}},{...f.input,inventory_mode:'stocked'},{...f.input,images:[{url:'http://127.0.0.1/private.png'}]}])await expect(queueChannelDrafts(f.scope,input)).rejects.toThrow();expect(createAdminProduct).not.toHaveBeenCalled();expect(f.rows).toHaveLength(0)
})

test('unknown draft creation is never repeated when Etsy has not confirmed its result',async()=>{
 const f=fixture();await queueChannelDrafts(f.scope,f.input);f.loseCreate();await expect(prepareChannelDrafts(f.scope,f.input.request_id,f.request)).rejects.toThrow();f.dropListing();await expect(prepareChannelDrafts(f.scope,f.input.request_id,f.request)).rejects.toThrow('earlier draft creation');expect(f.counts.createCount).toBe(1)
})
test('published website records are rejected before any Etsy draft creation',async()=>{
 const f=fixture();await queueChannelDrafts(f.scope,f.input);f.product.status='published';await expect(prepareChannelDrafts(f.scope,f.input.request_id,f.request)).rejects.toThrow('website product has been published');expect(f.counts.createCount).toBe(0)
})
test('ambiguous recovery markers never select a listing or create another one',async()=>{
 const f=fixture();await queueChannelDrafts(f.scope,f.input);const request=f.request;const wrapped=async(url:any,options:any)=>String(url).includes('state=draft')?new Response(JSON.stringify({count:2,results:[1,2].map(id=>({listing_id:id,title:'Rustic Halo draft '+f.input.request_id}))}),{headers:{'content-type':'application/json'}}):request(url,options)
 await expect(prepareChannelDrafts(f.scope,f.input.request_id,wrapped as any)).rejects.toThrow('More than one');expect(f.counts.createCount).toBe(0)
})
