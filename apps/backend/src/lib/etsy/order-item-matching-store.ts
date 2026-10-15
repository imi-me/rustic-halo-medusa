import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { z } from 'zod'
import { Modules } from '@medusajs/framework/utils'
import { ADMIN_OPERATIONS } from '../../modules/admin-operations'
import { etsyWorkspaceAccess } from './listing-workspace'
import { workspaceShop, workspaceSnapshot, readReceipt } from './order-workspace-store'
import { digest, itemMatchesSchema, matchingGroups, matchingKey, readItemMatches, selectionSignature, targetSignature, type ItemMatchTarget } from './order-item-matches'
import { historicalTransactionFingerprint, equivalentPackingReference } from './historical-order-matches'
import { readPackageConfig } from '../shipping-package-store'
import { planShipping } from '../shipping-plan'
const positiveId = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
export const matchInput = z.object({ action:z.enum(['review','save']), transaction_id:positiveId, product_id:z.string().startsWith('prod_'), group_key:z.string().min(1).max(4000), variant_id:z.string().startsWith('variant_').nullable(), expected_revision:z.string().uuid(), matching_revision:z.string().uuid().nullable(), remember:z.boolean(), confirm_match:z.boolean().optional(), review_hash:z.string().regex(/^[a-f0-9]{64}$/).optional() }).strict()
export class OrderMatchError extends Error {}
const fail=(message:string):never=>{throw new OrderMatchError(message)}
const orderKey=(shop:number,id:number)=>`etsy-order:${shop}:${id}`
async function currentRow(scope:any,shop:number,id:number,transaction:number){
 const [row]=await scope.resolve(ADMIN_OPERATIONS).listAdminOperations({operation_key:orderKey(shop,id)})
 if(!row||!row.payload.order.transactions.some((t:any)=>t.transactionId===transaction&&!t.digital))fail('Reopen this order before matching a physical item.')
 return row
}
async function productChoices(scope:any,productId:string){
 let product:any
 try{product=await scope.resolve(Modules.PRODUCT).retrieveProduct(productId,{relations:['options','variants','variants.options','variants.options.option']})}catch{fail('This product is unavailable. Choose another product.')}
 const groups=matchingGroups(product)
 if(!groups.length)fail('This product has no variants to match.')
 return {product,groups}
}
export async function readMatchChoices(scope:any,id:number,transaction:number,productId:string){
 const shop=await workspaceShop(scope),ops=scope.resolve(ADMIN_OPERATIONS)
 await currentRow(scope,shop,id,transaction)
 const {product,groups}=await productChoices(scope,productId)
 return {matchingRevision:(await readItemMatches(ops,shop))?.revision??null,product:{id:product.id,title:product.title},groups:groups.map(g=>({key:g.key,label:g.label,variants:g.variants.map(v=>({id:v.id,title:v.title,sku:v.sku??null}))}))}
}
export async function matchOrderItem(scope:any,id:number,input:z.infer<typeof matchInput>,actor:string,request:typeof fetch=fetch){
 const shop=await workspaceShop(scope)
 return scope.resolve(Modules.LOCKING).execute(`etsy-order-workspace:${shop}`,async()=>{
  const ops=scope.resolve(ADMIN_OPERATIONS),products=scope.resolve(Modules.PRODUCT),row=await currentRow(scope,shop,id,input.transaction_id)
  if(row.payload.revision!==input.expected_revision)fail('This order changed. Reopen it before matching this item.')
  const config=await readItemMatches(ops,shop)
  if((config?.revision??null)!==input.matching_revision)fail('Saved matches changed. Reload the product choices and review again.')
  const access=await etsyWorkspaceAccess(scope)
  if(access.shopId!==shop)fail('The Etsy shop connection changed. Reopen this order.')
  const raw=await readReceipt(access,id,request),snapshot=await workspaceSnapshot(scope,shop,raw)
  if(!isDeepStrictEqual(snapshot,row.payload.order))fail('Etsy order details changed. Reopen the order and review the latest selections.')
  const transaction=raw.transactions.find((t:any)=>t.transaction_id===input.transaction_id)
  if(!transaction||transaction.is_digital===true)fail('This physical item is no longer on the order.')
  const item=snapshot.transactions.find(t=>t.transactionId===input.transaction_id)!
  if(item.match==='matched')fail('This SKU already matches a native variant. Reopen the order to review it.')
  const {product,groups}=await productChoices(scope,input.product_id),group=groups.find(g=>g.key===input.group_key)
  if(!group)return fail('This size or finish changed. Reload the product choices.')
  if(input.variant_id&&!group.variants.some(v=>v.id===input.variant_id))fail('Choose a variant belonging to this size and finish.')
  const refs=input.variant_id?group.variants.filter(v=>v.id===input.variant_id):group.variants
  const target:ItemMatchTarget={productId:product.id,productTitle:product.title,groupKey:group.key,groupLabel:group.label,variantIds:refs.map(v=>v.id),variantId:input.variant_id,variantLabel:input.variant_id?refs[0].title:null,signature:targetSignature(refs)}
  const reference=await equivalentPackingReference(target.variantIds,target.productId,products)
  const packages=await readPackageConfig(ops),parcels=await planShipping([{variant_id:reference,quantity:transaction.quantity}],packages,products)
  const sourceSignature=selectionSignature(transaction)
  if(input.remember&&!sourceSignature)fail('This Etsy item has no complete listing, SKU and selection identity. Save it for this order only.')
  const reviewHash=digest([id,input.transaction_id,input.expected_revision,input.matching_revision,actor,historicalTransactionFingerprint(id,transaction),target,packages.revision,parcels,input.remember])
  const review={productTitle:target.productTitle,groupLabel:target.groupLabel,variantLabel:target.variantLabel,parcels,reviewHash,canRemember:Boolean(sourceSignature),packingOnly:!input.variant_id}
  if(input.action==='review')return review
  if(!input.confirm_match||input.review_hash!==reviewHash)fail('Review the current product, size and packing suggestion before saving.')
  const approvedAt=new Date().toISOString(),next=itemMatchesSchema.parse({version:1,revision:randomUUID(),links:[...(config?.links??[]).filter(l=>l.receiptId!==id||l.transactionId!==input.transaction_id),{receiptId:id,transactionId:input.transaction_id,sourceFingerprint:historicalTransactionFingerprint(id,transaction),target,actor,approvedAt}],rules:input.remember?[...(config?.rules??[]).filter(r=>r.sourceSignature!==sourceSignature),{sourceSignature,target,actor,approvedAt}]:(config?.rules??[])})
  const [saved]=await ops.listAdminOperations({operation_key:matchingKey(shop)}),data={payload:next,status:'configured'}
  if(saved)await ops.updateAdminOperations({id:saved.id,...data})
  else await ops.createAdminOperations({operation_key:matchingKey(shop),kind:'etsy-order-item-matches',resource_id:String(shop),...data})
  return {...review,saved:true}
 },{timeout:5,expire:120})
}
