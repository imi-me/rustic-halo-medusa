import { createHash, randomUUID } from 'node:crypto'
import { MedusaError, Modules } from '@medusajs/framework/utils'
import { createProductOptionsWorkflow, createProductVariantsWorkflow, updateProductVariantsWorkflow } from '@medusajs/medusa/core-flows'
import { HAIR_CLAW_KEY } from './hair-claw-settings'

export const offerTypes = [
  { key:'2-natural', size:'2', finish:'natural', label:'2 inch · Natural' },
  { key:'2-cbc', size:'2', finish:'cbc', label:'2 inch · Colors by Cate' },
  { key:'4-natural', size:'4', finish:'natural', label:'4 inch · Natural' },
  { key:'4-cbc', size:'4', finish:'cbc', label:'4 inch · Colors by Cate' },
] as const
const fields = ['id','title','description','metadata','options.*','options.values.*','images.*','variants.*','variants.options.*','variants.options.option.title','variants.price_set.prices.*','variants.price_set.prices.price_rules.*']
export async function offerProduct(scope:any,id:string) {
  const { data } = await scope.resolve('query').graph({entity:'product',filters:{id},fields})
  if (!data[0]) throw new MedusaError(MedusaError.Types.NOT_FOUND,'Product not found.')
  return data[0]
}
const baseUsd = (price:any) => !price.price_list_id && price.currency_code === 'usd' && price.min_quantity == null && price.max_quantity == null && !(price.price_rules || []).length
export function priceRevision(variants:any[]) {
  return createHash('sha256').update(JSON.stringify(variants.map(v=>({id:v.id,prices:(v.price_set?.prices || []).map((p:any)=>({id:p.id,updated_at:p.updated_at,amount:p.amount,currency:p.currency_code,min:p.min_quantity,max:p.max_quantity,rules:p.price_rules})).sort((a:any,b:any)=>a.id.localeCompare(b.id))})).sort((a,b)=>a.id.localeCompare(b.id)))).digest('hex')
}
export function offerPrices(product:any) {
  const settings = product.metadata?.[HAIR_CLAW_KEY] || {}
  return Object.fromEntries(offerTypes.map(type=>{
    const ids = new Set(settings.offers?.[type.key]?.variant_ids || [])
    const variants = (product.variants || []).filter((v:any)=>ids.has(v.id))
    const amounts = variants.map((v:any)=>v.price_set?.prices?.filter(baseUsd)).filter(Boolean)
    const same = variants.length > 0 && amounts.every((a:any)=>a.length===1 && Number(a[0].amount)===Number(amounts[0]?.[0]?.amount))
    return [type.key,{amount:settings.draft_prices?.[type.key] ?? (same ? Number(amounts[0][0].amount) : null),currency:'usd',revision:priceRevision(variants),enabled:settings.recipes?.[type.key]?.enabled === true}]
  }))
}
export function activeOfferVariantIds(metadata:any):Set<string> | null {
  if (!metadata?.hair_claw_template_v2?.offer_mode) return null
  const media = metadata[HAIR_CLAW_KEY] || {}
  return new Set(offerTypes.flatMap(type=>media.recipes?.[type.key]?.enabled ? media.offers?.[type.key]?.variant_ids || [] : []))
}
function priceInput(price:any,amount:number) {
  return {id:price.id,currency_code:price.currency_code,amount:baseUsd(price)?amount:Number(price.amount),min_quantity:price.min_quantity,max_quantity:price.max_quantity,rules:Object.fromEntries((price.price_rules || []).map((r:any)=>[r.attribute,r.value]))}
}
export async function saveTypeOffer(scope:any,id:string,input:any) {
  const type = offerTypes.find(t=>t.size===input.size && t.finish===input.finish)!
  if (typeof input.price !== 'number') throw new MedusaError(MedusaError.Types.INVALID_DATA,'Enter the USD price for this size and finish.')
  return scope.resolve(Modules.LOCKING).execute(`hair-claw-media:${id}`,async()=>{
    const product = await offerProduct(scope,id), products = scope.resolve(Modules.PRODUCT)
    const config = product.metadata?.hair_claw_template_v2
    if (!config?.offer_mode) throw new MedusaError(MedusaError.Types.INVALID_DATA,'This product needs the four-option hair-claw template.')
    const previous = product.metadata?.[HAIR_CLAW_KEY] || {revision:null,recipes:{}}
    if ((previous.revision || null)!==input.revision) throw new MedusaError(MedusaError.Types.CONFLICT,'Overlay settings changed in another editor. Reload before saving.')
    const recipes={...previous.recipes},drafts={...previous.drafts},draftPrices={...previous.draft_prices},offers={...previous.offers}
    const ids=new Set(offers[type.key]?.variant_ids || []),existing=product.variants.filter((v:any)=>ids.has(v.id))
    if (input.pricing_revision!==priceRevision(existing)) throw new MedusaError(MedusaError.Types.CONFLICT,'This option’s prices changed. Reload before saving; your draft is kept.')
    let recipe=input.recipe
    if (recipe) {
      const source=recipe.image_id ? product.images?.find((i:any)=>i.id===recipe.image_id) : await scope.resolve(Modules.FILE).retrieveFile(recipe.file_id)
      if (!source) throw new MedusaError(MedusaError.Types.INVALID_DATA,'That photo no longer belongs to this product.')
      const address=new URL(source.url)
      if (!['http:','https:'].includes(address.protocol)||address.username||address.password) throw new MedusaError(MedusaError.Types.INVALID_DATA,'Choose a saved HTTP image.')
      recipe={...recipe,url:source.url,template:`${type.size}-inch-v1`,finish:type.finish}
    }
    let nextConfig={...config}
    if (recipe?.enabled) {
      if (!existing.length) {
        const source=product.variants.find((v:any)=>config.variant_ids.includes(v.id) && v.metadata?.physical_size===type.size) || product.variants.find((v:any)=>v.id===config.default_variant_id)
        if (!source) throw new MedusaError(MedusaError.Types.INVALID_DATA,'Set up a source variant with shipping fields first.')
        let finishOption=product.options.find((o:any)=>o.id===config.finish_option_id || o.title==='Claw finish')
        if (!finishOption) {
          const {result}=await createProductOptionsWorkflow(scope).run({input:{product_options:[{title:'Claw finish',values:['Natural','Colors by Cate'],is_exclusive:true}]}})
          finishOption=result[0];await products.addProductOptionToProduct({product_id:id,product_option_id:finishOption.id})
        }
        const sizeTitle=product.options.find((o:any)=>o.id===config.size_option_id)?.title
        const colorTitle=product.options.find((o:any)=>o.id===config.color_option_id)?.title
        if (!sizeTitle || !colorTitle) throw new MedusaError(MedusaError.Types.INVALID_DATA,'Size/color setup changed. Reload before saving.')
        const sourceOptions=Object.fromEntries(source.options.map((o:any)=>[product.options.find((p:any)=>p.id===o.option_id)?.title || o.option?.title,o.value]))
        const skus=config.palette.map((color:string)=>`RH-HC3-${id.slice(-10)}-${type.key}-${color.toUpperCase()}`)
        const collision=await products.listProductVariants({sku:skus},{take:100})
        if (collision.length) throw new MedusaError(MedusaError.Types.CONFLICT,'An earlier save created variants without confirming the fit. Check this option before retrying.')
        const {result}=await createProductVariantsWorkflow(scope).run({input:{product_variants:config.palette.map((color:string,i:number)=>({product_id:id,title:`${type.label} / ${color}`,sku:skus[i],options:{...sourceOptions,[sizeTitle]:`${type.size} inch`,[colorTitle]:color,[finishOption.title]:type.finish==='cbc'?'Colors by Cate':'Natural'},prices:[{currency_code:'usd',amount:input.price}],manage_inventory:true,allow_backorder:true,requires_shipping:true,weight:source.weight,material:source.material,hs_code:source.hs_code,origin_country:source.origin_country,mid_code:source.mid_code,length:source.length,height:source.height,width:source.width,metadata:{hair_claw_template:'rustic_halo_hair_claw_v3',physical_size:type.size,claw_finish:type.finish,base_claw_color:color,inventory_mode:'made_to_order_color_option'}}))}})
        offers[type.key]={variant_ids:result.map((v:any)=>v.id)}
        nextConfig={...nextConfig,finish_option_id:finishOption.id,variant_ids:[...config.variant_ids,...result.map((v:any)=>v.id)],option_ids:[config.size_option_id,finishOption.id,config.color_option_id]}
      } else {
        if (existing.length!==config.palette.length) throw new MedusaError(MedusaError.Types.CONFLICT,'This option’s color variants are incomplete. Review before saving.')
        const updates=existing.map((v:any)=>{
          const prices=(v.price_set?.prices || []).filter((p:any)=>!p.price_list_id)
          if (prices.filter(baseUsd).length!==1) throw new MedusaError(MedusaError.Types.INVALID_DATA,'Each color needs one base USD price. Review advanced prices first.')
          return {id:v.id,prices:prices.map((p:any)=>priceInput(p,input.price))}
        }).filter((v:any)=>existing.find((x:any)=>x.id===v.id).price_set.prices.find(baseUsd).amount!==input.price)
        if (updates.length) await updateProductVariantsWorkflow(scope).run({input:{product_variants:updates}})
      }
      recipes[type.key]=recipe;delete drafts[type.key];delete draftPrices[type.key]
    } else if (recipe) {drafts[type.key]=recipe;draftPrices[type.key]=input.price}
    else {delete recipes[type.key];delete drafts[type.key];draftPrices[type.key]=input.price}
    // Read again after native price/variant writes. Preserve unrelated metadata
    // and do not overwrite another fitting editor's intervening revision.
    const latest=await products.retrieveProduct(id)
    if ((latest.metadata?.[HAIR_CLAW_KEY]?.revision || null)!==input.revision) throw new MedusaError(MedusaError.Types.CONFLICT,'Fit changed while prices saved. Reload and check the prices before retrying.')
    const settings={...previous,revision:randomUUID(),recipes,drafts,draft_prices:draftPrices,offers}
    await products.updateProducts(id,{metadata:{...latest.metadata,[HAIR_CLAW_KEY]:settings,hair_claw_template_v2:nextConfig}})
    const saved=await offerProduct(scope,id)
    return {settings,offer_prices:offerPrices(saved)}
  })
}
