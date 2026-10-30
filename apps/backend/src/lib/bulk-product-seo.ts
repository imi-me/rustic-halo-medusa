import { createHash, randomUUID } from 'node:crypto'
import { Modules } from '@medusajs/framework/utils'
import { updateProductsWorkflow } from '@medusajs/medusa/core-flows'
import { ADMIN_OPERATIONS } from '../modules/admin-operations'
import { PRODUCT_SEO_KEY, productSeoValues, readProductSeo, seoText, type ProductSeo } from './product-seo-values'
import { productSeoSchema } from './product-seo'
import { readClawPalette } from './hair-claw-color-store'
import { readSeoProducts, seoOptionFacts, seoOptionsRevision } from './product-seo-options'
import { conservativeSeoCopy, savedSeoDescriptions, seoQualityIssue } from './product-seo-quality'
import { generateSeoBatch, type SeoBatchProduct } from './admin-assistant/product-seo-batch'
export const BULK_SEO_KEY = 'product-seo-bulk-v1'
const lockKey = 'rh-product-seo-bulk', dailyLimit = 1000, catalogLimit = 1000
type Status = 'pending' | 'generating' | 'ready' | 'saved' | 'failed' | 'stale' | 'skipped'
export type SeoRow = { id: string; title: string; handle: string; productStatus: string; status: Status; source: SeoBatchProduct; sourceHash: string; updatedAt: string; optionsRevision?:string; before: ProductSeo; automatic: ProductSeo; suggestion?: ProductSeo; error?: string }
type Run = { id: string; createdAt: string; actor: string; rows: SeoRow[]; lease?: { token: string; expires: number; ids: string[] } | null }
export type BulkSeoState = { revision: string; day: string; used: number; run: Run | null }
const hash = (p:any) => createHash('sha256').update(JSON.stringify([p.title,p.description,p.material,p.handle,p.status,readProductSeo(p.metadata)])).digest('hex')
const timestamp = (p:any) => new Date(p.updated_at).toISOString()
const missing = (p:any) => { const seo = readProductSeo(p.metadata); return !seo.title.trim() || !seo.description.trim() }
const canUse = (p:any) => ['published','draft','proposed'].includes(p.status) && missing(p)
const rowFor = (p:any):SeoRow => ({ id:p.id,title:p.title,handle:p.handle || '',productStatus:p.status,status:'pending',source:{id:p.id,title:seoText(p.title),description:seoText(p.description).slice(0,2000),material:seoText(p.material),preservedTitle:readProductSeo(p.metadata).title||undefined,preservedDescription:readProductSeo(p.metadata).description||undefined},sourceHash:hash(p),updatedAt:timestamp(p),before:readProductSeo(p.metadata),automatic:productSeoValues(p) })
export async function readBulkSeo(scope:any):Promise<BulkSeoState> {
  const [row] = await scope.resolve(ADMIN_OPERATIONS).listAdminOperations({operation_key:BULK_SEO_KEY})
  return row?.payload || { revision:'empty',day:new Date().toISOString().slice(0,10),used:0,run:null }
}
async function persist(scope:any,state:BulkSeoState) {
  state.revision = randomUUID()
  const ops = scope.resolve(ADMIN_OPERATIONS), [row] = await ops.listAdminOperations({operation_key:BULK_SEO_KEY})
  const data = {status:state.run?.rows.some(r=>r.status==='pending'||r.status==='generating')?'generating':'review',payload:state}
  if(row) await ops.updateAdminOperations({id:row.id,...data})
  else await ops.createAdminOperations({operation_key:BULK_SEO_KEY,kind:'product-seo-bulk',resource_id:'catalog',...data})
  return state
}
async function locked<T>(scope:any,fn:()=>Promise<T>):Promise<T> { return scope.resolve(Modules.LOCKING).execute(lockKey,fn) }
function expectRevision(state:BulkSeoState,revision:string) { if(state.revision!==revision) throw Error('This review changed in another window. Refresh before continuing.') }
function reserve(state:BulkSeoState,count:number) {
  const day=new Date().toISOString().slice(0,10)
  if(state.day!==day){state.day=day;state.used=0}
  if(state.used+count>dailyLimit) throw Error('The daily bulk limit is 1,000 product suggestions. Try a smaller selection or return tomorrow.')
  state.used+=count
}
export async function bulkSeoCatalog(scope:any) {
  const result:any[]=[];let offset=0
  while(true){const [products,count]=await scope.resolve(Modules.PRODUCT).listAndCountProducts({}, {select:['id','title','description','material','handle','status','metadata','updated_at'],skip:offset,take:100,order:{id:'ASC'}});result.push(...products);offset+=products.length;if(offset>=count)break;if(!products.length||result.length>catalogLimit)throw Error('This tool supports up to 1,000 products per run.')}
  if(result.length>catalogLimit) throw Error('This tool supports up to 1,000 products per run.')
  return result
}
export async function startBulkSeo(scope:any,actor:string,revision:string,ids?:string[]) {
  return locked(scope,async()=>{
    const state=await readBulkSeo(scope);expectRevision(state,revision)
    if(state.run)throw Error('Save or discard the current suggestions before starting a new run.')
    const catalog=await bulkSeoCatalog(scope), eligible=catalog.filter(p=>canUse(p)&&(!ids||ids.includes(p.id)))
    if(ids?.some(id=>!catalog.some(p=>p.id===id)))throw Error('A selected product no longer exists.')
    if(!eligible.length)throw Error('No products need search wording. Existing custom fields are kept.')
    reserve(state,eligible.length)
    state.run={id:randomUUID(),createdAt:new Date().toISOString(),actor,rows:eligible.map(rowFor)}
    return persist(scope,state)
  })
}
export async function controlBulkSeo(scope:any,revision:string,action:'stop'|'discard'|'retry') {
  return locked(scope,async()=>{
    const state=await readBulkSeo(scope);expectRevision(state,revision);if(!state.run)throw Error('No review is active.')
    if(action==='discard')state.run=null
    else if(action==='stop'){state.run.lease=null;for(const row of state.run.rows)if(['pending','generating'].includes(row.status)){row.status='failed';row.error='Generation stopped. Retry when ready.'}}
    else{
      if(state.run.lease)throw Error('Wait for the current batch to finish before retrying.')
      const candidates=state.run.rows.filter(r=>r.status==='failed'||r.status==='stale');reserve(state,candidates.length)
      for(const row of candidates){try{const product=await scope.resolve(Modules.PRODUCT).retrieveProduct(row.id,{relations:['options','options.values','variants','variants.options']});if(!canUse(product)){row.status='skipped';row.error='Product already has custom search wording or is no longer eligible.';continue}Object.assign(row,rowFor(product));delete row.suggestion;delete row.error}catch{row.status='skipped';row.error='Product is no longer available.'}}
    }
    return persist(scope,state)
  })
}
export async function processBulkSeo(scope:any,generate=generateSeoBatch,now=Date.now()) {
  const claim=await locked(scope,async()=>{
    const state=await readBulkSeo(scope),run=state.run;if(!run||!run.lease&&!run.rows.some(r=>r.status==='pending'))return null
    if(run.lease){if(run.lease.expires>now)return null;for(const row of run.rows)if(run.lease.ids.includes(row.id)&&row.status==='generating'){row.status='failed';row.error='Generation was interrupted. Retry this suggestion.'}run.lease=null}
    const pending=run.rows.filter(r=>r.status==='pending').slice(0,50)
    const records=await readSeoProducts(scope,pending.map(r=>r.id)),palette=await readClawPalette(scope.resolve(ADMIN_OPERATIONS))
    const rows=pending.filter(row=>{const current=records.find((p:any)=>p.id===row.id);if(!current||hash(current)!==row.sourceHash){row.status='stale';row.error='Product changed before generation. Retry to use the current details.';return false}const options=seoOptionFacts(current,palette.colors);row.source.options=options;row.source.preservedTitle=row.before.title||undefined;row.source.preservedDescription=row.before.description||undefined;row.optionsRevision=seoOptionsRevision(options);row.updatedAt=timestamp(current);return true})
    if(!rows.length){await persist(scope,state);return null}
    const lease={token:randomUUID(),expires:now+300000,ids:rows.map(r=>r.id)};run.lease=lease;for(const row of rows)row.status='generating'
    await persist(scope,state);return {runId:run.id,lease,products:rows.map(r=>r.source),descriptions:run.rows.filter(r=>r.suggestion&&r.status==='ready').map(r=>({id:r.id,title:r.source.title,description:r.suggestion!.description}))}
  })
  if(!claim)return false
  let suggestions:Awaited<ReturnType<typeof generateSeoBatch>>=[],failure=''
  try{suggestions=await generate(claim.products,fetch,[...await savedSeoDescriptions(scope),...claim.descriptions])}catch{failure='Rusty could not finish this batch. Your saved products are unchanged. Retry these suggestions.'}
  await locked(scope,async()=>{
    const state=await readBulkSeo(scope),run=state.run;if(!run||run.id!==claim.runId||run.lease?.token!==claim.lease.token)return
    const library=[...await savedSeoDescriptions(scope),...run.rows.filter(r=>r.suggestion&&r.status==='ready').map(r=>({id:r.id,title:r.source.title,description:r.suggestion!.description}))]
    for(const row of run.rows.filter(r=>claim.lease.ids.includes(r.id))){const value=suggestions.find(p=>p.id===row.id);if(failure||!value||value.error){row.status='failed';row.error=failure||value?.error||'No valid suggestion returned.'}else{let copy={title:row.before.title.trim()?row.before.title:value.title,description:row.before.description.trim()?row.before.description:value.description};const check=()=>seoQualityIssue(row.source,{title:row.before.title.trim()?'':copy.title,description:row.before.description.trim()?'':copy.description},library,!row.before.description.trim());if(check()){const safe=conservativeSeoCopy(row.source);copy={title:row.before.title.trim()?row.before.title:safe.title,description:row.before.description.trim()?row.before.description:safe.description}}const issue=check();if(issue){row.status='failed';row.error=issue;continue}row.suggestion=copy;row.status='ready';delete row.error;library.push({id:row.id,title:row.source.title,description:copy.description})}}
    run.lease=null;await persist(scope,state)
  })
  return true
}
export async function applyBulkSeo(scope:any,runId:string,values:Array<{id:string;title:string;description:string}>) {
  return locked(scope,async()=>{
    const state=await readBulkSeo(scope);if(!state.run||state.run.id!==runId)throw Error('This review was replaced. Refresh before saving.')
    if(!values.length||values.length>20||new Set(values.map(v=>v.id)).size!==values.length)throw Error('Save up to 20 unique products at a time.')
    // Validate the entire selection before performing any write.
    const selected=values.map(value=>{const row=state.run!.rows.find(r=>r.id===value.id);if(!row||!['ready','saved'].includes(row.status))throw Error('Select products with ready suggestions.');const seo=productSeoSchema.parse({title:value.title,description:value.description});if(!seo.title||!seo.description)throw Error('Provide both search fields before saving.');return {row,value:seo}})
    const library=await savedSeoDescriptions(scope)
    for(const {row,value} of selected){if(row.status==='saved')continue
      try{await scope.resolve(Modules.LOCKING).execute('rh-admin-product-identifiers',()=>scope.resolve(Modules.LOCKING).execute(`hair-claw-media:${row.id}`,async()=>{
        const product=await scope.resolve(Modules.PRODUCT).retrieveProduct(row.id,{relations:['options','options.values','variants','variants.options']})
        const current=readProductSeo(product.metadata)
        if(current.title===value.title&&current.description===value.description&&hash({...product,metadata:{[PRODUCT_SEO_KEY]:row.before}})===row.sourceHash){row.status='saved';row.suggestion=current;delete row.error;return}
        if(timestamp(product)!==row.updatedAt||hash(product)!==row.sourceHash){row.status='stale';row.error='Product changed since generation. Retry to use the current details.';return}
        if(row.optionsRevision){const palette=await readClawPalette(scope.resolve(ADMIN_OPERATIONS));if(seoOptionsRevision(seoOptionFacts(product,palette.colors))!==row.optionsRevision){row.status='stale';row.error='Product options changed since generation. Retry to use the current size, finish and color choices.';return}}
        const issue=seoQualityIssue(row.source,{title:row.before.title.trim()?'':value.title,description:row.before.description.trim()?'':value.description},library,false);if(issue){row.status='stale';row.error=issue;return}
        // Fill missing fields only. Existing custom text cannot be replaced by a bulk edit.
        const seo={title:row.before.title.trim()?row.before.title:value.title,description:row.before.description.trim()?row.before.description:value.description}
        if(!seo.title.trim()||!seo.description.trim())throw Error('Provide both search fields before saving.')
        await updateProductsWorkflow(scope).run({input:{selector:{id:row.id},update:{metadata:{[PRODUCT_SEO_KEY]:seo}}}})
        row.suggestion=seo;row.status='saved';delete row.error;library.push({id:row.id,title:row.source.title,description:seo.description})
      }))}catch{row.status='stale';row.error='Save could not be confirmed. Check this product before retrying.'}
      // Persist each result so a later failure never repeats already-confirmed saves.
      await persist(scope,state)
    }
    return state
  })
}
export function bulkSeoView(state:BulkSeoState) {
  return {...state,run:state.run?{...state.run,lease:undefined,rows:state.run.rows.map(({source,sourceHash,updatedAt,optionsRevision,...row})=>row)}:null}
}
