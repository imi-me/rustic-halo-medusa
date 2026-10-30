import { createHash, randomUUID } from 'node:crypto'
import { MedusaError, Modules } from '@medusajs/framework/utils'
import { updateProductVariantsWorkflow } from '@medusajs/medusa/core-flows'
import { HAIR_CLAW_KEY } from './hair-claw-settings'
import { colorSupportsSize, variantClawColor } from './hair-claw-colors'
import { readClawPalette } from './hair-claw-color-store'
import { ADMIN_OPERATIONS } from '../modules/admin-operations'
import { usesClawOrderColors } from './hair-claw-order-choices'

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
function variantsForOffer(product:any,type:typeof offerTypes[number]) {
  const config=product.metadata?.hair_claw_template_v2
  const ids=new Set(product.metadata?.[HAIR_CLAW_KEY]?.offers?.[type.key]?.variant_ids || [])
  return (product.variants || []).filter((v:any)=> {
    if (!usesClawOrderColors(product)) return ids.has(v.id)
    const choice=config.order_choices?.[v.id]
    return config.variant_ids.includes(v.id) && choice?.size===type.size && (choice.finish ?? 'natural')===type.finish
  })
}
export function availableClawOffers(product:any) {
  return usesClawOrderColors(product) ? offerTypes.filter(type=>variantsForOffer(product,type).length).map(type=>[type.key,type.label]) : offerTypes.map(type=>[type.key,type.label])
}
export function offerPrices(product:any) {
  const settings = product.metadata?.[HAIR_CLAW_KEY] || {}
  return Object.fromEntries(offerTypes.map(type=>{
    const variants = variantsForOffer(product,type)
    const amounts = variants.map((v:any)=>v.price_set?.prices?.filter(baseUsd)).filter(Boolean)
    const same = variants.length > 0 && amounts.every((a:any)=>a.length===1 && Number(a[0].amount)===Number(amounts[0]?.[0]?.amount))
    return [type.key,{amount:settings.draft_prices?.[type.key] ?? (same ? Number(amounts[0][0].amount) : null),currency:'usd',revision:priceRevision(variants),enabled:settings.recipes?.[type.key]?.enabled === true}]
  }))
}
export function activeOfferVariantIds(metadata:any):Set<string> | null {
  const config = metadata?.hair_claw_template_v2
  if (!config) return null
  if (config.color_mode === 'order') return new Set(config.variant_ids)
  if (!config.offer_mode) return Array.isArray(config.variant_ids) ? new Set(config.variant_ids) : null
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
    const existing=variantsForOffer(product,type)
    if (input.pricing_revision!==priceRevision(existing)) throw new MedusaError(MedusaError.Types.CONFLICT,'This option’s prices changed. Reload before saving; your draft is kept.')
    let recipe=input.recipe
    if (recipe) {
      const source=recipe.image_id ? product.images?.find((i:any)=>i.id===recipe.image_id) : await scope.resolve(Modules.FILE).retrieveFile(recipe.file_id)
      if (!source) throw new MedusaError(MedusaError.Types.INVALID_DATA,'That photo no longer belongs to this product.')
      const address=new URL(source.url)
      if (!['http:','https:'].includes(address.protocol)||address.username||address.password) throw new MedusaError(MedusaError.Types.INVALID_DATA,'Choose a saved HTTP image.')
      recipe={...recipe,url:source.url,template:`${type.size}-inch-v1`,finish:type.finish}
    }
    const nextConfig={...config}
    if (recipe?.enabled) {
      const palette = await readClawPalette(scope.resolve(ADMIN_OPERATIONS))
      const colors = palette.colors.filter(c => c.active && colorSupportsSize(c, type.size)).map(c => c.name)
      if (!colors.length) throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Choose shared colors for this size before enabling its offer.')
      if (!usesClawOrderColors(product) && colors.some(name => !config.palette.includes(name))) throw new MedusaError(MedusaError.Types.CONFLICT, 'Apply shared colors to this product before enabling its offer.')
      if (!existing.length) throw new MedusaError(MedusaError.Types.INVALID_DATA, 'This size and finish is not in the existing catalog. Add only an actual sellable offer before enabling its artwork.')
      {
        if (!usesClawOrderColors(product) && colors.some(name => !existing.some((v:any) => variantClawColor(product, v) === name))) throw new MedusaError(MedusaError.Types.CONFLICT,'Simplify this design to order color choices before saving its offer.')
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
