import { createHash } from 'node:crypto'
import { z } from 'zod'
import { clawSize } from '../hair-claw-colors'
import { historicalTransactionFingerprint } from './historical-order-matches'
export const matchingKey = (shop: number) => `etsy-order-item-matches:${shop}`
const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
const targetSchema = z.object({ productId:z.string().startsWith('prod_'),productTitle:z.string().min(1).max(300),groupKey:z.string().min(1).max(4000),groupLabel:z.string().min(1).max(500),variantIds:z.array(z.string().startsWith('variant_')).min(1).max(100),variantId:z.string().startsWith('variant_').nullable(),variantLabel:z.string().max(500).nullable(),signature:z.string().regex(/^[a-f0-9]{64}$/) }).strict()
export const itemMatchesSchema = z.object({ version:z.literal(1),revision:z.string().uuid(),links:z.array(z.object({receiptId:id,transactionId:id,sourceFingerprint:z.string().regex(/^[a-f0-9]{64}$/),target:targetSchema,actor:z.string().min(1),approvedAt:z.string().datetime()}).strict()).max(2000),rules:z.array(z.object({sourceSignature:z.string().regex(/^[a-f0-9]{64}$/),target:targetSchema,actor:z.string().min(1),approvedAt:z.string().datetime()}).strict()).max(1000) }).strict().superRefine((c,ctx)=>{
 if(new Set(c.links.map(l=>`${l.receiptId}:${l.transactionId}`)).size!==c.links.length||new Set(c.rules.map(r=>r.sourceSignature)).size!==c.rules.length)ctx.addIssue({code:'custom',message:'Duplicate saved order matches.'})
 for(const t of [...c.links.map(l=>l.target),...c.rules.map(r=>r.target)])if(new Set(t.variantIds).size!==t.variantIds.length||(t.variantId&&!t.variantIds.includes(t.variantId)))ctx.addIssue({code:'custom',message:'Invalid match variants.'})
})
export type ItemMatchTarget=z.infer<typeof targetSchema>
export type ItemMatches=z.infer<typeof itemMatchesSchema>
const canonical=(value:any):any=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value
export const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
export async function readItemMatches(ops:any,shop:number):Promise<ItemMatches|null>{const [row]=await ops.listAdminOperations({operation_key:matchingKey(shop)});return row?itemMatchesSchema.parse(row.payload):null}
export function selectionSignature(t:any){
 if(!Number.isSafeInteger(t.listing_id)||t.listing_id<1||!Number.isSafeInteger(t.product_id)||t.product_id<1||!String(t.sku??'').trim())return null
 const options=(Array.isArray(t.variations)?t.variations:[]).map((o:any)=>[o.property_id??null,o.value_id??null,o.formatted_name??'',o.formatted_value??'']).sort((a:any,b:any)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))
 return digest([t.listing_id,t.product_id,String(t.sku).trim().toLowerCase(),options])
}
export function targetSignature(variants:any[]){return digest(variants.map(v=>[v.id,v.product_id??v.product?.id,v.sku??null,v.metadata?.physical_size??null,(v.options??[]).map((o:any)=>[o.option_id,o.value]).sort((a:any,b:any)=>String(a[0]).localeCompare(String(b[0])))]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))))}
export function matchingGroups(product:any){
 const config=product.metadata?.hair_claw_template_v2,claw=Boolean(config)||/hair\s*claw/i.test(product.title??'')
 const groups=new Map<string,{key:string,label:string,variants:any[],signature:string}>()
 for(const v of product.variants??[]){
  const options=v.options??[],named=(o:any)=>o.option?.title??product.options?.find((p:any)=>p.id===o.option_id)?.title??'Option'
  const sizeOption=options.find((o:any)=>o.option_id===config?.size_option_id)||options.find((o:any)=>/size/i.test(named(o)))
  const size=claw?(clawSize(v.metadata?.physical_size)||clawSize(sizeOption?.value)||clawSize(config?.unlabelled_size)):undefined
  const extras=options.filter((o:any)=>o.option_id!==config?.color_option_id&&!/colou?r/i.test(named(o))&&o.option?.metadata?.purpose!=='base_claw_color'&&!(size&&/size/i.test(named(o)))&&!(/^(?:default title|original)$/i.test(o.value)&&/^title$/i.test(named(o)))).map((o:any)=>[named(o).toLowerCase(),String(o.value)]).sort((a:any,b:any)=>a[0].localeCompare(b[0])||a[1].localeCompare(b[1]))
  const key=JSON.stringify([size??null,extras]),label=[size?`${size}-inch`:null,...extras.map((o:any)=>o[1])].filter(Boolean).join(' · ')||(claw?'Size needs review':'Standard')
  const g=groups.get(key)??{key,label,variants:[],signature:''};g.variants.push(v);groups.set(key,g)
 }
 return [...groups.values()].map(g=>({...g,variants:g.variants.sort((a,b)=>a.title.localeCompare(b.title)||a.sku?.localeCompare(b.sku??'')||a.id.localeCompare(b.id)),signature:targetSignature(g.variants)})).sort((a,b)=>a.label.localeCompare(b.label))
}
export function itemMatch(receiptId:number,t:any,variants:any[],config:ItemMatches|null){
 if(!config)return null
 const link=config.links.find(l=>l.receiptId===receiptId&&l.transactionId===t.transaction_id),signature=selectionSignature(t)
 const target=link?.target??config.rules.find(r=>r.sourceSignature===signature)?.target
 if(!target)return null
 const invalid={match:'manual_review',productId:null,matchedProductTitle:null,packingVariantIds:[] as string[],manualVariantId:null,matchedGroupLabel:null,matchedVariantLabel:null}
 if(link&&link.sourceFingerprint!==historicalTransactionFingerprint(receiptId,t))return invalid
 const refs=target.variantIds.map(id=>variants.find(v=>v.id===id))
 if(refs.some(v=>!v||v.product_id!==target.productId)||targetSignature(refs)!==target.signature)return invalid
 return {match:target.variantId?'manual_variant':'manual_product',productId:target.productId,matchedProductTitle:target.productTitle,packingVariantIds:target.variantIds,manualVariantId:target.variantId,matchedGroupLabel:target.groupLabel,matchedVariantLabel:target.variantLabel}
}
