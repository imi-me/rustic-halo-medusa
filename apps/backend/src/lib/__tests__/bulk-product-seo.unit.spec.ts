const workflow=jest.fn()
jest.mock('@medusajs/medusa/core-flows',()=>({updateProductsWorkflow:()=>({run:workflow})}))
jest.mock('../admin-assistant',()=>({isReady:()=>true,configuration:()=>({endpoint:'https://api.openai.com/v1/responses',key:'private-fixture',model:'configured-model'}),providerOptions:()=>({})}))
import { applyBulkSeo, controlBulkSeo, processBulkSeo, readBulkSeo, startBulkSeo, BULK_SEO_KEY } from '../bulk-product-seo'
import { generateSeoBatch } from '../admin-assistant/product-seo-batch'
import { PRODUCT_SEO_KEY } from '../product-seo-values'
import { GET,POST } from '../../api/admin/product-seo/route'
const mergeJson=(before:any,after:any):any=>{if(!after||Array.isArray(after)||typeof after!=='object')return structuredClone(after);const result={...before};for(const key of Object.keys(after))result[key]=mergeJson(before?.[key],after[key]);return result}
const fixture=()=>{
 let stored:any=null
 const products:any[]=[1,2,3].map(n=>({id:`prod_${n}`,title:`Wooden flower ${n}`,description:`<p>A wooden flower ${n}.</p>`,material:'Wood',handle:`flower-${n}`,status:'published',updated_at:'2026-10-29T12:00:00.000Z',metadata:{unrelated:{keep:true},...(n===2?{[PRODUCT_SEO_KEY]:{title:'My custom title',description:''}}:n===3?{[PRODUCT_SEO_KEY]:{title:'Complete title',description:'Complete description'}}:{})}}))
 const ops={listAdminOperations:async(filter:any)=>filter.operation_key===BULK_SEO_KEY&&stored?[structuredClone(stored)]:[],createAdminOperations:async(value:any)=>{stored={id:'op_one',...structuredClone(value)};return stored},updateAdminOperations:async(value:any)=>{stored=mergeJson(stored,value);return stored}}
 const service={listProducts:async(filter:any)=>structuredClone(products.filter(p=>filter.id.includes(p.id))),listAndCountProducts:async()=>[structuredClone(products),products.length],retrieveProduct:async(id:string)=>{const p=products.find(p=>p.id===id);if(!p)throw Error('deleted');return structuredClone(p)}}
 const scope:any={resolve:(key:string)=>key==='admin_operations'?ops:key==='product'?service:key==='locking'?{execute:async(_key:string,fn:any)=>fn()}:null}
 workflow.mockImplementation(async({input}:any)=>{const p=products.find(p=>p.id===input.selector.id);p.metadata={...p.metadata,...input.update.metadata};p.updated_at=new Date().toISOString()})
 return{scope,products,ops,stored:()=>stored}
}
const suggestions=async(products:any[])=>products.map(p=>({id:p.id,title:`${p.title} | Rustic Halo`,description:`Explore ${p.title.toLowerCase()} with a wood design.`}))
beforeEach(()=>workflow.mockReset())
it('creates durable missing-only drafts, preserves custom fields and saves only approved SEO metadata',async()=>{
 const f=fixture();let s=await startBulkSeo(f.scope,'user_one','empty');expect(s.run!.rows.map(r=>r.id)).toEqual(['prod_1','prod_2']);expect(s.used).toBe(2);expect(workflow).not.toHaveBeenCalled()
 await processBulkSeo(f.scope,suggestions);s=await readBulkSeo(f.scope);expect(s.run!.rows.every(r=>r.status==='ready')).toBe(true);expect(s.run!.lease).toBeNull();expect(s.run!.rows[1].suggestion!.title).toBe('My custom title');expect(f.products[0].metadata).not.toHaveProperty(PRODUCT_SEO_KEY)
 const values=s.run!.rows.map(r=>({id:r.id,...r.suggestion!}));s=await applyBulkSeo(f.scope,s.run!.id,values);expect(s.run!.rows.every(r=>r.status==='saved')).toBe(true);expect(workflow).toHaveBeenCalledTimes(2)
 for(const [call]of workflow.mock.calls){expect(Object.keys(call.input.update)).toEqual(['metadata']);expect(Object.keys(call.input.update.metadata)).toEqual([PRODUCT_SEO_KEY])}
 expect(f.products[1].metadata[PRODUCT_SEO_KEY].title).toBe('My custom title');expect(f.products[1].metadata.unrelated).toEqual({keep:true});expect(f.products[2].metadata[PRODUCT_SEO_KEY]).toEqual({title:'Complete title',description:'Complete description'})
 await applyBulkSeo(f.scope,s.run!.id,values);expect(workflow).toHaveBeenCalledTimes(2);const revision=(await readBulkSeo(f.scope)).revision;await processBulkSeo(f.scope,suggestions);expect((await readBulkSeo(f.scope)).revision).toBe(revision)
})
it('guards stale products, unselected writes, unknown ids, replacements and edited custom fields',async()=>{
 const f=fixture();await startBulkSeo(f.scope,'user_one','empty');await processBulkSeo(f.scope,suggestions);let s=await readBulkSeo(f.scope);const run=s.run!;f.products[0].description='New owner copy';
 s=await applyBulkSeo(f.scope,run.id,[{id:'prod_1',...run.rows[0].suggestion!}]);expect(s.run!.rows[0].status).toBe('stale');expect(workflow).not.toHaveBeenCalled()
 await expect(applyBulkSeo(f.scope,'different-run',[{id:'prod_2',...run.rows[1].suggestion!}])).rejects.toThrow('replaced')
 await expect(applyBulkSeo(f.scope,run.id,[{id:'prod_unknown',title:'Title',description:'Description'}])).rejects.toThrow('ready')
 s=await applyBulkSeo(f.scope,run.id,[{id:'prod_2',title:'Attempt to replace custom title',description:'A good description.'}]);expect(f.products[1].metadata[PRODUCT_SEO_KEY]).toEqual({title:'My custom title',description:'A good description.'});expect(workflow).toHaveBeenCalledTimes(1)
})
it('keeps cancellations, overlapping workers and expired leases from applying late or duplicate generation',async()=>{
 const f=fixture();await startBulkSeo(f.scope,'user_one','empty');let resolve:any;const generate=jest.fn(()=>new Promise<any>(r=>{resolve=r}));const first=processBulkSeo(f.scope,generate);while(!resolve)await Promise.resolve();expect(await processBulkSeo(f.scope,generate)).toBe(false);let s=await readBulkSeo(f.scope);await controlBulkSeo(f.scope,s.revision,'discard');resolve(await suggestions(f.products.slice(0,2)));await first;expect((await readBulkSeo(f.scope)).run).toBe(null);expect(generate).toHaveBeenCalledTimes(1);expect(workflow).not.toHaveBeenCalled()
 s=await readBulkSeo(f.scope);await startBulkSeo(f.scope,'user_one',s.revision);s=await readBulkSeo(f.scope);s.run!.lease={token:'expired',expires:1,ids:['prod_1']};s.run!.rows[0].status='generating';await f.ops.updateAdminOperations({payload:s});await processBulkSeo(f.scope,suggestions,10);s=await readBulkSeo(f.scope);expect(s.run!.rows[0].status).toBe('failed');expect(s.run!.rows[1].status).toBe('ready')
})
it('persists bounded failures for explicit retry and enforces run/revision and daily budgets',async()=>{
 const f=fixture();let s=await startBulkSeo(f.scope,'user_one','empty');await expect(startBulkSeo(f.scope,'user_one',s.revision)).rejects.toThrow('current suggestions');await processBulkSeo(f.scope,async()=>{throw Error('provider failed')});s=await readBulkSeo(f.scope);expect(s.run!.rows.every(r=>r.status==='failed')).toBe(true);expect(workflow).not.toHaveBeenCalled();await expect(controlBulkSeo(f.scope,'stale','retry')).rejects.toThrow('another window');s=await controlBulkSeo(f.scope,s.revision,'retry');expect(s.run!.rows.every(r=>r.status==='pending')).toBe(true);expect(s.used).toBe(4)
 await controlBulkSeo(f.scope,s.revision,'discard');s=await readBulkSeo(f.scope);s.used=1000;await f.ops.updateAdminOperations({payload:s});await expect(startBulkSeo(f.scope,'user_one',s.revision)).rejects.toThrow('daily bulk limit');expect(f.stored().operation_key).toBe(BULK_SEO_KEY)
})
it('reconciles an already-committed SEO save without a second product write',async()=>{
 const f=fixture();await startBulkSeo(f.scope,'user_one','empty');await processBulkSeo(f.scope,suggestions);const s=await readBulkSeo(f.scope),row=s.run!.rows[0];f.products[0].metadata[PRODUCT_SEO_KEY]=row.suggestion;f.products[0].updated_at='2026-10-29T13:00:00.000Z';const result=await applyBulkSeo(f.scope,s.run!.id,[{id:row.id,...row.suggestion!}]);expect(result.run!.rows[0].status).toBe('saved');expect(workflow).not.toHaveBeenCalled()
})
it('uses one strict, bounded provider request for a batch and rejects missing/duplicate/unknown outputs',async()=>{
 const products=[{id:'prod_1',title:'Flower',description:'Wooden flower.',material:'Wood'},{id:'prod_2',title:'Bird',description:'Wooden bird.',material:'Wood'}],good=await suggestions(products)
 const request=jest.fn(async()=>({ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({products:good})}]}]})}))
 expect((await generateSeoBatch(products,request as any)).length).toBe(2);const body=JSON.parse((request.mock.calls[0]as any)[1].body);expect(body.store).toBe(false);expect(body.tools).toBeUndefined();expect(body.model).toBe('configured-model');expect(body.text.format.schema.properties.products.minItems).toBe(2);expect(body.text.format.schema.properties.products.items.properties.id.enum).toEqual(['prod_1','prod_2'])
 for(const output of [[good[0]],[good[0],good[0]],[good[0],{...good[1],id:'prod_other'}]])await expect(generateSeoBatch(products,jest.fn(async()=>({ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({products:output})}]}]})}))as any)).rejects.toThrow()
})
function response(){const r:any={};r.setHeader=jest.fn();r.status=jest.fn(()=>r);r.json=jest.fn(()=>r);r.sendStatus=jest.fn(()=>r);return r}
it('requires staff authentication, trusted origin and a strict bounded action before bulk changes',async()=>{
 const f=fixture(),base:any={scope:f.scope,headers:{},body:{action:'start',revision:'empty'}};let r=response();await GET(base,r);expect(r.sendStatus).toHaveBeenCalledWith(401);r=response();await POST({...base,auth_context:{actor_id:'user',actor_type:'customer'}},r);expect(r.sendStatus).toHaveBeenCalledWith(401)
 r=response();await POST({...base,auth_context:{actor_id:'user',actor_type:'user'},headers:{origin:'https://untrusted.invalid'}},r);expect(r.sendStatus).toHaveBeenCalledWith(403)
 r=response();await POST({...base,auth_context:{actor_id:'user',actor_type:'user'},body:{...base.body,publish:true}},r);expect(r.status).toHaveBeenCalledWith(400);expect(f.stored()).toBe(null)
})

it('clears completed and stopped leases explicitly under native JSON merge persistence',async()=>{
 const f=fixture();await startBulkSeo(f.scope,'user_one','empty');let release:any;const pending=processBulkSeo(f.scope,()=>new Promise<any>(resolve=>{release=resolve}));while(!release)await Promise.resolve();let s=await readBulkSeo(f.scope);expect(s.run!.lease).toBeTruthy();s=await controlBulkSeo(f.scope,s.revision,'stop');expect(s.run!.lease).toBeNull();release(await suggestions(f.products.slice(0,2)));await pending;s=await readBulkSeo(f.scope);expect(s.run!.rows.every(r=>r.status==='failed')).toBe(true);expect(s.run!.lease).toBeNull();
 s=await controlBulkSeo(f.scope,s.revision,'retry');await processBulkSeo(f.scope,suggestions);s=await readBulkSeo(f.scope);expect(s.run!.lease).toBeNull();expect(s.run!.rows.every(r=>r.status==='ready')).toBe(true);expect(workflow).not.toHaveBeenCalled();
})
